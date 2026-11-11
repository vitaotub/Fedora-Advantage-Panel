#!/usr/bin/env node
/**
 * Fedora Advantage Panel (FAP) — Validador estático de contratos de botões
 * ============================================================
 *
 * Uso:
 *   node scripts/validar-botoes.js
 *   (ou, via Makefile: `make check-buttons`)
 *
 * Pega botões que quebram silenciosamente ("cliquei e não aconteceu nada")
 * sem precisar clicar em nenhum. Roda em ~2s, zero dependências.
 *
 * Regras (7):
 *   1. Todo `data-comando` no HTML tem entrada em `SESSOES` (exceto transientes).
 *   2. Todo `idComando` em `SESSOES` tem botão no HTML (exceto flags puros).
 *   3. Todo `onclick="fnName(...)"` referencia função definida em `script.js`
 *      ou no `<script>` inline da própria sessão.
 *   4. Todo `data-logbox="X"` tem `id="X"` no mesmo HTML (exceto logs
 *      criados dinamicamente por JS inline da própria sessão).
 *   5. Todo `registrarAppRemovivel(id, {...})` tem `nome` + (`appId` OU
 *      `pacotes[]` OU `comandoRemocao`).
 *   6. Todo `_registrarAbrir(id, { textoKey })` tem a chave em `locales/en.json`
 *      e `locales/es.json`.
 *   7. `data-comando` é único em todos os HTMLs (sem duplicata entre sessões).
 *
 * Exit code: 0 se todos os checks passaram (avisos não bloqueiam).
 *            1 se qualquer erro foi encontrado.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const COR_VERDE = '\x1b[32m';
const COR_AMARELA = '\x1b[33m';
const COR_VERMELHA = '\x1b[31m';
const COR_RESET = '\x1b[0m';

const erros = [];
const avisos = [];

// ============================================================
// WHITELISTS (falsos positivos conhecidos)
// ============================================================
//
// `data-comando` gerado dinamicamente via JS inline (concatenação)
// não é um atributo HTML estático. O validador captura strings JS
// como `'btn-' + id` no texto do HTML — filtrar por caracteres que
// indicam concatenação (`'`, `"`, `+`, backtick).
const FILTRO_DATA_COMANDO_DINAMICO = /['"+`]/;

// IDs gerados dinamicamente por `_buildCard` em
// `dispositivos-perifericos.html` (não existem como `data-comando`
// estático em nenhum HTML — são criados em runtime ao escanear
// hardware).
const IDS_DINAMICOS_CONHECIDOS = new Set([
    'driver-realtek-r8168-install',
    'driver-realtek-r8168-remove',
    'driver-broadcom-wl-install',
    'driver-broadcom-wl-remove'
]);

// Pares de toggle que NÃO têm botão HTML próprio. O `-remove` só
// existe em `SESSOES` para o `aplicarEstadoToggle` saber o par
// instalado/revertido. Virtualização usa esse padrão (o `<button>`
// do HTML é o `-install`, e o "Reverter" é renderizado pelo próprio
// `aplicarEstadoToggle`).
const PARES_TOGGLE_SEM_BOTAO_HTML = new Set([
    'qemu-kvm-remove',
    'virtualbox-remove',
    'gnome-boxes-remove'
]);

// `data-logbox` criado dinamicamente pelo `<script>` inline da
// própria sessão (não existe estaticamente como `id="..."` no HTML).
const LOG_DINAMICO_ESPERADO = {
    // `estado-fedora.html` cria `<div id="log-sessao-hardware">` no
    // `restaurarEstadoSessao` para o botão "Preparar Secure Boot"
    // (que aponta para `data-logbox="log-sessao-hardware"`) ter onde
    // logar mesmo quando a Sessão 3 nunca foi aberta.
    'estado-fedora.html': new Set(['log-sessao-hardware'])
};

// ============================================================
// HELPERS DE LEITURA E PARSING
// ============================================================

function ler(arquivo) {
    return fs.readFileSync(path.join(ROOT, arquivo), 'utf8');
}

function lerJSON(arquivo) {
    return JSON.parse(ler(arquivo));
}

function temChave(obj, caminho) {
    const partes = caminho.split('.');
    let atual = obj;
    for (const p of partes) {
        if (atual == null || typeof atual !== 'object') return false;
        if (!(p in atual)) return false;
        atual = atual[p];
    }
    return true;
}

function extrairDataComandos(texto) {
    const out = [];
    const re = /data-comando="([^"]+)"/g;
    let m;
    while ((m = re.exec(texto)) !== null) out.push(m[1]);
    return out;
}

function extrairOnclicks(texto) {
    const out = [];
    const re = /onclick="([^"]+)"/g;
    let m;
    while ((m = re.exec(texto)) !== null) {
        const fnM = m[1].match(/([a-zA-Z_$][\w$]*)\s*\(/);
        if (fnM) out.push(fnM[1]);
    }
    return out;
}

function extrairLogboxEIds(texto) {
    const logboxes = [];
    const ids = new Set();
    let m;
    const reLog = /data-logbox="([^"]+)"/g;
    while ((m = reLog.exec(texto)) !== null) logboxes.push(m[1]);
    const reId = /\bid="([^"]+)"/g;
    while ((m = reId.exec(texto)) !== null) ids.add(m[1]);
    return { logboxes, ids };
}

function extrairFuncoes(texto) {
    const fns = new Set();
    let m;
    const re1 = /\bfunction\s+([a-zA-Z_$][\w$]*)\s*\(/g;
    while ((m = re1.exec(texto)) !== null) fns.add(m[1]);
    const re2 = /\b(?:var|let|const)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/g;
    while ((m = re2.exec(texto)) !== null) fns.add(m[1]);
    const re3 = /\b(?:var|let|const)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
    while ((m = re3.exec(texto)) !== null) fns.add(m[1]);
    const re4 = /\b([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/g;
    while ((m = re4.exec(texto)) !== null) fns.add(m[1]);
    const re5 = /\bwindow\.([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function|\()/g;
    while ((m = re5.exec(texto)) !== null) fns.add(m[1]);
    return fns;
}

// Extrai `{ id: { comandos } }` de SESSOES em script.js.
function extrairSessoes(texto) {
    const resultado = {};
    const inicio = texto.indexOf('var SESSOES = [');
    if (inicio === -1) {
        throw new Error('SESSOES não encontrado em script.js');
    }

    let nivel = 0;
    let fim = -1;
    let dentroString = false;
    let charAnterior = '';
    for (let i = inicio + 'var SESSOES = '.length; i < texto.length; i++) {
        const c = texto[i];
        if (dentroString) {
            if (c === '\\') { i++; continue; }
            if (c === charAnterior) dentroString = false;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { dentroString = true; charAnterior = c; continue; }
        if (c === '[') nivel++;
        if (c === ']') { nivel--; if (nivel === 0) { fim = i + 1; break; } }
    }
    if (fim === -1) throw new Error('Não consegui encontrar o fim de SESSOES');

    const blocoSessoes = texto.substring(inicio, fim);

    const blocosSessao = [];
    nivel = 0;
    dentroString = false;
    charAnterior = '';
    let inicioSessao = -1;
    for (let i = 0; i < blocoSessoes.length; i++) {
        const c = blocoSessoes[i];
        if (dentroString) {
            if (c === '\\') { i++; continue; }
            if (c === charAnterior) dentroString = false;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { dentroString = true; charAnterior = c; continue; }
        if (c === '{') {
            if (nivel === 1) inicioSessao = i;
            nivel++;
        }
        if (c === '}') {
            nivel--;
            if (nivel === 1 && inicioSessao !== -1) {
                blocosSessao.push(blocoSessoes.substring(inicioSessao, i + 1));
                inicioSessao = -1;
            }
        }
        if (c === '[') nivel++;
        if (c === ']') nivel--;
    }

    for (const bloco of blocosSessao) {
        const idM = bloco.match(/\bid\s*:\s*['"]([^'"]+)['"]/);
        if (!idM) continue;
        const sessaoId = idM[1];
        const comandos = new Set();

        const cmdInicio = bloco.indexOf('comandos:');
        if (cmdInicio !== -1) {
            const cmdSub = bloco.substring(cmdInicio + 'comandos:'.length);
            let cmdNivel = 0;
            let dentroStr = false;
            let charAnt = '';
            let cmdFim = -1;
            for (let i = 0; i < cmdSub.length; i++) {
                const c = cmdSub[i];
                if (dentroStr) {
                    if (c === '\\') { i++; continue; }
                    if (c === charAnt) dentroStr = false;
                    continue;
                }
                if (c === '"' || c === "'" || c === '`') { dentroStr = true; charAnt = c; continue; }
                if (c === '{') cmdNivel++;
                if (c === '}') { cmdNivel--; if (cmdNivel === 0) { cmdFim = i; break; } }
            }
            if (cmdFim !== -1) {
                const cmdBloco = cmdSub.substring(0, cmdFim + 1);
                let nivel2 = 0;
                for (let i = 0; i < cmdBloco.length; i++) {
                    const c = cmdBloco[i];
                    if (c === '"' || c === "'") {
                        const quote = c;
                        let j = i + 1;
                        let str = '';
                        while (j < cmdBloco.length && cmdBloco[j] !== quote) {
                            if (cmdBloco[j] === '\\') j++;
                            str += cmdBloco[j];
                            j++;
                        }
                        let k = j + 1;
                        while (k < cmdBloco.length && /\s/.test(cmdBloco[k])) k++;
                        if (cmdBloco[k] === ':' && nivel2 === 1) {
                            comandos.add(str);
                        }
                        i = j;
                        continue;
                    }
                    if (c === '{') nivel2++;
                    if (c === '}') nivel2--;
                }
            }
        }
        resultado[sessaoId] = comandos;
    }

    return resultado;
}

function extrairMapaOrigem(texto) {
    const mapa = {};
    const m = texto.match(/_MAPA_ORIGEM\s*=\s*\{([\s\S]*?)\n\};/);
    if (!m) return mapa;
    const re = /'([^']+)'\s*:\s*'([^']+)'/g;
    let mm;
    while ((mm = re.exec(m[1])) !== null) mapa[mm[1]] = mm[2];
    return mapa;
}

function extrairChamadasRegistrar(texto, nomeFuncao) {
    const resultado = {};
    const re = new RegExp(nomeFuncao + '\\s*\\(\\s*[\'"]([^\'"]+)[\'"]\\s*,\\s*\\{', 'g');
    let m;
    while ((m = re.exec(texto)) !== null) {
        const id = m[1];
        let i = m.index + m[0].length - 1;
        let nivel = 1;
        let dentroStr = false;
        let charAnt = '';
        const inicio = i;
        for (i++; i < texto.length; i++) {
            const c = texto[i];
            if (dentroStr) {
                if (c === '\\') { i++; continue; }
                if (c === charAnt) dentroStr = false;
                continue;
            }
            if (c === '"' || c === "'" || c === '`') { dentroStr = true; charAnt = c; continue; }
            if (c === '{') nivel++;
            if (c === '}') { nivel--; if (nivel === 0) break; }
        }
        resultado[id] = texto.substring(inicio, i + 1);
    }
    return resultado;
}

function analisarAppRemovivel(bloco) {
    const info = {};
    const nomeM = bloco.match(/\bnome\s*:\s*['"]([^'"]+)['"]/);
    if (nomeM) info.nome = nomeM[1];
    const tipoM = bloco.match(/\btipo\s*:\s*['"]([^'"]+)['"]/);
    if (tipoM) info.tipo = tipoM[1];
    const appIdM = bloco.match(/\bappId\s*:\s*['"]([^'"]+)['"]/);
    if (appIdM) info.appId = appIdM[1];
    const pacotesM = bloco.match(/\bpacotes\s*:\s*\[([^\]]*)\]/);
    if (pacotesM) {
        info.pacotes = pacotesM[1].split(',').map(p => p.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    }
    info.temComandoRemocao = /\bcomandoRemocao\s*:/.test(bloco);
    return info;
}

function analisarAbrirRegistro(bloco) {
    const tkM = bloco.match(/\btextoKey\s*:\s*['"]([^'"]+)['"]/);
    return { textoKey: tkM ? tkM[1] : null };
}

// ============================================================
// COLETA DE DADOS
// ============================================================

const htmlsSessao = fs.readdirSync(ROOT).filter(f =>
/^[a-z][a-z0-9-]*\.html$/.test(f) && f !== 'index.html'
);
const htmlsEspeciais = ['index.html'].filter(f => fs.existsSync(path.join(ROOT, f)));
const htmlsTodos = htmlsSessao.concat(htmlsEspeciais);

const scriptJs = ler('script.js');
const sessoes = extrairSessoes(scriptJs);
const funcoesScript = extrairFuncoes(scriptJs);
const mapaOrigem = extrairMapaOrigem(scriptJs);

const appsRemoviveis = {};
const abrirRegistros = {};
Object.assign(appsRemoviveis, extrairChamadasRegistrar(scriptJs, 'registrarAppRemovivel'));
Object.assign(abrirRegistros, extrairChamadasRegistrar(scriptJs, '_registrarAbrir'));

const locales = {
    en: lerJSON('locales/en.json'),
                                                                  es: lerJSON('locales/es.json')
};

const porHtml = {};
const funcoesHtml = new Set();
const dataComandosTodos = new Set();
const contagemDataComando = {};

for (const arq of htmlsTodos) {
    const texto = ler(arq);
    const dataComandos = extrairDataComandos(texto);
    const onclicks = extrairOnclicks(texto);
    const { logboxes, ids } = extrairLogboxEIds(texto);
    const funcoes = extrairFuncoes(texto);

    porHtml[arq] = { dataComandos, onclicks, logboxes, ids, funcoes };

    funcoes.forEach(f => funcoesHtml.add(f));

    Object.assign(appsRemoviveis, extrairChamadasRegistrar(texto, 'registrarAppRemovivel'));
    Object.assign(abrirRegistros, extrairChamadasRegistrar(texto, '_registrarAbrir'));

    for (const dc of dataComandos) {
        dataComandosTodos.add(dc);
        if (!contagemDataComando[dc]) contagemDataComando[dc] = [];
        contagemDataComando[dc].push(arq);
    }
}

const comandosConhecidos = new Set();
for (const cmds of Object.values(sessoes)) {
    for (const c of cmds) comandosConhecidos.add(c);
}

const funcoesConhecidas = new Set([...funcoesScript, ...funcoesHtml]);

// ============================================================
// REGRA 1 — data-comando no HTML existe em SESSOES
// ============================================================

const EXCECOES_TRANSIENTES = new Set([
    'resetar-progresso-fap',
    'changelog-completo'
]);

for (const [arq, dados] of Object.entries(porHtml)) {
    for (const dc of dados.dataComandos) {
        if (FILTRO_DATA_COMANDO_DINAMICO.test(dc)) continue;
        if (IDS_DINAMICOS_CONHECIDOS.has(dc)) continue;
        if (dc.startsWith('open-')) continue;
        if (dc.startsWith('abrir-')) continue;
        if (EXCECOES_TRANSIENTES.has(dc)) continue;
        if (!comandosConhecidos.has(dc)) {
            erros.push(`${arq}: data-comando="${dc}" não está em SESSOES (script.js)`);
        }
    }
}

// ============================================================
// REGRA 2 — idComando em SESSOES tem botão no HTML
// ============================================================

const SESSOES_FLAGS_PUROS = new Set([
    'nvidia-secureboot-prepare',
    'pos-upgrade-concluido'
]);

for (const idComando of comandosConhecidos) {
    if (SESSOES_FLAGS_PUROS.has(idComando)) continue;
    if (PARES_TOGGLE_SEM_BOTAO_HTML.has(idComando)) continue;
    if (IDS_DINAMICOS_CONHECIDOS.has(idComando)) continue;
    if (!dataComandosTodos.has(idComando)) {
        erros.push(`SESSOES: idComando "${idComando}" não tem botão em nenhum HTML`);
    }
}

// ============================================================
// REGRA 3 — onclick referencia função definida
// ============================================================

const BUILTINS = new Set([
    'alert', 'confirm', 'prompt', 'console', 'document', 'window',
    'location', 'event', 'this', 'self', 'top', 'parent',
    'parseInt', 'parseFloat', 'Number', 'String', 'Boolean',
    'eval', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'fetch', 'JSON', 'Math', 'Date', 'Array', 'Object',
    'Promise', 'CustomEvent', 'Event', 'RegExp',
    'encodeURIComponent', 'decodeURIComponent',
    'isNaN', 'isFinite', 'undefined', 'null',
    'void', 'typeof', 'instanceof', 'in', 'of',
    'I18N'
]);

for (const [arq, dados] of Object.entries(porHtml)) {
    for (const fn of dados.onclicks) {
        if (BUILTINS.has(fn)) continue;
        if (funcoesConhecidas.has(fn)) continue;
        if (fn.includes('.')) continue;
        erros.push(`${arq}: onclick="${fn}(...)" — função não definida em script.js nem no próprio HTML`);
    }
}

// ============================================================
// REGRA 4 — data-logbox aponta para id existente no mesmo HTML
// ============================================================

for (const [arq, dados] of Object.entries(porHtml)) {
    for (const lb of dados.logboxes) {
        if (dados.ids.has(lb)) continue;
        const whitelistLog = LOG_DINAMICO_ESPERADO[arq];
        if (whitelistLog && whitelistLog.has(lb)) continue;
        erros.push(`${arq}: data-logbox="${lb}" não existe como id no mesmo arquivo`);
    }
}

// ============================================================
// REGRA 5 — registrarAppRemovivel bem-formado
// ============================================================

for (const [id, bloco] of Object.entries(appsRemoviveis)) {
    const info = analisarAppRemovivel(bloco);
    if (!info.nome) {
        erros.push(`registrarAppRemovivel('${id}') sem "nome"`);
    }
    const temIdentificador =
    info.appId ||
    (Array.isArray(info.pacotes) && info.pacotes.length > 0) ||
    info.temComandoRemocao;
    if (!temIdentificador) {
        erros.push(`registrarAppRemovivel('${id}') sem appId, pacotes[] ou comandoRemocao`);
    }
    if (info.tipo === 'flatpak' && !info.appId) {
        erros.push(`registrarAppRemovivel('${id}') tipo flatpak sem appId`);
    }
    if (info.tipo === 'dnf' && !info.temComandoRemocao &&
        (!Array.isArray(info.pacotes) || info.pacotes.length === 0)) {
        erros.push(`registrarAppRemovivel('${id}') tipo dnf sem pacotes[] e sem comandoRemocao`);
        }
}

// ============================================================
// REGRA 6 — _registrarAbrir tem textoKey em en.json + es.json
// ============================================================

for (const [id, bloco] of Object.entries(abrirRegistros)) {
    const info = analisarAbrirRegistro(bloco);
    if (!info.textoKey) {
        avisos.push(`_registrarAbrir('${id}') sem textoKey`);
        continue;
    }
    for (const [lang, dados] of Object.entries(locales)) {
        if (!temChave(dados, info.textoKey)) {
            erros.push(`_registrarAbrir('${id}') textoKey "${info.textoKey}" ausente em locales/${lang}.json`);
        }
    }
}

// ============================================================
// REGRA 7 — data-comando é único em todos os HTMLs
// ============================================================

for (const [dc, arquivos] of Object.entries(contagemDataComando)) {
    if (FILTRO_DATA_COMANDO_DINAMICO.test(dc)) continue;
    const unicos = new Set(arquivos);
    if (unicos.size > 1) {
        erros.push(`data-comando="${dc}" duplicado em: ${[...unicos].join(', ')}`);
    }
}

// ============================================================
// SAÍDA
// ============================================================

const totalBotoes = dataComandosTodos.size;
const totalSessoes = Object.keys(sessoes).length;
const totalFuncoes = funcoesConhecidas.size;
const totalApps = Object.keys(appsRemoviveis).length;
const totalAbrir = Object.keys(abrirRegistros).length;

if (avisos.length > 0) {
    console.log(`  ${COR_AMARELA}AVISOS${COR_RESET} (não bloqueiam):`);
    for (const a of avisos) console.log(`    - ${a}`);
}

if (erros.length > 0) {
    console.log(`  ${COR_VERMELHA}ERROS${COR_RESET}:`);
    for (const e of erros) console.log(`    - ${e}`);
    console.log(`  ${COR_VERMELHA}FALHOU${COR_RESET}: ${erros.length} erro(s) encontrado(s).`);
    process.exit(1);
}

console.log(`  ${COR_VERDE}OK${COR_RESET}: ${totalBotoes} data-comando, ${totalSessoes} sessões, ${totalFuncoes} funções`);
console.log(`  ${COR_VERDE}OK${COR_RESET}: ${totalApps} registrarAppRemovivel, ${totalAbrir} _registrarAbrir`);
console.log(`  ${COR_VERDE}OK${COR_RESET}: 0 duplicatas de data-comando`);
process.exit(0);
