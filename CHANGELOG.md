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

## v1.3.2-10272026

Rodada extensa de correções e melhorias de robustez após auditoria
completa do código. Nenhuma mudança altera o comportamento do usuário
final em fluxos que já funcionavam — todas as correções são incrementais.

### 🔒 Segurança

- **CSRF em `POST /shutdown`** — bloqueia requests com `Origin`
  presente e diferente de `localhost`/`127.0.0.1`. O `curl` do
  `install.sh --uninstall` (sem Origin) continua funcionando. Uma aba
  maliciosa com form POST para `127.0.0.1:3000/shutdown` agora recebe
  403.
- **`_CARACTERES_ENCADEAMENTO`** agora bloqueia `>` e `>>` (redireci-
  onamento de arquivo), com exceção estrita ao padrão interno de
  abertura de app (`setsid -f … > /tmp/fap-open-*.log 2>&1 < /dev/null`).
  `2>&1` e `>&2` continuam permitidos.
- **IDs de abertura únicos por clique** (`open-<id>-<timestamp>`) —
  evita rate-limit entre aberturas consecutivas e não polui o
  `.progresso.json` (prefixo `open-` filtrado em `salvarProgresso`).

### 🐛 Correções

- **RustDesk e Rclone Manager** — resolução da URL do RPM migrada para
  o frontend (`fetch`), mesmo padrão já aplicado ao ArtCraft Launcher.
  O `curl` dentro do contexto do `pkexec` podia falhar por
  CA/PATH/rate-limit.
- **Busca não filtrava a sessão 6** — `_aplicarFiltroSessao` agora
  varre `.launcher-item` (além de `.bloco-comando`) e esconde o
  `<details>` pai quando todos os filhos ficam ocultos.
- **Waydroid uninstall** remove `waydroid-helper` (antes ficava órfão).
- **`removerKernel`** usa `GET /kernel-atual` (JSON) em vez de parsear
  o log compartilhado da sessão — elimina race condition.
- **`window.location.href` para URLs externas** trocado por
  `window.open(url, '_blank', 'noopener,noreferrer')` — evita que o
  FAP navegue para fora no browser fallback.
- **`abrir_container`** propaga `$?` do `fap-container` — se o binário
  crasha no boot, cai no fallback de navegador em vez de fingir sucesso.
- **Detecção NVIDIA** cobre Quadro, Tesla, MX e Titan. `nvidia-detect`
  (RPM Fusion) é usado como fonte primária; regex expandido como
  fallback. Cobre Quadro K/M/P/T, Tesla K/M/P/V/A/T, MX150/250 etc.
- **Sessões com auto-reset** — quando o FAP marcou algo como instalado
  mas o pacote não está mais no sistema (remoção externa),
  `aplicarEstadoInstalavel` reseta o estado automaticamente
  (fire-and-forget).
- **`_executarRemocaoApp`** invalida o cache do `SystemState` antes de
  checar — evita tentar remover algo já removido por fora.
- **`origem` órfão no `.progresso.json`** — `POST /progress` agora
  filtra `origem` para manter apenas IDs ainda em `executados`.
- **Progresso com hardware-dependentes** — `hardware_vendors` no
  `/system-state` + `_comandoRelevante`. Numa máquina Intel-only, os
  comandos AMD/NVIDIA são excluídos de `getStatusSessao` e
  `_contagemSessao`. Sem isso, a sessão "Hardware" ficava `1/5` para
  sempre. Fallback conservador: sem dados, inclui tudo.
- **`_aplicarEstadoBotoesGrub`** usa `_textoOriginalTraduzido` (i18n).
- **`aplicarEstadoToggle`** honra `ignorarPreExistente` em ambos os
  caminhos (undefined e booleano) e respeita
  `permitirRemocaoPreExistente: false`.
- **`appJaInstaladoNoSistema`** com `modo: 'desfazerTudo'` sem
  `pacotes`: emite `console.warn` em vez de falhar silenciosamente.
- **NTSYNC** verifica `modprobe -n` antes de instalar. Se o módulo não
  existe no kernel, aborta sem deixar pacote órfão. Se o `dnf install`
  passa mas o módulo não carrega, faz rollback.
