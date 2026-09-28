/**
 * Fedora Only Fans (FOF) - Script Compartilhado
 *
 * Este arquivo contém as funções GLOBAIS compartilhadas entre todas as sessões.
 * Cada sessão (NN-*.html) tem seu próprio JS específico que usa estas funções.
 *
 * i18n: strings visíveis ao usuário usam tOr(chave, fallback) — em pt-BR,
 * tOr cai no fallback (texto original), mantendo o comportamento
 * idêntico ao anterior. Em en/es, retorna a string traduzida do JSON.
 *
 * LOG ÚNICO POR SESSÃO: sessões com múltiplos botões compartilham um único
 * logBox. O botão carrega data-logbox="<id-do-log>" para indicar onde
 * escrever. Sessões com 1 botão continuam usando log-<idComando>.
 *
 * LOG EXPANDIDO POR PADRÃO: ao contrário de versões anteriores, o log de
 * cada sessão já nasce expandido. O usuário pode clicar no toggle para
 * recolher (o clique remove a classe 'expandido').
 *
 * VERIFICAÇÃO DE ATUALIZAÇÕES: no boot, o FOF consulta a API do GitHub
 * para saber se há uma versão mais recente publicada. Se houver, um
 * badge "⬆️" aparece ao lado do número da versão. Cache de 12h.
 *
 * VERIFICAÇÃO DE FLATPAKS REMOVIDOS: no boot e a cada sessão carregada,
 * o FOF consulta /flatpak-installed e desmarca qualquer comando que
 * tenha sido marcado como executado mas cujo Flatpak não esteja mais
 * instalado (o usuário removeu via GNOME Software, linha de comando,
 * etc.). O botão volta ao estado original para reinstalar.
 *
 * TEMA: claro/escuro alternável via botão na UI. Persistência em localStorage
 * sob a chave 'fof_tema'.
 */

// ============================================================
// CONSTANTES E CONFIGURAÇÕES
// ============================================================

var API_URL = (function() {
    try {
        var origin = window.location && window.location.origin;
        if (origin && origin !== 'null' && origin.indexOf('file://') !== 0) {
            return origin;
        }
    } catch (e) { /* ignore */ }
    return 'http://localhost:3000';
})();

var STORAGE_KEY = 'fof_progress';

let FOF_VERSION = '';

window.FOF_VERSION_UI18N = '';

async function carregarVersaoServidor() {
    try {
        const response = await fetch(API_URL + '/info');
        if (response.ok) {
            const data = await response.json();
            FOF_VERSION = data.version || FOF_VERSION;
            window.FOF_VERSION_UI18N = FOF_VERSION;
        }
    } catch (e) {
        console.warn('[Versão] Não foi possível consultar /info:', e.message);
    }
    document.querySelectorAll('.fof-version').forEach(function(el) {
        el.textContent = FOF_VERSION || '?';
    });

    if (typeof I18N !== 'undefined' && typeof I18N.aplicarTraducoes === 'function') {
        var badges = document.querySelectorAll('[data-i18n-html="index.badge_versao"]');
        if (badges.length > 0) {
            I18N.aplicarTraducoes();
        }
    }

    console.log('🚀 Fedora Only Fans v' + (FOF_VERSION || '?') + ' - Script compartilhado carregado!');
}

// ============================================================
// VERIFICAÇÃO DE ATUALIZAÇÕES (GitHub Releases API)
// ============================================================

var GITHUB_REPO = 'vitaotek/Fedora-Only-Fans';
var ULTIMA_VERIFICACAO_KEY = 'fof_ultima_verificacao';
var VERSAO_REMOTA_KEY = 'fof_versao_remota';
var TTL_VERIFICACAO_MS = 12 * 60 * 60 * 1000; // 12 horas

async function verificarAtualizacoes() {
    var agora = Date.now();
    var ultima = 0;
    try {
        ultima = parseInt(localStorage.getItem(ULTIMA_VERIFICACAO_KEY) || '0', 10) || 0;
    } catch (e) {
        ultima = 0;
    }

    if (agora - ultima < TTL_VERIFICACAO_MS) {
        try {
            var cache = localStorage.getItem(VERSAO_REMOTA_KEY);
            if (cache) return cache;
        } catch (e) { /* ignore */ }
        return null;
    }

    try {
        var resp = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/releases/latest');
        if (!resp.ok) {
            console.warn('[Atualização] GitHub retornou HTTP', resp.status);
            return null;
        }
        var data = await resp.json();
        var tagRemota = data.tag_name || '';

        try {
            localStorage.setItem(ULTIMA_VERIFICACAO_KEY, String(agora));
            localStorage.setItem(VERSAO_REMOTA_KEY, tagRemota);
        } catch (e) { /* ignore */ }

        return tagRemota;
    } catch (e) {
        console.warn('[Atualização] Não foi possível verificar:', e.message);
        return null;
    }
}

async function verificarAtualizacoesForcado() {
    try {
        var url = 'https://api.github.com/repos/' + GITHUB_REPO +
        '/releases/latest?_=' + Date.now();
        var resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) return null;
        var data = await resp.json();
        var tag = data.tag_name || '';
        try {
            localStorage.setItem(ULTIMA_VERIFICACAO_KEY, String(Date.now()));
            localStorage.setItem(VERSAO_REMOTA_KEY, tag);
        } catch (e) { /* ignore */ }
        return tag;
    } catch (e) {
        return null;
    }
}

function temAtualizacao(versaoLocal, versaoRemota) {
    var local = (versaoLocal || '').replace(/^[vV]/, '').trim();
    var remota = (versaoRemota || '').replace(/^[vV]/, '').trim();
    if (!local || !remota) return false;
    if (local === '?' || remota === '?') return false;
    return remota > local;
}

async function mostrarBadgeSeHouverAtualizacao() {
    var versaoRemota = await verificarAtualizacoes();
    if (!versaoRemota) return;

    var versaoLocal = FOF_VERSION || '?';
    if (!temAtualizacao(versaoLocal, versaoRemota)) return;

    var versaoRemotaFresca = await verificarAtualizacoesForcado();
    if (!versaoRemotaFresca || !temAtualizacao(versaoLocal, versaoRemotaFresca)) {
        try {
            localStorage.removeItem(ULTIMA_VERIFICACAO_KEY);
            localStorage.removeItem(VERSAO_REMOTA_KEY);
        } catch (e) { /* ignore */ }
        console.log('[Atualização] Cache obsoleto invalidado após verificação fresca.');
        return;
    }

    document.querySelectorAll('.fof-version').forEach(function(el) {
        var parent = el.parentElement;
        if (!parent) return;
        if (parent.querySelector('.badge-atualizacao')) return;

        var badge = document.createElement('a');
        badge.className = 'badge-atualizacao';
        badge.href = 'manutencao.html';
        badge.setAttribute('data-i18n-title', 'comum.atualizacao_disponivel_titulo');
        badge.setAttribute('data-i18n-aria-label', 'comum.atualizacao_disponivel_titulo');
        badge.title = _t('comum.atualizacao_disponivel_titulo', 'Nova versão disponível! Clique para atualizar.');
        badge.setAttribute('aria-label', badge.title);
        badge.textContent = '⬆️';

        parent.insertBefore(badge, el.nextSibling);
    });

    console.log('⬆️ Atualização disponível: ' + versaoLocal + ' → ' + versaoRemota);
}

// ============================================================
// i18n HELPER LOCAL
// ============================================================
function _t(chave, fallback) {
    return (typeof tOr === 'function') ? tOr(chave, fallback) : fallback;
}
function _tVars(chave, fallback, vars) {
    return (typeof tOr === 'function') ? tOr(chave, fallback, vars) : fallback;
}

function _textoOriginalTraduzido(btn) {
    if (!btn) return '';
    const chave = btn.getAttribute('data-i18n');
    const fallback = btn.getAttribute('data-texto-original') || btn.textContent || '';
    if (chave) {
        return _t(chave, fallback);
    }
    return fallback;
}

// ============================================================
// TEMA CLARO / ESCURO
// ============================================================

var TEMA_STORAGE_KEY = 'fof_tema';

(function _aplicarTemaInicial() {
    try {
        var salvo = localStorage.getItem(TEMA_STORAGE_KEY) || 'escuro';
        document.documentElement.setAttribute('data-tema', salvo === 'claro' ? 'claro' : 'escuro');
    } catch (e) {
        document.documentElement.setAttribute('data-tema', 'escuro');
    }
})();

function _temaAtual() {
    return document.documentElement.getAttribute('data-tema') || 'escuro';
}

function _aplicarTema(tema) {
    if (tema !== 'claro' && tema !== 'escuro') tema = 'escuro';
    document.documentElement.setAttribute('data-tema', tema);
    try { localStorage.setItem(TEMA_STORAGE_KEY, tema); } catch (e) { /* ignore */ }
    atualizarBotaoTema();
}

function alternarTema() {
    _aplicarTema(_temaAtual() === 'claro' ? 'escuro' : 'claro');
}

function atualizarBotaoTema() {
    var btn = document.getElementById('btn-toggle-tema');
    if (!btn) return;
    var atual = _temaAtual();
    btn.textContent = atual === 'claro' ? '🌙' : '☀️';
    var chave = atual === 'claro' ? 'comum.tema_para_escuro' : 'comum.tema_para_claro';
    var fallback = atual === 'claro' ? 'Mudar para tema escuro' : 'Mudar para tema claro';
    var txt = _t(chave, fallback);
    btn.title = txt;
    btn.setAttribute('aria-label', txt);
}

