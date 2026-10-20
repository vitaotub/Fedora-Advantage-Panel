var comando, idRemocao;
/**
 * Fedora Advantage Panel (FAP) - Script Compartilhado
 *
 * Este arquivo contém as funções GLOBAIS compartilhadas entre todas as sessões.
 * Cada sessão (*.html) tem seu próprio JS específico que usa estas funções.
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
 * VERIFICAÇÃO DE ATUALIZAÇÕES: no boot, o FAP consulta a API do GitHub
 * para saber se há uma versão mais recente publicada. Se houver, um
 * badge "Atualizar" aparece ao lado do número da versão. O clique
 * dispara a atualização direto (POST /executar), sem navegação. Cache
 * de 12h.
 *
 * VERIFICAÇÃO DE FLATPAKS REMOVIDOS: no boot e a cada sessão carregada,
* o FAP consulta o estado real do sistema (via `/system-state`, cacheado
* no cliente por `SystemState`) e desmarca qualquer comando que tenha
* sido marcado como executado mas cujo Flatpak não esteja mais instalado
* (o usuário removeu via GNOME Software, linha de comando, etc.).
* O botão volta ao estado original para reinstalar.
 *
 * LIMPEZA DE IDs ÓRFÃOS: no boot e a cada sessão carregada, o FAP remove
 * do progresso persistido qualquer idComando que não exista mais no
 * registro SESSOES. Isso evita que renomeações/remoções de sessão
 * deixem IDs "fantasmas" poluindo o .progresso.json para sempre.
 *
 * TEMA: claro/escuro alternável via botão na UI. Persistência em localStorage
 * sob a chave 'fap_tema'.
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

var STORAGE_KEY = 'fap_progress';

let FAP_VERSION = '';

window.FAP_VERSION_UI18N = '';

async function carregarVersaoServidor() {
    try {
        const response = await fetch(API_URL + '/info');
        if (response.ok) {
            const data = await response.json();
            FAP_VERSION = data.version || FAP_VERSION;
            window.FAP_VERSION_UI18N = FAP_VERSION;
        }
    } catch (e) {
        console.warn('[Versão] Não foi possível consultar /info:', e.message);
    }
    document.querySelectorAll('.fap-version').forEach(function(el) {
        el.textContent = FAP_VERSION || '?';
    });

    if (typeof I18N !== 'undefined' && typeof I18N.aplicarTraducoes === 'function') {
        var badges = document.querySelectorAll('[data-i18n-html="index.badge_versao"]');
        if (badges.length > 0) {
            I18N.aplicarTraducoes();
        }
    }

    // Notifica consumidores (sobre-fap.html) que a versão já está
    // disponível. Substitui o polling de 100ms que existia antes.
    document.dispatchEvent(new CustomEvent('fap-versao-pronta', {
        detail: { versao: FAP_VERSION }
    }));

    console.log('🚀 Fedora Advantage Panel v' + (FAP_VERSION || '?') + ' - Script compartilhado carregado!');
}

// ============================================================
// VERIFICAÇÃO DE ATUALIZAÇÕES (GitHub Releases API)
// ============================================================

var GITHUB_REPO = 'vitaotub/Fedora-Advantage-Panel';
var ULTIMA_VERIFICACAO_KEY = 'fap_ultima_verificacao';
var VERSAO_REMOTA_KEY = 'fap_versao_remota';
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

// ============================================================
// COMPARAÇÃO DE VERSÕES
// ============================================================
//
// O FAP versiona no formato `1.0.0-10152026.b` (semver-like com
// sufixo de data + letra). A comparação lexicográfica de strings
// funciona POR SORTE quando todos os componentes têm tamanho fixo,
// mas quebra quando:
//
//   • Uma versão futura tem sufixo alfabético maior ('b' vs 'c').
//   • O sufixo de data cresce em número de dígitos.
//
// Solução: parsing semântico. Cada parte da versão é convertida
// para um número (partes puramente numéricas viram int; partes
// alfanuméricas viram código ordenável via charCodeAt). A
// comparação é feita componente a componente, preenchendo com 0
// quando um lado tem menos partes que o outro.

function _parseVersao(v) {
    if (!v || v === '?') return null;
    var cleaned = String(v).replace(/^[vV]/, '').trim();
    if (!cleaned) return null;

    var partes = cleaned.split(/[.\-]/).filter(function(p) { return p.length > 0; });
    var resultado = [];

    for (var i = 0; i < partes.length; i++) {
        var p = partes[i];
        if (/^\d+$/.test(p)) {
            resultado.push(parseInt(p, 10));
        } else {
            // Sufixo alfanumérico ('b', 'hotfix-2', etc.) — converte
            // para um número ordenável. O deslocamento por 256 garante
            // que 'ab' > 'aa', e 'b' (98) > 'a' (97).
            var num = 0;
            for (var j = 0; j < p.length; j++) {
                num = num * 256 + p.charCodeAt(j);
            }
            resultado.push(num);
        }
    }

    return resultado;
}

function temAtualizacao(versaoLocal, versaoRemota) {
    var local = _parseVersao(versaoLocal);
    var remota = _parseVersao(versaoRemota);
    if (!local || !remota) return false;

    var max = Math.max(local.length, remota.length);
    for (var i = 0; i < max; i++) {
        var a = (i < local.length)  ? local[i]  : 0;
        var b = (i < remota.length) ? remota[i] : 0;
        if (b > a) return true;
        if (b < a) return false;
    }
    return false;
}

// ============================================================
// DISPARO DIRETO DA ATUALIZAÇÃO (a partir do badge)
// ============================================================
//
// O badge de "atualização disponível" antes navegava para
// guiado.html?session=sobre-fap. Em alguns casos isso causava uma
// tela preta (race entre dois carregamentos de sessão). Agora o
// clique dispara o `POST /executar` direto, sem navegação.

var _atualizacaoEmAndamento = false;

async function _dispararAtualizacaoFAP() {
    if (_atualizacaoEmAndamento) {
        mostrarToast(
            _t('comum.badge_ja_atualizando', '⏳ Atualização já em andamento...'),
                     'info', 4000
        );
        return;
    }

    var confirmMsg = _t('sessoes.sobre-fap.atualizar_confirmar',
                        '🔄 Deseja atualizar o Fedora Advantage Panel para a versão mais recente?\n\n' +
                        'Isso irá baixar e instalar a última versão do GitHub.');
    if (!confirm(confirmMsg)) return;

    _atualizacaoEmAndamento = true;

    mostrarToast(
        _t('comum.badge_atualizando',
           '🔄 Atualizando FAP... Acompanhe o progresso em Sobre o FAP.'),
           'success', 8000
    );

    var es = null;
    var finalizado = false;

    function _finalizar(sucesso) {
        if (finalizado) return;
        finalizado = true;
        _atualizacaoEmAndamento = false;
        if (es) {
            try { es.close(); } catch (e) {}
            es = null;
        }
        if (sucesso === true) {
            mostrarToast(
                _t('sessoes.sobre-fap.atualizar_popup_concluido',
                   '✅ Atualização concluída! Feche e reabra o FAP.').split('\n')[0],
                         'success', 10000
            );
        } else if (sucesso === false) {
            mostrarToast(
                _t('comum.status_falha', '❌ Falha na execução'),
                         'error', 8000
            );
        }
        // sucesso === null → timeout silencioso, sem toast
    }

    try {
        var r = await fetch(API_URL + '/executar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                comando: 'bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh) --update',
                                 idComando: 'atualizar-fap'
            })
        });

        if (!r.ok) {
            mostrarToast(
                _tVars('comum.erro_http', '❌ Erro HTTP: {status}', { status: r.status }),
                         'error', 6000
            );
            _finalizar(null);
            return;
        }

        // Conecta ao SSE para saber quando o comando termina.
        es = new EventSource(API_URL + '/stream?id=atualizar-fap');
        es.onmessage = function(event) {
            try {
                var dados = JSON.parse(event.data);
                if (dados.tipo === 'end') {
                    _finalizar(dados.sucesso !== false);
                }
            } catch (e) { /* ignora payload não-JSON */ }
        };
        es.onerror = function() {
            // Se a conexão SSE cair (servidor reiniciando durante o
            // próprio update), libera o flag. Não mostramos toast de
            // erro porque o comando pode ter terminado com sucesso.
            _finalizar(null);
        };

        // Rede de segurança: se em 5min nada aconteceu, destrava.
        setTimeout(function() { _finalizar(null); }, 5 * 60 * 1000);

    } catch (err) {
        mostrarToast(
            _tVars('comum.erro_conexao', '❌ Erro de conexão: {msg}', { msg: err.message }),
                     'error', 6000
        );
        _atualizacaoEmAndamento = false;
    }
}

async function mostrarBadgeSeHouverAtualizacao() {
    var versaoRemota = await verificarAtualizacoes();
    if (!versaoRemota) return;

    var versaoLocal = FAP_VERSION || '?';
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

    document.querySelectorAll('.fap-version').forEach(function(el) {
        var parent = el.parentElement;
        if (!parent) return;
        if (parent.querySelector('.badge-atualizacao')) return;

        var badgeTxt = _t('comum.atualizacao_disponivel_titulo',
                          'Nova versão disponível! Clique para atualizar.');

        var badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'badge-atualizacao';
        badge.title = badgeTxt;
        badge.setAttribute('aria-label', badgeTxt);
        badge.setAttribute('data-i18n-title', 'comum.atualizacao_disponivel_titulo');
        badge.setAttribute('data-i18n-aria-label', 'comum.atualizacao_disponivel_titulo');

        badge.innerHTML =
        '<svg class="badge-atualizacao-icon" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
        '<polyline points="7 10 12 15 17 10"/>' +
        '<line x1="12" y1="15" x2="12" y2="3"/>' +
        '</svg>';

        badge.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            _dispararAtualizacaoFAP();
        });

        parent.insertBefore(badge, el.nextSibling);
    });

    console.log('⬆️ Atualização disponível: ' + versaoLocal + ' → ' + versaoRemota);
}

// Expõe globalmente para o sobre-fap.html reutilizar a lógica de
// atualização (mesma confirmação + toast + rate-limit).
window._dispararAtualizacaoFAP = _dispararAtualizacaoFAP;

// ============================================================
// i18n HELPER LOCAL
// ============================================================
//
// Chaves novas usadas desde a v1.1.2 (mantidas em locales/en.json
// e locales/es.json; PT-BR é o fallback embutido aqui):
//   - comum.tooltip_preexistente_app
//   - comum.tooltip_preexistente_recurso
//   - comum.confirm_preexistente_prefixo
//   - comum.ja_estava_ativo
//   - mitigacao.<id>  (motivo de bloqueio dos 14 itens protegidos)
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
// ESTADO DO SISTEMA (cache cliente de /system-state)
// ============================================================
//
// O endpoint GET /system-state devolve o estado real do Fedora do
// usuário — repositórios ativos, pacotes instalados, etc. — sem
// depender do que o FAP já instalou.
//
// O servidor tem cache de 5 minutos em memória. Este módulo
// cliente faz uma ÚNICA fetch no boot (ou na primeira consulta,
// o que vier antes) e guarda o resultado. Helpers síncronos
// (`SystemState.repoAtivo`, `SystemState.pacoteInstalado`) leem
// desse cache.
//
// Se a fetch falhar (rede, servidor fora do ar), o cache fica
// como `null` e todos os helpers retornam `false` — o
// comportamento anterior é preservado (o usuário só vê o que o
// .progresso.json conhece).

var SystemState = (function() {
    var _dados = null;
    var _promessa = null;

    function _carregar() {
        if (_dados) return Promise.resolve(_dados);
        if (_promessa) return _promessa;

        _promessa = fetch(API_URL + '/system-state', { cache: 'no-store' })
        .then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(function(dados) {
            _dados = dados || {};
            _promessa = null;
            return _dados;
        })
        .catch(function(e) {
            console.warn('[SystemState] Falha ao carregar:', e.message);
            _dados = {};
            _promessa = null;
            return _dados;
        });

        return _promessa;
    }

    function _lista(campo) {
        if (!_dados) return [];
        return Array.isArray(_dados[campo]) ? _dados[campo] : [];
    }

    return {
        carregar: _carregar,

        // Síncronos: o chamador deve ter feito `await SystemState.carregar()`
        // antes. Retornam false se o cache estiver vazio (comportamento
        // anterior preservado).

        // Repositório DNF ativo: SystemState.repoAtivo('terra')
        repoAtivo: function(id) {
            return _lista('repos_enabled').indexOf(id) !== -1;
        },

        // Remote Flatpak ativo: SystemState.remoteFlatpakAtivo('flathub')
        remoteFlatpakAtivo: function(id) {
            return _lista('repos_enabled').indexOf('flatpak:' + id) !== -1;
        },

        // Arquivo .repo de fabricante presente: SystemState.repoFabricanteAtivo('opera')
        repoFabricanteAtivo: function(id) {
            return _lista('repos_enabled').indexOf('file:' + id) !== -1;
        },

        // Pacote RPM instalado. Fase 2.
        pacoteInstalado: function(nome) {
            return _lista('packages_installed').indexOf(nome) !== -1;
        },

        // Flatpak instalado. Fase 2.
        flatpakInstalado: function(appId) {
            return _lista('flatpaks_installed').indexOf(appId) !== -1;
        },

        // Membro do grupo. Fase 3.
        membroDoGrupo: function(nome) {
            return _lista('groups_membership').indexOf(nome) !== -1;
        },

        // Valor de kernel param. Fase 3.
        kernelParam: function(nome) {
            return _dados && _dados.kernel_params ? _dados.kernel_params[nome] : undefined;
        },

        // Serviço ativo. Fase 3.
        servicoAtivo: function(nome) {
            return _lista('services_active').indexOf(nome) !== -1;
        },

        // Arquivo de config presente. Fase 3.
        arquivoPresente: function(caminho) {
            return _lista('config_files_present').indexOf(caminho) !== -1;
        },

        // Waydroid: retorna { installed, initialized, extras_prepared }.
        // Fase 4.
        waydroid: function() {
            return (_dados && _dados.waydroid) || {
                installed: false,
                initialized: false,
                extras_prepared: false
            };
        },

        // RTC em horário local (yes) ou UTC (no). Fase 5.
        // Usado pelo toggle `dual-boot-time` da sessão 12 para
        // detectar se o ajuste já foi aplicado — pelo FAP ou por
        // fora.
        localRtc: function() {
            return !!(_dados && _dados.local_rtc);
        },

        // Para debug: devolve o objeto cru.
        bruto: function() { return _dados; },

                   // Invalida o cache cliente. Chamado após remoções e
                   // instalações que mudam o estado do sistema, para que
                   // `carregar()` faça um novo fetch na próxima consulta —
                   // em vez de retornar dados obsoletos por até 60s (TTL
                   // do servidor). Sem isso, o botão do app removido
                   // continuava "Abrir" por 60s porque `appJaInstaladoNoSistema`
                   // ainda via o app no cache.
                   invalidar: function() {
                       _dados = null;
                       _promessa = null;
                   }
    };
})();

// ============================================================
// PRÉ-EXISTENTE (Opção C — UI honesta + revert conservador)
// ============================================================
//
// Um item é "pré-existente" quando o estado do SISTEMA indica
// que ele já está instalado/ativo, mas o .progresso.json NÃO o
// marca como instalado pelo FAP. Isso significa que o usuário já
// tinha o item antes de usar o FAP.
//
// Comportamento:
//   • UI mostra o estado real (botão cinza / "Abrir X").
//   • Revert fica DESABILITADO com tooltip explicando.
//   • Lixeira some ou fica desabilitada.
//
// A função é pura — cada sessão a chama com a condição específica
// do seu contexto.

function ehPreExistente(idComando, jaInstaladoNoSistema) {
    if (!jaInstaladoNoSistema) return false;
    return !isExecutado(idComando);
}

// ============================================================
// APP JÁ INSTALADO NO SISTEMA?
// ============================================================
//
// Consulta o SystemState (cache cliente de /system-state) e o
// registro APPS_REMOVIVEIS para responder: "este app está
// instalado no sistema, independente de quem o instalou?".
//
// Usa os campos do registro:
//   - tipo: 'flatpak'  → appId        (SystemState.flatpakInstalado)
//   - tipo: 'dnf'      → pacotes[]    (SystemState.pacoteInstalado)
//   - tipo: 'arquivos' → não detectável (retorna false)
//   - modo: 'desfazerTudo' → checa `pacotes[]` se presente (caso
//                            do Rclone Manager); senão retorna false.
//
// Retorna false se o idComando não estiver registrado.

