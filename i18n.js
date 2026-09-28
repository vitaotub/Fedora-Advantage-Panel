/**
 * Fedora Only Fans (FOF) - Módulo de Internacionalização (i18n)
 *
 * Suporta: pt-BR (padrão), en, es
 *
 * Estratégia (Opção B1):
 * - HTML tem PT-BR como texto padrão dentro de cada elemento traduzível.
 * - Elementos traduzíveis carregam `data-i18n="chave"` (textContent)
 *   ou `data-i18n-html="chave"` (innerHTML).
 * - Emojis ficam FORA das strings (em <span class="i18n-emoji">),
 *   para não migrarem entre idiomas.
 * - i18n.js NÃO toca no DOM quando lang === 'pt-BR' (HTML já está certo).
 * - Quando lang !== 'pt-BR', carrega o JSON correspondente e substitui.
 *
 * API pública:
 *   t(chave, vars?)              - retorna string traduzida (com interpolação)
 *   setLang(lang)                - troca o idioma (recarrega a página)
 *   getLang()                    - retorna o idioma atual
 *   aplicarTraducoes(root?)      - aplica data-i18n em um subtree (opcional)
 *   initI18n()                   - inicializa (chamado automaticamente)
 *   criarSeletorIdioma()         - injeta o seletor nos containers marcados
 *
 * Eventos:
 *   'i18n-pronto' - disparado após o JSON ser carregado e aplicado
 */