function criarBotaoTema() {
    var containers = document.querySelectorAll('.tema-toggle-container');
    for (var i = 0; i < containers.length; i++) {
        var c = containers[i];
        if (c.querySelector('.btn-tema')) continue;
        var btn = document.createElement('button');
        btn.className = 'btn-tema';
        btn.id = 'btn-toggle-tema';
        btn.type = 'button';
        btn.addEventListener('click', alternarTema);
        c.appendChild(btn);
    }
    atualizarBotaoTema();
}

// ============================================================
// TOASTS + NOTIFICAÇÕES NATIVAS
// ============================================================

function _garantirContainerToast() {
    var c = document.getElementById('fof-toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'fof-toast-container';
        c.className = 'fof-toast-container';
        document.body.appendChild(c);
    }
    return c;
}

function mostrarToast(mensagem, tipo, duracaoMs) {
    var c = _garantirContainerToast();
    var t = document.createElement('div');
    t.className = 'fof-toast ' + (tipo || 'info');
    t.textContent = mensagem;
    c.appendChild(t);
    setTimeout(function() {
        t.classList.add('removendo');
        setTimeout(function() { t.remove(); }, 300);
    }, duracaoMs || 5000);
}

function notificarNativo(titulo, corpo) {
    if (typeof Notification === 'undefined') return;
    var opts = { body: corpo };
    try {
        if (Notification.permission === 'granted') {
            new Notification(titulo, opts);
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(function(p) {
                if (p === 'granted') {
                    try { new Notification(titulo, opts); } catch (e) {}
                }
            });
        }
    } catch (e) { /* WebKitGTK pode não suportar; ignora */ }
}

// ============================================================
// BARRA DE PROGRESSO GLOBAL
// ============================================================

function _atualizarProgressoGlobal() {
    var el = document.getElementById('progresso-global');
    if (!el) return;
    var total = SESSOES_PRINCIPAIS.length;
    var concluidas = 0;
    for (var i = 0; i < SESSOES_PRINCIPAIS.length; i++) {
        if (getStatusSessao(SESSOES_PRINCIPAIS[i]) === 'executado') concluidas++;
    }
    el.innerHTML = '<span class="numero">' + concluidas + '</span>/' + total;
    el.title = concluidas + ' de ' + total + ' sessões concluídas';
}

// ============================================================
// REGISTRO CENTRAL DE SESSÕES
// ============================================================
//
// A ORDEM DAS ENTRADAS NESTE ARRAY DEFINE:
// - a ordem de exibição das sessões principais (guiado.html)
// - o número "Sessão N" mostrado na UI (numerarSessao)
// - a cor do indicador no topo
//
// Sessões de manutenção (manutencao: true) são filtradas separadamente
// e aparecem em manutencao.html, sem numeração.
//
// `flatpakId`: quando presente, indica que o comando instala um app
// Flatpak com esse app-id. Usado por `verificarFlatpaksRemovidos()`
// para detectar remoções externas e restaurar o botão.

