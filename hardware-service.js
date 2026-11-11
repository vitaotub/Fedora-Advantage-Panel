// ============================================================
// FAP — Detecção de hardware e sugestão de drivers
// ============================================================
//
// Este módulo é usado pelo server.js para o endpoint /hardware-scan.
// Não depende de bibliotecas externas — usa apenas child_process e fs
// (ambos nativos). Roda os comandos lspci, lsusb e rpm para cruzar
// com o hardware_map.json e devolver uma lista de dispositivos
// detectados com sugestões de driver.

const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const HARDWARE_MAP_PATH = path.join(__dirname, 'hardware_map.json');

// ============================================================
// HELPERS INTERNOS
// ============================================================

function _exec(cmd, timeoutMs) {
    return new Promise(function(resolve) {
        // ============================================================
        // EXECFILE COM --noprofile --norc (v1.5.6)
        // ============================================================
        //
        // Versão anterior usava `exec` com `shell: '/bin/bash'`. O
        // `bash -c` resultante CARREGA o `.bashrc` do usuário em
        // alguns cenários (Fedora 45 + bash 5.3.15 + ambiente de
        // sessão KDE), mesmo com `BASH_ENV=''`. O `.bashrc` do fgc
        // roda `fastfetch`, que poluía o `stdout` de todo comando
        // shell do FAP.
        //
        // Sintoma em hardware real (fgc, Fedora 45 + KDE):
        // `test -d /etc/pki/akmods/certs/ && echo yes` retornava
        // `"<fastfetch inteiro>\nyes\n"`. O `_checkMokEnrolled`
        // compara `stdout.trim() === 'yes'` — com o fastfetch no
        // meio, a comparação falhava, e o FAP mostrava "chave não
        // gerada" / "enrollment necessário" mesmo com a chave
        // enrolled.
        //
        // Correção: `execFile` com `--noprofile --norc` — o bash
        // IGNORA `.bash_profile`, `.bashrc` e `$BASH_ENV`. Nenhum
        // arquivo de inicialização é carregado. O `execFile` não
        // passa por shell, então não há interpolação de `~`, `$VAR`,
        // etc. no comando — o comando é passado como string única
        // pro `-c`, que é o comportamento esperado (o FAP monta o
        // comando com paths absolutos e variáveis já expandidas).
        var envLimpo = Object.assign({}, process.env, {
            BASH_ENV: '',
            ENV: ''
        });
        execFile('/bin/bash', ['--noprofile', '--norc', '-c', cmd], {
            timeout: timeoutMs || 5000,
            maxBuffer: 5 * 1024 * 1024,
            env: envLimpo
        }, function(error, stdout, stderr) {
            resolve({
                ok: !error,
                stdout: (stdout || '').trim(),
                    stderr: (stderr || '').trim()
            });
        });
    });
}

function _lerMapa() {
    try {
        var bruto = JSON.parse(fs.readFileSync(HARDWARE_MAP_PATH, 'utf8'));
        // Normaliza para garantir que pci_vendors e usb_devices existam.
        // Sem isso, um hardware_map.json válido mas sem uma das chaves
        // causa TypeError em scanHardware() (mapa.pci_vendors[x] com
        // mapa.pci_vendors === undefined).
        return {
            pci_vendors: bruto.pci_vendors || {},
            usb_devices: bruto.usb_devices || {}
        };
    } catch (e) {
        console.error('[hardware-service] Erro ao ler hardware_map.json:', e.message);
        return { pci_vendors: {}, usb_devices: {} };
    }
}

