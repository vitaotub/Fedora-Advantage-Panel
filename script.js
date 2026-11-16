var API_URL = (function() {
    try {
        var origin = window.location && window.location.origin;
        if (origin && origin !== 'null' && origin.indexOf('file://') !== 0) {
            return origin;
        }
    } catch (e) {  }
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

            document.querySelectorAll('.fap-version').forEach(function(el) {
                el.textContent = FAP_VERSION;
            });

            document.dispatchEvent(new CustomEvent('fap-versao-pronta', {
                detail: { versao: FAP_VERSION }
            }));
        }
    } catch (e) {
        console.warn('[Versão] Não foi possível consultar /info:', e.message);
    }
}

var GITHUB_REPO = 'vitaotub/Fedora-Advantage-Panel';
var ULTIMA_VERIFICACAO_KEY = 'fap_ultima_verificacao';
var VERSAO_REMOTA_KEY = 'fap_versao_remota';

var TTL_COM_ATUALIZACAO_MS = 12 * 60 * 60 * 1000;
var TTL_SEM_ATUALIZACAO_MS = 15 * 60 * 1000;

async function verificarAtualizacoes() {
    var agora = Date.now();
    var ultima = 0;
    var cache = null;
    try {
        ultima = parseInt(localStorage.getItem(ULTIMA_VERIFICACAO_KEY) || '0', 10) || 0;
        cache = localStorage.getItem(VERSAO_REMOTA_KEY);
    } catch (e) {
        ultima = 0;
        cache = null;
    }

    if (cache) {
        var versaoLocal = FAP_VERSION || '?';
        var temNovidade = temAtualizacao(versaoLocal, cache);
        var ttl = temNovidade ? TTL_COM_ATUALIZACAO_MS : TTL_SEM_ATUALIZACAO_MS;
        if (agora - ultima < ttl) {
            return cache;
        }
    }

    try {

        var url = 'https://api.github.com/repos/' + GITHUB_REPO +
        '/releases/latest?_=' + agora;
        var resp = await fetch(url, {
            cache: 'no-store',
            signal: _sinalTimeout(10000)
        });
        if (!resp.ok) {
            console.warn('[Atualização] GitHub retornou HTTP', resp.status);
            return null;
        }
        var data = await resp.json();
        var tagRemota = data.tag_name || '';

        try {
            localStorage.setItem(ULTIMA_VERIFICACAO_KEY, String(agora));
            localStorage.setItem(VERSAO_REMOTA_KEY, tagRemota);
        } catch (e) {  }

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
        var resp = await fetch(url, {
            cache: 'no-store',
            signal: _sinalTimeout(10000)
        });
        if (!resp.ok) return null;
        var data = await resp.json();
        var tag = data.tag_name || '';
        try {
            localStorage.setItem(ULTIMA_VERIFICACAO_KEY, String(Date.now()));
            localStorage.setItem(VERSAO_REMOTA_KEY, tag);
        } catch (e) {  }
        return tag;
    } catch (e) {
        return null;
    }
}

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

var _atualizacaoEmAndamento = false;

function _sinalTimeout(ms) {
    try {
        if (typeof AbortSignal !== 'undefined' &&
            typeof AbortSignal.timeout === 'function') {
            return AbortSignal.timeout(ms);
            }
    } catch (e) {  }
    return undefined;
}

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

    var btnSobre = document.getElementById('btn-atualizar-fap');
    var btnSobreTextoOriginal = btnSobre ? btnSobre.textContent : '';
    if (btnSobre) {
        btnSobre.disabled = true;
        btnSobre.style.opacity = '0.5';
        btnSobre.style.cursor = 'not-allowed';
    }

    var badgeFlutuante = document.querySelector('.badge-atualizacao');
    if (badgeFlutuante) {
        badgeFlutuante.disabled = true;
        badgeFlutuante.style.opacity = '0.5';
        badgeFlutuante.style.cursor = 'not-allowed';
    }

    mostrarToast(
        _t('comum.badge_atualizando', '🔄 Atualizando FAP...'),
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

            var badgeEl = document.querySelector('.badge-atualizacao');
            if (badgeEl) badgeEl.remove();
            document.body.classList.remove('fap-tem-badge-atualizacao');

            try {
                localStorage.removeItem(ULTIMA_VERIFICACAO_KEY);
                localStorage.removeItem(VERSAO_REMOTA_KEY);
            } catch (e) {  }
        } else if (sucesso === false) {
            mostrarToast(_t('comum.status_falha', '❌ Falha na execução'), 'error', 8000);
            if (btnSobre) {
                btnSobre.disabled = false;
                btnSobre.style.opacity = '1';
                btnSobre.style.cursor = 'pointer';
                btnSobre.textContent = btnSobreTextoOriginal;
            }

            var badgeErro = document.querySelector('.badge-atualizacao');
            if (badgeErro) {
                badgeErro.disabled = false;
                badgeErro.style.opacity = '1';
                badgeErro.style.cursor = 'pointer';
            }
        }
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
            _finalizar(false);
            return;
        }

        es = new EventSource(API_URL + '/stream?id=atualizar-fap');
        es.onmessage = function(event) {
            try {
                var dados = JSON.parse(event.data);
                if (dados.tipo === 'end') {

                    _finalizar(dados.sucesso === true);
                }
            } catch (e) {  }
        };
        es.onerror = function() {
            _finalizar(false);
        };

        setTimeout(function() { _finalizar(false); }, 30 * 60 * 1000);

    } catch (err) {
        mostrarToast(
            _tVars('comum.erro_conexao', '❌ Erro de conexão: {msg}', { msg: err.message }),
                     'error', 6000
        );
        _atualizacaoEmAndamento = false;
        if (btnSobre) {
            btnSobre.disabled = false;
            btnSobre.style.opacity = '1';
            btnSobre.style.cursor = 'pointer';
            btnSobre.textContent = btnSobreTextoOriginal;
        }
    }
}

async function mostrarBadgeSeHouverAtualizacao() {

    if (document.querySelector('.badge-atualizacao')) {
        console.log('[Atualização] Badge já existe, pulando.');
        return;
    }

    var versaoRemota = await verificarAtualizacoes();
    if (!versaoRemota) return;

    var versaoLocal = FAP_VERSION || '?';
    if (!temAtualizacao(versaoLocal, versaoRemota)) return;

    var versaoRemotaFresca = await verificarAtualizacoesForcado();
    if (!versaoRemotaFresca || !temAtualizacao(versaoLocal, versaoRemotaFresca)) {
        try {
            localStorage.removeItem(ULTIMA_VERIFICACAO_KEY);
            localStorage.removeItem(VERSAO_REMOTA_KEY);
        } catch (e) {  }
        console.log('[Atualização] Cache obsoleto invalidado após verificação fresca.');
        return;
    }

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

        document.body.appendChild(badge);
        document.body.classList.add('fap-tem-badge-atualizacao');

        console.log('⬆️ Atualização disponível: ' + versaoLocal + ' → ' + versaoRemota);
}

window._dispararAtualizacaoFAP = _dispararAtualizacaoFAP;

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

function _escapeHTML(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

var SystemState = (function() {
    var _dados = null;
    var _dadosTs = 0;
    var _promessa = null;

    function _carregar(forcarRefresh) {
        if (_dados && !forcarRefresh) return Promise.resolve(_dados);
        if (_promessa) return _promessa;

        var url = API_URL + '/system-state' + (forcarRefresh ? '?refresh=1' : '');

        _promessa = fetch(url, { cache: 'no-store' })
        .then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(function(dados) {
            _dados = dados || {};
            _dadosTs = Date.now();
            _promessa = null;

            var flatpaks = Array.isArray(_dados.flatpaks_installed) ? _dados.flatpaks_installed : [];
            var pacotes  = Array.isArray(_dados.packages_installed) ? _dados.packages_installed : [];
            var repos    = Array.isArray(_dados.repos_enabled)     ? _dados.repos_enabled     : [];
            var flathubAtivo = repos.indexOf('flatpak:flathub') !== -1;

            var suspeito =
            (flatpaks.length === 0 && flathubAtivo) ||
            pacotes.length === 0 ||
            repos.length === 0;

            if (suspeito) {
                console.log('[SystemState] resposta suspeita (flatpaks/pacotes/repos vazios) — refetch com ?refresh=1');
                return fetch(API_URL + '/system-state?refresh=1', { cache: 'no-store' })
                .then(function(r) { return r.ok ? r.json() : null; })
                .then(function(dados2) {
                    if (dados2) {
                        _dados = dados2;
                        _dadosTs = Date.now();
                    }
                    return _dados;
                })
                .catch(function() { return _dados; });
            }
            return _dados;
        })
        .catch(function(e) {
            console.warn('[SystemState] Falha ao carregar:', e.message);
            _dados = null;
            _promessa = null;
            return {};
        });

        return _promessa;
    }

    function _lista(campo) {
        if (!_dados) return [];
        return Array.isArray(_dados[campo]) ? _dados[campo] : [];
    }

    return {
        carregar: _carregar,

        repoAtivo: function(id) {
            return _lista('repos_enabled').indexOf(id) !== -1;
        },

        remoteFlatpakAtivo: function(id) {
            return _lista('repos_enabled').indexOf('flatpak:' + id) !== -1;
        },

        repoFabricanteAtivo: function(id) {
            return _lista('repos_enabled').indexOf('file:' + id) !== -1;
        },

        pacoteInstalado: function(nome) {
            return _lista('packages_installed').indexOf(nome) !== -1;
        },

        flatpakInstalado: function(appId) {
            return _lista('flatpaks_installed').indexOf(appId) !== -1;
        },

        membroDoGrupo: function(nome) {
            return _lista('groups_membership').indexOf(nome) !== -1;
        },

        kernelParam: function(nome) {
            return _dados && _dados.kernel_params ? _dados.kernel_params[nome] : undefined;
        },

        servicoAtivo: function(nome) {
            return _lista('services_active').indexOf(nome) !== -1;
        },

        arquivoPresente: function(caminho) {
            return _lista('config_files_present').indexOf(caminho) !== -1;
        },

        localRtc: function() {
            return !!(_dados && _dados.local_rtc);
        },

        localeLang: function() {
            return (_dados && typeof _dados.locale_lang === 'string')
            ? _dados.locale_lang
            : '';
        },

        bruto: function() { return _dados; },

                   cacheIdade: function() {
                       if (!_dados || !_dadosTs) return Infinity;
                       return Date.now() - _dadosTs;
                   },

                   invalidar: function() {
                       _dados = null;
                       _dadosTs = 0;
                       _promessa = null;
                   }
    };
})();

function ehPreExistente(idComando, jaInstaladoNoSistema) {
    if (!jaInstaladoNoSistema) return false;
    return !isExecutado(idComando);
}

function appJaInstaladoNoSistema(idComando) {
    var info = APPS_REMOVIVEIS[idComando];
    if (!info) return false;

    if (info.ignorarPreExistente === true) {
        return false;
    }

    if (info.modo === 'desfazerTudo') {
        if (Array.isArray(info.pacotes) && info.pacotes.length > 0) {
            for (var i = 0; i < info.pacotes.length; i++) {
                if (SystemState.pacoteInstalado(info.pacotes[i])) {
                    return true;
                }
            }
            return false;
        }

        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[appJaInstalado] desfazerTudo sem `pacotes`:', idComando);
        }
        return false;
    }

    if (info.tipo === 'flatpak' && info.appId) {
        return SystemState.flatpakInstalado(info.appId);
    }

    if (info.tipo === 'dnf' && Array.isArray(info.pacotes) && info.pacotes.length > 0) {
        for (var i = 0; i < info.pacotes.length; i++) {
            if (SystemState.pacoteInstalado(info.pacotes[i])) {
                return true;
            }
        }
        return false;
    }

    return false;
}

function _estaRealmenteInstalado(idComando) {
    var info = APPS_REMOVIVEIS[idComando];
    if (!info) {

        return true;
    }

    var bruto = SystemState.bruto();
    if (!bruto || !Array.isArray(bruto.packages_installed) ||
        !Array.isArray(bruto.flatpaks_installed)) {
        return true;
        }

        if (info.modo === 'desfazerTudo') {
            if (Array.isArray(info.pacotes)) {
                for (var i = 0; i < info.pacotes.length; i++) {
                    if (SystemState.pacoteInstalado(info.pacotes[i])) return true;
                }
            }
            return false;
        }
        if (info.tipo === 'flatpak' && info.appId) {
            return SystemState.flatpakInstalado(info.appId);
        }

        if (info.tipo === 'dnf' && Array.isArray(info.pacotes) && info.pacotes.length > 0) {
            for (var j = 0; j < info.pacotes.length; j++) {
                if (SystemState.pacoteInstalado(info.pacotes[j])) return true;
            }
            return false;
        }

        return true;
}

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
    try { localStorage.setItem(TEMA_STORAGE_KEY, tema); } catch (e) {  }
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
    } catch (e) {  }
}

var _contadorSessoesConcluidas = -1;

function _invalidarContadorSessoes() {
    _contadorSessoesConcluidas = -1;
}

function _atualizarProgressoGlobal() {
    var el = document.getElementById('progresso-global');
    if (!el) return;
    var na = _sessoesNA();
    var sessoesAtivas = SESSOES_PRINCIPAIS.filter(function(id) {
        if (na.indexOf(id) !== -1) return false;
        var s = SESSOES.find(function(x) { return x.id === id; });
        return !(s && s.informativa);
    });
    var total = sessoesAtivas.length;

    if (_contadorSessoesConcluidas < 0) {
        var cont = 0;
        for (var i = 0; i < sessoesAtivas.length; i++) {
            if (getStatusSessao(sessoesAtivas[i]) === 'executado') cont++;
        }
        _contadorSessoesConcluidas = cont;
    }

    el.innerHTML = '<span class="numero">' + _contadorSessoesConcluidas + '</span>/' + total;
    el.title = _contadorSessoesConcluidas + ' de ' + total + ' sessões concluídas';
}