var SESSOES = [
    {
        id: '00-boas-vindas',
        nome: 'Boas-vindas',
        nomeKey: 'sessoes.00-boas-vindas.nome',
        comandos: {
            'atualizacao-inicial': { sempreClicavel: true }
        }
    },
{
    id: '01-restauracao',
    nome: 'Restauração',
    nomeKey: 'sessoes.01-restauracao.nome',
    comandos: {
        'btrfs-install': { textoConcluido: '✅ Btrfs-Assistant instalado', textoConcluidoKey: 'sessoes.01-restauracao.texto_concluido' }
    }
},
{
    id: '02-otimizacao',
    nome: 'Otimização',
    nomeKey: 'sessoes.02-otimizacao.nome',
    comandos: {
        'dnf-speed': { sempreClicavel: true },
        'idioma-packs': { textoConcluido: '✅ Tradução instalada', textoConcluidoKey: 'sessoes.02-otimizacao.texto_concluido_packs' },
        'idioma-hunspell': { textoConcluido: '✅ Corretor instalado', textoConcluidoKey: 'sessoes.02-otimizacao.texto_concluido_hunspell' },
        'idioma-localectl': { textoConcluido: '✅ Localidade configurada', textoConcluidoKey: 'sessoes.02-otimizacao.texto_concluido_localectl' },
        'dual-boot-time': { sempreClicavel: true },
        'vm-max-map-count': { textoConcluido: '✅ Ajuste aplicado', textoConcluidoKey: 'sessoes.02-otimizacao.texto_concluido_vm_max_map_count' },
        'vm-max-map-count-remove': { textoConcluido: '✅ Ajuste revertido', textoConcluidoKey: 'sessoes.02-otimizacao.texto_concluido_vm_max_map_count_remove' },
        'vm-swappiness-cache': { textoConcluido: '✅ Ajuste aplicado', textoConcluidoKey: 'sessoes.02-otimizacao.texto_concluido_vm_swappiness_cache' },
        'vm-swappiness-cache-remove': { textoConcluido: '✅ Ajuste revertido', textoConcluidoKey: 'sessoes.02-otimizacao.texto_concluido_vm_swappiness_cache_remove' },
        'tcp-bbr': { textoConcluido: '✅ TCP BBR ativado', textoConcluidoKey: 'sessoes.02-otimizacao.texto_concluido_tcp_bbr' },
        'tcp-bbr-remove': { textoConcluido: '✅ TCP BBR desativado', textoConcluidoKey: 'sessoes.02-otimizacao.texto_concluido_tcp_bbr_remove' }
    }
},
{
    id: '03-repositorios',
    nome: 'Repositórios',
    nomeKey: 'sessoes.03-repositorios.nome',
    comandos: {
        'rpm-fusion': { textoConcluido: '✅ RPM Fusion ativado', textoConcluidoKey: 'sessoes.03-repositorios.texto_concluido_rpm' },
        'flatpak-setup': { textoConcluido: '✅ Flatpak configurado', textoConcluidoKey: 'sessoes.03-repositorios.texto_concluido_flatpak' }
    }
},
{
    id: '04-codecs-compatibilidade',
    nome: 'Codecs e Compatibilidade',
    nomeKey: 'sessoes.04-codecs-compatibilidade.nome',
    comandos: {
        'fontes-ms-all': { textoConcluido: '✅ Fontes MS instaladas', textoConcluidoKey: 'sessoes.04-codecs-compatibilidade.texto_concluido_fontes' },
        'codecs-essenciais': { textoConcluido: '✅ Codecs instalados', textoConcluidoKey: 'sessoes.04-codecs-compatibilidade.texto_concluido_codecs' },
        'extras-tainted': { textoConcluido: '✅ Extras instalados', textoConcluidoKey: 'sessoes.04-codecs-compatibilidade.texto_concluido_extras' }
    }
},
{
    id: '05-hardware',
    nome: 'Hardware',
    nomeKey: 'sessoes.05-hardware.nome',
    comandos: {
        'vulkan-amd': { textoConcluido: '✅ Vulkan instalado', textoConcluidoKey: 'sessoes.05-hardware.texto_concluido_vulkan' },
        'vaapi-amd': { textoConcluido: '✅ VA-API instalado', textoConcluidoKey: 'sessoes.05-hardware.texto_concluido_vaapi' },
        'vaapi-swap': { textoConcluido: '✅ VA-API instalado', textoConcluidoKey: 'sessoes.05-hardware.texto_concluido_vaapi' },
        'corectrl-install': { textoConcluido: '✅ CoreCtrl instalado', textoConcluidoKey: 'sessoes.05-hardware.texto_concluido_corectrl' },
        'lact-install': { textoConcluido: '✅ LACT instalado', textoConcluidoKey: 'sessoes.05-hardware.texto_concluido_lact' },
        'amdgpu-overclock': { textoConcluido: '✅ Overclock ativado', textoConcluidoKey: 'sessoes.05-hardware.texto_concluido_overclock' },
        'amdgpu-overclock-remove': { textoConcluido: '✅ Overclock desativado', textoConcluidoKey: 'sessoes.05-hardware.texto_concluido_overclock_remove' },
        'nvidia-driver-install': { textoConcluido: '✅ Driver Nvidia instalado', textoConcluidoKey: 'sessoes.05-hardware.texto_concluido_nvidia_driver' },
        'nvidia-modeset-on': { sempreClicavel: true },
        'nvidia-modeset-off': { sempreClicavel: true },
        'input-group-add': { textoConcluido: '✅ Adicionado ao grupo input', textoConcluidoKey: 'sessoes.05-hardware.texto_concluido_input_add' },
        'input-group-remove': { textoConcluido: '✅ Removido do grupo input', textoConcluidoKey: 'sessoes.05-hardware.texto_concluido_input_remove' },
        'steam-devices-install': { textoConcluido: '✅ Steam Devices instalado', textoConcluidoKey: 'sessoes.05-hardware.texto_concluido_steam_devices' }
    }
},
{
    id: '06-gaming',
    nome: 'Gaming',
    nomeKey: 'sessoes.06-gaming.nome',
    comandos: {
        // --- Launchers ---
        'steam-install': {
            textoConcluido: '✅ Steam instalado',
            textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_steam',
            flatpakId: 'com.valvesoftware.Steam'
        },
        'heroic-install': {
            textoConcluido: '✅ Heroic instalado',
            textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_heroic',
            flatpakId: 'com.heroicgameslauncher.hgl'
        },
        'lutris-install': {
            textoConcluido: '✅ Lutris instalado',
            textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_lutris',
            flatpakId: 'net.lutris.Lutris'
        },
        // --- Compatibilidade ---
        'wine-install': { textoConcluido: '✅ Wine instalado', textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_wine' },
        'winetricks-install': { textoConcluido: '✅ Winetricks instalado', textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_winetricks' },
        'bottles-install': {
            textoConcluido: '✅ Bottles instalado',
            textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_bottles',
            flatpakId: 'com.usebottles.bottles'
        },
        'ntsync-install': { textoConcluido: '✅ NTSYNC instalado', textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_ntsync' },
        // --- Performance ---
        'gamemode-install': { textoConcluido: '✅ GameMode ativado', textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_gamemode' },
        'mangohud-install': { textoConcluido: '✅ MangoHud instalado', textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_mangohud' },
        'goverlay-install': { textoConcluido: '✅ Goverlay instalado', textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_goverlay' },
        'gamescope-install': { textoConcluido: '✅ Gamescope instalado', textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_gamescope' },
        // --- Gaming Avançado ---
        'protonup-qt-install': {
            textoConcluido: '✅ ProtonUp-Qt instalado',
            textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_protonup',
            flatpakId: 'net.davidotek.pupgui2'
        },
        'vkbasalt-install': { textoConcluido: '✅ vkBasalt instalado', textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_vkbasalt' },
        'gamemode-presets-apply': { sempreClicavel: true, textoConcluido: '✅ Presets aplicados' },
        'gamescope-session-install': { textoConcluido: '✅ Gamescope session instalado', textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_gamescope_session' },
        'controller-test-install': { textoConcluido: '✅ Ferramenta instalada', textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_controller_test' },
        // --- Emuladores ---
        'retroarch-install': {
            textoConcluido: '✅ RetroArch instalado',
            textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_retroarch',
            flatpakId: 'org.libretro.RetroArch'
        },
        'dolphin-install': {
            textoConcluido: '✅ Dolphin instalado',
            textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_dolphin',
            flatpakId: 'org.DolphinEmu.dolphin-emu'
        },
        'pcsx2-install': {
            textoConcluido: '✅ PCSX2 instalado',
            textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_pcsx2',
            flatpakId: 'net.pcsx2.PCSX2'
        },
        'rpcs3-install': {
            textoConcluido: '✅ RPCS3 instalado',
            textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_rpcs3',
            flatpakId: 'net.rpcs3.RPCS3'
        },
        'duckstation-install': {
            textoConcluido: '✅ Duckstation instalado',
            textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_duckstation',
            flatpakId: 'org.duckstation.DuckStation'
        },
        // --- Rede ---
        'bufferbloat-test': {
            textoConcluido: '✅ Ferramenta instalada',
            textoConcluidoKey: 'sessoes.06-gaming.texto_concluido_bufferbloat'
        },
    }
},
{
    id: '07-loja',
    nome: 'Produção Multimídia',
    nomeKey: 'sessoes.07-loja.nome',
    comandos: {
        'instalar-obs-studio': {
            textoConcluido: '✅ OBS Studio instalado',
            textoConcluidoKey: 'sessoes.07-loja.texto_concluido_obs',
            flatpakId: 'com.obsproject.Studio'
        },
        'obs-cam': { textoConcluido: '✅ Câmera Virtual ativada', textoConcluidoKey: 'sessoes.07-loja.texto_concluido_cam' },
        'instalar-easyeffects': {
            textoConcluido: '✅ EasyEffects instalado',
            textoConcluidoKey: 'sessoes.07-loja.texto_concluido_easyeffects',
            flatpakId: 'com.github.wwmm.easyeffects'
        },
        // --- Streaming Ready ---
        'obs-scene-templates': { sempreClicavel: true, textoConcluido: '✅ Templates aplicados' },
        'streamdeck-ui-install': { textoConcluido: '✅ Streamdeck-ui instalado', textoConcluidoKey: 'sessoes.07-loja.texto_concluido_streamdeck' },
        'ndi-tools-install': { textoConcluido: '✅ NDI Tools instalado', textoConcluidoKey: 'sessoes.07-loja.texto_concluido_ndi' },
        // --- PipeWire routing ---
        'qpwgraph-install': { textoConcluido: '✅ qpwgraph instalado', textoConcluidoKey: 'sessoes.07-loja.texto_concluido_qpwgraph' },
        // --- Presets de vídeo ---
        'handbrake-install': { textoConcluido: '✅ HandBrake instalado', textoConcluidoKey: 'sessoes.07-loja.texto_concluido_handbrake' },
        'kdenlive-templates-install': { sempreClicavel: true, textoConcluido: '✅ Templates instalados' },
        // --- Captura ---
        'screen-recorder-install': { textoConcluido: '✅ Gravador instalado', textoConcluidoKey: 'sessoes.07-loja.texto_concluido_screen_recorder' },
        // --- Otimizações de áudio ---
        'realtime-setup': { textoConcluido: '✅ Grupo realtime configurado', textoConcluidoKey: 'sessoes.07-loja.texto_concluido_realtime_setup' },
        'realtime-setup-remove': { textoConcluido: '✅ Grupo realtime removido', textoConcluidoKey: 'sessoes.07-loja.texto_concluido_realtime_setup_remove' },
        'pipewire-quantum-low': { textoConcluido: '✅ Baixa latência ativada', textoConcluidoKey: 'sessoes.07-loja.texto_concluido_pipewire_quantum' },
        'pipewire-quantum-low-remove': { textoConcluido: '✅ Latência padrão restaurada', textoConcluidoKey: 'sessoes.07-loja.texto_concluido_pipewire_quantum_remove' }
    }
},
{
    id: '08-waydroid',
    nome: 'Waydroid',
    nomeKey: 'sessoes.08-waydroid.nome',
    comandos: {
        'waydroid-install': { textoConcluido: '✅ Waydroid instalado', textoConcluidoKey: 'sessoes.08-waydroid.texto_concluido_waydroid' },
        'waydroid-init': { textoConcluido: '✅ Waydroid inicializado', textoConcluidoKey: 'sessoes.08-waydroid.texto_concluido_init' },
        'waydroid-uninstall': { sempreClicavel: true },
        'waydroid-extras-prep': { textoConcluido: '✅ Ambiente preparado', textoConcluidoKey: 'sessoes.08-waydroid.texto_concluido_prep' },
        'waydroid-gapps': { textoConcluido: '✅ GApps instalado', textoConcluidoKey: 'sessoes.08-waydroid.texto_concluido_gapps' },
        'waydroid-libndk': { textoConcluido: '✅ libndk instalado', textoConcluidoKey: 'sessoes.08-waydroid.texto_concluido_libndk' },
        'waydroid-libhoudini': { textoConcluido: '✅ libhoudini instalado', textoConcluidoKey: 'sessoes.08-waydroid.texto_concluido_libhoudini' },
        'waydroid-magisk': { textoConcluido: '✅ Magisk instalado', textoConcluidoKey: 'sessoes.08-waydroid.texto_concluido_magisk' },
        'waydroid-widevine': { textoConcluido: '✅ Widevine instalado', textoConcluidoKey: 'sessoes.08-waydroid.texto_concluido_widevine' },
        'waydroid-smartdock': { textoConcluido: '✅ SmartDock instalado', textoConcluidoKey: 'sessoes.08-waydroid.texto_concluido_smartdock' },
        'waydroid-helper-install': { textoConcluido: '✅ waydroid-helper instalado', textoConcluidoKey: 'sessoes.08-waydroid.texto_concluido_helper_install' },
        'waydroid-helper-open': { sempreClicavel: true },
        'waydroid-prefs': { textoConcluido: '✅ Preferências aplicadas', textoConcluidoKey: 'sessoes.08-waydroid.texto_concluido_prefs' }
    }
},
{
    id: '09-softwares-uteis',
    nome: 'Aplicativos Recomendados',
    nomeKey: 'sessoes.09-softwares-uteis.nome',
    comandos: {
        'instalar-onlyoffice': { textoConcluido: '✅ OnlyOffice instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_onlyoffice', flatpakId: 'org.onlyoffice.desktopeditors' },
        'instalar-libreoffice': { textoConcluido: '✅ LibreOffice instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_libreoffice', flatpakId: 'org.libreoffice.LibreOffice' },
        'instalar-obsidian': { textoConcluido: '✅ Obsidian instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_obsidian', flatpakId: 'md.obsidian.Obsidian' },
        'instalar-thunderbird': { textoConcluido: '✅ Thunderbird instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_thunderbird', flatpakId: 'org.mozilla.thunderbird' },
        'instalar-okular': { textoConcluido: '✅ Okular instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_okular', flatpakId: 'org.kde.okular' },
        'instalar-joplin': { textoConcluido: '✅ Joplin instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_joplin', flatpakId: 'net.cozic.joplin_desktop' },
        'instalar-foliate': { textoConcluido: '✅ Foliate instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_foliate', flatpakId: 'com.github.johnfactotum.Foliate' },
        'instalar-haruna': { textoConcluido: '✅ Haruna instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_haruna', flatpakId: 'org.kde.haruna' },
        'instalar-vlc': { textoConcluido: '✅ VLC instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_vlc', flatpakId: 'org.videolan.VLC' },
        'instalar-mpv': { textoConcluido: '✅ MPV instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_mpv', flatpakId: 'io.mpv.Mpv' },
        'instalar-spotify': { textoConcluido: '✅ Spotify instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_spotify', flatpakId: 'com.spotify.Client' },
        'instalar-plex': { textoConcluido: '✅ Plex instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_plex', flatpakId: 'tv.plex.PlexDesktop' },
        'instalar-stremio': { textoConcluido: '✅ Stremio instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_stremio', flatpakId: 'com.stremio.Stremio' },
        'instalar-krita': { textoConcluido: '✅ Krita instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_krita', flatpakId: 'org.kde.krita' },
        'instalar-inkscape': { textoConcluido: '✅ Inkscape instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_inkscape', flatpakId: 'org.inkscape.Inkscape' },
        'instalar-pinta': { textoConcluido: '✅ Pinta instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_pinta', flatpakId: 'com.github.PintaProject.Pinta' },
        'instalar-gimp': { textoConcluido: '✅ GIMP instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_gimp', flatpakId: 'org.gimp.GIMP' },
        'instalar-darktable': { textoConcluido: '✅ Darktable instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_darktable', flatpakId: 'org.darktable.Darktable' },
        'instalar-freecad': { textoConcluido: '✅ FreeCAD instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_freecad', flatpakId: 'org.freecad.FreeCAD' },
        'instalar-librecad': { textoConcluido: '✅ LibreCAD instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_librecad', flatpakId: 'org.librecad.librecad' },
        'instalar-cura': { textoConcluido: '✅ Cura instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_cura', flatpakId: 'com.ultimaker.cura' },
        'instalar-upscayl': { textoConcluido: '✅ Upscayl instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_upscayl', flatpakId: 'org.upscayl.Upscayl' },
        'instalar-xnviewmp': { textoConcluido: '✅ XnView MP instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_xnviewmp', flatpakId: 'com.xnview.XnViewMP' },
        'instalar-affinity': { sempreClicavel: true },
        'instalar-opera': { textoConcluido: '✅ Opera instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_opera', flatpakId: 'com.opera.Opera' },
        'instalar-brave': { textoConcluido: '✅ Brave instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_brave', flatpakId: 'com.brave.Browser' },
        'instalar-zen': { textoConcluido: '✅ Zen Browser instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_zen', flatpakId: 'app.zen_browser.zen' },
        'instalar-edge': { textoConcluido: '✅ Microsoft Edge instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_edge', flatpakId: 'com.microsoft.Edge' },
        'instalar-chromium': { textoConcluido: '✅ Chromium instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_chromium', flatpakId: 'org.chromium.Chromium' },
        'instalar-zoom': { textoConcluido: '✅ Zoom instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_zoom', flatpakId: 'us.zoom.Zoom' },
        'instalar-vivaldi': { textoConcluido: '✅ Vivaldi instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_vivaldi', flatpakId: 'com.vivaldi.Vivaldi' },
        'instalar-discord': { textoConcluido: '✅ Discord instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_discord', flatpakId: 'com.discordapp.Discord' },
        'instalar-telegram': { textoConcluido: '✅ Telegram instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_telegram', flatpakId: 'org.telegram.desktop' },
        'instalar-signal': { textoConcluido: '✅ Signal instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_signal', flatpakId: 'org.signal.Signal' },
        'instalar-kdenlive': { textoConcluido: '✅ Kdenlive instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_kdenlive', flatpakId: 'org.kde.kdenlive' },
        'instalar-shotcut': { textoConcluido: '✅ Shotcut instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_shotcut', flatpakId: 'org.shotcut.Shotcut' },
        'instalar-pitivi': { textoConcluido: '✅ Pitivi instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_pitivi', flatpakId: 'org.pitivi.Pitivi' },
        'instalar-openshot': { textoConcluido: '✅ OpenShot instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_openshot', flatpakId: 'org.openshot.OpenShot' },
        'instalar-avidemux': { textoConcluido: '✅ Avidemux instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_avidemux', flatpakId: 'org.avidemux.Avidemux' },
        'instalar-lightworks': { textoConcluido: '✅ Lightworks instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_lightworks' },
        'instalar-drift': { textoConcluido: '✅ Drift instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_drift', flatpakId: 'org.cutwire.Drift' },
        'instalar-blender': { textoConcluido: '✅ Blender instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_blender', flatpakId: 'org.blender.Blender' },
        'instalar-ardour': { textoConcluido: '✅ Ardour instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_ardour', flatpakId: 'org.ardour.Ardour' },
        'instalar-lmms': { textoConcluido: '✅ LMMS instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_lmms', flatpakId: 'io.lmms.LMMS' },
        'instalar-audacity': { textoConcluido: '✅ Audacity instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_audacity', flatpakId: 'org.audacityteam.Audacity' },
        'instalar-rclone': { textoConcluido: '✅ Rclone instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_rclone' },
        'instalar-rclone-manager': { textoConcluido: '✅ Rclone Manager instalado', textoConcluidoKey: 'sessoes.09-softwares-uteis.texto_concluido_rclone_manager' }
    }
},
{
    id: '10-casa-pronta',
    nome: 'Casa Pronta',
    nomeKey: 'sessoes.10-casa-pronta.nome',
    comandos: {
        'cups-install': { textoConcluido: '✅ Impressora configurada', textoConcluidoKey: 'sessoes.10-casa-pronta.texto_concluido_cups' },
        'samba-install': { textoConcluido: '✅ Samba instalado', textoConcluidoKey: 'sessoes.10-casa-pronta.texto_concluido_samba' },
        'localsend-install': { textoConcluido: '✅ LocalSend instalado', textoConcluidoKey: 'sessoes.10-casa-pronta.texto_concluido_localsend', flatpakId: 'org.localsend.localsend_app' },
        'warpinator-install': { textoConcluido: '✅ Warpinator instalado', textoConcluidoKey: 'sessoes.10-casa-pronta.texto_concluido_warpinator', flatpakId: 'org.x.Warpinator' },
        'keepassxc-install': { textoConcluido: '✅ KeePassXC instalado', textoConcluidoKey: 'sessoes.10-casa-pronta.texto_concluido_keepassxc' },
        'okular-tesseract-install': { textoConcluido: '✅ PDF+OCR instalado', textoConcluidoKey: 'sessoes.10-casa-pronta.texto_concluido_okular_tesseract' }
    }
},
{
    id: '11-diagnostico',
    nome: 'Diagnóstico',
    nomeKey: 'sessoes.11-diagnostico.nome',
    comandos: {
        'diag-refresh': { sempreClicavel: true },
        'baobab-install': { textoConcluido: '✅ Baobab instalado', textoConcluidoKey: 'sessoes.11-diagnostico.texto_concluido_baobab' },
        'gsmartcontrol-install': { textoConcluido: '✅ GSmartControl instalado', textoConcluidoKey: 'sessoes.11-diagnostico.texto_concluido_gsmartcontrol' },
        'coolercontrol-install': { textoConcluido: '✅ CoolerControl instalado', textoConcluidoKey: 'sessoes.11-diagnostico.texto_concluido_coolercontrol' },
        'journal-errors-check': { sempreClicavel: true }
    }
},
{
    id: '12-fedora',
    nome: 'Fedora',
    nomeKey: 'sessoes.12-fedora.nome',
    comandos: {
        'fedora-version-check': { sempreClicavel: true },
        'atomic-check': { sempreClicavel: true },
        'selinux-status-check': { sempreClicavel: true },
        'selinux-troubleshoot': { sempreClicavel: true },
        'selinux-setroubleshoot-install': { textoConcluido: '✅ setroubleshoot instalado', textoConcluidoKey: 'sessoes.12-fedora.texto_concluido_setroubleshoot' },
        'selinux-gui-install': { textoConcluido: '✅ Gerenciador SELinux instalado', textoConcluidoKey: 'sessoes.12-fedora.texto_concluido_selinux_gui' }
    }
},
// ============================================================
// MANUTENÇÃO (não é sessão sequencial — é a página manutencao.html)
// ============================================================
{
    id: 'manutencao',
    nome: 'Manutenção',
    nomeKey: 'sessoes.manutencao.nome',
    manutencao: true,
    comandos: {
        'limpeza-sistema': {
            sempreClicavel: true,
            textoConcluido: '✅ Limpeza concluída',
            textoConcluidoKey: 'sessoes.manutencao.texto_concluido_limpeza'
        },
        'listar-kernels': { sempreClicavel: true },
        'remover-kernel': { sempreClicavel: true },
        'grub-aplicar-recomendado': {
            sempreClicavel: true,
            textoConcluido: '✅ Configuração aplicada',
            textoConcluidoKey: 'sessoes.manutencao.texto_concluido_grub_aplicar'
        },
        'grub-restaurar-padrao': {
            sempreClicavel: true,
            textoConcluido: '✅ Padrão restaurado',
            textoConcluidoKey: 'sessoes.manutencao.texto_concluido_grub_restaurar'
        },
        'atualizar-fof': {
            sempreClicavel: true,
            textoConcluido: '✅ FOF atualizado',
            textoConcluidoKey: 'sessoes.manutencao.texto_concluido_fof_atualizar'
        },
        'desinstalar-fof': {
            textoConcluido: '✅ FOF desinstalado',
            textoConcluidoKey: 'sessoes.manutencao.texto_concluido_fof_desinstalar'
        }
    }
}
];

var SESSOES_ORDEM = SESSOES.map(function(s) { return s.id; });
var SESSOES_PRINCIPAIS = SESSOES.filter(function(s) { return !s.manutencao; }).map(function(s) { return s.id; });
var SESSOES_MANUTENCAO = SESSOES.filter(function(s) { return s.manutencao; }).map(function(s) { return s.id; });

function _infoComando(idComando) {
    for (var i = 0; i < SESSOES.length; i++) {
        var comandos = SESSOES[i].comandos;
        if (comandos && comandos[idComando]) return comandos[idComando];
    }
    return null;
}

var SEMPRE_CLICAVEIS = SESSOES.reduce(function(lista, sessao) {
    Object.keys(sessao.comandos || {}).forEach(function(id) {
        if (sessao.comandos[id].sempreClicavel) lista.push(id);
    });
        return lista;
}, []);

function numerarSessao(sessaoId, container) {
    const index = SESSOES_PRINCIPAIS.indexOf(sessaoId);
    if (index === -1 || !container) return;
    const label = container.querySelector('.sessao-label');
    if (label) label.textContent = _tVars('comum.sessao_label', 'Sessão ' + (index + 1), { n: index + 1 });
}

function nomeDaSessao(sessaoId) {
    const sessao = SESSOES.find(function(s) { return s.id === sessaoId; });
    if (!sessao) return sessaoId;
    if (sessao.nomeKey) {
        return _t(sessao.nomeKey, sessao.nome);
    }
    return sessao.nome;
}

// ============================================================
// LOG ÚNICO POR SESSÃO — helpers
// ============================================================

function _getLogBox(idComando) {
    var btn1 = document.querySelector('[data-comando="' + idComando + '"][data-logbox]');
    if (btn1) {
        var el = document.getElementById(btn1.dataset.logbox);
        if (el) return el;
    }
    var btn2 = document.getElementById('btn-' + idComando);
    if (btn2 && btn2.dataset && btn2.dataset.logbox) {
        var el2 = document.getElementById(btn2.dataset.logbox);
        if (el2) return el2;
    }
    return document.getElementById('log-' + idComando);
}

function _separadorLog(logBox, nomeAcao) {
    if (!logBox) return;
    if (logBox.children.length === 0) return;
    var sep = document.createElement('div');
    sep.className = 'log-line separator';
    sep.textContent = '────── Iniciando: ' + nomeAcao + ' ──────';
    logBox.appendChild(sep);
    logBox.scrollTop = logBox.scrollHeight;
}

// ============================================================
// BLOQUEIO DE SESSÃO DURANTE EXECUÇÃO
// ============================================================

function _bloquearSessao(idComando) {
    var btn = document.getElementById('btn-' + idComando);
    if (!btn) return;
    var sessaoContainer = btn.closest('.sessao-container');
    if (!sessaoContainer) return;

    // Inclui .btn-flatpak-uninstall: os ícones de lixeira das
    // sessões 06, 07, 09 e 10 também precisam ser bloqueados
    // durante uma execução em andamento, senão o usuário pode
    // disparar um `flatpak uninstall` em paralelo com uma
    // instalação (ou vice-versa).
    var botoes = sessaoContainer.querySelectorAll('.btn-executar, .btn-reverter, .btn-flatpak-uninstall');
    botoes.forEach(function(b) {
        if (b.id === 'btn-' + idComando) return;
        if (b.hasAttribute('data-sessao-bloqueado')) return;
        b.setAttribute('data-was-disabled', b.disabled ? '1' : '0');
        b.setAttribute('data-sessao-bloqueado', '1');
        b.disabled = true;
        b.style.opacity = '0.4';
        b.style.pointerEvents = 'none';
    });
}

function _liberarSessao(idComando) {
    var btn = document.getElementById('btn-' + idComando);
    if (!btn) return;
    var sessaoContainer = btn.closest('.sessao-container');
    if (!sessaoContainer) return;

    var botoes = sessaoContainer.querySelectorAll('[data-sessao-bloqueado="1"]');
    botoes.forEach(function(b) {
        var wasDisabled = b.getAttribute('data-was-disabled') === '1';
        b.removeAttribute('data-sessao-bloqueado');
        b.removeAttribute('data-was-disabled');
        b.disabled = wasDisabled;
        b.style.opacity = '';
        b.style.pointerEvents = '';
    });
}

// ============================================================
// GERENCIAMENTO DE PROGRESSO
// ============================================================

var progressCache = null;
var progressLoaded = false;
var progressLoading = false;

async function getProgress() {
    if (progressLoaded && progressCache) {
        return progressCache;
    }

    if (progressLoading) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return progressCache || { executados: [], pulados: [] };
    }

    progressLoading = true;

    try {
        const response = await fetch(API_URL + '/progress');
        if (response.ok) {
            const data = await response.json();
            progressCache = {
                executados: data.executados || [],
                pulados: data.pulados || []
            };
            progressLoaded = true;

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(progressCache));
            } catch (e) { /* ignore */ }

            progressLoading = false;
            return progressCache;
        }
    } catch (e) {
        console.warn('⚠️ Não foi possível conectar ao servidor. Usando localStorage como fallback.');
    }

    try {
        const data = localStorage.getItem(STORAGE_KEY);
        const localData = data ? JSON.parse(data) : { executados: [], pulados: [] };
        progressCache = localData;
        progressLoaded = true;
        progressLoading = false;
        return localData;
    } catch (e) {
        progressLoading = false;
        return { executados: [], pulados: [] };
    }
}

async function saveProgress(progress) {
    progressCache = progress;
    progressLoaded = true;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) { /* ignore */ }

    try {
        const response = await fetch(API_URL + '/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                executados: progress.executados || [],
                pulados: progress.pulados || []
            })
        });
        if (!response.ok) {
            throw new Error('Erro ao salvar no servidor');
        }
        console.log('✅ Progresso salvo no servidor');
    } catch (e) {
        console.warn('⚠️ Não foi possível salvar no servidor. Salvando apenas no localStorage.');
    }
}

function getProgressSync() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : { executados: [], pulados: [] };
    } catch (e) {
        return { executados: [], pulados: [] };
    }
}

async function carregarProgressoInicial() {
    const progress = await getProgress();
    console.log('📊 Progresso carregado:', progress.executados.length + ' itens');
    _atualizarProgressoGlobal();
}

function isExecutado(idComando) {
    const progress = getProgressSync();
    return progress.executados.includes(idComando);
}

function isPulado(idComando) {
    const progress = getProgressSync();
    return progress.pulados.includes(idComando);
}

var SESSAO_COMANDOS = SESSOES.reduce(function(mapa, sessao) {
    if (sessao.manutencao) return mapa;
    mapa[sessao.id] = Object.keys(sessao.comandos || {}).filter(function(id) {
        return !sessao.comandos[id].sempreClicavel;
    });
    return mapa;
}, {});

function getStatusSessao(sessaoId) {
    if (isPulado(sessaoId)) return 'pulado';
    const comandos = SESSAO_COMANDOS[sessaoId] || [];
    if (comandos.length > 0 && comandos.every(id => isExecutado(id))) {
        return 'executado';
    }
    return 'pendente';
}

async function marcarComoExecutado(idComando) {
    const progress = await getProgress();
    if (!progress.executados.includes(idComando)) {
        progress.executados.push(idComando);
        await saveProgress(progress);
        _atualizarProgressoGlobal();
    }
}

async function marcarComoPulado(idComando) {
    const progress = await getProgress();
    if (!progress.pulados.includes(idComando)) {
        progress.pulados.push(idComando);
        await saveProgress(progress);
        _atualizarProgressoGlobal();
    }
}

async function desmarcarComoExecutado(idComando) {
    const progress = await getProgress();
    progress.executados = progress.executados.filter(id => id !== idComando);
    await saveProgress(progress);
    _atualizarProgressoGlobal();
}

async function desmarcarComoPulado(idComando) {
    const progress = await getProgress();
    progress.pulados = progress.pulados.filter(id => id !== idComando);
    await saveProgress(progress);
    _atualizarProgressoGlobal();
}

// ============================================================
// VERIFICAÇÃO DE FLATPAKS REMOVIDOS EXTERNAMENTE
// ============================================================
//
// O usuário pode remover um Flatpak via GNOME Software, linha de
// comando, ou qualquer outro gerenciador. Nesse caso, o FOF ainda
// tem o comando marcado como "executado" no progresso — o botão
// fica cinza/disabled mesmo com o app ausente.
//
// Esta função consulta /flatpak-installed, compara com os comandos
// marcados como executados que tenham `flatpakId`, e desmarca +
// restaura o botão para qualquer app que tenha sido removido.
//
// Throttle de 30s evita consultas repetidas quando o usuário
// navega entre sessões rapidamente.

const FLATPAK_VERIFY_TTL_MS = 30000;
let _ultimaVerificacaoFlatpak = 0;

async function verificarFlatpaksRemovidos() {
    var agora = Date.now();
    if (agora - _ultimaVerificacaoFlatpak < FLATPAK_VERIFY_TTL_MS) {
        return;
    }
    _ultimaVerificacaoFlatpak = agora;

    try {
        var r = await fetch(API_URL + '/flatpak-installed', { cache: 'no-store' });
        if (!r.ok) {
            console.warn('[Flatpak] /flatpak-installed retornou HTTP ' + r.status);
            return;
        }
        var data = await r.json();
        var instalados = Array.isArray(data.apps) ? data.apps : [];

        var progress = await getProgress();
        var executados = progress.executados || [];

        // Varre o registro central. Para cada comando executado
        // que tenha flatpakId, verifica se o app ainda está
        // instalado. Se não estiver, desmarca e restaura.
        var removidos = [];
        for (var i = 0; i < SESSOES.length; i++) {
            var sessao = SESSOES[i];
            var comandos = sessao.comandos || {};
            for (var idComando in comandos) {
                var info = comandos[idComando];
                if (!info.flatpakId) continue;
                if (!executados.includes(idComando)) continue;
                if (instalados.includes(info.flatpakId)) continue;

                removidos.push({ id: idComando, appId: info.flatpakId });
            }
        }

        if (removidos.length === 0) return;

        // Aplica as restaurações. `restaurarBotaoAposExecucao(id, false)`
        // devolve o botão ao estado original clicável. E
        // `desmarcarComoExecutado` remove do progresso persistido.
        for (var j = 0; j < removidos.length; j++) {
            var item = removidos[j];
            console.log('[Flatpak] Removido externamente:', item.id, '→', item.appId);
            await desmarcarComoExecutado(item.id);
            try {
                restaurarBotaoAposExecucao(item.id, false);
            } catch (e) {
                console.warn('[Flatpak] Erro ao restaurar botão de', item.id, ':', e.message);
            }
        }

        _atualizarProgressoGlobal();

    } catch (e) {
        console.warn('[Flatpak] Não foi possível verificar:', e.message);
    }
}

// ============================================================
// BARRA DE PROGRESSO
// ============================================================

var progressIntervals = {};
var progressTimeouts = {};
var _inicioExecucao = {};

function iniciarProgresso(idComando) {
    const container = document.getElementById('progress-' + idComando);
    if (!container) return;
    container.style.display = 'block';

    const fill = document.getElementById('progress-fill-' + idComando);
    const percent = document.getElementById('progress-percent-' + idComando);
    const status = document.getElementById('progress-status-' + idComando);

    if (!fill || !percent || !status) return;

    _inicioExecucao[idComando] = Date.now();

    fill.style.width = '0%';
    fill.className = 'progress-fill';
    percent.textContent = '0%';
    status.textContent = _t('comum.status_iniciando', '⏳ Iniciando...');
    status.className = 'status running';

    let progresso = 0;

    if (progressIntervals[idComando]) {
        clearInterval(progressIntervals[idComando]);
        delete progressIntervals[idComando];
    }

    if (progressTimeouts[idComando]) {
        clearTimeout(progressTimeouts[idComando]);
        delete progressTimeouts[idComando];
    }

    progressTimeouts[idComando] = setTimeout(() => {
        if (progressIntervals[idComando]) {
            console.log('[PROGRESS] Timeout de segurança para: ' + idComando);
            clearInterval(progressIntervals[idComando]);
            delete progressIntervals[idComando];
            completarProgresso(idComando, true);
        }
    }, 1800000);

    progressIntervals[idComando] = setInterval(() => {
        if (progresso < 85) {
            const incremento = Math.max(0.05, (85 - progresso) / 200);
            progresso = Math.min(85, progresso + incremento);
            fill.style.width = progresso + '%';
            percent.textContent = Math.round(progresso) + '%';
            status.textContent = _t('comum.status_executando', '⏳ Executando...');
            status.className = 'status running';
        }
    }, 100);
}

// ============================================================
// CONCLUSÃO REAL DE UM COMANDO
// ============================================================

var _aguardandoConclusao = {};

function aguardarConclusaoReal(idComando, timeoutMs) {
    return new Promise(function(resolve) {
        if (!_aguardandoConclusao[idComando]) _aguardandoConclusao[idComando] = [];

        var resolvido = false;
        var wrappedResolve = function(value) {
            if (resolvido) return;
            resolvido = true;
            resolve(value);
            var esperando = _aguardandoConclusao[idComando];
            if (esperando) {
                var idx = esperando.indexOf(wrappedResolve);
                if (idx !== -1) esperando.splice(idx, 1);
                if (esperando.length === 0) {
                    delete _aguardandoConclusao[idComando];
                }
            }
        };

        _aguardandoConclusao[idComando].push(wrappedResolve);
        setTimeout(function() { wrappedResolve(null); }, timeoutMs || 60000);
    });
}

function _notificarConclusaoReal(idComando, sucesso) {
    const esperando = _aguardandoConclusao[idComando];
    if (!esperando) return;
    const copia = esperando.slice();
    copia.forEach(function(resolve) { resolve(sucesso); });
}

function completarProgresso(idComando, sucesso) {
    const container = document.getElementById('progress-' + idComando);

    const aplicarUI = function() {
        if (container) {
            const fill = document.getElementById('progress-fill-' + idComando);
            const percent = document.getElementById('progress-percent-' + idComando);
            const status = document.getElementById('progress-status-' + idComando);

            if (progressTimeouts[idComando]) {
                clearTimeout(progressTimeouts[idComando]);
                delete progressTimeouts[idComando];
            }

            if (progressIntervals[idComando]) {
                clearInterval(progressIntervals[idComando]);
                delete progressIntervals[idComando];
            }

            if (fill && percent && status) {
                fill.style.width = '100%';
                fill.className = 'progress-fill complete';
                percent.textContent = '100%';

                if (sucesso) {
                    status.textContent = _t('comum.status_concluido', '✅ Concluído!');
                    status.className = 'status success';
                } else {
                    status.textContent = _t('comum.status_falha', '❌ Falha na execução');
                    status.className = 'status error';
                }

                setTimeout(() => {
                    container.style.display = 'none';
                }, 5000);
            }
        }

        var inicio = _inicioExecucao[idComando];
        if (inicio && (Date.now() - inicio) > 30000) {
            var msg = sucesso
            ? _t('comum.status_concluido', '✅ Tarefa concluída!')
            : _t('comum.status_falha', '❌ Falha na execução');
            mostrarToast(msg, sucesso ? 'success' : 'error', 6000);
            if (sucesso) {
                var tituloNotif = _t('comum.notif_tarefa_concluida_titulo', 'FOF — Tarefa concluída');
                var corpoNotif = _t('comum.notif_tarefa_concluida_corpo', 'A tarefa terminou. Veja o log para detalhes.');
                notificarNativo(tituloNotif, corpoNotif);
            }
        }
        delete _inicioExecucao[idComando];

        restaurarBotaoAposExecucao(idComando, sucesso);
        _notificarConclusaoReal(idComando, sucesso);

        _liberarSessao(idComando);
    };

    if (sucesso && !SEMPRE_CLICAVEIS.includes(idComando)) {
        marcarComoExecutado(idComando).then(aplicarUI, aplicarUI);
    } else {
        aplicarUI();
    }
}

// ============================================================
// TEXTO CORRETO DOS BOTÕES APÓS EXECUÇÃO
// ============================================================

function getTextoAposExecucao(idComando) {
    const info = _infoComando(idComando);
    if (!info) return _t('comum.btn_concluido', '✅ Concluído');
    if (info.textoConcluidoKey) {
        return _t(info.textoConcluidoKey, info.textoConcluido || '✅ Concluído');
    }
    return info.textoConcluido || _t('comum.btn_concluido', '✅ Concluído');
}

// ============================================================
// RESTAURAR BOTÃO APÓS EXECUÇÃO
// ============================================================

function _corOriginalDoBotao(btn) {
    if (btn.hasAttribute('data-cor-original')) {
        return btn.getAttribute('data-cor-original');
    }
    let cor = btn.style.backgroundColor || '';
    if (!cor) {
        try {
            cor = window.getComputedStyle(btn).backgroundColor || '';
        } catch (e) {
            cor = '';
        }
    }
    btn.setAttribute('data-cor-original', cor);
    return cor;
}

function restaurarBotaoAposExecucao(idComando, sucesso) {
    const botoes = obterBotoesPorId(idComando);
    const btnExecutar = botoes.btnExecutar;
    const btnReverter = botoes.btnReverter;

    if (!btnExecutar) return;

    const corOriginal = _corOriginalDoBotao(btnExecutar);

    if (SEMPRE_CLICAVEIS.includes(idComando)) {
        btnExecutar.textContent = _textoOriginalTraduzido(btnExecutar);
        btnExecutar.style.backgroundColor = corOriginal || 'var(--accent, #3c67e3)';
        btnExecutar.style.cursor = 'pointer';
        btnExecutar.disabled = false;
        btnExecutar.style.opacity = '1';
        return;
    }

    if (sucesso) {
        const textoFinal = getTextoAposExecucao(idComando);
        btnExecutar.textContent = textoFinal;
        btnExecutar.style.backgroundColor = '#4b5563';
        btnExecutar.style.cursor = 'default';
        btnExecutar.disabled = true;
        btnExecutar.style.opacity = '1';

        if (btnReverter) {
            btnReverter.style.display = 'inline-block';
            btnReverter.disabled = false;
        }

        marcarComoExecutado(idComando);
    } else {
        btnExecutar.textContent = _textoOriginalTraduzido(btnExecutar);
        btnExecutar.style.backgroundColor = corOriginal || 'var(--accent, #3c67e3)';
        btnExecutar.style.cursor = 'pointer';
        btnExecutar.disabled = false;
        btnExecutar.style.opacity = '1';
    }
}

// ============================================================
// SSE - LOGS EM TEMPO REAL
// ============================================================

var sseConnections = {};

function toggleTerminalLog(logBoxId) {
    var logBox = document.getElementById(logBoxId);
    if (!logBox) return;
    var toggle = document.getElementById('log-toggle-' + logBoxId);
    if (!toggle) return;
    toggle.classList.toggle('expandido');
    logBox.classList.toggle('expandido');
}

function criarToggleParaLog(logBox, labelKey) {
    if (!logBox) return;

    if (logBox.parentElement && logBox.parentElement.classList.contains('terminal-log-wrapper')) {
        return;
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'terminal-log-wrapper';

    var toggle = document.createElement('div');
    toggle.className = 'terminal-log-toggle';
    toggle.id = 'log-toggle-' + logBox.id;

    var chave = labelKey || 'comum.log_execucao';
    var fallback = (chave === 'comum.log_sessao') ? '📋 Log da Sessão' : '📋 Log de execução';
    var toggleTexto = _t(chave, fallback);

    toggle.innerHTML = '<span class="toggle-arrow">▼</span><span class="toggle-text">' + toggleTexto + '</span>';
    toggle.addEventListener('click', function() {
        toggleTerminalLog(logBox.id);
    });

    logBox.parentNode.insertBefore(wrapper, logBox);
    wrapper.appendChild(toggle);
    wrapper.appendChild(logBox);

    logBox.style.display = 'block';
    requestAnimationFrame(function() {
        toggle.classList.add('expandido');
        logBox.classList.add('expandido');
    });
}

function inicializarLogsDaSessao(root) {
    if (!root) root = document;

    var logs = root.querySelectorAll('.terminal-log');

    logs.forEach(function(logBox) {
        var labelKey = (logBox.id && logBox.id.indexOf('log-sessao-') === 0)
        ? 'comum.log_sessao'
        : 'comum.log_execucao';

        criarToggleParaLog(logBox, labelKey);
    });
}

function conectarSSE(idComando, logBox) {
    if (!logBox) return;

    var labelKey = (logBox.id && logBox.id.indexOf('log-sessao-') === 0)
    ? 'comum.log_sessao'
    : 'comum.log_execucao';

    criarToggleParaLog(logBox, labelKey);

    if (sseConnections[idComando]) {
        sseConnections[idComando].close();
        delete sseConnections[idComando];
    }

    try {
        const eventSource = new EventSource(API_URL + '/stream?id=' + idComando);
        sseConnections[idComando] = eventSource;

        let linhas = logBox.children.length;

        const MAX_LINHAS = 10000;

        eventSource.onmessage = function(event) {
            try {
                const dados = JSON.parse(event.data);

                if (dados.tipo === 'end') {
                    eventSource.close();
                    delete sseConnections[idComando];
                    const sucesso = dados.sucesso !== false;
                    completarProgresso(idComando, sucesso);
                    return;
                }

                let mensagem = dados.mensagem
                .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
                .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
                .replace(/\x1b[@-Z\\-_]/g, '')
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

                const lines = mensagem.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.trim() === '') continue;

                    const lineElement = document.createElement('div');
                    lineElement.className = 'log-line ' + dados.tipo;
                    lineElement.textContent = line;
                    logBox.appendChild(lineElement);
                    linhas++;
                }

                if (linhas > MAX_LINHAS) {
                    const children = logBox.children;
                    const excesso = linhas - MAX_LINHAS;
                    for (let j = 0; j < excesso; j++) {
                        if (children[j]) children[j].remove();
                    }
                }

                logBox.scrollTop = logBox.scrollHeight;

            } catch (e) {
                console.error('[SSE] Erro ao processar mensagem:', e);
            }
        };

        eventSource.onerror = function(event) {
            if (eventSource.readyState === EventSource.CLOSED) {
                console.log('[SSE] Conexão fechada para:', idComando);
            } else {
                console.warn('[SSE] Erro na conexão:', event);
            }
        };

    } catch (e) {
        console.error('[SSE] Erro ao criar conexão:', e);
        const errorLine = document.createElement('div');
        errorLine.className = 'log-line error';
        errorLine.textContent = '❌ Erro ao conectar SSE: ' + e.message;
        logBox.appendChild(errorLine);
        logBox.scrollTop = logBox.scrollHeight;
    }
}

