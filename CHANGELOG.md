# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> Use apenas `## vX.Y.Z-...` para os cabeçalhos de versão. Dentro de uma
> seção, use `###` para subseções — um `##` no meio encerra a captura.
> **Versões anteriores ficam nas releases do GitHub.** Este arquivo contém
> apenas a seção da versão atual.

---

## v1.5.7-11082026

Correção cosmética no `server.js`. O `curl -I` envia `HEAD`, não `GET` — e a versão anterior só tratava `GET` nos arquivos estáticos e nos locales. O `HEAD` caía no handler de 404 (que retorna `text/plain`), enganando ferramentas de debug: `curl -I /script.js` mostrava `Content-Type: text/plain; charset=utf-8` em vez de `application/javascript`. O navegador (WebKitGTK) usa `GET` e funcionava normalmente — o bug era só cosmético. Esta versão também adiciona `Content-Length` nos headers de resposta (obrigatório pela RFC 9110 para `HEAD`; útil em `GET` para o navegador saber o tamanho antes de baixar). É a primeira versão publicada após o ciclo de correções da v1.5.6 (falso positivo do Secure Boot, fastfetch poluindo o `_exec`, reset atômico no install, desinstalar completo, `fap-cleanup.sh`).

### 🟢 Melhorado

- **`server.js` → arquivos estáticos aceitam `HEAD` + `Content-Length`.** O `curl -I` envia `HEAD`, não `GET`. A versão anterior só tratava `GET` nos arquivos estáticos e nos locales, então o `HEAD` caía no handler de 404 (que retorna `text/plain`). Sintoma: `curl -I /script.js` mostrava `Content-Type: text/plain; charset=utf-8` em vez de `application/javascript`. O navegador usa `GET` e funcionava normalmente — o bug era só cosmético (ferramentas de debug enganadas). Correção:
  - **Helper `_aceitaGetOuHead(req)`** substitui `req.method === 'GET'` em todos os handlers de arquivos estáticos + locales (8 handlers: `/`, `/index.html`, `/guiado.html`, `/<sessao>.html`, `/style.css`, `/script.js`, `/i18n.js`, `/icone_app.png`, `/favicon.ico`, e `/locales/<lang>.json`).
  - **`servirArquivoEstatico`** agora respeita `HEAD` (envia só headers, sem body) e inclui `Content-Length` em todas as respostas (200 e 404).
  - **`servirLocale`** idem: `HEAD` sem body + `Content-Length` em 200/403/404.
  - **`_aceitaGetOuHead`** é uma função pura, sem efeitos colaterais, alinhada com a RFC 9110 (servidores DEVEM responder a `HEAD` com os mesmos headers de `GET`, sem o body).

### ✅ Validação empírica (VM Fedora 44)

- **`make check-basico`:** todos os 10 checks passam (sintaxe JS, sintaxe Bash, JSON, CHANGELOG vs package.json, `_MAPA_ORIGEM`, chaves i18n, `_meta.lang`, DNF5).
- **`node --check server.js`:** OK.
- **`curl -I http://localhost:3000/script.js`:** `HTTP/1.1 200 OK` + `Content-Type: application/javascript; charset=utf-8` + `Content-Length: <tamanho real>` (antes: `Content-Type: text/plain; charset=utf-8`, sem `Content-Length`).
- **`curl -I http://localhost:3000/style.css`:** `Content-Type: text/css; charset=utf-8`.
- **`curl -I http://localhost:3000/index.html`:** `Content-Type: text/html; charset=utf-8`.
- **`curl -I http://localhost:3000/locales/en.json`:** `Content-Type: application/json; charset=utf-8`.
- **`GET` continua funcionando:** `curl -s http://localhost:3000/script.js | head -c 50` retorna `/**` (início do arquivo, sem regressão).
- **404 (HEAD e GET):** `curl -I http://localhost:3000/nao-existe.js` retorna `HTTP/1.1 404` + `Content-Type: text/plain; charset=utf-8` + `Content-Length`.
- **Chave MOK e `/etc/chromium/master_preferences`:** preservados (não tocados pela correção).

### 🧪 Requisito

- **Fedora 44 ou 45.** Foco ativo em **Fedora 45 e futuras versões**. Fedora 44 é mantido como legado (o código continua funcionando, mas não fazemos mais testes ativos nele).

### 📌 Pendências de teste (registrar em issues)

- **`curl -I` em `HEAD` no fgc** — confirmar que `Content-Type` de `/script.js` é `application/javascript; charset=utf-8` (antes era `text/plain`). Idem para `/style.css`, `/index.html`, `/locales/en.json`.
- **`Content-Length` em `HEAD` no fgc** — confirmar que o tamanho retornado bate com `wc -c < arquivo`.
- **`GET` não regrediu** — abrir o FAP pelo menu, confirmar que a UI carrega normalmente (script.js, style.css, locales).
- **`404` (HEAD e GET)** — `curl -I http://localhost:3000/nao-existe.js` retorna 404 com `text/plain`.
- **Demais pendências da v1.5.6** — ver release notes da v1.5.6 no GitHub (testes de `install.sh --update`, `install.sh --uninstall`, `scripts/fap-cleanup.sh` em hardware real; cenários de Secure Boot com chave local não enrolled + nenhum akmod carregado; etc.).