function appJaInstaladoNoSistema(idComando) {
    var info = APPS_REMOVIVEIS[idComando];
    if (!info) return false;

    // `modo: 'desfazerTudo'` normalmente não tem `tipo`/`pacotes`.
    // Exceção: Rclone Manager define `pacotes` para permitir
    // detecção de pré-existência. Se `pacotes` existir, checa
    // mesmo em desfazerTudo.
    if (info.modo === 'desfazerTudo') {
        if (Array.isArray(info.pacotes) && info.pacotes.length > 0) {
            for (var i = 0; i < info.pacotes.length; i++) {
                if (SystemState.pacoteInstalado(info.pacotes[i])) {
                    return true;
                }
            }
        }
        return false;
    }

    if (info.tipo === 'flatpak' && info.appId) {
        return SystemState.flatpakInstalado(info.appId);
    }

    if (info.tipo === 'dnf' && Array.isArray(info.pacotes) && info.pacotes.length > 0) {
        // Basta um dos pacotes estar instalado para considerarmos
        // o app instalado. Isso cobre os casos em que o pacote
        // principal depende de secundários (ex.: remmina +
        // remmina-plugins-rdp + remmina-plugins-vnc) e o usuário
        // tem uma instalação parcial.
        for (var i = 0; i < info.pacotes.length; i++) {
            if (SystemState.pacoteInstalado(info.pacotes[i])) {
                return true;
            }
        }
        return false;
    }

    return false;
}

// ============================================================
// TEMA CLARO / ESCURO
// ============================================================

var TEMA_STORAGE_KEY = 'fap_tema';

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
    var c = document.getElementById('fap-toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'fap-toast-container';
        c.className = 'fap-toast-container';
        document.body.appendChild(c);
    }
    return c;
}