// ============================================================
// DETECÇÃO DE DESKTOP
// ============================================================

var desktopCache = null;
async function detectarDesktopReal() {
    if (desktopCache) return desktopCache;
    try {
        const response = await fetch(API_URL + '/info');
        if (response.ok) {
            const data = await response.json();
            desktopCache = data.desktop || 'UNKNOWN';
            return desktopCache;
        }
    } catch (e) {
        console.warn('[Desktop] Não foi possível consultar /info:', e.message);
    }
    return 'UNKNOWN';
}

// ============================================================
// FUNÇÕES DE BOTÕES
// ============================================================

function obterBotoesPorId(idComando) {
    let btnExecutar = null;

    btnExecutar = document.querySelector('.btn-executar[data-comando="' + idComando + '"]');

    if (!btnExecutar) {
        const allButtons = document.querySelectorAll('.btn-executar');
        for (const btn of allButtons) {
            if (btn.id === 'btn-' + idComando) {
                btnExecutar = btn;
                break;
            }
            const onclick = btn.getAttribute('onclick') || '';
            if (onclick.includes("'" + idComando + "'") ||
                onclick.includes('"' + idComando + '"')) {
                btnExecutar = btn;
            break;
                }
        }
    }

    let btnReverter = null;
    if (btnExecutar && btnExecutar.parentElement) {
        btnReverter = btnExecutar.parentElement.querySelector('.btn-reverter');
    }

    return { btnExecutar, btnReverter };
}

