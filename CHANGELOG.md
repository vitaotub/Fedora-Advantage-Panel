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

## v1.5.3-11072026

Bugfix pós-publicação da v1.5.2. Testes em hardware real (RTX 5060 / GB206 / Fedora 45 / KDE Wayland / RTX 5060 do `fgc`) revelaram **dois bugs** no mecanismo de atualização e no badge flutuante. **Bug 1 (🟡 `install.sh` → `_matar_servidor_fap_antigo`):** o helper usava `lsof -t -i:3000 | head -1` sem filtro — `lsof -i:3000` retorna **toda** conexão com a porta, incluindo o `fap-container` (WebKit) que tem conexões ESTABLISHED com o servidor. O `head -1` podia devolver o PID do container em vez do node. Sintoma em teste real: o usuário clicava em "Atualizar", o WebKit era finalizado (via `pkill -f "fap-container.*--url ..."` do próprio helper), mas o node **sobrevivia** com o código antigo em memória — e o `git pull` do `install.sh` **não tinha feito update** do `package.json` no disco (o server antigo lia `version` do package.json em runtime, mas o código do `hardware-service.js` antigo continuava em memória). Ao reabrir o FAP, ele falava com o servidor antigo, via v1.5.0 no rodapé, e o badge "enrollment necessário" continuava aparecendo mesmo com o MOK enrolled. **Bug 2 (🟡 `index.html` + `style.css` + `script.js`):** o `.badge-atualizacao` só estava definido em `style.css`, mas `index.html` **não carregava** `style.css` — só tinha `<style>` inline. Resultado: o badge era criado (o handler de click funcionava), mas sem CSS virava um `<button>` nativo do WebKitGTK (o "traço" reportado em teste real). Além disso, o badge era `position: absolute; top: -8px; right: -8px` dentro do `.version-badge` — colado na versão, não flutuando no canto. O usuário pediu explicitamente: "gostaria que o badge de atualização ficasse flutuante no canto superior direito do fap o tempo todo até que o usuário clique e faça a atualização". **Fix A (🟡):** o helper `_matar_servidor_fap_antigo` ganhou `-sTCP:LISTEN` no `lsof` (filtra apenas o socket em LISTEN, nunca ESTABLISHED) e o `pkill` do container foi movido para ANTES do `lsof` (elimina a possibilidade de o `lsof` devolver o PID do container, mesmo com o filtro — é defesa em profundidade). **Fix B1 (🟡):** `index.html` ganhou `<link rel="stylesheet" href="style.css">` antes do `<style>` inline (CSS global de `.badge-atualizacao`, `.fap-toast-container`, `.fap-toast` e outros). **Fix B2 (🟡):** `.badge-atualizacao` mudou de `position: absolute; top: -8px; right: -8px` para `position: fixed; top: 16px; right: 16px; z-index: 99999` (ancorado no viewport, visível em qualquer tela, independente do scroll); `body.fap-tem-badge-atualizacao .header-controles { padding-right: 56px; }` empurra os controles do `guiado.html` para a esquerda (senão o badge sobrepõe o botão "voltar"). **Fix B3 (🟡):** `mostrarBadgeSeHouverAtualizacao` mudou de `parent.insertBefore(badge, el.nextSibling)` para `document.body.appendChild(badge)` + `document.body.classList.add('fap-tem-badge-atualizacao')` (badge não pertence ao DOM de `.version-badge`); guarda contra duplicata (`if (document.querySelector('.badge-atualizacao')) return;`) para o caso de a função rodar 2×. **Fix B4 (🟡):** `_dispararAtualizacaoFAP` desabilita o badge no início (feedback visual), remove o badge + `fap-tem-badge-atualizacao` no `_finalizar(sucesso === true)` (o badge só faz sentido enquanto há update pendente), e reabilita no `_finalizar(sucesso === false)` (usuário pode tentar de novo). **Nenhuma chave i18n nova, nenhuma alterada.**

### 🟡 Corrigido

- **`install.sh` → `_matar_servidor_fap_antigo`** — `lsof -t -i:3000 | head -1` sem filtro de estado. O `fap-container` (WebKit) mantém conexões ESTABLISHED com o servidor durante toda a sessão, e o `lsof` retorna **todas** as conexões (LISTEN + ESTABLISHED). O `head -1` podia devolver o PID do container, não do node. O `case *node*server.js*` então não casava, e o node sobrevivia ao `--update` — com o código antigo em memória (incluindo o `hardware-service.js` sem o campo `secure_boot_mok`). Sintoma em teste real: o usuário clicava em "Atualizar", o WebKit fechava (via `pkill`), mas ao reabrir o FAP, ele continuava na versão antiga. **Fix:** `lsof -t -i:3000 -sTCP:LISTEN` (filtra apenas o socket LISTEN — o servidor HTTP, nunca clientes). O `pkill` do container também foi movido para **antes** do `lsof` (defesa em profundidade — se o container já morreu, o `lsof` só vê o node).