function mostrarToast(mensagem, tipo, duracaoMs) {
    var c = _garantirContainerToast();
    var t = document.createElement('div');
    t.className = 'fap-toast ' + (tipo || 'info');
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
//
// -1 significa "inválido, recalcular". Qualquer transição de estado
// (marcar/desmarcar) chama _invalidarContadorSessoes().

var _contadorSessoesConcluidas = -1;

function _invalidarContadorSessoes() {
    _contadorSessoesConcluidas = -1;
}

function _atualizarProgressoGlobal() {
    var el = document.getElementById('progresso-global');
    if (!el) return;
    var total = SESSOES_PRINCIPAIS.length;

    if (_contadorSessoesConcluidas < 0) {
        var cont = 0;
        for (var i = 0; i < SESSOES_PRINCIPAIS.length; i++) {
            if (getStatusSessao(SESSOES_PRINCIPAIS[i]) === 'executado') cont++;
        }
        _contadorSessoesConcluidas = cont;
    }

    el.innerHTML = '<span class="numero">' + _contadorSessoesConcluidas + '</span>/' + total;
    el.title = _contadorSessoesConcluidas + ' de ' + total + ' sessões concluídas';
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
// Os IDs são SEMÂNTICOS (sem número). Reordenar sessões é mover
// linhas neste array — nada mais precisa mudar.
//
// `flatpakId`: quando presente, indica que o comando instala um app
// Flatpak com esse app-id. Usado por `verificarFlatpaksRemovidos()`
// para detectar remoções externas e restaurar o botão.

var SESSOES = [
    // ============================================================
    // SESSÃO 1 — PRIMEIROS PASSOS
    // Fusão da antiga 00-boas-vindas (atualização) + 03-repositorios.
    // ============================================================
    {
        id: 'primeiros-passos',
        nome: 'Primeiros Passos',
        nomeKey: 'sessoes.primeiros-passos.nome',
        comandos: {
            'atualizacao-inicial': { sempreClicavel: true },
            'rpm-fusion': {
                textoConcluido: '✅ RPM Fusion ativado',
                textoConcluidoKey: 'sessoes.primeiros-passos.texto_concluido_rpm'
            },
            'flatpak-setup': {
                textoConcluido: '✅ Flatpak configurado',
                textoConcluidoKey: 'sessoes.primeiros-passos.texto_concluido_flatpak'
            },
            'terra-repo': {
                textoConcluido: '✅ Terra Repository ativado',
                textoConcluidoKey: 'sessoes.primeiros-passos.texto_concluido_terra'
            },
            'terra-repo-remove': {
                textoConcluido: '✅ Terra Repository removido',
                textoConcluidoKey: 'sessoes.primeiros-passos.texto_concluido_terra_remove'
            },
            'terra-extras-install': {
                textoConcluido: '✅ Terra Extras ativado',
                textoConcluidoKey: 'sessoes.primeiros-passos.texto_concluido_terra_extras'
            },
            'terra-extras-remove': {
                textoConcluido: '✅ Terra Extras removido',
                textoConcluidoKey: 'sessoes.primeiros-passos.texto_concluido_terra_extras_remove'
            },
            'remover-repo-fedora-flatpak': {
                textoConcluido: '✅ Repositório Fedora Flatpak removido',
                textoConcluidoKey: 'sessoes.primeiros-passos.texto_concluido_remover_fedora_flatpak'
            }
        }
    },

// ============================================================
// SESSÃO 2 — CODECS E COMPATIBILIDADE
// ============================================================
{
    id: 'codecs',
    nome: 'Codecs e Compatibilidade',
    nomeKey: 'sessoes.codecs.nome',
    comandos: {
        'codecs-essenciais': {
            textoConcluido: '✅ Codecs instalados',
            textoConcluidoKey: 'sessoes.codecs.texto_concluido_codecs'
        },
        'extras-tainted': {
            textoConcluido: '✅ Extras instalados',
            textoConcluidoKey: 'sessoes.codecs.texto_concluido_extras'
        },
        'fontes-ms-all': {
            textoConcluido: '✅ Fontes MS instaladas',
            textoConcluidoKey: 'sessoes.codecs.texto_concluido_fontes'
        }
    }
},

// ============================================================
// SESSÃO 3 — HARDWARE
// Drivers gráficos AMD, NVIDIA e Intel. Os controles, periféricos
// e detecção de hardware vivem na sessão "Dispositivos e Periféricos".
// ============================================================
{
    id: 'hardware',
    nome: 'Hardware',
    nomeKey: 'sessoes.hardware.nome',
    comandos: {
        // --- AMD ---
        'vulkan-amd': {
            textoConcluido: '✅ Vulkan instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_vulkan'
        },
        'vaapi-amd': {
            textoConcluido: '✅ VA-API instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_vaapi'
        },
        'vaapi-swap': {
            textoConcluido: '✅ VA-API instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_vaapi'
        },
        'corectrl-install': {
            textoConcluido: '✅ CoreCtrl instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_corectrl'
        },
        'lact-install': {
            textoConcluido: '✅ LACT instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_lact'
        },
        'amdgpu-overclock': {
            textoConcluido: '✅ Overclock ativado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_overclock'
        },
        'amdgpu-overclock-remove': {
            textoConcluido: '✅ Overclock desativado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_overclock_remove'
        },
        // --- NVIDIA ---
        'nvidia-driver-install': {
            textoConcluido: '✅ Driver Nvidia instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_nvidia_driver'
        },
        // Botão de reverter — sempre clicável (reexecutável),
        // nunca "concluído". Precisa estar aqui para que
        // `_construirIdsValidos()` o conheça e `_limparIdsOrfaos()`
        // não o trate como fantasma se algum dia ele for gravado.
        'nvidia-driver-remove': { sempreClicavel: true },
        'nvidia-modeset-on': { sempreClicavel: true },
        'nvidia-modeset-off': { sempreClicavel: true },
        // --- Intel ---
        'intel-media-install': {
            textoConcluido: '🎬 Intel Media Driver instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_intel_media'
        }
    }
},

// ============================================================
// SESSÃO 4 — DISPOSITIVOS E PERIFÉRICOS
// Detecção de hardware, suplementos seguros, COPRs de comunidade
// e controles/periféricos.
// ============================================================
{
    id: 'dispositivos-perifericos',
    nome: 'Dispositivos e Periféricos',
    nomeKey: 'sessoes.dispositivos-perifericos.nome',
    comandos: {
        // --- Detecção (sempre clicável) ---
        'hw-scan': { sempreClicavel: true },

        // --- Suplementos seguros (toggle) ---
        'firmware-vendor-install': {
            textoConcluido: '✅ Firmwares adicionais instalados',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.texto_concluido_firmware_vendor'
        },
        'firmware-vendor-remove': {
            textoConcluido: '✅ Firmwares revertidos',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.texto_concluido_firmware_vendor_remove'
        },

        // --- Drivers de hardware (estado real via rpm -q) ---
        'driver-nvidia-install': { sempreClicavel: true, textoConcluido: '✅ Driver NVIDIA instalado' },
        'driver-nvidia-remove': { sempreClicavel: true },
        'driver-amd-vaapi-install': { sempreClicavel: true, textoConcluido: '✅ VA-API AMD instalado' },
        'driver-amd-vaapi-remove': { sempreClicavel: true },
        'driver-intel-media-install': { sempreClicavel: true, textoConcluido: '✅ Driver Intel Media instalado' },
        'driver-intel-media-remove': { sempreClicavel: true },
        'driver-realtek-r8168-install': { sempreClicavel: true, textoConcluido: '✅ Driver Realtek r8168 instalado' },
        'driver-realtek-r8168-remove': { sempreClicavel: true },

        // --- Drivers da comunidade (repo + pacote) ---
        'copr-openrazer-enable': {
            textoConcluido: '✅ Repositório ativado',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.btn_repo_ativado'
        },
        'driver-openrazer-install': {
            textoConcluido: '✅ Pacote instalado',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.btn_pacote_instalado'
        },
        'driver-openrazer-remove': {
            sempreClicavel: true,
            textoConcluido: '✅ Removido',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.btn_revertido'
        },

        'copr-xpadneo-enable': {
            textoConcluido: '✅ Repositório ativado',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.btn_repo_ativado'
        },
        'driver-xpadneo-install': {
            textoConcluido: '✅ Pacote instalado',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.btn_pacote_instalado'
        },
        'driver-xpadneo-remove': {
            sempreClicavel: true,
            textoConcluido: '✅ Removido',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.btn_revertido'
        },

        // Broadcom não tem repo separado (usa RPM Fusion da Sessão 1)
        'driver-broadcom-wl-install': {
            textoConcluido: '✅ Pacote instalado',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.btn_pacote_instalado'
        },
        'driver-broadcom-wl-remove': {
            textoConcluido: '✅ Removido',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.btn_revertido'
        },

        // --- Controles e periféricos (movidos de hardware) ---
        'input-group-add': {
            textoConcluido: '✅ Adicionado ao grupo input',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.texto_concluido_input_add'
        },
        'input-group-remove': {
            textoConcluido: '✅ Removido do grupo input',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.texto_concluido_input_remove'
        },
        'steam-devices-install': {
            textoConcluido: '✅ Steam Devices instalado',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.texto_concluido_steam_devices'
        },
        'steam-devices-remove': { sempreClicavel: true }
    }
},

// ============================================================
// SESSÃO 5 — PRODUÇÃO MULTIMÍDIA
// Ajustes de áudio (realtime, PipeWire) migraram para a sessão 11.
// ============================================================
{
    id: 'producao-multimidia',
    nome: 'Produção Multimídia',
    nomeKey: 'sessoes.producao-multimidia.nome',
    comandos: {
        'instalar-obs-studio': {
            textoConcluido: '✅ OBS Studio instalado',
            textoConcluidoKey: 'sessoes.producao-multimidia.texto_concluido_obs',
            flatpakId: 'com.obsproject.Studio'
        },
        'obs-cam': {
            textoConcluido: '✅ Câmera Virtual ativada',
            textoConcluidoKey: 'sessoes.producao-multimidia.texto_concluido_cam'
        },
        'instalar-easyeffects': {
            textoConcluido: '✅ EasyEffects instalado',
            textoConcluidoKey: 'sessoes.producao-multimidia.texto_concluido_easyeffects',
            flatpakId: 'com.github.wwmm.easyeffects'
        }
    }
},

// ============================================================
// SESSÃO 6 — APLICATIVOS RECOMENDADOS
// ============================================================
//
// ORIGEM DOS APPS (v1.0.0-10072026):
//
//   • Flatpak (Flathub): apps sem repo oficial no Fedora nem
//     pacote nos repos da distro. flatpakId presente.
//
//   • DNF (repos oficiais do Fedora): pacotes mantidos pela
//     própria distro. Sem flatpakId. Remoção via `dnf remove`.
//
//   • RPM via repo oficial do fabricante: navegadores (Opera,
//     Brave, Vivaldi, Edge). Sem flatpakId. A remoção desativa
//     o repo além de remover o pacote (ver a lixeira em
//     aplicativos.html).
//
//   • RPM baixado de URL (localpkg): ArtCraft, Lightworks,
//     Rclone Manager. Sem flatpakId. `--setopt=localpkg_gpgcheck=0`
//     obrigatório (Fedora 44/45 rejeitam RPM local sem assinatura
//     verificada e sem essa flag).
{
    id: 'aplicativos',
    nome: 'Aplicativos Recomendados',
    nomeKey: 'sessoes.aplicativos.nome',
    comandos: {
        'instalar-onlyoffice': { textoConcluido: '✅ OnlyOffice instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_onlyoffice', flatpakId: 'org.onlyoffice.desktopeditors' },
        'instalar-obsidian': { textoConcluido: '✅ Obsidian instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_obsidian', flatpakId: 'md.obsidian.Obsidian' },
        'instalar-joplin': { textoConcluido: '✅ Joplin instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_joplin', flatpakId: 'net.cozic.joplin_desktop' },
        'instalar-kate': { textoConcluido: '✅ Kate instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_kate' },
        'instalar-spotify': { textoConcluido: '✅ Spotify instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_spotify', flatpakId: 'com.spotify.Client' },
        'instalar-plex': { textoConcluido: '✅ Plex instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_plex', flatpakId: 'tv.plex.PlexDesktop' },
        'instalar-stremio': { textoConcluido: '✅ Stremio instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_stremio', flatpakId: 'com.stremio.Stremio' },
        'instalar-pinta': { textoConcluido: '✅ Pinta instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_pinta', flatpakId: 'com.github.PintaProject.Pinta' },
        'instalar-cura': { textoConcluido: '✅ Cura instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_cura', flatpakId: 'com.ultimaker.cura' },
        'instalar-upscayl': { textoConcluido: '✅ Upscayl instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_upscayl', flatpakId: 'org.upscayl.Upscayl' },
        'instalar-xnviewmp': { textoConcluido: '✅ XnView MP instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_xnviewmp', flatpakId: 'com.xnview.XnViewMP' },
        'instalar-zoom': { textoConcluido: '✅ Zoom instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_zoom', flatpakId: 'us.zoom.Zoom' },
        'instalar-discord': { textoConcluido: '✅ Discord instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_discord', flatpakId: 'com.discordapp.Discord' },
        'instalar-telegram': { textoConcluido: '✅ Telegram instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_telegram', flatpakId: 'org.telegram.desktop' },
        // v1.1.3: Kdenlive e Shotcut migrados para Flatpak (upstream mantém).
        'instalar-kdenlive': { textoConcluido: '✅ Kdenlive instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_kdenlive', flatpakId: 'org.kde.kdenlive' },
        'instalar-shotcut': { textoConcluido: '✅ Shotcut instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_shotcut', flatpakId: 'org.shotcut.Shotcut' },
        'instalar-openshot': { textoConcluido: '✅ OpenShot instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_openshot', flatpakId: 'org.openshot.OpenShot' },
        'instalar-drift': { textoConcluido: '✅ Drift instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_drift', flatpakId: 'org.cutwire.Drift' },
        // RustDesk migrado para RPM via URL direta do GitHub.
        'instalar-rustdesk': { textoConcluido: '✅ RustDesk instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_rustdesk' },

        // --- DNF (repos oficiais do Fedora) ---
        'instalar-thunderbird': { textoConcluido: '✅ Thunderbird instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_thunderbird' },
        'instalar-okular': { textoConcluido: '✅ Okular instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_okular' },
        'instalar-foliate': { textoConcluido: '✅ Foliate instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_foliate' },
        // v1.1.3: Haruna e VLC migrados para Flatpak.
        'instalar-haruna': { textoConcluido: '✅ Haruna instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_haruna', flatpakId: 'org.kde.haruna' },
        'instalar-vlc': { textoConcluido: '✅ VLC instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_vlc', flatpakId: 'org.videolan.VLC' },
        'instalar-mpv': { textoConcluido: '✅ MPV instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_mpv' },
        'instalar-krita': { textoConcluido: '✅ Krita instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_krita' },
        'instalar-inkscape': { textoConcluido: '✅ Inkscape instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_inkscape' },
        'instalar-gimp': { textoConcluido: '✅ GIMP instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_gimp' },
        'instalar-darktable': { textoConcluido: '✅ Darktable instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_darktable' },
        'instalar-freecad': { textoConcluido: '✅ FreeCAD instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_freecad', flatpakId: 'org.freecad.FreeCAD' },
        'instalar-librecad': { textoConcluido: '✅ LibreCAD instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_librecad' },
        'instalar-pitivi': { textoConcluido: '✅ Pitivi instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_pitivi' },
        // v1.1.3: Blender e Audacity migrados para Flatpak.
        'instalar-blender': { textoConcluido: '✅ Blender instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_blender', flatpakId: 'org.blender.Blender' },
        'instalar-audacity': { textoConcluido: '✅ Audacity instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_audacity', flatpakId: 'org.audacityteam.Audacity' },
        'instalar-ardour': { textoConcluido: '✅ Ardour instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_ardour' },
        'instalar-lmms': { textoConcluido: '✅ LMMS instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_lmms' },
        'instalar-chromium': { textoConcluido: '✅ Chromium instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_chromium' },

        // --- RPM via repo oficial do fabricante ---
        'instalar-opera': { textoConcluido: '✅ Opera instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_opera', flatpakId: 'com.opera.Opera' },
        'instalar-brave': { textoConcluido: '✅ Brave instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_brave' },
        'instalar-vivaldi': { textoConcluido: '✅ Vivaldi instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_vivaldi' },
        'instalar-edge': { textoConcluido: '✅ Microsoft Edge instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_edge' },

        // --- Casos especiais ---
        'instalar-affinity': { sempreClicavel: true },
        'instalar-remmina': { textoConcluido: '✅ Remmina instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_remmina' },
        'instalar-gnome-connections': { textoConcluido: '✅ GNOME Connections instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_gnome_connections' },
        'instalar-krdc': { textoConcluido: '✅ KRDC instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_krdc' },

        // --- Suíte ArtCraft (RPMs do GitHub oficial) ---
        'instalar-photocraft':  { textoConcluido: '✅ PhotoCraft instalado',  textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_photocraft' },
        'instalar-vectorcraft': { textoConcluido: '✅ VectorCraft instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_vectorcraft' },
        'instalar-filmcraft':   { textoConcluido: '✅ FilmCraft instalado',   textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_filmcraft' },
        'instalar-lightcraft':  { textoConcluido: '✅ LightCraft instalado',  textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_lightcraft' },
        'instalar-pdfcraft':    { textoConcluido: '✅ PDFCraft instalado',    textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_pdfcraft' },
        'instalar-effectcraft': { textoConcluido: '✅ EffectCraft instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_effectcraft' },
        'instalar-designcraft': { textoConcluido: '✅ DesignCraft instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_designcraft' },
        'instalar-figcraft':    { textoConcluido: '✅ FigCraft instalado',    textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_figcraft' },
        'instalar-deckcraft':   { textoConcluido: '✅ DeckCraft instalado',   textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_deckcraft' },
        'instalar-gridcraft':   { textoConcluido: '✅ GridCraft instalado',   textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_gridcraft' },
        'instalar-wordcraft':   { textoConcluido: '✅ WordCraft instalado',   textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_wordcraft' },
        'instalar-cadcraft':    { textoConcluido: '✅ CadCraft instalado',    textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_cadcraft' },
        'instalar-soundcraft':  { textoConcluido: '✅ SoundCraft instalado',  textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_soundcraft' },

        // --- RPM baixado de URL (localpkg) ---
        'instalar-lightworks': { textoConcluido: '✅ Lightworks instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_lightworks' },
        'instalar-rclone-manager': {
            textoConcluido: '✅ Rclone Manager instalado',
            textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_rclone_manager'
        },
        'desfazer-rclone-manager': { sempreClicavel: true },
        'instalar-lightworks-remove': { sempreClicavel: true }
    }
},

// ============================================================
// SESSÃO 7 — CASA E ESCRITÓRIO
// Conteúdo integral da antiga 10-casa-pronta.
// ============================================================
{
    id: 'casa-escritorio',
    nome: 'Casa e Escritório',
    nomeKey: 'sessoes.casa-escritorio.nome',
    comandos: {
        'cups-install': {
            textoConcluido: '✅ Impressora configurada',
            textoConcluidoKey: 'sessoes.casa-escritorio.texto_concluido_cups'
        },
        'samba-install': {
            textoConcluido: '✅ Samba instalado',
            textoConcluidoKey: 'sessoes.casa-escritorio.texto_concluido_samba'
        },
        'localsend-install': {
            textoConcluido: '✅ LocalSend instalado',
            textoConcluidoKey: 'sessoes.casa-escritorio.texto_concluido_localsend',
            flatpakId: 'org.localsend.localsend_app'
        },
        'warpinator-install': {
            textoConcluido: '✅ Warpinator instalado',
            textoConcluidoKey: 'sessoes.casa-escritorio.texto_concluido_warpinator',
            flatpakId: 'org.x.Warpinator'
        },
        'keepassxc-install': {
            textoConcluido: '✅ KeePassXC instalado',
            textoConcluidoKey: 'sessoes.casa-escritorio.texto_concluido_keepassxc'
        },
        'samba-remove': { sempreClicavel: true },
        'keepassxc-remove': { sempreClicavel: true }
    }
},

// ============================================================
// SESSÃO 8 — GAMING
// Bufferbloat removido nesta versão.
// ============================================================
{
    id: 'gaming',
    nome: 'Gaming',
    nomeKey: 'sessoes.gaming.nome',
    comandos: {
        // --- Launchers ---
        'steam-install': {
            textoConcluido: '✅ Steam instalado',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_steam'
        },
        'heroic-install': {
            textoConcluido: '✅ Heroic instalado',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_heroic',
            flatpakId: 'com.heroicgameslauncher.hgl'
        },
        'lutris-install': {
            textoConcluido: '✅ Lutris instalado',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_lutris',
            flatpakId: 'net.lutris.Lutris'
        },
        // --- Compatibilidade ---
        'wine-install': { textoConcluido: '✅ Wine instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_wine' },
        'winetricks-install': { textoConcluido: '✅ Winetricks instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_winetricks' },
        'bottles-install': {
            textoConcluido: '✅ Bottles instalado',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_bottles',
            flatpakId: 'com.usebottles.bottles'
        },
        'ntsync-install': { textoConcluido: '✅ NTSYNC instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_ntsync' },
        // --- Performance ---
        'gamemode-install': { textoConcluido: '✅ GameMode ativado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_gamemode' },
        'mangohud-install': { textoConcluido: '✅ MangoHud instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_mangohud' },
        'goverlay-install': { textoConcluido: '✅ Goverlay instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_goverlay' },
        'gamescope-install': { textoConcluido: '✅ Gamescope instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_gamescope' },
        // --- Gaming Avançado ---
        'protonup-qt-install': {
            textoConcluido: '✅ ProtonUp-Qt instalado',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_protonup',
            flatpakId: 'net.davidotek.pupgui2'
        },
        'vkbasalt-install': { textoConcluido: '✅ vkBasalt instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_vkbasalt' },
        'gamemode-presets-apply': { textoConcluido: '✅ Presets aplicados' },
        'controller-test-install': { textoConcluido: '✅ Ferramenta instalada', textoConcluidoKey: 'sessoes.gaming.texto_concluido_controller_test' },
        // --- Emuladores ---
        'retroarch-install': {
            textoConcluido: '✅ RetroArch instalado',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_retroarch',
            flatpakId: 'org.libretro.RetroArch'
        },
        'dolphin-install': {
            textoConcluido: '✅ Dolphin instalado',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_dolphin',
            flatpakId: 'org.DolphinEmu.dolphin-emu'
        },
        'pcsx2-install': {
            textoConcluido: '✅ PCSX2 instalado',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_pcsx2',
            flatpakId: 'net.pcsx2.PCSX2'
        },
        'rpcs3-install': {
            textoConcluido: '✅ RPCS3 instalado',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_rpcs3',
            flatpakId: 'net.rpcs3.RPCS3'
        },
        'duckstation-install': {
            textoConcluido: '✅ Duckstation instalado',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_duckstation',
            flatpakId: 'org.duckstation.DuckStation'
        },
        'wine-remove': { sempreClicavel: true },
        'winetricks-remove': { sempreClicavel: true },
        'gamemode-remove': { sempreClicavel: true },
        'mangohud-remove': { sempreClicavel: true },
        'goverlay-remove': { sempreClicavel: true },
        'gamescope-remove': { sempreClicavel: true },
        'vkbasalt-remove': { sempreClicavel: true },
        'controller-test-remove': { sempreClicavel: true },
        'desfazer-ntsync': { sempreClicavel: true }
    }
},

// ============================================================
// SESSÃO 9 — WAYDROID
// ============================================================
{
    id: 'waydroid',
    nome: 'Waydroid',
    nomeKey: 'sessoes.waydroid.nome',
    comandos: {
        'waydroid-install': { textoConcluido: '✅ Waydroid instalado', textoConcluidoKey: 'sessoes.waydroid.texto_concluido_waydroid' },
        'waydroid-init': { textoConcluido: '✅ Waydroid inicializado', textoConcluidoKey: 'sessoes.waydroid.texto_concluido_init' },
        'waydroid-uninstall': { sempreClicavel: true },
        'waydroid-extras-prep': { textoConcluido: '✅ Ambiente preparado', textoConcluidoKey: 'sessoes.waydroid.texto_concluido_prep' },
        'waydroid-gapps': { textoConcluido: '✅ GApps instalado', textoConcluidoKey: 'sessoes.waydroid.texto_concluido_gapps' },
        'waydroid-libndk': { textoConcluido: '✅ libndk instalado', textoConcluidoKey: 'sessoes.waydroid.texto_concluido_libndk' },
        'waydroid-libhoudini': { textoConcluido: '✅ libhoudini instalado', textoConcluidoKey: 'sessoes.waydroid.texto_concluido_libhoudini' },
        'waydroid-magisk': { textoConcluido: '✅ Magisk instalado', textoConcluidoKey: 'sessoes.waydroid.texto_concluido_magisk' },
        'waydroid-widevine': { textoConcluido: '✅ Widevine instalado', textoConcluidoKey: 'sessoes.waydroid.texto_concluido_widevine' },
        'waydroid-smartdock': { textoConcluido: '✅ SmartDock instalado', textoConcluidoKey: 'sessoes.waydroid.texto_concluido_smartdock' },
        'waydroid-helper-install': { textoConcluido: '✅ waydroid-helper instalado', textoConcluidoKey: 'sessoes.waydroid.texto_concluido_helper_install' },
        'waydroid-helper-open': { sempreClicavel: true },
        'waydroid-prefs': { textoConcluido: '✅ Preferências aplicadas', textoConcluidoKey: 'sessoes.waydroid.texto_concluido_prefs' }
    }
},

// ============================================================
// SESSÃO 10 — VIRTUALIZAÇÃO
// QEMU/KVM, VirtualBox e GNOME Boxes.
// As remoções agora usam lixeiras (helper global em script.js).
// ============================================================
{
    id: 'virtualizacao',
    nome: 'Virtualização',
    nomeKey: 'sessoes.virtualizacao.nome',
    comandos: {
        'qemu-kvm-install': {
            textoConcluido: '✅ QEMU/KVM instalado',
            textoConcluidoKey: 'sessoes.virtualizacao.texto_concluido_qemu'
        },
        'qemu-kvm-remove': { sempreClicavel: true },
        'virtualbox-install': {
            textoConcluido: '✅ VirtualBox instalado',
            textoConcluidoKey: 'sessoes.virtualizacao.texto_concluido_virtualbox'
        },
        'virtualbox-remove': { sempreClicavel: true },
        'gnome-boxes-install': {
            textoConcluido: '✅ GNOME Boxes instalado',
            textoConcluidoKey: 'sessoes.virtualizacao.texto_concluido_boxes'
        },
        'gnome-boxes-remove': { sempreClicavel: true }
    }
},

// ============================================================
// SESSÃO 11 — DIAGNÓSTICO
// Baobab removido nesta versão.
// ============================================================
{
    id: 'diagnostico',
    nome: 'Diagnóstico',
    nomeKey: 'sessoes.diagnostico.nome',
    comandos: {
        'diag-refresh': { sempreClicavel: true },
        'gsmartcontrol-install': {
            textoConcluido: '✅ GSmartControl instalado',
            textoConcluidoKey: 'sessoes.diagnostico.texto_concluido_gsmartcontrol'
        },
        'coolercontrol-install': {
            textoConcluido: '✅ CoolerControl instalado',
            textoConcluidoKey: 'sessoes.diagnostico.texto_concluido_coolercontrol'
        },
        'journal-errors-check': { sempreClicavel: true }
    }
},

// ============================================================
// SESSÃO 12 — AJUSTES E MANUTENÇÃO
// Fusão da antiga 02-otimizacao + ajustes de áudio da 07-loja
// + acórdeão "Manutenção do Fedora" da antiga manutencao.html.
// ============================================================
{
    id: 'ajustes-manutencao',
    nome: 'Ajustes e Manutenção',
    nomeKey: 'sessoes.ajustes-manutencao.nome',
    comandos: {
        // --- Ajustes de desempenho ---
        'vm-max-map-count': { textoConcluido: '✅ Ajuste aplicado', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_vm_max_map_count' },
        'vm-max-map-count-remove': { textoConcluido: '✅ Ajuste revertido', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_vm_max_map_count_remove' },
        'vm-swappiness-cache': { textoConcluido: '✅ Ajuste aplicado', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_vm_swappiness_cache' },
        'vm-swappiness-cache-remove': { textoConcluido: '✅ Ajuste revertido', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_vm_swappiness_cache_remove' },
        'tcp-bbr': { textoConcluido: '✅ TCP BBR ativado', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_tcp_bbr' },
        'tcp-bbr-remove': { textoConcluido: '✅ TCP BBR desativado', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_tcp_bbr_remove' },
        // --- Ajustes de áudio ---
        'realtime-setup': { textoConcluido: '✅ Grupo realtime configurado', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_realtime_setup' },
        'realtime-setup-remove': { textoConcluido: '✅ Grupo realtime removido', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_realtime_setup_remove' },
        'pipewire-quantum-low': { textoConcluido: '✅ Baixa latência ativada', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_pipewire_quantum' },
        'pipewire-quantum-low-remove': { textoConcluido: '✅ Latência padrão restaurada', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_pipewire_quantum_remove' },
        // --- DNF / Idioma / Dual-boot ---
        'dnf-speed': { sempreClicavel: true },
        'idioma-packs': { textoConcluido: '✅ Tradução instalada', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_packs' },
        'idioma-hunspell': { textoConcluido: '✅ Corretor instalado', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_hunspell' },
        'idioma-localectl': { textoConcluido: '✅ Localidade configurada', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_localectl' },
        // Dual-boot: par toggle com detecção real via `SystemState.localRtc()`.
        // O texto de concluído é usado pelo aplicarEstadoToggle quando
        // o par está marcado como feito. `dual-boot-time-remove` volta
        // para UTC.
        'dual-boot-time': {
            textoConcluido: '✅ Relógio em horário local',
            textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_dual_boot'
        },
        'dual-boot-time-remove': {
            textoConcluido: '✅ Relógio em UTC',
            textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_dual_boot_remove'
        },
        // --- Manutenção do Fedora ---
        'limpeza-sistema': {
            sempreClicavel: true,
            textoConcluido: '✅ Limpeza concluída',
            textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_limpeza'
        },
        'listar-kernels': { sempreClicavel: true },
        'remover-kernel': { sempreClicavel: true },
        'grub-aplicar-recomendado': {
            textoConcluido: '✅ Configuração aplicada',
            textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_grub_aplicar'
        },
        'grub-restaurar-backup': {
            sempreClicavel: true,
            textoConcluido: '✅ Padrão restaurado',
            textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_grub_restaurar'
        }
    }
},

// ============================================================
// SESSÃO 13 — ESTADO DO FEDORA
// ============================================================
{
    id: 'estado-fedora',
    nome: 'Estado do Fedora',
    nomeKey: 'sessoes.estado-fedora.nome',
    comandos: {
        'fedora-version-check': { sempreClicavel: true },
        'atomic-check': { sempreClicavel: true },
        'selinux-status-check': { sempreClicavel: true },
        'selinux-troubleshoot': { sempreClicavel: true },
        'selinux-setroubleshoot-install': {
            textoConcluido: '✅ setroubleshoot instalado',
            textoConcluidoKey: 'sessoes.estado-fedora.texto_concluido_setroubleshoot'
        },
        'selinux-gui-install': {
            textoConcluido: '✅ Gerenciador SELinux instalado',
            textoConcluidoKey: 'sessoes.estado-fedora.texto_concluido_selinux_gui'
        }
    }
},

// ============================================================
// SESSÃO 14 — SOBRE O FAP
// Sobre do FAP + Manutenção do FAP (atualizar, desinstalar, changelog).
// ============================================================
{
    id: 'sobre-fap',
    nome: 'Sobre o FAP',
    nomeKey: 'sessoes.sobre-fap.nome',
    comandos: {
        'atualizar-fap': {
            sempreClicavel: true,
            textoConcluido: '✅ FAP atualizado',
            textoConcluidoKey: 'sessoes.sobre-fap.texto_concluido_fap_atualizar'
        },
        'desinstalar-fap': {
            textoConcluido: '✅ FAP desinstalado',
            textoConcluidoKey: 'sessoes.sobre-fap.texto_concluido_fap_desinstalar'
        }
    }
}
];

var SESSOES_PRINCIPAIS = SESSOES.map(function(s) { return s.id; });

// ============================================================
// CONJUNTO DE IDs VÁLIDOS (para limpeza de órfãos)
// ============================================================
//
// Constrói um Set com todos os idComando atualmente registrados em
// SESSOES. Usado por `_limparIdsOrfaos()` para remover do progresso
// qualquer entrada que não exista mais (sessões renomeadas,
// comandos removidos, etc.).
//
// Memoizado: SESSOES é constante em runtime, então o Set só é
// construído uma vez por carregamento de página.

var _idsValidosCache = null;

function _construirIdsValidos() {
    if (_idsValidosCache) return _idsValidosCache;
    var set = new Set();
    for (var i = 0; i < SESSOES.length; i++) {
        var comandos = SESSOES[i].comandos || {};
        Object.keys(comandos).forEach(function(id) { set.add(id); });
    }
    _idsValidosCache = set;
    return set;
}

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

// ============================================================
// MAPA idComando → sessaoId
// ============================================================
//
// Permite responder "a qual sessão pertence este comando?" em O(1).
// Usado pelo bloqueio de navegação, para saber se há algum comando
// rodando na sessão atual.
//
// Construído uma única vez, a partir do array SESSOES.

var _mapaComandoParaSessao = (function() {
    var mapa = {};
    for (var i = 0; i < SESSOES.length; i++) {
        var comandos = SESSOES[i].comandos || {};
        var ids = Object.keys(comandos);
        for (var j = 0; j < ids.length; j++) {
            mapa[ids[j]] = SESSOES[i].id;
        }
    }
    return mapa;
})();

function _sessaoDoComando(idComando) {
    return _mapaComandoParaSessao[idComando] || null;
}

// Retorna o id da sessão atual, lendo o DOM. Devolve null se não
// for possível determinar (por exemplo, antes do menu ser criado).
function _sessaoAtualId() {
    var ativa = document.querySelector('.session-menu-item.ativa');
    if (!ativa) return null;
    return ativa.getAttribute('data-sessao');
}

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
//
// Atributos separados dos usados pelo bloqueio entre sessões:
//   - `data-sessao-bloqueado` + `data-was-disabled-sessao`
//   - `data-cross-sessao-bloqueado` + `data-was-disabled-cross`
//
// Antes, os dois compartilhavam `data-was-disabled`, o que causava
// uma race entre `_liberarSessao` e `_liberarOutrasSessoes`: o
// primeiro consumia o atributo e o segundo lia `disabled=false`,
// habilitando botões que deveriam continuar desabilitados.

function _bloquearSessao(idComando) {
    var btn = document.getElementById('btn-' + idComando);
    if (!btn) return;
    var sessaoContainer = btn.closest('.sessao-container');
    if (!sessaoContainer) return;

    // Inclui .btn-flatpak-uninstall: os ícones de lixeira também
    // precisam ser bloqueados durante uma execução em andamento.
    var botoes = sessaoContainer.querySelectorAll('.btn-executar, .btn-reverter, .btn-flatpak-uninstall');
    botoes.forEach(function(b) {
        if (b.id === 'btn-' + idComando) return;
        if (b.hasAttribute('data-sessao-bloqueado')) return;
        b.setAttribute('data-was-disabled-sessao', b.disabled ? '1' : '0');
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
        var wasDisabled = b.getAttribute('data-was-disabled-sessao') === '1';
        b.removeAttribute('data-sessao-bloqueado');
        b.removeAttribute('data-was-disabled-sessao');
        b.disabled = wasDisabled;
        b.style.opacity = '';
        b.style.pointerEvents = '';
    });
}

// ============================================================
// BLOQUEIO ENTRE SESSÕES
// ============================================================
//
// Quando um comando dnf/rpm/copr está rodando em uma sessão, os
// botões de dnf/rpm das outras sessões também precisam ficar
// travados. Sem isso, o usuário pode disparar dois `dnf install`
// em sessões diferentes — e o rpm trava por conflito de lock.
//
// O bloqueio NÃO afeta:
// - Botões de flatpak (a fila cuida deles).
// - Botões com `flatpakId` no registro (instalam flatpak).
// - Botões com `sempreClicavel: true` (read-only ou reexecutáveis).
//
// Os botões são identificados pelo `data-comando` no HTML. Como
// cada botão é montado dinamicamente pela sessão carregada, o
// bloqueio roda sobre o documento inteiro (não só a sessão atual).

var _comandoDnfRodando = null;

// Decide se um idComando deve ser bloqueado durante a execução de
// um comando dnf/rpm em outra sessão.
function _deveBloquearDuranteDnf(idComando) {
    // O próprio comando que está rodando nunca é bloqueado.
    if (idComando === _comandoDnfRodando) return false;

    var info = _infoComando(idComando);
    if (!info) return false;

    // Flatpak → não bloqueia (a fila cuida).
    if (info.flatpakId) return false;

    // Sempre clicável → não bloqueia (read-only ou reexecutável).
    if (info.sempreClicavel) return false;

    // Todo o resto é dnf/rpm/copr → bloqueia.
    //
    // NOTA: o check antigo `idComando.slice(-5) === '-open'` foi
    // removido — nenhum `data-comando` no DOM termina em `-open`.
    // O sufixo `-open` só existe no idComando enviado ao backend
    // por `abrirFerramentaExterna`, nunca como atributo no HTML.
    return true;
}

// Aplica o bloqueio em todos os botões dnf/rpm de todas as
// sessões carregadas (não apenas a atual).
function _bloquearOutrasSessoes(idComandoDnf) {
    _comandoDnfRodando = idComandoDnf;

    var botoes = document.querySelectorAll('.btn-executar[data-comando]');
    botoes.forEach(function(b) {
        var id = b.getAttribute('data-comando');
        if (!id) return;
        if (!_deveBloquearDuranteDnf(id)) return;

        // Ignora os que já estão bloqueados pelo sistema cruzado.
        if (b.hasAttribute('data-cross-sessao-bloqueado')) return;

        // Ignora os que já estão bloqueados pelo sistema DA SESSÃO.
        // Sem este guard, um botão da sessão atual (não o que está
        // rodando) seria bloqueado pelos DOIS sistemas: o de sessão
        // captura `data-was-disabled-sessao='0'` corretamente, mas
        // este bloco sobrescreve a percepção do estado — capturando
        // `data-was-disabled-cross='1'` porque o botão JÁ está
        // desabilitado quando este loop roda. Na liberação, o
        // `_liberarOutrasSessoes` leria `'1'` e re-desabilitaria o
        // botão, deixando-o travado até reload.
        if (b.hasAttribute('data-sessao-bloqueado')) return;

        b.setAttribute('data-was-disabled-cross', b.disabled ? '1' : '0');
        b.setAttribute('data-cross-sessao-bloqueado', '1');
        b.disabled = true;
        b.style.opacity = '0.4';
        b.style.pointerEvents = 'none';
    });
}

// Libera todos os botões bloqueados pelo bloqueio entre sessões.
function _liberarOutrasSessoes() {
    _comandoDnfRodando = null;

    var botoes = document.querySelectorAll('[data-cross-sessao-bloqueado="1"]');
    botoes.forEach(function(b) {
        var wasDisabled = b.getAttribute('data-was-disabled-cross') === '1';
        b.removeAttribute('data-cross-sessao-bloqueado');
        b.removeAttribute('data-was-disabled-cross');
        b.disabled = wasDisabled;
        b.style.opacity = '';
        b.style.pointerEvents = '';
    });
}

// Re-aplica o bloqueio entre sessões quando uma sessão nova é
// carregada. Isso é necessário porque a navegação entre sessões
// (guiado.html) injeta HTML dinamicamente — os botões das outras
// sessões só existem no DOM depois de a sessão ser carregada.
//
// Sem isso, o bloqueio entre sessões só funciona se o usuário
// navegar para outra sessão ANTES de iniciar o comando — o que é
// raro.
function _reaplicarBloqueioSeNecessario() {
    if (!_comandoDnfRodando) return;

    var botoes = document.querySelectorAll('.btn-executar[data-comando]');
    botoes.forEach(function(b) {
        var id = b.getAttribute('data-comando');
        if (!id) return;
        if (!_deveBloquearDuranteDnf(id)) return;

        // Mesmos guards do `_bloquearOutrasSessoes`. Botões já
        // bloqueados por qualquer um dos dois sistemas são
        // ignorados — evita capturar o estado "errado" no
        // `data-was-disabled-cross`.
        if (b.hasAttribute('data-cross-sessao-bloqueado')) return;
        if (b.hasAttribute('data-sessao-bloqueado')) return;

        b.setAttribute('data-was-disabled-cross', b.disabled ? '1' : '0');
        b.setAttribute('data-cross-sessao-bloqueado', '1');
        b.disabled = true;
        b.style.opacity = '0.4';
        b.style.pointerEvents = 'none';
    });
}

// ============================================================
// BLOQUEIO DE NAVEGAÇÃO ENTRE SESSÕES
// ============================================================
//
// Enquanto houver QUALQUER comando rodando pertencente à sessão
// atualmente visível, o usuário não pode trocar de sessão.
//
// Motivo: as variáveis globais dos scripts inline de cada sessão
// (APPS_FLATPAK, _svgLixeira, instalarFlatpak, etc.) têm os mesmos
// nomes em sessões diferentes. Se o usuário sai da Sessão 6 no meio
// de uma instalação e volta depois, o eval da Sessão 7 (que ele
// visitou no meio) teria sobrescrito essas variáveis — e o botão da
// Sessão 6 passaria a usar o `APPS_FLATPAK` da Sessão 7.
//
// Também evita que o usuário perca o progresso visual de uma fila
// em andamento (o log e a posição na fila ficariam órfãos ao sair).
//
// ESCOPO DO BLOQUEIO
// ------------------
// O bloqueio é POR SESSÃO, não global. Isso significa:
//
//   • Usuário clica em "Instalar VLC" na Sessão 6 (Aplicativos).
//   • Chips do menu e botões Anterior/Próximo travam.
//   • Usuário NÃO pode trocar de sessão enquanto o VLC instala.
//   • Quando o VLC termina, os controles voltam a funcionar.
//
// A fonte de verdade para "há comando rodando na sessão atual" é
// uma combinação de três checagens independentes, avaliadas em
// ordem de custo (barato → caro):
//
//   1. `_comandoDnfRodando` — comando dnf/rpm/copr em execução.
//   2. `_flatpakRodando` + `_filaFlatpaks` — flatpak em execução
//      (mais os flatpaks enfileirados pertencentes à sessão atual).
//   3. Barras de progresso visíveis e NÃO concluídas no DOM da
//      sessão atual. Cobre fluxos que não passam pelo
//      `executarComandoGenerico` (ex.: "Atualizar Fedora" em
//      primeiros-passos.html, que tem fluxo próprio).
//
// Se QUALQUER uma dessas três for verdadeira para a sessão atual,
// a navegação fica bloqueada.
//
// Elementos bloqueados:
// - Chips do menu do topo (.session-menu-item).
// - Botões Anterior e Próximo.
//
// Elementos NÃO bloqueados:
// - Tema, idioma, menu "voltar ao início", badge de atualização.

var _navegacaoBloqueada = false;

// Decide se a navegação deve estar bloqueada. Verdadeiro se
// houver QUALQUER comando rodando pertencente à sessão atual.
function _deveBloquearNavegacao() {
    var sessaoAtual = _sessaoAtualId();
    if (!sessaoAtual) return false;

    // 1. dnf/rpm/copr rodando na sessão atual?
    //    O `_comandoDnfRodando` já registra o idComando, então
    //    basta cruzar com o mapa de comando → sessão.
    if (_comandoDnfRodando) {
        var sessaoDnf = _sessaoDoComando(_comandoDnfRodando);
        if (sessaoDnf === sessaoAtual) return true;
    }

    // 2. flatpak rodando na sessão atual?
    //    Mesma lógica do dnf: o `_flatpakRodando` é o idComando
    //    do flatpak em execução. Quando termina, volta a `null`.
    if (typeof _flatpakRodando !== 'undefined' && _flatpakRodando) {
        var sessaoFp = _sessaoDoComando(_flatpakRodando);
        if (sessaoFp === sessaoAtual) return true;
    }

    // 2b. Há itens da fila pertencentes à sessão atual?
    //     Mesmo que o flatpak em execução seja de outra sessão,
    //     se houver itens enfileirados da sessão atual, o usuário
    //     não deve sair — perderia a posição na fila.
    if (typeof _filaFlatpaks !== 'undefined' && _filaFlatpaks.length > 0) {
        for (var i = 0; i < _filaFlatpaks.length; i++) {
            var sessaoItem = _sessaoDoComando(_filaFlatpaks[i].idComando);
            if (sessaoItem === sessaoAtual) return true;
        }
    }

    // 3. Rede de segurança: barra de progresso visível e NÃO
    //    concluída na sessão atual. Cobre fluxos que não passam
    //    por `executarComandoGenerico` — notadamente o botão
    //    "Atualizar Fedora" da sessão 1, que tem fluxo próprio.
    //
    //    A classe `.concluido` é adicionada por `completarProgresso`
    //    ao terminar o comando. Ignoramos essas barras — assim o
    //    usuário pode navegar imediatamente após o término, mesmo
    //    enquanto a barra ainda está visível (ela some após 5s).
    var sessaoContainer = document.querySelector('.sessao-container');
    if (sessaoContainer) {
        var barras = sessaoContainer.querySelectorAll('.progress-container:not(.concluido)');
        for (var j = 0; j < barras.length; j++) {
            var b = barras[j];
            if (b.style.display && b.style.display !== 'none') {
                return true;
            }
        }
    }

    return false;
}

// Aplica ou remove o bloqueio visual da navegação, de acordo
// com o estado atual. Idempotente.
function _atualizarBloqueioNavegacao() {
    var deveBloquear = _deveBloquearNavegacao();

    // Se o estado não mudou, não mexe no DOM.
    if (deveBloquear === _navegacaoBloqueada) return;
    _navegacaoBloqueada = deveBloquear;

    var menuItens = document.querySelectorAll('.session-menu-item');
    var btnAnterior = document.getElementById('btn-anterior');
    var btnProximo = document.getElementById('btn-proximo');

    var titleTexto = _t('comum.navegacao_bloqueada',
                        'Aguarde o término dos comandos desta sessão para trocar de sessão.');

    menuItens.forEach(function(item) {
        if (deveBloquear) {
            item.classList.add('bloqueado');
            item.setAttribute('aria-disabled', 'true');
            item.setAttribute('title', titleTexto);
        } else {
            item.classList.remove('bloqueado');
            item.removeAttribute('aria-disabled');
            // O title original era o nome da sessão — restaura
            var sessaoId = item.dataset.sessao;
            if (sessaoId && typeof nomeDaSessao === 'function') {
                item.setAttribute('title', nomeDaSessao(sessaoId));
            }
        }
    });

    if (btnAnterior && deveBloquear) btnAnterior.disabled = true;
    if (btnProximo && deveBloquear) btnProximo.disabled = true;

    // Quando libera, restaura o estado correto dos botões conforme
    // a posição da sessão atual (o primeiro não tem Anterior, o
    // último não tem Próximo).
    if (!deveBloquear) {
        if (typeof SESSOES_PRINCIPAIS !== 'undefined' && typeof sessaoAtual !== 'undefined') {
            var total = SESSOES_PRINCIPAIS.length;
            if (btnAnterior) btnAnterior.disabled = (sessaoAtual === 0);
            if (btnProximo) btnProximo.disabled = (sessaoAtual === total - 1);
        }
    }
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
    await _limparIdsOrfaos();
    _atualizarProgressoGlobal();
}

// ============================================================
// LIMPEZA DE IDs ÓRFÃOS
// ============================================================
//
// Remove do progresso persistido qualquer idComando que não esteja
// mais registrado em SESSOES. Acontece quando:
// - uma sessão é renomeada (ids antigos como '04-fontes' viram órfãos)
// - um comando é removido (ex.: 'btrfs-install', 'bufferbloat-test')
// - uma sessão é excluída por completo
//
// Sem isso, o .progresso.json acumula IDs fantasmas para sempre, e
// o contador global de sessões concluídas passa a mentir.
//
// Chamada em carregarProgressoInicial(), que roda no boot e a cada
// sessão carregada. Como é chamada 3x no boot (DOMContentLoaded,
// sessao-carregada com timeout, todas-sessoes-carregadas), usa um
// throttle de 5s para evitar fetches redundantes.

var _ultimaLimpezaOrfaos = 0;
var _limpezaOrfaosRodando = false;

async function _limparIdsOrfaos() {
    // Throttle: se rodou nos últimos 5s, ignora. O progresso não
    // muda em rajada durante o boot, então repetir a limpeza é
    // desnecessário.
    var agora = Date.now();
    if (agora - _ultimaLimpezaOrfaos < 5000) return;
    if (_limpezaOrfaosRodando) return;

    _limpezaOrfaosRodando = true;
    _ultimaLimpezaOrfaos = agora;

    try {
        var validos = _construirIdsValidos();
        var progress = await getProgress();

        var execAntes = progress.executados.length;
        var pulAntes = progress.pulados.length;

        var execNovos = progress.executados.filter(function(id) { return validos.has(id); });
        var pulNovos = progress.pulados.filter(function(id) { return validos.has(id); });

        if (execNovos.length === execAntes && pulNovos.length === pulAntes) {
            return; // nada a fazer
        }

        progress.executados = execNovos;
        progress.pulados = pulNovos;
        await saveProgress(progress);

        console.log('🧹 IDs órfãos removidos: ' +
        (execAntes - execNovos.length) + ' executados, ' +
        (pulAntes - pulNovos.length) + ' pulados');
    } finally {
        _limpezaOrfaosRodando = false;
    }
}

// Usa progressCache quando já populado (evita JSON.parse a cada
// chamada). isExecutado/isPulado são chamados em _atualizarProgressoGlobal()
// uma vez por comando e em getStatusSessao() mais uma vez — numa UI com
// ~200 botões, isso economiza centenas de parses por atualização.
function isExecutado(idComando) {
    const progress = progressCache || getProgressSync();
    return progress.executados.includes(idComando);
}

function isPulado(idComando) {
    const progress = progressCache || getProgressSync();
    return progress.pulados.includes(idComando);
}

var SESSAO_COMANDOS = SESSOES.reduce(function(mapa, sessao) {
    mapa[sessao.id] = Object.keys(sessao.comandos || {}).filter(function(id) {
        return !sessao.comandos[id].sempreClicavel;
    });
    return mapa;
}, {});

// `pulados` guarda IDs de comando, não de sessão — nenhum ponto do
// projeto grava o ID da sessão. A branch antiga era código morto.
function getStatusSessao(sessaoId) {
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
        _invalidarContadorSessoes();
        _atualizarProgressoGlobal();
    }
}

async function marcarComoPulado(idComando) {
    const progress = await getProgress();
    if (!progress.pulados.includes(idComando)) {
        progress.pulados.push(idComando);
        await saveProgress(progress);
        _invalidarContadorSessoes();
        _atualizarProgressoGlobal();
    }
}

async function desmarcarComoExecutado(idComando) {
    const progress = await getProgress();
    progress.executados = progress.executados.filter(id => id !== idComando);
    await saveProgress(progress);
    _invalidarContadorSessoes();
    _atualizarProgressoGlobal();
}

async function desmarcarComoPulado(idComando) {
    const progress = await getProgress();
    progress.pulados = progress.pulados.filter(id => id !== idComando);
    await saveProgress(progress);
    _invalidarContadorSessoes();
    _atualizarProgressoGlobal();
}

// ============================================================
// SINCRONIZAÇÃO DE ESTADO DE FLATPAKS (removidos + instalados)
// ============================================================
//
// Esta função faz DUAS coisas numa única passada:
//
//   1. DESMARCA comandos Flatpak cujo app foi removido por fora
//      (via GNOME Software, linha de comando, etc.). Sem isso, o
//      botão fica cinza mesmo com o app ausente.
//
//   2. MARCA comandos Flatpak cujo app JÁ ESTÁ instalado no
//      sistema, mas o comando não estava marcado como executado.
//      Cobre o caso do usuário que já tinha o app antes do FAP.
//
// Antes, isso era feito por duas funções separadas
// (`verificarFlatpaksRemovidos` e `marcarFlatpaksJaInstalados`)
// que compartilhavam o mesmo throttle. Isso causava um bug: no
// boot, `verificarFlatpaksRemovidos` era chamada primeiro (via
// DOMContentLoaded), setava o throttle, e `marcarFlatpaksJaInstalados`
// era bloqueada quando rodava em `sessao-carregada` — então
// apps instalados por fora do FAP nunca eram detectados no boot.
//
// Unificar resolve o bug e evita duas requisições ao mesmo endpoint.

const FLATPAK_VERIFY_TTL_MS = 30000;
let _ultimaVerificacaoFlatpak = 0;

async function _sincronizarEstadoFlatpaks() {
    var agora = Date.now();
    if (agora - _ultimaVerificacaoFlatpak < FLATPAK_VERIFY_TTL_MS) {
        return;
    }
    _ultimaVerificacaoFlatpak = agora;

    // Fonte única: `/system-state` já devolve `flatpaks_installed`.
    // Antes, esta função fazia um `fetch('/flatpak-installed')` próprio,
    // duplicando a consulta que `/system-state` faz — 2 requests por
    // boot para a mesma informação.
    //
    // Se o `SystemState` ainda não estiver carregado (rede lenta, boot
    // recém-iniciado), `carregar()` resolve a promise existente ou
    // dispara um novo fetch. `flatpakInstalado()` retorna `false` para
    // tudo enquanto o cache estiver vazio — comportamento anterior
    // preservado (sem detecção externa).
    try {
        await SystemState.carregar();

        var progress = await getProgress();
        var executados = progress.executados || [];

        var marcados = [];    // app instalado por fora, comando não marcado
        var removidos = [];   // comando marcado, mas app não está instalado

        for (var i = 0; i < SESSOES.length; i++) {
            var sessao = SESSOES[i];
            var comandos = sessao.comandos || {};
            for (var idComando in comandos) {
                var info = comandos[idComando];
                if (!info.flatpakId) continue;

                var estaMarcado = executados.includes(idComando);
                var estaInstalado = SystemState.flatpakInstalado(info.flatpakId);

                if (!estaMarcado && estaInstalado) {
                    marcados.push(idComando);
                } else if (estaMarcado && !estaInstalado) {
                    removidos.push({ id: idComando, appId: info.flatpakId });
                }
            }
        }

        // Etapa 1: aplica a UI de "Abrir X" para apps que já estão
        // instalados no sistema (detectados via SystemState).
        //
        // DECISÃO (v1.1.2): NÃO chamamos `marcarComoExecutado`.
        // Motivo: `aplicarEstadoInstalavel` já detecta a instalação
        // via `appJaInstaladoNoSistema` (que consulta SystemState) e
        // cai no branch `preExistente` — mostrando "Abrir X" +
        // lixeira com tooltip de pré-existente. Marcar como executado
        // forçava `instalado=true`, o que fazia o app parecer ter
        // sido instalado pelo FAP a partir do 2º boot (o tooltip e
        // o aviso de remoção desapareciam). Sem a marcação, o
        // `.progresso.json` fica enxuto e o app é tratado com
        // honestidade como pré-existente para sempre.
        //
        // Trade-off: a barra de progresso global ("N/M sessões
        // concluídas") deixa de contar esses apps como "feitos pelo
        // FAP". Correto, já que o FAP não os instalou.
        for (var k = 0; k < marcados.length; k++) {
            try {
                var idAbrirMarc = (typeof _derivarIdAbrir === 'function')
                ? _derivarIdAbrir(marcados[k])
                : null;
                aplicarEstadoInstalavel(marcados[k], idAbrirMarc);
            } catch (e) { /* ignora */ }
        }

        // Etapa 2: desmarca os que foram removidos por fora.
        //
        // Mesmo motivo da Etapa 1: usar aplicarEstadoInstalavel
        // garante que a lixeira seja escondida junto com a
        // restauração do botão de instalar.
        for (var l = 0; l < removidos.length; l++) {
            var item = removidos[l];
            console.log('[Flatpak] Removido externamente:', item.id, '→', item.appId);
            await desmarcarComoExecutado(item.id);
            try {
                var idAbrirRem = (typeof _derivarIdAbrir === 'function')
                ? _derivarIdAbrir(item.id)
                : null;
                aplicarEstadoInstalavel(item.id, idAbrirRem);
            } catch (e) {
                console.warn('[Flatpak] Erro ao restaurar botão de', item.id, ':', e.message);
            }
        }

        if (marcados.length > 0 || removidos.length > 0) {
            _atualizarProgressoGlobal();
        }
    } catch (e) {
        console.warn('[Flatpak] Falha ao sincronizar estado:', e.message);
    }
}

// Aliases mantidos por compatibilidade — ambas chamam a função
// unificada. Como o throttle é compartilhado, chamar as duas em
// sequência só executa um fetch.
function verificarFlatpaksRemovidos() {
    return _sincronizarEstadoFlatpaks();
}

function marcarFlatpaksJaInstalados() {
    return _sincronizarEstadoFlatpaks();
}

// (função _atualizarIconeDesinstalarSeExistir removida — era código
// morto. O trabalho de atualizar a lixeira após sincronização é
// feito por `aplicarEstadoInstalavel`, que já chama `_mostrarLixeira`
// ou `_esconderLixeira` conforme o estado.)

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

    // Remove a marca de "concluído" caso este comando seja
    // reexecutado (ex.: "Atualizar Fedora" pode ser clicado de
    // novo dias depois). Sem isso, a barra ficaria marcada como
    // concluída desde o início, e o bloqueio de navegação não
    // ativaria ao clicar.
    container.classList.remove('concluido');

    // Bloqueia a navegação imediatamente ao iniciar o comando.
    // Sem isso, haveria uma janela de alguns milissegundos onde
    // o usuário poderia clicar em um chip antes do bloqueio
    // entrar em vigor.
    _atualizarBloqueioNavegacao();

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

    // Timer de fallback. Só avança enquanto nenhum evento "progress"
    // real chegou do servidor. Quando chega, o _atualizarProgressoPacotes()
    // sobrescreve o valor. O timer não passa de 30% para não "mentir"
    // se o DNF travar antes de emitir [N/M].
    progressIntervals[idComando] = setInterval(() => {
        if (progresso < 30) {
            const incremento = Math.max(0.05, (30 - progresso) / 200);
            progresso = Math.min(30, progresso + incremento);
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

                // Marca a barra como "concluída". O bloqueio de
                // navegação ignora barras com esta classe, para
                // que o usuário possa navegar imediatamente após
                // o término do comando — mesmo enquanto a barra
                // ainda está visível (ela some após 5s).
                container.classList.add('concluido');

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
                var tituloNotif = _t('comum.notif_tarefa_concluida_titulo', 'FAP — Tarefa concluída');
                var corpoNotif = _t('comum.notif_tarefa_concluida_corpo', 'A tarefa terminou. Veja o log para detalhes.');
                notificarNativo(tituloNotif, corpoNotif);
            }
        }
        delete _inicioExecucao[idComando];

        restaurarBotaoAposExecucao(idComando, sucesso);
        _notificarConclusaoReal(idComando, sucesso);

        _liberarSessao(idComando);
        // Libera os botões dnf/rpm das outras sessões. Se por algum
        // motivo outro comando dnf tiver começado antes (não deveria,
        // porque o bloqueio cruzado impede), o `_comandoDnfRodando`
        // mais recente manda — e como estamos dentro da sessão de
        // origem, ele é o mesmo idComando.
        if (_comandoDnfRodando === idComando) {
            _liberarOutrasSessoes();
        }

        // Reavalia o bloqueio de navegação. Se este era o último
        // comando rodando da sessão atual, libera os chips e os
        // botões Anterior/Próximo.
        _atualizarBloqueioNavegacao();
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

/**
 * Aplica o estado visual de um par install/revert.
 *
 * Regra única:
 * - Se o comando de install está marcado como executado:
 *     install → desabilitado, com texto final ("✅ ...")
 *     revert  → habilitado, clicável
 * - Se o comando de install NÃO está marcado:
 *     install → habilitado, texto original
 *     revert  → DESABILITADO (não há o que reverter)
 *
 * Esta é a ÚNICA fonte de verdade do estado visual desses pares.
 * Não consulta o estado do revert — apenas do install. A semântica
 * é: existe uma verdade por par ("está instalado ou não"), e o
 * botão de reverter só faz sentido quando essa verdade é "sim".
 *
 * Chamada em dois momentos:
 *   1. restaurarEstadoSessao() — para aplicar o estado persistido
 *      no carregamento da sessão
 *   2. onSucesso dos comandos install/revert — para atualizar os
 *      dois botões em uníssono após uma transição de estado
 */
function aplicarEstadoToggle(idInstall, idRevert, esconderRevertSeNaoFeito, preExistente) {
    var installBtn = document.getElementById('btn-' + idInstall);
    var revertBtn = document.getElementById('btn-' + idRevert);
    if (!installBtn || !revertBtn) return;

    var installFeito = isExecutado(idInstall);

    // `preExistente` pode ser:
    //   - undefined → consulta `appJaInstaladoNoSistema(idInstall)`
    //   - boolean   → usa direto
    //   - function  → chama (para checagens contextuais, como
    //                 kernel params e arquivos de config)
    if (preExistente === undefined) {
        try {
            preExistente = appJaInstaladoNoSistema(idInstall);
        } catch (e) {
            preExistente = false;
        }
    } else if (typeof preExistente === 'function') {
        try {
            preExistente = !!preExistente();
        } catch (e) {
            preExistente = false;
        }
    }

    var textoOriginalInstall = installBtn.getAttribute('data-texto-original') || installBtn.textContent;
    var textoOriginalRevert = revertBtn.getAttribute('data-texto-original') || revertBtn.textContent;
    var corOriginalInstall = _corOriginalDoBotao(installBtn);

    // Estado "pré-existente" (v1.1.2): origem não importa. O FAP
    // trata como se fosse ele quem configurou — install vira
    // "concluído", revert fica habilitado, e o aviso de origem
    // aparece apenas no tooltip (o usuário sabe que já existia).
    //
    // Antes, o revert ficava OCULTO (não havia o que desfazer do
    // ponto de vista do FAP). Agora o revert aparece habilitado:
    // se o usuário já tinha `bbr` no kernel, ele pode remover pelo
    // FAP mesmo assim. É a mesma ação que faria no terminal.
    var efetivamenteFeito = installFeito || preExistente;

    // Limpa tooltip de pré-existente se veio de um estado anterior.
    installBtn.title = '';

    if (efetivamenteFeito) {
        if (preExistente && !installFeito) {
            installBtn.title = _t('comum.tooltip_preexistente_recurso',
                                  'Este recurso já estava ativo antes do FAP. O FAP não foi o responsável pela configuração, mas está tratando como ativo normalmente.');
        }
        installBtn.textContent = getTextoAposExecucao(idInstall);
        installBtn.style.backgroundColor = '#4b5563';
        installBtn.style.cursor = 'default';
        installBtn.disabled = true;
        installBtn.style.opacity = '1';

        revertBtn.textContent = textoOriginalRevert;
        revertBtn.style.backgroundColor = '';
        revertBtn.style.cursor = 'pointer';
        revertBtn.disabled = false;
        revertBtn.style.opacity = '1';
        revertBtn.style.display = '';
    } else {
        installBtn.textContent = textoOriginalInstall;
        installBtn.style.backgroundColor = corOriginalInstall || '';
        installBtn.style.cursor = 'pointer';
        installBtn.disabled = false;
        installBtn.style.opacity = '1';

        revertBtn.textContent = textoOriginalRevert;
        revertBtn.style.backgroundColor = '';
        revertBtn.style.cursor = 'not-allowed';
        revertBtn.disabled = true;
        revertBtn.style.opacity = '0.5';

        if (esconderRevertSeNaoFeito) {
            revertBtn.style.display = 'none';
        } else {
            revertBtn.style.display = '';
        }
    }
}

/**
 * Marca um botão one-shot como concluído, reaplicando o estado
 * persistido do progresso. Usado por restaurarEstadoSessao() de
 * sessões que têm botões sem par "install/revert".
 *
 * Para pares install/revert, use aplicarEstadoToggle().
 */
function _marcarBotaoConcluido(idComando) {
    var btn = document.getElementById('btn-' + idComando);
    if (!btn) return;
    _corOriginalDoBotao(btn);
    btn.textContent = getTextoAposExecucao(idComando);
    btn.style.backgroundColor = '#4b5563';
    btn.style.cursor = 'default';
    btn.disabled = true;
    btn.style.opacity = '1';
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

        // marcarComoExecutado() já foi chamado por completarProgresso()
        // antes de restaurarBotaoAposExecucao(). Chamar aqui também
        // fazia um POST /progress extra por comando.
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

// ============================================================
// PROGRESSO REAL DE PACOTES
// ============================================================
//
// Recebe eventos do tipo "progress" emitidos pelo server.js quando
// o parser de [N/M] detecta avanço do DNF. Substitui o valor da
// barra de progresso por uma estimativa baseada em pacotes
// processados (N de M), que é mais honesto do que o timer
// contínuo original.

function _atualizarProgressoPacotes(idComando, atual, total) {
    if (!total || total <= 0) return;

    var fill = document.getElementById('progress-fill-' + idComando);
    var percent = document.getElementById('progress-percent-' + idComando);
    var status = document.getElementById('progress-status-' + idComando);

    if (!fill || !percent || !status) return;

    // Reserva 90% da barra para os pacotes; os 10% finais são
    // preenchidos na conclusão real (completarProgresso).
    var fracao = Math.min(atual / total, 1);
    var perc = Math.round(fracao * 90);

    fill.style.width = perc + '%';
    percent.textContent = perc + '%';
    status.textContent = _tVars('comum.status_pacote',
                                'Pacote ' + atual + ' de ' + total,
                                { atual: atual, total: total });
    status.className = 'status running';
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

                if (dados.tipo === 'progress') {
                    _atualizarProgressoPacotes(idComando, dados.pacote_atual, dados.pacote_total);
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
// FILA DE INSTALAÇÃO DE FLATPAKS
// ============================================================
//
// O `flatpak install` tem um lock global: dois comandos em
// paralelo falham com "Remote flathub already in use". Por isso
// só podemos rodar UM `flatpak install` por vez.
//
// Para melhorar a UX (o usuário quer clicar em vários apps e ver
// tudo instalando), criamos uma fila:
//
//   1. Usuário clica em "VLC" → dispara imediatamente.
//   2. Usuário clica em "GIMP" → entra na fila, botão mostra
//      "⏳ Na fila (2º)".
//   3. Usuário clica em "Inkscape" → entra na fila, botão mostra
//      "⏳ Na fila (3º)".
//   4. VLC termina → GIMP começa automaticamente.
//   5. GIMP termina → Inkscape começa automaticamente.
//
// Regras:
//   - Clicar num botão que já está rodando ou na fila é ignorado.
//   - Se um item falha, o próximo da fila continua.
//   - A fila é em memória: recarregar a página a descarta.
//
// A fila é exclusiva para flatpaks. Comandos dnf/rpm/copr
// continuam com o comportamento normal (travam a sessão inteira
// e não entram nesta fila).

var _filaFlatpaks = [];         // [{ idComando, comando, nomeAcao, onSucesso }]
var _flatpakRodando = null;     // idComando do flatpak sendo instalado agora

// Verifica se um idComando está na fila OU sendo instalado agora.
function _flatpakNaFila(idComando) {
    if (_flatpakRodando === idComando) return true;
    for (var i = 0; i < _filaFlatpaks.length; i++) {
        if (_filaFlatpaks[i].idComando === idComando) return true;
    }
    return false;
}

// Atualiza o texto do botão para refletir o estado "na fila".
// O botão fica desabilitado (não pode ser clicado de novo) e
// mostra a posição na fila.
function _marcarBotaoNaFila(idComando, posicao) {
    var btn = document.getElementById('btn-' + idComando);
    if (!btn) return;

    // Salva o texto original se ainda não foi salvo.
    if (!btn.hasAttribute('data-texto-original')) {
        btn.setAttribute('data-texto-original', btn.textContent);
    }

    btn.textContent = '⏳ Na fila (' + posicao + 'º)';
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
}

// Remove o estado "na fila" de um botão, restaurando o texto
// original (para os itens que ainda não começaram).
function _desmarcarBotaoDaFila(idComando) {
    var btn = document.getElementById('btn-' + idComando);
    if (!btn) return;
    var original = btn.getAttribute('data-texto-original') || btn.textContent;
    btn.textContent = original;
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
}

// Recalcula a posição mostrada em cada botão da fila. Chamado
// após remover o primeiro item (para que "3º" vire "2º" e assim
// por diante).
function _reajustarPosicoesDaFila() {
    for (var i = 0; i < _filaFlatpaks.length; i++) {
        _marcarBotaoNaFila(_filaFlatpaks[i].idComando, i + 1);
    }
}

// Ponto de entrada. Chamado pelas sessões que instalam flatpak.
async function _enfileirarFlatpak(idComando, comando, nomeAcao, onSucesso) {
    // Opção A: ignorar clique duplicado.
    if (_flatpakNaFila(idComando)) {
        return;
    }

    // Se ninguém está rodando, dispara imediatamente.
    if (_flatpakRodando === null) {
        _flatpakRodando = idComando;
        // Atualiza o bloqueio de navegação antes de disparar — a
        // fila agora tem um item "rodando", então a navegação deve
        // travar (se este comando pertence à sessão atual).
        _atualizarBloqueioNavegacao();
        await _dispararFlatpak(idComando, comando, nomeAcao, onSucesso);
        return;
    }

    // Senão, entra na fila.
    _filaFlatpaks.push({
        idComando: idComando,
        comando: comando,
        nomeAcao: nomeAcao,
        onSucesso: onSucesso
    });
    _marcarBotaoNaFila(idComando, _filaFlatpaks.length);

    // Atualiza o bloqueio de navegação — a fila agora tem um item
    // a mais. Se ele pertence à sessão atual, a navegação já está
    // (ou continua) bloqueada.
    _atualizarBloqueioNavegacao();
}

// Executa um flatpak e, quando terminar, dispara o próximo da
// fila (se houver).
async function _dispararFlatpak(idComando, comando, nomeAcao, onSucesso) {
    // Reaproveita a lógica existente: executarComandoGenerico já
    // cuida do log em tempo real (SSE), da barra de progresso, do
    // bloqueio da sessão e da marcação de concluído no sucesso.
    //
    // Precisamos saber quando termina para disparar o próximo, e
    // para isso usamos aguardarConclusaoReal() logo depois.
    //
    // O `onSucesso` do flatpak original é passado adiante.
    // Chama a versão ORIGINAL (não a interceptada), porque senão
    // a interceptação roteia de volta para _enfileirarFlatpak, o
    // qual detecta que o idComando já está rodando e retorna sem
    // disparar nada. Resultado: o comando nunca era executado.
    await _executarComandoGenericoOriginal(idComando, comando, nomeAcao, null, true);

    // Aguarda o SSE retornar 'end'. O timeout de 30min é generoso
    // — flatpaks grandes (Blender, Steam) podem demorar bastante
    // em conexões lentas.
    var sucesso = await aguardarConclusaoReal(idComando, 1800000);

    // Se o flatpak teve sucesso e havia um callback registrado,
    // executa agora (ex.: atualizar o ícone da lixeira).
    if (sucesso && typeof onSucesso === 'function') {
        try {
            onSucesso(idComando);
        } catch (e) {
            console.warn('[flatpak-fila] Erro no onSucesso de ' + idComando + ':', e);
        }
    }

    // Esse flatpak terminou (com sucesso ou falha). Libera o slot
    // e dispara o próximo da fila.
    _flatpakRodando = null;

    if (_filaFlatpaks.length > 0) {
        var proximo = _filaFlatpaks.shift();
        _reajustarPosicoesDaFila();
        _flatpakRodando = proximo.idComando;
        // Reavalia o bloqueio de navegação. Ainda pode haver itens
        // na fila pertencentes à sessão atual, então a navegação
        // continua bloqueada — mas se a fila ficou vazia para esta
        // sessão, libera.
        _atualizarBloqueioNavegacao();
        // Chama de novo, sem await — queremos que a fila continue
        // rodando em background enquanto a UI permanece responsiva.
        _dispararFlatpak(proximo.idComando, proximo.comando, proximo.nomeAcao, proximo.onSucesso);
    } else {
        // Fila vazia: reavalia o bloqueio (pode ser a hora de liberar).
        _atualizarBloqueioNavegacao();
    }
}

// ============================================================
// EXECUTAR COMANDO GENÉRICO
// ============================================================
async function executarComandoGenerico(idComando, comando, nomeAcao, onSucesso, ehFlatpak) {
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

    // Flatpaks NÃO bloqueiam a sessão inteira. O usuário precisa
    // poder clicar em outros botões de flatpak enquanto um está
    // instalando (eles entram na fila). Já comandos dnf/rpm/copr
    // continuam bloqueando toda a sessão atual E as demais sessões
    // (bloqueio entre sessões — Opção A) para evitar conflitos de
    // lock no rpm.
    if (!ehFlatpak) {
        _bloquearSessao(idComando);
        _bloquearOutrasSessoes(idComando);
    }

    // Atualiza o bloqueio de navegação. Se este comando é o
    // primeiro a rodar na sessão atual, os chips do menu e os
    // botões Anterior/Próximo ficam travados.
    _atualizarBloqueioNavegacao();

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

// Detecta `flatpak install` e roteia para a fila.
// Qualquer outro comando segue o fluxo normal.
var _executarComandoGenericoOriginal = executarComandoGenerico;
executarComandoGenerico = async function(idComando, comando, nomeAcao, onSucesso, ehFlatpak) {
    // Se o caller já marcou explicitamente como flatpak, ou se o
    // comando é um `flatpak install`, entra na fila.
    var isFlatpak = ehFlatpak || /^\s*flatpak\s+install\b/.test(comando);
    if (isFlatpak) {
        return await _enfileirarFlatpak(idComando, comando, nomeAcao, onSucesso);
    }
    return await _executarComandoGenericoOriginal(idComando, comando, nomeAcao, onSucesso, ehFlatpak);
};

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
//
// Ponto ÚNICO de abertura de apps GUI no FAP. Todas as sessões
// devem chamar esta função em vez de montar o comando sozinhas —
// assim garantimos três invariantes em um só lugar:
//
//   1. `setsid -f` — o app ganha uma SESSÃO PRÓPRIA, desacoplada
//      do FAP. Sem isso, o app morre quando o FAP é fechado
//      (compartilhava o mesmo PGID do bash spawnado pelo server.js).
//      Comportamento idêntico a clicar no atalho do menu do Fedora.
//
//   2. Redirecionamento `> /tmp/fap-open-<id>.log 2>&1 < /dev/null`
//      — o app não fica preso ao terminal do FAP. Sem isso, o Node
//      ficaria esperando o app fechar para liberar o buffer.
//
//   3. `& ` no final do comando original é REMOVIDO — o `&` duplica
//      o `setsid -f` e pode confundir o bash. O helper rejeita
//      qualquer `&` final antes de adicionar o `setsid`.
//
// O idComando enviado ao backend termina em `-open` (ex.:
// `steam-install-open`). Esses ids NÃO são gravados no
// .progresso.json — o server.js ignora explicitamente ids com
// esse sufixo (ver `salvarProgresso`). A linha no log da sessão
// é puramente informativa; o SSE para o id `<id>-open` NÃO é
// aberto porque o servidor já mata o processo pai do app (o
// `setsid -f` cria a sessão nova e o comando `-open` termina na
// hora).

function abrirFerramentaExterna(comando, idLog, nomeExibicao) {
    var cmdFinal = (comando || '').trim();

    // Remove `&` final, se houver. Não usamos `&` aqui — o
    // `setsid -f` já faz o "background" sozinho, e o `&` residual
    // poderia disparar um segundo fork.
    cmdFinal = cmdFinal.replace(/\s*&\s*$/, '').trim();

    // Adiciona `setsid -f` se ainda não estiver.
    if (!/^setsid\s/.test(cmdFinal)) {
        cmdFinal = 'setsid -f ' + cmdFinal;
    }

    // Redireciona a saída para um log individual. Só faz isso se
    // o comando ainda não tiver redirecionamento próprio.
    if (cmdFinal.indexOf('> /dev/null') === -1 && cmdFinal.indexOf('> /tmp/') === -1) {
        var logFile = '/tmp/fap-open-' + (idLog || 'app') + '.log';
        cmdFinal += ' > ' + logFile + ' 2>&1 < /dev/null';
    }

    // Envia para o servidor. Como o `setsid -f` cria uma sessão
    // nova, o bash do servidor sai imediatamente — o app sobrevive
    // ao fechamento do FAP.
    //
    // O fetch NÃO é awaited de propósito: a UI de "abrir" não deve
    // travar esperando a resposta do servidor. O catch evita erro
    // silencioso se a porta 3000 estiver offline.
    fetch(API_URL + '/executar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando: cmdFinal, idComando: idLog + '-open' })
    }).catch(function(e) {
        console.warn('[abrir] Falha ao enviar comando de abertura:', e.message);
    });

    // Registra a abertura no log da sessão (informativo).
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

// ============================================================
// HELPER GLOBAL — ÍCONE DE REMOVER UNIFICADO
// ============================================================
//
// Este helper cria o ícone de lixeira ao lado de QUALQUER botão
// de instalação (Flatpak ou não-Flatpak), seguindo o mesmo padrão
// visual dos Flatpaks em aplicativos.html:
//
//   - O botão install ganha um wrapper `.btn-flatpak-wrapper`
//   - A lixeira só é exibida quando o idComando está marcado como
//     executado no progresso
//   - Clicar na lixeira remove o app
//   - Após remoção, o botão install volta ao estado original
//
// Config:
//   {
//     tipo: 'flatpak' | 'dnf',
//     appId: 'org.exemplo.App',       // obrigatório se tipo='flatpak'
//     pacotes: ['pkg1', 'pkg2'],       // obrigatório se tipo='dnf'
//     nome: 'Nome do App',
//     confirmMsg: 'texto'              // opcional
//   }
//
// O ID do idComando de remoção é derivado do ID de install:
//   '<nome>-install' → '<nome>-remove'
//   'instalar-<nome>' → 'instalar-<nome>-remove' (mantém prefixo)
//
// Exemplo: 'samba-install' → 'samba-remove'
//          'instalar-lightworks' → 'instalar-lightworks-remove'

var APPS_REMOVIVEIS = {};
var FAP_SVG_LIXEIRA = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

function registrarAppRemovivel(idComando, config) {
    APPS_REMOVIVEIS[idComando] = config;
}

function _idRemocaoDe(idComando) {
    return idComando + '-remove';
}

// ============================================================
// TRADUÇÃO DO MOTIVO DE BLOQUEIO
// ============================================================
//
// Os 14 itens protegidos têm `permitirRemocaoPreExistente: false`
// e um `motivoBloqueio` em PT-BR (hardcoded no HTML da sessão).
// O texto contém comandos shell literais — que NÃO podem ser
// traduzidos — e por isso o PT-BR é o fallback universal.
//
// Este mapa aponta para a chave i18n de cada item. Quando o
// locale tem a tradução, ela é usada; senão, cai no PT-BR
// original do `motivoBloqueio`. Ambos os textos contêm os
// mesmos comandos (não traduzíveis).
var _MAPA_MOTIVO_BLOQUEIO = {
    'codecs-essenciais':        'mitigacao.codecs_essenciais',
    'extras-tainted':           'mitigacao.extras_tainted',
    'fontes-ms-all':            'mitigacao.fontes_ms_all',
    'vulkan-amd':               'mitigacao.vulkan_amd',
    'vaapi-amd':                'mitigacao.vaapi_amd',
    'vaapi-swap':               'mitigacao.vaapi_swap',
    'nvidia-driver-install':    'mitigacao.nvidia_driver_install',
    'intel-media-install':      'mitigacao.intel_media_install',
    'cups-install':             'mitigacao.cups_install',
    'samba-install':            'mitigacao.samba_install',
    'qemu-kvm-install':         'mitigacao.qemu_kvm_install',
    'virtualbox-install':       'mitigacao.virtualbox_install',
    'gnome-boxes-install':      'mitigacao.gnome_boxes_install',
    'realtime-setup':           'mitigacao.realtime_setup'
};

// Devolve o motivo de bloqueio traduzido, caindo no PT-BR original
// do `motivoBloqueio` quando a chave não existe no locale.
function _traduzirMotivoBloqueio(idInstall, info) {
    var fallback = (info && info.motivoBloqueio) ||
    'Este recurso já estava ativo antes do FAP. O FAP não foi a causa — para desfazer, use o terminal.';
    var chave = _MAPA_MOTIVO_BLOQUEIO[idInstall];
    return chave ? _t(chave, fallback) : fallback;
}

// (funções `atualizarIconeRemover` e `esconderIconeRemover` foram
// removidas — código morto. O trabalho é feito por `_mostrarLixeira`
// e `_esconderLixeira`, chamadas a partir de `aplicarEstadoInstalavel`.)

// ============================================================
// ESCONDER BOTÃO "ABRIR" APÓS REMOÇÃO
// ============================================================
//
// Quando um app é removido (via lixeira ou "desfazer tudo"), o
// botão "🚀 Abrir X" precisa sumir imediatamente — senão o
// usuário vê um botão que abriria um app já removido.
//
// Este helper localiza o botão "Abrir" no DOM como IRMÃO do
// wrapper de instalação. NÃO usa heurística de id porque o
// mapeamento install → abrir NÃO é 1:1 (ex.: o install
// 'okular-tesseract-install' tem o botão 'btn-abrir-okular').
//
// Estrutura típica em todas as sessões:
//   <div class="botoes-flex|launcher-item">
//     <div class="btn-flatpak-wrapper">
//       <button class="btn-executar" id="btn-<install>">…</button>
//     </div>
//     <button class="btn-executar verde" id="btn-abrir-<x>">…</button>
//   </div>
//
// Basta subir até o pai do wrapper e esconder todo
// `.btn-executar.verde` com `data-comando` começando em "abrir-".

function esconderBotoesAbrirDe(idInstall) {
    var btn = document.getElementById('btn-' + idInstall);
    if (!btn) return;

    var wrapper = btn.closest('.btn-flatpak-wrapper');
    var container = wrapper ? wrapper.parentElement : btn.parentElement;
    if (!container) return;

    var botoes = container.querySelectorAll('.btn-executar.verde[data-comando^="abrir-"]');
    botoes.forEach(function(b) {
        b.style.display = 'none';
    });
}

// ============================================================
// HELPER GLOBAL — SUBSTITUIÇÃO "INSTALAR" → "ABRIR"
// ============================================================
//
// Padrão visual adotado em todas as sessões (v1.0.0-10062026+):
//
//   Estado 1 (não instalado):
//     [ 📦 Instalar VLC ]
//
//   Estado 2 (instalado, com botão de abrir):
//     [ 🚀 Abrir VLC ]  🗑️
//     (o botão verde substitui o botão de instalar no mesmo
//      lugar; a lixeira aparece ao lado)
//
//   Estado 3 (instalado, sem botão de abrir — módulos, configs):
//     [ ✅ Nome do recurso instalado ]  🗑️
//     (botão cinza, sem "Abrir")
//
// Os três estados são aplicados pelas funções abaixo. Elas são
// a ÚNICA fonte de verdade do layout visual dos pares
// instalar/abrir/lixeira. Toda sessão que siga este padrão deve
// chamar `aplicarEstadoInstalavel()` no `restaurarEstadoSessao()`
// e no onSucesso dos comandos.

/**
 * Aplica os 3 estados visuais para um app instalável.
 *
 * @param {string} idInstall   idComando do botão de instalar
 * @param {string} idAbrir     idComando do botão de abrir (nullable
 *                             para apps sem "Abrir", tipo módulos)
 * @param {string} [idRemover] idComando de remoção para a lixeira.
 *                             Se omitido, tenta derivar
 *                             (`<install>-remove` ou `<install>-revert`).
 */
function aplicarEstadoInstalavel(idInstall, idAbrir, idRemover, preExistente) {
    var btnInstall = document.getElementById('btn-' + idInstall);
    if (!btnInstall) return;

    var btnAbrir = idAbrir ? document.getElementById('btn-' + idAbrir) : null;
    var instalado = isExecutado(idInstall);
    var idRem = idRemover || _idRemocaoDe(idInstall);

    // Se o chamador não passou `preExistente` explicitamente,
    // consulta o SystemState + APPS_REMOVIVEIS. Assim os
    // `aplicarEstadoInstalavel('X', 'abrir-X')` já existentes
    // ganham detecção de pré-existência automaticamente.
    if (preExistente === undefined) {
        try {
            preExistente = appJaInstaladoNoSistema(idInstall);
        } catch (e) {
            preExistente = false;
        }
    }

    // Cor original do botão de instalar (azul padrão) — guardada
    // uma vez para restaurar quando o app for desinstalado.
    var corOriginal = _corOriginalDoBotao(btnInstall);
    var textoOriginalInstall = btnInstall.getAttribute('data-texto-original') || btnInstall.textContent;

    // ============================================================
    // OPÇÃO B — pré-existente é tratado igual a instalado pelo FAP
    // ============================================================
    //
    // Mudança de design (v1.1.2): se o app está instalado no
    // sistema — detectado via /system-state, independente de quem
    // instalou — a UI mostra "🚀 Abrir X" + lixeira, igual a um
    // app instalado pelo FAP. A distinção "quem instalou" fica
    // invisível ao usuário.
    //
    // A única proteção adicional:
    //   • Tooltip no botão de abrir avisando que o app já estava
    //     lá antes do FAP.
    //   • `confirmMsg` extra em `_executarRemocaoApp` com o mesmo
    //     aviso antes de remover.
    //
    // Sem esse tratamento, o usuário via "✅ Já instalado (antes
    // do FAP)" + botão verde "Abrir" separado, gerando dois
    // botões empilhados e um espaço vazio embaixo (bug de layout
    // da sessão 6, bloco "Produtividade e Escritório").
    var tratadoComoInstalado = instalado || preExistente;

    // ============================================================
    // MITIGAÇÃO: pré-existente sem permissão de remoção
    // ============================================================
    //
    // Alguns apps declaram `permitirRemocaoPreExistente: false`
    // no registro (ex.: realtime-setup). Motivo: se o usuário já
    // tinha o item antes do FAP, remover via lixeira desfaria uma
    // configuração que o FAP não fez (ex.: `gpasswd -d $USER
    // realtime`).
    //
    // Nesses casos, voltamos ao comportamento ANTIGO (pré-Opção B):
    // botão cinza "✅ Já estava ativo" com tooltip, SEM lixeira.
    // Se o FAP instalou (isExecutado === true), a lixeira continua
    // funcionando normalmente — a mitigação é só para pré-existentes.
    //
    // Textos usam `_t()` com fallback PT-BR. O motivo de bloqueio
    // vem do mapa `_MAPA_MOTIVO_BLOQUEIO`, que aponta para as 14
    // chaves em `mitigacao.*` dos locales. O PT-BR do `motivoBloqueio`
    // (hardcoded no HTML da sessão) é o fallback universal.
    var infoApp = APPS_REMOVIVEIS[idInstall];
    var bloquearRemocaoPreExistente = preExistente && !instalado &&
    infoApp && infoApp.permitirRemocaoPreExistente === false;

    if (bloquearRemocaoPreExistente) {
        btnInstall.textContent = _t('comum.ja_estava_ativo', '✅ Já estava ativo');
        btnInstall.style.backgroundColor = '#4b5563';
        btnInstall.style.cursor = 'not-allowed';
        btnInstall.disabled = true;
        btnInstall.style.opacity = '0.7';
        btnInstall.title = _traduzirMotivoBloqueio(idInstall, infoApp);
        btnInstall.setAttribute('data-estado', 'instalado-sem-abrir');

        if (btnAbrir) btnAbrir.style.display = 'none';
        _esconderLixeira(idInstall);
        return;
    }

    if (tratadoComoInstalado) {
        if (btnAbrir) {
            // Estado 2 — botão de instalar vira botão de abrir.
            // Reaproveita o mesmo botão (não cria novo), mudando
            // texto, cor e handler. Assim a lixeira "irmã" continua
            // no lugar certo.
            var textoAbrir = _textoOriginalTraduzido(btnAbrir);
            btnInstall.textContent = textoAbrir;
            btnInstall.style.backgroundColor = '#10b981'; // verde
            btnInstall.style.cursor = 'pointer';
            btnInstall.disabled = false;
            btnInstall.style.opacity = '1';

            // Move o handler do botão original para o de abrir
            // sem perder o estado salvo — o clique agora chama
            // a função de abrir, não a de instalar.
            var onclickAbrir = btnAbrir.getAttribute('onclick') || '';
            var onclickInstall = btnInstall.getAttribute('data-onclick-install');

            if (!onclickInstall) {
                // Primeira vez: salva o onclick de instalar.
                btnInstall.setAttribute('data-onclick-install', btnInstall.getAttribute('onclick') || '');
            }
            btnInstall.setAttribute('onclick', onclickAbrir);

            // Esconde o botão "Abrir" original (não é mais usado).
            btnAbrir.style.display = 'none';

            // Marca visualmente como "instalado".
            btnInstall.setAttribute('data-estado', 'instalado-abrir');

            // Tooltip explicativo quando o app é pré-existente.
            if (preExistente && !instalado) {
                btnInstall.title = _t('comum.tooltip_preexistente_app',
                                      'Este app já estava instalado antes do FAP. A lixeira remove o app do sistema, mas o FAP não foi o responsável pela instalação.');
            } else {
                btnInstall.title = '';
            }
        } else {
            // Estado 3 — botão cinza "✅ instalado", sem "Abrir".
            btnInstall.textContent = getTextoAposExecucao(idInstall);
            btnInstall.style.backgroundColor = '#4b5563';
            btnInstall.style.cursor = 'default';
            btnInstall.disabled = true;
            btnInstall.style.opacity = '1';
            btnInstall.setAttribute('data-estado', 'instalado-sem-abrir');

            if (preExistente && !instalado) {
                btnInstall.title = _t('comum.tooltip_preexistente_app',
                                      'Este app já estava instalado antes do FAP. A lixeira remove o app do sistema, mas o FAP não foi o responsável pela instalação.');
            } else {
                btnInstall.title = '';
            }
        }

        // Lixeira ao lado — aparece tanto para instalado pelo FAP
        // quanto para pré-existente (Opção B).
        _mostrarLixeira(idInstall, idRem);
    } else {
        // Estado 1: não instalado, não pré-existente.
        btnInstall.textContent = textoOriginalInstall;
        btnInstall.style.backgroundColor = corOriginal || '';
        btnInstall.style.cursor = 'pointer';
        btnInstall.disabled = false;
        btnInstall.style.opacity = '1';
        btnInstall.title = '';

        // Restaura o onclick de instalar (se foi salvo).
        var onclickInstallSalvo = btnInstall.getAttribute('data-onclick-install');
        if (onclickInstallSalvo !== null) {
            btnInstall.setAttribute('onclick', onclickInstallSalvo);
        }
        btnInstall.removeAttribute('data-estado');

        // Botão "Abrir" original volta a ser escondido (estado 1
        // não mostra botão de abrir).
        if (btnAbrir) btnAbrir.style.display = 'none';

        // Esconde a lixeira.
        _esconderLixeira(idInstall);
    }
}

/**
 * Cria (ou reexibe) o botão de lixeira SVG ao lado do botão
 * install. Usado tanto por flatpaks quanto por apps dnf/rpm que
 * usam o `registrarAppRemovivel`.
 */
/**
 * Garante que o botão de instalar esteja dentro de um
 * `.btn-flatpak-wrapper`. Se já estiver, retorna o wrapper
 * existente. Se não, cria um, insere-o na posição do botão
 * original e move o botão para dentro.
 *
 * Por que isso existe: a lixeira (`.btn-flatpak-uninstall`) é
 * um IRMÃO do botão de instalar, dentro do wrapper. Sessões que
 * declaram o botão solto dentro de `.grupo-botoes` ou
 * `.botoes-flex` (CoreCtrl, LACT e futuros) não teriam onde
 * colocar a lixeira. Em vez de exigir que cada HTML seja
 * alterado, embrulhamos o botão na hora.
 *
 * Idempotente: chamar duas vezes não cria wrapper duplicado.
 */
function _garantirWrapperFlatpak(btnInstall) {
    if (!btnInstall) return null;

    var wrapper = btnInstall.closest('.btn-flatpak-wrapper');
    if (wrapper) return wrapper;

    // Cria o wrapper e o insere no lugar do botão.
    var parent = btnInstall.parentElement;
    if (!parent) return null;

    wrapper = document.createElement('div');
    wrapper.className = 'btn-flatpak-wrapper';
    parent.insertBefore(wrapper, btnInstall);
    wrapper.appendChild(btnInstall);
    return wrapper;
}

function _mostrarLixeira(idInstall, idRemover) {
    var btnInstall = document.getElementById('btn-' + idInstall);
    if (!btnInstall) return;

    // Garante o wrapper — cria na hora se o HTML não o declarou.
    var wrapper = _garantirWrapperFlatpak(btnInstall);
    if (!wrapper) return;

    // Reaproveita o ícone existente ou cria um novo.
    var icone = wrapper.querySelector('.btn-flatpak-uninstall');
    if (!icone) {
        icone = document.createElement('button');
        icone.type = 'button';
        icone.className = 'btn-flatpak-uninstall';
        icone.setAttribute('data-comando-install', idInstall);
        icone.setAttribute('data-comando-remover', idRemover);
        icone.innerHTML = FAP_SVG_LIXEIRA;

        var nomeAcao = (APPS_REMOVIVEIS[idInstall] && APPS_REMOVIVEIS[idInstall].nome) || idInstall;
        // Usa a chave i18n 'comum.desinstalar_app' — mesma string
        // usada pelos ícones de lixeira das sessões (aplicativos,
        // casa-escritorio, gaming). Antes era PT-BR hardcoded.
        icone.title = _tVars('comum.desinstalar_app', 'Remover ' + nomeAcao, { nome: nomeAcao });
        icone.setAttribute('aria-label', icone.title);

        icone.addEventListener('click', function(e) {
            e.stopPropagation();
            _executarRemocaoPeloWrapper(this.getAttribute('data-comando-install'));
        });

        wrapper.appendChild(icone);
    }

    icone.style.display = '';
}

function _esconderLixeira(idInstall) {
    var btnInstall = document.getElementById('btn-' + idInstall);
    if (!btnInstall) return;
    var wrapper = btnInstall.closest('.btn-flatpak-wrapper');
    if (!wrapper) return;
    var icone = wrapper.querySelector('.btn-flatpak-uninstall');
    if (icone) icone.style.display = 'none';
}

/**
 * Ponto de entrada unificado para o clique da lixeira em QUALQUER
 * botão registrado via `registrarAppRemovivel`. Cobre os três
 * tipos (`flatpak`, `dnf`, `arquivos`) e o modo `desfazerTudo`.
 *
 * Se o app não estiver registrado, `_executarRemocaoApp` retorna
 * silenciosamente — o app não pode ser removido pela lixeira.
 */
function _executarRemocaoPeloWrapper(idInstall) {
    var info = APPS_REMOVIVEIS[idInstall];
    if (!info) {
        // Botão sem registro — a lixeira não deveria ter aparecido,
        // mas se apareceu, o clique é ignorado com um log.
        console.warn('[remove-icon] App não registrado:', idInstall);
        return;
    }

    if (info.modo === 'desfazerTudo') {
        _executarDesfazerTudo(idInstall);
        return;
    }

    _executarRemocaoApp(idInstall);
}

// ============================================================
// REMOÇÃO DE APP (LIXEIRA) — FLUXO PRÓPRIO
// ============================================================
//
// IMPORTANTE: este fluxo NÃO usa executarComandoGenerico().
//
// Motivo: executarComandoGenerico faz `_getLogBox(idComando)` e
// retorna cedo se não encontrar o logBox. O id de remoção
// (`<install>-remove` ou `<install>-revert`) é dinâmico — não
// existe como botão no HTML — então _getLogBox(idRemocao) sempre
// retornava null, e a lixeira ficava silenciosa.
//
// Solução: reaproveita o logBox do botão INSTALL (que existe no
// DOM) para o log, e usa um idRemocao separado para a stream SSE
// (assim o servidor sabe que é uma execução distinta).
//
// Este é o mesmo padrão usado pelas funções de remoção das sessões
// (aplicativos, casa-escritorio, gaming) — que funcionam justamente
// porque não passam pelo `executarComandoGenerico`, cuja validação
// de `_getLogBox(idComando)` rejeitaria o id dinâmico `-remove`.

async function _executarRemocaoApp(idComando) {
    var info = APPS_REMOVIVEIS[idComando];
    if (!info) return;

    // Considera "instalado" tanto se o FAP marcou no .progresso.json
    // quanto se o /system-state detecta o app no sistema. Sem isso,
    // a lixeira ficava silenciosa para apps pré-existentes (o
    // `.progresso.json` deste diretório pode estar vazio, mas o
    // sistema tem o app).
    var marcadoPeloFap = isExecutado(idComando);
    var instaladoNoSistema = false;
    try {
        instaladoNoSistema = appJaInstaladoNoSistema(idComando);
    } catch (e) {
        instaladoNoSistema = false;
    }

    if (!marcadoPeloFap && !instaladoNoSistema) {
        alert(_tVars('comum.nao_instalado',
                     (info.nome || idComando) + ' não está instalado.',
                     { nome: info.nome || idComando }));
        return;
    }

    // Aviso extra para pré-existente (FAP não foi a causa da
    // instalação, então remover pode surpreender o usuário).
    var preExistente = instaladoNoSistema && !marcadoPeloFap;

    // ============================================================
    // MITIGAÇÃO: pré-existente sem permissão de remoção (camada 2)
    // ============================================================
    //
    // Defesa em profundidade. A camada 1 (`aplicarEstadoInstalavel`)
    // nem chega a mostrar a lixeira para esses casos. Mas se por
    // algum motivo o clique chegar aqui (DOM manipulado, botão
    // recriado, teste manual), rejeitamos com a mesma mensagem
    // explicativa do tooltip.
    if (preExistente && info.permitirRemocaoPreExistente === false) {
        alert(_traduzirMotivoBloqueio(idComando, info));
        return;
    }

    var msg = info.confirmMsg || _tVars('comum.confirmar_desinstalar',
                                        'Deseja desinstalar o ' + (info.nome || idComando) + '?',
                                        { nome: info.nome || idComando });
    if (preExistente) {
        msg = _t('comum.confirm_preexistente_prefixo',
                 '⚠️ ATENÇÃO!\n\nEste app já estava instalado antes do FAP. ' +
                 'Removê-lo do sistema pode apagar configurações e ' +
                 'dados que você criou (perfis, favoritos, saves).\n\n') + msg;
    }
    if (!confirm(msg)) return;

    var comando, idRemocao;

    // ============================================================
    // OVERRIDE POR `comandoRemocao`
    // ============================================================
    //
    // Antes de olhar o `tipo`, verifica se o registro definiu um
    // `comandoRemocao` completo. Quando presente, esse comando é
    // usado como está, ignorando `pacotes`/`appId` — o registro
    // assume total controle sobre a operação de remoção.
    //
    // Casos de uso:
    //   • tipo 'arquivos' (Gamescope Session) — sempre usa comandoRemocao
    //   • tipo 'dnf' com remoção complexa (Codecs) — precisa fazer
    //     swap de volta (ffmpeg → ffmpeg-free) e reinstalar pacotes
    //     base do Fedora que o grupo multimedia substituiu. Uma
    //     lista simples de `pacotes` não dá conta.
    //
    // Sem este override, o branch 'dnf' tentava acessar
    // `info.pacotes.join()` — e quebrava com TypeError quando o
    // registro só tinha `comandoRemocao`.
    if (info.comandoRemocao) {
        comando = info.comandoRemocao;
        idRemocao = (info.tipo === 'flatpak')
        ? idComando + '-revert'
        : _idRemocaoDe(idComando);
    } else if (info.tipo === 'flatpak') {
        comando = 'flatpak uninstall -y ' + info.appId;
        idRemocao = idComando + '-revert';
    } else if (info.tipo === 'dnf') {
        // Monta o comando base: remove os pacotes.
        var pacotes = info.pacotes.join(' ');
        comando = 'sudo dnf remove -y ' + pacotes;

        // Se o app foi instalado via repo oficial do fabricante
        // (navegadores), também removemos os arquivos .repo para
        // deixar o sistema no estado pré-instalação. O campo
        // `reposRemover` é opcional — apps DNF puros (VLC, GIMP,
        // etc) não têm e caem no fluxo simples.
        if (Array.isArray(info.reposRemover) && info.reposRemover.length > 0) {
            var repos = info.reposRemover.join(' ');
            comando += '; sudo rm -f ' + repos;
        }

        idRemocao = _idRemocaoDe(idComando);
    } else {
        console.warn('[remove-icon] tipo inválido:', info.tipo);
        return;
    }

    // Reaproveita o logBox do botão INSTALL (o único que existe
    // no DOM para este app).
    var logBox = _getLogBox(idComando);
    var btn = document.getElementById('btn-' + idComando);

    if (logBox) {
        logBox.style.display = 'block';
        _separadorLog(logBox, '🗑️ Remover ' + (info.nome || idComando));
        var infoLine = document.createElement('div');
        infoLine.className = 'log-line info';
        infoLine.textContent = '🗑️ Removendo ' + (info.nome || idComando) + '...';
        logBox.appendChild(infoLine);
        logBox.scrollTop = logBox.scrollHeight;
    }

    conectarSSE(idRemocao, logBox);

    _bloquearSessao(idComando);
    _bloquearOutrasSessoes(idComando);
    _atualizarBloqueioNavegacao();

    try {
        var response = await fetch(API_URL + '/executar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comando: comando, idComando: idRemocao })
        });

        if (!response.ok) {
            if (logBox) {
                var errorLine = document.createElement('div');
                errorLine.className = 'log-line error';
                errorLine.textContent = _tVars('comum.erro_http', '❌ Erro HTTP: {status}', { status: response.status });
                logBox.appendChild(errorLine);
                logBox.scrollTop = logBox.scrollHeight;
            }
            _liberarSessao(idComando);
            _liberarOutrasSessoes();
            _atualizarBloqueioNavegacao();
            return;
        }

        var sucesso = await aguardarConclusaoReal(idRemocao, 180000);

        _liberarSessao(idComando);
        _liberarOutrasSessoes();
        _atualizarBloqueioNavegacao();

        if (!sucesso) {
            if (logBox) {
                var errorLine2 = document.createElement('div');
                errorLine2.className = 'log-line error';
                errorLine2.textContent = sucesso === null
                ? _t('comum.erro_timeout_desinstalar', '❌ Tempo esgotado esperando a desinstalação.')
                : _tVars('comum.erro_falha_desinstalar', '❌ Falha ao desinstalar {nome}.', { nome: info.nome || idComando });
                logBox.appendChild(errorLine2);
                logBox.scrollTop = logBox.scrollHeight;
            }
            return;
        }

        // Sucesso: desmarca o install. O estado visual é
        // reaplicado pelo `aplicarEstadoInstalavel` — que cuida
        // do botão, do "Abrir" e da lixeira em uníssono.
        await desmarcarComoExecutado(idComando);

        // Invalida o cache cliente do estado do sistema. O app
        // acabou de ser removido do disco; sem isso, `appJaInstaladoNoSistema`
        // continuaria vendo o app por até 60s e o botão voltaria
        // ao estado "Abrir + lixeira" (pré-existente).
        if (typeof SystemState !== 'undefined' && typeof SystemState.invalidar === 'function') {
            SystemState.invalidar();
        }

        // Deriva o idAbrir a partir do idInstall. Convenção: para
        // 'instalar-<nome>' → 'abrir-<nome>'; para '<nome>-install'
        // → 'abrir-<nome>'. Isso cobre os padrões existentes.
        var idAbrir = _derivarIdAbrir(idComando);

        aplicarEstadoInstalavel(idComando, idAbrir, idComando);

        if (logBox) {
            var successLine = document.createElement('div');
            successLine.className = 'log-line success';
            successLine.textContent = _tVars('comum.sucesso_desinstalar', '✅ {nome} desinstalado com sucesso!', { nome: info.nome || idComando });
            logBox.appendChild(successLine);
            logBox.scrollTop = logBox.scrollHeight;
        }
    } catch (e) {
        _liberarSessao(idComando);
        _liberarOutrasSessoes();
        _atualizarBloqueioNavegacao();
        if (logBox) {
            var errorLine3 = document.createElement('div');
            errorLine3.className = 'log-line error';
            errorLine3.textContent = _tVars('comum.erro_desinstalar', '❌ Erro ao desinstalar: {msg}', { msg: e.message });
            logBox.appendChild(errorLine3);
            logBox.scrollTop = logBox.scrollHeight;
        }
    }
}

// ============================================================
// HELPER GLOBAL — "DESFAZER TUDO"
// ============================================================
//
// Botão de TEXTO EXPLÍCITO abaixo do botão de instalar. Remove
// pacote + resíduos (configs em /etc, grupos, módulos do kernel).
// Diferente da lixeira (que remove só os pacotes), este botão é
// usado apenas quando o install deixa resíduo que atrapalharia o
// sistema se ficar órfão.
//
// Config (adiciona campos ao registrarAppRemovivel):
//   {
//     modo: 'desfazerTudo',
//     idDesfazer: 'desfazer-rclone-manager',
//     comandoDesfazer: 'sudo dnf remove -y ... && ...',
//     nome: 'Rclone Manager'
//   }

async function _executarDesfazerTudo(idInstall) {
    var info = APPS_REMOVIVEIS[idInstall];
    if (!info || info.modo !== 'desfazerTudo') return;

    // Aceita pré-existente (v1.1.2): origem não importa. Se o app
    // já estava no sistema antes do FAP, o "desfazer tudo" continua
    // disponível — com aviso extra no confirm.
    var marcadoPeloFap = isExecutado(idInstall);
    var instaladoNoSistema = false;
    try {
        instaladoNoSistema = appJaInstaladoNoSistema(idInstall);
    } catch (e) {
        instaladoNoSistema = false;
    }
    if (!marcadoPeloFap && !instaladoNoSistema) return;

    var preExistente = instaladoNoSistema && !marcadoPeloFap;

    var nome = info.nome || idInstall;
    var idDesfazer = info.idDesfazer;

    var msg1 = _tVars('comum.desfazer_tudo_confirm1',
                      '⚠️ Remover completamente o ' + nome + '?\n\n' +
                      'Este botão remove TUDO que o FAP instalou:\n' +
                      '• Pacotes do sistema\n' +
                      '• Arquivos de configuração criados\n' +
                      '• Grupos de usuário e serviços\n\n' +
                      'Ação irreversível.',
                      { nome: nome });
    if (preExistente) {
        msg1 = _t('comum.confirm_preexistente_prefixo',
                  '⚠️ ATENÇÃO!\n\nEste app já estava instalado antes do FAP. ' +
                  'Removê-lo do sistema pode apagar configurações e ' +
                  'dados que você criou (perfis, favoritos, saves).\n\n') + msg1;
    }
    if (!confirm(msg1)) return;

    var msg2 = _tVars('comum.desfazer_tudo_confirm2',
                      '🔄 Última confirmação!\n\n' +
                      'Todos os resquícios do ' + nome + ' serão removidos.\n\n' +
                      'Tem certeza absoluta?',
                      { nome: nome });
    if (!confirm(msg2)) return;

    var nomeAcao = _tVars('comum.btn_desfazer_tudo',
                          '🗑️ Remover completamente o ' + nome,
                          { nome: nome });

    await executarComandoGenerico(idDesfazer, info.comandoDesfazer, nomeAcao,
                                  async function() {
                                      await desmarcarComoExecutado(idInstall);
                                      aplicarEstadoToggle(idInstall, idDesfazer);
                                      esconderBotoesAbrirDe(idInstall);
                                  });
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

    if (trigger.dataset.fapSelectBound === '1') return;
    trigger.dataset.fapSelectBound = '1';

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
// ATALHOS DE TECLADO
// ============================================================

// Ctrl+Enter: dispara o botão que está em foco, se for um .btn-executar
// habilitado. Antes havia um fallback que clicava no primeiro botão
// visível — mas isso podia acionar acidentalmente botões destrutivos
// (ex.: "Remover repositório Fedora Flatpak" ou "Desinstalar FAP") sem
// o usuário perceber. Agora exige foco explícito.
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        var foco = document.activeElement;
        if (foco && foco.classList && foco.classList.contains('btn-executar') && !foco.disabled) {
            e.preventDefault();
            foco.click();
        }
    }
});

// ============================================================
// INICIALIZAÇÃO GLOBAL
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // Carrega o estado real do sistema em paralelo com o progresso.
    // Quando as sessões começarem a pintar botões (~500ms depois),
    // o SystemState já estará pronto. Se a rede estiver lenta, os
    // helpers síncronos retornam false (comportamento anterior) e
    // o SystemState se preenche no próximo carregamento de sessão.
    SystemState.carregar();

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
    // Re-aplica o bloqueio entre sessões, caso um comando dnf/rpm
    // esteja rodando. Sem isso, os botões da sessão recém-carregada
    // ficariam todos ativos, mesmo com um comando rodando em outra.
    _reaplicarBloqueioSeNecessario();

    // Garante que o SystemState esteja carregado antes da sessão
    // pintar os botões. Se já estiver, `carregar()` retorna na
    // hora (Promise resolvida).
    SystemState.carregar();

    // Marca Flatpaks já instalados no sistema. Roda antes do
    // restaurarEstadoSessao() da sessão (que é chamado no
    // setTimeout abaixo, indiretamente via carregarProgressoInicial).
    marcarFlatpaksJaInstalados();

    setTimeout(initCustomSelects, 200);
    setTimeout(carregarProgressoInicial, 300);
    criarBotaoTema();
    _atualizarProgressoGlobal();

    setTimeout(verificarFlatpaksRemovidos, 500);

    if (typeof I18N !== 'undefined' && typeof I18N.criarSeletorIdioma === 'function') {
        setTimeout(function() { I18N.criarSeletorIdioma(); }, 100);
    }

    // Reavalia o bloqueio de navegação para a nova sessão. Se a
    // sessão recém-carregada tem comandos rodando (o que não
    // deveria acontecer, porque a navegação estaria bloqueada —
    // mas é uma garantia), os chips ficam travados.
    setTimeout(_atualizarBloqueioNavegacao, 200);
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

// ============================================================
// HELPER GLOBAL — DERIVAR IDs DE ABRIR A PARTIR DO INSTALL
// ============================================================
//
// Convenção usada em todo o FAP:
//   'instalar-vlc'         → 'abrir-vlc'
//   'samba-install'        → 'abrir-samba'
//   'okular-tesseract-install' → 'abrir-okular-tesseract'
//
// Se o botão de abrir tiver um id que NÃO segue a convenção
// (ex.: 'instalar-gnome-connections' → 'abrir-gnome-connections'
// segue, mas 'okular-tesseract-install' → 'abrir-okular' não),
// o DOM resolve sozinho — passamos o id derivado e, se o botão
// não existir, o `aplicarEstadoInstalavel` cai no estado 3.
//
// Para casos onde o nome real do botão de abrir é diferente do
// derivado (ex.: 'instalar-obs-studio' → 'abrir-obs-studio' bate,
// mas 'instalar-easyeffects' → 'abrir-easyeffects' bate), a
// convenção cobre 100% dos casos atuais. Se surgir divergência
// futura, mapeie aqui.
// Mapa de exceções install → abrir. Vazio no momento — todas as
// sessões atuais seguem a convenção `_derivarIdAbrir`. Preenchido
// apenas se alguma sessão futura tiver idAbrir fora do padrão.
var _MAPA_ABRIR_EXCECOES = {
};

function _derivarIdAbrir(idInstall) {
    if (_MAPA_ABRIR_EXCECOES[idInstall]) {
        return _MAPA_ABRIR_EXCECOES[idInstall];
    }
    if (idInstall.indexOf('instalar-') === 0) {
        return 'abrir-' + idInstall.substring('instalar-'.length);
    }
    if (idInstall.indexOf('-install') !== -1) {
        return 'abrir-' + idInstall.replace(/-install$/, '');
    }
    return null;
}