// ============================================================
// EXECUTAR COMANDO GENÉRICO
// ============================================================

async function executarComandoGenerico(idComando, comando, nomeAcao, onSucesso) {
    const logBox = _getLogBox(idComando);
    const btn = document.getElementById('btn-' + idComando);

    if (!logBox) return;

    if (isExecutado(idComando) && !SEMPRE_CLICAVEIS.includes(idComando)) {
        alert(_t('comum.ja_executado', 'Este comando já foi executado anteriormente.'));
        return;
    }

    iniciarProgresso(idComando);

    logBox.style.display = 'block';

    _separadorLog(logBox, nomeAcao);

    const header = document.createElement('div');
    header.className = 'log-line info';
    header.textContent = '🚀 ' + nomeAcao + '... (' + new Date().toLocaleTimeString() + ')';
    logBox.appendChild(header);
    logBox.scrollTop = logBox.scrollHeight;

    conectarSSE(idComando, logBox);

    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ ' + nomeAcao + '...';
        btn.style.opacity = '0.6';
    }

    _bloquearSessao(idComando);

    try {
        const response = await fetch(API_URL + '/executar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comando: comando, idComando: idComando })
        });

        if (!response.ok) {
            const errorLine = document.createElement('div');
            errorLine.className = 'log-line error';
            errorLine.textContent = _tVars('comum.erro_http', '❌ Erro HTTP: ' + response.status, { status: response.status });
            logBox.appendChild(errorLine);
            logBox.scrollTop = logBox.scrollHeight;
            completarProgresso(idComando, false);

            if (btn) {
                btn.disabled = false;
                btn.textContent = _textoOriginalTraduzido(btn) || nomeAcao;
                btn.style.opacity = '1';
            }
            return;
        }

        if (typeof onSucesso === 'function') {
            aguardarConclusaoEEntao(idComando, onSucesso);
        }
    } catch (e) {
        const errorLine = document.createElement('div');
        errorLine.className = 'log-line error';
        errorLine.textContent = _tVars('comum.erro_conexao', '❌ Erro de conexão: ' + e.message, { msg: e.message });
        logBox.appendChild(errorLine);
        logBox.scrollTop = logBox.scrollHeight;
        completarProgresso(idComando, false);

        if (btn) {
            btn.disabled = false;
            btn.textContent = _textoOriginalTraduzido(btn) || nomeAcao;
            btn.style.opacity = '1';
        }
    }
}