- **`index.html` → `<head>`** — a landing page não carregava `style.css` (só tinha `<style>` inline). O `.badge-atualizacao` está definido apenas em `style.css`, então o badge era criado pelo `script.js` mas sem CSS — virava um `<button>` nativo do WebKitGTK (o "traço" reportado em teste real). Os `.fap-toast-container` e `.fap-toast` também ficavam sem estilo na landing. **Fix:** adicionado `<link rel="stylesheet" href="style.css">` **antes** do `<style>` inline. A ordem importa: ambos definem `body`, `:root` e `.container`; como o inline é carregado depois, ele vence nas propriedades em comum (o `align-items: flex-start` e o `padding: 2rem 1rem` da landing não são sobrescritos pelo `padding: 2rem` do `style.css`).

- **`style.css` → `.badge-atualizacao`** — o badge era `position: absolute; top: -8px; right: -8px; z-index: 10`, posicionado relativo ao `.version-badge` (que é `position: relative`). Ficava colado na versão, não flutuando no canto. **Fix:** `position: fixed; top: 16px; right: 16px; z-index: 99999` — ancorado no viewport, visível em qualquer tela, independente do scroll e da página. O `z-index: 99999` é o mesmo do `.fap-toast-container` — garante que o badge e os toasts fiquem acima de qualquer modal/overlay.

- **`script.js` → `mostrarBadgeSeHouverAtualizacao`** — o badge era inserido via `parent.insertBefore(badge, el.nextSibling)`, onde `parent` é o `.version-badge` da landing (ou o header do guided). Com `position: absolute`, isso funcionava; com `position: fixed`, funciona visualmente mas o badge fica semanticamente no DOM errado (dentro do `.version-badge`, que é `inline-block`). **Fix:** `document.body.appendChild(badge)` + `document.body.classList.add('fap-tem-badge-atualizacao')`. O guard `if (document.querySelector('.badge-atualizacao')) return;` evita duplicata se a função rodar 2× (ex.: `carregarVersaoServidor` chamada de novo após `_dispararAtualizacaoFAP`).

- **`script.js` → `_dispararAtualizacaoFAP`** — o badge não dava feedback de "em andamento" (só o `btnSobre` da Sessão 13 era desabilitado). Em caso de erro, o badge ficava clicável (mas o `_atualizacaoEmAndamento` barrava logicamente). Em caso de sucesso, o badge **não era removido** — ficava flutuando mesmo depois do update. **Fix:** (a) `badge.disabled = true` + `opacity: 0.5` no início (feedback visual); (b) remoção do badge + `fap-tem-badge-atualizacao` no `_finalizar(sucesso === true)` (o badge só faz sentido enquanto há update pendente — depois, o próximo boot já é a versão nova); (c) reabilitação no `_finalizar(sucesso === false)` (usuário pode tentar de novo).

### ✅ Validação empírica (RTX 5060 / GB206 / Fedora 45 / KDE Wayland / `fgc`)

- **Update flow:** `fap` (v1.5.2) → clicar no badge flutuante → confirmar → aguardar o toast "Update completed" → badge desaparece → WebKit fecha (via `pkill` do install.sh) → `pgrep -f "node server.js"` retorna vazio (node morto) → reabrir `fap` → v1.5.3 no rodapé. Antes (v1.5.2): WebKit fechava, node sobrevivia, ao reabrir continuava v1.5.0 (ou v1.5.2 no disco, mas servidor v1.5.0 em memória).
- **Badge na landing:** `fap` → landing page → badge flutuante visível no canto superior direito (não colado na versão). Antes (v1.5.2): "traço" de `<button>` nativo do WebKitGTK.
- **Badge no guided:** `fap` → Sessão 1 → badge flutuante no canto, não sobrepõe o botão "voltar" (padding-right de 56px no `.header-controles`). Antes (v1.5.2, sem o fix): sobrepunha.
- **`make check-basico`:** todos os 8 checks passam.

### 🧪 Requisito

- **Fedora 44 ou 45.**

### 📌 Pendências de teste (registrar em issues)

- **Update `--update` em hardware real com `fgc`:** validar o fluxo completo (badge → click → toast → WebKit fecha → node morre → reabrir em v1.5.3). Teste pendente em RTX 5060 (o `fgc` reportou os sintomas da v1.5.2, mas não testou a v1.5.3).
- **Badge flutuante em EN/ES:** validar que o `title` e o `aria-label` traduzem corretamente (`comum.atualizacao_disponivel_titulo`).
- **Badge flutuante + `fap-tem-badge-atualizacao`:** validar que o `padding-right: 56px` no `.header-controles` não quebra o layout em telas pequenas (mobile ~640px).
- **Badge em `index.html` pós-Fix B1:** validar visualmente que o badge aparece no canto superior direito (não mais "traço"), e que `.fap-toast-container`/`.fap-toast` também ficam estilizados.
- **Demais pendências da v1.5.2 e v1.5.1 permanecem válidas** — ver release notes anteriores.
