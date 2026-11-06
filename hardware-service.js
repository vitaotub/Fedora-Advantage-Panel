// ============================================================
// FAP — Detecção de hardware e sugestão de drivers
// ============================================================
//
// Este módulo é usado pelo server.js para o endpoint /hardware-scan.
// Não depende de bibliotecas externas — usa apenas child_process e fs
// (ambos nativos). Roda os comandos lspci, lsusb e rpm para cruzar
// com o hardware_map.json e devolver uma lista de dispositivos
// detectados com sugestões de driver.

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const HARDWARE_MAP_PATH = path.join(__dirname, 'hardware_map.json');

// ============================================================
// HELPERS INTERNOS
// ============================================================

function _exec(cmd, timeoutMs) {
    return new Promise(function(resolve) {
        exec(cmd, {
            shell: '/bin/bash',
            timeout: timeoutMs || 5000,
            maxBuffer: 5 * 1024 * 1024,
            env: process.env
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
// MOK ENROLLED — verifica se a chave do akmods está de fato
// registrada no firmware (não só gerada em disco).
// ============================================================
//
// `mokutil --test-key <arquivo>` é o teste canônico:
//   • exit 0 + "is already enrolled"  → enrolled
//   • exit != 0 + "is not enrolled"   → gerada mas não enrolled
//   • arquivo ausente                 → sem chave
//
// Usado pelo `/hardware-scan` como campo adicional `secure_boot_enrolled`.
// O frontend usa isso para esconder o passo a passo do Secure Boot
// quando o enrollment já foi concluído — em vez de mostrar instruções
// para algo que o usuário já fez.
async function _checkMokEnrolled() {
    var chave = '/etc/pki/akmods/certs/public_key.der';

    // Se o arquivo nem existe, não há o que testar.
    var existe = await _exec('test -f ' + chave + ' 2>/dev/null && echo yes');
    if (existe.stdout.trim() !== 'yes') {
        return { chave_gerada: false, enrolled: false };
    }

    // `mokutil --test-key` pode exigir root para ler o MOK list.
    // Tentamos sem sudo primeiro (funciona quando o usuário tem
    // permissão de leitura no firmware); se falhar com erro de
    // permissão, tentamos `sudo -n` (NOPASSWD) e, por fim, tratamos
    // como "desconhecido" — o frontend cai no comportamento antigo.
    var r = await _exec('mokutil --test-key ' + chave + ' 2>&1');
    var out = (r.stdout || '').toLowerCase();

    if (out.indexOf('already enrolled') !== -1) {
        return { chave_gerada: true, enrolled: true };
    }
    if (out.indexOf('not enrolled') !== -1) {
        return { chave_gerada: true, enrolled: false };
    }
    // Erro de permissão ou mokutil ausente: não conseguimos determinar.
    return { chave_gerada: true, enrolled: null };
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
        // `{ chave_gerada: bool, enrolled: bool | null }`:
        //   • chave_gerada === false → nunca rodou "Preparar Secure Boot"
        //   • enrolled === true      → chave enrolled no firmware (tudo OK)
        //   • enrolled === false     → chave gerada mas NÃO enrolled
        //   • enrolled === null      → não foi possível determinar
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