// ============================================================
// DESINSTALAR PACOTE
// ============================================================

async function desinstalarPacote(idComando, comandoRemover, nomeExibicao) {
    if (!isExecutado(idComando)) {
        alert(_tVars('comum.nao_instalado', nomeExibicao + ' não está instalado.', { nome: nomeExibicao }));
        return;
    }

    if (!confirm(_tVars('comum.confirmar_desinstalar', 'Deseja desinstalar o ' + nomeExibicao + '?', { nome: nomeExibicao }))) return;

    const logBox = _getLogBox(idComando);
    const btn = document.getElementById('btn-' + idComando);
    const btnReverter = document.getElementById('btn-reverter-' + idComando);
    const idRevert = idComando + '-revert';

    if (logBox) {
        logBox.style.display = 'block';
        _separadorLog(logBox, '🗑️ Desinstalar ' + nomeExibicao);
        const infoLine = document.createElement('div');
        infoLine.className = 'log-line info';
        infoLine.textContent = '🗑️ Desinstalando ' + nomeExibicao + '...';
        logBox.appendChild(infoLine);
        logBox.scrollTop = logBox.scrollHeight;
    }

    if (btnReverter) {
        btnReverter.disabled = true;
    }

    conectarSSE(idRevert, logBox);

    try {
        await fetch(API_URL + '/executar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comando: comandoRemover, idComando: idRevert })
        });

        const sucesso = await aguardarConclusaoReal(idRevert, 180000);

        if (!sucesso) {
            if (btnReverter) btnReverter.disabled = false;
            if (logBox) {
                const errorLine = document.createElement('div');
                errorLine.className = 'log-line error';
                errorLine.textContent = sucesso === null
                ? _t('comum.erro_timeout_desinstalar', '❌ Tempo esgotado esperando a desinstalação.')
                : _tVars('comum.erro_falha_desinstalar', '❌ Falha ao desinstalar ' + nomeExibicao + '.', { nome: nomeExibicao });
                logBox.appendChild(errorLine);
                logBox.scrollTop = logBox.scrollHeight;
            }
            return;
        }

        desmarcarComoExecutado(idComando);

        if (btn) {
            btn.textContent = _textoOriginalTraduzido(btn) || nomeExibicao;
            btn.style.backgroundColor = _corOriginalDoBotao(btn);
            btn.style.cursor = 'pointer';
            btn.style.opacity = '1';
            btn.disabled = false;
        }

        if (btnReverter) {
            btnReverter.disabled = true;
            btnReverter.style.display = 'none';
        }

        if (logBox) {
            const successLine = document.createElement('div');
            successLine.className = 'log-line success';
            successLine.textContent = _tVars('comum.sucesso_desinstalar', '✅ ' + nomeExibicao + ' desinstalado com sucesso!', { nome: nomeExibicao });
            logBox.appendChild(successLine);
            logBox.scrollTop = logBox.scrollHeight;
        }

    } catch (e) {
        if (btnReverter) {
            btnReverter.disabled = false;
        }
        if (logBox) {
            const errorLine = document.createElement('div');
            errorLine.className = 'log-line error';
            errorLine.textContent = _tVars('comum.erro_desinstalar', '❌ Erro ao desinstalar: ' + e.message, { msg: e.message });
            logBox.appendChild(errorLine);
            logBox.scrollTop = logBox.scrollHeight;
        }
    }
}

