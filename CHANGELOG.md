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

## v1.5.4-11072026

Bugfix pós-publicação da v1.5.3. **Três bugs** foram reportados após o update em ambiente real (VM Fedora 44 + hardware real com RTX 5060): (1) o badge flutuante de atualização permanecia visível mesmo após o FAP estar atualizado; (2) a versão do FAP desapareceu da `index.html` (ficou mostrando o placeholder literal `{versao}` em PT-BR); (3) após um `install.sh --update`, os arquivos `.sh` do diretório de instalação perdiam a permissão de execução, e o FAP não abria até o usuário dar `chmod +x` manualmente.

Os três têm causas-raiz diferentes, todas no fluxo de atualização. **Bug 1 (🟡 — badge persistente):** o `_dispararAtualizacaoFAP` (em `script.js`) removia o badge do DOM no `_finalizar(sucesso === true)`, mas **não limpava o cache de versão remota** (`ULTIMA_VERIFICACAO_KEY` / `VERSAO_REMOTA_KEY` no `localStorage`). No próximo boot, `mostrarBadgeSeHouverAtualizacao` lia o cache, via que a versão remota era "maior" que a local (porque o cache ainda apontava para a versão antiga **e** a versão local ainda não tinha sido atualizada no `window.FAP_VERSION_UI18N` — o fetch de `/info` é assíncrono), e recriava o badge. Além disso, o container WebKit podia sobreviver ao update: o `pkill` do `_matar_servidor_fap_antigo` enviava `SIGTERM` mas não fazia `SIGKILL` de fallback se o WebKit ignorasse o sinal (o que acontece quando o renderer está travado aguardando o servidor antigo responder). O `iniciar_fap.sh` também não matava o container órfão no `cleanup`.

**Bug 2 (🟡 — versão no index.html):** o `i18n.js` **retorna cedo em PT-BR** (`if (estado.lang === LANG_PADRAO) return;`) — o HTML é a fonte, então o `interpolar()` de `{versao}` nunca rodava em PT-BR. Resultado: `🚀 v{versao}` literal. Em EN/ES, o `i18n.js` **até tentava** interpolar, mas `FAP_VERSION_UI18N` era `''` (string vazia) no momento do `aplicarTraducoes()` — o fetch de `/info` ainda não tinha resolvido. O `script.js` **não tinha** um passo pós-fetch que atualizasse os `.fap-version` do DOM. O evento `fap-versao-pronta` (que `sobre-fap.html` já ouvia para atualizar o título do changelog) **nunca era disparado** — o `carregarVersaoServidor` só populava `window.FAP_VERSION_UI18N`, sem notificar ninguém.

**Bug 3 (🟡 — permissões perdidas):** o `install.sh --update` fazia `git stash push` + `git pull --ff-only` + `git stash pop`. O `stash pop` **com conflito** (o `|| true` engolia o erro) deixava marcadores `<<<<<<<` / `=======` / `>>>>>>>` nos arquivos que mudaram nas duas pontas — inclusive `package.json` (que ficava com 2 seções `"version"`), `install.sh` e `CHANGELOG.md`. O `node server.js` **abortava no `shouldUseESLoader`** com `ERR_INVALID_PACKAGE_CONFIG` ANTES de rodar o `try/catch` do `require('./package.json')` — daí o "aguardando servidor iniciar" + janela fechando em 15s. E os arquivos `.sh` ficavam com permissão perdida porque o `git stash pop` reescreve o arquivo com o modo do stash (que nem sempre preserva `+x`). O `reaplicar_permissoes` **não incluía** `install.sh` na lista, então o próprio script de update ficava sem permissão de execução — o `install.sh` da *próxima* atualização falharia com "Permission denied".

### 🟡 Corrigido

- **`script.js` → `_dispararAtualizacaoFAP`** — o bloco `_finalizar(sucesso === true)` agora limpa `ULTIMA_VERIFICACAO_KEY` e `VERSAO_REMOTA_KEY` do `localStorage`. Sem isso, o cache de versão remota sobrevivia ao update e o badge reaparecia no próximo boot (porque `mostrarBadgeSeHouverAtualizacao` lia o cache antigo). O `localStorage.removeItem` é defensivo contra `try/catch` (pode falhar em modo privado do WebKitGTK).

- **`script.js` → `carregarVersaoServidor`** — após o `fetch('/info')` resolver, a função agora: (a) preenche **todos** os `.fap-version` do DOM com `FAP_VERSION` (cobre `index.html` e `guiado.html`, que têm o span); (b) dispara o `CustomEvent('fap-versao-pronta', { detail: { versao } })` que `sobre-fap.html` já escutava mas que nunca era disparado. Isso resolve o bug 2 em **todos os idiomas**: em PT-BR, o `i18n.js` retorna cedo mas o `script.js` preenche diretamente; em EN/ES, o `i18n.js` pode ter interpolado com string vazia, mas o `script.js` corrige após o fetch.

