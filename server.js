const http = require('http');
const { exec, execFile, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const hardwareService = require('./hardware-service');
const systemStateService = require('./system-state-service');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ARQUIVO_PROGRESSO = path.join(__dirname, '.progresso.json');
const ARQUIVO_CHANGELOG = path.join(__dirname, 'CHANGELOG.md');

// ============================================================
// VERSÃO DO FAP — fonte única: package.json
// ============================================================
//
// A versão do FAP é definida em UM lugar só: o campo "version" do
// package.json. O Node resolve `require('./package.json')` relativo
// ao arquivo que faz o require, então funciona independente do CWD
// do processo.
//
// Se por algum motivo o package.json estiver ausente ou corrompido,
// caímos em 'unknown' — o endpoint /info continua respondendo, e o
// botão "Atualizar FAP" mostra o badge de forma conservadora (com
// 'unknown' em vez da versão local, `temAtualizacao()` retorna
// false e nenhum badge aparece). Isso evita falsos positivos.
let FAP_VERSION = 'unknown';
try {
    FAP_VERSION = require('./package.json').version || 'unknown';
} catch (e) {
    console.error('[FAP] Não foi possível ler a versão do package.json:', e.message);
}

const LANGS_SUPORTADOS = ['pt-BR', 'en', 'es'];
const LOCALES_DIR = path.join(__dirname, 'locales');

// ============================================================
// WHITELIST DE COMANDOS SEM AUTENTICAÇÃO
// ============================================================
//
// Comandos que rodam sem pedir senha. Critérios:
// - São read-only (consultas) ou abrem GUIs já instaladas.
// - Não permitem escalação de privilégio nem execução arbitrária.
// - NÃO fazem sentido rodando como root (Flatpak, por exemplo).
//
// NÃO INCLUIR:
// - 'which' / 'test' — qualquer coisa depois do verbo passaria
//   sem auth. Um comando como `which foo; rm -rf ~` seria aceito.
// - 'waydroid' (prefixo puro) — cobriria `waydroid init`, que
//   precisa de root. Só liberamos os subcomandos de leitura/abrir.
// - 'bash <(curl ...)' — executava qualquer URL. Update/uninstall
//   agora exigem autenticação (pkexec). O install.sh invoca
//   sudo internamente e o usuário vê o comando na janela de senha
//   antes de autorizar — comportamento correto.
// - 'vainfo' / 'vdpauinfo' / 'env LIBVA_DRIVER_NAME=nvidia vainfo'
//   — a verificação de aceleração VA-API agora usa o endpoint
//   `/vaapi-check` (que roda via `_execReadOnly`, bypassando
//   `/executar`). As entradas antigas na whitelist eram dead code
//   e foram removidas na v1.5.8 (rodada 3).
//
// SOBRE O FLATPAK:
// - Flatpak NUNCA deve rodar via pkexec. Rodar como root
//   quebra o session bus (D-BUS), porque o `pkexec` aponta
//   DBUS_SESSION_BUS_ADDRESS para o bus do root, não do usuário.
// - O Polkit do Fedora já resolve a autenticação automaticamente
//   quando o usuário está no grupo wheel (o caso comum). Não há
//   necessidade de o FAP intermediar.
// - O tratamento especial em `executarComandoComStream` já seta
//   XDG_RUNTIME_DIR e DBUS_SESSION_BUS_ADDRESS corretos.
//
// SOBRE `systemctl --user`:
// - Mesma lógica do Flatpak: é um comando do contexto do USUÁRIO,
//   não do sistema. Rodar via pkexec apontaria XDG_RUNTIME_DIR para
//   /run/user/0 (do root), e o systemctl do usuário não encontraria
//   o bus correto — o comando falharia silenciosamente.
// - A whitelist faz ele rodar como o usuário real, com o env
//   correto ajustado por `_precisaEnvUserContext()`.
//
// SOBRE AS ENTRADAS `setsid -f <app>`:
// - Todos os botões "Abrir X" usam `setsid -f <comando>` para que
//   o app ganhe uma sessão própria, desacoplada do FAP. Isso
//   resolve o bug em que o app era morto junto quando o usuário
//   fechava o FAP (mesmo PGID).
// - Estes comandos são read-only do ponto de vista do sistema —
//   apenas abrem GUIs já instaladas, como se o usuário clicasse
//   no atalho do menu. Whitelist explícita para não permitir
//   `setsid -f rm -rf ~` ou similar.
// - Cada app aberto via `abrirFerramentaExterna` precisa de uma
//   entrada própria. Os que usam `gtk-launch` já estão cobertos
//   pela entrada única `'setsid -f gtk-launch'`; os que usam o
//   binário direto (vlc, krita, gimp, ...) precisam da sua.

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

// --- setsid -f: abertura de GUI em sessão própria ---
// App aberto via `gtk-launch` (cobre a maioria).
'setsid -f gtk-launch',
// Apps com binário próprio (não usam gtk-launch).
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
// Players de mídia, editores gráficos e de vídeo/áudio.
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
// Navegadores via repo oficial do fabricante.
'setsid -f chromium-browser',
'setsid -f opera',
'setsid -f brave-browser',
'setsid -f vivaldi-stable',
'setsid -f microsoft-edge-stable',

// Flatpak roda como usuário; a autenticação (quando necessária)
// é resolvida pelo Polkit do sistema, não pelo FAP.
'flatpak install',
'flatpak uninstall',
'flatpak update',
'flatpak remote-add',
// systemctl --user roda como usuário (serviço do usuário, não do
// sistema). Mesma lógica do Flatpak: precisa do bus do usuário.
'systemctl --user'
];

// ============================================================
// WHITELIST POR idComando — atualização/desinstalação do FAP
// ============================================================
//
// O comando de atualização (`bash <(curl ...) --update`) contém
// process substitution (`<(`), que é bloqueado por
// `_CARACTERES_ENCADEAMENTO` — então ele nunca passaria pela
// whitelist de prefixo.
//
// Por outro lado, rodar esse comando via pkexec é um problema
// real: o `install.sh --update` faz `git pull` e `npm install`
// em `~/.local/share/fedora-advantage-panel`. Rodando como root,
// esses arquivos passam a pertencer ao root — e a PRÓXIMA
// atualização (rodando como usuário) falha por permissão.
//
// A solução correta é rodar o update/desinstalação como USUÁRIO,
// e resolver as operações privilegiadas via `SUDO_ASKPASS` (o
// sudo do Fedora usa automaticamente o askpass quando não há
// TTY e a variável está setada). Isso é feito em
// `_criarAskpassHelper()` + `executarComandoComStream`.
//
// Por segurança, não liberamos QUALQUER comando com estes
// idComandos: casamos o comando contra um regex ESTRITO. Um
// cliente malicioso não pode reusar o id `atualizar-fap` para
// rodar `rm -rf ~`.
const IDS_SEM_AUTENTICACAO = new Set([
    'atualizar-fap',
    'desinstalar-fap',
    'nvidia-vaapi-env',
    'nvidia-vaapi-env-remove'
]);

// ============================================================
// ids que precisam de HOME DO USUÁRIO em scripts externos (v1.5.9)
// ============================================================
//
// O `_construirScripts` exporta HOME=<home-do-usuário> APENAS para
// os IDs desta lista. Para o resto, o `HOME` é herdado do `pkexec`
// (= /root, padrão do Fedora), e o `dnf` usa `/var/cache/dnf/`
// (system) em vez de `~/.cache/dnf/` (root-owned no home do
// usuário).
//
// EXCEÇÃO: scripts EXTERNOS baixados de URL (`install.sh`,
// `fap-cleanup.sh`, etc.) que usam `$HOME` DENTRO do arquivo. O
// `_substituirCaminhosUsuario` só troca `$HOME`/`~` NA STRING
// do comando — não dentro do arquivo baixado. Esses IDs precisam
// do HOME do usuário exportado.
//
// Comandos INLINE com `$HOME`/`~` na string (GameMode presets,
// Rclone Manager `comandoRemocao`, etc.) NÃO precisam entrar
// aqui — `_substituirCaminhosUsuario` cobre.
//
// Estado atual: VAZIO. `desinstalar-fap` e `atualizar-fap` (que
// rodam `install.sh` baixado) estão em `IDS_SEM_AUTENTICACAO` —
// rodam como usuário, nunca via pkexec, então nunca chegam ao
// `_construirScripts`.
const IDS_COM_HOME_DO_USUARIO = new Set([]);