// ============================================================
// ABRIR FERRAMENTA EXTERNA
// ============================================================

function abrirFerramentaExterna(comando, idLog, nomeExibicao) {
    fetch(API_URL + '/executar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando: comando, idComando: idLog + '-open' })
    });

    var logBox = _getLogBox(idLog);
    if (logBox) {
        logBox.style.display = 'block';
        _separadorLog(logBox, '🚀 Abrir ' + nomeExibicao);
        var infoLine = document.createElement('div');
        infoLine.className = 'log-line success';
        infoLine.textContent = '🚀 ' + nomeExibicao + ' aberto!';
        logBox.appendChild(infoLine);
        logBox.scrollTop = logBox.scrollHeight;
    }
}

function mostrarBotaoDesinstalar(idComando) {
    const btnReverter = document.getElementById('btn-reverter-' + idComando);
    if (btnReverter) {
        btnReverter.disabled = false;
    }
}

async function aguardarConclusaoEEntao(idComando, onSucesso) {
    const sucesso = await aguardarConclusaoReal(idComando, 1800000);
    if (sucesso) {
        onSucesso(idComando);
    }
}

// ============================================================
// SELECTS PERSONALIZADOS
// ============================================================

var selectOutsideClickBound = false;

function bindCustomSelect(triggerId, optionsId, hiddenId, displayId) {
    const trigger = document.getElementById(triggerId);
    const options = document.getElementById(optionsId);
    const hiddenInput = document.getElementById(hiddenId);
    const displayValue = document.getElementById(displayId);

    if (!trigger || !options || !hiddenInput || !displayValue) return;

    if (trigger.dataset.fofSelectBound === '1') return;
    trigger.dataset.fofSelectBound = '1';

    trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        trigger.classList.toggle('open');
        options.classList.toggle('open');
    });

    const optionItems = options.querySelectorAll('li');
    optionItems.forEach(function(li) {
        li.addEventListener('click', function(e) {
            e.stopPropagation();
            const value = this.getAttribute('data-value');
            const text = this.textContent;
            displayValue.textContent = text;
            hiddenInput.value = value;

            optionItems.forEach(function(opt) {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');

            trigger.classList.remove('open');
            options.classList.remove('open');
        });
    });
}

function initCustomSelects() {
    bindCustomSelect('custom-select-trigger', 'custom-select-options', 'select-downloads', 'custom-select-value');

    if (!selectOutsideClickBound) {
        selectOutsideClickBound = true;
        document.addEventListener('click', function(e) {
            document.querySelectorAll('.custom-select').forEach(function(container) {
                if (!container.contains(e.target)) {
                    const t = container.querySelector('.custom-select-trigger');
                    const o = container.querySelector('.custom-select-options');
                    if (t) t.classList.remove('open');
                    if (o) o.classList.remove('open');
                }
            });
        });
    }
}

// ============================================================
// BUSCA GLOBAL (Ctrl+K)
// ============================================================
//
// Overlay de busca que procura em:
// - nomes de sessão
// - texto de botões (.btn-executar)
// - descrições de acordeões (summary)
//
// Funciona em qualquer página (index, guiado, manutencao).
// Ao selecionar um resultado, navega para a sessão correspondente
// e faz scroll até o botão.

var _buscaOverlay = null;

function _garantirOverlayBusca() {
    if (_buscaOverlay) return _buscaOverlay;

    var overlay = document.createElement('div');
    overlay.className = 'busca-overlay';
    overlay.id = 'busca-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
    '<div class="busca-modal">' +
    '<input type="text" class="busca-input" id="busca-input" ' +
    'placeholder="' + _t('comum.busca_placeholder', '🔍 Buscar sessão, botão ou termo...') + '" ' +
    'autocomplete="off" spellcheck="false">' +
    '<div class="busca-resultados" id="busca-resultados">' +
    '<div class="busca-vazio">' + _t('comum.busca_dica', 'Digite para buscar...') + '</div>' +
    '</div>' +
    '</div>';

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) fecharBusca();
    });

        document.body.appendChild(overlay);

        var input = overlay.querySelector('#busca-input');
        input.addEventListener('input', function() {
            _renderResultadosBusca(this.value);
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                fecharBusca();
            }
        });

        _buscaOverlay = overlay;
        return overlay;
}

