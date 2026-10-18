// ============================================================
// FAP — Detecção de estado do sistema
// ============================================================
//
// Módulo usado pelo server.js para o endpoint GET /system-state.
// Roda comandos read-only e devolve um objeto consolidado com o
// estado atual do Fedora do usuário — independente do que o FAP
// já instalou (isso vive no .progresso.json).
//
// Cada fase do projeto adiciona campos aqui. Fase 1: repositórios.
// Fases futuras: pacotes, grupos, kernel params, serviços, arquivos.
//
// Cache em memória por 5 minutos (TTL_CACHE_MS). O endpoint é
// chamado no boot e a cada troca de sessão; o cache evita rodar
// `dnf repolist` 14 vezes seguidas.
//
// Nenhum comando aqui requer senha (todos são read-only).

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 60s: alinhado com o throttle do cliente (`_sincronizarEstadoFlatpaks`
// roda a cada 30s, com cache local). Se o usuário instalar/remover um
// Flatpak por fora, o FAP detecta em até 60s — em vez de até 5 min,
// que era o valor anterior. Custo: 1 `dnf repolist` a cada 60s de uso
// ativo (equivalente a ter um terminal com `watch -n 60 dnf repolist`).
const TTL_CACHE_MS = 60 * 1000;

let _cache = { dados: null, ts: 0 };

function _exec(cmd, timeoutMs) {
    return new Promise(function(resolve) {
        exec(cmd, {
            shell: '/bin/bash',
            timeout: timeoutMs || 8000,
            maxBuffer: 5 * 1024 * 1024,
            env: process.env
        }, function(error, stdout) {
            resolve((stdout || '').trim());
        });
    });
}

// ============================================================
// REPOSITÓRIOS (Fase 1)
// ============================================================
//
// Retorna o conjunto de repos ativos. `dnf repolist --enabled`
// imprime uma linha por repo no formato:
//
//   repo id                    repo name
//   terra                      Terra for Fedora...
//   rpmfusion-free             RPM Fusion for Fedora...
//
// Extraímos a primeira coluna (o ID) e descartamos cabeçalho.
//
// Também consultamos `flatpak remotes` (uma linha por remote) e
// checamos a existência de arquivos `.repo` de fabricantes em
// /etc/yum.repos.d/. Como o server roda como usuário, alguns
// arquivos podem não ser legíveis — nesse caso, tratamos como
// "não detectado" (o botão correspondente continua clicável, e
// o `dnf install` idempotente resolve).

async function _detectarRepos() {
    var repos = new Set();

    // Repos do DNF
    var dnfOut = await _exec('dnf repolist --enabled 2>/dev/null | tail -n +2');
    dnfOut.split('\n').forEach(function(linha) {
        var partes = linha.trim().split(/\s+/);
        if (partes.length > 0 && partes[0]) {
            repos.add(partes[0]);
        }
    });

    // Remotes do Flatpak (o id do remote é o que interessa).
    var flatpakOut = await _exec('flatpak remotes --columns=name 2>/dev/null');
    flatpakOut.split('\n').forEach(function(linha) {
        var id = linha.trim();
        if (id) {
            repos.add('flatpak:' + id);
        }
    });

    // Arquivos .repo de fabricantes. Não podemos consultar o
    // conteúdo (permissão), mas a existência do arquivo já indica
    // que o repo foi configurado.
    var reposFabricante = {
        'opera':        '/etc/yum.repos.d/opera.repo',
        'brave':        '/etc/yum.repos.d/brave-browser.repo',
        'vivaldi':      '/etc/yum.repos.d/vivaldi-fedora.repo',
        'edge':         '/etc/yum.repos.d/microsoft-edge.repo',
        'razer':        '/etc/yum.repos.d/hardware:razer.repo'
    };
    for (var nome in reposFabricante) {
        try {
            if (fs.existsSync(reposFabricante[nome])) {
                repos.add('file:' + nome);
            }
        } catch (e) { /* sem permissão — ignora */ }
    }

    return Array.from(repos);
}

// ============================================================
// PACOTES (Fase 2)
// ============================================================
//
// Lista todos os pacotes RPM instalados via `rpm -qa`. Usa
// --queryformat para o nome "canônico" sem versão/arquitetura.
// Retorna um Set (serializado como array) para lookup O(1) no
// frontend.
//
// Custo: `rpm -qa` típico leva 100–300 ms (depende do número de
// pacotes). Cache de 5min amortiza.

async function _detectarPacotesInstalados() {
    var out = await _exec('rpm -qa --qf "%{NAME}\\n" 2>/dev/null');
    var set = new Set();
    out.split('\n').forEach(function(linha) {
        var nome = linha.trim();
        if (nome) set.add(nome);
    });
        return Array.from(set);
}

// ============================================================
// FLATPAKS (Fase 2)
// ============================================================
//
// Mesma consulta que o endpoint /flatpak-installed já faz, mas
// agora dentro do /system-state. `--app` filtra só aplicativos
// (não runtimes). `--columns=application` retorna um app-id por
// linha.

async function _detectarFlatpaksInstalados() {
    var out = await _exec('flatpak list --app --columns=application 2>/dev/null');
    var set = new Set();
    out.split('\n').forEach(function(linha) {
        var appId = linha.trim();
        if (appId) set.add(appId);
    });
        return Array.from(set);
}

// ============================================================
// GRUPOS DO USUÁRIO (Fase 3)
// ============================================================
//
// Lista os grupos dos quais o usuário é membro. `id -nG` retorna
// em uma linha só, separado por espaço. Inclui grupos primário e
// secundários.
//
// Usado para detectar se o FAP já adicionou o usuário a
// `realtime`, `input`, `libvirt`, `coolercontrol`, `plugdev`, etc.

async function _detectarGrupos() {
    var out = await _exec('id -nG 2>/dev/null');
    return out.split(/\s+/).filter(Boolean);
}

// ============================================================
// SERVIÇOS ATIVOS (Fase 3)
// ============================================================
//
// Consulta o estado dos serviços systemd que o FAP gerencia.
// Usa `systemctl is-active` (retorna "active"/"inactive"/"failed"
// na stdout, exit code 0/3). Coletamos em paralelo — cada chamada
// custa ~10ms.
//
// Serviços atualmente gerenciados:
//   - cups        (impressão, sessão 7)
//   - smb, nmb    (Samba, sessão 7)
//   - libvirtd    (QEMU/KVM, sessão 10)
//   - coolercontrold (CoolerControl, sessão 11)
//   - lactd       (LACT, sessão 3)
//   - dkms        (OpenRazer, sessão 4)
//
// Se um serviço não existir no sistema, `is-active` retorna
// "inactive" — tratamos como não ativo.

const SERVICOS_FAP = [
    'cups',
'smb',
'nmb',
'libvirtd',
'coolercontrold',
'lactd',
'dkms'
];

async function _detectarServicos() {
    var resultados = await Promise.all(SERVICOS_FAP.map(function(svc) {
        return _exec('systemctl is-active ' + svc + ' 2>/dev/null');
    }));
    var ativos = [];
    for (var i = 0; i < SERVICOS_FAP.length; i++) {
        if (resultados[i].trim() === 'active') {
            ativos.push(SERVICOS_FAP[i]);
        }
    }
    return ativos;
}

// ============================================================
// KERNEL PARAMS (Fase 3)
// ============================================================
//
// Coleta o valor de parâmetros do kernel que o FAP ajusta. Há
// dois tipos:
//
//   1. sysctl (runtime + persistidos em /etc/sysctl.d/):
//      - vm.max_map_count
//      - vm.swappiness
//      - vm.vfs_cache_pressure
//      - net.core.default_qdisc
//      - net.ipv4.tcp_congestion_control
//
//   2. cmdline (via grubby, persistidos no GRUB):
//      - nvidia-drm.modeset
//      - amdgpu.ppfeaturemask
//
// Para sysctl, `sysctl -n <key>` retorna o valor atual. Para
// cmdline, `grubby --info=ALL` retorna, por kernel, uma linha
// `args="..."`. Extraímos o valor procurado do primeiro kernel
// (o default).
//
// Os valores são strings — a comparação é feita no frontend por
// `SystemState.kernelParam('vm.swappiness') === '150'`.

async function _detectarKernelParams() {
    var params = {};

    // --- sysctl ---
    var sysctls = [
        'vm.max_map_count',
        'vm.swappiness',
        'vm.vfs_cache_pressure',
        'net.core.default_qdisc',
        'net.ipv4.tcp_congestion_control'
    ];

    var resultadosSysctl = await Promise.all(sysctls.map(function(key) {
        return _exec('sysctl -n ' + key + ' 2>/dev/null');
    }));

    for (var i = 0; i < sysctls.length; i++) {
        var valor = resultadosSysctl[i].trim();
        if (valor) {
            params[sysctls[i]] = valor;
        }
    }

    // --- cmdline via grubby ---
    // `grubby --info=DEFAULT` retorna só o kernel default. Menos
    // ruído que --info=ALL.
    var grubbyOut = await _exec('grubby --info=DEFAULT 2>/dev/null');

    // nvidia-drm.modeset=1
    var modesetMatch = grubbyOut.match(/nvidia-drm\.modeset=(\d+)/);
    if (modesetMatch) {
        params['nvidia-drm.modeset'] = modesetMatch[1];
    }

    // amdgpu.ppfeaturemask=0x...
    var ppfeatureMatch = grubbyOut.match(/amdgpu\.ppfeaturemask=(0x[0-9a-fA-F]+|\d+)/);
    if (ppfeatureMatch) {
        params['amdgpu.ppfeaturemask'] = ppfeatureMatch[1];
    }

    return params;
}

// ============================================================
// ARQUIVOS DE CONFIG (Fase 3)
// ============================================================
//
// Verifica a existência dos arquivos que o FAP cria como estado
// persistente (sysctl.d, pipewire conf.d, etc.).
//
// O HOME do usuário é `process.env.HOME`. Os caminhos são
// expandidos aqui porque `fs.existsSync` não expande `~`.
//
// Arquivos atualmente gerenciados:
//   - /etc/sysctl.d/99-fap-vm-max-map-count.conf
//   - /etc/sysctl.d/99-fap-vm-swappiness.conf
//   - /etc/sysctl.d/99-fap-tcp-bbr.conf
//   - ~/.config/pipewire/pipewire.conf.d/99-fap-quantum.conf
//
// Nota: os arquivos em /etc são legíveis pelo usuário (644 por
// padrão no FAP), mas se por algum motivo não forem, o `test -f`
// via shell resolve. Usamos shell aqui para homogeneidade.

async function _detectarArquivosConfig() {
    var home = process.env.HOME || ('/home/' + (process.env.USER || 'user'));

    var arquivos = [
        '/etc/sysctl.d/99-fap-vm-max-map-count.conf',
        '/etc/sysctl.d/99-fap-vm-swappiness.conf',
        '/etc/sysctl.d/99-fap-tcp-bbr.conf',
        home + '/.config/pipewire/pipewire.conf.d/99-fap-quantum.conf'
    ];

    // `test -f a -o -f b` não escala bem; rodamos em paralelo.
    var resultados = await Promise.all(arquivos.map(function(arq) {
        return _exec('[ -f "' + arq + '" ] && echo "yes" 2>/dev/null');
    }));

    var presentes = [];
    for (var i = 0; i < arquivos.length; i++) {
        if (resultados[i].trim() === 'yes') {
            presentes.push(arquivos[i]);
        }
    }
    return presentes;
}

// ============================================================
// WAYDROID (Fase 4)
// ============================================================
//
// O Waydroid tem 3 estágios independentes:
//   1. Pacote instalado (rpm -q waydroid).
//   2. Container inicializado (waydroid init criou
//      /var/lib/waydroid/waydroid.cfg).
//   3. Extras preparados (o waydroid_script foi clonado e o venv
//      criado em ~/.local/share/fap-waydroid/waydroid_script).
//
// Cada botão da sessão 9 (install, init, extras-prep) só deve
// habilitar quando o estágio anterior foi cumprido. O frontend
// usa esses booleanos para pintar os botões.
//
// O `waydroid-status` (endpoint separado) cobre o "running" — não
// incluímos aqui porque ele muda a cada abertura da UI e não
// pertence ao estado persistente.

async function _detectarWaydroid() {
    var home = process.env.HOME || ('/home/' + (process.env.USER || 'user'));

    var resultados = await Promise.all([
        _exec('rpm -q waydroid 2>/dev/null'),
                                       _exec('[ -f /var/lib/waydroid/waydroid.cfg ] && echo "yes" 2>/dev/null'),
                                       _exec('[ -d "' + home + '/.local/share/fap-waydroid/waydroid_script" ] && echo "yes" 2>/dev/null')
    ]);

    var rpmOut = resultados[0].toLowerCase();
    var pacoteInstalado = rpmOut.length > 0 &&
    !rpmOut.includes('not installed') &&
    !rpmOut.includes('não instalado');

    return {
        installed: pacoteInstalado,
        initialized: resultados[1].trim() === 'yes',
        extras_prepared: resultados[2].trim() === 'yes'
    };
}

// ============================================================
// PONTO DE ENTRADA
// ============================================================

async function scanSystemState() {
    var agora = Date.now();
    if (_cache.dados && (agora - _cache.ts) < TTL_CACHE_MS) {
        return _cache.dados;
    }

    // As 8 consultas são independentes — rodam em paralelo.
    // Numa máquina típica o gargalo continua sendo `dnf repolist`
    // (~500-1000 ms); as demais cabem dentro dessa janela.
    var resultados = await Promise.all([
        _detectarRepos(),
                                       _detectarPacotesInstalados(),
                                       _detectarFlatpaksInstalados(),
                                       _detectarGrupos(),
                                       _detectarServicos(),
                                       _detectarKernelParams(),
                                       _detectarArquivosConfig(),
                                       _detectarWaydroid()
    ]);

    var dados = {
        repos_enabled: resultados[0],
        packages_installed: resultados[1],
        flatpaks_installed: resultados[2],
        groups_membership: resultados[3],
        kernel_params: resultados[5],
        services_active: resultados[4],
        config_files_present: resultados[6],
        waydroid: resultados[7]
    };

    _cache = { dados: dados, ts: agora };
    return dados;
}

function invalidarCache() {
    _cache = { dados: null, ts: 0 };
}

module.exports = {
    scanSystemState: scanSystemState,
    invalidarCache: invalidarCache
};
