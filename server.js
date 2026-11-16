const http = require('http');
const { exec, execFile, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const hardwareService = require('./hardware-service');
const systemStateService = require('./system-state-service');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ARQUIVO_PROGRESSO = path.join(__dirname, '.progresso.json');
const ARQUIVO_CHANGELOG = path.join(__dirname, 'CHANGELOG.md');

let FAP_VERSION = 'unknown';
try {
    FAP_VERSION = require('./package.json').version || 'unknown';
} catch (e) {
    console.error('[FAP] Não foi possível ler a versão do package.json:', e.message);
}

const LANGS_SUPORTADOS = ['pt-BR', 'en', 'es'];
const LOCALES_DIR = path.join(__dirname, 'locales');

const COMANDOS_SEM_AUTENTICACAO = [
    'rpm -q',
'uname -r',
'ls /boot/vmlinuz-*',
'cat /etc/fedora-release',
'hostname',
'whoami',
'gtk-launch',
'rclone-manager',
'corectrl',
'lact',

'setsid -f gtk-launch',

'setsid -f corectrl',
'setsid -f lact',
'setsid -f rclone-manager',
'setsid -f steam',
'setsid -f rustdesk',
'setsid -f keepassxc',
'setsid -f firefox',
'setsid -f okular',
'setsid -f artcraft-launcher',
'setsid -f sealert',

'setsid -f vlc',
'setsid -f krita',
'setsid -f inkscape',
'setsid -f gimp',
'setsid -f darktable',
'setsid -f coolercontrol',
'setsid -f jstest-gtk',
'setsid -f freecad',
'setsid -f librecad',
'setsid -f kdenlive',
'setsid -f pitivi',
'setsid -f shotcut',
'setsid -f avidemux',
'setsid -f blender',
'setsid -f ardour8',
'setsid -f lmms',
'setsid -f audacity',

'setsid -f chromium-browser',
'setsid -f opera',
'setsid -f brave-browser',
'setsid -f vivaldi-stable',
'setsid -f microsoft-edge-stable',

'flatpak install',
'flatpak uninstall',
'flatpak update',
'flatpak remote-add',

'systemctl --user'
];

const IDS_SEM_AUTENTICACAO = new Set([
    'atualizar-fap',
    'desinstalar-fap',
    'nvidia-vaapi-env',
    'nvidia-vaapi-env-remove'
]);

const IDS_COM_HOME_DO_USUARIO = new Set([]);

const PADROES_UPDATE_WHITELIST = [
    /^bash <\(curl -s https:\/\/raw\.githubusercontent\.com\/vitaotub\/Fedora-Advantage-Panel\/main\/install\.sh\) --update$/,
    /^setsid -f bash -c 'bash <\(curl -s https:\/\/raw\.githubusercontent\.com\/vitaotub\/Fedora-Advantage-Panel\/main\/install\.sh\) --uninstall -y'$/,

    /^mkdir -p ~\/\.config\/environment\.d && tee ~\/\.config\/environment\.d\/99-fap-nvidia-vaapi\.conf <<'FAPEOF'[\s\S]*FAPEOF$/,

/^rm -f ~\/\.config\/environment\.d\/99-fap-nvidia-vaapi\.conf$/
];

function _idSemAuthValido(idComando, comando) {
    if (!IDS_SEM_AUTENTICACAO.has(idComando)) return false;
    var trimmed = (comando || '').trim();
    for (var i = 0; i < PADROES_UPDATE_WHITELIST.length; i++) {
        if (PADROES_UPDATE_WHITELIST[i].test(trimmed)) return true;
    }
    return false;
}

let _askpassHelperPath = null;

function _criarAskpassHelper() {
    if (_askpassHelperPath && fs.existsSync(_askpassHelperPath)) {
        return _askpassHelperPath;
    }

    const helperPath = path.join('/tmp', 'fap-askpass-' + process.pid + '.sh');
    const conteudo = [
        '#!/bin/bash',
        '# Fedora Advantage Panel — askpass helper (auto-gerado)',
        '# Usado pelo sudo quando o FAP roda sem TTY.',
        'if command -v zenity >/dev/null 2>&1; then',
        '  exec zenity --password --title="Fedora Advantage Panel" 2>/dev/null',
        'elif command -v kdialog >/dev/null 2>&1; then',
        '  exec kdialog --password "Senha de administrador (Fedora Advantage Panel)" 2>/dev/null',
        'else',
        '  echo "❌ Nenhum helper gráfico disponível (zenity/kdialog)." >&2',
        '  exit 1',
        'fi'
    ].join('\n');

    try {
        fs.writeFileSync(helperPath, conteudo, { mode: 0o755 });
        _askpassHelperPath = helperPath;
        return helperPath;
    } catch (e) {
        console.warn('[askpass] Falha ao criar helper:', e.message);
        return null;
    }
}

const COMANDOS_USER_CONTEXT = [
    'flatpak',
'systemctl --user',
'pw-metadata',
'pw-cli',
'pactl',
'wpctl',

'gtk-launch'
];

function _precisaEnvUserContext(comando) {
    return COMANDOS_USER_CONTEXT.some(function(cmd) {
        return comando.includes(cmd);
    });
}

const _CARACTERES_ENCADEAMENTO = /[\n\r;`|]|\$\(|&&|<\(|>\(|(?:^|\s)&(?:\s|$)/;

function _temRedirectInvalido(texto) {
    var semDupFd = String(texto || '')
    .replace(/2>&1/g, '  ')
    .replace(/1>&2/g, '  ')
    .replace(/(?:^|\s)>&2/g, '  ');
    return semDupFd.indexOf('>') !== -1;
}

function _cmdSemAutenticacao(comando) {
    const trimmed = (comando || '').trim();

    if (_ehRedirectAbrirValido(trimmed)) {
        return true;
    }

    if (_CARACTERES_ENCADEAMENTO.test(trimmed)) {
        return false;
    }

    if (_temRedirectInvalido(trimmed)) {
        return false;
    }

    return COMANDOS_SEM_AUTENTICACAO.some(function(cmd) {
        return trimmed === cmd
        || trimmed.startsWith(cmd + ' ')
        || trimmed.startsWith(cmd + '\t');
    });
}

const _BINARIOS_ABRIR_WHITELIST = new Set([
    'gtk-launch', 'xdg-open', 'sealert',
    'corectrl', 'lact', 'rclone-manager', 'steam', 'heroic', 'rustdesk',
    'keepassxc', 'firefox', 'thunderbird', 'kate', 'okular', 'artcraft-launcher',
    'vlc', 'krita', 'inkscape', 'gimp', 'darktable', 'coolercontrol',
    'jstest-gtk', 'freecad', 'librecad', 'kdenlive', 'pitivi', 'shotcut',
    'blender', 'ardour8', 'lmms', 'audacity',
    'chromium-browser', 'opera', 'brave-browser', 'vivaldi-stable',
    'microsoft-edge-stable',

    'lightworks'
]);

const _REDIRECT_FLATPAK_RUN_PADRAO = /^setsid\s+-f\s+flatpak\s+run\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)\s>\s+\/tmp\/fap-open-[\w.\-]+\.log\s+2>&1\s+<\s+\/dev\/null$/;

const _REDIRECT_ABRIR_PADRAO = /^setsid\s+-f\s+(\S+)(?:\s+(?:'[^']*'|"[^"]*"|[^>\n'"]+))*\s>\s+\/tmp\/fap-open-[\w.\-]+\.log\s+2>&1\s+<\s+\/dev\/null$/;

function _ehRedirectAbrirValido(trimmed) {

    if (_REDIRECT_FLATPAK_RUN_PADRAO.test(trimmed)) return true;

    var m = trimmed.match(_REDIRECT_ABRIR_PADRAO);
    if (!m) return false;
    return _BINARIOS_ABRIR_WHITELIST.has(m[1]);
}

function _filtrarLog(mensagem) {
    if (!mensagem) return mensagem;

    mensagem = mensagem.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (mensagem.indexOf('qt.qpa') === -1 &&
        mensagem.indexOf('QDBusError') === -1 &&
        mensagem.indexOf('portal') === -1) {
        return mensagem;
        }
        const linhas = mensagem.split('\n');
    const filtradas = linhas.filter(function(line) {
        if (line.includes('qt.qpa.services: failed to register with host portal')) return false;
        if (line.includes('QDBusError("org.freedesktop.portal.Error.Failed"')) return false;
        if (line.includes('could not register app ID:')) return false;
        return true;
    });
    return filtradas.join('\n');
}

const HOME_DIR_USUARIO = process.env.HOME || ('/home/' + (process.env.USER || 'user'));
const USUARIO_REAL = process.env.USER || process.env.LOGNAME || 'user';

function _substituirCaminhosUsuario(comando) {
    if (!comando) return comando;
    return comando
    .replace(/~\//g, HOME_DIR_USUARIO + '/')
    .replace(/\$HOME\b/g, HOME_DIR_USUARIO)
    .replace(/\$SUDO_USER\b/g, USUARIO_REAL)
    .replace(/\$USER\b/g, USUARIO_REAL);
}

function _aceitaGetOuHead(req) {
    return req.method === 'GET' || req.method === 'HEAD';
}

const sseClients = new Map();

const sseBuffers = new Map();
const SSE_BUFFER_MAX = 2000;
const SSE_BUFFER_TTL_MS = 10000;

const _progressoTotalAtual = new Map();

const _processosAtivos = new Set();

function _registrarProcesso(proc) {
    _processosAtivos.add(proc);
    proc.on('close', () => _processosAtivos.delete(proc));
    return proc;
}

function _listarDescendentes(pidRaiz, maxProfundidade) {
    var todos = [pidRaiz];
    var nivel = [pidRaiz];
    var max = maxProfundidade || 5;
    for (var d = 0; d < max && nivel.length > 0; d++) {
        var proximo = [];
        for (var i = 0; i < nivel.length; i++) {
            var r = spawnSync('pgrep', ['-P', String(nivel[i])],
                              { encoding: 'utf8', timeout: 1000 });
            if (r && r.status === 0 && r.stdout) {
                r.stdout.trim().split('\n').forEach(function(s) {
                    var p = parseInt(s, 10);
                    if (p && todos.indexOf(p) === -1) {
                        todos.push(p);
                        proximo.push(p);
                    }
                });
            }
        }
        nivel = proximo;
    }
    return todos;
}

function _matarArvoreProcessos(proc) {
    if (!proc || !proc.pid) return;

    var pidRaiz = proc.pid;

    var alvos = _listarDescendentes(pidRaiz, 5);

    for (var i = alvos.length - 1; i >= 0; i--) {
        try { process.kill(alvos[i], 'SIGTERM'); } catch (e) {  }
    }

    try { process.kill(-pidRaiz, 'SIGTERM'); } catch (e) {  }

    try {
        spawnSync('pkill', ['-9', '-f', 'fap-cmd-'], { timeout: 1000 });
    } catch (e) {  }

    try {
        spawnSync('sleep', ['0.3'], { timeout: 1000 });
    } catch (e) {  }

    var vivos = [];
    for (var j = 0; j < alvos.length; j++) {
        try {
            process.kill(alvos[j], 0);
            vivos.push(alvos[j]);
        } catch (e) {
            if (e.code === 'EPERM') vivos.push(alvos[j]);
        }
    }

    if (vivos.length > 0) {
        console.warn('[cleanup] PIDs root órfãos:', vivos.join(', '));
        console.warn('[cleanup] Para limpar: sudo kill -9 ' + vivos.join(' '));
    }

    try { process.kill(-pidRaiz, 'SIGKILL'); } catch (e) {  }
}

const _ultimaExecucao = new Map();
const RATE_LIMIT_MS = 1500;

function _podeExecutar(idComando) {
    var agora = Date.now();
    var ultimo = _ultimaExecucao.get(idComando) || 0;
    if (agora - ultimo < RATE_LIMIT_MS) return false;
    _ultimaExecucao.set(idComando, agora);
    if (_ultimaExecucao.size > 500) {
        for (var [k, v] of _ultimaExecucao) {
            if (agora - v > 60000) _ultimaExecucao.delete(k);
        }
    }
    return true;
}

function _execReadOnly(comando, timeoutMs) {
    return new Promise(function(resolve) {

        var envLimpo = Object.assign({}, process.env, {
            BASH_ENV: '',
            ENV: ''
        });
        var child = execFile('/bin/bash', ['--noprofile', '--norc', '-c', comando], {
            timeout: timeoutMs || 5000,
            maxBuffer: 1024 * 1024 * 5,
            env: envLimpo,
            detached: true
        }, function(error, stdout, stderr) {
            if (error && !stdout) {
                resolve('');
            } else {
                resolve((stdout || '').trim());
            }
        });

        if (child) _registrarProcesso(child);
    });
}

function _parseChaveValor(texto) {
    var obj = {};
    if (!texto) return obj;
    texto.split('\n').forEach(function(linha) {
        var idx = linha.indexOf('=');
        if (idx === -1) return;
        var chave = linha.substring(0, idx).trim();
        var valor = linha.substring(idx + 1).trim();
        if (chave) obj[chave] = valor;
    });
        return obj;
}

function _parseVainfo(stdout) {

    if (!stdout) {
        return { ok: false, error: 'vainfo returned no output', profiles: [] };
    }

    if (/command not found|comando não encontrado|No such file/i.test(stdout)) {
        return {
            ok: false,
            error: 'vainfo not found. Install the libva-utils package.',
            profiles: []
        };
    }

    var vaapi_version = null;
    var driver_version = null;
    var m;

    m = stdout.match(/VA-API version:\s*([\d.]+)/i);
    if (m) vaapi_version = m[1];

    m = stdout.match(/Driver version:\s*(.+)$/m);
    if (m) driver_version = m[1].trim();

    var profiles = [];
    var profileMap = {};
    var linhas = stdout.split('\n');

    for (var i = 0; i < linhas.length; i++) {
        var mm = linhas[i].match(/^\s+(VAProfile\w+)\s*:\s*(VAEntrypoint\w+)/);
        if (!mm) continue;
        var profileName = mm[1];
        var entrypoint = mm[2];
        if (!profileMap[profileName]) {
            profileMap[profileName] = { profile: profileName, entrypoints: [] };
            profiles.push(profileMap[profileName]);
        }
        if (profileMap[profileName].entrypoints.indexOf(entrypoint) === -1) {
            profileMap[profileName].entrypoints.push(entrypoint);
        }
    }

    var has_decoding = profiles.some(function(p) {
        return p.entrypoints.indexOf('VAEntrypointVLD') !== -1;
    });
    var has_encoding = profiles.some(function(p) {
        return p.entrypoints.indexOf('VAEntrypointEncSlice') !== -1 ||
        p.entrypoints.indexOf('VAEntrypointEncSliceLP') !== -1;
    });

    return {
        ok: profiles.length > 0,
        vaapi_version: vaapi_version,
        driver_version: driver_version,
        profiles: profiles,
        has_decoding: has_decoding,
        has_encoding: has_encoding,
        error: profiles.length === 0
        ? 'No VA-API profiles found. Check that the driver is installed and the GPU is supported.'
        : null
    };
}

const CHANGELOG_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
let _changelogCache = { versao: null, corpo: null, ts: 0 };

function _escapeHTML(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

function _inlineMd(s) {

    var escaped = _escapeHTML(s);
    return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, texto, href) {
        var hrefTrim = String(href).trim();
        if (/^(?:javascript|data|vbscript|file|blob):/i.test(hrefTrim)) {
            return texto;
        }
        return '<a href="' + hrefTrim + '" target="_blank" rel="noopener noreferrer">' + texto + '</a>';
    });
}

function _markdownParaHTML(md) {
    if (!md) return '';
    var linhas = md.split('\n');
    var html = '';
    var emLista = false;

    for (var i = 0; i < linhas.length; i++) {
        var l = linhas[i];
        var t = l.trim();

        if (/^[-*]\s+/.test(t)) {
            if (!emLista) { html += '<ul>'; emLista = true; }
            var item = t.replace(/^[-*]\s+/, '');
            html += '<li>' + _inlineMd(item) + '</li>';
            continue;
        }

        if (/^###\s+/.test(t)) {
            if (emLista) { html += '</ul>'; emLista = false; }
            html += '<h5>' + _inlineMd(t.replace(/^###\s+/, '')) + '</h5>';
            continue;
        }

        if (/^##\s+/.test(t)) {
            if (emLista) { html += '</ul>'; emLista = false; }
            html += '<h4>' + _inlineMd(t.replace(/^##\s+/, '')) + '</h4>';
            continue;
        }

        if (t === '') {
            if (emLista) { html += '</ul>'; emLista = false; }
            continue;
        }

        if (emLista) { html += '</ul>'; emLista = false; }
        html += '<p>' + _inlineMd(t) + '</p>';
    }

    if (emLista) html += '</ul>';
    return html;
}

function _lerChangelogVersao(versao) {
    var versaoLimpa = (versao || '').replace(/^v/, '').trim();

    if (_changelogCache.versao === versaoLimpa &&
        (Date.now() - _changelogCache.ts) < CHANGELOG_CACHE_TTL_MS) {
        return { versao: versaoLimpa, corpo: _changelogCache.corpo };
        }

        if (!fs.existsSync(ARQUIVO_CHANGELOG)) {
            return { versao: versaoLimpa, corpo: '' };
        }

        var conteudo;
    try {
        conteudo = fs.readFileSync(ARQUIVO_CHANGELOG, 'utf8');
    } catch (e) {
        console.error('[Changelog] Erro ao ler CHANGELOG.md:', e.message);
        return { versao: versaoLimpa, corpo: '' };
    }

    var linhas = conteudo.split('\n');
    var capturando = false;
    var buffer = [];

    for (var i = 0; i < linhas.length; i++) {
        var linha = linhas[i];
        var match = linha.match(/^##\s+v?(\S+)/);

        if (match) {
            if (capturando) break;
            var versaoHeading = match[1].trim();
            if (versaoHeading === versaoLimpa) {
                capturando = true;
                continue;
            }
        }

        if (capturando) {
            buffer.push(linha);
        }
    }

    var corpo = _markdownParaHTML(buffer.join('\n').trim());

    _changelogCache = { versao: versaoLimpa, corpo: corpo, ts: Date.now() };
    return { versao: versaoLimpa, corpo: corpo };
}

var _upgradeStatusCache = { dados: null, ts: 0 };
var UPGRADE_CACHE_TTL_MS = 1 * 60 * 60 * 1000;
var UPGRADE_TARGET_VERSION = '45';
var UPGRADE_MIN_DISK_GB = 8;

var _upgradeConcluidoPermanente = false;

async function _verificarGaFedora(versao) {
    try {
        var resp = await fetch('https://fedoraproject.org/releases.json',
                               { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!resp.ok) return { ok: false, motivo: 'HTTP ' + resp.status };
        var data = await resp.json();
        if (!Array.isArray(data)) return { ok: false, motivo: 'formato inesperado' };

        var release = data.find(function(r) {
            return String(r.version) === String(versao);
        });
        if (!release) return { ok: false, motivo: 'versão ' + versao + ' ainda não anunciada' };

        var agora = new Date();
        if (release.release_date) {
            var rd = new Date(release.release_date);
            if (rd > agora) {
                return { ok: false, motivo: 'release_date futura', release_date: release.release_date };
            }
        }
        if (release.eol && new Date(release.eol) < agora) {
            return { ok: false, motivo: 'versão em EOL' };
        }
        return { ok: true, release_date: release.release_date || null };
    } catch (e) {
        return { ok: false, motivo: e.message };
    }
}

async function _verificarCanalFedora(versao) {

    var urls = [
        'https://dl.fedoraproject.org/pub/fedora/linux/updates/' + versao +
        '/Everything/x86_64/repodata/repomd.xml',
        'https://download.fedoraproject.org/pub/fedora/linux/updates/' + versao +
        '/Everything/x86_64/repodata/repomd.xml'
    ];

    var ultimoErro = null;
    var ultimoStatus = null;

    for (var i = 0; i < urls.length; i++) {
        try {
            var resp = await fetch(urls[i], {
                method: 'HEAD',
                signal: AbortSignal.timeout(10000),

                                   redirect: 'manual'
            });

            if (resp.status >= 200 && resp.status < 300) {
                return { ok: true, status: resp.status };
            }

            if (resp.status >= 400 && resp.status < 500) {
                return { ok: false, status: resp.status, motivo: 'HTTP ' + resp.status };
            }

            ultimoStatus = resp.status;
            ultimoErro = 'HTTP ' + resp.status;
        } catch (e) {

            ultimoErro = e.message;
        }
    }

    return { ok: false, status: ultimoStatus, motivo: ultimoErro || 'todos os hosts falharam' };
}

async function _verificarCanalRpmFusion(versao) {
    try {

        var url = 'https://download1.rpmfusion.org/free/fedora/releases/' + versao +
        '/Everything/x86_64/os/repodata/repomd.xml';
        var resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
        return { ok: resp.ok, status: resp.status };
    } catch (e) {
        return { ok: false, motivo: e.message };
    }
}

async function _detectarVersaoAtualFedora() {
    var out = await _execReadOnly(
        '. /etc/os-release 2>/dev/null && [ "$ID" = "fedora" ] && echo "$VERSION_ID"',
        3000
    );
    var match = out.match(/^(\d+)/m);
    return match ? match[1] : null;
}

async function _detectarAtomic() {
    var out = await _execReadOnly(
        '[ -f /run/ostree-booted ] && echo "atomic" || ' +
        '(command -v rpm-ostree > /dev/null 2>&1 && echo "atomic" || echo "tradicional")',
                                  3000
    );
    return out.trim() === 'atomic';
}

async function _verificarAtualizacoesPendentes() {

    var resultados = await Promise.all([
        _execReadOnly('dnf check-update --quiet > /dev/null 2>&1; echo "exit=$?"', 30000),
                                       _execReadOnly('dnf needs-restarting -r > /dev/null 2>&1; echo "exit=$?"', 10000)
    ]);

    var check = resultados[0];
    var restart = resultados[1];

    var m = check.match(/exit=(\d+)/);
    var codigo = m ? parseInt(m[1], 10) : -1;
    var temUpdates = codigo === 100;
    var checagemOk = (codigo === 0 || codigo === 100);

    var mr = restart.match(/exit=(\d+)/);
    var codigoR = mr ? parseInt(mr[1], 10) : -1;
    var precisaReboot = (codigoR === 1);

    return {
        tem_updates: temUpdates,
        precisa_reboot: precisaReboot,
        checagem_ok: checagemOk
    };
}

async function _verificarEspacoDisco() {

    var out = await _execReadOnly(
        "L1=$(df -BG /var 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G'); " +
        "L2=$(df -BG /var/tmp 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G'); " +
        "[ -z \"$L2\" ] && L2=$L1; " +
        "if [ \"${L1:-0}\" -lt \"${L2:-0}\" ]; then echo $L1; else echo $L2; fi",
        3000
    );
    var livre = parseFloat(out) || 0;
    return { livre_gb: livre, suficiente: livre >= UPGRADE_MIN_DISK_GB };
}

async function _verificarDownloadConcluido() {

    var script =
    'if [ -f /usr/lib/sysimage/libdnf5/offline/transaction.json ]; then ' +
    '  echo "yes"; ' +
    'elif [ -f /var/lib/dnf/system-upgrade/transaction.json ]; then ' +
    '  echo "yes"; ' +
    'else ' +
    '  echo "no"; ' +
    'fi';

var out = await _execReadOnly(script, 3000);
return out.trim() === 'yes';
}

async function _detectarComponentesTerceiros() {
    var script = [
        '(rpm -q akmod-nvidia >/dev/null 2>&1 || rpm -q akmod-nvidia-open >/dev/null 2>&1) && echo "nvidia=1" || echo "nvidia=0"',
                                                       'rpm -q akmod-wl 2>/dev/null | grep -q "^akmod-wl" && echo "broadcom=1" || echo "broadcom=0"',
                                                       '[ -f /etc/yum.repos.d/hardware:razer.repo ] && echo "razer=1" || echo "razer=0"',
                                                       'rpm -q xpadneo 2>/dev/null | grep -q "^xpadneo" && echo "xpadneo=1" || echo "xpadneo=0"',
                                                       'ls /etc/yum.repos.d/terra*.repo > /dev/null 2>&1 && echo "terra=1" || echo "terra=0"',
                                                       'rpm -q akmod-r8168 2>/dev/null | grep -q "^akmod-r8168" && echo "realtek=1" || echo "realtek=0"',
                                                       'COUNT=$(ls /etc/yum.repos.d/*copr*.repo 2>/dev/null | wc -l); echo "coprs_count=$COUNT"'
    ].join('; ');

    var out = await _execReadOnly(script, 10000);
    var raw = _parseChaveValor(out);

    return {
        nvidia_driver: raw.nvidia === '1',
        broadcom_wifi: raw.broadcom === '1',
        razer_repo: raw.razer === '1',
        xpadneo: raw.xpadneo === '1',
        terra_repo: raw.terra === '1',
        realtek_ethernet: raw.realtek === '1',
        coprs_count: parseInt(raw.coprs_count, 10) || 0
    };
}

async function _calcularUpgradeStatus() {

    if (_upgradeConcluidoPermanente && _upgradeStatusCache.dados) {
        return _upgradeStatusCache.dados;
    }

    var agora = Date.now();
    if (_upgradeStatusCache.dados && (agora - _upgradeStatusCache.ts) < UPGRADE_CACHE_TTL_MS) {
        return _upgradeStatusCache.dados;
    }

    var versaoAtual = await _detectarVersaoAtualFedora();
    var isAtomic = await _detectarAtomic();
    var target = UPGRADE_TARGET_VERSION;

    var resultado = {
        current_version: versaoAtual,
        target_version: target,
        is_atomic: isAtomic,
        status: 'unknown',
        checks: {
            fedora_ga: { ok: false, release_date: null },
            fedora_channel: { ok: false },
            rpmfusion_channel: { ok: false },
            is_current_up_to_date: { ok: false, tem_updates: false, precisa_reboot: false, checagem_ok: false },
            disk_space: { ok: false, livre_gb: 0 },
            download_state: { downloaded: false }
        },
        components: {},
        warnings: []
    };

    if (!versaoAtual) {
        resultado.status = 'unknown';
        _upgradeStatusCache = { dados: resultado, ts: agora };
        return resultado;
    }

    if (isAtomic) {
        resultado.status = 'atomic';
        _upgradeStatusCache = { dados: resultado, ts: agora };
        return resultado;
    }

    var vAtualNum = parseInt(versaoAtual, 10) || 0;
    var vAlvoNum = parseInt(target, 10) || 0;

    if (vAtualNum === vAlvoNum || vAtualNum > vAlvoNum) {
        resultado.status = 'no_upgrade_needed';

        _upgradeConcluidoPermanente = true;
        _upgradeStatusCache = { dados: resultado, ts: agora };
        return resultado;
    }

    if (vAtualNum < vAlvoNum - 1) {
        resultado.status = 'unsupported';
        _upgradeStatusCache = { dados: resultado, ts: agora };
        return resultado;
    }

    var resultados = await Promise.all([
        _verificarGaFedora(target),
                                       _verificarCanalFedora(target),
                                       _verificarCanalRpmFusion(target),
                                       _verificarAtualizacoesPendentes(),
                                       _verificarEspacoDisco(),
                                       _verificarDownloadConcluido(),
                                       _detectarComponentesTerceiros()
    ]);

    var fedoraGa = resultados[0];
    var fedoraChannel = resultados[1];
    var rpmfusionChannel = resultados[2];
    var updates = resultados[3];
    var disk = resultados[4];
    var download = resultados[5];
    var components = resultados[6];

    resultado.checks.fedora_ga = fedoraGa;
    resultado.checks.fedora_channel = fedoraChannel;
    resultado.checks.rpmfusion_channel = rpmfusionChannel;
    resultado.checks.is_current_up_to_date = {
        ok: updates.checagem_ok && !updates.tem_updates && !updates.precisa_reboot,
        tem_updates: updates.tem_updates,
        precisa_reboot: updates.precisa_reboot,
        checagem_ok: updates.checagem_ok
    };
    resultado.checks.disk_space = {
        ok: disk.suficiente,
        livre_gb: disk.livre_gb,
        min_gb: UPGRADE_MIN_DISK_GB
    };
    resultado.checks.download_state = { downloaded: download };
    resultado.components = components;

    if (components.nvidia_driver)  resultado.warnings.push({ tipo: 'nvidia' });
    if (components.broadcom_wifi)  resultado.warnings.push({ tipo: 'broadcom' });
    if (components.terra_repo)     resultado.warnings.push({ tipo: 'terra' });
    if (components.razer_repo)     resultado.warnings.push({ tipo: 'razer' });
    if (components.xpadneo)        resultado.warnings.push({ tipo: 'xpadneo' });
    if (components.realtek_ethernet) resultado.warnings.push({ tipo: 'realtek' });
    if (components.coprs_count > 0) resultado.warnings.push({ tipo: 'coprs', n: components.coprs_count });

    var fedoraOk = fedoraGa.ok && fedoraChannel.ok;
    var rpmfusionOk = rpmfusionChannel.ok;
    var checagemFalhou = !updates.checagem_ok;
    var sistemaOk = resultado.checks.is_current_up_to_date.ok;
    var espacoOk = disk.suficiente;

    if (download) {
        resultado.status = 'downloaded';
    } else if (!fedoraOk) {
        resultado.status = 'waiting_ga';
    } else if (!rpmfusionOk) {
        resultado.status = 'waiting_rpmfusion';
    } else if (checagemFalhou) {

        resultado.status = 'check_failed';
    } else if (!sistemaOk) {
        resultado.status = 'outdated_current';
    } else if (!espacoOk) {
        resultado.status = 'no_disk_space';
    } else {
        resultado.status = 'ready';
    }

    _upgradeStatusCache = { dados: resultado, ts: agora };
    return resultado;
}

function lerProgresso() {
    try {
        if (fs.existsSync(ARQUIVO_PROGRESSO)) {
            const dados = JSON.parse(fs.readFileSync(ARQUIVO_PROGRESSO, 'utf8'));

            if (Array.isArray(dados)) {
                return { executados: dados, pulados: [], origem: {} };
            }

            return {
                executados: Array.isArray(dados.executados) ? dados.executados : [],
                                                       pulados: Array.isArray(dados.pulados) ? dados.pulados : [],

                                                       origem: (dados.origem && typeof dados.origem === 'object') ? dados.origem : {}
            };
        }
    } catch (e) {
        console.error("[Erro ao ler progresso]:", e.message);
    }
    return { executados: [], pulados: [], origem: {} };
}

function escreverProgresso(progresso) {
    fs.writeFileSync(ARQUIVO_PROGRESSO, JSON.stringify(progresso, null, 2), 'utf8');
}

function salvarProgresso(idComando, origem) {

    if (!idComando ||
        idComando.startsWith('open-') ||
        idComando.endsWith('-open') ||
        idComando.endsWith('-remove') ||
        idComando.endsWith('-revert')) {
        return;
        }
        try {
            const progresso = lerProgresso();
            if (!progresso.executados.includes(idComando)) {
                progresso.executados.push(idComando);
            }
            progresso.pulados = progresso.pulados.filter(id => id !== idComando);

            if (origem === 'fap' || origem === 'preexistente') {
                if (!progresso.origem || typeof progresso.origem !== 'object') {
                    progresso.origem = {};
                }
                progresso.origem[idComando] = origem;
            }

            escreverProgresso(progresso);
        } catch (e) {
            console.error("[Erro ao salvar progresso]:", e.message);
        }
}

function removerProgresso(idComando) {
    try {
        const progresso = lerProgresso();
        progresso.executados = progresso.executados.filter(id => id !== idComando);
        escreverProgresso(progresso);
        console.log(`[Progresso Removido]: Botão '${idComando}' limpo do histórico.`);
    } catch (e) {
        console.error("[Erro ao remover progresso]:", e.message);
    }
}

function resetarProgresso() {
    try {
        if (fs.existsSync(ARQUIVO_PROGRESSO)) {
            fs.unlinkSync(ARQUIVO_PROGRESSO);
            console.log('[PROGRESS] Arquivo .progresso.json removido');
        }
        return true;
    } catch (e) {
        console.error("[Erro ao resetar progresso]:", e.message);
        return false;
    }
}

function _limparLogsAntigos() {
    try {
        const agora = Date.now();
        const TTL = 7 * 24 * 60 * 60 * 1000;
        const arquivos = fs.readdirSync('/tmp');
        let removidos = 0;
        arquivos.forEach(function(nome) {
            if (!nome.startsWith('fap-') || !nome.endsWith('.log')) return;
            const caminho = path.join('/tmp', nome);
            try {
                const stat = fs.statSync(caminho);
                if (agora - stat.mtimeMs > TTL) {
                    fs.unlinkSync(caminho);
                    removidos++;
                }
            } catch (e) {  }
        });
        if (removidos > 0) {
            console.log(`[Cleanup] ${removidos} log(s) antigo(s) removido(s) de /tmp`);
        }
    } catch (e) {
        console.warn('[Cleanup] Falha ao limpar logs antigos:', e.message);
    }
}

function enviarLog(idComando, mensagem, tipo = 'output', extra = {}) {
    const mensagemLimpa = _filtrarLog(mensagem);

    if (!mensagemLimpa || mensagemLimpa.trim() === '') {
        if (tipo !== 'end') return;
    }

    const dados = { tipo, mensagem: mensagemLimpa, ...extra };

    if (!sseBuffers.has(idComando)) sseBuffers.set(idComando, []);
    const buffer = sseBuffers.get(idComando);
    buffer.push(dados);
    if (buffer.length > SSE_BUFFER_MAX) buffer.shift();

    const clients = sseClients.get(idComando) || [];
    const json = JSON.stringify(dados);
    clients.forEach(client => {
        client.write(`data: ${json}\n\n`);
    });

    if (tipo === 'end') {
        setTimeout(function() {
            sseBuffers.delete(idComando);
        }, SSE_BUFFER_TTL_MS);
    }
}

function adicionarClienteSSE(idComando, res) {
    const buffer = sseBuffers.get(idComando) || [];
    buffer.forEach(function(dados) {
        res.write(`data: ${JSON.stringify(dados)}\n\n`);
    });

    if (!sseClients.has(idComando)) {
        sseClients.set(idComando, []);
    }
    sseClients.get(idComando).push(res);

    res.on('close', () => {
        const clients = sseClients.get(idComando) || [];
        const index = clients.indexOf(res);
        if (index !== -1) {
            clients.splice(index, 1);
        }
        if (clients.length === 0) {
            sseClients.delete(idComando);
        }
    });
}

function _detectarProgressoPacotes(texto, idComando) {
    if (!texto) return null;
    var matches = [];
    var re = /\[(\d+)\/(\d+)\]/g;
    var m;
    while ((m = re.exec(texto)) !== null) {
        matches.push(m);
    }
    if (matches.length === 0) return null;

    var ultimo = matches[matches.length - 1];
    var atual = parseInt(ultimo[1], 10);
    var total = parseInt(ultimo[2], 10);

    if (isNaN(atual) || isNaN(total) || total <= 0) return null;
    if (atual > total) return null;

    if (idComando) {
        var ancorado = _progressoTotalAtual.get(idComando);
        if (ancorado === undefined) {
            _progressoTotalAtual.set(idComando, total);
        } else if (ancorado !== total) {
            return null;
        }
    }

    return { atual: atual, total: total };
}

function enviarProgresso(idComando, atual, total) {
    var dados = { tipo: 'progress', pacote_atual: atual, pacote_total: total };

    if (!sseBuffers.has(idComando)) sseBuffers.set(idComando, []);
    var buffer = sseBuffers.get(idComando);
    buffer.push(dados);
    if (buffer.length > SSE_BUFFER_MAX) buffer.shift();

    var clients = sseClients.get(idComando) || [];
    var json = JSON.stringify(dados);
    clients.forEach(function(client) {
        client.write(`data: ${json}\n\n`);
    });
}

function detectarDesktop() {
    const desktop = (process.env.XDG_CURRENT_DESKTOP || '').toUpperCase();
    const session = (process.env.DESKTOP_SESSION || '').toUpperCase();

    if (desktop.includes('KDE') || session.includes('KDE') || session.includes('PLASMA')) {
        return 'KDE';
    }
    if (desktop.includes('GNOME') || session.includes('GNOME')) {
        return 'GNOME';
    }
    if (desktop.includes('XFCE') || session.includes('XFCE')) {
        return 'XFCE';
    }
    if (desktop.includes('CINNAMON') || session.includes('CINNAMON')) {
        return 'CINNAMON';
    }
    if (desktop.includes('MATE') || session.includes('MATE')) {
        return 'MATE';
    }
    if (desktop.includes('LXQT') || session.includes('LXQT')) {
        return 'LXQT';
    }
    if (desktop.includes('LXDE') || session.includes('LXDE')) {
        return 'LXDE';
    }

    return 'UNKNOWN';
}

function obterMetodoAutenticacao() {
    if (commandExists('pkexec')) {
        return { tipo: 'pkexec', comando: 'pkexec', descricao: 'pkexec (PolicyKit)' };
    }

    if (commandExists('kdialog') || commandExists('zenity')) {
        return {
            tipo: 'dialog_fallback',
            comando: commandExists('kdialog') ? 'kdialog' : 'zenity',
                                                       descricao: (commandExists('kdialog') ? 'kdialog' : 'zenity') + ' (fallback gráfico)'
        };
    }

    return {
        tipo: 'sudo_fallback',
        comando: 'sudo',
        descricao: 'sudo (fallback)'
    };
}

function commandExists(cmd) {
    try {
        const result = spawnSync('which', [cmd], { encoding: 'utf8', timeout: 1000 });
        return result.status === 0 && (result.stdout || '').trim().length > 0;
    } catch (e) {
        return false;
    }
}

function executarComandoComStream(comandoFinal, idComando, isReversao, callback) {

    if (/^\s*(?:sudo\s+)?(?:stdbuf\b[^\n]*?)?flatpak\s+/.test(comandoFinal) &&
        !/^\s*stdbuf\b/.test(comandoFinal)) {
        comandoFinal = 'stdbuf -oL -eL ' + comandoFinal;
        }

        const precisaAutenticacao = !_cmdSemAutenticacao(comandoFinal) &&
        !_idSemAuthValido(idComando, comandoFinal);

    if (!precisaAutenticacao) {
        console.log(`[INFO] Comando SEM autenticação: ${comandoFinal.substring(0, 50)}...`);
        enviarLog(idComando, `$ ${comandoFinal}\n`, 'info');

        const env = { ...process.env };

        if (_precisaEnvUserContext(comandoFinal)) {
            let uid = 1000;
            try {
                uid = process.getuid ? process.getuid() : 1000;
            } catch (e) {
                uid = 1000;
            }
            env.XDG_RUNTIME_DIR = `/run/user/${uid}`;
            env.DBUS_SESSION_BUS_ADDRESS = `unix:path=/run/user/${uid}/bus`;
            if (!env.HOME) {
                env.HOME = process.env.HOME || '/home/' + (process.env.USER || 'user');
            }
            console.log(`[USER-CTX] XDG_RUNTIME_DIR=${env.XDG_RUNTIME_DIR}`);
            console.log(`[USER-CTX] DBUS_SESSION_BUS_ADDRESS=${env.DBUS_SESSION_BUS_ADDRESS}`);
            console.log(`[USER-CTX] HOME=${env.HOME}`);
        }

        if (IDS_SEM_AUTENTICACAO.has(idComando)) {
            const askpass = _criarAskpassHelper();
            if (askpass) {
                env.SUDO_ASKPASS = askpass;
                console.log(`[USER-CTX] SUDO_ASKPASS=${askpass}`);
            } else {
                console.warn(`[USER-CTX] SUDO_ASKPASS não pôde ser criado — sudo pode falhar`);
            }
        }

        _registrarProcesso(exec(comandoFinal, {
            shell: '/bin/bash',
            maxBuffer: 1024 * 1024 * 50,
            timeout: 1800000,
            env: env,

            detached: true
        }, (error, stdout, stderr) => {
            if (stdout) {
                enviarLog(idComando, stdout, 'output');
                var prog = _detectarProgressoPacotes(stdout, idComando);
                if (prog) enviarProgresso(idComando, prog.atual, prog.total);
            }
            if (stderr) {
                const stderrFiltrado = stderr.replace(/\[sudo\] password for .+: /g, '');
                if (stderrFiltrado.trim()) {

                    enviarLog(idComando, stderrFiltrado, 'output');
                }
            }
            if (error) {
                enviarLog(idComando, `\n❌ Comando falhou com código: ${error.code || 1}\n`, 'error');
                console.error(`[ERRO] ${idComando}: Código ${error.code || 1}`);
                enviarLog(idComando, '__END__', 'end', { sucesso: false });
                callback(error, stdout, stderr);
            } else {
                if (isReversao) {
                    removerProgresso(idComando);
                } else {
                    salvarProgresso(idComando, 'fap');
                }
                enviarLog(idComando, `\n✅ Comando concluído com sucesso!\n`, 'success');
                console.log(`[SUCESSO] ${idComando}`);
                enviarLog(idComando, '__END__', 'end', { sucesso: true });
                callback(null, stdout, stderr);
            }
        }));
        return;
    }

    enviarLog(idComando, `$ ${comandoFinal}\n`, 'info');
    enviarLog(idComando, '─'.repeat(50) + '\n', 'info');

    const processo = _registrarProcesso(spawn(comandoFinal, {
        shell: '/bin/bash',
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],

        detached: true
    }));

    let saidaCompleta = '';
    let erros = '';

    processo.stdout.on('data', (data) => {
        const texto = data.toString();
        saidaCompleta += texto;
        enviarLog(idComando, texto, 'output');
        var prog = _detectarProgressoPacotes(texto, idComando);
        if (prog) enviarProgresso(idComando, prog.atual, prog.total);
    });

        processo.stderr.on('data', (data) => {
            const texto = data.toString();
            erros += texto;
            const textoFiltrado = texto.replace(/\[sudo\] password for .+: /g, '');
            if (textoFiltrado.trim()) {

                enviarLog(idComando, textoFiltrado, 'output');
            }
        });

        processo.on('close', (code) => {
            if (code === 0) {
                if (isReversao) {
                    removerProgresso(idComando);
                } else {
                    salvarProgresso(idComando, 'fap');
                }
                enviarLog(idComando, `\n✅ Comando concluído com sucesso! (código: ${code})\n`, 'success');
                console.log(`[SUCESSO] ${idComando}`);
            } else {
                enviarLog(idComando, `\n❌ Comando falhou com código: ${code}\n`, 'error');
                console.error(`[ERRO] ${idComando}: Código ${code}`);
            }

            enviarLog(idComando, '─'.repeat(50) + '\n', 'info');
            enviarLog(idComando, code === 0 ? '✅ Tarefa concluída!\n' : '❌ Tarefa falhou!\n', code === 0 ? 'success' : 'error');
            enviarLog(idComando, '__END__', 'end', { sucesso: code === 0 });

            callback(code === 0 ? null : new Error(`Código de saída: ${code}`), saidaCompleta, erros);
        });

        processo.on('error', (err) => {
            enviarLog(idComando, `\n❌ Erro ao iniciar processo: ${err.message}\n`, 'error');
            enviarLog(idComando, '__END__', 'end', { sucesso: false });
            callback(err, saidaCompleta, erros);
        });
}

function _construirScripts(timestamp, random, comandoCorrigido, descricao, idComando) {
    const scriptTemp = `/tmp/fap-cmd-${timestamp}-${random}.sh`;
    const homeDir = HOME_DIR_USUARIO;

    const comandoLimpo = (comandoCorrigido || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

    const precisaHomeDoUsuario = IDS_COM_HOME_DO_USUARIO.has(idComando);

    const scriptLines = [
        '#!/bin/bash',
        '# Fedora Advantage Panel - ' + descricao,
        '# Executado em: ' + new Date().toLocaleString('pt-BR'),
                                                       '',
                                                       '# Exports obrigatórios quando roda via pkexec (root).',
                                                       '# Sem HOME/USER corretos, scripts EXTERNOS (install.sh,',
                                                       '# fap-cleanup.sh) que usam $HOME INTERNAMENTE falhariam.',
                                                       '# Comandos INLINE com $HOME/~ já têm o caminho absoluto',
                                                       '# substituído por _substituirCaminhosUsuario.',
                                                       'export DISPLAY=' + (process.env.DISPLAY || ':0'),
                                                       'export XAUTHORITY=' + (process.env.XAUTHORITY || homeDir + '/.Xauthority'),
                                                       'export WAYLAND_DISPLAY=' + (process.env.WAYLAND_DISPLAY || ''),
                                                       'export XDG_RUNTIME_DIR=' + (process.env.XDG_RUNTIME_DIR || '/run/user/' + (process.getuid ? process.getuid() : 1000)),
                                                       'export DBUS_SESSION_BUS_ADDRESS=' + (process.env.DBUS_SESSION_BUS_ADDRESS || ''),

                                                       precisaHomeDoUsuario ? ('export HOME=' + homeDir) : '# HOME herdado do pkexec (padrão do Fedora)',
                                                       'export USER=' + USUARIO_REAL,
                                                       'export LOGNAME=' + USUARIO_REAL,
                                                       '',
                                                       '# Executa o comando. O stdout/stderr vão para o pipe do',
                                                       '# processo pai (Node), que os transmite em tempo real via SSE.',
                                                       comandoLimpo,
                                                       '',
                                                       '# Propaga o código de saída real do comando.',
                                                       'exit $?'
    ];

    const scriptContent = scriptLines.join('\n');

    return { scriptTemp, scriptContent };
}

async function executarComAutenticacaoSegura(comandoOriginal, idComando, isReversao, callback) {
    const desktop = detectarDesktop();

    const descricoesComandos = {
        'dnf upgrade': 'Atualizar o sistema Fedora',
        'dnf install': 'Instalar pacotes',
        'dnf remove': 'Remover pacotes',
        'dnf autoremove': 'Remover dependências não utilizadas',
        'dnf clean': 'Limpar cache do sistema',
        'dnf config-manager': 'Configurar gerenciador de pacotes DNF',
        'dnf distro-sync': 'Sincronizar pacotes com o canal estável',
        'dnf swap': 'Substituir pacotes',
        'dnf groupinstall': 'Instalar grupo de pacotes',
        'dnf copr': 'Habilitar repositório COPR',
        'localectl': 'Alterar configurações de localidade',
        'timedatectl': 'Alterar data e hora do sistema',
        'rm -rf /usr/share/fonts/microsoft': 'Remover fontes Microsoft',
        'btrfs': 'Gerenciar snapshots Btrfs',
        'grub2-mkconfig': 'Reconfigurar GRUB',
        'grubby': 'Configurar parâmetros do kernel',
        'sed -i': 'Modificar arquivo de configuração',
        'usermod': 'Modificar grupos do usuário',
        'gpasswd': 'Modificar grupos do usuário',
        'systemctl': 'Gerenciar serviços do sistema',
        'waydroid init': 'Inicializar container Android (Waydroid)',
                                                       'tc qdisc': 'Configurar QoS de rede',
                                                       'ip link': 'Configurar interface de rede',
                                                       'chown': 'Ajustar permissões de arquivo',
                                                       'tee': 'Escrever arquivo de configuração',
                                                       'sysctl': 'Ajustar parâmetros do kernel',
                                                       'modprobe': 'Carregar módulo do kernel'
    };

    let descricao = 'Executar comando administrativo';
    for (const [key, value] of Object.entries(descricoesComandos)) {
        if (comandoOriginal.includes(key)) {
            descricao = value;
            break;
        }
    }

    const comandoSemSudo = comandoOriginal.replace(/sudo\s+(?!-)/g, '');
    const comandoCorrigido = _substituirCaminhosUsuario(comandoSemSudo);

    enviarLog(idComando, `🔐 Autenticando para: ${descricao}\n`, 'info');

    enviarLog(idComando, '─── Conteúdo do script que será executado ───\n', 'info');
    enviarLog(idComando, comandoCorrigido + '\n', 'info');
    enviarLog(idComando, '────────────────────────────────────────────\n', 'info');

    try {
        const auditPath = '/tmp/fap-audit-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.log';
        fs.writeFileSync(auditPath, `[${new Date().toISOString()}] ${descricao}\n\n${comandoCorrigido}\n`, { mode: 0o600 });
    } catch (e) {  }

    const hasPkexec = commandExists('pkexec');
    const hasZenity = commandExists('zenity');
    const hasKdialog = commandExists('kdialog');

    console.log(`[AUTH] Desktop: ${desktop}, pkexec: ${hasPkexec}`);

    if (hasPkexec) {
        enviarLog(idComando, '🔑 Usando pkexec com interface gráfica...\n', 'info');

        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const { scriptTemp, scriptContent } = _construirScripts(timestamp, random, comandoCorrigido, descricao, idComando);

        try {
            fs.writeFileSync(scriptTemp, scriptContent, { mode: 0o755 });
            console.log(`[PKEXEC] Script criado: ${scriptTemp}`);
        } catch (err) {
            enviarLog(idComando, `❌ Erro ao criar script: ${err.message}\n`, 'error');
            return callback(err, "", "");
        }

        setTimeout(() => {
            if (fs.existsSync(scriptTemp)) {
                try { fs.unlinkSync(scriptTemp); } catch (e) {}
            }
        }, 60000);

        const comandoFinal = `pkexec ${scriptTemp} && rm -f ${scriptTemp} || { rm -f ${scriptTemp}; exit 1; }`;

        executarComandoComStream(comandoFinal, idComando, isReversao, (err, stdout, stderr) => {
            callback(err, stdout, stderr);
        });

        return;
    }

    enviarLog(idComando, '⚠️ Usando fallback com zenity/kdialog...\n', 'warning');

    let promptSenha;
    if (hasKdialog && (desktop === 'KDE' || desktop === 'LXQT')) {
        promptSenha = `kdialog --password "Digite sua senha de administrador:" --title "Fedora Advantage Panel - ${descricao}" 2>/dev/null`;
    } else if (hasZenity) {
        promptSenha = `zenity --password --title="Fedora Advantage Panel" --text="🔐 ${descricao}" 2>/dev/null`;
    } else {
        promptSenha = `kdialog --password "Digite sua senha de administrador:" --title "Fedora Advantage Panel - ${descricao}" 2>/dev/null || zenity --password --title="Fedora Advantage Panel" --text="🔐 ${descricao}" 2>/dev/null`;
    }

    exec(promptSenha, {
        env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
    }, (errPrompt, senha) => {
        if (errPrompt || !senha || senha.trim().length === 0) {
            enviarLog(idComando, '❌ Autenticação cancelada pelo usuário.\n', 'error');
            return callback(new Error("Autenticação cancelada pelo usuário."), "", "");
        }

        enviarLog(idComando, `$ sudo -S sh -c '<comando>'\n`, 'info');
        enviarLog(idComando, '─'.repeat(50) + '\n', 'info');

        const proc = _registrarProcesso(spawn('sudo', ['-S', 'sh', '-c', comandoCorrigido], {
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe'],

            detached: true
        }));

        proc.stdin.write(senha.trim() + '\n');
        proc.stdin.end();

        let saidaCompleta = '';
        let erros = '';

        proc.stdout.on('data', (data) => {
            const texto = data.toString();
            saidaCompleta += texto;
            enviarLog(idComando, texto, 'output');
        });

        proc.stderr.on('data', (data) => {
            const texto = data.toString();
            erros += texto;
            const textoFiltrado = texto.replace(/\[sudo\] password for .+: /g, '');
            if (textoFiltrado.trim()) {

                enviarLog(idComando, textoFiltrado, 'output');
            }
        });

        proc.on('close', (code) => {
            if (code === 0) {
                if (isReversao) {
                    removerProgresso(idComando);
                } else {
                    salvarProgresso(idComando, 'fap');
                }
                enviarLog(idComando, `\n✅ Comando concluído com sucesso! (código: ${code})\n`, 'success');
                console.log(`[SUCESSO] ${idComando}`);
            } else {
                enviarLog(idComando, `\n❌ Comando falhou com código: ${code}\n`, 'error');
                console.error(`[ERRO] ${idComando}: Código ${code}`);
            }

            enviarLog(idComando, '─'.repeat(50) + '\n', 'info');
            enviarLog(idComando, code === 0 ? '✅ Tarefa concluída!\n' : '❌ Tarefa falhou!\n', code === 0 ? 'success' : 'error');
            enviarLog(idComando, '__END__', 'end', { sucesso: code === 0 });

            callback(code === 0 ? null : new Error(`Código de saída: ${code}`), saidaCompleta, erros);
        });

        proc.on('error', (err) => {
            enviarLog(idComando, `\n❌ Erro ao iniciar processo: ${err.message}\n`, 'error');
            enviarLog(idComando, '__END__', 'end', { sucesso: false });
            callback(err, saidaCompleta, erros);
        });
    });
}

function procederComExecucao(comando, idComando, isReversao, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: true,
        output: 'Comando aceito. Acompanhe o progresso no log abaixo.'
    }));

    setImmediate(() => {

        const semAuth = _cmdSemAutenticacao(comando) || _idSemAuthValido(idComando, comando);
        const precisaAutenticacao = !semAuth;

        console.log(`[AUTH] ${idComando}: PrecisaAuth=${precisaAutenticacao}`);

        if (precisaAutenticacao) {
            executarComAutenticacaoSegura(comando, idComando, isReversao, (error) => {
                if (error) {
                    console.error(`[ERRO] ${idComando}:`, error.message);
                }
            });
        } else {
            executarComandoComStream(comando, idComando, isReversao, (error) => {
                if (error) {
                    console.error(`[ERRO] ${idComando}:`, error.message);
                }
            });
        }
    });
}

function servirArquivoEstatico(req, res, filePath) {
    const fullPath = path.join(__dirname, filePath);

    if (fs.existsSync(fullPath)) {
        const ext = path.extname(fullPath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        };

        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        let tamanho = 0;
        try {
            tamanho = fs.statSync(fullPath).size;
        } catch (e) {  }

        res.writeHead(200, {
            'Content-Type': mimeType,
            'Content-Length': String(tamanho),
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      'Pragma': 'no-cache',
                      'Expires': '0'
        });

        if (req.method === 'HEAD') {
            res.end();
            return;
        }

        fs.createReadStream(fullPath).pipe(res);
    } else {

        const corpo404 = 'Arquivo não encontrado';
        res.writeHead(404, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Length': String(Buffer.byteLength(corpo404, 'utf8'))
        });
        if (req.method === 'HEAD') {
            res.end();
        } else {
            res.end(corpo404);
        }
    }
}

function servirLocale(req, res, lang) {
    if (LANGS_SUPORTADOS.indexOf(lang) === -1) {
        const corpo = JSON.stringify({ error: 'Idioma não suportado: ' + lang });
        res.writeHead(404, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': String(Buffer.byteLength(corpo, 'utf8'))
        });
        if (req.method === 'HEAD') { res.end(); } else { res.end(corpo); }
        return;
    }

    const arquivo = path.join(LOCALES_DIR, lang + '.json');

    const rel = path.relative(LOCALES_DIR, arquivo);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        const corpo = JSON.stringify({ error: 'Acesso negado' });
        res.writeHead(403, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': String(Buffer.byteLength(corpo, 'utf8'))
        });
        if (req.method === 'HEAD') { res.end(); } else { res.end(corpo); }
        return;
    }

    if (!fs.existsSync(arquivo)) {
        const corpo = JSON.stringify({ error: 'Locale não encontrado: ' + lang });
        res.writeHead(404, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': String(Buffer.byteLength(corpo, 'utf8'))
        });
        if (req.method === 'HEAD') { res.end(); } else { res.end(corpo); }
        return;
    }

    let tamanho = 0;
    try {
        tamanho = fs.statSync(arquivo).size;
    } catch (e) {  }

    res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': String(tamanho),
                  'Cache-Control': 'no-cache'
    });
    if (req.method === 'HEAD') {
        res.end();
        return;
    }
    fs.createReadStream(arquivo).pipe(res);
}

function _computarPreviewGrub(info) {
    var atual = {};
    (info.grubContent || '').split('\n').forEach(function(linha) {
        var l = linha.trim();
        if (!l || l.startsWith('#')) return;
        var idx = l.indexOf('=');
        if (idx === -1) return;
        atual[l.substring(0, idx).trim()] = l.substring(idx + 1).trim();
    });

    var res = (info.detectedRes && info.detectedRes !== '0x0') ? info.detectedRes : '1024x768';
    var osProber = info.dualBoot ? 'false' : 'true';

    var recomendados = [
        { chave: 'GRUB_TIMEOUT',            novo: '10' },
        { chave: 'GRUB_TIMEOUT_STYLE',      novo: 'menu' },
        { chave: 'GRUB_GFXMODE',            novo: res },
        { chave: 'GRUB_DISABLE_OS_PROBER',  novo: osProber },
        { chave: 'GRUB_DEFAULT',            novo: 'saved' },
        { chave: 'GRUB_DISABLE_SUBMENU',    novo: 'true' },
        { chave: 'GRUB_TERMINAL_OUTPUT',    novo: '"console"' },
        { chave: 'GRUB_CMDLINE_LINUX',      novo: '"rhgb quiet"' },
        { chave: 'GRUB_DISABLE_RECOVERY',   novo: '"true"' }
    ];

    var mudancas = [];
    for (var i = 0; i < recomendados.length; i++) {
        var item = recomendados[i];
        var valorAtual = atual[item.chave];
        var temAtual = (typeof valorAtual === 'string' && valorAtual.length > 0);
        var igual = temAtual && valorAtual === item.novo;
        if (igual) continue;
        mudancas.push({
            chave: item.chave,
            atual: temAtual ? valorAtual : null,
            novo: item.novo
        });
    }

    return { mudancas: mudancas, total: mudancas.length };
}

const server = http.createServer((req, res) => {

    let parsedUrl;
    try {
        parsedUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Requisição inválida');
        return;
    }
    const url = parsedUrl.pathname;
    const query = parsedUrl.searchParams;

    if (req.method === 'GET' && url.startsWith('/stream')) {
        const idComando = query.get('id');

        if (!idComando) {
            res.writeHead(400);
            res.end('ID do comando é obrigatório');
            return;
        }

        console.log(`[SSE] Cliente conectado para: ${idComando}`);

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        const heartbeat = setInterval(() => {
            res.write(': heartbeat\n\n');
        }, 30000);

        adicionarClienteSSE(idComando, res);

        req.on('close', () => {
            clearInterval(heartbeat);
            console.log(`[SSE] Cliente desconectado: ${idComando}`);
        });

        return;
    }

    if (_aceitaGetOuHead(req) && url.startsWith('/locales/')) {

        let resto = url.substring('/locales/'.length);

        if (resto.endsWith('.json')) {
            resto = resto.substring(0, resto.length - '.json'.length);
        }

        let lang;
        try {
            lang = decodeURIComponent(resto);
        } catch (e) {
            const corpo = JSON.stringify({ error: 'Requisição inválida' });
            res.writeHead(400, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': String(Buffer.byteLength(corpo, 'utf8'))
            });
            if (req.method === 'HEAD') { res.end(); } else { res.end(corpo); }
            return;
        }

        servirLocale(req, res, lang);
        return;
    }

    if (req.method === 'GET' && url === '/progress') {
        var progressoAtual = lerProgresso();
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(JSON.stringify({
            executados: progressoAtual.executados,
            pulados: progressoAtual.pulados,
            origem: progressoAtual.origem || {}
        }));
        return;
    }

    if (req.method === 'POST' && url === '/progress') {

        var originProgress = req.headers.origin || '';
        var originProgressOk = !originProgress ||
        /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(originProgress);
        if (!originProgressOk) {
            console.warn('[FAP] /progress bloqueado — Origin suspeita:', originProgress);
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Origin não autorizada' }));
            return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { executados, pulados } = JSON.parse(body);

                function _idTransienteProgress(id) {
                    return !id ||
                    id.startsWith('open-') ||
                    id.endsWith('-open') ||
                    id.endsWith('-remove') ||
                    id.endsWith('-revert');
                }

                var progressoAtual = lerProgresso();
                progressoAtual.executados = (executados || []).filter(function(id) {
                    return !_idTransienteProgress(id);
                });
                progressoAtual.pulados = (pulados || []).filter(function(id) {
                    return !_idTransienteProgress(id);
                });

                escreverProgresso(progressoAtual);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                console.error('[progress POST] Erro:', err.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Body inválido' }));
            }
        });
        return;
    }

    if (req.method === 'DELETE' && url === '/progress') {

        var originDelete = req.headers.origin || '';
        var originDeleteOk = !originDelete ||
        /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(originDelete);
        if (!originDeleteOk) {
            console.warn('[FAP] /progress DELETE bloqueado — Origin suspeita:', originDelete);
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Origin não autorizada' }));
            return;
        }

        var ok = resetarProgresso();
        res.writeHead(ok ? 200 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: ok }));
        return;
    }

    if (_aceitaGetOuHead(req) && (url === '/' || url === '/index.html')) {
        servirArquivoEstatico(req, res, 'index.html');
        return;
    }

    if (_aceitaGetOuHead(req) && url === '/guiado.html') {
        servirArquivoEstatico(req, res, 'guiado.html');
        return;
    }

    if (_aceitaGetOuHead(req) && url.match(/^\/([a-z][a-z0-9-]*\.html)$/)) {
        const match = url.match(/^\/([a-z][a-z0-9-]*\.html)$/);
        if (match) {
            servirArquivoEstatico(req, res, match[1]);
            return;
        }
    }

    if (_aceitaGetOuHead(req) && url === '/style.css') {
        servirArquivoEstatico(req, res, 'style.css');
        return;
    }

    if (_aceitaGetOuHead(req) && url === '/script.js') {
        servirArquivoEstatico(req, res, 'script.js');
        return;
    }

    if (_aceitaGetOuHead(req) && url === '/i18n.js') {
        servirArquivoEstatico(req, res, 'i18n.js');
        return;
    }

    if (_aceitaGetOuHead(req) && (url === '/icone_app.png' || url === '/favicon.ico')) {
        servirArquivoEstatico(req, res, 'icone_app.png');
        return;
    }

    if (req.method === 'GET' && url === '/status') {
        const progresso = lerProgresso();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            ok: true,
            executados: progresso.executados,
            pulados: progresso.pulados,
            origem: progresso.origem || {},
            uptime: Math.floor(process.uptime()),
                               versao: FAP_VERSION,
                               sseConexoes: sseClients.size,
                               memoriaMB: Math.floor(process.memoryUsage().rss / 1024 / 1024)
        }));
        return;
    }

    if (req.method === 'GET' && url === '/info') {
        const desktop = detectarDesktop();
        const metodo = obterMetodoAutenticacao();
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(JSON.stringify({
            desktop: desktop,
            autenticacao: metodo.descricao,
            nodeVersion: process.version,
            platform: process.platform,
            version: FAP_VERSION,
            langsSuportados: LANGS_SUPORTADOS
        }));
        return;
    }

    if (req.method === 'GET' && url === '/kernel-atual') {
        _execReadOnly('uname -r', 3000).then(function(stdout) {
            var kernel = (stdout || '').trim();
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify({ kernel: kernel }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/reboot-needed') {

        _execReadOnly('dnf needs-restarting -r 2>&1; echo "---EXIT=$?---"', 15000).then(function(stdout) {
            var out = (stdout || '');
            var m = out.match(/---EXIT=(\d+)---/);
            var codigo = m ? parseInt(m[1], 10) : -1;
            var reboot = (codigo === 1);
            var erro = (codigo !== 0 && codigo !== 1);
            var motivo = erro
            ? 'dnf needs-restarting retornou código ' + codigo
            : null;

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify({
                reboot: reboot,
                erro: erro,
                code: codigo,
                motivo: motivo
            }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/kernels') {

        Promise.all([
            _execReadOnly('rpm -q kernel-core --queryformat "%{VERSION}-%{RELEASE}.%{ARCH}\\n" 2>/dev/null', 5000),
                    _execReadOnly('uname -r', 3000)
        ]).then(function(resultados) {
            var kernels = (resultados[0] || '').trim().split('\n').filter(Boolean);
            var atual = (resultados[1] || '').trim();
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify({
                kernels: kernels,
                atual: atual
            }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/grub-info') {
        const script = [

            'if [ -r /etc/default/grub ]; then',
            '  echo "---GRUB_FILE_START---"',
            '  cat /etc/default/grub',
            '  echo "---GRUB_FILE_END---"',
            'else',
            '  echo "GRUB_FILE_ERROR=unreadable"',
            'fi',
            '',
            'DETECTED_W=0; DETECTED_H=0',
            '',
            'echo "---DRM_LAYER_1---"',
            '# CAMADA 1: arquivo "mode" (singular) do conector ativo',
                                 'for f in /sys/class/drm/card*-*/mode; do',
                                 '  [ -e "$f" ] || continue',
                                 '  CONN_DIR=$(dirname "$f")',
                                 '  CONN_STATUS=$(cat "$CONN_DIR/status" 2>/dev/null)',
                                 '  [ "$CONN_STATUS" = "connected" ] || continue',
                                 '  RES=$(cat "$f" 2>/dev/null)',
                                 '  if echo "$RES" | grep -qE "^[0-9]+x[0-9]+$"; then',
                                 '    DETECTED_W="${RES%x*}"',
                                 '    DETECTED_H="${RES#*x}"',
                                 '    echo "MATCH_LAYER1=$RES"',
                                 '    break',
                                 '  fi',
                                 'done',
                                 '',
                                 '# CAMADA 2: arquivo "modes" (plural) — primeiro da lista = nativo',
                                 'if [ "$DETECTED_W" = "0" ]; then',
                                 '  echo "---DRM_LAYER_2---"',
                                 '  for f in /sys/class/drm/card*-*/modes; do',
                                 '    [ -e "$f" ] || continue',
                                 '    CONN_DIR=$(dirname "$f")',
                                 '    CONN_STATUS=$(cat "$CONN_DIR/status" 2>/dev/null)',
                                 '    [ "$CONN_STATUS" = "connected" ] || continue',
                                 '    RES=$(grep -m1 -E "^[0-9]+x[0-9]+$" "$f" 2>/dev/null)',
                                 '    if [ -n "$RES" ]; then',
                                 '      DETECTED_W="${RES%x*}"',
                                 '      DETECTED_H="${RES#*x}"',
                                 '      echo "MATCH_LAYER2=$RES"',
                                 '      break',
                                 '    fi',
                                 '  done',
                                 'fi',
                                 '',
                                 '# CAMADA 3: parse do EDID (offsets corretos da spec VESA)',
                                 '#   byte 56 = H active LSB',
                                 '#   byte 58 = H active MSB (nibble alto)',
                                 '#   byte 59 = V active LSB',
                                 '#   byte 61 = V active MSB (nibble alto)',
                                 'if [ "$DETECTED_W" = "0" ]; then',
                                 '  echo "---DRM_LAYER_3---"',
                                 '  for f in /sys/class/drm/card*-*/edid; do',
                                 '    [ -e "$f" ] || continue',
                                 '    CONN_DIR=$(dirname "$f")',
                                 '    CONN_STATUS=$(cat "$CONN_DIR/status" 2>/dev/null)',
                                 '    [ "$CONN_STATUS" = "connected" ] || continue',
                                 '    SIZE=$(wc -c < "$f" 2>/dev/null)',
                                 '    [ "$SIZE" -ge 128 ] || continue',
                                 '    H_LO=$(od -An -tu1 -j56 -N1 "$f" 2>/dev/null | tr -d " ")',
                                 '    H_HI=$(od -An -tu1 -j58 -N1 "$f" 2>/dev/null | tr -d " ")',
                                 '    V_LO=$(od -An -tu1 -j59 -N1 "$f" 2>/dev/null | tr -d " ")',
                                 '    V_HI=$(od -An -tu1 -j61 -N1 "$f" 2>/dev/null | tr -d " ")',
                                 '    if [ -n "$H_LO" ] && [ -n "$H_HI" ] && [ -n "$V_LO" ] && [ -n "$V_HI" ]; then',
                                 '      HW=$(( H_LO + (H_HI & 0xF0) * 16 ))',
                                 '      VH=$(( V_LO + (V_HI & 0xF0) * 16 ))',
                                 '      if [ "$HW" -gt 0 ] && [ "$VH" -gt 0 ]; then',
                                 '        DETECTED_W="$HW"',
                                 '        DETECTED_H="$VH"',
                                 '        echo "MATCH_LAYER3=${HW}x${VH}"',
                                 '        break',
                                 '      fi',
                                 '    fi',
                                 '  done',
                                 'fi',
                                 '',
                                 '# Fallback final',
                                 'if [ "$DETECTED_W" = "0" ] || [ "$DETECTED_H" = "0" ]; then',
                                 '  DETECTED_W=1024',
                                 '  DETECTED_H=768',
                                 '  echo "MATCH_FALLBACK=1024x768"',
                                 'fi',
                                 '',
                                 'echo "DETECTED_RES=${DETECTED_W}x${DETECTED_H}"',
                                 '',
                                 '# Dual boot: NTFS (Windows) ou outra partição Linux montável',
                                 'DUAL_BOOT=false',
                                 'if lsblk -f -n -o FSTYPE 2>/dev/null | grep -qE "^(ntfs|BitLocker)$"; then',
                                 '  DUAL_BOOT=true',
                                 'fi',
                                 'ROOT_DEV=$(findmnt -n -o SOURCE / 2>/dev/null)',
                                 'for dev in $(lsblk -pn -o NAME,FSTYPE 2>/dev/null | awk \'$2=="ext4" || $2=="btrfs" {print $1}\'); do',
                                 '  if [ "$dev" != "$ROOT_DEV" ]; then',
                                 '    DUAL_BOOT=true',
                                 '    break',
                                 '  fi',
                                 'done',
                                 'echo "DUAL_BOOT=$DUAL_BOOT"',
                                 '',
                                 'if [ -d /sys/firmware/efi ]; then',
                                 '  echo "BOOT_MODE=EFI"',
                                 'else',
                                 '  echo "BOOT_MODE=BIOS"',
                                 'fi',
                                 '',
                                 'if [ -f /boot/grub2/grub.cfg ]; then',
                                 '  echo "GRUB_CFG_PATH=/boot/grub2/grub.cfg"',
                                 'else',
                                 '  echo "GRUB_CFG_PATH=/boot/grub2/grub.cfg"',
                                 'fi'
        ].join('\n');

        _execReadOnly(script, 10000).then(function(stdout) {
            var info = {
                grubContent: null,
                grubReadable: true,
                detectedRes: '0x0',
                dualBoot: false,
                bootMode: 'BIOS',
                grubCfgPath: '/boot/grub2/grub.cfg'
            };

            var match = stdout.match(/---GRUB_FILE_START---\n([\s\S]*?)\n---GRUB_FILE_END---/);
            if (match) {
                info.grubContent = match[1];
            } else if (stdout.indexOf('GRUB_FILE_ERROR=unreadable') !== -1) {
                info.grubReadable = false;
            }

            var resMatch = stdout.match(/DETECTED_RES=(\d+x\d+)/);
            if (resMatch) info.detectedRes = resMatch[1];

            var layerMatch = stdout.match(/MATCH_(LAYER[123]|FALLBACK)=/);
            if (layerMatch) {
                console.log('[grub-info] Resolução detectada pela camada:', layerMatch[1]);
            }

            var dualMatch = stdout.match(/DUAL_BOOT=(\w+)/);
            if (dualMatch) info.dualBoot = (dualMatch[1] === 'true');

            var bootMatch = stdout.match(/BOOT_MODE=(\w+)/);
            if (bootMatch) info.bootMode = bootMatch[1];

            var cfgMatch = stdout.match(/GRUB_CFG_PATH=(\S+)/);
            if (cfgMatch) info.grubCfgPath = cfgMatch[1];

            if (query.get('preview') === '1' && info.grubContent) {
                info.preview = _computarPreviewGrub(info);
            }

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify(info));
        }).catch(function() {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                grubContent: null,
                grubReadable: false,
                detectedRes: '1024x768',
                dualBoot: false,
                bootMode: 'BIOS',
                grubCfgPath: '/boot/grub2/grub.cfg',
                error: 'Falha ao ler informações do GRUB'
            }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/hardware-detect-atomic') {
        var scriptAtomic = [
            'IS_ATOMIC=false',
            '[ -f /run/ostree-booted ] && IS_ATOMIC=true',
            'command -v rpm-ostree > /dev/null 2>&1 && IS_ATOMIC=true',
            'VARIANTE=$(grep -m1 ^PRETTY_NAME /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d \'"\')',
                                 'echo "is_atomic=$IS_ATOMIC"',
                                 'echo "variante=$VARIANTE"'
        ].join('; ');

        _execReadOnly(scriptAtomic, 3000).then(function(stdout) {
            var raw = _parseChaveValor(stdout);
            var isAtomic = raw.is_atomic === 'true';
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify({
                is_atomic: isAtomic,
                variante: raw.variante || '',
                gerenciador: isAtomic ? 'rpm-ostree' : 'dnf'
            }));
        }).catch(function() {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                is_atomic: false,
                variante: '',
                gerenciador: 'dnf',
                error: 'Falha ao detectar variante'
            }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/check-package') {
        var pkg = query.get('pkg');
        if (!pkg || !/^[a-zA-Z0-9._-]+$/.test(pkg)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'pkg inválido' }));
            return;
        }

        _execReadOnly('rpm -q ' + pkg + ' >/dev/null 2>&1; echo "exit=$?"', 3000).then(function(stdout) {
            var m = (stdout || '').match(/exit=(\d+)/);
            var codigo = m ? parseInt(m[1], 10) : -1;
            var instalado = (codigo === 0);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify({ installed: instalado, pkg: pkg }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/check-package-available') {
        var pkgCheck = query.get('pkg');
        if (!pkgCheck || !/^[a-zA-Z0-9._-]+$/.test(pkgCheck)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'pkg inválido' }));
            return;
        }

        var pkgEsc = pkgCheck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        var scriptAvail =

        'if rpm -q "' + pkgCheck + '" >/dev/null 2>&1; then ' +
        '  echo "status=installed"; exit 0; ' +
        'fi; ' +

        'AVAIL=$(dnf repoquery --available --quiet "' + pkgCheck + '" 2>/dev/null | head -1); ' +
        'if [ -n "$AVAIL" ]; then ' +
        '  echo "status=available"; exit 0; ' +
        'fi; ' +

        'for repo_nv in ' +
        '  "rpmfusion-nonfree-nvidia-driver" ' +
        '  "rpmfusion-nonfree" ' +
        '  "rpmfusion-nonfree-tainted"; do ' +
        '  AVAIL2=$(dnf --enablerepo="$repo_nv" repoquery --available --quiet "' + pkgCheck + '" 2>/dev/null | head -1); ' +
        '  if [ -n "$AVAIL2" ]; then ' +
        '    echo "status=available"; exit 0; ' +
        '  fi; ' +
        'done; ' +

        'if dnf --cacheonly list --available "' + pkgCheck + '" 2>/dev/null ' +
        '  | grep -qE "^' + pkgEsc + '(\\.[a-z0-9_]+)?[[:space:]]"; then ' +
        '  echo "status=available"; exit 0; ' +
        'fi; ' +

        'echo "status=not_available"';

        _execReadOnly(scriptAvail, 60000).then(function(stdout) {
            var raw = _parseChaveValor(stdout);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify({
                installed: raw.status === 'installed',
                available: raw.status === 'available',
                pkg: pkgCheck,
                error: raw.status ? null : 'verificação não retornou status (timeout ou dnf indisponível)'
            }));
        }).catch(function(e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                installed: false,
                available: false,
                pkg: pkgCheck,
                error: e.message
            }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/flatpak-installed') {
        _execReadOnly('flatpak list --app --columns=application 2>/dev/null', 5000).then(function(stdout) {
            const apps = (stdout || '').trim().split('\n').filter(Boolean);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify({ apps: apps }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/rustdesk-selinux-check') {
        _execReadOnly(
            'journalctl -g "avc:.*rustdesk" -S "24 hours ago" --no-pager 2>/dev/null | wc -l',
            10000
        ).then(function(stdout) {
            var n = parseInt((stdout || '').trim(), 10);
            if (isNaN(n)) n = 0;
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify({ avcs: n }));
        }).catch(function(e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ avcs: 0, erro: e.message }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/system-state') {

        if (query.get('refresh') === '1') {
            systemStateService.invalidarCache();
        }
        systemStateService.scanSystemState().then(function(dados) {
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify(dados));
        }).catch(function(e) {
            console.error('[system-state] Erro:', e.message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                repos_enabled: [],
                packages_installed: [],
                flatpaks_installed: [],
                groups_membership: [],
                kernel_params: {},
                services_active: [],
                config_files_present: [],
                error: e.message
            }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/hardware-scan') {
        hardwareService.scanHardware().then(function (resultado) {
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify(resultado));
        }).catch(function (e) {
            console.error('[hardware-scan] Erro:', e.message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ devices: [], repos: {}, secure_boot: 'unknown', error: e.message }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/vaapi-check') {
        var vendorCheck = (query.get('vendor') || '').toLowerCase();
        if (['amd', 'intel', 'nvidia'].indexOf(vendorCheck) === -1) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'vendor inválido (use amd, intel ou nvidia)' }));
            return;
        }

        var cmdCheck = vendorCheck === 'nvidia'
        ? 'LIBVA_DRIVER_NAME=nvidia vainfo 2>&1'
        : 'vainfo 2>&1';

        _execReadOnly(cmdCheck, 15000).then(function(stdout) {
            var parsed = _parseVainfo(stdout);
            parsed.vendor = vendorCheck;
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify(parsed));
        }).catch(function(e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                ok: false,
                vendor: vendorCheck,
                error: e.message
            }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/system-info') {
        const script = `
        FEDORA=$(cat /etc/fedora-release 2>/dev/null || echo "")
        KERNEL=$(uname -r 2>/dev/null || echo "")
        CPU=$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | sed 's/^ *//' | head -c 60)
        CPU_USO=$(top -bn2 -d 0.5 2>/dev/null | grep "Cpu(s)" | tail -1 | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{printf "%d", 100 - $1}')
        RAM_TOTAL=$(free -b 2>/dev/null | awk '/^Mem:/{print $2}')
        RAM_USADO=$(free -b 2>/dev/null | awk '/^Mem:/{print $3}')
        DISCO_INFO=$(df -B1 / 2>/dev/null | tail -1 | awk '{print $2" "$3}')
        DISCO_TOTAL=$(echo "$DISCO_INFO" | awk '{print $1}')
        DISCO_USADO=$(echo "$DISCO_INFO" | awk '{print $2}')
        UPTIME=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)
        BOOT_TIME=$(uptime -s 2>/dev/null || echo "")
        FIREWALL=$(firewall-cmd --state 2>/dev/null || echo "inativo")
        FIREWALL_ZONA=$(firewall-cmd --get-default-zone 2>/dev/null || echo "-")
        SELINUX=$(getenforce 2>/dev/null || echo "Desconhecido")
        SELINUX_MODO=$(grep '^SELINUX=' /etc/selinux/config 2>/dev/null | cut -d= -f2 || echo "-")
        PROCESSOS=$(ps -e --no-headers 2>/dev/null | wc -l)

        KSM_RUN=$(cat /sys/kernel/mm/ksm/run 2>/dev/null || echo "0")
        KSM_PAGES_SAVED=$(cat /sys/kernel/mm/ksm/pages_sharing 2>/dev/null || echo "0")
        TCP_CONGESTION=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || echo "unknown")
        MAX_MAP_COUNT=$(sysctl -n vm.max_map_count 2>/dev/null || echo "65530")
        PIPEWIRE_QUANTUM=$(pw-metadata -n settings 0 clock.quantum 2>/dev/null | grep -oP 'value:\\K\\d+' | head -1 || echo "1024")

        echo "fedora=$FEDORA"
        echo "kernel=$KERNEL"
        echo "cpu=$CPU"
        echo "cpu_uso=$CPU_USO"
        echo "ram_total=$RAM_TOTAL"
        echo "ram_usado=$RAM_USADO"
        echo "disco_total=$DISCO_TOTAL"
        echo "disco_usado=$DISCO_USADO"
        echo "uptime=$UPTIME"
        echo "boot_time=$BOOT_TIME"
        echo "firewall=$FIREWALL"
        echo "firewall_zona=$FIREWALL_ZONA"
        echo "selinux=$SELINUX"
        echo "selinux_modo=$SELINUX_MODO"
        echo "processos=$PROCESSOS"
        echo "ksm_run=$KSM_RUN"
        echo "ksm_pages_saved=$KSM_PAGES_SAVED"
        echo "tcp_congestion=$TCP_CONGESTION"
        echo "max_map_count=$MAX_MAP_COUNT"
        echo "pipewire_quantum=$PIPEWIRE_QUANTUM"
        `;

        _execReadOnly(script, 8000).then(function(stdout) {
            const raw = _parseChaveValor(stdout);
            const obj = {
                fedora: raw.fedora || '',
                kernel: raw.kernel || '',
                cpu: raw.cpu || '',
                cpu_uso: raw.cpu_uso ? parseInt(raw.cpu_uso, 10) : null,
                                         ram_total: raw.ram_total ? parseInt(raw.ram_total, 10) : null,
                                         ram_usado: raw.ram_usado ? parseInt(raw.ram_usado, 10) : null,
                                         disco_total: raw.disco_total ? parseInt(raw.disco_total, 10) : null,
                                         disco_usado: raw.disco_usado ? parseInt(raw.disco_usado, 10) : null,
                                         uptime: raw.uptime ? parseInt(raw.uptime, 10) : null,
                                         boot_time: raw.boot_time || '',
                                         firewall: raw.firewall || 'desconhecido',
                                         firewall_zona: raw.firewall_zona || '-',
                                         selinux: raw.selinux || 'desconhecido',
                                         selinux_modo: raw.selinux_modo || '-',
                                         processos: raw.processos ? parseInt(raw.processos, 10) : null,
                                         ksm_run: raw.ksm_run || '0',
                                         ksm_pages_saved: raw.ksm_pages_saved || '0',
                                         tcp_congestion: raw.tcp_congestion || 'unknown',
                                         max_map_count: raw.max_map_count || '65530',
                                         pipewire_quantum: raw.pipewire_quantum || '1024'
            };
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify(obj));
        }).catch(function() {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ erro: 'Falha ao coletar informações do sistema' }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/top-processes') {
        const scriptCpu = `ps -eo pcpu,comm --sort=-pcpu --no-headers 2>/dev/null | head -5`;
        const scriptRam = `ps -eo pmem,rss,comm --sort=-rss --no-headers 2>/dev/null | head -5`;

        Promise.all([
            _execReadOnly(scriptCpu, 4000),
                    _execReadOnly(scriptRam, 4000)
        ]).then(function(resultados) {
            const cpuOut = resultados[0] || '';
            const ramOut = resultados[1] || '';

            const cpu = cpuOut.split('\n').filter(Boolean).map(function(linha) {
                const partes = linha.trim().split(/\s+/);
                const pct = parseFloat(partes[0]) || 0;
                const nome = partes.slice(1).join(' ') || '?';
                return { nome: nome, cpu: pct.toFixed(1) };
            });

            const ram = ramOut.split('\n').filter(Boolean).map(function(linha) {
                const partes = linha.trim().split(/\s+/);
                const rssKb = parseInt(partes[1], 10) || 0;
                const nome = partes.slice(2).join(' ') || '?';
                const mb = (rssKb / 1024).toFixed(0);
                return { nome: nome, ram: mb + ' MB' };
            });

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify({ cpu: cpu, ram: ram }));
        }).catch(function() {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ cpu: [], ram: [] }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/disk-usage') {
        const script = `df -B1 --output=source,size,used,avail,pcent,target 2>/dev/null | tail -n +2 | grep -v -E "^(tmpfs|devtmpfs|efivarfs|squashfs|overlay)" | grep -v -E "\\s/(run|sys|proc|dev)(/|$)"`;

        _execReadOnly(script, 5000).then(function(stdout) {
            const particoes = stdout.split('\n').filter(Boolean).map(function(linha) {
                const partes = linha.trim().split(/\s+/);
                if (partes.length < 6) return null;
                return {
                    dispositivo: partes[0],
                    total: parseInt(partes[1], 10) || 0,
                                                                     usado: parseInt(partes[2], 10) || 0,
                                                                     livre: parseInt(partes[3], 10) || 0,
                                                                     percentual: partes[4],
                                                                     montagem: partes.slice(5).join(' ')
                };
            }).filter(Boolean);

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify({ particoes: particoes }));
        }).catch(function() {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ particoes: [] }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/journal-errors') {
        const script = `journalctl -p err -S "24 hours ago" -o short 2>/dev/null | grep -v "^-- " | tail -200`;

        _execReadOnly(script, 10000).then(function(stdout) {
            const grupos = {};
            const linhas = stdout.split('\n').filter(function(l) {
                return l.trim() && !l.startsWith('-- ');
            });

            linhas.forEach(function(linha) {
                var match = linha.match(/^\w{3}\s+\d+\s+\d+:\d+:\d+\s+\S+\s+([^\[:\s]+)(?:\[\d+\])?:\s*(.*)$/);
                if (!match) return;
                var origem = match[1];
                var mensagem = match[2] ? match[2].substring(0, 120) : '';

                if (!grupos[origem]) {
                    grupos[origem] = { origem: origem, contagem: 0, exemplo: '' };
                }
                grupos[origem].contagem++;
                if (!grupos[origem].exemplo && mensagem) {
                    grupos[origem].exemplo = mensagem;
                }
            });

            var lista = Object.values(grupos).sort(function(a, b) {
                return b.contagem - a.contagem;
            }).slice(0, 15);

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify({ grupos: lista }));
        }).catch(function() {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ grupos: [] }));
        });
        return;
    }

    if (req.method === 'GET' && url === '/changelog') {
        var resultado = _lerChangelogVersao(FAP_VERSION);
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(JSON.stringify(resultado));
        return;
    }

    if (req.method === 'GET' && url === '/fedora-upgrade-status') {

        if (query.get('refresh') === '1' && !_upgradeConcluidoPermanente) {
            _upgradeStatusCache = { dados: null, ts: 0 };
        }
        _calcularUpgradeStatus().then(function(dados) {
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify(dados));
        }).catch(function(e) {
            console.error('[fedora-upgrade-status] Erro:', e.message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'unknown',
                error: e.message
            }));
        });
        return;
    }

    if (req.method === 'POST' && url === '/executar') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {

            var originExec = req.headers.origin || '';
            var originExecOk = !originExec ||
            /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(originExec);
            if (!originExecOk) {
                console.warn('[FAP] /executar bloqueado — Origin suspeita:', originExec);
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    output: 'Origin não autorizada'
                }));
                return;
            }

            try {
                const { comando, idComando } = JSON.parse(body);

                const isReversao = false;

                if (!comando || !idComando) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({
                        success: false,
                        output: 'Comando e ID são obrigatórios'
                    }));
                }

                if (!/^[a-zA-Z0-9_-]+$/.test(idComando)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({
                        success: false,
                        output: 'idComando inválido: use apenas letras, números, hífen e underline'
                    }));
                }

                if (!_podeExecutar(idComando)) {
                    res.writeHead(429, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({
                        success: false,
                        output: 'Aguarde um instante antes de executar novamente.'
                    }));
                }

                sseBuffers.delete(idComando);

                _progressoTotalAtual.delete(idComando);

                procederComExecucao(comando, idComando, isReversao, res);

            } catch (err) {
                console.error('[ERRO INTERNO]', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    output: 'Erro interno do servidor'
                }));
            }
        });
        return;
    }

    if (req.method === 'POST' && url === '/shutdown') {

        var originShutdown = req.headers.origin || '';
        var originOk = !originShutdown ||
        /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(originShutdown);
        if (!originOk) {
            console.warn('[FAP] /shutdown bloqueado — Origin suspeita:', originShutdown);
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Origin não autorizada' }));
            return;
        }
        console.log('[FAP] /shutdown recebido — encerrando container e servidor');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Shutdown iniciado' }));

        try {
            const containerPath = path.join(__dirname, 'fap-container');
            const result = spawnSync('pkill', ['-f', 'fap-container.*--url http://localhost:' + PORT],
                                     { timeout: 3000 });
            if (result.status === 0) {
                console.log('[FAP] Container encerrado via pkill');
            } else {
                console.warn('[FAP] pkill do container não encontrou processo');
            }
        } catch (e) {
            console.warn('[FAP] Falha ao encerrar container:', e.message);
        }

        setTimeout(function() {
            _encerrarGraciosamente('SHUTDOWN');
        }, 500);

        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Página não encontrada');
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`[ERRO]: A porta ${PORT} já está em uso.`);
        console.error(` Execute: kill -9 $(lsof -t -i:${PORT})`);
    } else {
        console.error('[Erro do servidor]:', e.message);
    }
});

let _encerrando = false;

function _encerrarGraciosamente(sinal) {

    if (_encerrando) return;
    _encerrando = true;

    console.log(`\n🛑 Encerrando servidor (${sinal})...`);

    _processosAtivos.forEach(_matarArvoreProcessos);

    if (_askpassHelperPath && fs.existsSync(_askpassHelperPath)) {
        try { fs.unlinkSync(_askpassHelperPath); } catch (e) {}
    }

    sseClients.forEach((clients) => {
        clients.forEach(client => {
            client.end();
        });
    });
    sseClients.clear();

    server.close(() => {
        console.log('✅ Servidor encerrado');
        process.exit(0);
    });

    setTimeout(function() {
        console.log('⚠️ Forçando saída após timeout');
        process.exit(0);
    }, 3000);
}

process.on('SIGINT', function() { _encerrarGraciosamente('SIGINT'); });
process.on('SIGTERM', function() { _encerrarGraciosamente('SIGTERM'); });

const HOST = '127.0.0.1';

server.listen(PORT, HOST, () => {
    const desktop = detectarDesktop();
    const metodo = obterMetodoAutenticacao();

    _limparLogsAntigos();

    console.log(`====================================================`);
    console.log(` 🐧 Fedora Advantage Panel - Servidor de Automação v${FAP_VERSION}`);
    console.log(` 🌐 http://localhost:${PORT} (somente local — 127.0.0.1)`);
    console.log(` 🖥️ Desktop: ${desktop}`);
    console.log(` 🔐 Autenticação: ${metodo.descricao}`);
    console.log(` 🏠 HOME do usuário: ${HOME_DIR_USUARIO}`);
    console.log(` 👤 Usuário: ${USUARIO_REAL}`);
    console.log(` 📡 SSE: Ativo (logs em tempo real, com buffer de replay)`);
    console.log(` 📁 Arquivos estáticos: Ativo (HTML, CSS, JS, ícone)`);
    console.log(` 🌐 i18n: Ativo (locales em /locales/<lang>.json)`);
    console.log(` 📄 Páginas: index.html, guiado.html + 13 sessões dinâmicas`);
    console.log(` 📝 Changelog: /changelog (lê CHANGELOG.md)`);
    console.log(` 🔧 Comandos SEM autenticação: rpm -q, uname -r, gtk-launch, flatpak, systemctl --user, etc`);
    console.log(` 🔧 idComandos sem auth: atualizar-fap, desinstalar-fap (com SUDO_ASKPASS)`);
    console.log(` 🎯 Comandos USER-CONTEXT (env ajustado): ${COMANDOS_USER_CONTEXT.join(', ')}`);
    console.log(` 📊 Progresso: .progresso.json (persistente no servidor)`);
    console.log(` 📦 Flatpak instalados: /flatpak-installed`);
    console.log(` 🔌 Hardware scan: /hardware-scan (lê hardware_map.json)`);
    console.log(` 🧠 Kernels: /kernels`);
    console.log(` 🖥️ System info: /system-info (com KSM, BBR, max_map_count, PipeWire quantum)`);
    console.log(` 📈 Top processos: /top-processes`);
    console.log(` 💾 Uso de disco: /disk-usage`);
    console.log(` 📋 Erros do journal: /journal-errors`);
    console.log(` 🔊 Buffer SSE: ${SSE_BUFFER_MAX} mensagens por comando, TTL ${SSE_BUFFER_TTL_MS/1000}s`);
    console.log(` 🚦 Rate limit: ${RATE_LIMIT_MS}ms por idComando`);
    console.log(`====================================================`);
});