- **`grub2-editenv unset menu_auto_hide`** só roda se a variável existir
  (`grep -q '^menu_auto_hide='`).
- **`_dispararAtualizacaoFAP`** desabilita o botão da sessão 14 durante
  o update, reabilita só em caso de erro. Check estrito
  (`dados.sucesso === true`). Toast "🔄 Atualizando FAP..." sem a
  menção a "Acompanhe em Sobre o FAP" (a sessão não tem UI de progresso
  em tempo real).
- **`abrirFerramentaExterna`** mantém `setsid -f` (app em sessão
  própria), mas valida abertura via mini-SSE de 3s. Mostra
  `⏳ abrindo...` → `✅ abriu` ou `⚠️ não abriu` em vez do `✅ X aberto!`
  incondicional.

### ✨ Melhorias

- **Sessão "Sobre o FAP" (`informativa: true`)** — aparece na sidebar,
  mas não conta no progresso global (antes mostrava `0/1` para sempre).
  Sidebar exibe `ℹ️` no lugar do `0/0`.
- **Botão "Resetar progresso"** na sessão 14 — chama `DELETE /progress`
  (com confirmação dupla). Rede de segurança para o auto-reset.
- **`GET /hardware-detect-atomic`** — endpoint dedicado que substitui
  parse de `stdout` em `verificarAtomic` (estado-fedora.html).
- **`GET /grub-info?preview=1`** — servidor computa o diff entre a
  config atual e a recomendada. Frontend só renderiza (fallback cliente
  mantido para compatibilidade).
- **i18n** — logs de GRUB, Waydroid, update FAP e abertura de app
  traduzidos em PT/EN/ES. `origem.download.atualizar` reescrito para
  refletir o fluxo real (remover pela lixeira + reinstalar).
- **READMEs** — instruções de instalação reordenadas (menu de
  aplicativos primeiro, `Ctrl+Alt+T` como dica). Público-alvo são
  iniciantes; o `Ctrl+Shift+V` é o atalho correto para colar.

### 🧹 Limpeza

- Removidos `marcarComoPulado` / `desmarcarComoPulado` (código morto).
  O campo `pulados` no `.progresso.json` e `isPulado` são preservados
  (compatibilidade + base para feature futura).
- Removido chip "Pulados" do filtro da sessão 6 (filtrava para o vazio).
- Removido `_ajustarFerramentasPorDesktop` + `_esconderSePacoteInstalado`
  de `aplicativos.html` (código morto desde a v1.1.2).
- Removido bloco CSS inline `.badge-atualizacao` de `index.html`
  (consolidado em `style.css`).
- `_observadorLogDock` observa apenas o `.terminal-log-toggle` (não o
  dock inteiro) + dedup write no `localStorage`.
- `make check-basico` ganhou duas checagens: `instalar-*` tem
  `_MAPA_ORIGEM` e `data-i18n`/`_t()` tem chave em EN/ES.

### ⚠️ Nota de atualização

- `server.js`, `system-state-service.js`, `script.js`,
  `ajustes-manutencao.html`, `hardware.html`, `waydroid.html`,
  `gaming.html`, `aplicativos.html`, `estado-fedora.html`,
  `sobre-fap.html`, `iniciar_fap.sh`, `guiado.html`, `index.html`,
  `Makefile`, `locales/*.json`, `README*.md` foram alterados.
- `fap-container.c`, `hardware-service.js`, `hardware_map.json`,
  `build-container.sh`, `iniciar_fap_compat.sh` **não foram tocados**.
- `.progresso.json` existente continua compatível (schemas preservados).
- `SEMPRE_CLICAVEIS` não foi alterado — botões como "Verificar
  atualização", "Limpeza", "Aplicar DNF" continuam reexecutáveis.

### 🧪 Não testado

- Fedora 45 real — o estado `no_upgrade_needed` continua validado por
  inspeção de código (pendência desde a v1.3.0).
- Hardware NVIDIA real (Quadro/Tesla) — as correções de detecção foram
  validadas por regex, mas não em hardware físico.
- Waydroid em bare metal — pendência desde a v1.2.2.

---
