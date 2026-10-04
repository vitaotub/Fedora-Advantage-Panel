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

async function _repositorioAtivo(repo) {
    if (!repo) return false;
    var r = await _exec('dnf repolist 2>/dev/null');
    if (!r.ok) return false;
    return r.stdout.includes(repo);
}

async function _driverKernelEmUso(pciAddress) {
    var r = await _exec('lspci -k -s ' + pciAddress + ' 2>/dev/null');
    if (!r.ok) return null;
    var match = r.stdout.match(/Kernel driver in use:\s*(\S+)/);
    return match ? match[1] : null;
}

async function _nvidiaDetect() {
    // nvidia-detect só existe se o RPM Fusion nonfree já estiver ativo.
    // Retorna o nome do pacote sugerido ou null.
    var r = await _exec('nvidia-detect 2>/dev/null');
    if (!r.ok) return null;
    var match = r.stdout.match(/akmod-nvidia[-\w]*/);
    return match ? match[0] : null;
}

async function _checkSecureBoot() {
    var r = await _exec('mokutil --sb-state 2>/dev/null');
    if (!r.ok) return 'unknown';
    var out = r.stdout.toLowerCase();
    if (out.includes('enabled')) return 'enabled';
    if (out.includes('disabled')) return 'disabled';
    return 'unknown';
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

    // Estado dos repositórios (para o frontend mostrar banner de RPM Fusion)
    var rpmfusionFree = await _repositorioAtivo('rpmfusion-free');
    var rpmfusionNonfree = await _repositorioAtivo('rpmfusion-nonfree');
    var secureBoot = await _checkSecureBoot();

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
                var sugerido = await _nvidiaDetect();
                if (sugerido) pacotesSugeridos = [sugerido];
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
                vendor: 'Realtek',
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
        secure_boot: secureBoot
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
