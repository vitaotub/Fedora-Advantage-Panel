#!/usr/bin/env node
// Validador estático de estrutura HTML das sessões (v1.6.2).
// Pega o que o navegador "conserta em silêncio": <div>/<details>/<section>
// sem fechamento (um bloco aninhado dentro do outro herda o estilo errado
// e some do layout esperado). Ignora <script>, <style> e comentários.
// Zero dependências. Saída ≠ 0 se achar algo.
'use strict';
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const arquivos = fs.readdirSync(raiz).filter(f => /^[a-z][a-z0-9-]*\.html$/.test(f));
const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr', 'param']);
let falhas = 0;
for (const arq of arquivos) {
    const bruto = fs.readFileSync(path.join(raiz, arq), 'utf8');
    // Troca por espaços (preserva as quebras de linha) para manter a numeração.
    const limpo = bruto.replace(/<!--[\s\S]*?-->|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,
        m => m.replace(/[^\n]/g, ' '));
    const pilha = [];
    const erros = [];
    const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
    let m;
    while ((m = re.exec(limpo))) {
        const fecha = m[1] === '/', tag = m[2].toLowerCase(), auto = m[3] === '/';
        if (VOID.has(tag) || auto) continue;
        const linha = limpo.slice(0, m.index).split('\n').length;
        if (!fecha) { pilha.push({ tag, linha }); continue; }
        let i = pilha.length - 1;
        while (i >= 0 && pilha[i].tag !== tag) i--;
        if (i < 0) { erros.push('fechamento sobrando </' + tag + '> (linha ' + linha + ')'); continue; }
        for (const x of pilha.splice(i).slice(1)) erros.push('<' + x.tag + '> da linha ' + x.linha + ' não foi fechado');
    }
    for (const x of pilha) erros.push('<' + x.tag + '> da linha ' + x.linha + ' não foi fechado');
    if (erros.length) { falhas++; console.log('  ❌ ' + arq + ':\n     ' + erros.slice(0, 8).join('\n     ')); }
}
if (falhas) { console.log('❌ ' + falhas + ' arquivo(s) com HTML desbalanceado.'); process.exit(1); }
console.log('  OK: ' + arquivos.length + ' arquivos HTML com tags balanceadas');