const PADROES_UPDATE_WHITELIST = [
    /^bash <\(curl -s https:\/\/raw\.githubusercontent\.com\/vitaotub\/Fedora-Advantage-Panel\/main\/install\.sh\) --update$/,
    /^setsid -f bash -c 'bash <\(curl -s https:\/\/raw\.githubusercontent\.com\/vitaotub\/Fedora-Advantage-Panel\/main\/install\.sh\) --uninstall -y'$/,
    // nvidia-vaapi-env: escreve arquivo de env do usuário (sem sudo)
    /^mkdir -p ~\/\.config\/environment\.d && tee ~\/\.config\/environment\.d\/99-fap-nvidia-vaapi\.conf <<'FAPEOF'[\s\S]*FAPEOF$/,
    // nvidia-vaapi-env-remove: remove arquivo de env do usuário (sem sudo)
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

// ============================================================
// SUDO_ASKPASS — helper gráfico para sudo sem TTY
// ============================================================
//
// Quando o update/desinstalação do FAP roda como usuário (que é o
// comportamento correto), o `install.sh` faz várias chamadas a
// `sudo` internamente. Como o processo não tem TTY (é filho do
// node), o sudo padrão falharia esperando senha.
//
// O sudo do Fedora (>= 1.8.x) usa SUDO_ASKPASS automaticamente
// quando: (a) não há TTY disponível, OU (b) a flag -A foi passada.
// Só precisamos apontar SUDO_ASKPASS para um helper que devolva a
// senha na stdout.
//
// Criamos o helper uma única vez (idempotente) em /tmp, com
// prefixo `fap-`, para que a limpeza de logs antigos o encontre.

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

// ============================================================
// COMANDOS QUE RODAM NO CONTEXTO DO USUÁRIO
// ============================================================
//
// Estes comandos NÃO devem herdar o env do processo Node (que pode
// ter sido iniciado com variáveis erradas, ou que apontam para o
// diretório de outro usuário). `executarComandoComStream` ajusta
// XDG_RUNTIME_DIR, DBUS_SESSION_BUS_ADDRESS e HOME para esses.
//
// Antes, isso era um `if (comando.includes('flatpak'))` hardcoded.
// Agora é uma lista extensível — qualquer comando novo que precise
// do bus do usuário entra aqui, sem precisar editar o bloco de
// execução.

const COMANDOS_USER_CONTEXT = [
'flatpak',
'systemctl --user',
'pw-metadata',
'pw-cli',
'pactl',
'wpctl',
// gtk-launch abre o app via D-Bus do usuário. Sem
// DBUS_SESSION_BUS_ADDRESS e XDG_RUNTIME_DIR corretos, a
// chamada falha silenciosamente (o app nunca abre).
// Cobre todos os botões "Abrir X" baseados em .desktop —
// tanto flatpaks (gtk-launch <appId>) quanto pacotes dnf
// (gtk-launch <nome>).
'gtk-launch'
];

function _precisaEnvUserContext(comando) {
    return COMANDOS_USER_CONTEXT.some(function(cmd) {
        return comando.includes(cmd);
    });
}

// Caracteres de encadeamento de shell que permitem burlar a whitelist.
// Cobre: ; ` | $( ) <( ) >( ) && & (background, não 2>&1) e quebras de linha.
// O padrão `(?:^|\s)&(?:\s|$)` casa `&` como operador de background
// (com espaço antes e depois), mas NÃO casa `2>&1` (onde `&` está colado).
//
// Sem esta validação, um comando como "rpm -q kernel; rm -rf ~" passaria
// pelo startsWith("rpm -q ") e executaria o `rm` sem autenticação.
// `>` sozinho (redirecionamento de arquivo) e `>>` (append) são
// vetores de sobrescrita de arquivo (ex.: `rpm -q kernel > ~/.bashrc`).
// Bloqueia-os, MAS permite `>&N` (dup de fd, ex.: `2>&1`) e `>N`
// (redirect para fd N), que são sintaxe de redirect legítima.
// Caracteres de encadeamento de shell que permitem burlar a whitelist.
// Cobre: ; ` | $( ) <( ) >( ) && & (background, não 2>&1) e quebras de linha.
//
// `>` NÃO é tratado aqui: o regex original `(?:^|\s)>>?(?![&\d])` só
// bloqueava `>` quando precedido por espaço. Variantes como
// `rpm -q kernel>~/.bashrc` (sem espaço) passavam pela whitelist de
// prefixo e o bash do `exec` interpretava `>` como redirect,
// sobrescrevendo arquivos do usuário. `_temRedirectInvalido()` faz o
// check correto (whitelist exata de dup-fd + bloqueio de qualquer
// outro `>`). A ordem importa: `_cmdSemAutenticacao` chama
// `_temRedirectInvalido` DEPOIS de `_CARACTERES_ENCADEAMENTO`.
const _CARACTERES_ENCADEAMENTO = /[\n\r;`|]|\$\(|&&|<\(|>\(|(?:^|\s)&(?:\s|$)/;

// Detecta redirect `>` como vetor de sobrescrita de arquivo.
//
// Remove PRIMEIRO as duplicações de fd legítimas (sintaxe padrão do
// bash):
//   • 2>&1 — stderr para stdout
//   • 1>&2 — stdout para stderr
//   • >&2  — forma curta de 1>&2
//
// Qualquer `>` remanescente bloqueia. Isso cobre `>`, `>>`, `2>`,
// `2>>`, `>&file`, `2>&file`, todos vetores de escrita arbitrária
// em CWD/HOME (ex.: `~/.bashrc`, `~/.profile`, `~/.zshrc`).
//
// O `_ehRedirectAbrirValido` (chamado ANTES) tem regex exato que
// fixa `> /tmp/fap-open-*.log 2>&1 < /dev/null` — o único `>`
// legítimo que o FAP usa.
function _temRedirectInvalido(texto) {
    var semDupFd = String(texto || '')
    .replace(/2>&1/g, '  ')
    .replace(/1>&2/g, '  ')
    .replace(/(?:^|\s)>&2/g, '  ');
    return semDupFd.indexOf('>') !== -1;
}

function _cmdSemAutenticacao(comando) {
    const trimmed = (comando || '').trim();

    // Exceção: padrão interno de abrir app (redirect legítimo).
    // Só passa se o binário estiver na whitelist E o formato casar
    // exatamente com `setsid -f <bin> > /tmp/fap-open-*.log 2>&1 < /dev/null`.
    if (_ehRedirectAbrirValido(trimmed)) {
        return true;
    }

    if (_CARACTERES_ENCADEAMENTO.test(trimmed)) {
        return false;
    }

    // NOVO: bloqueia `>` como redirect (exceto 2>&1, 1>&2, >&2).
    if (_temRedirectInvalido(trimmed)) {
        return false;
    }

    return COMANDOS_SEM_AUTENTICACAO.some(function(cmd) {
        return trimmed === cmd
        || trimmed.startsWith(cmd + ' ')
        || trimmed.startsWith(cmd + '\t');
    });
}

// Exceção estrita: o comando gerado por `abrirFerramentaExterna`
// usa `> /tmp/fap-open-*.log 2>&1 < /dev/null` para desacoplar o
// app do FAP (setsid) e capturar a saída num arquivo previsível.
// Esse padrão é gerado pelo próprio FAP, não é entrada de usuário
// — o idLog é sanitizado em `/^[a-zA-Z0-9_-]+$/`. Whitelist exata
// do formato esperado para permitir o redirect sem afrouxar o
// chain check geral.
// Whitelist de binários que podem aparecer em `setsid -f <binario>`.
// Espelha as entradas `setsid -f <binario>` de
// COMANDOS_SEM_AUTENTICACAO, mais `xdg-open` (usado por
// abrirFerramentaExterna para links externos).
//
// O regex antigo usava `[^>\n]+` no lugar do binário — o que
// aceitava `setsid -f bash -c 'rm -rf ~' > /tmp/fap-open-x.log
// 2>&1 < /dev/null` como "abertura de app" e passava sem auth.
// A whitelist bloqueia isso.
const _BINARIOS_ABRIR_WHITELIST = new Set([
    'gtk-launch', 'xdg-open', 'sealert',
    'corectrl', 'lact', 'rclone-manager', 'steam', 'heroic', 'rustdesk',
    'keepassxc', 'firefox', 'thunderbird', 'kate', 'okular', 'artcraft-launcher',
    'vlc', 'krita', 'inkscape', 'gimp', 'darktable', 'coolercontrol',
    'jstest-gtk', 'freecad', 'librecad', 'kdenlive', 'pitivi', 'shotcut',
    'blender', 'ardour8', 'lmms', 'audacity',
    'chromium-browser', 'opera', 'brave-browser', 'vivaldi-stable',
    'microsoft-edge-stable',
    // v1.6.0: Lightworks — o `.desktop` do Lightworks pode ter nome
    // diferente de `lightworks.desktop` (ex.: `lightworks-2023.2.desktop`),
    // então `gtk-launch lightworks` falha silenciosamente. O binário
    // direto `/usr/bin/lightworks` (usado pelo atalho do menu iniciar)
    // funciona. Re-adicionado à whitelist (removido na v1.5.9 como
    // dead code).
    'lightworks'
]);

// ============================================================
// FLATPAK RUN — padrão específico (v1.6.0)
// ============================================================
//
// Alguns apps Flatpak têm `.desktop` com `DBusActivatable=true` e
// `gtk-launch <appId>` falha silenciosamente (o `setsid` desacopla,
// retorna 0, mas a janela não abre). O Telegram é um caso
// confirmado em teste real: o atalho do menu iniciar usa
// `/usr/bin/flatpak run org.telegram.desktop`, e o `gtk-launch`
// não funciona.
//
// Correção: padrão específico para `flatpak run <appId>`, com
// regex RESTRITO (sem argumentos extras tipo `--command=bash` ou
// `-c`). Isso permite `setsid -f flatpak run org.telegram.desktop
// > /tmp/fap-open-*.log 2>&1 < /dev/null` sem `pkexec`, sem abrir
// brecha para execução arbitrária dentro do sandbox Flatpak.
//
// NÃO adicionar `flatpak` à `_BINARIOS_ABRIR_WHITELIST` — o regex
// genérico aceitaria `flatpak <qualquer coisa>` (incluindo
// `--command=...`). O padrão específico abaixo é a única forma
// de `flatpak` passar por `_ehRedirectAbrirValido`.
// v1.6.1: separadores SÓ com espaço (`[ ]`), nunca `\s` — `\s` casa `\n`,
// e uma quebra de linha no meio do comando viraria um segundo comando.
const _REDIRECT_FLATPAK_RUN_PADRAO = /^setsid[ ]+-f[ ]+flatpak[ ]+run[ ]+([a-zA-Z0-9][a-zA-Z0-9._-]*)[ ]>[ ]+\/tmp\/fap-open-[\w.\-]+\.log[ ]+2>&1[ ]+<[ ]+\/dev\/null$/;

// Regex captura o binário no grupo 1 para consulta na whitelist.
// `(?:\s+[^>\n]+)?` cobre argumentos opcionais (appIds, URLs, etc.)
// sem permitir `>` (que indica redirect extra, vetor de XSS).
// ============================================================
// REGEX DE ABERTURA DE APP — RESPEITA ASPAS (v1.5.9 — pós-teste)
// ============================================================
//
// Antes: `(?:\s+[^>\n]+)?` aceitava argumentos que não contivessem
// `>`. URLs com `>` no query string (raro, mas possível) caíam
// fora do padrão e o comando ia parar em `pkexec` — regressão
// introduzida quando o `abrirFerramentaExterna` passou a quotar
// URLs (o quote envolve a URL em aspas simples, mas o `>` dentro
// das aspas continuava sendo `>` para o regex antigo).
//
// Agora: aceita três formas por argumento:
//   • `'[^']*'`       — aspas simples sem aspas internas
//   • `"[^"]*"`       — aspas duplas sem aspas internas
//   • `[^>\n'"]+`     — sem aspas, sem `>` (comportamento antigo)
//
// Combinado com o `_quotarUrlsNaoQuotadas` no `script.js`, URLs
// com caracteres perigosos (`>`, `&`, `$`, backtick) são
// envolvidas em aspas simples e caem no primeiro ramo — sem
// `pkexec`, e sem abrir buraco para `>` fora de aspas (o PoC
// original `rpm -q kernel>~/.bashrc` continua bloqueado).
// ============================================================
// v1.6.1 — REGEX ESTRITO (corrige bypass de autenticação + ReDoS)
// ============================================================
//
// `_ehRedirectAbrirValido` é consultado ANTES de
// `_CARACTERES_ENCADEAMENTO`. A versão anterior aceitava, como
// argumento sem aspas, `[^>\n'"]+` — ou seja, `;`, `$(`, crase, `|`
// e `&` passavam, e `"..."` aceitava `$(...)`. Resultado:
// `setsid -f xdg-open $(touch /tmp/x) > /tmp/fap-open-a.log ...`
// rodava via `exec(..., {shell:'/bin/bash'})` SEM pkexec. Além
// disso, `\s+` + `[^>\n'"]+` (que também casa espaço) era ambíguo e
// causava backtracking exponencial (26 palavras ≈ 580 ms).
//
// Agora:
//   • binário: `[A-Za-z0-9._-]+` (a whitelist exige nome simples);
//   • argumento sem aspas: SÓ `[A-Za-z0-9_.\/:@%+=,~-]+` — o mesmo
//     conjunto que `_shellQuote` (script.js) deixa sem aspas, mais `~`;
//     qualquer outro caractere chega ao servidor entre aspas simples;
//   • `'...'` aceito integralmente (bash não interpreta nada dentro);
//   • `"..."` aceito SEM `$`, crase ou `\` (bash interpretaria);
//   • separadores só com espaço `[ ]` (nunca `\s`, que casa `\n`);
//   • tokens sem espaço interno → sem ambiguidade → sem ReDoS.
const _REDIRECT_ABRIR_PADRAO = /^setsid[ ]+-f[ ]+([A-Za-z0-9._-]+)(?:[ ]+(?:'[^']*'|"[^"$`\\]*"|[A-Za-z0-9_.\/:@%+=,~-]+))*[ ]>[ ]+\/tmp\/fap-open-[\w.\-]+\.log[ ]+2>&1[ ]+<[ ]+\/dev\/null$/;

function _ehRedirectAbrirValido(trimmed) {
    // v1.6.0: padrão específico para `flatpak run <appId>` (regex
    // restrito, sem `--command`/`-c`). Verificado ANTES do genérico
    // para não precisar adicionar `flatpak` à whitelist (o que
    // aceitaria `flatpak <qualquer coisa>`).
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

// ============================================================
// ACEITA GET E HEAD (v1.5.6)
// ============================================================
//
// `curl -I` envia HEAD, não GET. A versão anterior do server.js
// só tratava GET nos arquivos estáticos e nos locales. O HEAD
// caía no handler de 404 (que retorna `text/plain`), enganando
// ferramentas de debug: `curl -I /script.js` mostrava
// `Content-Type: text/plain; charset=utf-8` em vez de
// `text/javascript; charset=utf-8`.
//
// O navegador (WebKitGTK) usa GET, então o FAP funcionava
// normalmente. Só ferramentas de debug eram afetadas. Correção
// cosmética, mas alinhada com a RFC 9110: servidores DEVEM
// responder a HEAD com os mesmos headers de GET, sem o body.
function _aceitaGetOuHead(req) {
    return req.method === 'GET' || req.method === 'HEAD';
}

const sseClients = new Map();

// ============================================================
// BUFFER DE REPLAY DO SSE
// ============================================================

const sseBuffers = new Map();
const SSE_BUFFER_MAX = 2000;
const SSE_BUFFER_TTL_MS = 10000;

// Âncora de `total` por idComando (v1.5.1 — cosmético).
// Quando o `dnf` roda múltiplas operações em sequência (ex.:
// `dnf install X && dnf remove Y`), o total muda de M para M'
// e a barra pularia de 100% para 1%. Ancoramos no primeiro M
// observado e ignoramos chunks com M diferente (operação
// secundária). Limpo em `POST /executar`.
const _progressoTotalAtual = new Map();

// ============================================================
// RASTREAMENTO DE PROCESSOS FILHOS
// ============================================================
//
// Todo comando disparado pelo FAP é registrado neste Set. No SIGINT
// (Ctrl+C no terminal), o handler percorre o Set e mata a árvore de
// cada processo — não só o pai direto.
//
// O motivo de precisar matar a árvore: entre o bash que o Node
// criou e o comando real (dnf, apt, etc.) há camadas (pkexec,
// script root). Matar só o bash deixa o dnf órfão.
//
// A solução tem duas partes:
//   1. `detached: true` no spawn/exec — o bash vira líder de sessão
//      e todos os descendentes herdam o mesmo PGID.
//   2. `process.kill(-pid, 'SIGTERM')` no SIGINT — o `-` antes do
//      PID envia o sinal para o grupo inteiro.

const _processosAtivos = new Set();

function _registrarProcesso(proc) {
    _processosAtivos.add(proc);
    proc.on('close', () => _processosAtivos.delete(proc));
    return proc;
}

// ============================================================
// LISTAGEM RECURSIVA DE DESCENDENTES (Fase I)
// ============================================================
//
// O `pkexec` quebra o grupo via `setsid()`: o filho root vira
// líder de uma NOVA sessão, e `process.kill(-pidRaiz)` não o
// alcança. Precisamos listar os descendentes explicitamente
// ANTES de matar — depois que o bash pai morre, os netos viram
// órfãos (`ppid` = 1) e `pgrep -P` não os acha mais.
//
// `spawnSync` (não async) é de propósito: precisamos do snapshot
// completo antes de começar a matar. Se fosse async, o primeiro
// SIGTERM podia matar o bash pai e perder os netos antes de
// listá-los.
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

    // 1. Snapshot dos descendentes ANTES de matar.
    var alvos = _listarDescendentes(pidRaiz, 5);

    // 2. SIGTERM em todos (mais fundo primeiro).
    for (var i = alvos.length - 1; i >= 0; i--) {
        try { process.kill(alvos[i], 'SIGTERM'); } catch (e) { /* ESRCH/EPERM */ }
    }

    // 3. SIGTERM no grupo inteiro.
    try { process.kill(-pidRaiz, 'SIGTERM'); } catch (e) { /* ESRCH/EPERM */ }

    // 4. pkill de fap-cmd-* como usuário. Cobre os scripts
    //    temporários criados pelo pkexec (`/tmp/fap-cmd-*.sh`).
    //    O pkexec pode ter deixado processos root que este `pkill`
    //    (rodando como usuário) não alcança — mas o bash que
    //    invocou e o script em si rodam como usuário.
    try {
        spawnSync('pkill', ['-9', '-f', 'fap-cmd-'], { timeout: 1000 });
    } catch (e) { /* ignora */ }

    // 5. Aguarda efeito dos SIGTERMs/SIGKILLs antes de checar vivos.
    try {
        spawnSync('sleep', ['0.3'], { timeout: 1000 });
    } catch (e) { /* ignora */ }

    // 6. Vivos: `process.kill(pid, 0)` sem exceção = vivo (mesmo UID);
    //    ESRCH = morto; EPERM = vivo em outro UID (root). Tratamos
    //    EPERM como vivo — o pkexec cria filhos root que o usuário
    //    não pode sinalizar sem `NOPASSWD: /usr/bin/kill`.
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

    // 7. SIGKILL de segurança no grupo.
    try { process.kill(-pidRaiz, 'SIGKILL'); } catch (e) { /* ESRCH */ }
}

// ============================================================
// RATE LIMITING
// ============================================================
//
// Impede que um script (XSS ou chamada manual) dispare centenas
// de comandos em loop. Limite: 1 execução por idComando a cada
// 1.5s. Após 60s de inatividade, entradas antigas são removidas
// para não crescer indefinidamente.

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

// ============================================================
// HELPERS DE EXECUÇÃO READ-ONLY
// ============================================================
//
// Para os endpoints informativos (system-info, top-processes,
// disk-usage, journal-errors), usamos este helper em vez de
// abrir conexão SSE. Comandos são simples, curtos, read-only.

// v1.6.2: CPU INSTANTÂNEA por processo. `ps -o pcpu` devolve a média desde
// o INÍCIO do processo (um navegador aberto há 3 h aparecia como "0%"
// mesmo travando a máquina agora). Aqui lemos utime+stime de /proc/<pid>/stat
// duas vezes, com um intervalo curto, e calculamos o delta — o mesmo que o
// `top` faz. Resultado em % de UM núcleo (pode passar de 100 em multithread).
function _lerTicksProcessos() {
    const mapa = new Map();
    let pids = [];
    try { pids = fs.readdirSync('/proc').filter(function(n) { return /^[0-9]+$/.test(n); }); }
    catch (e) { return mapa; }
    for (let i = 0; i < pids.length; i++) {
        try {
            const stat = fs.readFileSync('/proc/' + pids[i] + '/stat', 'utf8');
            // O nome (campo 2) fica entre parênteses e pode ter espaços/")":
            // parseia a partir do ÚLTIMO ")".
            const resto = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
            const ticks = (parseInt(resto[11], 10) || 0) + (parseInt(resto[12], 10) || 0);
            const comm = stat.slice(stat.indexOf('(') + 1, stat.lastIndexOf(')'));
            mapa.set(pids[i], { ticks: ticks, nome: comm });
        } catch (e) { /* processo terminou durante a leitura */ }
    }
    return mapa;
}

function _amostrarCpuProcessos(intervaloMs) {
    const CLK_TCK = 100; // padrão do kernel Linux (getconf CLK_TCK)
    const antes = _lerTicksProcessos();
    const t0 = Date.now();
    return new Promise(function(resolve) {
        setTimeout(function() {
            const depois = _lerTicksProcessos();
            const dt = Math.max(0.05, (Date.now() - t0) / 1000);
            const lista = [];
            depois.forEach(function(v, pid) {
                const a = antes.get(pid);
                if (!a) return; // processo novo: sem base para o delta
                const pct = ((v.ticks - a.ticks) / CLK_TCK / dt) * 100;
                if (pct > 0) lista.push({ nome: v.nome, cpu: pct });
            });
            lista.sort(function(x, y) { return y.cpu - x.cpu; });
            resolve(lista.slice(0, 5).map(function(x) {
                return { nome: x.nome, cpu: x.cpu.toFixed(1) };
            }));
        }, intervaloMs || 500);
    });
}

function _execReadOnly(comando, timeoutMs) {
    return new Promise(function(resolve) {
        // ============================================================
        // EXECFILE COM --noprofile --norc (v1.5.6)
        // ============================================================
        //
        // Mesmo problema do `_exec` do `hardware-service.js`. O
        // `bash -c` carrega o `.bashrc` do usuário (KDE, Fedora 45),
        // e um `.bashrc` com `fastfetch` polui o stdout de todos os
        // endpoints de diagnóstico (`/system-info`, `/top-processes`,
        // `/disk-usage`, `/journal-errors`, `/kernel-atual`,
        // `/check-package`, `/check-package-available`,
        // `/hardware-detect-atomic`, `/grub-info`).
        //
        // Correção: `execFile` com `--noprofile --norc` — nenhum
        // arquivo de inicialização é carregado. Combinado com
        // `detached: true` (que isola o grupo de processos para o
        // kill em timeout).
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
        // ============================================================
        // REGISTRA O CHILD EM `_processosAtivos` (v1.5.8 rodada 3)
        // ============================================================
        //
        // `detached: true` isola o filho em seu próprio PGID. O
        // `timeout` do execFile só mata o filho direto — subprocessos
        // (ex.: `dnf check-update` chamado por um script bash) ficam
        // órfãos. O `_matarArvoreProcessos` no SIGINT percorre
        // `_processosAtivos` e mata o GRUPO inteiro
        // (`process.kill(-pid, 'SIGTERM')`). Sem o registro, o
        // `_execReadOnly` ficava de fora do `_encerrarGraciosamente`.
        //
        // `_registrarProcesso` já adiciona o listener `close` para
        // remover do Set — nenhum vazamento. O callback do execFile
        // também é chamado normalmente (os dois listeners coexistem;
        // o `close` do Node dispara para todos).
        if (child) _registrarProcesso(child);
    });
}

// Converte saída KEY=value (uma por linha) em objeto JS.
// Usado pelos comandos que constroem a saída em bash.
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

// ============================================================
// PARSER DO VAINFO (endpoint /vaapi-check)
// ============================================================
//
// `vainfo` imprime, para cada combinação suportada:
//
//   VAProfileH264Main               : VAEntrypointVLD
//   VAProfileH264Main               : VAEntrypointEncSlice
//   VAProfileVP9Profile0            : VAEntrypointVLD
//
// O parser agrupa entrypoints por perfil e calcula dois booleanos:
//   • has_decoding — algum perfil tem VAEntrypointVLD
//   • has_encoding — algum perfil tem VAEntrypointEncSlice/EncSliceLP
//
// Esses dois são suficientes para o frontend mostrar um status
// verde/amarelo/vermelho sem interpretar o resto.
function _parseVainfo(stdout) {
    // ============================================================
    // MENSAGENS EM INGLÊS (v1.5.8 — auditoria C8)
    // ============================================================
    //
    // Antes, os `error` retornados eram strings PT-BR hardcoded.
    // Como o cliente exibe `data.error` como detalhe técnico abaixo
    // do título (que é traduzido), o PT-BR vazava em EN/ES. O
    // painel mostrava:
    //
    //   ❌ Video acceleration is NOT active    (traduzido)
    //   vainfo não encontrado. Instale o pacote libva-utils.  (PT-BR)
    //
    // Inglês como lingua franca para detalhes técnicos é
    // consistente com o resto do código (comentários, logs do
    // server, stack traces) e aceitável em PT-BR — o título do
    // painel + os botões já dão o contexto traduzido.
    if (!stdout) {
        return { ok: false, error: 'vainfo returned no output', profiles: [] };
    }

    // Detecção de "não instalado" (mensagem localizada do bash)
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

// ============================================================
// CHANGELOG DINÂMICO (lê CHANGELOG.md)
// ============================================================
//
// O arquivo CHANGELOG.md na raiz do repo tem seções por versão:
//
//   # Changelog
//
//   ## v1.0.0-09272026
//   - Item A
//   - Item B
//
//   ## v1.0.0-09232026
//   - Item C
//
// O endpoint /changelog recebe a versão atual (FAP_VERSION) e
// devolve {versao, corpo}, onde `corpo` já vem em HTML pronto.
// Cache em memória por 12h — o CHANGELOG.md não muda entre
// releases.

const CHANGELOG_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
let _changelogCache = { versao: null, corpo: null, ts: 0 };

function _escapeHTML(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

function _inlineMd(s) {
    // Escapa primeiro, depois aplica markdown. A ordem importa:
    // se aplicássemos o markdown antes, os `<strong>` gerados
    // seriam escapados na sequência.
    //
    // Sem isso, um CHANGELOG.md com `<script>alert(1)</script>`
    // injetaria HTML/JS arbitrário no FAP via /changelog.
    //
    // Links com esquemas perigosos (javascript:, data:, vbscript:,
    // file:) são rebaixados para texto puro. O CHANGELOG é editado
    // pelo próprio projeto, mas se um dia aceitar PRs externos,
    // isso evita que um link malicioso vire um vetor de XSS.
    var escaped = _escapeHTML(s);
    return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, texto, href) {
        var hrefTrim = String(href).trim();
        // v1.6.2: lista de PERMITIDOS em vez de lista de bloqueados. Os
        // navegadores ignoram tab/quebra de linha dentro do esquema
        // (`java<TAB>script:` executava), o que furava a lista antiga.
        // Só http(s), mailto, âncora (#) e caminho relativo viram link.
        var hrefSemCtl = hrefTrim.replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
        if (!/^(?:https?:|mailto:|#|\/(?!\/))/i.test(hrefSemCtl)) {
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

// ============================================================
// PROGRESSO
// ============================================================

function lerProgresso() {
    try {
        if (fs.existsSync(ARQUIVO_PROGRESSO)) {
            const dados = JSON.parse(fs.readFileSync(ARQUIVO_PROGRESSO, 'utf8'));

            // Formato antigo (array puro) — converte para o formato
            // atual. Nunca existiu sem objeto desde v1.0.0-09282026,
            // mas mantemos a normalização por defesa.
            if (Array.isArray(dados)) {
                return { executados: dados, pulados: [], origem: {} };
            }

            return {
                executados: Array.isArray(dados.executados) ? dados.executados : [],
                                                       pulados: Array.isArray(dados.pulados) ? dados.pulados : [],
                                                       // `origem` é puramente de auditoria — ver comentário em
                                                       // `salvarProgresso`. Pode não existir em arquivos antigos;
                                                       // devolvemos `{}` para simplificar o `POST /progress`.
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
    // Ids "transientes" não devem poluir o .progresso.json:
    //
    //   • `-open`   — abertura de app GUI (gerado por
    //                 `abrirFerramentaExterna`). Não representa um
    //                 estado persistente, só o ato de abrir o app
    //                 nesta sessão.
    //
    //   • `-remove` — remoção de pacote/app via lixeira ou botão
    //                 "desfazer tudo". Também é transiente: o que
    //                 importa é que o comando de INSTALL associado
    //                 seja desmarcado (o frontend faz isso via
    //                 POST /progress). Gravar `-remove` só polui.
    //
    // Sem esse filtro, o arquivo engorda e o contador global de
    // sessões concluídas oscila, porque `_limparIdsOrfaos` (frontend)
    // remove esses ids no próximo boot.
    // Ids transientes que NÃO devem poluir o .progresso.json:
    //   • `open-*`      — abertura de app GUI (novo formato, único
    //                     por clique em `abrirFerramentaExterna`).
    //   • `*-open`      — formato legado, mantido por compat.
    //   • `*-remove`    — remoção via lixeira ou "desfazer tudo".
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

        // Campo `origem` é puramente de AUDITORIA — o FAP NUNCA lê
        // este campo para decidir estado visual. Ele existe apenas
        // para o usuário (ou um desenvolvedor) inspecionar o
        // .progresso.json e ver "o que o FAP instalou" vs "o que já
        // existia antes". A UI continua usando a heurística runtime
        // `appJaInstaladoNoSistema()` (cruza `.progresso.json` com
        // `/system-state`), que é auto-corretiva: se o usuário
        // remove/instala algo por fora, a heurística percebe na
        // próxima consulta — um valor fixo em `origem` não.
        //
        // Formato: objeto `{ idComando: "fap" | "preexistente" }`.
        // Aditivo — `.progresso.json` antigo (sem esse campo)
        // continua sendo lido normalmente.
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

// ============================================================
// LIMPEZA DE LOGS ANTIGOS
// ============================================================
//
// O iniciar_fap.sh cria um /tmp/fap-YYYYMMDD-HHMMSS.log por
// sessão. Sem limpeza, /tmp acumula centenas de arquivos ao
// longo do tempo. Remove os com mais de 7 dias.

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
            } catch (e) { /* ignore */ }
        });
        if (removidos > 0) {
            console.log(`[Cleanup] ${removidos} log(s) antigo(s) removido(s) de /tmp`);
        }
    } catch (e) {
        console.warn('[Cleanup] Falha ao limpar logs antigos:', e.message);
    }
}

// ============================================================
// SSE — LOGS EM TEMPO REAL
// ============================================================

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

// ============================================================
// PROGRESSO DE PACOTES (parser de [N/M] do DNF)
// ============================================================
//
// O DNF imprime "[N/M]" durante transações (verificação, download,
// instalação). Este parser extrai o N e M mais recentes de cada
// chunk e envia um evento SSE do tipo "progress" para o frontend,
// que usa esses números para atualizar a barra de progresso.
//
// Não substitui o log normal — o texto do DNF continua indo pelo
// canal "output". É um evento adicional e paralelo.

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

    // Ancora o `total` na primeira observação. Se o `dnf` emitir
    // outra sequência `[N/M']` com M' diferente (ex.: sub-operação
    // durante `%post`, ou `dnf` concatenado), ignoramos — a barra
    // ficaria presa na operação principal, que é a que o usuário
    // está acompanhando. A âncora é limpa em `POST /executar`
    // (próxima execução começa do zero).
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

// ============================================================
// DETECÇÃO DE DESKTOP E AUTENTICAÇÃO
// ============================================================

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

// ============================================================
// EXECUÇÃO DE COMANDOS (com ou sem autenticação)
// ============================================================

// Flatpak SEMPRE em nível de usuário (--user). Se o remoto "flathub"
// existir no sistema E no usuário, `flatpak install flathub X` pergunta
// qual usar e, sem TTY, aborta com "Nenhum remoto escolhido". Instalar
// como usuário é o padrão recomendado (sem root, sem polkit) e remove
// a ambiguidade. Só reescreve comandos que citam o remoto flathub e que
// não pedem --system/remote-delete/remote-modify explicitamente.
const _FLATHUB_URL_USER = 'https://dl.flathub.org/repo/flathub.flatpakrepo';
function _forcarFlatpakUsuario(cmd) {
    if (typeof cmd !== 'string') return cmd;
    // Só comandos simples: encadeados (&&, ;, |) passam por pkexec/root e
    // nunca devem ser reescritos aqui.
    if (_CARACTERES_ENCADEAMENTO.test(cmd.trim())) return cmd;
    if (!/^\s*(?:sudo\s+)?flatpak\s+(?:install|remote-add)\b/.test(cmd)) return cmd;
    if (/--system\b|--installation=/.test(cmd)) return cmd;
    if (!/\bflathub\b/.test(cmd)) return cmd;
    let out = cmd.replace(/^\s*sudo\s+(?:-\S+\s+)*/, '');
    if (!/--user\b/.test(out)) out = out.replace(/^(\s*flatpak\s+(?:install|remote-add))\b/, '$1 --user');
    return out.replace(/https:\/\/flathub\.org\/repo\/flathub\.flatpakrepo/g, _FLATHUB_URL_USER);
}

// Garante o remoto flathub do USUÁRIO antes de um `flatpak install --user flathub`.
function _garantirFlathubUsuario() {
    try {
        const r = spawnSync('flatpak', ['remotes', '--user', '--columns=name'], { encoding: 'utf8', timeout: 8000 });
        if (r.status === 0 && /^flathub\s*$/m.test(r.stdout || '')) return true;
        const a = spawnSync('flatpak', ['remote-add', '--user', '--if-not-exists', 'flathub', _FLATHUB_URL_USER],
                            { encoding: 'utf8', timeout: 60000 });
        return a.status === 0;
    } catch (e) {
        return false;
    }
}

function executarComandoComStream(comandoFinal, idComando, isReversao, callback) {
    {
        const _antes = comandoFinal;
        comandoFinal = _forcarFlatpakUsuario(comandoFinal);
        if (comandoFinal !== _antes && /^\s*flatpak\s+install\b/.test(comandoFinal)) {
            _garantirFlathubUsuario();
        }
    }
    // Força line-buffering em comandos que tendem a bufferizar
    // stdout quando não há TTY. Sem isso, o `flatpak install`
    // imprime tudo de uma vez no final — o que faz o log parecer
    // "travado" no começo e "explodir" no final.
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

        // Comandos que rodam no contexto do usuário (flatpak,
        // systemctl --user, ferramentas do PipeWire) precisam do
        // bus e runtime corretos. Sem isso, o comando falha
        // silenciosamente ao tentar falar com o serviço do usuário.
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

        // Update/uninstall do FAP: roda como usuário, mas precisa
        // do SUDO_ASKPASS configurado porque o install.sh faz
        // várias chamadas a `sudo` internamente — e o processo
        // do node não tem TTY.
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
            // detached: cria sessão própria (setsid). Isso faz todos
            // os descendentes compartilharem o PGID do bash,
            // permitindo que process.kill(-pid, ...) alcance a
            // árvore inteira no SIGINT.
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
                    // stderr NÃO significa erro. O `dnf`, `flatpak` e
                    // a maioria das ferramentas CLI escrevem logs
                    // informativos (download, progresso, avisos de
                    // GPG, etc.) em stderr por convenção Unix. Marcar
                    // tudo como 'error' pinta o log inteiro de
                    // vermelho mesmo quando tudo deu certo.
                    //
                    // Só o próprio server.js emite 'error' — quando
                    // o comando termina com código != 0 (bloco
                    // abaixo).
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
        // Mesmo motivo do exec acima: garante que o kill alcance
        // os descendentes via PGID.
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
                // Mesmo motivo do bloco anterior: stderr é canal de
                // log, não de erro. O pkexec repassa stdout/stderr do
                // script, e o dnf escreve progresso em stderr. Marcar
                // como 'error' deixava o log inteiro vermelho mesmo em
                // sucesso. Enviamos como 'output'.
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

// ============================================================
// AUTENTICAÇÃO SEGURA (pkexec / fallback kdialog+zenity)
// ============================================================
//
// ============================================================
// NOTA: kdesu DESABILITADO
// ============================================================
//
// O kdesu do Plasma 6 tem dois problemas que o tornam inviável
// para o FAP:
//
//   1. O client `kdesu` NÃO retorna depois que a autenticação
//      tem sucesso — fica pendurado esperando o kdesud daemon
//      mandar um sinal de conclusão que nunca chega. Um `exec`
//      bloqueante trava o server.js por 5 minutos.
//
//   2. O script é executado pelo kdesud num contexto onde o
//      redirecionamento de saída falha silenciosamente — o
//      comando roda (o Terra é instalado, por exemplo), mas
//      nada chega ao arquivo de output.
//
// O pkexec NÃO tem nenhum desses problemas: bloqueia até o
// comando terminar, retorna o exit code correto, e o stdout/stderr
// flui normalmente pelo pipe do processo. No Fedora KDE, o
// `polkit-kde-agent-1` (instalado por padrão) faz o pkexec abrir
// o diálogo nativo do KDE — mesma UX do kdesu, sem os bugs.
//
// Por isso: usamos pkexec sempre. O branch kdesu foi removido.

function _construirScripts(timestamp, random, comandoCorrigido, descricao, idComando) {
    const scriptTemp = `/tmp/fap-cmd-${timestamp}-${random}.sh`;
    const homeDir = HOME_DIR_USUARIO;

    const comandoLimpo = (comandoCorrigido || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

    // ============================================================
    // HOME CONDICIONAL (v1.5.9 — alinhamento com o padrão do Fedora)
    // ============================================================
    //
    // Antes, o script SEMPRE exportava HOME=<home-do-usuário>. Como
    // o `pkexec` roda como root, o `dnf` (via pkexec) escrevia
    // cache em `~/.cache/dnf/` e `~/.cache/libdnf5/` com dono
    // `root` no home do usuário — efeito colateral indesejado.
    //
    // O padrão do Fedora é: `sudo dnf` / `pkexec dnf` usam
    // `HOME=/root` (implícito, herdado do /etc/passwd do root), e
    // o `dnf` usa `/var/cache/dnf/` (system), não o cache do
    // usuário.
    //
    // A v1.5.9 alinha o FAP: o `export HOME=<user>` só acontece
    // quando o `idComando` está em `IDS_COM_HOME_DO_USUARIO` —
    // reservado para scripts EXTERNOS baixados de URL que usam
    // `$HOME` DENTRO do arquivo (o `_substituirCaminhosUsuario`
    // não alcança esses).
    //
    // Comandos inline com `$HOME`/`~` na string (GameMode presets,
    // Rclone Manager `comandoRemocao`, etc.) NÃO precisam do
    // export — o caminho absoluto já está na string do comando.
    //
    // Estado atual: `IDS_COM_HOME_DO_USUARIO` está vazia.
    // `desinstalar-fap` e `atualizar-fap` (que rodam `install.sh`
    // baixado) estão em `IDS_SEM_AUTENTICACAO` — rodam como
    // usuário, nunca via pkexec, então nunca chegam aqui.
    const precisaHomeDoUsuario = IDS_COM_HOME_DO_USUARIO.has(idComando);

    // ============================================================
    // ESTRUTURA DO SCRIPT
    // ============================================================
    //
    // O script NÃO redireciona stdout/stderr para um arquivo. O
    // processo Node (que invoca o pkexec) captura a saída via pipe
    // diretamente — mesma estratégia que sempre funcionou no modo
    // "sem autenticação".
    //
    // Por que não usar arquivo:
    //   • O redirecionamento `>> arquivo` falha com "Permissão
    //     negada" quando o script roda via pkexec no Fedora com
    //     SELinux enforcing — o processo no contexto root não
    //     consegue escrever no arquivo pré-criado pelo usuário
    //     em /tmp.
    //   • O pipe já é o mecanismo usado em todo o resto do FAP,
    //     e funciona consistentemente.
    //   • Sem arquivo, não há corrida entre o comando terminar e
    //     o reader ler a última linha.
    //
    // O `exit $?` no final propaga o código de saída real do
    // comando para o pkexec, que repassa para o Node.

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
                                                       // HOME só é exportado para scripts externos que
                                                       // dependem dele internamente (IDS_COM_HOME_DO_USUARIO).
                                                       // Para o resto, HOME é herdado do pkexec (= /root,
                                                       // padrão do Fedora) — o dnf usa /var/cache/dnf/.
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

    // ============================================================
    // ORDEM CRÍTICA: declara comandoCorrigido ANTES de qualquer uso
    // ============================================================
    //
    // A versão anterior declarava `comandoCorrigido` DEPOIS dos
    // `enviarLog`/`fs.writeFileSync` que o usavam. Como `const`
    // tem TDZ (Temporal Dead Zone), isso disparava
    // `ReferenceError: Cannot access 'comandoCorrigido' before
    // initialization` toda vez que um comando precisava de
    // autenticação — o usuário via "Autenticação cancelada" sem
    // o pkexec nem ser invocado.
    const comandoSemSudo = comandoOriginal.replace(/sudo\s+(?!-)/g, '');
    const comandoCorrigido = _substituirCaminhosUsuario(comandoSemSudo);

    enviarLog(idComando, `🔐 Autenticando para: ${descricao}\n`, 'info');

    // Mostra o script COMPLETO no log antes do pkexec. O usuário precisa
    // ver o que está autorizando — o diálogo nativo do polkit não exibe
    // o conteúdo, apenas o caminho do script.
    enviarLog(idComando, '─── Conteúdo do script que será executado ───\n', 'info');
    enviarLog(idComando, comandoCorrigido + '\n', 'info');
    enviarLog(idComando, '────────────────────────────────────────────\n', 'info');

    // Auditoria em arquivo: se o usuário quiser revisar depois, o
    // histórico fica em /tmp/fap-audit-*.log (removido pela limpeza
    // de logs antigos do server.js).
    try {
        const auditPath = '/tmp/fap-audit-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.log';
        fs.writeFileSync(auditPath, `[${new Date().toISOString()}] ${descricao}\n\n${comandoCorrigido}\n`, { mode: 0o600 });
    } catch (e) { /* auditoria é best-effort */ }

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

        // Limpa o script temp após 60s, caso o `rm -f` no comandoFinal
        // não rode (ex.: usuário cancelou a autenticação).
        setTimeout(() => {
            if (fs.existsSync(scriptTemp)) {
                try { fs.unlinkSync(scriptTemp); } catch (e) {}
            }
        }, 60000);

        // O comando é executado via `executarComandoComStream`, que:
        //   • captura stdout/stderr via pipe em tempo real
        //   • emite eventos SSE para o frontend
        //   • propaga o exit code do pkexec (que é o exit code do script)
        //   • marca sucesso/falha no progresso corretamente
        //
        // É o MESMO mecanismo do modo sem autenticação — sempre
        // funcionou, sem dependência de arquivo intermediário.
        const comandoFinal = `pkexec ${scriptTemp} && rm -f ${scriptTemp} || { rm -f ${scriptTemp}; exit 1; }`;

        executarComandoComStream(comandoFinal, idComando, isReversao, (err, stdout, stderr) => {
            callback(err, stdout, stderr);
        });

        return;
    }

    // Fallback: kdialog/zenity pede a senha, e usamos spawn para
    // passar via stdin. Evita o problema da senha exposta em `ps aux`.
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
            // Mesmo motivo dos outros spawns: matar a árvore inteira
            // no SIGINT via PGID.
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
                // stderr tratado como output. O `sudo` é só o
                // wrapper — o que sai no stderr é o próprio
                // comando, e a convenção Unix manda logs para lá.
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
        // Duas formas de rodar sem auth:
        //   1. Comando read-only (whitelist de prefixo) — `_cmdSemAutenticacao`
        //   2. idComando whitelisted + comando no formato exato — `_idSemAuthValido`
        //
        // A #2 existe só para `atualizar-fap` e `desinstalar-fap`, que
        // são scripts que gerenciam seu próprio `sudo` internamente.
        // Rodar como root (via pkexec) quebraria as permissões do
        // diretório de instalação do usuário.
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

// ============================================================
// SERVIDORES DE ARQUIVOS ESTÁTICOS
// ============================================================

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

        // `Content-Length` é obrigatório para HEAD (RFC 9110: a
        // resposta a HEAD deve ter os mesmos headers que a
        // resposta a GET, sem o body). Também ajuda em GET —
        // o navegador sabe o tamanho antes de baixar.
        let tamanho = 0;
        try {
            tamanho = fs.statSync(fullPath).size;
        } catch (e) { /* mantém 0 em caso de erro */ }

        res.writeHead(200, {
            'Content-Type': mimeType,
            'Content-Length': String(tamanho),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        // HEAD: envia só os headers, sem o body. O cliente
        // (curl -I, navegador, ferramentas de debug) usa os
        // headers pra saber tipo, tamanho, cache, etc., sem
        // baixar o conteúdo. O `res.end()` (sem argumentos)
        // fecha a conexão.
        if (req.method === 'HEAD') {
            res.end();
            return;
        }

        fs.createReadStream(fullPath).pipe(res);
    } else {
        // 404 também respeita HEAD — `res.end('texto')` seria
        // enviado mesmo em HEAD pelo Node.js, então verificamos
        // manualmente.
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
    } catch (e) { /* mantém 0 */ }

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

// ============================================================
// PREVIEW DO GRUB — computa diff servidor-side (?preview=1)
// ============================================================
//
// Parseia /etc/default/grub (já lido pelo handler /grub-info) e
// retorna a lista de mudanças que o botão "Aplicar Recomendada"
// faria. Cada item: { chave, atual (null se ausente), novo }.
//
// A lista de recomendações espelha exatamente o que
// `executarGrubAplicarRecomendado` (frontend) grava no arquivo.
// Se a lista mudar lá, atualizar aqui.

// v1.6.2: o "Aplicar Recomendada" (espelha o cliente: ajustes-manutencao.html) reescreve o /etc/default/grub inteiro.
// Antes, `GRUB_CMDLINE_LINUX` virava SEMPRE `"rhgb quiet"` — isso apagava
// parâmetros de boot que o usuário/instalador colocou ali (`rd.luks.uuid=`
// de disco criptografado, `resume=` de hibernação, `rd.lvm.lv=`,
// `nvidia-drm.modeset=1`, `amdgpu.*`, `intel_iommu=`...), e um sistema
// com LUKS pode não conseguir montar a raiz num kernel instalado depois.
// Agora MANTÉM todos os parâmetros existentes e só garante `rhgb` e
// `quiet`. Se o valor tiver aspas internas, crase, barra invertida ou `$`
// (dentro de aspas duplas), não é seguro reescrever: devolve o original.
function _mesclarCmdlineGrub(valorAtual) {
    var padrao = '"rhgb quiet"';
    if (typeof valorAtual !== 'string' || valorAtual.trim() === '') return padrao;
    var raw = valorAtual.trim();
    var q = '';
    var inner = raw;
    if (raw.length >= 2 && (raw[0] === '"' || raw[0] === "'") && raw[raw.length - 1] === raw[0]) {
        q = raw[0];
        inner = raw.slice(1, -1);
    } else if (/["'`\\$\s]/.test(raw)) {
        return raw;
    }
    if (inner.indexOf(q || '"') !== -1 || /[`\\]/.test(inner) || (q !== "'" && inner.indexOf('$') !== -1)) {
        return raw;
    }
    var tokens = inner.split(/[ \t]+/).filter(Boolean);
    ['rhgb', 'quiet'].forEach(function(t) {
        if (tokens.indexOf(t) === -1) tokens.push(t);
    });
    var aspas = q || '"';
    return aspas + tokens.join(' ') + aspas;
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
        { chave: 'GRUB_CMDLINE_LINUX',      novo: _mesclarCmdlineGrub(atual['GRUB_CMDLINE_LINUX']) },
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

// ============================================================
// SERVIDOR HTTP
// ============================================================

const server = http.createServer((req, res) => {
    // Parse única no topo. `url` vira só o pathname (sem query),
    // e `query` fica disponível para rotas que usam searchParams
    // (como /stream?id=...).
    //
    // Sem isso, "guiado.html?session=sobre-fof" não casa com o
    // `url === '/guiado.html'` e cai no 404.
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

    // v1.6.1 — Defesa contra DNS rebinding: um site externo que
    // resolva o próprio domínio para 127.0.0.1 enviaria
    // `Host: <dominio-do-atacante>` e leria os endpoints GET
    // (/system-info, /progress, /hardware-scan...) como same-origin.
    // Todos os chamadores legítimos (container, install.sh,
    // iniciar_fap.sh) usam localhost ou 127.0.0.1. `Host` vazio
    // (HTTP/1.0) continua aceito, como antes.
    const _hostHeader = String(req.headers.host || '').toLowerCase();
    if (_hostHeader && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(_hostHeader)) {
        console.warn('[FAP] Requisição bloqueada — Host suspeito:', _hostHeader);
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Host não autorizado');
        return;
    }

    // ----------------------------------------------------------
    // SSE — logs em tempo real
    // ----------------------------------------------------------
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

    // ----------------------------------------------------------
    // LOCALES (JSON de tradução)
    // ----------------------------------------------------------
    //
    // v1.5.6: aceita GET e HEAD. O `curl -I` envia HEAD; sem isso,
    // caía no handler de 404 (que retorna `text/plain`).
    if (_aceitaGetOuHead(req) && url.startsWith('/locales/')) {
        // `url` já é pathname-only, então não há query para remover.
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

    // ----------------------------------------------------------
    // /progress — GET (ler), POST (salvar), DELETE (resetar)
    // ----------------------------------------------------------
    //
    // Bloco crítico. Sem ele, o `.progresso.json` do servidor
    // dessincroniza do `progressCache`/localStorage do cliente:
    //
    //   • GET    → getProgress() no boot, _limparIdsOrfaos,
    //              marcarComoExecutado, desmarcarComoExecutado
    //   • POST   → saveProgress (ações da UI)
    //   • DELETE → resetarProgressoFAP (Sessão 13)
    //
    // Sem isso, "Reset progress" não funciona (404), e o arquivo
    // só é atualizado por `salvarProgresso` (server-side, após
    // comando OK) — as remoções via lixeira ficam no localStorage
    // mas não no arquivo.

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
        // CSRF guard — mesma regra de /executar e /shutdown.
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
        // v1.6.1: teto de 1 MB — sem ele, um cliente local podia
        // acumular corpo ilimitado em memória.
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 1048576) { body = ''; req.destroy(); }
        });
        req.on('end', () => {
            try {
                const { executados, pulados } = JSON.parse(body);

                // Filtro de IDs transientes — espelha `salvarProgresso`
                // (defesa em profundidade). Sem isso, `open-*`,
                // `*-open`, `*-remove` e `*-revert` entrariam no
                // `.progresso.json` e o `_limparIdsOrfaos` (frontend)
                // teria que removê-los na próxima passada — churn
                // desnecessário.
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
                // Preserva `origem` — é auditoria, não é resetado.
                // (O cliente não envia `origem` no POST; só o
                // server-side `salvarProgresso` grava esse campo.)

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
        // CSRF guard — mesma regra do POST.
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

    // ----------------------------------------------------------
    // PÁGINAS E ARQUIVOS ESTÁTICOS
    // ----------------------------------------------------------
    //
    // v1.5.6: todos os handlers usam `_aceitaGetOuHead(req)` em vez
    // de `req.method === 'GET'`. O `curl -I` envia HEAD e precisa
    // receber os headers corretos (Content-Type, Content-Length)
    // em vez de cair no 404 genérico com `text/plain`.
    if (_aceitaGetOuHead(req) && (url === '/' || url === '/index.html')) {
        servirArquivoEstatico(req, res, 'index.html');
        return;
    }

    if (_aceitaGetOuHead(req) && url === '/guiado.html') {
        servirArquivoEstatico(req, res, 'guiado.html');
        return;
    }

    // ----------------------------------------------------------
    // SESSÕES — IDs semânticos (sem número)
    // ----------------------------------------------------------
    //
    // O FAP usa IDs semânticos desde a v1.0.0-09282026: os arquivos
    // são 'codecs.html', 'gaming.html', 'sobre-fap.html' etc, sem
    // prefixo numérico. Este regex casa qualquer arquivo .html cujo
    // nome comece com letra minúscula e contenha apenas letras,
    // dígitos e hífen. Também impede path traversal (não aceita
    // '/', '.', nem maiúsculas).
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

    // ----------------------------------------------------------
    // /status — healthcheck + progresso
    // ----------------------------------------------------------
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

    // ----------------------------------------------------------
    // /info — metadados do ambiente
    // ----------------------------------------------------------
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

    // ----------------------------------------------------------
    // /kernel-atual — apenas o kernel em execução
    // ----------------------------------------------------------
    //
    // Endpoint dedicado para o fluxo de remoção de kernel. Antes, o
    // frontend parseava o log compartilhado da sessão para descobrir
    // o kernel atual — frágil, porque outra linha `output` podia se
    // misturar se o usuário clicasse em outro botão ao mesmo tempo.
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

    // ----------------------------------------------------------
    // /kernels — lista de kernels instalados
    // ----------------------------------------------------------
    if (req.method === 'GET' && url === '/kernels') {
        // Paraleliza as duas consultas (o `rpm -q` e o `uname -r` são
        // independentes; o aninhamento do `exec` original era só por
        // conveniência). `Promise.all` reduz o pior caso de ~2×RTT
        // para 1×RTT.
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

    // ----------------------------------------------------------
    // /grub-info — lê /etc/default/grub + detecta resolução + dual boot
    // ----------------------------------------------------------
    //
    // Retorna a configuração atual do GRUB, a resolução detectada
    // (para o GRUB_GFXMODE) e se o sistema tem dual boot (para o
    // GRUB_DISABLE_OS_PROBER). Nada é alterado — é puramente leitura.
    //
    // DETECÇÃO DE RESOLUÇÃO — 4 camadas em ordem de confiabilidade:
    //
    //   1. /sys/class/drm/card*-*/mode  (arquivo singular)
    //      Modo ATUAL do conector. Só existe quando o driver DRM
    //      souber qual modo está setado. Funciona em alguns drivers
    //      (i915 em certos casos, nouveau antigo), falha em outros
    //      (amdgpu + Wayland/KWin, por exemplo).
    //
    //   2. /sys/class/drm/card*-*/modes (arquivo plural)
    //      Lista de TODOS os modos suportados, em ordem de
    //      preferência. O primeiro é o nativo do monitor. Existe
    //      sempre que o conector está "connected" e tem EDID.
    //      ESTA É A CAMADA QUE RESOLVE A MAIORIA DOS CASOS.
    //
    //   3. Parse de EDID cru via /sys/class/drm/card*-*/edid
    //      Fallback para drivers que expõem o EDID mas não a
    //      lista de modos. Extrai a resolução preferida
    //      (Detailed Timing Descriptor 1) do EDID.
    //
    //      IMPORTANTE — offsets corretos do EDID (spec VESA 1.4,
    //      seção 3.10.2 "Detailed Timing Descriptor"):
    //        byte 54-55  = pixel clock (LSB, MSB)
    //        byte 56     = H active, LSB (bits 0-7)
    //        byte 57     = H blank, LSB
    //        byte 58     = H active (bits 8-11) no nibble ALTO
    //                      + H blank (bits 8-11) no nibble BAIXO
    //        byte 59     = V active, LSB
    //        byte 60     = V blank, LSB
    //        byte 61     = V active (bits 8-11) no nibble ALTO
    //                      + V blank (bits 8-11) no nibble BAIXO
    //
    //      A versão anterior deste script lia bytes 54/55 como se
    //      fossem H active — mas esses bytes são pixel clock.
    //      Também lia 58/59 como V active, quando 58 é H active
    //      (nibble alto) e 59 é V active (LSB). O resultado era
    //      um valor errado, que só aparecia quando as camadas 1
    //      e 2 falhavam (raro, mas acontecia em GPUs exóticas).
    //
    //   4. 1024x768 — fallback final.
    //
    // Em todas as camadas, preferimos conectores com status
    // "connected" para evitar pegar a resolução de uma saída
    // sem monitor.
    if (req.method === 'GET' && url === '/grub-info') {
        const script = [
            // Lê /etc/default/grub (world-readable por padrão)
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

            // Conteúdo do /etc/default/grub
            var match = stdout.match(/---GRUB_FILE_START---\n([\s\S]*?)\n---GRUB_FILE_END---/);
            if (match) {
                info.grubContent = match[1];
            } else if (stdout.indexOf('GRUB_FILE_ERROR=unreadable') !== -1) {
                info.grubReadable = false;
            }

            // Resolução — o script já resolve a hierarquia das 3 camadas
            // + fallback, e imprime sempre "DETECTED_RES=WxH".
            var resMatch = stdout.match(/DETECTED_RES=(\d+x\d+)/);
            if (resMatch) info.detectedRes = resMatch[1];

            // Qual camada respondeu (útil para debug no console)
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

            // ?preview=1 — computa diff entre config atual e a
            // recomendada, no servidor. O frontend só renderiza.
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

    // ----------------------------------------------------------
    // /hardware-detect-atomic — detecta Fedora Atomic/Silverblue
    // ----------------------------------------------------------
    //
    // Retorna JSON em vez de forçar o frontend a parsear stdout
    // de um script bash. Lógica idêntica à que estava em
    // estado-fedora.html (verificarAtomic), mas servidor-side.
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

    // ----------------------------------------------------------
    // /check-package — verifica se um pacote rpm está instalado
    // ----------------------------------------------------------
    //
    // Usado pelo frontend para decidir se um app nativo de
    // desktop (gnome-connections, krdc) já está presente no
    // sistema. Se estiver, o FAP esconde o botão de instalar
    // e mostra o "Abrir" direto.
    //
    // Validação do nome do pacote: só aceita letras, números,
    // ponto, hífen e underscore. Isso é suficiente para nomes
    // rpm válidos e bloqueia qualquer tentativa de injeção via
    // query string.
    if (req.method === 'GET' && url === '/check-package') {
        var pkg = query.get('pkg');
        if (!pkg || !/^[a-zA-Z0-9._-]+$/.test(pkg)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'pkg inválido' }));
            return;
        }
        // Usa o padrão `exit=$?` para inspecionar o código de saída do
        // `rpm -q` — em vez de tentar inferir pelo stdout (o
        // `_execReadOnly` não propaga `error`). `rpm -q` retorna 0 se
        // instalado, != 0 caso contrário (seja "not installed",
        // "não instalado" ou DB lock). É locale-independente.
        //
        // `pkg` foi validado por `/^[a-zA-Z0-9._-]+$/` logo acima —
        // sem shell metacharacters. `rpm -q ` + pkg é seguro.
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

    // ----------------------------------------------------------
    // /check-package-available — instalado OU disponível em repo?
    // ----------------------------------------------------------
    //
    // Diferente de `/check-package` (que só diz "instalado sim/não"),
    // este endpoint diz "instalado / disponível / não disponível".
    // Usado pelo `executarNvidiaDriver` para decidir se
    // `akmod-nvidia-open` (Blackwell) ou `akmod-nvidia-580xx`
    // (Maxwell/Pascal) existem no RPM Fusion ANTES de tentar
    // instalar — caso contrário, o `dnf install` falha com
    // "package not found" e deixa o sistema em estado ambíguo.
    //
    // ============================================================
    // TRÊS PROBLEMAS EMPILHADOS (corrigidos na v1.5.1)
    // ============================================================
    //
    //   1. DNF5 removeu `--all` do subcomando `list`. O comando
    //      `dnf list --all --quiet <pkg>` erra imediatamente
    //      ("Argumento desconhecido --all para o comando list"),
    //      stdout vazio, e o `grep` nunca casa. O endpoint
    //      retornava `not_available` para QUALQUER pacote, mesmo
    //      os presentes nos repos ativos. Bloqueava a instalação
    //      do driver NVIDIA em TODAS as gerações.
    //
    //   2. Pacotes NVIDIA vivem no sub-repositório
    //      `rpmfusion-nonfree-nvidia-driver` (caminho
    //      `nonfree/fedora/nvidia-driver/<ver>/x86_64/`), que
    //      o RPM Fusion instala com `enabled=0` por padrão no
    //      Fedora 44/45. Nenhum comando do dnf o encontra sem
    //      `--enablerepo` explícito.
    //
    //   3. `--enablerepo` com LISTA de repos (`a,b,c`) aborta se
    //      QUALQUER repo da lista não existir ("Nenhum repositório
    //      correspondente para X"). O `rpmfusion-nonfree-tainted`
    //      não vem na instalação padrão. Iterar um por um com
    //      `|| true` cobre isso.
    //
    // Correção em 4 camadas (rápido → robusto → lento):
    //
    //   1. `rpm -q` — instalado? (instantâneo, sem repo access)
    //   2. `dnf repoquery --available --quiet` — disponível nos
    //      repos JÁ habilitados? Comando canônico do DNF5,
    //      retorna um NEVRA por linha, sem cabeçalho, sem cor.
    //      `head -1` limita a saída.
    //   3. Loop de `--enablerepo` individual nos sub-repos NVIDIA
    //      (otimista: o `executarNvidiaDriver` vai habilitá-los
    //      durante o install, então a checagem deve ver o pacote).
    //   4. `dnf --cacheonly list --available` — fallback final
    //      sem rede, para o caso do `repoquery` falhar. O grep
    //      cobre `pkg` e `pkg.arch` com regex ancorada, sem casar
    //      `pkg-plus` como falso positivo.
    //
    // Timeout 60s (era 15s): `repoquery --available` em cache
    // frio com RPM Fusion pode levar 30–45s. O `_execReadOnly`
    // mata o GRUPO inteiro em timeout (detached: true), então não
    // há risco de deixar `dnf` órfão segurando o lock do RPM.
    if (req.method === 'GET' && url === '/check-package-available') {
        var pkgCheck = query.get('pkg');
        if (!pkgCheck || !/^[a-zA-Z0-9._-]+$/.test(pkgCheck)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'pkg inválido' }));
            return;
        }

        var pkgEsc = pkgCheck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        var scriptAvail =
        // --- 1. Instalado? ---
        'if rpm -q "' + pkgCheck + '" >/dev/null 2>&1; then ' +
        '  echo "status=installed"; exit 0; ' +
        'fi; ' +

        // --- 2. repoquery nos repos habilitados ---
        'AVAIL=$(dnf repoquery --available --quiet "' + pkgCheck + '" 2>/dev/null | head -1); ' +
        'if [ -n "$AVAIL" ]; then ' +
        '  echo "status=available"; exit 0; ' +
        'fi; ' +

        // --- 3. Loop de --enablerepo individual ---
        // Cada repo é consultado SEPARADAMENTE. Se o repo não
        // existir (ex.: `-tainted` sem o pacote -release-tainted),
        // o dnf falha naquele repo e o loop continua.
        'for repo_nv in ' +
        '  "rpmfusion-nonfree-nvidia-driver" ' +
        '  "rpmfusion-nonfree" ' +
        '  "rpmfusion-nonfree-tainted"; do ' +
        '  AVAIL2=$(dnf --enablerepo="$repo_nv" repoquery --available --quiet "' + pkgCheck + '" 2>/dev/null | head -1); ' +
        '  if [ -n "$AVAIL2" ]; then ' +
        '    echo "status=available"; exit 0; ' +
        '  fi; ' +
        'done; ' +

        // --- 4. Fallback: cache-only list (sem --all, sem --quiet) ---
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

    // ----------------------------------------------------------
    // /flatpak-installed — lista de app-ids Flatpak instalados
    // ----------------------------------------------------------
    //
    // Usado pelo script.js para detectar Flatpaks que foram
    // removidos fora do FAP (via GNOME Software, linha de
    // comando, ou outro gerenciador) e restaurar o botão
    // original para o usuário reinstalar.
    //
    // `--app` filtra só aplicativos (não runtimes).
    // `--columns=application` retorna apenas os app-ids, uma por
    // linha, sem cabeçalho — formato ideal para comparação.
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

    // ----------------------------------------------------------
    // /apps-sobre — textos do popup "Sobre o software" (quadrado "!")
    // ----------------------------------------------------------
    //
    // `apps_sobre.json` traz, por id de instalação, o que é o software,
    // para que serve, quem o desenvolve e o site oficial (PT/EN/ES),
    // escritos a partir do Flathub, do site/repositório oficial do
    // projeto ou da página do pacote no Fedora/RPM Fusion. Arquivo
    // estático lido em runtime (como o hardware_map.json).
    if (req.method === 'GET' && url === '/apps-sobre') {
        fs.readFile(path.join(__dirname, 'apps_sobre.json'), 'utf8', function(err, txt) {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ apps: {} }));
                return;
            }
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache'
            });
            res.end(txt);
        });
        return;
    }

    // ----------------------------------------------------------
    // /flatpak-diagnostico — Flatpaks em nível de SISTEMA (root)
    // ----------------------------------------------------------
    //
    // O FAP instala Flatpaks sempre com --user. Flatpaks antigos
    // instalados no sistema (root) deixam o remoto "flathub" duplicado
    // e fazem `flatpak install flathub X` perguntar qual usar. Este
    // endpoint lista o que existe em cada nível para a UI mostrar o
    // aviso e oferecer a limpeza. Somente leitura.
    if (req.method === 'GET' && url === '/flatpak-diagnostico') {
        Promise.all([
            _execReadOnly('flatpak list --system --app --columns=application,name 2>/dev/null', 8000),
            _execReadOnly('flatpak list --user --app --columns=application 2>/dev/null', 8000),
            _execReadOnly('flatpak remotes --system --columns=name 2>/dev/null', 5000),
            _execReadOnly('flatpak remotes --user --columns=name 2>/dev/null', 5000)
        ]).then(function(r) {
            const linhas = function(t) { return (t || '').split('\n').map(function(l) { return l.trim(); }).filter(Boolean); };
            const idValido = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
            const sistema = linhas(r[0]).map(function(l) {
                const partes = l.split('\t');
                return { id: (partes[0] || '').trim(), nome: (partes[1] || partes[0] || '').trim() };
            }).filter(function(a) { return idValido.test(a.id); });
            const usuario = linhas(r[1]).filter(function(i) { return idValido.test(i); });
            const remSistema = linhas(r[2]);
            const remUsuario = linhas(r[3]);
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(JSON.stringify({
                sistema: sistema,
                usuario: usuario,
                remotosSistema: remSistema,
                remotosUsuario: remUsuario,
                conflitoFlathub: remSistema.indexOf('flathub') !== -1 && remUsuario.indexOf('flathub') !== -1
            }));
        });
        return;
    }

    // ----------------------------------------------------------
    // /rustdesk-selinux-check — conta AVCs do RustDesk nas últimas 24h
    // ----------------------------------------------------------
    //
    // Read-only, sem auth. Usado pelo badge de exclamação do
    // RustDesk (Sessão 6 → Acesso Remoto). Conta linhas
    // `avc: denied` do journal que mencionem `rustdesk` no comm
    // ou no path. `journalctl -g` (grep no journal) é a forma
    // canônica e respeita permissões do usuário (o Fedora
    // Workstation coloca o usuário no grupo `systemd-journal`,
    // que lê o journal do sistema sem sudo).
    //
    // `wc -l` sem `-c` conta linhas. O `2>/dev/null` no
    // `journalctl` cobre "No journal files were found" (raro,
    // mas possível em containers).
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

    // ----------------------------------------------------------
    // /system-state — estado atual do Fedora do usuário
    // ----------------------------------------------------------
    //
    // Devolve o estado REAL do sistema (repositórios ativos,
    // pacotes instalados, etc.), independente do que o FAP já
    // instalou. Usado pelo frontend no boot para atualizar os
    // botões de repositório (Fase 1) e, futuramente, de apps e
    // de itens de sistema.
    //
    // Read-only, sem autenticação. Cache de 5min em memória.
    if (req.method === 'GET' && url === '/system-state') {
        // `?refresh=1` invalida o cache do server. Usado pelo
        // frontend quando detecta `flatpaks_installed` vazio com
        // Flathub ativo (timing: server consultou `/system-state`
        // antes do `flatpak list` terminar no boot).
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

    // ----------------------------------------------------------
    // /hardware-scan — detecção de hardware e sugestão de drivers
    // ----------------------------------------------------------
    //
    // Roda lspci, lsusb e rpm -q, cruza com hardware_map.json e
    // devolve a lista de dispositivos detectados com estado de
    // driver. Nada é instalado — é puramente read-only.
    //
    // Também devolve o estado dos repositórios (RPM Fusion) e do
    // Secure Boot, para o frontend montar avisos contextuais.
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

    // ----------------------------------------------------------
    // /vaapi-check — verifica aceleração de vídeo (VA-API)
    // ----------------------------------------------------------
    //
    // Roda `vainfo` e devolve JSON estruturado com os perfis
    // suportados. Usado pelos botões "Verificar Aceleração" da
    // sessão Hardware (AMD, Intel, NVIDIA). Read-only, sem auth.
    //
    // Para NVIDIA, seta `LIBVA_DRIVER_NAME=nvidia` e `NVD_BACKEND=direct` — o driver
    // proprietário expõe VDPAU nativamente, e o `nvidia-vaapi-driver`
    // é um wrapper que o libva encontra por esse nome. AMD/Intel
    // usam o auto-detect normal do libva.
    if (req.method === 'GET' && url === '/vaapi-check') {
        var vendorCheck = (query.get('vendor') || '').toLowerCase();
        if (['amd', 'intel', 'nvidia'].indexOf(vendorCheck) === -1) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'vendor inválido (use amd, intel ou nvidia)' }));
            return;
        }

        // v1.6.2: o botão "Configurar Variáveis" da NVIDIA grava
        // `LIBVA_DRIVER_NAME=nvidia` em `environment.d`, que o servidor
        // herda após o próximo login. Sem limpar, o "Verificar" de AMD e
        // Intel testaria o driver da NVIDIA e reportaria erro (ou sucesso
        // falso) em notebooks híbridos. Para a NVIDIA, `NVD_BACKEND=direct`
        // também é necessário — é o mesmo valor que o arquivo
        // `99-fap-nvidia-vaapi.conf` grava; sem ele o teste não reflete o
        // que os aplicativos veem.
        var cmdCheck = vendorCheck === 'nvidia'
        ? 'env LIBVA_DRIVER_NAME=nvidia NVD_BACKEND=direct vainfo 2>&1'
        : 'env -u LIBVA_DRIVER_NAME -u NVD_BACKEND vainfo 2>&1';

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

    // ----------------------------------------------------------
    // /system-info — painel de diagnóstico
    // ----------------------------------------------------------
    //
    // Campos de otimização (ksm_*, tcp_congestion, max_map_count,
    // pipewire_quantum) usam fallback independente — se o sensor
    // ou o comando não existir no sistema (KSM não compilado,
    // PipeWire não instalado, etc.), o campo retorna um valor
    // neutro e o painel continua funcional.
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

    // ----------------------------------------------------------
    // /top-processes — top 5 por CPU e por RAM
    // ----------------------------------------------------------
    if (req.method === 'GET' && url === '/top-processes') {
        const scriptRam = `ps -eo pmem,rss,comm --sort=-rss --no-headers 2>/dev/null | head -5`;

        Promise.all([
            _amostrarCpuProcessos(500),
            _execReadOnly(scriptRam, 4000)
        ]).then(function(resultados) {
            const cpu = resultados[0] || [];
            const ramOut = resultados[1] || '';

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

    // ----------------------------------------------------------
    // /disk-usage — partições montadas
    // ----------------------------------------------------------
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

    // ----------------------------------------------------------
    // /journal-errors — erros agrupados das últimas 24h
    // ----------------------------------------------------------
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

    // ----------------------------------------------------------
    // /changelog — changelog da versão atual (parseado do CHANGELOG.md)
    // ----------------------------------------------------------
    if (req.method === 'GET' && url === '/changelog') {
        var resultado = _lerChangelogVersao(FAP_VERSION);
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(JSON.stringify(resultado));
        return;
    }

    // ----------------------------------------------------------
    // /executar — executa comando (POST)
    // ----------------------------------------------------------
    //
    // IMPORTANTE: TODA a lógica (validação do body, rate limit,
    // despacho) roda DENTRO do req.on('end'). Só assim `comando` e
    // `idComando` estão definidos. Colocar `_podeExecutar(idComando)`
    // ou `procederComExecucao(...)` fora do callback fazia o Node
    // lançar ReferenceError (idComando não declarado no escopo do
    // handler) antes do body chegar — o processo morria e o cliente
    // via "Erro de conexão".
    if (req.method === 'POST' && url === '/executar') {
        let body = '';
        // v1.6.1: teto de 1 MB (ver /progress).
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 1048576) { body = ''; req.destroy(); }
        });
        req.on('end', () => {
            // CSRF guard: `/executar` NÃO valida Content-Type (aceita
            // qualquer body), então um site malicioso pode fazer
            // `fetch('http://localhost:3000/executar', { method:
            // 'POST', mode: 'no-cors', body: JSON.stringify({...}) })`
            // e disparar comandos sem interação do usuário.
            //
            // Mesma regra do /shutdown: Origin vazia (curl do
            // install.sh --uninstall, único consumidor legítimo
            // programático) OU Origin same-origin (o próprio FAP).
            // Navegador de aba maliciosa envia Origin de outro host
            // → bloqueado.
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

                // `isReversao` sempre foi `false` no fluxo HTTP. Toda a
                // marcação de "revertido" é feita pelo frontend via
                // POST /progress (removendo o id do array de
                // executados). O parâmetro continua existindo como
                // contrato interno de `executarComandoComStream` (que
                // o usa para decidir entre salvar e remover progresso
                // quando rodado internamente), mas o handler HTTP não
                // o expõe.
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

                // Descarta o buffer de execuções anteriores do mesmo
                // idComando. Sem isso, um novo cliente SSE recebia o
                // replay da rodada anterior antes dos logs da nova.
                sseBuffers.delete(idComando);
                // Limpa a âncora de progresso: a próxima execução
                // começa do zero, e o primeiro `[N/M']` define o
                // total correto (ver `_detectarProgressoPacotes`).
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

    // ----------------------------------------------------------
    // /shutdown — encerra o FAP graciosamente após desinstalação
    // ----------------------------------------------------------
    //
    // Chamado pelo `install.sh --uninstall` (via `curl`) depois
    // de remover os arquivos. A ordem é:
    //
    //   1. install.sh remove arquivos (server.js, sessões, etc.)
    //   2. install.sh faz `curl -X POST /shutdown`
    //   3. server.js mata o fap-container (janela fecha)
    //   4. iniciar_fap.sh percebe o container fechado, mata o node
    //   5. O terminal fecha
    //
    // Sem isso, o node e o container ficam "zumbis" até o usuário
    // fechar a janela manualmente.
    if (req.method === 'POST' && url === '/shutdown') {
        // CSRF guard: só aceita requests SEM Origin (curl do
        // install.sh --uninstall, que é o único consumidor
        // legítimo) ou COM Origin do próprio FAP. Navegador de
        // aba maliciosa envia Origin de outro host → bloqueado.
        // /executar e /progress têm a mesma checagem de Origin
        // própria (v1.6.1: comentário corrigido — o /executar NÃO
        // depende de Content-Type/preflight; a defesa é o Origin).
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

        // Mata o container primeiro (janela fecha). Depois o
        // _encerrarGraciosamente mata as árvores de processos e
        // fecha SSEs. Não usamos `pkill -f fap-container` sem
        // qualificação para não matar containers de outros projetos.
        try {
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

        // Aguarda o container fechar antes de sair (o
        // iniciar_fap.sh precisa ver o container fechado para
        // matar o node e fechar o terminal).
        setTimeout(function() {
            _encerrarGraciosamente('SHUTDOWN');
        }, 500);

        return;
    }

    // ----------------------------------------------------------
    // 404
    // ----------------------------------------------------------
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Página não encontrada');
});

// ============================================================
// EVENTOS DO SERVIDOR
// ============================================================

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`[ERRO]: A porta ${PORT} já está em uso.`);
        console.error(` Execute: kill -9 $(lsof -t -i:${PORT})`);
    } else {
        console.error('[Erro do servidor]:', e.message);
    }
});

// ============================================================
// ENCERRAMENTO GRACIOSO (SIGINT + SIGTERM)
// ============================================================
//
// O servidor precisa responder aos dois sinais:
//
//   • SIGINT  — Ctrl+C no terminal onde o FAP foi iniciado
//   • SIGTERM — `kill` enviado pelo cleanup() do iniciar_fap.sh
//               quando o usuário fecha a janela do container
//
// Em ambos os casos, a ação é a MESMA: matar as árvores de
// processos filho (para não deixar `dnf install` órfão segurando
// o lock do rpm), fechar as conexões SSE, e sair.

let _encerrando = false;

function _encerrarGraciosamente(sinal) {
    // Guarda contra múltiplos sinais (SIGINT seguido de SIGTERM,
    // por exemplo). Só a primeira chamada executa.
    if (_encerrando) return;
    _encerrando = true;

    console.log(`\n🛑 Encerrando servidor (${sinal})...`);

    // Mata a árvore de cada processo filho (grupo inteiro, não só
    // o bash pai). Sem isso, o `dnf upgrade` continua rodando como
    // órfão depois que o servidor morre.
    _processosAtivos.forEach(_matarArvoreProcessos);

    // Limpa o askpass helper, se foi criado nesta sessão.
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

    // Rede de segurança: se o server.close() não resolver em 3s
    // (conexões penduradas, handles abertos), força a saída. Sem
    // isso, o node poderia travar esperando conexões SSE que não
    // fecharam.
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