function abrirBusca() {
    var overlay = _garantirOverlayBusca();
    overlay.classList.add('aberto');
    overlay.setAttribute('aria-hidden', 'false');
    var input = overlay.querySelector('#busca-input');
    if (input) {
        input.value = '';
        input.focus();
        _renderResultadosBusca('');
    }
}

function fecharBusca() {
    if (!_buscaOverlay) return;
    _buscaOverlay.classList.remove('aberto');
    _buscaOverlay.setAttribute('aria-hidden', 'true');
}

function _coletarItensBuscaveis() {
    var itens = [];
    document.querySelectorAll('.btn-executar[data-comando]').forEach(function(btn) {
        var texto = (btn.textContent || '').trim();
        var idComando = btn.getAttribute('data-comando');
        var sessao = btn.closest('.sessao-container');
        var sessaoId = sessao ? (sessao.id || '').replace(/^sessao-/, '') : '';
        itens.push({
            tipo: 'botao',
            texto: texto,
            idComando: idComando,
            sessaoId: sessaoId,
            elemento: btn
        });
    });
    document.querySelectorAll('.sessao-titulo').forEach(function(el) {
        var container = el.closest('.sessao-container');
        if (!container) return;
        var sessaoId = (container.id || '').replace(/^sessao-/, '');
        itens.push({
            tipo: 'sessao',
            texto: el.textContent.trim(),
                   sessaoId: sessaoId,
                   elemento: container
        });
    });
    return itens;
}

function _renderResultadosBusca(termo) {
    var container = document.getElementById('busca-resultados');
    if (!container) return;

    var t = (termo || '').toLowerCase().trim();
    if (!t) {
        container.innerHTML = '<div class="busca-vazio">' +
        _t('comum.busca_dica', 'Digite para buscar...') + '</div>';
        return;
    }

    var itens = _coletarItensBuscaveis();
    var matches = itens.filter(function(it) {
        return it.texto.toLowerCase().indexOf(t) !== -1;
    }).slice(0, 20);

    if (matches.length === 0) {
        container.innerHTML = '<div class="busca-vazio">' +
        _t('comum.busca_sem_resultados', 'Nenhum resultado encontrado.') + '</div>';
        return;
    }

    container.innerHTML = '';
    matches.forEach(function(it) {
        var item = document.createElement('div');
        item.className = 'busca-item';
        var badge = it.tipo === 'sessao'
        ? '<span class="busca-badge sessao">' + _t('comum.busca_badge_sessao', 'Sessão') + '</span>'
        : '<span class="busca-badge botao">' + _t('comum.busca_badge_botao', 'Botão') + '</span>';
        item.innerHTML = badge + '<span class="busca-texto">' + it.texto + '</span>';
        item.addEventListener('click', function() {
            _navegarParaResultadoBusca(it);
        });
        container.appendChild(item);
    });
}

function _navegarParaResultadoBusca(item) {
    fecharBusca();
    if (item.elemento && document.body.contains(item.elemento)) {
        item.elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (item.tipo === 'botao') {
            item.elemento.focus({ preventScroll: true });
        }
        return;
    }
    if (item.sessaoId) {
        var url = 'guiado.html?session=' + encodeURIComponent(item.sessaoId);
        window.location.href = url;
    }
}

// ============================================================
// ATALHOS DE TECLADO
// ============================================================

// Ctrl+Enter: dispara o primeiro botão .btn-executar visível e habilitado
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        var foco = document.activeElement;
        if (foco && foco.classList && foco.classList.contains('btn-executar') && !foco.disabled) {
            e.preventDefault();
            foco.click();
            return;
        }
        var botoes = document.querySelectorAll('.btn-executar:not(:disabled)');
        for (var i = 0; i < botoes.length; i++) {
            var r = botoes[i].getBoundingClientRect();
            if (r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0) {
                e.preventDefault();
                botoes[i].click();
                return;
            }
        }
    }
});

// Ctrl+K: abre a busca global
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        abrirBusca();
    }
    if (e.key === 'Escape' && _buscaOverlay && _buscaOverlay.classList.contains('aberto')) {
        fecharBusca();
    }
});

// ============================================================
// INICIALIZAÇÃO GLOBAL
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    carregarProgressoInicial();
    setTimeout(initCustomSelects, 300);
    criarBotaoTema();
    _atualizarProgressoGlobal();

    verificarFlatpaksRemovidos();

    try {
        var params = new URLSearchParams(window.location.search);
        var sessaoAlvo = params.get('session');
        if (sessaoAlvo && typeof SESSOES_PRINCIPAIS !== 'undefined' &&
            SESSOES_PRINCIPAIS.indexOf(sessaoAlvo) !== -1) {
            setTimeout(function() {
                if (typeof irParaSessao === 'function') {
                    var idx = SESSOES_PRINCIPAIS.indexOf(sessaoAlvo);
                    if (idx !== -1) irParaSessao(idx);
                }
            }, 500);
            }
    } catch (e) { /* ignore */ }

    if (typeof I18N !== 'undefined' && typeof I18N.criarSeletorIdioma === 'function') {
        setTimeout(function() { I18N.criarSeletorIdioma(); }, 50);
    }

    carregarVersaoServidor().then(function() {
        mostrarBadgeSeHouverAtualizacao();
    });
});

document.addEventListener('sessao-carregada', function() {
    setTimeout(initCustomSelects, 200);
    setTimeout(carregarProgressoInicial, 300);
    criarBotaoTema();
    _atualizarProgressoGlobal();

    setTimeout(verificarFlatpaksRemovidos, 500);

    if (typeof I18N !== 'undefined' && typeof I18N.criarSeletorIdioma === 'function') {
        setTimeout(function() { I18N.criarSeletorIdioma(); }, 100);
    }
});

document.addEventListener('todas-sessoes-carregadas', function() {
    setTimeout(initCustomSelects, 300);
    setTimeout(carregarProgressoInicial, 400);
    criarBotaoTema();
    _atualizarProgressoGlobal();

    if (typeof I18N !== 'undefined' && typeof I18N.criarSeletorIdioma === 'function') {
        setTimeout(function() { I18N.criarSeletorIdioma(); }, 100);
    }
});