var SESSOES = [
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
{
    id: 'hardware',
    nome: 'Hardware',
    nomeKey: 'sessoes.hardware.nome',
    comandos: {
        'vulkan-amd': {
            textoConcluido: '✅ Vulkan instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_vulkan'
        },
        'vaapi-amd': {
            textoConcluido: '✅ VA-API instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_vaapi'
        },
        'vaapi-check-amd': { sempreClicavel: true },
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
        'nvidia-driver-install': {
            textoConcluido: '✅ Driver Nvidia instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_nvidia_driver'
        },
        'nvidia-driver-remove': {
            textoConcluido: '✅ Driver Nvidia removido',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_nvidia_driver_remove'
        },

        'nvidia-vaapi-install': {
            textoConcluido: '✅ Tradutor VA-API instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_nvidia_vaapi'
        },
        'nvidia-vaapi-utils': {
            textoConcluido: '✅ Utilitários instalados',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_nvidia_vaapi_utils'
        },
        'nvidia-vaapi-env': {
            textoConcluido: '✅ Variáveis configuradas',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_nvidia_vaapi_env'
        },
        'nvidia-vaapi-env-remove': {
            textoConcluido: '✅ Variáveis removidas',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_nvidia_vaapi_env_remove'
        },
        'nvidia-vaapi-check': { sempreClicavel: true },
        'intel-media-install': {
            textoConcluido: '🎬 Intel Media Driver instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_intel_media'
        },
        'libva-intel-install': {
            textoConcluido: '🎬 Driver legado instalado',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_intel_legacy'
        },
        'intel-vaapi-utils': {
            textoConcluido: '✅ Utilitários instalados',
            textoConcluidoKey: 'sessoes.hardware.texto_concluido_intel_utils'
        },
        'vaapi-check-intel': { sempreClicavel: true }
    }
},
{
    id: 'dispositivos-perifericos',
    nome: 'Dispositivos e Periféricos',
    nomeKey: 'sessoes.dispositivos-perifericos.nome',
    comandos: {
        'hw-scan': { sempreClicavel: true },
        'firmware-vendor-install': {
            textoConcluido: '✅ Firmwares adicionais instalados',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.texto_concluido_firmware_vendor'
        },
        'firmware-vendor-remove': {
            textoConcluido: '✅ Firmwares revertidos',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.texto_concluido_firmware_vendor_remove'
        },
        'driver-realtek-r8168-install': { sempreClicavel: true, textoConcluido: '✅ Driver Realtek r8168 instalado' },
        'driver-realtek-r8168-remove': { sempreClicavel: true },
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
        'driver-broadcom-wl-install': {
            textoConcluido: '✅ Pacote instalado',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.btn_pacote_instalado'
        },
        'driver-broadcom-wl-remove': {
            textoConcluido: '✅ Removido',
            textoConcluidoKey: 'sessoes.dispositivos-perifericos.btn_revertido'
        },
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
        'instalar-kdenlive': { textoConcluido: '✅ Kdenlive instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_kdenlive', flatpakId: 'org.kde.kdenlive' },
        'instalar-shotcut': { textoConcluido: '✅ Shotcut instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_shotcut', flatpakId: 'org.shotcut.Shotcut' },
        'instalar-openshot': { textoConcluido: '✅ OpenShot instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_openshot', flatpakId: 'org.openshot.OpenShot' },
        'instalar-avidemux': { textoConcluido: '✅ Avidemux instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_avidemux', flatpakId: 'org.avidemux.Avidemux' },
        'instalar-drift': { textoConcluido: '✅ Drift instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_drift', flatpakId: 'org.cutwire.Drift' },
        'instalar-rustdesk': { textoConcluido: '✅ RustDesk instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_rustdesk' },
        'instalar-thunderbird': { textoConcluido: '✅ Thunderbird instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_thunderbird' },
        'instalar-okular': { textoConcluido: '✅ Okular instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_okular' },
        'instalar-foliate': { textoConcluido: '✅ Foliate instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_foliate' },
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
        'instalar-blender': { textoConcluido: '✅ Blender instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_blender', flatpakId: 'org.blender.Blender' },
        'instalar-audacity': { textoConcluido: '✅ Audacity instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_audacity', flatpakId: 'org.audacityteam.Audacity' },
        'instalar-ardour': { textoConcluido: '✅ Ardour instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_ardour' },
        'instalar-lmms': { textoConcluido: '✅ LMMS instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_lmms' },
        'instalar-chromium': { textoConcluido: '✅ Chromium instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_chromium' },

        'instalar-opera': { textoConcluido: '✅ Opera instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_opera' },
        'instalar-brave': { textoConcluido: '✅ Brave instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_brave' },
        'instalar-vivaldi': { textoConcluido: '✅ Vivaldi instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_vivaldi' },
        'instalar-edge': { textoConcluido: '✅ Microsoft Edge instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_edge' },

        'abrir-affinity': { sempreClicavel: true },
        'instalar-remmina': { textoConcluido: '✅ Remmina instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_remmina' },
        'instalar-gnome-connections': { textoConcluido: '✅ GNOME Connections instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_gnome_connections' },
        'instalar-krdc': { textoConcluido: '✅ KRDC instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_krdc' },

        'instalar-artcraft-launcher': { textoConcluido: '✅ ArtCraft Launcher instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_artcraft_launcher' },

        'instalar-firefox':     { textoConcluido: '✅ Firefox instalado',    textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_firefox' },
        'instalar-vscode':      { textoConcluido: '✅ VS Code instalado',    textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_vscode', flatpakId: 'com.visualstudio.code' },
        'instalar-drawy':       { textoConcluido: '✅ Drawy instalado',      textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_drawy', flatpakId: 'org.kde.drawy' },
        'instalar-gear-lever':  { textoConcluido: '✅ Gear Lever instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_gear_lever', flatpakId: 'it.mijorus.gearlever' },
        'instalar-packet':      { textoConcluido: '✅ Packet instalado',     textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_packet', flatpakId: 'io.github.nozwock.Packet' },

        'instalar-lightworks': { textoConcluido: '✅ Lightworks instalado', textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_lightworks' },
        'instalar-rclone-manager': {
            textoConcluido: '✅ Rclone Manager instalado',
            textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_rclone_manager'
        }
    }
},
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
        }
    }
},
{
    id: 'gaming',
    nome: 'Gaming',
    nomeKey: 'sessoes.gaming.nome',
    comandos: {
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
        'wine-install': { textoConcluido: '✅ Wine instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_wine' },
        'winetricks-install': { textoConcluido: '✅ Winetricks instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_winetricks' },
        'bottles-install': {
            textoConcluido: '✅ Bottles instalado',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_bottles',
            flatpakId: 'com.usebottles.bottles'
        },
        'ntsync-install': { textoConcluido: '✅ NTSYNC instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_ntsync' },
        'gamemode-install': { textoConcluido: '✅ GameMode ativado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_gamemode' },
        'mangohud-install': { textoConcluido: '✅ MangoHud instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_mangohud' },
        'goverlay-install': { textoConcluido: '✅ Goverlay instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_goverlay' },
        'gamescope-install': { textoConcluido: '✅ Gamescope instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_gamescope' },
        'protonup-qt-install': {
            textoConcluido: '✅ ProtonUp-Qt instalado',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_protonup',
            flatpakId: 'net.davidotek.pupgui2'
        },
        'vkbasalt-install': { textoConcluido: '✅ vkBasalt instalado', textoConcluidoKey: 'sessoes.gaming.texto_concluido_vkbasalt' },
        'gamemode-presets-apply': {
            textoConcluido: '✅ Presets aplicados',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_gamemode_presets'
        },
        'controller-test-install': {
            textoConcluido: '✅ Preferências de Joysticks instaladas',
            textoConcluidoKey: 'sessoes.gaming.texto_concluido_joystick_prefs'
        },
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
        }
    }
},
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
{
    id: 'ajustes-manutencao',
    nome: 'Ajustes e Manutenção',
    nomeKey: 'sessoes.ajustes-manutencao.nome',
    comandos: {
        'vm-max-map-count': { textoConcluido: '✅ Ajuste aplicado', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_vm_max_map_count' },
        'vm-max-map-count-remove': { textoConcluido: '✅ Ajuste revertido', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_vm_max_map_count_remove' },
        'vm-swappiness-cache': { textoConcluido: '✅ Ajuste aplicado', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_vm_swappiness_cache' },
        'vm-swappiness-cache-remove': { textoConcluido: '✅ Ajuste revertido', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_vm_swappiness_cache_remove' },
        'tcp-bbr': { textoConcluido: '✅ TCP BBR ativado', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_tcp_bbr' },
        'tcp-bbr-remove': { textoConcluido: '✅ TCP BBR desativado', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_tcp_bbr_remove' },
        'realtime-setup': { textoConcluido: '✅ Grupo realtime configurado', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_realtime_setup' },
        'realtime-setup-remove': { textoConcluido: '✅ Grupo realtime removido', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_realtime_setup_remove' },
        'dnf-speed': { sempreClicavel: true },
        'idioma-packs': { textoConcluido: '✅ Tradução instalada', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_packs' },
        'idioma-hunspell': { textoConcluido: '✅ Corretor instalado', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_hunspell' },
        'idioma-localectl': { textoConcluido: '✅ Localidade configurada', textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_localectl' },
        'dual-boot-time': {
            textoConcluido: '✅ Relógio em horário local',
            textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_dual_boot'
        },
        'dual-boot-time-remove': {
            textoConcluido: '✅ Relógio em UTC',
            textoConcluidoKey: 'sessoes.ajustes-manutencao.texto_concluido_dual_boot_remove'
        },
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
        },

        'pos-upgrade-limpeza': {
            textoConcluido: '✅ Limpeza pós-upgrade feita',
            textoConcluidoKey: 'sessoes.ajustes-manutencao.upgrade_pos_limpeza_concluido'
        },
        'pos-upgrade-rpmconf': {
            textoConcluido: '✅ Configurações mescladas',
            textoConcluidoKey: 'sessoes.ajustes-manutencao.upgrade_pos_rpmconf_concluido'
        },
        'pos-upgrade-distrosync': {
            textoConcluido: '✅ Distro-sync feito',
            textoConcluidoKey: 'sessoes.ajustes-manutencao.upgrade_pos_distrosync_concluido'
        },
        'pos-upgrade-fixfiles': {
            textoConcluido: '✅ Relabel SELinux agendado',
            textoConcluidoKey: 'sessoes.ajustes-manutencao.upgrade_pos_fixfiles_concluido'
        },
        'pos-upgrade-rescue': {
            textoConcluido: '✅ dracut-config-rescue instalado',
            textoConcluidoKey: 'sessoes.ajustes-manutencao.upgrade_pos_rescue_concluido'
        },
        'pos-upgrade-concluido': { sempreClicavel: true },

        'upgrade-f45-download': { sempreClicavel: true },
        'upgrade-f45-reboot': { sempreClicavel: true },
        'upgrade-f45-cancelar': { sempreClicavel: true }
    }
},
{
    id: 'estado-fedora',
    nome: 'Estado do Fedora',
    nomeKey: 'sessoes.estado-fedora.nome',
    comandos: {
        'fedora-version-check': { sempreClicavel: true },
        'atomic-check': { sempreClicavel: true },
        'selinux-status-check': { sempreClicavel: true },
        'selinux-troubleshoot': { sempreClicavel: true },

        'nvidia-secureboot-prepare': { sempreClicavel: true },
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
{
    id: 'sobre-fap',
    nome: 'Sobre o FAP',
    nomeKey: 'sessoes.sobre-fap.nome',

    informativa: true,
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

var _infoComandoCache = {};

function _infoComando(idComando) {
    if (idComando in _infoComandoCache) {
        return _infoComandoCache[idComando];
    }
    for (var i = 0; i < SESSOES.length; i++) {
        var comandos = SESSOES[i].comandos;
        if (comandos && comandos[idComando]) {
            _infoComandoCache[idComando] = comandos[idComando];
            return comandos[idComando];
        }
    }
    _infoComandoCache[idComando] = null;
    return null;
}

var SEMPRE_CLICAVEIS = SESSOES.reduce(function(lista, sessao) {
    Object.keys(sessao.comandos || {}).forEach(function(id) {
        if (sessao.comandos[id].sempreClicavel) lista.push(id);
    });
        return lista;
}, []);

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

var _secureBootCache = null;
var _secureBootMokCache = null;

var _secureBootCtxI18nCache = null;

function _secureBootCtxTraduzido(contexto) {
    if (!_secureBootCtxI18nCache) {
        _secureBootCtxI18nCache = {
            'o driver NVIDIA': _t('seguranca.secureboot_ctx_nvidia', 'o driver NVIDIA'),
            'a câmera virtual do OBS': _t('seguranca.secureboot_ctx_obs', 'a câmera virtual do OBS'),
            'Broadcom, Realtek ou xpadneo': _t('seguranca.secureboot_ctx_perifericos', 'Broadcom, Realtek ou xpadneo'),
            'VirtualBox': 'VirtualBox'
        };
    }
    return _secureBootCtxI18nCache[contexto] || contexto;
}

async function _detectarSecureBoot() {
    if (_secureBootCache !== null) return _secureBootCache;
    try {
        var r = await fetch(API_URL + '/hardware-scan', { cache: 'no-store' });
        if (!r.ok) return 'unknown';
        var data = await r.json();
        _secureBootCache = (data && data.secure_boot) ? data.secure_boot : 'unknown';

        _secureBootMokCache = (data && data.secure_boot_mok) ? data.secure_boot_mok : null;
        return _secureBootCache;
    } catch (e) {
        return 'unknown';
    }
}

function _mokEnrolled() {
    return _secureBootMokCache && _secureBootMokCache.enrolled === true;
}

function _akmodCarregadoFora() {
    if (!_secureBootMokCache) return null;
    return _secureBootMokCache.akmod_carregado || null;
}

function _secureBootPendingImport() {
    return !!(_secureBootMokCache && _secureBootMokCache.pending_import === true);
}

function _secureBootCurrentKeyNotEnrolled() {
    return !!(_secureBootMokCache && _secureBootMokCache.current_key_not_enrolled === true);
}

function _secureBootOutrasChavesAkmos() {
    return !!(_secureBootMokCache && _secureBootMokCache.other_akmods_keys_enrolled === true);
}

async function _prepararSecureBoot() {

    var idComando = 'nvidia-secureboot-prepare';
    var comando =
    'sudo dnf install -y kmodtool akmods mokutil openssl kernel-devel-matched kernel-headers || exit 1; ' +

    'if [ ! -f /etc/pki/akmods/certs/public_key.der ]; then ' +
    '  sudo kmodgenca -a 2>&1 || true; ' +
    'fi; ' +

    'sudo chmod o+rx /etc/pki/akmods/certs/ 2>/dev/null || true; ' +
    'sudo chmod o+r /etc/pki/akmods/certs/public_key.der 2>/dev/null || true';
    await executarComandoGenerico(idComando, comando,
                                  _t('seguranca.secureboot_preparar_btn', '🔐 Preparar Secure Boot'),
                                  async function() {
                                      _secureBootCache = null;

                                      _secureBootMokCache = null;

                                      try {
                                          SystemState.invalidar();
                                          await SystemState.carregar(true);
                                      } catch (e) {  }

                                      try {
                                          var novoEstadoSb = await _detectarSecureBoot();
                                          var painelGlobal = document.getElementById('secureboot-painel-global');
                                          if (painelGlobal && typeof _renderizarPainelSecureBoot === 'function') {
                                              _renderizarPainelSecureBoot(painelGlobal, novoEstadoSb);
                                          }
                                          var badgeNvidia = document.getElementById('nvidia-secureboot-panel');
                                          if (badgeNvidia && typeof _renderizarBadgeSecureBoot === 'function') {
                                              _renderizarBadgeSecureBoot(badgeNvidia, novoEstadoSb, 'o driver NVIDIA');
                                          }
                                          var badgeVirt = document.getElementById('secureboot-badge-virtualizacao');
                                          if (badgeVirt && typeof _renderizarBadgeSecureBoot === 'function') {
                                              _renderizarBadgeSecureBoot(badgeVirt, novoEstadoSb, 'VirtualBox');
                                          }
                                          var badgeDisp = document.getElementById('secureboot-badge-dispositivos');
                                          if (badgeDisp && typeof _renderizarBadgeSecureBoot === 'function') {
                                              _renderizarBadgeSecureBoot(badgeDisp, novoEstadoSb, 'Broadcom, Realtek ou xpadneo');
                                          }
                                          var badgeProd = document.getElementById('secureboot-badge-producao');
                                          if (badgeProd && typeof _renderizarBadgeSecureBoot === 'function') {
                                              _renderizarBadgeSecureBoot(badgeProd, novoEstadoSb, 'a câmera virtual do OBS');
                                          }
                                      } catch (e) {  }

                                      if (typeof mostrarToast === 'function') {
                                          mostrarToast(_t('seguranca.secureboot_preparado_ok',
                                                          '✅ Chave do akmods gerada. Falta o registro no firmware (passo 2).'),
                                                       'success', 8000);
                                      }
                                  });
}

function executarPrepararSecureBoot() {
    return _prepararSecureBoot();
}

function _renderizarPainelSecureBoot(container, estado) {
    if (!container) return;

    if (estado === 'disabled') {
        container.innerHTML = '<div class="aviso-sucesso">✅ ' +
        _t('seguranca.secureboot_desabilitado',
           'Secure Boot está desabilitado. Você pode instalar qualquer <code>akmod-*</code> sem registro no firmware.') +
        '</div>';
        return;
    }
    if (estado === 'not_efi') {

        container.innerHTML = '<div class="aviso-sucesso">✅ ' +
        _t('seguranca.secureboot_nao_aplica',
           'Secure Boot não se aplica — o sistema está em BIOS legacy (não-UEFI). Nenhum registro é necessário; os <code>akmod-*</code> carregam normalmente.') +
        '</div>';
        return;
    }
    if (estado === 'unknown') {
        container.innerHTML = '<div class="aviso-caixa">⚠️ ' +
        _t('seguranca.secureboot_indeterminado',
           'Não foi possível determinar o estado do Secure Boot. Se você sabe que ele está ativo, siga o passo a passo abaixo antes de instalar qualquer <code>akmod-*</code>.') +
        '</div>';
        return;
    }

    var chaveLocal = false;
    if (_secureBootMokCache && typeof _secureBootMokCache.chave_gerada === 'boolean') {
        chaveLocal = _secureBootMokCache.chave_gerada;
    } else {
        try { chaveLocal = SystemState.arquivoPresente('/etc/pki/akmods/certs/public_key.der'); } catch (e) {}
    }
    var mokEnrolled = _mokEnrolled();

    if (mokEnrolled && chaveLocal && !_secureBootCurrentKeyNotEnrolled()) {
        container.innerHTML =
        '<div class="aviso-sucesso" style="border-color: #34d399; color: #34d399;">✅ ' +
        _t('seguranca.secureboot_configurado_ok',
           'Secure Boot está ativo e a chave do akmods já está <strong>registrada no firmware</strong>. Os módulos assinados pelo FAP (NVIDIA, VirtualBox, Broadcom, Realtek, xpadneo, câmera virtual do OBS) carregam normalmente no boot. Nenhuma ação adicional é necessária.') +
        '</div>';
        return;
    }

    if (mokEnrolled && _secureBootCurrentKeyNotEnrolled()) {

    }

    if (chaveLocal && _secureBootPendingImport()) {
        var chaveAntigaEnrolled = mokEnrolled && _secureBootCurrentKeyNotEnrolled();
        if (chaveAntigaEnrolled) {
            container.innerHTML =
            '<div class="aviso-caixa" style="border-color: #f59e0b; color: #f59e0b;">' +
            '<strong>' + _t('seguranca.secureboot_combined_titulo',
                            '🔐 Chave nova importada — reinício pendente') + '</strong><br>' +
                            _t('seguranca.secureboot_combined_desc',
                               'O firmware reconhece uma chave <strong>antiga</strong> do akmods, mas o FAP assina NOVOS ' +
                               'akmods com a chave <strong>atual</strong> (<code>/etc/pki/akmods/certs/public_key.der</code>), ' +
                               'que foi importada com <code>mokutil --import</code> e aguarda o <strong>próximo boot</strong> ' +
                               'para ser efetivada. ' +
                               'Reinicie o computador e complete a tela azul do <strong>MOK Management</strong> ' +
                               '("Enroll MOK" → "Continue" → "Yes"). ' +
                               'Depois do reboot, esta mensagem deve desaparecer — a chave atual será a reconhecida pelo ' +
                               'firmware, e novos akmods do FAP carregarão normalmente no boot.') +
                            '</div>';
                            return;
        }

        container.innerHTML =
        '<div class="aviso-caixa" style="border-color: #f59e0b; color: #f59e0b;">' +
        '<strong>' + _t('seguranca.secureboot_pending_import_titulo',
                        '🔐 Chave importada — reinício pendente') + '</strong><br>' +
                        _t('seguranca.secureboot_pending_import_desc',
                           'A chave do akmods foi importada com <code>mokutil --import</code>, mas o registro no firmware ' +
                           'só acontece no <strong>próximo boot</strong>. Reinicie o computador e complete a tela azul do ' +
                           '<strong>MOK Management</strong> ("Enroll MOK" → "Continue" → "Yes"). ' +
                           'Depois do reboot, volte aqui para confirmar — esta mensagem deve desaparecer.') +
                        '</div>';
                        return;
    }

    var akmodFora = _akmodCarregadoFora();
    if (akmodFora) {
        var modNome = akmodFora.modulo;
        var nomeSessaoSb = _t('sessoes.estado-fedora.nome', 'Estado do Fedora');
        container.innerHTML =
        '<div class="aviso-caixa" style="border-color: #f59e0b; color: #f59e0b;">' +
        '<strong>⚠️ ' + _t('seguranca.secureboot_akmod_carregado_titulo',
                           'Chave local do akmods não está registrada') + '</strong><br>' +
                           _tVars('seguranca.secureboot_akmod_carregado_desc',
                                  'O módulo <code>{modulo}</code> está carregado e funcionando, o que significa que ALGUMA chave akmods está registrada no firmware. Mas a chave local do FAP (<code>/etc/pki/akmods/certs/public_key.der</code>) NÃO está registrada. Se você for instalar outros akmods pelo FAP (VirtualBox, Broadcom, Realtek, xpadneo, câmera virtual do OBS), precisa fazer o registro da chave local em <strong>{sessao}</strong> → <strong>Secure Boot</strong>. Se for continuar só com o que já tem, pode ignorar este aviso.',
                                  { modulo: modNome, sessao: nomeSessaoSb }) +
                           '</div>';
        return;
    }

    var notaHtml = '';

    if (mokEnrolled && _secureBootCurrentKeyNotEnrolled()) {
        notaHtml =
        '<div class="aviso-caixa" style="border-color: #f59e0b; color: #f59e0b; margin-bottom: 1rem;">' +
        '<strong>' + _t('seguranca.secureboot_old_key_nota_titulo',
                        '⚠️ Chave antiga do akmods está registrada, mas a atual do FAP não') + '</strong><br>' +
                        _t('seguranca.secureboot_old_key_nota_desc',
                           'O firmware reconhece uma chave antiga, mas o FAP assina NOVOS akmods com a chave atual (' +
                           '<code>/etc/pki/akmods/certs/public_key.der</code>), que ainda não foi registrada. ' +
                           'Se você instalar qualquer <code>akmod-*</code> novo pelo FAP, ele <strong>não vai carregar no boot</strong>. ' +
                           'Registre a chave atual seguindo os passos abaixo antes de instalar qualquer akmod.' +
                           '<br><br>' +
                           'ℹ️ <strong>Não precisa rodar "Preparar Secure Boot" de novo</strong> — a chave já existe. ' +
                           'Pule direto para o passo 2.') +
                        '</div>';
    } else if (_secureBootOutrasChavesAkmos() && !mokEnrolled) {
        notaHtml =
        '<div class="aviso-caixa" style="border-color: #f59e0b; color: #f59e0b; margin-bottom: 1rem; font-size: 0.85rem;">' +
        _t('seguranca.secureboot_other_keys_nota',
           'ℹ️ <strong>Chave akmods de outra fonte já está registrada no firmware.</strong> ' +
           'Os módulos assinados por ela continuam funcionando. ' +
           'Mas o FAP assina os próprios akmods com a chave local (<code>/etc/pki/akmods/certs/public_key.der</code>), ' +
           'que precisa ser registrada separadamente para que os akmods do FAP carreguem no boot. ' +
           'Siga os passos abaixo para registrar a chave do FAP — o firmware aceita múltiplas chaves sem conflito.') +
        '</div>';
    }

    var html = notaHtml;

    var mokIndeterminado = chaveLocal &&
    _secureBootMokCache &&
    _secureBootMokCache.enrolled === null;
    if (mokIndeterminado) {
        html += '<div class="aviso-caixa" style="border-color: #f59e0b; color: #f59e0b; margin-bottom: 1rem;">';
        html += '<strong>⚠️ Não foi possível verificar se a chave do akmods está registrada no firmware.</strong><br>';
        html += '<span style="font-size: 0.85rem;">O arquivo <code>/etc/pki/akmods/certs/public_key.der</code> existe, mas o <code>mokutil --test-key</code> não retornou um resultado conclusivo. ';
        html += 'Isso pode acontecer por uma falha transitória (D-Bus, efivars). ';
        html += 'Se você já fez o registro, pode ignorar este aviso. ';
        html += 'Caso contrário, siga os passos abaixo.</span>';
        if (_secureBootMokCache.erro) {
            html += '<div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">Detalhe: <code>' +
            _escapeHTML(_secureBootMokCache.erro) + '</code></div>';
        }
        html += '<div class="botoes-flex" style="margin-top: 0.75rem;">';
        html += '<button class="btn-executar" onclick="(typeof _refreshEstadoSessao === \'function\') && _refreshEstadoSessao()">🔄 Verificar novamente</button>';
        html += '</div>';
        html += '</div>';
    }

    html += '<div class="aviso-caixa" style="border-color: #f59e0b; color: #f59e0b;">';
    html += '<strong>🔐 ' + _t('seguranca.secureboot_titulo',
                               'Secure Boot está ativo') + '</strong><br>';
                               html += _t('seguranca.secureboot_desc',
                                          'Vários pacotes do FAP compilam módulos de kernel localmente pelo <code>akmods</code> (driver NVIDIA, VirtualBox, Broadcom, Realtek, xpadneo, câmera virtual do OBS). Todos são assinados com a MESMA chave, gerada por <code>kmodgenca</code>. Essa chave precisa ser registrada no firmware ANTES de instalar qualquer um deles — sem isso, o módulo não carrega no boot. O processo abaixo NÃO desativa o Secure Boot; apenas registra a chave.');
                               html += '</div>';

                               if (!chaveLocal) {
                                   html += '<div class="bloco-info" style="border-left-color: #f59e0b;">';
                                   html += '<strong>' + _t('seguranca.secureboot_passo1',
                                                           'Passo 1 — preparar a chave') + '</strong>';
                                                           html += '<p style="margin: 0.4rem 0 0.75rem 0; font-size: 0.85rem; color: var(--text-muted);">' +
                                                           _t('seguranca.secureboot_passo1_desc',
                                                              'Instala as ferramentas do <code>akmods</code> e gera a chave local em <code>/etc/pki/akmods/certs/</code>. Não altera o firmware ainda — o registro vem no passo 2.') + '</p>';
                                                              html += '<div class="botoes-flex">';

                                                              html += '<button class="btn-executar" onclick="executarPrepararSecureBoot()" ' +
                                                              'data-comando="nvidia-secureboot-prepare" ' +
                                                              'data-logbox="log-sessao-estado-fedora" ' +
                                                              'id="btn-nvidia-secureboot-prepare">';
                                                              html += '🔐 ' + _t('seguranca.secureboot_preparar_btn',
                                                                                 'Preparar Secure Boot');
                                                              html += '</button></div></div>';
                               } else {
                                   html += '<div class="aviso-sucesso" style="border-color: #34d399; color: #34d399;">✅ ' +
                                   _t('seguranca.secureboot_chave_ok',
                                      'A chave do akmods já foi gerada. Falta o registro no firmware (passo 2).') +
                                   '</div>';
                               }

                               html += '<div class="bloco-info" style="border-left-color: #60a5fa;">';
                               html += '<strong>' + _t('seguranca.secureboot_passo2',
                                                       'Passo 2 — importar a chave para o firmware') + '</strong>';
                                                       html += '<p style="margin: 0.4rem 0 0.5rem 0; font-size: 0.85rem; color: var(--text-muted);">' +
                                                       _t('seguranca.secureboot_passo2_desc',
                                                          'Abra o terminal e rode o comando abaixo. Ele vai pedir uma senha (use algo simples, ex.: 0000) — essa senha será digitada novamente na tela azul do MOK no próximo boot. O FAP não automatiza este passo porque o mokutil exige um terminal interativo.') + '</p>';
                                                          html += '<code class="fap-popover-code" style="display: block; margin: 0.5rem 0;">' +
                                                          'sudo mokutil --import /etc/pki/akmods/certs/public_key.der</code>';
                                                          html += '</div>';

                                                          html += '<div class="bloco-info" style="border-left-color: #a855f7;">';
                                                          html += '<strong>' + _t('seguranca.secureboot_passo3',
                                                                                  'Passo 3 — reiniciar e fazer o registro') + '</strong>';
                                                                                  html += '<p style="margin: 0.4rem 0 0 0; font-size: 0.85rem; color: var(--text-muted);">' +
                                                                                  _t('seguranca.secureboot_passo3_desc',
                                                                                     'Reinicie o computador. Na tela azul do MOK Management, escolha "Enroll MOK" → "Continue" → "Yes", digite a senha que você definiu no passo 2 e finalize. ATENÇÃO: o teclado do MOK é sempre QWERTY, mesmo que o seu layout seja ABNT2. Depois disso, você pode instalar qualquer <code>akmod-*</code> normalmente.') +
                                                                                  '</p></div>';

                                                                                  container.innerHTML = html;
}

function _renderizarBadgeSecureBoot(container, estado, contexto) {
    if (!container) return;

    if (estado === 'disabled' || estado === 'unknown' || estado === 'not_efi') {
        container.innerHTML = '';
        return;
    }

    var chaveLocal = false;
    if (_secureBootMokCache && typeof _secureBootMokCache.chave_gerada === 'boolean') {
        chaveLocal = _secureBootMokCache.chave_gerada;
    } else {
        try { chaveLocal = SystemState.arquivoPresente('/etc/pki/akmods/certs/public_key.der'); } catch (e) {}
    }
    var mokEnrolled = _mokEnrolled();

    if (mokEnrolled && chaveLocal && !_secureBootCurrentKeyNotEnrolled()) {
        container.innerHTML = '';
        return;
    }

    if (chaveLocal && _secureBootPendingImport()) {
        var chaveAntigaEnrolledBadge = mokEnrolled && _secureBootCurrentKeyNotEnrolled();
        if (chaveAntigaEnrolledBadge) {
            container.innerHTML =
            '<div class="aviso-caixa" style="margin: 0 0 1rem 0; font-size: 0.85rem; border-color: #f59e0b; color: #f59e0b;">' +
            _t('seguranca.secureboot_badge_pending_import_combined',
               '⏳ Chave <strong>antiga</strong> do akmods está registrada no firmware. A chave <strong>atual</strong> foi importada ' +
               'e aguarda <strong>reinicialização</strong> + MOK Management para ser efetivada. ' +
               'Enquanto isso, novos akmods do FAP não carregarão no boot.') +
            '</div>';
            return;
        }

        container.innerHTML =
        '<div class="aviso-caixa" style="margin: 0 0 1rem 0; font-size: 0.85rem; border-color: #f59e0b; color: #f59e0b;">' +
        _t('seguranca.secureboot_badge_pending_import',
           '⏳ Chave do akmods importada. <strong>Reinicie</strong> o computador e complete o MOK Management ' +
           '(tela azul) para efetivar o registro.') +
        '</div>';
        return;
    }

    var mokIndeterminadoBadge = chaveLocal &&
    _secureBootMokCache &&
    _secureBootMokCache.enrolled === null;
    if (mokIndeterminadoBadge) {
        var nomeSessaoSbIndet = _t('sessoes.estado-fedora.nome', 'Estado do Fedora');
        container.innerHTML =
        '<div class="aviso-caixa" style="margin: 0 0 1rem 0; font-size: 0.85rem; border-color: #f59e0b; color: #f59e0b;">' +
        '⚠️ <strong>Não foi possível verificar se a chave do akmods está registrada no firmware.</strong> ' +
        'O <code>mokutil --test-key</code> falhou. Se você já fez o registro, pode ignorar. ' +
        'Caso contrário, verifique manualmente em <strong>' +
        _escapeHTML(nomeSessaoSbIndet) + '</strong> → <strong>Secure Boot</strong>.' +
        '</div>';
        return;
    }

    if (mokEnrolled && _secureBootCurrentKeyNotEnrolled()) {
        var nomeSessaoSbOldKey = _t('sessoes.estado-fedora.nome', 'Estado do Fedora');
        container.innerHTML =
        '<div class="aviso-caixa" style="margin: 0 0 1rem 0; font-size: 0.85rem; border-color: #f59e0b; color: #f59e0b;">' +
        _tVars('seguranca.secureboot_badge_old_key',
               '⚠️ Chave antiga do akmods está registrada no firmware, mas a atual do FAP não. ' +
               'Antes de instalar akmods novos, registre a chave atual em <strong>{sessao}</strong> → <strong>Secure Boot</strong>.',
               { sessao: nomeSessaoSbOldKey }) +
        '</div>';
        return;
    }

    if (_secureBootOutrasChavesAkmos() && !mokEnrolled) {
        var nomeSessaoSbOutras = _t('sessoes.estado-fedora.nome', 'Estado do Fedora');
        container.innerHTML =
        '<div class="aviso-caixa" style="margin: 0 0 1rem 0; font-size: 0.85rem; border-color: #f59e0b; color: #f59e0b;">' +
        _tVars('seguranca.secureboot_badge_other_keys',
               'ℹ️ Chave akmods de outra fonte já está registrada no firmware. ' +
               'Os módulos assinados por ela continuam funcionando. ' +
               'Mas o FAP assina os próprios akmods com a chave local, que precisa ser registrada em ' +
               '<strong>{sessao}</strong> → <strong>Secure Boot</strong> para que os akmods do FAP carreguem no boot.',
               { sessao: nomeSessaoSbOutras }) +
        '</div>';
        return;
    }

    var akmodFora = _akmodCarregadoFora();
    if (akmodFora) {
        var modNomeFora = akmodFora.modulo;
        var nomeSessaoSbFora = _t('sessoes.estado-fedora.nome', 'Estado do Fedora');
        container.innerHTML =
        '<div class="aviso-caixa" style="margin: 0 0 1rem 0; font-size: 0.85rem; border-color: #f59e0b; color: #f59e0b;">' +
        '⚠️ ' + _tVars('seguranca.secureboot_badge_akmod_carregado',
                       'O módulo <code>{modulo}</code> está funcionando, mas a chave local do FAP não está registrada. Se for instalar outros akmods pelo FAP, complete o registro em <strong>{sessao}</strong> → <strong>Secure Boot</strong>.',
                       { modulo: modNomeFora, sessao: nomeSessaoSbFora }) +
        '</div>';
        return;
    }

    var nomeSessaoSb = _t('sessoes.estado-fedora.nome', 'Estado do Fedora');

    var ctxTraduzido = _secureBootCtxTraduzido(contexto);

    if (chaveLocal) {

        container.innerHTML =
        '<div class="aviso-sucesso" style="margin: 0 0 1rem 0; font-size: 0.85rem;">✅ ' +
        _tVars('seguranca.secureboot_badge_ok',
               'Secure Boot ativo — chave do akmods já preparada. Se ainda não fez o registro, complete em <strong>{sessao}</strong>.',
               { sessao: nomeSessaoSb }) +
        ' <a href="?session=estado-fedora" style="color: inherit; font-weight: bold; text-decoration: underline;">→</a>' +
        '</div>';
        return;
    }

    container.innerHTML =
    '<div class="aviso-caixa" style="margin: 0 0 1rem 0; font-size: 0.85rem; border-color: #ef4444; color: #ef4444;">' +
    '<strong>🔐 ' + _t('seguranca.secureboot_badge_titulo',
                       'Secure Boot ativo — registro necessário') + '</strong><br>' +
                       _tVars('seguranca.secureboot_badge_desc',
                              'Antes de instalar {ctx}, prepare a chave do akmods e faça o registro no firmware. Sem isso, o módulo não carrega no próximo boot. O passo a passo completo está em <strong>{sessao}</strong> → <strong>Secure Boot</strong>.',
                              { ctx: ctxTraduzido, sessao: nomeSessaoSb }) +
                       '</div>';
}

document.addEventListener('i18n-pronto', function() {
    _secureBootCache = null;
    _secureBootCtxI18nCache = null;
});

var _MAPA_HARDWARE_DEPENDENTE = {
    'vulkan-amd':               ['1002', '1022'],
    'vaapi-amd':                ['1002', '1022'],
    'amdgpu-overclock':         ['1002', '1022'],
    'amdgpu-overclock-remove':  ['1002', '1022'],
    'corectrl-install':         ['1002', '1022'],
    'lact-install':             ['1002', '1022'],
    'nvidia-driver-install':    ['10de'],
    'nvidia-driver-remove':     ['10de'],

    'nvidia-vaapi-install':     ['10de'],
    'nvidia-vaapi-utils':       ['10de'],
    'nvidia-vaapi-env':         ['10de'],
    'nvidia-vaapi-env-remove':  ['10de'],
    'intel-media-install':      ['8086'],
    'libva-intel-install':      ['8086'],
    'intel-vaapi-utils':        ['8086']
};

function _comandoRelevante(idComando) {
    var vendors = _MAPA_HARDWARE_DEPENDENTE[idComando];
    if (!vendors) return true;

    var bruto = SystemState.bruto();
    if (!bruto || !Array.isArray(bruto.hardware_vendors)) {
        return true;
    }
    if (bruto.hardware_vendors.length === 0) {
        return true;
    }
    for (var i = 0; i < vendors.length; i++) {
        if (bruto.hardware_vendors.indexOf(vendors[i]) !== -1) {
            return true;
        }
    }
    return false;
}

function _comandosRelevantes(idSessao) {
    var todos = SESSAO_COMANDOS[idSessao] || [];
    return todos.filter(_comandoRelevante);
}

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

function _bloquearSessao(idComando) {
    var btn = document.getElementById('btn-' + idComando);
    if (!btn) return;
    var sessaoContainer = btn.closest('.sessao-container');
    if (!sessaoContainer) return;

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

var _comandoDnfRodando = null;

function _deveBloquearDuranteDnf(idComando) {
    if (idComando === _comandoDnfRodando) return false;
    var info = _infoComando(idComando);
    if (!info) return false;
    if (info.flatpakId) return false;
    if (info.sempreClicavel) return false;
    return true;
}

function _bloquearOutrasSessoes(idComandoDnf) {
    _comandoDnfRodando = idComandoDnf;

    var botoes = document.querySelectorAll('.btn-executar[data-comando]');
    botoes.forEach(function(b) {
        var id = b.getAttribute('data-comando');
        if (!id) return;
        if (!_deveBloquearDuranteDnf(id)) return;
        if (b.hasAttribute('data-cross-sessao-bloqueado')) return;
        if (b.hasAttribute('data-sessao-bloqueado')) return;
        b.setAttribute('data-was-disabled-cross', b.disabled ? '1' : '0');
        b.setAttribute('data-cross-sessao-bloqueado', '1');
        b.disabled = true;
        b.style.opacity = '0.4';
        b.style.pointerEvents = 'none';
    });
}

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

function _reaplicarBloqueioSeNecessario() {
    if (!_comandoDnfRodando) return;

    var botoes = document.querySelectorAll('.btn-executar[data-comando]');
    botoes.forEach(function(b) {
        var id = b.getAttribute('data-comando');
        if (!id) return;
        if (!_deveBloquearDuranteDnf(id)) return;
        if (b.hasAttribute('data-cross-sessao-bloqueado')) return;
        if (b.hasAttribute('data-sessao-bloqueado')) return;
        b.setAttribute('data-was-disabled-cross', b.disabled ? '1' : '0');
        b.setAttribute('data-cross-sessao-bloqueado', '1');
        b.disabled = true;
        b.style.opacity = '0.4';
        b.style.pointerEvents = 'none';
    });
}

var _navegacaoBloqueada = false;

function _deveBloquearNavegacao() {
    var sessaoAtual = _sessaoAtualId();
    if (!sessaoAtual) return false;

    if (_comandoDnfRodando) {
        var sessaoDnf = _sessaoDoComando(_comandoDnfRodando);
        if (sessaoDnf === sessaoAtual) return true;
    }

    if (typeof _flatpakRodando !== 'undefined' && _flatpakRodando) {
        var sessaoFp = _sessaoDoComando(_flatpakRodando);
        if (sessaoFp === sessaoAtual) return true;
    }

    if (typeof _filaFlatpaks !== 'undefined' && _filaFlatpaks.length > 0) {
        for (var i = 0; i < _filaFlatpaks.length; i++) {
            var sessaoItem = _sessaoDoComando(_filaFlatpaks[i].idComando);
            if (sessaoItem === sessaoAtual) return true;
        }
    }

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

function _atualizarBloqueioNavegacao() {
    var deveBloquear = _deveBloquearNavegacao();

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
            var sessaoId = item.dataset.sessao;
            if (sessaoId && typeof nomeDaSessao === 'function') {
                item.setAttribute('title', nomeDaSessao(sessaoId));
            }
        }
    });

    if (btnAnterior && deveBloquear) btnAnterior.disabled = true;
    if (btnProximo && deveBloquear) btnProximo.disabled = true;

    if (!deveBloquear) {
        if (typeof SESSOES_PRINCIPAIS !== 'undefined' && typeof sessaoAtual !== 'undefined') {
            var total = SESSOES_PRINCIPAIS.length;
            if (btnAnterior) btnAnterior.disabled = (sessaoAtual === 0);
            if (btnProximo) btnProximo.disabled = (sessaoAtual === total - 1);
        }
    }
}

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
            } catch (e) {  }

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
    } catch (e) {  }

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

var _ultimaLimpezaOrfaos = 0;
var _limpezaOrfaosRodando = false;

async function _limparIdsOrfaos() {
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
            return;
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

function getStatusSessao(sessaoId) {

    var sessaoObj = SESSOES.find(function(s) { return s.id === sessaoId; });
    if (sessaoObj && sessaoObj.informativa) {
        return 'pendente';
    }

    const comandos = _comandosRelevantes(sessaoId);
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

async function desmarcarComoExecutado(idComando) {
    const progress = await getProgress();
    progress.executados = progress.executados.filter(id => id !== idComando);
    await saveProgress(progress);
    _invalidarContadorSessoes();
    _atualizarProgressoGlobal();
}

const FLATPAK_VERIFY_TTL_MS = 30000;
let _ultimaVerificacaoFlatpak = 0;

async function _sincronizarEstadoFlatpaks() {
    var agora = Date.now();
    if (agora - _ultimaVerificacaoFlatpak < FLATPAK_VERIFY_TTL_MS) {
        return;
    }
    _ultimaVerificacaoFlatpak = agora;

    try {
        await SystemState.carregar();

        var bruto = (typeof SystemState.bruto === 'function')
        ? SystemState.bruto()
        : null;
        if (!bruto || !Array.isArray(bruto.flatpaks_installed)) {
            console.log('[Flatpak] sync pulado: SystemState indisponível');
            return;
        }
        if (typeof bruto.error === 'string' && bruto.error.length > 0) {
            console.log('[Flatpak] sync pulado: /system-state retornou erro:', bruto.error);
            return;
        }

        var idadeCache = (typeof SystemState.cacheIdade === 'function')
        ? SystemState.cacheIdade()
        : 0;

        if (idadeCache < 10 * 1000) {
            console.log('[Flatpak] sync pulado: cache recente (' +
            Math.round(idadeCache / 1000) + 's < 10s)');
            return;
        }

        var progress = await getProgress();
        var executados = progress.executados || [];

        var marcados = [];
        var removidos = [];

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

        for (var k = 0; k < marcados.length; k++) {
            try {

                aplicarEstadoInstalavel(marcados[k], null);
            } catch (e) {  }
        }

        for (var l = 0; l < removidos.length; l++) {
            var item = removidos[l];
            console.log('[Flatpak] Removido externamente:', item.id, '→', item.appId);
            await desmarcarComoExecutado(item.id);
            try {
                aplicarEstadoInstalavel(item.id, null);
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

function verificarFlatpaksRemovidos() {
    return _sincronizarEstadoFlatpaks();
}

function marcarFlatpaksJaInstalados() {
    return _sincronizarEstadoFlatpaks();
}

var progressIntervals = {};
var progressTimeouts = {};
var _inicioExecucao = {};

function iniciarProgresso(idComando) {
    const container = document.getElementById('progress-' + idComando);
    if (!container) return;
    container.style.display = 'block';
    container.classList.remove('concluido');

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
        if (_comandoDnfRodando === idComando) {
            _liberarOutrasSessoes();
        }

        _atualizarBloqueioNavegacao();
    };

    if (sucesso && !SEMPRE_CLICAVEIS.includes(idComando)) {
        marcarComoExecutado(idComando).then(aplicarUI, aplicarUI);
    } else {
        aplicarUI();
    }
}

function getTextoAposExecucao(idComando) {
    const info = _infoComando(idComando);
    if (!info) return _t('comum.btn_concluido', '✅ Concluído');
    if (info.textoConcluidoKey) {
        return _t(info.textoConcluidoKey, info.textoConcluido || '✅ Concluído');
    }
    return info.textoConcluido || _t('comum.btn_concluido', '✅ Concluído');
}

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

function aplicarEstadoToggle(idInstall, idRevert, esconderRevertSeNaoFeito, preExistente) {
    var installBtn = document.getElementById('btn-' + idInstall);
    var revertBtn = document.getElementById('btn-' + idRevert);
    if (!installBtn || !revertBtn) return;

    var installFeito = isExecutado(idInstall);

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

    var infoCmdIgnorar = APPS_REMOVIVEIS[idInstall];
    if (preExistente === true && infoCmdIgnorar &&
        infoCmdIgnorar.ignorarPreExistente === true) {
        preExistente = false;
        }

        var textoOriginalInstall = _textoOriginalTraduzido(installBtn) || installBtn.textContent;
    var textoOriginalRevert = _textoOriginalTraduzido(revertBtn) || revertBtn.textContent;
    var corOriginalInstall = _corOriginalDoBotao(installBtn);

    var efetivamenteFeito = installFeito || preExistente;

    installBtn.title = '';

    var infoCmdBloq = APPS_REMOVIVEIS[idInstall];
    if (preExistente && !installFeito && infoCmdBloq &&
        infoCmdBloq.permitirRemocaoPreExistente === false) {
        installBtn.textContent = _t('comum.ja_estava_ativo', '✅ Já estava ativo');
    installBtn.title = _traduzirMotivoBloqueio(idInstall, infoCmdBloq);
    installBtn.style.backgroundColor = '#4b5563';
    installBtn.style.cursor = 'not-allowed';
    installBtn.disabled = true;
    installBtn.style.opacity = '0.7';

    revertBtn.textContent = _textoOriginalTraduzido(revertBtn) || revertBtn.textContent;
    revertBtn.style.backgroundColor = '';
    revertBtn.style.cursor = 'not-allowed';
    revertBtn.disabled = true;
    revertBtn.style.opacity = '0.5';
    revertBtn.title = _traduzirMotivoBloqueio(idInstall, infoCmdBloq);
    if (esconderRevertSeNaoFeito) {
        revertBtn.style.display = 'none';
    } else {
        revertBtn.style.display = '';
    }
    return;
        }

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

function restaurarBotaoAposExecucao(idComando, sucesso) {
    const botoes = obterBotoesPorId(idComando);
    const btnExecutar = botoes.btnExecutar;
    const btnReverter = botoes.btnReverter;

    if (!btnExecutar) return;

    const corOriginal = _corOriginalDoBotao(btnExecutar);

    if (SEMPRE_CLICAVEIS.includes(idComando)) {
        btnExecutar.textContent = _textoOriginalTraduzido(btnExecutar);
        btnExecutar.style.backgroundColor = corOriginal || 'var(--accent, #3a3a3a)';
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
    } else {
        btnExecutar.textContent = _textoOriginalTraduzido(btnExecutar);
        btnExecutar.style.backgroundColor = corOriginal || 'var(--accent, #3a3a3a)';
        btnExecutar.style.cursor = 'pointer';
        btnExecutar.disabled = false;
        btnExecutar.style.opacity = '1';
    }
}

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

    toggle.innerHTML = '<span class="toggle-arrow">▲</span><span class="toggle-text">' + toggleTexto + '</span>';
    toggle.addEventListener('click', function() {
        toggleTerminalLog(logBox.id);
        var expandido = toggle.classList.contains('expandido');
        try { localStorage.setItem('fap_log_expandido', expandido ? '1' : '0'); } catch (e) {}
    });

    logBox.parentNode.insertBefore(wrapper, logBox);
    wrapper.appendChild(toggle);
    wrapper.appendChild(logBox);

    logBox.style.display = 'block';

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

function _atualizarProgressoPacotes(idComando, atual, total) {
    if (!total || total <= 0) return;

    var fill = document.getElementById('progress-fill-' + idComando);
    var percent = document.getElementById('progress-percent-' + idComando);
    var status = document.getElementById('progress-status-' + idComando);

    if (!fill || !percent || !status) return;

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
        errorLine.textContent = _tVars('comum.erro_sse', '❌ Erro ao conectar SSE: {msg}', { msg: e.message });
        logBox.appendChild(errorLine);
        logBox.scrollTop = logBox.scrollHeight;
    }
}

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

var _filaFlatpaks = [];
var _flatpakRodando = null;

function _flatpakNaFila(idComando) {
    if (_flatpakRodando === idComando) return true;
    for (var i = 0; i < _filaFlatpaks.length; i++) {
        if (_filaFlatpaks[i].idComando === idComando) return true;
    }
    return false;
}

function _marcarBotaoNaFila(idComando, posicao) {
    var btn = document.getElementById('btn-' + idComando);
    if (!btn) return;

    if (!btn.hasAttribute('data-texto-original')) {
        btn.setAttribute('data-texto-original', btn.textContent);
    }

    btn.textContent = '⏳ Na fila (' + posicao + 'º)';
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
}

function _reajustarPosicoesDaFila() {
    for (var i = 0; i < _filaFlatpaks.length; i++) {
        _marcarBotaoNaFila(_filaFlatpaks[i].idComando, i + 1);
    }
}

async function _enfileirarFlatpak(idComando, comando, nomeAcao, onSucesso) {
    if (_flatpakNaFila(idComando)) {
        return;
    }

    if (_flatpakRodando === null) {
        _flatpakRodando = idComando;
        _atualizarBloqueioNavegacao();
        await _dispararFlatpak(idComando, comando, nomeAcao, onSucesso);
        return;
    }

    _filaFlatpaks.push({
        idComando: idComando,
        comando: comando,
        nomeAcao: nomeAcao,
        onSucesso: onSucesso
    });
    _marcarBotaoNaFila(idComando, _filaFlatpaks.length);

    _atualizarBloqueioNavegacao();
}

async function _dispararFlatpak(idComando, comando, nomeAcao, onSucesso) {
    await _executarComandoGenericoOriginal(idComando, comando, nomeAcao, null, true);

    var sucesso = await aguardarConclusaoReal(idComando, 1800000);

    if (sucesso && typeof onSucesso === 'function') {

        if (typeof SystemState !== 'undefined' && typeof SystemState.invalidar === 'function') {
            try { SystemState.invalidar(); } catch (e) {  }
        }
        if (typeof SystemState !== 'undefined' && typeof SystemState.carregar === 'function') {
            try {
                await SystemState.carregar(true);
            } catch (e) {
                console.warn('[flatpak-fila] Falha ao recarregar SystemState:', e);
            }
        }

        if (typeof SystemState !== 'undefined' && typeof SystemState.flatpakInstalado === 'function') {
            var info = (typeof APPS_REMOVIVEIS !== 'undefined') ? APPS_REMOVIVEIS[idComando] : null;
            if (info && info.tipo === 'flatpak' && info.appId) {
                for (var i = 0; i < 3; i++) {
                    if (SystemState.flatpakInstalado(info.appId)) break;
                    console.log('[flatpak] ' + info.appId + ' ainda não visível no cache, retry ' + (i + 1) + '/3');
                    await new Promise(function(r) { setTimeout(r, 500); });
                    SystemState.invalidar();
                    try {
                        await SystemState.carregar(true);
                    } catch (e) {  }
                }
            }
        }

        try {
            onSucesso(idComando);
        } catch (e) {
            console.warn('[flatpak-fila] Erro no onSucesso de ' + idComando + ':', e);
        }
    }

    _flatpakRodando = null;

    if (_filaFlatpaks.length > 0) {
        var proximo = _filaFlatpaks.shift();
        _reajustarPosicoesDaFila();
        _flatpakRodando = proximo.idComando;
        _atualizarBloqueioNavegacao();
        _dispararFlatpak(proximo.idComando, proximo.comando, proximo.nomeAcao, proximo.onSucesso);
    } else {
        _atualizarBloqueioNavegacao();
    }
}

async function executarComandoGenerico(idComando, comando, nomeAcao, onSucesso, ehFlatpak, timeoutMs) {
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

    if (!ehFlatpak) {
        _bloquearSessao(idComando);
        _bloquearOutrasSessoes(idComando);
    }

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
            aguardarConclusaoEEntao(idComando, onSucesso, timeoutMs);
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

var _executarComandoGenericoOriginal = executarComandoGenerico;
executarComandoGenerico = async function(idComando, comando, nomeAcao, onSucesso, ehFlatpak, timeoutMs) {
    var isFlatpak = ehFlatpak || /^\s*flatpak\s+install\b/.test(comando);
    if (isFlatpak) {
        return await _enfileirarFlatpak(idComando, comando, nomeAcao, onSucesso);
    }

    return await _executarComandoGenericoOriginal(idComando, comando, nomeAcao, onSucesso, ehFlatpak, timeoutMs);
};

function _shellQuote(s) {
    if (s === '') return "''";
    if (/^[a-zA-Z0-9_./:@%+=,-]+$/.test(s)) return s;
    return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

function _quotarUrlsNaoQuotadas(comando) {
    var resultado = '';
    var dentroAspasSimples = false;
    var dentroAspasDuplas = false;
    var i = 0;
    var n = comando.length;
    while (i < n) {
        var c = comando[i];
        if (c === "'" && !dentroAspasDuplas) {
            dentroAspasSimples = !dentroAspasSimples;
            resultado += c;
            i++;
            continue;
        }
        if (c === '"' && !dentroAspasSimples) {
            dentroAspasDuplas = !dentroAspasDuplas;
            resultado += c;
            i++;
            continue;
        }
        if (!dentroAspasSimples && !dentroAspasDuplas &&
            (comando.startsWith('http://', i) || comando.startsWith('https://', i))) {
            var j = i;
        while (j < n && !/[\s'">]/.test(comando[j])) {
            j++;
        }
        var url = comando.substring(i, j);
        resultado += _shellQuote(url);
        i = j;
        continue;
            }
            resultado += c;
            i++;
    }
    return resultado;
}

function abrirFerramentaExterna(comando, idLog, nomeExibicao) {
    var cmdFinal = (comando || '').trim();

    cmdFinal = _quotarUrlsNaoQuotadas(cmdFinal);

    cmdFinal = cmdFinal.replace(/\s*&\s*$/, '').trim();

    if (!/^setsid\s/.test(cmdFinal)) {
        cmdFinal = 'setsid -f ' + cmdFinal;
    }

    if (cmdFinal.indexOf('> /dev/null') === -1 && cmdFinal.indexOf('> /tmp/') === -1) {
        var logFile = '/tmp/fap-open-' + (idLog || 'app') + '.log';
        cmdFinal += ' > ' + logFile + ' 2>&1 < /dev/null';
    }

    var logBox = _getLogBox(idLog);
    var linhaStatus = null;
    if (logBox) {
        logBox.style.display = 'block';
        _separadorLog(logBox, '🚀 ' + _tVars('comum.abrir_separador', 'Abrir {nome}', { nome: nomeExibicao }));
        linhaStatus = document.createElement('div');
        linhaStatus.className = 'log-line info';
        linhaStatus.textContent = _tVars('comum.abrir_abrindo', '⏳ Abrindo {nome}...', { nome: nomeExibicao });
        logBox.appendChild(linhaStatus);
        logBox.scrollTop = logBox.scrollHeight;
    }

    var idOpen = 'open-' + (idLog || 'app') + '-' + Date.now() + '-' + Math.floor(Math.random() * 10000);

    var es = null;
    var finalizado = false;

    function _finalizar(status) {
        if (finalizado) return;
        finalizado = true;
        if (es) { try { es.close(); } catch (e) {} es = null; }
        if (!linhaStatus) return;
        if (status === 'ok') {
            linhaStatus.className = 'log-line success';
            linhaStatus.textContent = _tVars('comum.abrir_aberto', '🚀 {nome} aberto!', { nome: nomeExibicao });
        } else if (status === 'err') {
            linhaStatus.className = 'log-line error';
            linhaStatus.textContent = _tVars('comum.abrir_falhou',
                                             '⚠️ Não foi possível abrir {nome}. Veja /tmp/fap-open-{id}.log',
                                             { nome: nomeExibicao, id: idLog || 'app' });
        } else {

            linhaStatus.className = 'log-line info';
            linhaStatus.textContent = _tVars('comum.abrir_timeout',
                                             '⏳ {nome} ainda abrindo (veja /tmp/fap-open-{id}.log)',
                                             { nome: nomeExibicao, id: idLog || 'app' });
        }
    }

    try {
        es = new EventSource(API_URL + '/stream?id=' + encodeURIComponent(idOpen));
        es.onmessage = function(event) {
            try {
                var dados = JSON.parse(event.data);
                if (dados.tipo === 'end') {
                    _finalizar(dados.sucesso === true ? 'ok' : 'err');
                }
            } catch (e) {  }
        };
        es.onerror = function() { _finalizar('timeout'); };
        setTimeout(function() { _finalizar('timeout'); }, 3000);
    } catch (e) {
        setTimeout(function() { _finalizar('timeout'); }, 3000);
    }

    fetch(API_URL + '/executar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando: cmdFinal, idComando: idOpen })
    }).catch(function(e) {
        console.warn('[abrir] Falha ao enviar comando de abertura:', e.message);
        _finalizar('err');
    });
}

var APPS_REMOVIVEIS = {};
var FAP_SVG_LIXEIRA = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

function registrarAppRemovivel(idComando, config) {
    APPS_REMOVIVEIS[idComando] = config;
}

function _idRemocaoDe(idComando) {
    return idComando + '-remove';
}

var _MAPA_MOTIVO_BLOQUEIO = {
    'codecs-essenciais':        'mitigacao.codecs_essenciais',
    'extras-tainted':           'mitigacao.extras_tainted',
    'fontes-ms-all':            'mitigacao.fontes_ms_all',
    'vulkan-amd':               'mitigacao.vulkan_amd',
    'vaapi-amd':                'mitigacao.vaapi_amd',
    'nvidia-driver-install':    'mitigacao.nvidia_driver_install',
    'intel-media-install':      'mitigacao.intel_media_install',
    'libva-intel-install':      'mitigacao.libva_intel',
    'cups-install':             'mitigacao.cups_install',
    'samba-install':            'mitigacao.samba_install',
    'qemu-kvm-install':         'mitigacao.qemu_kvm_install',
    'virtualbox-install':       'mitigacao.virtualbox_install',
    'gnome-boxes-install':      'mitigacao.gnome_boxes_install'
};

function _traduzirMotivoBloqueio(idInstall, info) {
    var fallback = (info && info.motivoBloqueio) ||
    'Este recurso já estava ativo antes do FAP. O FAP não foi a causa — para desfazer, use o terminal.';
    var chave = _MAPA_MOTIVO_BLOQUEIO[idInstall];
    return chave ? _t(chave, fallback) : fallback;
}

function _garantirWrapperFlatpak(btnInstall) {
    if (!btnInstall) return null;

    var wrapper = btnInstall.closest('.btn-flatpak-wrapper');
    if (wrapper) return wrapper;

    var parent = btnInstall.parentElement;
    if (!parent) return null;

    wrapper = document.createElement('div');
    wrapper.className = 'btn-flatpak-wrapper';
    parent.insertBefore(wrapper, btnInstall);
    wrapper.appendChild(btnInstall);
    return wrapper;
}

function aplicarEstadoInstalavel(idInstall, idAbrir, idRemover, preExistente) {
    var btnInstall = document.getElementById('btn-' + idInstall);
    if (!btnInstall) return;

    btnInstall.title = '';
    btnInstall.removeAttribute('data-title-origem');
    _renderizarBadgeOrigem(idInstall);

    var dadosAbrir = _dadosAbrirDoApp(idInstall);
    var btnAbrir = (!dadosAbrir && idAbrir) ? document.getElementById('btn-' + idAbrir) : null;

    var instalado = isExecutado(idInstall);
    var idRem = idRemover || _idRemocaoDe(idInstall);

    if (instalado && !_estaRealmenteInstalado(idInstall)) {
        console.log('[estado] auto-reset:', idInstall, '(removido por fora)');
        desmarcarComoExecutado(idInstall).catch(function(e) {
            console.warn('[estado] erro no auto-reset de', idInstall, ':', e);
        });
        instalado = false;
    }

    if (preExistente === undefined) {
        try {
            preExistente = appJaInstaladoNoSistema(idInstall);
        } catch (e) {
            preExistente = false;
        }
    }

    var corOriginal = _corOriginalDoBotao(btnInstall);

    var textoOriginalInstall = _textoOriginalTraduzido(btnInstall) || btnInstall.textContent;

    var tratadoComoInstalado = instalado || preExistente;

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

        var textoAbrir = null;
        var onclickAbrir = null;

        if (dadosAbrir) {
            textoAbrir = _t(dadosAbrir.textoKey, dadosAbrir.textoFallback);
            onclickAbrir = dadosAbrir.onclick;
        } else if (btnAbrir) {
            textoAbrir = _textoOriginalTraduzido(btnAbrir);
            onclickAbrir = btnAbrir.getAttribute('onclick') || '';
        }

        if (textoAbrir !== null) {
            btnInstall.textContent = textoAbrir;
            btnInstall.style.backgroundColor = '#10b981';
            btnInstall.style.cursor = 'pointer';
            btnInstall.disabled = false;
            btnInstall.style.opacity = '1';

            var onclickInstall = btnInstall.getAttribute('data-onclick-install');
            if (!onclickInstall) {
                btnInstall.setAttribute('data-onclick-install', btnInstall.getAttribute('onclick') || '');
            }
            if (onclickAbrir) {
                btnInstall.setAttribute('onclick', onclickAbrir);
            } else {
                btnInstall.removeAttribute('onclick');
            }

            btnInstall.setAttribute('data-estado', 'instalado-abrir');

            if (btnAbrir) btnAbrir.style.display = 'none';

            if (preExistente && !instalado) {
                btnInstall.title = _t('comum.tooltip_preexistente_app',
                                      'Este app já estava instalado antes do FAP. A lixeira remove o app do sistema, mas o FAP não foi o responsável pela instalação.');
                btnInstall.setAttribute('data-title-origem', '1');
            } else {
                btnInstall.title = '';
                btnInstall.removeAttribute('data-title-origem');
            }
        } else {
            btnInstall.textContent = getTextoAposExecucao(idInstall);
            btnInstall.style.backgroundColor = '#4b5563';
            btnInstall.style.cursor = 'default';
            btnInstall.disabled = true;
            btnInstall.style.opacity = '1';
            btnInstall.setAttribute('data-estado', 'instalado-sem-abrir');

            if (preExistente && !instalado) {
                btnInstall.title = _t('comum.tooltip_preexistente_app',
                                      'Este app já estava instalado antes do FAP. A lixeira remove o app do sistema, mas o FAP não foi o responsável pela instalação.');
            }
        }

        _mostrarLixeira(idInstall, idRem);
    } else {
        btnInstall.textContent = textoOriginalInstall;
        btnInstall.style.backgroundColor = corOriginal || '';
        btnInstall.style.cursor = 'pointer';
        btnInstall.disabled = false;
        btnInstall.style.opacity = '1';

        var onclickInstallSalvo = btnInstall.getAttribute('data-onclick-install');
        if (onclickInstallSalvo !== null) {
            btnInstall.setAttribute('onclick', onclickInstallSalvo);
        }
        btnInstall.removeAttribute('data-estado');

        if (btnAbrir) btnAbrir.style.display = 'none';

        _esconderLixeira(idInstall);
    }
}

function aplicarEstadoOneShot(idInstall) {
    var btn = document.getElementById('btn-' + idInstall);
    if (!btn) return;

    var feito = isExecutado(idInstall);

    if (feito) {
        btn.textContent = getTextoAposExecucao(idInstall);
        btn.style.backgroundColor = '#4b5563';
        btn.style.cursor = 'default';
        btn.disabled = true;
        btn.style.opacity = '1';
        btn.removeAttribute('data-estado');
        btn.title = '';
        _esconderLixeira(idInstall);
    } else {
        btn.textContent = _textoOriginalTraduzido(btn) || btn.textContent;
        btn.style.backgroundColor = _corOriginalDoBotao(btn) || '';
        btn.style.cursor = 'pointer';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.removeAttribute('data-estado');
        btn.title = '';
        _esconderLixeira(idInstall);
    }
}

function _mostrarLixeira(idInstall, idRemover) {
    var btnInstall = document.getElementById('btn-' + idInstall);
    if (!btnInstall) return;

    var wrapper = _garantirWrapperFlatpak(btnInstall);
    if (!wrapper) return;

    var icone = wrapper.querySelector('.btn-flatpak-uninstall');
    if (!icone) {
        icone = document.createElement('button');
        icone.type = 'button';
        icone.className = 'btn-flatpak-uninstall';
        icone.setAttribute('data-comando-install', idInstall);
        icone.setAttribute('data-comando-remover', idRemover);
        icone.innerHTML = FAP_SVG_LIXEIRA;

        var nomeAcao = (APPS_REMOVIVEIS[idInstall] && APPS_REMOVIVEIS[idInstall].nome) || idInstall;
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

function _executarRemocaoPeloWrapper(idInstall) {
    var info = APPS_REMOVIVEIS[idInstall];
    if (!info) {
        console.warn('[remove-icon] App não registrado:', idInstall);
        return;
    }
    _executarRemocaoApp(idInstall);
}

async function _executarRemocaoApp(idComando) {
    var info = APPS_REMOVIVEIS[idComando];
    if (!info) return;

    var marcadoPeloFap = isExecutado(idComando);
    var instaladoNoSistema = false;
    try {
        instaladoNoSistema = appJaInstaladoNoSistema(idComando);
    } catch (e) {
        instaladoNoSistema = false;
    }

    var btnInstall = document.getElementById('btn-' + idComando);
    var estadoVisual = btnInstall ? btnInstall.getAttribute('data-estado') : null;
    var visualDizInstalado = estadoVisual === 'instalado-abrir' || estadoVisual === 'instalado-sem-abrir';

    if (!marcadoPeloFap && !instaladoNoSistema && !visualDizInstalado) {
        alert(_tVars('comum.nao_instalado',
                     (info.nome || idComando) + ' não está instalado.',
                     { nome: info.nome || idComando }));
        return;
    }

    var preExistente = instaladoNoSistema && !marcadoPeloFap;

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

    var precisaRefreshDnf = info.tipo === 'dnf' &&
    !info.comandoRemocao &&
    Array.isArray(info.pacotes) &&
    info.pacotes.length > 0;
    if (precisaRefreshDnf && typeof SystemState !== 'undefined') {
        try {
            SystemState.invalidar();
            await SystemState.carregar(true);
        } catch (e) {  }
    }

    var comando, idRemocao;

    if (info.comandoRemocao) {
        comando = info.comandoRemocao;
        idRemocao = (info.tipo === 'flatpak')
        ? idComando + '-revert'
        : _idRemocaoDe(idComando);
    } else if (info.tipo === 'flatpak') {
        comando = 'flatpak uninstall -y ' + info.appId;
        idRemocao = idComando + '-revert';
    } else if (info.tipo === 'dnf') {

        var pacotesInstalados = (info.pacotes || []).filter(function(p) {
            try { return SystemState.pacoteInstalado(p); } catch (e) { return true; }
        });
        if (pacotesInstalados.length === 0) {
            alert(_tVars('comum.nao_instalado', '{nome} não está instalado.',
                         { nome: info.nome || idComando }));
            _liberarSessao(idComando);
            _liberarOutrasSessoes();
            _atualizarBloqueioNavegacao();
            return;
        }
        var pacotes = pacotesInstalados.join(' ');
        comando = 'sudo dnf remove -y ' + pacotes;

        if (Array.isArray(info.reposRemover) && info.reposRemover.length > 0) {
            var repos = info.reposRemover.join(' ');
            comando += '; sudo rm -f ' + repos;
        }

        idRemocao = _idRemocaoDe(idComando);
    } else {
        console.warn('[remove-icon] tipo inválido:', info.tipo);
        return;
    }

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

            _liberarSessao(idComando);
            _liberarOutrasSessoes();
            _atualizarBloqueioNavegacao();
            return;
        }

        await desmarcarComoExecutado(idComando);

        if (typeof SystemState !== 'undefined' && typeof SystemState.invalidar === 'function') {
            SystemState.invalidar();
        }

        aplicarEstadoInstalavel(idComando, null, idRemocao);

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

async function aguardarConclusaoEEntao(idComando, onSucesso, timeoutMs) {
    var sucesso = await aguardarConclusaoReal(idComando, timeoutMs || 1800000);

    if (sucesso === null) {
        try {
            var r = await fetch(API_URL + '/progress', { cache: 'no-store' });
            if (r.ok) {
                var data = await r.json();
                if (data.executados && data.executados.includes(idComando)) {
                    completarProgresso(idComando, true);
                    sucesso = true;
                }
            }
        } catch (e) {  }
    }

    if (sucesso) {

        if (typeof SystemState !== 'undefined' && typeof SystemState.invalidar === 'function') {
            try { SystemState.invalidar(); } catch (e) {  }
        }
        if (typeof SystemState !== 'undefined' && typeof SystemState.carregar === 'function') {
            try {
                await SystemState.carregar(true);
            } catch (e) {
                console.warn('[aguardarConclusaoEEntao] Falha ao recarregar SystemState:', e);
            }
        }
        onSucesso(idComando);
    }
}

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

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        var foco = document.activeElement;
        if (foco && foco.classList && foco.classList.contains('btn-executar') && !foco.disabled) {
            e.preventDefault();
            foco.click();
        }
    }
});

var _MAPA_ORIGEM = {

    'codecs-essenciais': 'rpmfusion',
    'extras-tainted': 'rpmfusion',
    'fontes-ms-all': 'download',

    'vulkan-amd': 'fedora',
    'vaapi-amd': 'rpmfusion',
    'corectrl-install': 'fedora',
    'lact-install': 'comunidade',
    'nvidia-driver-install': 'rpmfusion',
    'nvidia-vaapi-install': 'fedora',
    'nvidia-vaapi-utils': 'fedora',
    'intel-media-install': 'fedora',
    'libva-intel-install': 'fedora',
    'intel-vaapi-utils': 'fedora',

    'firmware-vendor-install': 'fedora',
    'driver-realtek-r8168-install': 'rpmfusion',
    'driver-broadcom-wl-install': 'rpmfusion',
    'driver-openrazer-install': 'comunidade',
    'driver-xpadneo-install': 'comunidade',
    'steam-devices-install': 'fedora',

    'instalar-obs-studio': 'flathub',
    'instalar-easyeffects': 'flathub',
    'obs-cam': 'rpmfusion',

    'instalar-onlyoffice': 'flathub',
    'instalar-obsidian': 'flathub',
    'instalar-joplin': 'flathub',
    'instalar-haruna': 'flathub',
    'instalar-vlc': 'flathub',
    'instalar-spotify': 'flathub',
    'instalar-plex': 'flathub',
    'instalar-stremio': 'flathub',
    'instalar-pinta': 'flathub',
    'instalar-cura': 'flathub',
    'instalar-upscayl': 'flathub',
    'instalar-xnviewmp': 'flathub',
    'instalar-freecad': 'flathub',
    'instalar-opera': 'fabricante',
    'instalar-zoom': 'flathub',
    'instalar-discord': 'flathub',
    'instalar-telegram': 'flathub',
    'instalar-kdenlive': 'flathub',
    'instalar-shotcut': 'flathub',
    'instalar-openshot': 'flathub',
    'instalar-avidemux': 'flathub',
    'instalar-drift': 'flathub',
    'instalar-blender': 'flathub',
    'instalar-audacity': 'flathub',

    'instalar-thunderbird': 'fedora',
    'instalar-okular': 'fedora',
    'instalar-kate': 'fedora',
    'instalar-foliate': 'fedora',
    'instalar-mpv': 'fedora',
    'instalar-krita': 'fedora',
    'instalar-inkscape': 'fedora',
    'instalar-gimp': 'fedora',
    'instalar-darktable': 'fedora',
    'instalar-librecad': 'fedora',
    'instalar-pitivi': 'fedora',
    'instalar-ardour': 'fedora',
    'instalar-lmms': 'fedora',
    'instalar-chromium': 'fedora',
    'instalar-remmina': 'fedora',
    'instalar-gnome-connections': 'fedora',
    'instalar-krdc': 'fedora',

    'instalar-brave': 'fabricante',
    'instalar-vivaldi': 'fabricante',
    'instalar-edge': 'fabricante',

    'instalar-rustdesk': 'download',
    'instalar-lightworks': 'download',
    'instalar-rclone-manager': 'download',
    'instalar-artcraft-launcher': 'download',

    'instalar-firefox': 'fedora',
    'instalar-vscode': 'flathub',
    'instalar-drawy': 'flathub',
    'instalar-gear-lever': 'flathub',
    'instalar-packet': 'flathub',

    'cups-install': 'fedora',
    'samba-install': 'fedora',
    'keepassxc-install': 'fedora',
    'localsend-install': 'flathub',
    'warpinator-install': 'flathub',

    'steam-install': 'rpmfusion',
    'heroic-install': 'flathub',
    'lutris-install': 'flathub',
    'wine-install': 'fedora',
    'winetricks-install': 'fedora',
    'bottles-install': 'flathub',
    'ntsync-install': 'fedora',
    'gamemode-install': 'fedora',
    'mangohud-install': 'fedora',
    'goverlay-install': 'fedora',
    'gamescope-install': 'fedora',
    'vkbasalt-install': 'fedora',
    'protonup-qt-install': 'flathub',
    'controller-test-install': 'fedora',
    'retroarch-install': 'flathub',
    'dolphin-install': 'flathub',
    'pcsx2-install': 'flathub',
    'rpcs3-install': 'flathub',
    'duckstation-install': 'flathub',

    'qemu-kvm-install': 'fedora',
    'virtualbox-install': 'rpmfusion',
    'gnome-boxes-install': 'fedora',

    'gsmartcontrol-install': 'fedora',
    'coolercontrol-install': 'comunidade',

    'selinux-setroubleshoot-install': 'fedora',
    'selinux-gui-install': 'fedora'
};

var _ABRIR_REGISTRY = {};

function _registrarAbrir(idInstall, dados) {
    if (!idInstall || !dados) return;
    if (!dados.textoKey || typeof dados.onclick !== 'string' || !dados.onclick) {
        console.warn('[abrir-registry] registro inválido para', idInstall);
        return;
    }
    _ABRIR_REGISTRY[idInstall] = dados;
}

function _dadosAbrirDoApp(idInstall) {
    if (!idInstall) return null;
    return _ABRIR_REGISTRY[idInstall] || null;
}

var _INFO_BADGES_REGISTRY = {};

function _registrarInfoBadge(idInstall, dados) {
    if (!idInstall || !dados) return;
    if (!dados.tituloKey && !dados.corpoKey) {
        console.warn('[info-badge] registro inválido para', idInstall);
        return;
    }

    _INFO_BADGES_REGISTRY[idInstall] = {
        tituloKey: dados.tituloKey || null,
        tituloFallback: (typeof dados.tituloFallback === 'string') ? dados.tituloFallback : '',
        corpoKey: dados.corpoKey || null,
        corpoFallback: (typeof dados.corpoFallback === 'string') ? dados.corpoFallback : '',
        cor: dados.cor === 'info' ? 'info' : 'warn',
        acaoKey: dados.acaoKey || null,
        acaoFallback: (typeof dados.acaoFallback === 'string') ? dados.acaoFallback : '',
        acaoFn: (typeof dados.acaoFn === 'string' && dados.acaoFn) ? dados.acaoFn : null
    };
}

function _dadosInfoBadgeDoApp(idInstall) {
    if (!idInstall) return null;
    return _INFO_BADGES_REGISTRY[idInstall] || null;
}

function _renderizarInfoBadge(idInstall) {
    var dados = _dadosInfoBadgeDoApp(idInstall);
    if (!dados) return;

    var btn = document.getElementById('btn-' + idInstall);
    if (!btn) return;

    var wrapper = btn.closest('.btn-flatpak-wrapper');
    if (!wrapper) {

        wrapper = _garantirWrapperFlatpak(btn);
        if (!wrapper) return;
    }

    var badge = wrapper.querySelector('.fap-badge-info');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'fap-badge-info';
        badge.setAttribute('role', 'button');
        badge.setAttribute('tabindex', '0');
        badge.setAttribute('data-comando-info', idInstall);
        badge.setAttribute('aria-label', _t('comum.badge_info_aria', 'Mais informações'));

        badge.textContent = '!';

        badge.addEventListener('click', function(e) {
            e.stopPropagation();
            _abrirPopoverInfo(idInstall, e);
        });
        badge.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                _abrirPopoverInfo(idInstall, e);
            }
        });

        wrapper.appendChild(badge);
    }

    badge.setAttribute('data-cor', dados.cor);

    var textoTitulo = dados.tituloKey
    ? _t(dados.tituloKey, dados.tituloFallback || '')
    : (dados.tituloFallback || '');
    var tituloCurto = textoTitulo.replace(/<[^>]+>/g, '').trim();
    badge.setAttribute('title', tituloCurto || _t('comum.badge_info_tooltip', 'Clique para mais informações'));
}

function _renderizarInfoBadgesFixas() {
    document.querySelectorAll('[data-comando]').forEach(function(btn) {
        var id = btn.getAttribute('data-comando');
        if (!id) return;
        if (!_dadosInfoBadgeDoApp(id)) return;
        if (btn.classList.contains('btn-flatpak-uninstall')) return;
        _renderizarInfoBadge(id);
    });
}

function _abrirPopoverInfo(idInstall, event) {
    _fecharPopoverOrigem();
    var dados = _dadosInfoBadgeDoApp(idInstall);
    if (!dados) return;

    var badge = event.currentTarget;

    var popover = document.createElement('div');
    popover.className = 'fap-popover';
    popover.setAttribute('role', 'dialog');

    var info = APPS_REMOVIVEIS[idInstall];
    var nomeApp = (info && info.nome) || idInstall;

    var tituloHtml = dados.tituloKey
    ? _tVars(dados.tituloKey, dados.tituloFallback || '', { nome: nomeApp })
    : (dados.tituloFallback || _escapeHTML(nomeApp));
    var corpoHtml = dados.corpoKey
    ? _tVars(dados.corpoKey, dados.corpoFallback || '', { nome: nomeApp })
    : (dados.corpoFallback || '');

    var html = '';
    html += '<div class="fap-popover-header">';
    html += '<span class="fap-popover-titulo">';
    html += '<span class="fap-badge-info" data-cor="' + dados.cor + '" aria-hidden="true">!</span>';
    html += _escapeHTML(nomeApp);
    html += '</span>';
    html += '<button type="button" class="fap-popover-close" aria-label="' + _escapeHTML(_t('comum.fechar', 'Fechar')) + '">✕</button>';
    html += '</div>';
    html += '<div class="fap-popover-body">';
    if (tituloHtml) {
        html += '<div class="fap-popover-row">';
        html += '<div class="fap-popover-value" style="font-weight: 600; font-size: 0.9rem;">' + tituloHtml + '</div>';
        html += '</div>';
    }
    if (corpoHtml) {
        html += '<div class="fap-popover-row">';
        html += '<div class="fap-popover-value" style="line-height: 1.5;">' + corpoHtml + '</div>';
        html += '</div>';
    }
    if (dados.acaoKey && dados.acaoFn) {
        html += '<div class="fap-popover-row" style="margin-top: 0.75rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">';
        html += '<button type="button" class="btn-executar" style="width: 100%; font-size: 0.85rem;" id="fap-popover-info-acao">';
        html += _escapeHTML(_t(dados.acaoKey, dados.acaoFallback || 'Executar'));
        html += '</button>';
        html += '</div>';
    }
    html += '</div>';
    popover.innerHTML = html;

    document.body.appendChild(popover);
    _popoverAtual = popover;
    _popoverAnchorBadge = badge;
    _posicionarPopover();

    var onKey = function(e) { if (e.key === 'Escape') _fecharPopoverOrigem(); };
    var onDocClick = function(e) {
        if (!popover.contains(e.target) && e.target !== badge) _fecharPopoverOrigem();
    };
        var onScrollResize = function() { _posicionarPopover(); };

        var closeBtn = popover.querySelector('.fap-popover-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                _fecharPopoverOrigem();
            });
        }

        if (dados.acaoKey && dados.acaoFn) {
            var acaoBtn = document.getElementById('fap-popover-info-acao');
            if (acaoBtn) {
                acaoBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    _fecharPopoverOrigem();
                    try {
                        if (typeof window[dados.acaoFn] === 'function') {
                            window[dados.acaoFn](idInstall);
                        } else {
                            console.warn('[info-badge] ação não encontrada:', dados.acaoFn);
                        }
                    } catch (err) {
                        console.warn('[info-badge] erro na ação', dados.acaoFn, ':', err);
                    }
                });
            }
        }

        document.addEventListener('keydown', onKey);
        document.addEventListener('click', onDocClick, true);
        window.addEventListener('scroll', onScrollResize, true);
        window.addEventListener('resize', onScrollResize);

        popover._cleanup = function() {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('click', onDocClick, true);
            window.removeEventListener('scroll', onScrollResize, true);
            window.removeEventListener('resize', onScrollResize);
        };
}

document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[target="_blank"]') : null;
    if (!a) return;

    var href = (a.href || '').trim();
    if (!href) return;
    if (/^(?:javascript|data|vbscript|file|blob):/i.test(href)) return;
    if (!/^https?:\/\//i.test(href)) return;
        e.preventDefault();
    e.stopPropagation();

    abrirFerramentaExterna('xdg-open ' + href, 'link-' + Date.now(), href);
});

function _origemDoApp(idComando) {
    if (!idComando) return null;
    return _MAPA_ORIGEM[idComando] || null;
}

var _TEXTO_ORIGEM_CACHE = null;

function _textoOrigem(origem) {
    if (!_TEXTO_ORIGEM_CACHE) {
        _TEXTO_ORIGEM_CACHE = {
            'flathub': {
                nome: _t('origem.flathub.nome', 'Flathub'),
                tooltip: _t('origem.flathub.tooltip',
                            'Instalado via Flatpak do Flathub. Atualiza com flatpak update. Sandbox isolado do sistema.'),
                            atualizar: _t('origem.flathub.atualizar', 'flatpak update'),
                            remover: _t('origem.flathub.remover',
                                        'Use a lixeira ao lado do botão ou flatpak uninstall <app-id>.')
            },
            'fedora': {
                nome: _t('origem.fedora.nome', 'Fedora'),
                tooltip: _t('origem.fedora.tooltip',
                            'Instalado via DNF dos repositórios oficiais do Fedora. Atualiza com dnf upgrade.'),
                            atualizar: _t('origem.fedora.atualizar', 'sudo dnf upgrade'),
                            remover: _t('origem.fedora.remover',
                                        'Use a lixeira ao lado do botão ou sudo dnf remove <pacote>.')
            },
            'rpmfusion': {
                nome: _t('origem.rpmfusion.nome', 'RPM Fusion'),
                tooltip: _t('origem.rpmfusion.tooltip',
                            'Instalado via DNF dos repositórios RPM Fusion (não oficiais do Fedora). Atualiza com dnf upgrade enquanto o RPM Fusion estiver ativo.'),
                            atualizar: _t('origem.rpmfusion.atualizar', 'sudo dnf upgrade'),
                            remover: _t('origem.rpmfusion.remover',
                                        'Use a lixeira ao lado do botão ou sudo dnf remove <pacote>.')
            },
            'fabricante': {
                nome: _t('origem.fabricante.nome', 'Fabricante'),
                tooltip: _t('origem.fabricante.tooltip',
                            'Instalado via DNF do repositório oficial do fabricante. Atualiza com dnf upgrade enquanto o repo estiver ativo. O FAP adicionou o repo em /etc/yum.repos.d/.'),
                            atualizar: _t('origem.fabricante.atualizar', 'sudo dnf upgrade'),
                            remover: _t('origem.fabricante.remover',
                                        'Use a lixeira ao lado do botão (remove o pacote e o .repo).')
            },
            'download': {
                nome: _t('origem.download.nome', 'Download'),
                tooltip: _t('origem.download.tooltip',
                            'Instalado via RPM baixado de URL (site oficial ou GitHub). Não atualiza sozinho — remova pela lixeira e clique em "Instalar" de novo para pegar a versão nova.'),
                            atualizar: _t('origem.download.atualizar',
                                          'Remova pelo ícone de lixeira e clique em "Instalar" de novo.'),
                                          remover: _t('origem.download.remover',
                                                      'Use a lixeira ao lado do botão.')
            },
            'comunidade': {
                nome: _t('origem.comunidade.nome', 'Comunidade'),
                tooltip: _t('origem.comunidade.tooltip',
                            'Instalado via DNF de um repositório COPR mantido pela comunidade. Atualiza com dnf upgrade enquanto o COPR estiver ativo.'),
                            atualizar: _t('origem.comunidade.atualizar', 'sudo dnf upgrade'),
                            remover: _t('origem.comunidade.remover',
                                        'Use a lixeira ao lado do botão ou desative o COPR manualmente.')
            }
        };
    }
    return _TEXTO_ORIGEM_CACHE[origem] || null;
}

function _renderizarBadgeOrigem(idInstall) {
    var origem = _origemDoApp(idInstall);
    if (!origem) return;

    var btn = document.getElementById('btn-' + idInstall);
    if (!btn) return;

    var wrapper = btn.closest('.btn-flatpak-wrapper');
    if (!wrapper) return;

    var badge = wrapper.querySelector('.fap-badge-origem');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'fap-badge-origem';
        badge.setAttribute('data-origem', origem);
        badge.setAttribute('role', 'button');
        badge.setAttribute('tabindex', '0');
        badge.setAttribute('data-comando-origem', idInstall);

        badge.addEventListener('click', function(e) {
            e.stopPropagation();
            _abrirPopoverOrigem(idInstall, e);
        });
        badge.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                _abrirPopoverOrigem(idInstall, e);
            }
        });

        wrapper.insertBefore(badge, wrapper.firstChild);
    }

    var textoOrig = _textoOrigem(origem);
    if (textoOrig) {
        badge.setAttribute('title', textoOrig.tooltip);
        badge.setAttribute('aria-label', textoOrig.nome + ': ' + textoOrig.tooltip);
    }
}

function _renderizarBadgesFixas() {
    document.querySelectorAll('[data-comando]').forEach(function(btn) {
        var id = btn.getAttribute('data-comando');
        if (!id) return;
        if (!_origemDoApp(id)) return;
        if (btn.classList.contains('btn-flatpak-uninstall')) return;

        _renderizarBadgeOrigem(id);
    });
}

var _popoverAtual = null;
var _popoverAnchorBadge = null;

var _COMANDOS_NAO_DETERMINISTICOS = {
    'instalar-rustdesk': true,
    'instalar-lightworks': true,
    'instalar-rclone-manager': true,
    'instalar-artcraft-launcher': true,
    'instalar-brave': true,
    'instalar-vivaldi': true,
    'instalar-edge': true
};

function _comandoInstalacaoDoApp(idComando) {
    if (_COMANDOS_NAO_DETERMINISTICOS[idComando]) return null;
    var info = APPS_REMOVIVEIS[idComando];
    if (!info) return null;
    if (info.motivoBloqueio) return null;
    if (info.tipo === 'flatpak' && info.appId) {
        return 'flatpak install flathub ' + info.appId + ' -y';
    }
    if (info.tipo === 'dnf' && Array.isArray(info.pacotes) && info.pacotes.length > 0) {
        return 'sudo dnf install -y ' + info.pacotes.join(' ');
    }
    return null;
}

function _abrirPopoverOrigem(idComando, event) {
    _fecharPopoverOrigem();
    var origem = _origemDoApp(idComando);
    if (!origem) return;
    var textoOrig = _textoOrigem(origem);
    if (!textoOrig) return;

    var badge = event.currentTarget;
    var info = APPS_REMOVIVEIS[idComando];
    var nomeApp = (info && info.nome) || idComando;
    var comandoInst = _comandoInstalacaoDoApp(idComando);

    var popover = document.createElement('div');
    popover.className = 'fap-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Sobre ' + nomeApp);

    var html = '';
    html += '<div class="fap-popover-header">';
    html += '<span class="fap-popover-titulo">';
    html += '<span class="fap-badge-origem" data-origem="' + origem + '" aria-hidden="true"></span>';
    html += _escapeHTML(nomeApp);
    html += '</span>';
    html += '<button type="button" class="fap-popover-close" aria-label="Fechar">✕</button>';
    html += '</div>';
    html += '<div class="fap-popover-body">';

    html += '<div class="fap-popover-row">';
    html += '<span class="fap-popover-label">' + _escapeHTML(_t('origem.label_origem', 'Origem')) + '</span>';
    html += '<span class="fap-popover-value">' + _escapeHTML(textoOrig.nome) + ' — ' + _escapeHTML(textoOrig.tooltip) + '</span>';
    html += '</div>';

    if (comandoInst) {
        html += '<div class="fap-popover-row">';
        html += '<span class="fap-popover-label">' + _escapeHTML(_t('origem.label_comando', 'Comando exato')) + '</span>';
        html += '<code class="fap-popover-code">' + _escapeHTML(comandoInst) + '</code>';
        html += '</div>';
    }

    html += '<div class="fap-popover-row">';
    html += '<span class="fap-popover-label">' + _escapeHTML(_t('origem.label_atualizar', 'Como atualizar')) + '</span>';
    html += '<span class="fap-popover-value">' + _escapeHTML(textoOrig.atualizar) + '</span>';
    html += '</div>';

    html += '<div class="fap-popover-row">';
    html += '<span class="fap-popover-label">' + _escapeHTML(_t('origem.label_remover', 'Como remover')) + '</span>';
    html += '<span class="fap-popover-value">' + _escapeHTML(textoOrig.remover) + '</span>';
    html += '</div>';

    html += '</div>';
    popover.innerHTML = html;

    document.body.appendChild(popover);
    _popoverAtual = popover;
    _popoverAnchorBadge = badge;
    _posicionarPopover();

    var onKey = function(e) { if (e.key === 'Escape') _fecharPopoverOrigem(); };
    var onDocClick = function(e) {
        if (!popover.contains(e.target) && e.target !== badge) _fecharPopoverOrigem();
    };
        var onScrollResize = function() { _posicionarPopover(); };

        var closeBtn = popover.querySelector('.fap-popover-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                _fecharPopoverOrigem();
            });
        }

        document.addEventListener('keydown', onKey);
        document.addEventListener('click', onDocClick, true);
        window.addEventListener('scroll', onScrollResize, true);
        window.addEventListener('resize', onScrollResize);

        popover._cleanup = function() {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('click', onDocClick, true);
            window.removeEventListener('scroll', onScrollResize, true);
            window.removeEventListener('resize', onScrollResize);
        };
}

function _posicionarPopover() {
    if (!_popoverAtual || !_popoverAnchorBadge) return;
    var rect = _popoverAnchorBadge.getBoundingClientRect();
    var popRect = _popoverAtual.getBoundingClientRect();
    var top = rect.bottom + 8;
    var left = rect.left;
    if (left + popRect.width > window.innerWidth - 8) {
        left = window.innerWidth - popRect.width - 8;
    }
    if (top + popRect.height > window.innerHeight - 8) {
        top = rect.top - popRect.height - 8;
    }
    _popoverAtual.style.top = Math.max(8, top) + 'px';
    _popoverAtual.style.left = Math.max(8, left) + 'px';
}

function _fecharPopoverOrigem() {
    if (_popoverAtual) {
        if (_popoverAtual._cleanup) _popoverAtual._cleanup();
        _popoverAtual.remove();
        _popoverAtual = null;
        _popoverAnchorBadge = null;
    }
}

document.addEventListener('i18n-pronto', function() {
    _TEXTO_ORIGEM_CACHE = null;

    setTimeout(_renderizarInfoBadgesFixas, 50);
});

function _alternarSidebar() {
    var layout = document.getElementById('fap-layout');
    if (!layout) return;
    var colapsada = layout.classList.toggle('colapsada');

    document.body.classList.toggle('sidebar-colapsada', colapsada);
    try {
        localStorage.setItem('fap_sidebar_colapsada', colapsada ? '1' : '0');
    } catch (e) {}
    var btn = document.getElementById('fap-sidebar-toggle');
    if (btn) btn.setAttribute('aria-expanded', colapsada ? 'false' : 'true');
}

function _estadoEfetivoSidebar() {
    var manual = null;
    try {
        var v = localStorage.getItem('fap_sidebar_colapsada');
        if (v === '1') manual = true;
        else if (v === '0') manual = false;
    } catch (e) {}
    if (manual !== null) return manual;
    try {
        return window.matchMedia('(max-width: 1099px)').matches;
    } catch (e) {
        return false;
    }
}

function _inicializarSidebar() {
    var layout = document.getElementById('fap-layout');
    if (!layout) return;

    var colapsadaInicial = _estadoEfetivoSidebar();
    if (colapsadaInicial) layout.classList.add('colapsada');
    document.body.classList.toggle('sidebar-colapsada', colapsadaInicial);

    var btn = document.getElementById('fap-sidebar-toggle');
    if (btn) {
        btn.setAttribute('aria-expanded', colapsadaInicial ? 'false' : 'true');
    }

    try {
        var mq = window.matchMedia('(max-width: 1099px)');
        var onChange = function() {
            var manual = null;
            try { manual = localStorage.getItem('fap_sidebar_colapsada'); } catch (e) {}
            if (manual !== null) return;
            var l = document.getElementById('fap-layout');
            if (!l) return;
            var colapsar = mq.matches;
            l.classList.toggle('colapsada', colapsar);
            document.body.classList.toggle('sidebar-colapsada', colapsar);
        };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    } catch (e) {}
}

var _NA_STORAGE_KEY = 'fap_sessoes_na';

function _sessoesNA() {
    try {
        var raw = localStorage.getItem(_NA_STORAGE_KEY);
        if (!raw) return [];
        var arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

function _sessaoNA(id) {
    return _sessoesNA().indexOf(id) !== -1;
}

function _marcarSessaoNA(id) {
    var arr = _sessoesNA();
    if (arr.indexOf(id) === -1) arr.push(id);
    try { localStorage.setItem(_NA_STORAGE_KEY, JSON.stringify(arr)); } catch (e) {}
    _invalidarContadorSessoes();
    _atualizarProgressoGlobal();
}

function _desmarcarSessaoNA(id) {
    var arr = _sessoesNA().filter(function(x) { return x !== id; });
    try { localStorage.setItem(_NA_STORAGE_KEY, JSON.stringify(arr)); } catch (e) {}
    _invalidarContadorSessoes();
    _atualizarProgressoGlobal();
}

function _contagemSessao(id) {

    var sessaoObj = SESSOES.find(function(s) { return s.id === id; });
    if (sessaoObj && sessaoObj.informativa) {
        return {
            feitos: 0,
            pulados: 0,
            total: 0,
            na: _sessaoNA(id),
            informativa: true
        };
    }

    var comandos = _comandosRelevantes(id);
    var feitos = 0, pulados = 0;
    for (var i = 0; i < comandos.length; i++) {
        if (isExecutado(comandos[i])) feitos++;
        else if (isPulado(comandos[i])) pulados++;
    }
    return {
        feitos: feitos,
        pulados: pulados,
        total: comandos.length,
        na: _sessaoNA(id),
        informativa: false
    };
}

async function _refreshEstadoSessao() {
    var btn = document.getElementById('btn-refresh-estado');
    if (btn) {
        btn.classList.add('girando');
        btn.disabled = true;
    }
    try {
        SystemState.invalidar();

        _secureBootCache = null;
        _secureBootMokCache = null;

        if (typeof _invalidarHardwareScanCache === 'function') {
            try { _invalidarHardwareScanCache(); } catch (e) {  }
        }
        await SystemState.carregar();
        if (typeof restaurarEstadoSessao === 'function') {
            try { restaurarEstadoSessao(); } catch (e) {}
        }
        await _sincronizarEstadoFlatpaks();
        _renderizarBadgesFixas();

        if (typeof _atualizarSecaoNvidia === 'function') {
            try {
                await _atualizarSecaoNvidia();
            } catch (e) {
                console.warn('[refresh] _atualizarSecaoNvidia falhou:', e);
            }
        }

        if (btn) {
            btn.classList.remove('girando');
            btn.classList.add('sucesso');
            setTimeout(function() {
                btn.classList.remove('sucesso');
                btn.disabled = false;
            }, 1000);
        }
    } catch (e) {
        if (btn) {
            btn.classList.remove('girando');
            btn.disabled = false;
        }
    }
}

var _filtrosApps = { estado: 'todos', origem: 'todas' };

function _classificarApp(idComando) {
    var estado = 'nao_feito';
    if (isExecutado(idComando)) estado = 'feito';
    else if (appJaInstaladoNoSistema(idComando)) estado = 'preexistente';
    return {
        estado: estado,
        origem: _origemDoApp(idComando)
    };
}

function _aplicarFiltrosAplicativos() {
    var container = document.querySelector('#sessao-aplicativos');
    if (!container) return;
    var filtroEstado = _filtrosApps.estado;
    var filtroOrigem = _filtrosApps.origem;
    var ativos = filtroEstado !== 'todos' || filtroOrigem !== 'todas';

    var porBloco = new Map();

    container.querySelectorAll('.launcher-item').forEach(function(item) {
        var btn = item.querySelector('.btn-executar[data-comando]');
        var bloco = item.closest('.bloco-comando') || item.closest('details');
        if (bloco) {
            if (!porBloco.has(bloco)) porBloco.set(bloco, { visiveis: 0, total: 0 });
            porBloco.get(bloco).total++;
        }
        if (!btn) {
            item.style.display = '';
            if (bloco) porBloco.get(bloco).visiveis++;
            return;
        }
        var idComando = btn.getAttribute('data-comando');
        var c = _classificarApp(idComando);
        var casaEstado = filtroEstado === 'todos'
        || (filtroEstado === 'feitos' && c.estado === 'feito')
        || (filtroEstado === 'nao_feitos' && c.estado === 'nao_feito')
        || (filtroEstado === 'preexistentes' && c.estado === 'preexistente');
        var casaOrigem = filtroOrigem === 'todas' || c.origem === filtroOrigem;
        var visivel = casaEstado && casaOrigem;
        item.style.display = visivel ? '' : 'none';
        if (visivel && bloco) porBloco.get(bloco).visiveis++;
    });

        porBloco.forEach(function(info, bloco) {
            var summary = bloco.querySelector('summary');
            if (!summary) return;
            if (!summary.hasAttribute('data-label-original')) {
                summary.setAttribute('data-label-original', summary.textContent);
            }
            var label = summary.getAttribute('data-label-original');
            if (info.visiveis === 0 && ativos) {
                summary.textContent = label + ' (' + info.total + ' itens, 0 visíveis)';
            } else {
                summary.textContent = label;
            }
        });

        var btnLimpar = document.querySelector('#fap-filtros-apps .fap-filtros-limpar');
        if (btnLimpar) btnLimpar.style.display = ativos ? '' : 'none';
}

function _resetFiltrosAplicativos() {
    _filtrosApps = { estado: 'todos', origem: 'todas' };
    document.querySelectorAll('#fap-filtros-apps .fap-filtro-chip').forEach(function(c) {
        var grupo = c.getAttribute('data-filtro-grupo');
        var valor = c.getAttribute('data-filtro-valor');
        var isDefault = (grupo === 'estado' && valor === 'todos') || (grupo === 'origem' && valor === 'todas');
        c.classList.toggle('ativo', isDefault);
    });
    _aplicarFiltrosAplicativos();
}

function _inicializarFiltrosApps() {
    var container = document.getElementById('fap-filtros-apps');
    if (!container || container.hasAttribute('data-listeners-ready')) return;
    container.setAttribute('data-listeners-ready', '1');
    container.addEventListener('click', function(e) {
        var chip = e.target.closest('.fap-filtro-chip');
        if (chip) {
            var grupo = chip.getAttribute('data-filtro-grupo');
            var valor = chip.getAttribute('data-filtro-valor');
            if (grupo && valor) {
                _filtrosApps[grupo] = valor;
                container.querySelectorAll('.fap-filtro-chip[data-filtro-grupo="' + grupo + '"]').forEach(function(c) {
                    c.classList.toggle('ativo', c.getAttribute('data-filtro-valor') === valor);
                });
                _aplicarFiltrosAplicativos();
            }
            return;
        }
        var limpar = e.target.closest('.fap-filtros-limpar');
        if (limpar) _resetFiltrosAplicativos();
    });
}

function _normalizarBusca(s) {
    if (!s) return '';
    try {
        return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    } catch (e) {
        return String(s).toLowerCase();
    }
}

var _indiceBusca = null;
var _indicePromessa = null;

function _construirIndiceBusca() {
    if (_indiceBusca) return Promise.resolve(_indiceBusca);
    if (_indicePromessa) return _indicePromessa;

    _indicePromessa = Promise.all(SESSOES_PRINCIPAIS.map(function(id) {
        return fetch(id + '.html')
        .then(function(r) { return r.ok ? r.text() : ''; })
        .then(function(html) { return { id: id, html: html }; })
        .catch(function() { return { id: id, html: '' }; });
    })).then(function(resultados) {
        var sessoes = [];
        var itens = [];
        var _jaIndexado = {};

        function _contextoDoBotao(btn) {
            var ctxBloco = btn.closest('.bloco-comando');
            if (ctxBloco) {
                var h3 = ctxBloco.querySelector('h3');
                var ps = Array.prototype.slice.call(ctxBloco.querySelectorAll('p'))
                .map(function(p) { return p.textContent.trim(); });
                return ((h3 ? h3.textContent.trim() : '') + ' ' + ps.join(' ')).trim();
            }
            var acordeao = btn.closest('.acordeao');
            if (acordeao) {
                var summary = acordeao.querySelector('summary');
                var psA = Array.prototype.slice.call(
                    acordeao.querySelectorAll('.acordeao-conteudo > p')
                ).map(function(p) { return p.textContent.trim(); });
                return ((summary ? summary.textContent.trim() : '') + ' ' + psA.join(' ')).trim();
            }
            return '';
        }

        resultados.forEach(function(entry) {
            var id = entry.id;
            var nome = nomeDaSessao(id);
            sessoes.push({ id: id, nome: nome, nomeNorm: _normalizarBusca(nome) });

            if (!entry.html) return;
            try {
                var doc = new DOMParser().parseFromString(entry.html, 'text/html');

                doc.querySelectorAll('[data-comando]').forEach(function(btn) {
                    var idComando = btn.getAttribute('data-comando');
                    if (!idComando) return;

                    if (idComando.indexOf('abrir-') === 0) return;
                    if (idComando.indexOf('desfazer-') === 0) return;
                    if (idComando.slice(-7) === '-remove') return;
                    if (idComando.slice(-7) === '-revert') return;
                    if (btn.classList.contains('btn-flatpak-uninstall')) return;
                    if (btn.classList.contains('btn-reverter')) return;
                    if (btn.classList.contains('destrutivo')) return;

                    var chave = id + '::' + idComando;
                    if (_jaIndexado[chave]) return;
                    _jaIndexado[chave] = true;

                    var btnText = (btn.textContent || '').trim();
                    var contexto = _contextoDoBotao(btn);

                    var info = APPS_REMOVIVEIS[idComando];
                    var extras = [idComando];
                    if (info) {
                        if (info.nome) extras.push(info.nome);
                        if (info.appId) extras.push(info.appId);
                        if (Array.isArray(info.pacotes)) extras.push.apply(extras, info.pacotes);
                    }

                    var haystack = btnText + ' ' + contexto + ' ' + extras.join(' ');
                    itens.push({
                        sessaoId: id,
                        idComando: idComando,
                        texto: btnText || idComando,
                        haystackNorm: _normalizarBusca(haystack)
                    });
                });
            } catch (e) {
                console.warn('[busca] Erro ao parsear HTML de', id, ':', e.message);
            }
        });

        _indiceBusca = { sessoes: sessoes, itens: itens };

        try {
            document.dispatchEvent(new CustomEvent('fap-indice-pronto'));
        } catch (e) {  }

        return _indiceBusca;
    }).catch(function() {
        _indiceBusca = {
            sessoes: SESSOES_PRINCIPAIS.map(function(id) {
                var n = nomeDaSessao(id);
                return { id: id, nome: n, nomeNorm: _normalizarBusca(n) };
            }),
            itens: []
        };
        try {
            document.dispatchEvent(new CustomEvent('fap-indice-pronto'));
        } catch (e) {  }
        return _indiceBusca;
    });

    return _indicePromessa;
}

function _contemPalavra(haystackNorm, termoNorm) {
    if (!haystackNorm || !termoNorm) return false;

    var palavrasHay = haystackNorm.split(/[^a-z0-9]+/).filter(Boolean);
    if (palavrasHay.length === 0) return false;

    var palavrasTermo = termoNorm.split(/[^a-z0-9]+/).filter(Boolean);
    if (palavrasTermo.length === 0) return false;

    for (var i = 0; i < palavrasTermo.length; i++) {
        var termo = palavrasTermo[i];
        var exigeExato = termo.length < 4;
        var casou = false;

        for (var j = 0; j < palavrasHay.length; j++) {
            var palavra = palavrasHay[j];
            if (exigeExato) {
                if (palavra === termo) { casou = true; break; }
            } else {
                if (palavra.indexOf(termo) === 0) { casou = true; break; }
            }
        }
        if (!casou) return false;
    }
    return true;
}

function _buscar(termo) {
    var t = _normalizarBusca(termo);
    if (!t || t.length < 2) {
        return { sessoes: [], itens: [], pronto: true };
    }
    if (_indiceBusca) {
        var sessMatch = _indiceBusca.sessoes.filter(function(s) { return _contemPalavra(s.nomeNorm, t); });
        var itemMatch = _indiceBusca.itens.filter(function(i) { return _contemPalavra(i.haystackNorm, t); });
        return { sessoes: sessMatch, itens: itemMatch, pronto: true };
    }
    _construirIndiceBusca();
    var sessoes = SESSOES_PRINCIPAIS.map(function(id) {
        var n = nomeDaSessao(id);
        return { id: id, nome: n, nomeNorm: _normalizarBusca(n) };
    }).filter(function(s) { return _contemPalavra(s.nomeNorm, t); });
    return { sessoes: sessoes, itens: [], pronto: false };
}

var _filtroAtual = '';

function _aplicarFiltroSessao(termo) {
    var container = document.getElementById('sessao-container');
    if (!container) return;
    var t = _normalizarBusca(termo);
    _filtroAtual = t;
    if (!t || t.length < 2) {
        _limparFiltroSessao();
        return;
    }

    function _casaElemento(el) {
        var haystack = (el.innerText || el.textContent || '') + ' ';
        el.querySelectorAll('[data-comando]').forEach(function(b) {
            var id = b.getAttribute('data-comando');
            haystack += (id || '') + ' ';
            var info = APPS_REMOVIVEIS[id];
            if (info) {
                if (info.nome) haystack += info.nome + ' ';
                if (info.appId) haystack += info.appId + ' ';
                if (Array.isArray(info.pacotes)) haystack += info.pacotes.join(' ') + ' ';
            }
        });
        return _normalizarBusca(haystack).indexOf(t) !== -1;
    }

    var visiveis = 0;

    container.querySelectorAll('.bloco-comando').forEach(function(bloco) {
        var casa = _casaElemento(bloco);

        var temProgressoAtivo = false;
        bloco.querySelectorAll('.progress-container').forEach(function(pc) {
            if (pc.style.display && pc.style.display !== 'none') {
                temProgressoAtivo = true;
            }
        });

        bloco.style.display = (casa || temProgressoAtivo) ? '' : 'none';
        if (casa && !bloco.querySelector('.launcher-item')) visiveis++;
    });

        var porDetails = new Map();
        container.querySelectorAll('.launcher-item').forEach(function(item) {
            var casa = _casaElemento(item);
            item.style.display = casa ? '' : 'none';
            if (casa) visiveis++;

            var det = item.closest('details');
            if (det) {
                if (!porDetails.has(det)) porDetails.set(det, { total: 0, visiveis: 0 });
                var info = porDetails.get(det);
                info.total++;
                if (casa) info.visiveis++;
            }
        });

        porDetails.forEach(function(info, det) {
            det.style.display = (info.visiveis === 0) ? 'none' : '';
        });

        _mostrarBannerFiltro(termo, visiveis);
}

function _limparFiltroSessao() {
    var container = document.getElementById('sessao-container');
    if (!container) return;
    container.querySelectorAll('.bloco-comando').forEach(function(b) { b.style.display = ''; });
    container.querySelectorAll('.launcher-item').forEach(function(i) { i.style.display = ''; });
    container.querySelectorAll('details').forEach(function(d) { d.style.display = ''; });
    _esconderBannerFiltro();
    _filtroAtual = '';
}

function _mostrarBannerFiltro(termo, n) {
    var banner = document.getElementById('fap-filtro-banner');
    if (!banner) return;
    banner.hidden = false;
    var texto = banner.querySelector('.fap-filtro-banner-texto');
    if (texto) {
        texto.textContent = _tVars('busca.banner_filtro',
                                   '🔍 Filtrando por "' + termo + '" — ' + n + ' item(ns).',
                                   { termo: termo, n: n });
    }
}

function _esconderBannerFiltro() {
    var banner = document.getElementById('fap-filtro-banner');
    if (banner) banner.hidden = true;
}

document.addEventListener('DOMContentLoaded', function() {
    SystemState.carregar();

    carregarProgressoInicial();
    setTimeout(initCustomSelects, 300);

    setTimeout(_renderizarInfoBadgesFixas, 400);
    criarBotaoTema();
    _atualizarProgressoGlobal();

    _inicializarSidebar();

    verificarFlatpaksRemovidos();

    if (typeof I18N !== 'undefined' && typeof I18N.criarSeletorIdioma === 'function') {
        setTimeout(function() { I18N.criarSeletorIdioma(); }, 50);
    }

    carregarVersaoServidor().then(function() {
        mostrarBadgeSeHouverAtualizacao();
    });

    var _preloadBusca = function() { _construirIndiceBusca(); };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(_preloadBusca, { timeout: 3000 });
    } else {
        setTimeout(_preloadBusca, 2000);
    }
});

document.addEventListener('sessao-carregada', function(e) {
    _reaplicarBloqueioSeNecessario();
    SystemState.carregar();
    marcarFlatpaksJaInstalados();

    setTimeout(initCustomSelects, 200);
    setTimeout(carregarProgressoInicial, 300);
    criarBotaoTema();
    _atualizarProgressoGlobal();

    setTimeout(verificarFlatpaksRemovidos, 500);

    if (typeof I18N !== 'undefined' && typeof I18N.criarSeletorIdioma === 'function') {
        setTimeout(function() { I18N.criarSeletorIdioma(); }, 100);
    }

    setTimeout(_atualizarBloqueioNavegacao, 200);

    if (_filtroAtual) {
        setTimeout(function() { _aplicarFiltroSessao(_filtroAtual); }, 100);
    }

    setTimeout(_renderizarBadgesFixas, 250);

    setTimeout(_renderizarInfoBadgesFixas, 260);

    if (e && e.detail && e.detail.sessao === 'aplicativos') {
        setTimeout(_inicializarFiltrosApps, 300);
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