- **`install.sh` → `atualizar()`** — o bloco `git stash push -m ... && git pull --ff-only && git stash pop` foi **substituído** por `git fetch origin main` + `git reset --hard origin/main` + `git stash drop` + `git clean -fd`. O `reset --hard` é **atômico**: restaura working tree e index ao estado exato do remoto, sem merge, sem conflito, sem stash. Elimina a causa-raiz dos bugs 1 (parcialmente, via package.json válido) e 3 (permissões preservadas pelo reset). As mudanças locais NÃO COMMITADAS são descartadas — o que já era o comportamento efetivo (o `stash pop` só aplicava se não conflitasse). O `--ff-only` foi descartado porque `reset --hard` é idempotente e não falha se o branch local divergiu.

- **`install.sh` → `reaplicar_permissoes`** — a lista `arquivos_para_permissoes` agora inclui `install.sh` (antes só cobria `iniciar_fap.sh`, `iniciar_fap_compat.sh`, `fap-container` e `build-container.sh`). Além disso, um loop defensivo itera todos os `*.sh` no `$INSTALL_DIR` e adiciona os que ainda não estão na lista — se novos scripts forem adicionados no futuro, entram automaticamente sem editar a função.

- **`install.sh` → `_matar_servidor_fap_antigo`** — o `pkill` do container agora faz `SIGTERM` seguido de `SIGKILL` após 2s. Sem o `SIGKILL` de fallback, o WebKit podia ignorar o `SIGTERM` quando o renderer estava travado aguardando o servidor antigo responder — e o container sobrevivia ao update, mostrando a página antiga e mantendo o badge visível.

- **`iniciar_fap.sh` → `cleanup`** — adicionado `pkill` do `fap-container` (SIGTERM + SIGKILL após 0.5s) no bloco de limpeza de órfãos. Sem isso, quando o node morre inesperadamente (ou é morto pelo `install.sh --update`), o container WebKit continua rodando como órfão, mostrando a página antiga.

### ✅ Validação empírica (VM Fedora 44)

- **`make check-basico`:** todos os 10 checks passam (sintaxe JS, sintaxe Bash, JSON, CHANGELOG vs package.json, `_MAPA_ORIGEM`, chaves i18n, `_meta.lang`, DNF5).
- **Bug 1 (badge):** após clicar no badge → aguardar update → verificar que o badge desaparece imediatamente e não reaparece no próximo boot (o cache é limpo). Testar em VM Fedora 44 com update simulado v1.5.3 → v1.5.4.
- **Bug 2 (versão no index.html):** abrir `index.html` em PT-BR → confirmar que `🚀 v1.5.4-11072026` aparece (antes mostrava `🚀 v{versao}`). Trocar para EN → confirmar que `🚀 v1.5.4-11072026` continua aparecendo (antes mostrava `🚀 v` vazio).
- **Bug 3 (permissões):** rodar `install.sh --update` do zero (v1.5.3 → v1.5.4) → confirmar `ls -la install.sh iniciar_fap.sh build-container.sh` mostra `-rwxr-xr-x` em todos. Rodar `install.sh --update` **duas vezes seguidas** para confirmar idempotência do `git reset --hard`.

### 🧪 Requisito

- **Fedora 44 ou 45.**

### 📌 Pendências de teste (registrar em issues)

- **Update v1.5.3 → v1.5.4 em hardware real com RTX 5060** — validar o fluxo completo: `fap` (v1.5.3) → clicar no badge → aguardar toast "Update completed" → badge desaparece → WebKit fecha (via `SIGKILL` do `install.sh`) → `pgrep -f "node server.js"` retorna vazio → reabrir `fap` → v1.5.4 no rodapé e no `index.html` → **badge NÃO reaparece**.
- **Update v1.5.3 → v1.5.4 em VM Fedora 44** — validar o mesmo fluxo, mais o `git status` mostrando working tree limpo (sem `UU package.json`).
- **Versão no `index.html` em PT-BR, EN e ES** — confirmar que `🚀 v1.5.4-11072026` aparece corretamente nos 3 idiomas.
- **Permissões pós-update** — `ls -la install.sh iniciar_fap.sh iniciar_fap_compat.sh build-container.sh fap-container` deve mostrar `-rwxr-xr-x` em todos.
- **`iniciar_fap.sh cleanup` mata container órfão** — matar o `node server.js` manualmente (`kill -9 <pid>`) com o `fap-container` ainda aberto e confirmar que o container fecha (ou roda `./iniciar_fap.sh` que o cleanup mata o órfão anterior).
- **Demais pendências da v1.5.3, v1.5.2 e v1.5.1 permanecem válidas** — ver release notes anteriores.