(function() {
    'use strict';

    // ============================================================
    // CONSTANTES
    // ============================================================

    var LANGS_DISPONIVEIS = ['pt-BR', 'en', 'es'];
    var LANG_PADRAO = 'pt-BR';
    var STORAGE_KEY = 'fof_lang';
    var CACHE_PREFIX = 'fof_lang_data_';

    // Versão de fallback para a chave de cache.
    //
    // ATENÇÃO: este valor NÃO é lido do package.json por design. Ele é
    // usado como cache-buster ANTES de qualquer requisição ao /info —
    // ou seja, antes de o Node ter chance de responder qualquer coisa.
    // Ler o package.json aqui exigiria um fetch, e o cache-buster
    // perderia o sentido (o fetch já viria com cache, potencialmente).
    //
    // Por isso, esta é a ÚNICA exceção à regra "versão em um só lugar".
    // Ao lançar uma release que altere strings dos locales, atualize
    // este valor manualmente — junto com a mudança no package.json.
    //
    // Impacto de esquecer: o usuário pode ver strings antigas por até
    // alguns segundos, até o /info responder e popular
    // window.FOF_VERSION_UI18N (aí o _chaveCache() passa a usar a
    // versão real e o cache é invalidado naturalmente).
    var FALLBACK_VERSION = '1.0.0-09272026';

    // ============================================================
    // ESTADO
    // ============================================================

    var estado = {
        lang: LANG_PADRAO,
        strings: {},
        carregado: false,
        carregando: null
    };

    // Guard: impede que criarSeletorIdioma() rode múltiplas vezes.
    var _seletorCriado = false;

    // ============================================================
    // DETECÇÃO / SELEÇÃO DE IDIOMA
    // ============================================================

    function detectarIdiomaInicial() {
        // 1. Preferência explícita do usuário
        try {
            var salvo = localStorage.getItem(STORAGE_KEY);
            if (salvo && LANGS_DISPONIVEIS.indexOf(salvo) !== -1) {
                return salvo;
            }
        } catch (e) { /* localStorage indisponível */ }

        // 2. Idioma do navegador
        var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
        if (nav.indexOf('pt') === 0) return 'pt-BR';
        if (nav.indexOf('es') === 0) return 'es';
        if (nav.indexOf('en') === 0) return 'en';

        // 3. Padrão
        return LANG_PADRAO;
    }

    // ============================================================
    // VERSÃO DO FOF (para cache-busting e invalidação de cache)
    // ============================================================
    //
    // `window.FOF_VERSION_UI18N` é populado por carregarVersaoServidor()
    // do script.js, que roda DEPOIS do i18n.js na primeira carga. Por
    // isso não podemos depender dele para o cache-buster. Usamos como
    // fallback um timestamp atual — que sempre dribla o cache HTTP,
    // ao custo de uma requisição a mais na primeira carga.
    function _versaoParaCacheBuster() {
        var v = window.FOF_VERSION_UI18N;
        if (v && typeof v === 'string' && v.length > 0) {
            return v;
        }
        return 't' + Date.now();
    }

    function _chaveCache(lang) {
        // O cache inclui a versão do FOF para que atualizações de
        // strings sejam refletidas automaticamente. Sem isso, um cache
        // antigo podia servir strings desatualizadas por tempo
        // indefinido (o cache-buster HTTP só atua na requisição, não
        // no localStorage).
        //
        // Usa window.FOF_VERSION_UI18N se disponível; senão, cai na
        // constante FALLBACK_VERSION deste módulo. Antes, o fallback
        // era 'dev' — que criava uma chave órfã permanente (nunca
        // mais usada depois que a versão real chegava).
        var v = window.FOF_VERSION_UI18N || FALLBACK_VERSION;
        return CACHE_PREFIX + lang + '_' + v;
    }

    // Remove do localStorage todas as chaves de cache do idioma
    // informado que NÃO sejam a chave atual (versões antigas do FOF).
    // Chamado no boot, depois que _chaveCache() está estável.
    function _limparCachesAntigos(lang) {
        try {
            var prefixo = CACHE_PREFIX + lang + '_';
            var chaveAtual = _chaveCache(lang);
            var paraRemover = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(prefixo) === 0 && k !== chaveAtual) {
                    paraRemover.push(k);
                }
            }
            paraRemover.forEach(function(k) { localStorage.removeItem(k); });
            if (paraRemover.length > 0) {
                console.log('[i18n] Cache antigo removido:', paraRemover.length, 'chave(s)');
            }
        } catch (e) { /* localStorage indisponível ou cheio */ }
    }

    // ============================================================
    // CARREGAMENTO DO JSON
    // ============================================================

    function carregarDoCache(lang) {
        try {
            var raw = localStorage.getItem(_chaveCache(lang));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function salvarNoCache(lang, dados) {
        try {
            localStorage.setItem(_chaveCache(lang), JSON.stringify(dados));
        } catch (e) { /* quota cheia ou localStorage desabilitado */ }
    }

    function carregarDoServidor(lang) {
        // Versão do FOF (ou timestamp de fallback) como cache-buster.
        var versao = _versaoParaCacheBuster();
        var url = '/locales/' + encodeURIComponent(lang) + '.json?v=' + encodeURIComponent(versao);

        return fetch(url).then(function(resp) {
            if (!resp.ok) {
                throw new Error('HTTP ' + resp.status + ' ao carregar ' + url);
            }
            return resp.json();
        });
    }

    function garantirIdiomaCarregado(lang) {
        if (lang === LANG_PADRAO) {
            // PT-BR é o próprio HTML — nada a carregar
            estado.strings = {};
            estado.carregado = true;
            return Promise.resolve();
        }

        if (estado.carregado && estado.lang === lang) {
            return Promise.resolve();
        }

        if (estado.carregando && estado.lang === lang) {
            return estado.carregando;
        }

        estado.lang = lang;
        estado.carregado = false;

        // Tenta cache primeiro (instantâneo), depois servidor
        var doCache = carregarDoCache(lang);
        if (doCache) {
            estado.strings = doCache;
            estado.carregado = true;
            // Atualiza em background sem bloquear
            carregarDoServidor(lang).then(function(fresco) {
                estado.strings = fresco;
                salvarNoCache(lang, fresco);
            }).catch(function() { /* ignora — cache já serve */ });
            return Promise.resolve();
        }

        estado.carregando = carregarDoServidor(lang)
        .then(function(dados) {
            estado.strings = dados;
            estado.carregado = true;
            estado.carregando = null;
            salvarNoCache(lang, dados);
        })
        .catch(function(err) {
            console.warn('[i18n] Falha ao carregar', lang, '- usando PT-BR:', err.message);
            estado.lang = LANG_PADRAO;
            estado.strings = {};
            estado.carregado = true;
            estado.carregando = null;
        });

        return estado.carregando;
    }

    // ============================================================
    // LOOKUP DE CHAVES
    // ============================================================

    function buscarChave(obj, caminho) {
        var partes = caminho.split('.');
        var atual = obj;
        for (var i = 0; i < partes.length; i++) {
            if (atual == null || typeof atual !== 'object') return undefined;
            atual = atual[partes[i]];
        }
        return atual;
    }

    function interpolar(str, vars) {
        // Variáveis globais disponíveis para qualquer interpolação:
        // - {versao} → window.FOF_VERSION_UI18N (definido por script.js)
        // Variáveis locais passadas via `vars` têm precedência.
        var globais = {
            versao: (typeof window.FOF_VERSION_UI18N !== 'undefined' && window.FOF_VERSION_UI18N) || '?'
        };
        var todas = Object.assign({}, globais, vars || {});

        return str.replace(/\{(\w+)\}/g, function(match, nome) {
            return Object.prototype.hasOwnProperty.call(todas, nome) ? String(todas[nome]) : match;
        });
    }

    /**
     * Retorna a string traduzida. Em PT-BR ou se a chave não existir,
     * retorna null (o chamador usa o texto já presente no DOM).
     */
    function t(chave, vars) {
        if (estado.lang === LANG_PADRAO) {
            return null;
        }
        var valor = buscarChave(estado.strings, chave);
        if (typeof valor !== 'string') {
            console.warn('[i18n] Chave não encontrada:', chave, 'em', estado.lang);
            return null;
        }
        return interpolar(valor, vars);
    }

    /**
     * Igual a t(), mas retorna um fallback explícito se não houver tradução.
     * Útil para strings construídas dinamicamente em JS.
     */
    function tOr(chave, fallback, vars) {
        var r = t(chave, vars);
        return r !== null ? r : fallback;
    }

    // ============================================================
    // APLICAÇÃO NO DOM
    // ============================================================

    /**
     * Substitui textos em um subtree (ou no documento inteiro).
     * Não faz nada quando lang === 'pt-BR' (HTML já está correto).
     *
     * IMPORTANTE: todas as substituições passam por interpolar() para
     * resolver placeholders como {versao}, {nome}, etc.
     */
    function aplicarTraducoes(root) {
        if (estado.lang === LANG_PADRAO) {
            // PT-BR: HTML é a fonte. Não toca no DOM.
            return;
        }
        root = root || document;

        // textContent
        var nosTexto = root.querySelectorAll('[data-i18n]');
        for (var i = 0; i < nosTexto.length; i++) {
            var el = nosTexto[i];
            var chave = el.getAttribute('data-i18n');
            var valor = buscarChave(estado.strings, chave);
            if (typeof valor === 'string') {
                el.textContent = interpolar(valor);
            }
        }

        // innerHTML (para strings com <strong>, <a>, etc.)
        var nosHtml = root.querySelectorAll('[data-i18n-html]');
        for (var j = 0; j < nosHtml.length; j++) {
            var elH = nosHtml[j];
            var chaveH = elH.getAttribute('data-i18n-html');
            var valorH = buscarChave(estado.strings, chaveH);
            if (typeof valorH === 'string') {
                elH.innerHTML = interpolar(valorH);
            }
        }

        // Atributos (title, placeholder, aria-label)
        ['title', 'placeholder', 'aria-label'].forEach(function(attr) {
            var seletor = '[data-i18n-' + attr + ']';
            var nos = root.querySelectorAll(seletor);
            for (var k = 0; k < nos.length; k++) {
                var elA = nos[k];
                var chaveA = elA.getAttribute('data-i18n-' + attr);
                var valorA = buscarChave(estado.strings, chaveA);
                if (typeof valorA === 'string') {
                    elA.setAttribute(attr, interpolar(valorA));
                }
            }
        });

        // Atualiza <html lang="">
        document.documentElement.setAttribute('lang', estado.lang);
    }

    // ============================================================
    // SELETOR DE IDIOMA
    // ============================================================

    /**
     * Cria um <select> de idioma e injeta em todos os containers
     * com a classe `.i18n-seletor-container` (ou id `#i18n-seletor`).
     * Se já existir um seletor no container, não duplica.
     */
    function criarSeletorIdioma() {
        // Guard: se já criamos o seletor nesta sessão, retorna cedo.
        if (_seletorCriado) return;

        var containers = document.querySelectorAll('.i18n-seletor-container, #i18n-seletor');
        if (!containers.length) return;

        for (var i = 0; i < containers.length; i++) {
            var container = containers[i];
            if (container.querySelector('.i18n-seletor')) continue;

            var label = document.createElement('label');
            label.className = 'i18n-seletor-label';
            label.textContent = '🌐';

            var select = document.createElement('select');
            select.className = 'i18n-seletor';
            select.setAttribute('aria-label', 'Idioma');

            var opcoes = [
                { v: 'pt-BR', t: 'Português' },
                { v: 'en', t: 'English' },
                { v: 'es', t: 'Español' }
            ];

            opcoes.forEach(function(op) {
                var o = document.createElement('option');
                o.value = op.v;
                o.textContent = op.t;
                if (op.v === estado.lang) o.selected = true;
                select.appendChild(o);
            });

            select.addEventListener('change', function() {
                setLang(this.value);
            });

            container.appendChild(label);
            container.appendChild(select);
        }

        _seletorCriado = true;
    }

    // ============================================================
    // TROCA DE IDIOMA
    // ============================================================

    /**
     * Define o idioma e recarrega a página.
     * Recarregar é simples e robusto — a troca é rara.
     */
    function setLang(lang) {
        if (LANGS_DISPONIVEIS.indexOf(lang) === -1) {
            console.warn('[i18n] Idioma não suportado:', lang);
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (e) { /* ignore */ }
        // Recarrega — o boot vai pegar o novo idioma do localStorage
        window.location.reload();
    }

    function getLang() {
        return estado.lang;
    }

    // ============================================================
    // INICIALIZAÇÃO
    // ============================================================

    function initI18n() {
        estado.lang = detectarIdiomaInicial();

        // Remove caches de versões anteriores do FOF assim que
        // sabemos o idioma atual. Faz isso antes de qualquer load
        // para não competir com o carregamento do JSON.
        _limparCachesAntigos(estado.lang);

        // Sempre define lang no <html> imediatamente
        document.documentElement.setAttribute('lang', estado.lang);

        // pt-BR: nada a carregar
        if (estado.lang === LANG_PADRAO) {
            estado.carregado = true;
            criarSeletorIdioma();
            document.dispatchEvent(new CustomEvent('i18n-pronto', { detail: { lang: estado.lang } }));
            return Promise.resolve();
        }

        // Outros idiomas: carrega o JSON e aplica
        return garantirIdiomaCarregado(estado.lang).then(function() {
            aplicarTraducoes();
            criarSeletorIdioma();
            document.dispatchEvent(new CustomEvent('i18n-pronto', { detail: { lang: estado.lang } }));
        });
    }

    // ============================================================
    // API PÚBLICA
    // ============================================================

    window.I18N = {
        t: t,
        tOr: tOr,
        getLang: getLang,
        setLang: setLang,
        aplicarTraducoes: aplicarTraducoes,
        criarSeletorIdioma: criarSeletorIdioma,
        initI18n: initI18n,
        LANGS_DISPONIVEIS: LANGS_DISPONIVEIS
    };

    // Atalhos globais (usados pelos scripts de sessão)
    window.t = t;
    window.tOr = tOr;

    // Boot: se o DOM já estiver pronto, inicializa; senão aguarda
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initI18n);
    } else {
        initI18n();
    }
})();