async function _pacoteInstalado(pkg) {
    if (!pkg) return false;
    // Defensivo: os nomes vêm de hardware_map.json (constantes),
    // mas quotar evita problemas caso o JSON seja editado.
    var pkgSeguro = String(pkg).replace(/'/g, "'\\''");
    var r = await _exec("rpm -q '" + pkgSeguro + "' 2>/dev/null");
    if (!r.ok) return false;
    // rpm -q retorna exit 0 apenas se o pacote está instalado.
    // Se não estiver, r.ok é false. Redundância de segurança:
    var out = r.stdout.toLowerCase();
    if (out.includes('não instalado') || out.includes('not installed')) return false;
    return true;
}

// ============================================================
// ESTADO DOS REPOSITÓRIOS
// ============================================================
//
// Antes, cada chamada a `_repositorioAtivo('rpmfusion-free')` e
// `_repositorioAtivo('rpmfusion-nonfree')` disparava um
// `dnf repolist` independente — dois processos `dnf` (cada um
// ~500ms-1s de startup) só para checar dois prefixos.
//
// Agora, `_repositoriosAtivos()` roda o `dnf repolist` UMA vez,
// guarda o output bruto e deixa o chamador fazer `includes()`
// sobre ele quantas vezes quiser.

async function _repositoriosAtivos() {
    var r = await _exec('dnf repolist 2>/dev/null');
    if (!r.ok) return '';
    return r.stdout;
}

async function _repositorioAtivoEm(repo, outputRepolist) {
    if (!repo || !outputRepolist) return false;
    return outputRepolist.includes(repo);
}

async function _driverKernelEmUso(pciAddress) {
    var r = await _exec('lspci -k -s ' + pciAddress + ' 2>/dev/null');
    if (!r.ok) return null;
    var match = r.stdout.match(/Kernel driver in use:\s*(\S+)/);
    return match ? match[1] : null;
}

// Detecção de Blackwell (RTX 50xx, GB20x). Mesma regex do client
// (`_detectarGeracaoNvidia` em hardware.html) — se uma mudar, a
// outra PRECISA mudar junto. Blackwell exige `akmod-nvidia-open`
// (o `nvidia-detect` de versões antigas do RPM Fusion retorna
// `akmod-nvidia`, incompatível).
function _ehBlackwell(nomeGpu) {
    return /\bgb2\d|rtx 50[0-9]{2}\b|blackwell/i.test(nomeGpu || '');
}

async function _nvidiaDetect() {
    // `nvidia-detect` está no RPM Fusion nonfree (não no Fedora
    // padrão). NÃO tentamos instalá-lo daqui: o `install.sh` roda
    // antes da Sessão 1 (RPM Fusion pode não estar ativo) e o
    // `sudo -n` falha silenciosamente em quase todo sistema (sem
    // sudo NOPASSWD), adicionando latência a cada /hardware-scan.
    //
    // Usa o `nvidia-detect` APENAS se já estiver instalado (o
    // usuário pode ter ativado RPM Fusion nonfree manualmente, ou
    // ter instalado via outros guias). Caso contrário, devolve
    // `null` e o fallback por regex no frontend cobre 100% dos
    // casos comuns.
    var check = await _exec('command -v nvidia-detect > /dev/null 2>&1');
    if (!check.ok) return null;

    var r = await _exec('nvidia-detect 2>/dev/null');
    if (!r.ok) return null;
    var match = r.stdout.match(/akmod-nvidia[-\w]*/);
    return match ? match[0] : null;
}

async function _checkSecureBoot() {
    // `2>&1` (não `2>/dev/null`): em BIOS legacy, o `mokutil`
    // escreve "EFI variables are not supported on this system"
    // em STDERR e sai com código != 0. Redirecionando STDERR para
    // STDOUT, o texto chega em `r.stdout` e podemos distinguir
    // "BIOS legacy" (não se aplica) de "mokutil ausente"
    // (`bash: command not found`) ou outro erro.
    var r = await _exec('mokutil --sb-state 2>&1');
    var out = (r.stdout || '').toLowerCase();

    if (out.indexOf('efi variables are not supported') !== -1) {
        return 'not_efi';
    }
    if (out.indexOf('command not found') !== -1 || out.trim() === '') {
        return 'unknown';
    }
    if (out.indexOf('enabled') !== -1) return 'enabled';
    if (out.indexOf('disabled') !== -1) return 'disabled';
    return 'unknown';
}

// ============================================================
// AKMOD CARREGADO (v1.5.6)
// ============================================================
//
// Retorna o nome do primeiro módulo akmod conhecido que está
// carregado no kernel, ou `null` se nenhum está.
//
// Usado como evidência EMPÍRICA de que uma chave akmods está
// enrolled no firmware: se o módulo carregou com Secure Boot
// ativo, então alguma chave (a que assinou o módulo) está
// enrolled. Pode ser uma chave DIFERENTE da `public_key.der`
// local — ex.: chave gerada pelo RPM Fusion direto, ou por
// outra instalação de akmod fora do FAP.
//
// Cobre os 6 akmods do FAP:
//   • nvidia*            (Sessão 3 — akmod-nvidia / -open / -580xx)
//   • vboxdrv            (Sessão 9 — akmod-VirtualBox)
//   • wl                 (Sessão 4 — akmod-wl, Broadcom)
//   • r8168              (Sessão 4 — akmod-r8168, Realtek Ethernet)
//   • xpadneo            (Sessão 4 — xpadneo, DKMS)
//   • v4l2loopback       (Sessão 5 — akmod-v4l2loopback, câmera virtual OBS)
async function _akmodCarregado() {
    var modulos = [
        'nvidia', 'nvidia_drm', 'nvidia_modeset', 'nvidia_uvm',
        'vboxdrv', 'wl', 'r8168', 'xpadneo', 'v4l2loopback'
    ];
    // Prefixo `MATCH:` no output do script. Mesmo que o `bash -c`
    // carregue algum arquivo de inicialização (defesa em
    // profundidade — o `_exec` já limpa `BASH_ENV`/`ENV`), só
    // aceitamos a linha com o prefixo. O `fastfetch`/`neofetch`
    // do usuário, se rodar, não tem esse prefixo e é ignorado.
    var script = 'for mod in ' + modulos.join(' ') + '; do ' +
    '  if lsmod | awk \'{print $1}\' | grep -qx "$mod"; then ' +
    '    echo "MATCH:$mod"; break; ' +
    '  fi; ' +
    'done';
        var r = await _exec(script, 3000);
        var linhas = (r.stdout || '').split('\n');
        for (var i = 0; i < linhas.length; i++) {
            var l = linhas[i].trim();
            if (l.indexOf('MATCH:') === 0) {
                var nome = l.substring('MATCH:'.length).trim();
                // Confirma que o nome é um dos módulos esperados —
                // evita injeção via output malformado.
                if (modulos.indexOf(nome) !== -1) {
                    return { modulo: nome };
                }
            }
        }
        return null;
}

// ============================================================
// PENDING IMPORT (v1.5.8)
// ============================================================
//
// `mokutil --list-new` lista chaves importadas via
// `mokutil --import` que ainda NÃO foram enrolled no firmware
// (aguardando reboot + MOK Management). Correlacionamos por SHA1
// fingerprint com os `.der` locais.
//
// Uso: distinguir "chave importada, aguardando reboot" de "chave
// nunca importada" — antes, o FAP mandava o usuário rodar
// `mokutil --import` de novo, que erra com "already imported".
//
// Retorna array de paths dos `.der` que estão pending. Vazio se
// não há pending OU se não conseguimos correlacionar (openssl
// ausente, fingerprints não batem). Nesse caso, o frontend cai
// no comportamento antigo (step 2) — sem regressão.
async function _detectarPendingImport(chaveDir) {
    if (!chaveDir) return [];

    var listNew = await _exec('mokutil --list-new 2>/dev/null', 5000);
    if (!listNew.stdout || listNew.stdout.trim() === '') {
        listNew = await _exec('sudo -n mokutil --list-new 2>/dev/null', 5000);
    }
    if (!listNew.stdout || listNew.stdout.indexOf('Fingerprint') === -1) {
        return [];
    }

    var fingerprints = [];
    var re = /SHA1 Fingerprint:\s*([\dA-Fa-f:]+)/g;
    var m;
    while ((m = re.exec(listNew.stdout)) !== null) {
        var fp = m[1].replace(/:/g, '').toUpperCase();
        if (fp.length === 40) fingerprints.push(fp);
    }
    if (fingerprints.length === 0) return [];

    var r3 = await _exec('ls ' + chaveDir + '*.der 2>/dev/null', 5000);
    if (!r3.ok || !r3.stdout.trim()) return [];

    var arquivos = r3.stdout.split('\n')
    .map(function(f) { return f.trim(); })
    .filter(Boolean);

    var matches = [];
    for (var i = 0; i < arquivos.length; i++) {
        var fp2 = await _exec(
            'command -v openssl >/dev/null 2>&1 && ' +
            'openssl x509 -inform DER -in "' + arquivos[i] + '" -noout -fingerprint -sha1 2>/dev/null | ' +
            'sed "s/^.*=//; s/://g" | tr "[:lower:]" "[:upper:]"',
            5000
        );
        var localFp = (fp2.stdout || '').trim();
        if (!localFp || localFp.length !== 40) continue;
        if (fingerprints.indexOf(localFp) !== -1) {
            matches.push(arquivos[i]);
        }
    }

    return matches;
}

// ============================================================
// OUTRAS CHAVES AKMODS ENROLLED (v1.5.8)
// ============================================================
//
// Detecta chaves do tipo akmods enrolled no firmware que NÃO
// estão em `/etc/pki/akmods/certs/` — ex.: chave gerada pelo
// RPM Fusion direto em outra instalação, chave trazida de outro
// HD, chave antiga enrolada em outra máquina.
//
// Heurística: `kmodgenca` gera certificados com "akmods" no
// subject/issuer. O `mokutil --list-enrolled` mostra o cert
// completo. Se aparecer "akmod" em qualquer lugar, é evidência
// de chave akmods enrolled.
//
// Falso positivo teórico (nome de usuário contendo "akmod") é
// improvável e de baixo impacto — só aciona um banner informativo,
// não altera o fluxo.
//
// Uso: distinguir "nenhuma chave akmods no firmware" de "alguma
// chave akmods existe (de outra fonte), mas a local não".
async function _detectarOutrasChavesAkmosEnrolled() {
    var r = await _exec('mokutil --list-enrolled 2>/dev/null', 5000);
    if (!r.stdout || r.stdout.trim() === '') {
        r = await _exec('sudo -n mokutil --list-enrolled 2>/dev/null', 5000);
    }
    if (!r.stdout) return false;
    return /akmods?/i.test(r.stdout);
}

// ============================================================
// MOK ENROLLED (v1.5.6 — expandido; v1.5.8 — pending_import,
// current_key_not_enrolled, other_akmods_keys_enrolled)
// ============================================================
//
// A v1.5.5 só testava a chave `public_key.der` via
// `mokutil --test-key`. Isso gerava falso negativo quando o
// usuário enrollou uma chave DIFERENTE — por exemplo:
//
//   • Chave gerada pelo RPM Fusion direto (kmodgenca sem o FAP)
//   • Chave gerada em outra instalação de FAP/HD e enrollada no
//     mesmo firmware
//   • Chave antiga do diretório `/etc/pki/akmods/certs/` cujo
//     symlink `public_key.der` aponta para outra
//
// Nesses casos, o driver funciona (porque a chave enrolled É
// reconhecida pelo firmware), mas o FAP mostrava "enrollment
// necessário" indevidamente.
//
// Correção em 5 camadas (v1.5.8):
//   1. `mokutil --test-key public_key.der` (sem sudo) — caso comum
//   2. `sudo -n mokutil --test-key public_key.der` — efivar protegida
//   3. Varredura de todos os `.der` em `/etc/pki/akmods/certs/` —
//      cobre chaves antigas/paralelas do mesmo diretório
//   4. `_akmodCarregado()` — evidência empírica de que alguma
//      chave akmods está enrolled (mesmo fora do diretório)
//   5. `_detectarOutrasChavesAkmosEnrolled()` — detecta chaves
//      akmods enrolled por fora (RPM Fusion direto, outro HD)
//
// Também detecta `pending_import`: chave importada via
// `mokutil --import` aguardando reboot. Antes, o FAP mostrava
// "enrollment necessário" e mandava rodar `--import` de novo,
// que erra com "already imported".
//
// Retorna:
//   • chave_gerada: bool — `public_key.der` existe
//   • enrolled: bool | null — true/false/null (indeterminado)
//   • erro: string | null
//   • akmod_carregado: { modulo } | null
//   • pending_import: bool
//   • pending_import_files: string[]
//   • other_akmods_keys_enrolled: bool | null
//   • current_key_not_enrolled: bool | null
async function _checkMokEnrolled() {
    var chaveDir = '/etc/pki/akmods/certs/';
    var chave = chaveDir + 'public_key.der';

    var existeDir = await _exec('test -d ' + chaveDir + ' 2>/dev/null && echo yes');
    // v1.5.6: `includes('yes')` em vez de `=== 'yes'` — defesa em
    // profundidade. Mesmo com `execFile --noprofile --norc`, se
    // algum outro `.bashrc` rodar no futuro, o `yes` ainda é
    // detectado no meio do output.
    if (existeDir.stdout.indexOf('yes') === -1) {
        var akmodCarregadoSemDir = await _akmodCarregado();
        var outrasSemDir = await _detectarOutrasChavesAkmosEnrolled();
        return {
            chave_gerada: false,
            enrolled: false,
            erro: null,
            akmod_carregado: akmodCarregadoSemDir,
            pending_import: false,
            other_akmods_keys_enrolled: outrasSemDir,
            current_key_not_enrolled: null
        };
    }

    var existe = await _exec('test -f ' + chave + ' 2>/dev/null && echo yes');
    var publicKeyExiste = (existe.stdout.indexOf('yes') !== -1);

    function _interpretar(saida) {
        var out = (saida || '').toLowerCase();
        if (out.indexOf('already enrolled') !== -1) return true;
        if (out.indexOf('not enrolled') !== -1) return false;
        return null;
    }

    // Detecta pending import ANTES dos testes (o `mokutil --test-key`
    // retorna `false` para chave pending, o que é correto, mas o
    // frontend precisa distinguir pending de "nunca importada").
    var pendingImportFiles = await _detectarPendingImport(chaveDir);
    var pendingImport = pendingImportFiles.length > 0;

    var resultadosTesteKey = [];

    // ---------- Tentativa 1 + 2: public_key.der sem/com sudo -n ----------
    if (publicKeyExiste) {
        var r1 = await _exec('mokutil --test-key ' + chave + ' 2>&1', 10000);
        var res1 = _interpretar(r1.stdout);
        resultadosTesteKey.push(res1);
        if (res1 === true) {
            return {
                chave_gerada: true,
                enrolled: true,
                erro: null,
                akmod_carregado: null,
                pending_import: pendingImport,
                other_akmods_keys_enrolled: null,
                current_key_not_enrolled: null
            };
        }

        var r2 = await _exec('sudo -n mokutil --test-key ' + chave + ' 2>&1', 10000);
        var res2 = _interpretar(r2.stdout);
        resultadosTesteKey.push(res2);
        if (res2 === true) {
            return {
                chave_gerada: true,
                enrolled: true,
                erro: null,
                akmod_carregado: null,
                pending_import: pendingImport,
                other_akmods_keys_enrolled: null,
                current_key_not_enrolled: null
            };
        }
    }

    // ---------- Tentativa 3: varrer outras chaves .der ----------
    var oldKeyEnrolledFile = null;
    var r3 = await _exec('ls ' + chaveDir + '*.der 2>/dev/null', 5000);
    if (r3.ok && r3.stdout.trim()) {
        var arquivos = r3.stdout.split('\n')
        .map(function(f) { return f.trim(); })
        .filter(function(f) {
            if (!f) return false;
            // Pula o próprio public_key.der (já testado acima)
            // e o symlink para o mesmo arquivo.
            if (f === chave) return false;
            return true;
        });

        for (var i = 0; i < arquivos.length; i++) {
            var teste = await _exec('mokutil --test-key "' + arquivos[i] + '" 2>&1', 10000);
            if (_interpretar(teste.stdout) === true) {
                oldKeyEnrolledFile = arquivos[i];
                break;
            }
        }
    }

    if (oldKeyEnrolledFile) {
        // Chave antiga enrolled, mas `public_key.der` (a "atual")
        // NÃO está enrolled. Se `publicKeyExiste` for `false`,
        // a "chave atual" sequer existe — `kmodgenca -a` precisa
        // rodar de novo. Sem esse alinhamento, o painel mostra
        // "configurado OK" (verde) para um usuário que não tem
        // chave local, e a próxima instalação de akmod falha no
        // boot sem aviso.
        return {
            chave_gerada: publicKeyExiste,
            enrolled: true,
            erro: null,
            chave_enrolled: oldKeyEnrolledFile,
            akmod_carregado: null,
            pending_import: pendingImport,
            other_akmods_keys_enrolled: null,
            current_key_not_enrolled: publicKeyExiste
        };
    }

    // ---------- Tentativa 4: evidência empírica ----------
    var akmodCarregado = await _akmodCarregado();

    // ---------- Tentativa 5: chaves akmods de outras fontes ----------
    var outrasChavesAkmos = await _detectarOutrasChavesAkmosEnrolled();

    // Se `public_key.der` existe mas o teste falhou, ainda temos
    // um caso ambíguo (permissão negada, D-Bus transitório).
    if (publicKeyExiste) {
        // Determina enrolled: false vs null
        //   • pending_import → definitivamente NÃO enrolled (pending)
        //   • qualquer teste concluiu false → enrolled: false
        //   • todos inconclusivos → enrolled: null (indeterminado)
        var algumFalsoConclusivo = false;
        for (var k = 0; k < resultadosTesteKey.length; k++) {
            if (resultadosTesteKey[k] === false) {
                algumFalsoConclusivo = true;
                break;
            }
        }

        var enrolledResult;
        if (pendingImport) {
            enrolledResult = false;
        } else if (algumFalsoConclusivo) {
            enrolledResult = false;
        } else {
            enrolledResult = null;
        }

        return {
            chave_gerada: true,
            enrolled: enrolledResult,
            erro: enrolledResult === null ? 'mokutil --test-key falhou sem saída conclusiva' : null,
            akmod_carregado: akmodCarregado,
            pending_import: pendingImport,
            other_akmods_keys_enrolled: outrasChavesAkmos,
            current_key_not_enrolled: null
        };
    }

    // `public_key.der` não existe e nenhum `.der` no diretório.
    // Chave não foi gerada (nunca rodou "Preparar Secure Boot").
    return {
        chave_gerada: false,
        enrolled: false,
        erro: null,
        akmod_carregado: akmodCarregado,
        pending_import: pendingImport,
        other_akmods_keys_enrolled: outrasChavesAkmos,
        current_key_not_enrolled: null
    };
}

// ============================================================
// PARSERS
// ============================================================

// Parse de linha do lspci -nn:
// "01:00.0 VGA compatible controller [0300]: NVIDIA Corporation GA106 [GeForce RTX 3060] [10de:2504]"
function _parseLinhaPci(linha) {
    var match = linha.match(/^([0-9a-f:\.]+)\s+([^:]+):\s+(.+?)\s+\[([0-9a-f]{4}):([0-9a-f]{4})\]/i);
    if (!match) return null;
    return {
        pci_address: match[1],
        category_raw: match[2].trim(),
        name: match[3].trim(),
        vendor_id: match[4].toLowerCase(),
        device_id: match[5].toLowerCase()
    };
}

// Parse de linha do lsusb:
// "Bus 001 Device 005: ID 0bda:c811 Realtek Semiconductor Corp. 802.11ac NIC"
function _parseLinhaUsb(linha) {
    var match = linha.match(/ID\s+([0-9a-f]{4}):([0-9a-f]{4})\s+(.+)/i);
    if (!match) return null;
    return {
        vendor_id: match[1].toLowerCase(),
        product_id: match[2].toLowerCase(),
        name: match[3].trim()
    };
}

// ============================================================
// DETECÇÃO PRINCIPAL
// ============================================================

/**
 * Escaneia os barramentos PCI e USB, cruza com o mapa e devolve
 * uma lista de dispositivos detectados com estado de driver.
 */
async function scanHardware() {
    var mapa = _lerMapa();
    var devices = [];

    // Estado dos repositórios — UMA chamada a `dnf repolist` para
    // checar todos os prefixos (antes eram duas chamadas).
    var repolistOutput = await _repositoriosAtivos();
    var rpmfusionFree = await _repositorioAtivoEm('rpmfusion-free', repolistOutput);
    var rpmfusionNonfree = await _repositorioAtivoEm('rpmfusion-nonfree', repolistOutput);
    var secureBoot = await _checkSecureBoot();
    // O MOK só faz sentido consultar quando o Secure Boot está ativo.
    // Em BIOS legacy / SB desabilitado / desconhecido, devolvemos
    // `null` para não gastar um subprocesso `mokutil` à toa.
    var mok = (secureBoot === 'enabled')
    ? await _checkMokEnrolled()
    : null;

    // ---------- PCI ----------
    var pci = await _exec('lspci -nn');
    if (pci.ok) {
        var linhasPci = pci.stdout.split('\n').filter(Boolean);

        // Fase 1: filtra as linhas PCI relevantes de forma síncrona.
        // Nada aqui toca em disco ou subprocessos — é só parsing em
        // memória, então não há vantagem em paralelizar.
        var candidatosPci = [];
        for (var i = 0; i < linhasPci.length; i++) {
            var parsed = _parseLinhaPci(linhasPci[i]);
            if (!parsed) continue;

            var vendor = mapa.pci_vendors[parsed.vendor_id];
            if (!vendor) continue;

            var isGpu = /VGA|3D|Display/i.test(parsed.category_raw);
            var isNet = /Network|Ethernet/i.test(parsed.category_raw);
            if (!isGpu && !isNet) continue;

            candidatosPci.push({ parsed: parsed, vendor: vendor });
        }

        // Fase 2: resolve cada candidato em paralelo. Antes era um
        // loop sequencial com 1-2 `exec` por dispositivo (~50ms cada
        // por fork do shell) — em uma máquina com 3 GPUs + 2 NICs,
        // somava 1-2 segundos de latência desnecessária.
        var resultadosPci = await Promise.all(candidatosPci.map(async function(c) {
            var parsed = c.parsed;
            var vendor = c.vendor;

            var driverEmUso = await _driverKernelEmUso(parsed.pci_address);

            var conflict = vendor.conflict_check || [];
            var driverPadraoOk = !!driverEmUso && conflict.indexOf(driverEmUso) !== -1;

            var pacotesSugeridos = (vendor.packages || []).slice();

            if (parsed.vendor_id === '10de' && rpmfusionNonfree) {
                // Blackwell tem precedência sobre `nvidia-detect` (que pode
                // retornar o pacote proprietário tradicional, incompatível).
                if (_ehBlackwell(parsed.name)) {
                    pacotesSugeridos = ['akmod-nvidia-open'];
                } else {
                    var sugerido = await _nvidiaDetect();
                    if (sugerido) pacotesSugeridos = [sugerido];
                }
            }

            var instalado = false;
            for (var j = 0; j < pacotesSugeridos.length; j++) {
                if (await _pacoteInstalado(pacotesSugeridos[j])) {
                    instalado = true;
                    break;
                }
            }

            return {
                type: 'PCI',
                pci_address: parsed.pci_address,
                category: vendor.category,
                vendor: vendor.name,
                name: parsed.name,
                device_id: parsed.vendor_id + ':' + parsed.device_id,
                driver_in_use: driverEmUso,
                driver_default_working: driverPadraoOk,
                installed: instalado,
                packages: pacotesSugeridos,
                repo_required: vendor.repo_required || null,
                copr: null,
                notes: vendor.notes || null,
                notes_key: vendor.notesKey || null,
                needs_secure_boot_disabled: parsed.vendor_id === '10de'
            };
        }));

        for (var kp = 0; kp < resultadosPci.length; kp++) {
            devices.push(resultadosPci[kp]);
        }
    }

    // ---------- USB ----------
    var usb = await _exec('lsusb');
    if (usb.ok) {
        var linhasUsb = usb.stdout.split('\n').filter(Boolean);

        var candidatosUsb = [];
        for (var k = 0; k < linhasUsb.length; k++) {
            var parsedUsb = _parseLinhaUsb(linhasUsb[k]);
            if (!parsedUsb) continue;

            var dev = mapa.usb_devices[parsedUsb.vendor_id + ':' + parsedUsb.product_id];
            if (!dev) continue;

            candidatosUsb.push({ parsedUsb: parsedUsb, dev: dev });
        }

        var resultadosUsb = await Promise.all(candidatosUsb.map(async function(c) {
            var parsedUsb = c.parsedUsb;
            var dev = c.dev;

            var instaladoUsb = false;
            if (dev.package) {
                instaladoUsb = await _pacoteInstalado(dev.package);
            }

            return {
                type: 'USB',
                category: dev.category,
                vendor: dev.vendor || 'Desconhecido',
                name: dev.name,
                device_id: parsedUsb.vendor_id + ':' + parsedUsb.product_id,
                driver_in_use: null,
                driver_default_working: false,
                installed: instaladoUsb,
                packages: dev.package ? [dev.package] : [],
                repo_required: null,
                copr: dev.copr || null,
                notes: dev.notes || null,
                notes_key: dev.notesKey || null,
                needs_secure_boot_disabled: false
            };
        }));

        for (var ku = 0; ku < resultadosUsb.length; ku++) {
            devices.push(resultadosUsb[ku]);
        }
    }

    return {
        devices: devices,
        repos: {
            rpmfusion_free: rpmfusionFree,
            rpmfusion_nonfree: rpmfusionNonfree
        },
        secure_boot: secureBoot,
        // `null` quando SB não está ativo. Caso contrário,
        // `{ chave_gerada, enrolled, pending_import, ... }`:
        //   • chave_gerada === false → nunca rodou "Preparar Secure Boot"
        //   • enrolled === true + current_key_not_enrolled false → tudo OK
        //   • enrolled === true + current_key_not_enrolled true → chave antiga enrolled, atual não
        //   • enrolled === false + pending_import true → chave importada, aguardando reboot
        //   • enrolled === false → chave gerada mas NÃO enrolled
        //   • enrolled === null → não foi possível determinar
        secure_boot_mok: mok
    };
}

/**
 * Checa se um pacote específico está instalado (usado pelo frontend
 * quando precisa revalidar o estado de um driver após uma ação).
 */
async function checkPackageInstalled(pkg) {
    return _pacoteInstalado(pkg);
}

module.exports = {
    scanHardware: scanHardware,
    checkPackageInstalled: checkPackageInstalled
};
