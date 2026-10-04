# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e o FOF usa versionamento baseado em data: `v1.0.0-MMDDAAAA`.

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FOF, na sessão **Sobre o FOF**.

> **Regra importante para quem for editar:** use apenas `## vX.Y.Z-...` para os
> cabeçalhos de versão. Dentro de uma seção, use `###` (três hashes) para
> subseções — um `##` no meio de uma versão encerra a captura do parser e o
> resto é descartado silenciosamente.
>
> **Sobre versões antigas:** este arquivo guarda apenas a seção da versão
> atual. O histórico completo fica disponível nas
> [releases do GitHub](https://github.com/vitaotek/Fedora-Only-Fans/releases).

---

## v1.0.0-10012026.b

### 🎨 Renomeação do projeto

O projeto passa a se chamar **Fedora Advantage Panel (FAP)**. O identificador
técnico (`fof`, `fof-container`, comando `fof`) permanece o mesmo por
compatibilidade com instalações existentes. Um novo logo substitui o anterior.

- Todos os textos visíveis ao usuário atualizados nos três idiomas.
- Repositório renomeado no GitHub para `vitaotek/Fedora-Advantage-Panel`.
- URLs internas (`GITHUB_REPO`, `REPO_URL`, links de changelog e issues) atualizadas.
- Nenhuma mudança de comportamento — a atualização preserva progresso, tema e idioma.

---

## v1.0.0-10012026.a

Atualização focada em **padronização visual**, **correções de bugs** e **segurança**.
Nenhuma mudança quebra compatibilidade com a versão anterior.

### 🎨 Padronização visual dos botões

Todo o esquema de cores dos botões do FOF foi redesenhado para ter significado
semântico consistente em todas as 14 sessões:

- **Azul** — ação principal (instalar, aplicar, atualizar, detectar, configurar, ativar). É a cor da grande maioria dos botões.
- **Verde** — abrir aplicativo (botões "Abrir X", que aparecem apenas após a instalação).
- **Vermelho** — remover, reverter, desinstalar, desativar.
- **Vermelho com borda tracejada** — ações irreversíveis (Desinstalar FOF, Remover repositório Fedora Flatpak, Remover Waydroid completamente).

Classes obsoletas removidas do CSS: `.ativo`, `.roxo`, `.laranja`, `.azul-claro`,
`.verde-escuro`, `.cinza`. Botão cinza agora significa **exclusivamente** botão
desabilitado (aplicado automaticamente por `:disabled`).

Corrige também a percepção de "cores trocadas" no toggle de Overclock (AMD): o
botão **Desativar** agora fica vermelho quando habilitado (antes ficava cinza e
se confundia com o estado desabilitado).

### 🐛 Correções

- **Badge de atualização** — o botão no canto superior direito do cartão de versão agora mostra apenas o ícone (uma seta de download dentro de um círculo), sem texto, sobreposto ao campo da versão. Antes, o texto "Atualizar" esticava o badge horizontalmente e quebrava o layout.
- **Toast de notificação** — o toast que aparece no canto superior direito não empurra mais o conteúdo da página para a esquerda. Agora é um overlay full-viewport com `pointer-events: none` no container.
- **Deep-link `guiado.html?session=X`** — abrir uma sessão específica via URL com query string funcionava apenas no primeiro carregamento. Agora qualquer `?session=<id>` abre a sessão correta.
- **Crash ao clicar no badge de atualização** — o `POST /executar` chamava `_podeExecutar(idComando)` e `procederComExecucao(...)` **fora** do `req.on('end', ...)`. Sem o body lido, `idComando` era `undefined`, o Node lançava `ReferenceError` e o servidor morria. Corrigido — toda a lógica roda dentro do `req.on('end')`, depois do `JSON.parse`.
- **`Ctrl+C` não matava processos filhos** — ao fechar o servidor durante um `dnf upgrade`, o processo continuava rodando como órfão. Agora o `server.js` rastreia os filhos com `_processosAtivos` e os mata em grupo no `SIGINT`, usando `detached: true` no `spawn`/`exec` + `process.kill(-pid, 'SIGTERM')`.
- **Buffer SSE entre execuções** — uma segunda execução do mesmo `idComando` em menos de 10 segundos recebia o replay da primeira. Agora o buffer é limpo no início de cada `POST /executar`.
- **Tela preta no carregamento de sessão** — quando `guiado.html` disparava dois carregamentos concorrentes, a race condition deixava o container em branco. Agora existe um token de geração que cancela carregamentos antigos.
- **Notas de hardware não traduzidas** — os textos descritivos dos cartões de detecção (GPU, Wi-Fi, Ethernet) estavam hardcoded em pt-BR. Agora são lidos do `hardware_map.json` via `notesKey`, com traduções completas em EN e ES.
- **POST duplicado em `/progress`** — cada comando bem-sucedido disparava dois POSTs para `/progress`. Agora dispara apenas um.
- **"✅ Nada a remover" do Waydroid em pt-BR** — o texto agora é traduzido (EN: "Nothing to remove"; ES: "Nada que eliminar").
- **Endpoint `/kernel-atual`** — a sessão de Ajustes e Manutenção parseava o log compartilhado para descobrir o kernel atual, o que era frágil se o usuário clicasse em outro botão ao mesmo tempo. Agora existe um endpoint dedicado.

### 🔒 Segurança

- **Regex de encadeamento de shell endurecida** — a validação `_CARACTERES_ENCADEAMENTO` agora cobre `&` como operador de background (sem afetar `2>&1`), quebras de linha e `<(…)` / `>(…)`. Sem isso, comandos como `rpm -q kernel\nrm -rf ~` passavam pela whitelist sem autenticação.
- **Scripts temporários de autenticação com modo `0o700`** — antes eram criados com `0o755` (leitura por qualquer usuário em `/tmp`). `pkexec`/`kdesu` rodam como root e leem sem problema.
- **`rpm -q` com nome de pacote quotado** — evita problemas caso o `hardware_map.json` seja editado manualmente.

### 🌐 i18n

Novas chaves em `locales/en.json` e `locales/es.json`:
- `comum.status_pacote` (barra de progresso real de pacotes do DNF)
- `comum.badge_atualizar`, `comum.badge_atualizando`, `comum.badge_ja_atualizando`
- `sessoes.dispositivos-perifericos.btn_driver_reverter`
- `sessoes.dispositivos-perifericos.driver_atual`
- `sessoes.dispositivos-perifericos.notes.*` (6 chaves)
- `sessoes.waydroid.nada_remover`

Removidas chaves mortas: `comum.loading_generico`, `comum.nao_configurado`.

A versão do FOF agora é injetada no HTML pelo `server.js` no `<head>` — elimina
a constante `FALLBACK_VERSION` hardcoded no `i18n.js`.

### ⚡ Desempenho

- **Leitor de saída da autenticação** lê apenas o delta do arquivo desde o último tick (antes lia o arquivo inteiro a cada 500ms).
- **Contador global de sessões** é memoizado com invalidação explícita (antes re-varria as 14 sessões e ~300 comandos a cada atualização).
- **`_construirIdsValidos`** memoizado (era reconstruído a cada limpeza de órfãos).
- **Branch de "comando complexo" removido** de `executarComandoComStream`. O `spawn(..., { shell: '/bin/bash' })` já suportava `|`, `&&`, `;`, redirecionamentos e streaming — o `exec` buffereava tudo.

### 🧹 Limpeza interna

- Removidas 6 variantes de cor obsoletas do `style.css`.
- Removido `SESSOES_ORDEM` do `script.js` (redundante com `SESSOES_PRINCIPAIS`).
- Removida a branch morta `isPulado(sessaoId)` de `getStatusSessao`.
- Helpers de toggle consolidados: `_marcarBotaoConcluido`, `_resetarBotao`, `_resetarIrmao` (antes duplicados em `hardware.html` e `dispositivos-perifericos.html`) agora vivem só em `script.js`.
- `iniciar_fof.sh --help` menciona "14 sessões" (antes dizia 13).
- `install.sh`: `git pull --ff-only` em vez de `git pull origin main`; `npm install --omit=dev`; remoção de logs em `/tmp` sem `sudo rm -f` global.
- `producao-multimidia.html`: removido `2>/dev/null` do comando `akmod-v4l2loopback` (o erro agora fica visível no log).

---

## Como adicionar uma versão nova

Ao lançar uma versão nova:

1. Atualize o campo `version` no `package.json` (ex.: `"1.0.0-10022026"`).
2. Substitua o conteúdo deste arquivo pela seção da nova versão, mantendo apenas ela. O histórico das versões anteriores fica disponível nas releases do GitHub.
3. Use `###` (três hashes) para subseções dentro de uma versão. Um `##` no meio da seção encerra a captura do parser e o resto é descartado.
4. Crie a tag/release no GitHub com o mesmo nome.

Se o cabeçalho não bater exatamente com o `version` do `package.json`, o FOF não
encontrará a seção correspondente e mostrará apenas o link para o changelog
completo no GitHub.
