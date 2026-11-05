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

## v1.4.6-11042026

Rodada de correções na área de upgrade do Fedora 44 → 45, baseada em
testes reais em hardware. Corrige o reboot que travava pedindo
confirmação `[y/N]:`, a limpeza pós-upgrade que travava no
`remove-retired-packages`, e adiciona um checkbox para o usuário
esconder a área de upgrade permanentemente após concluir tudo.

### 🐛 Corrigido

- **`ajustes-manutencao.html` → `executarUpgradeReboot`** — o comando
  `dnf5 offline reboot` **não tem flag `-y`** e **pede confirmação**
  (`Is this ok [y/N]:`) quando roda sem TTY. Como o `pkexec` executa o
  script sem TTY, o comando ficava parado esperando um `s` que nunca
  chegava, e o reboot não acontecia. Trocado para
  `dnf5 system-upgrade reboot -y`, que é compatível com o DNF4 e
  **aceita `-y`** para pular a confirmação. O `echo s |` (que chegou a
  ser tentado na v1.4.5) não funciona porque o `dnf5` lê a confirmação
  do terminal, não do stdin do script.
- **`ajustes-manutencao.html` → `executarUpgradeCancelar`** — mesma
  lógica. Trocado `dnf5 offline clean` por `dnf5 system-upgrade clean -y`.
- **`ajustes-manutencao.html` → `executarPosLimpeza`** — o
  `remove-retired-packages` e o `clean-rpm-gpg-pubkey` são
  **interativos** (perguntam `Is this ok [y/N]:` antes de remover).
  Como o `pkexec` roda sem TTY, o comando travava no meio. Adicionado
  `yes |` no início dos dois, que alimenta `y\n` infinitamente e cobre
  todas as confirmações. O `yes` recebe SIGPIPE quando o script
  termina, sem travar.
- **`ajustes-manutencao.html` → `executarUpgradeReboot`** — faltava o
  `}` de fechamento da função, causando `SyntaxError: Unexpected end
  of script` no `eval.call(win, ...)` do `guiado.html`. Isso fazia
  **toda a sessão 11 parar de carregar** (as funções seguintes,
  incluindo `executarUpgradeCancelar` e as `executarPos*`, nunca eram
  definidas).
- **`ajustes-manutencao.html` → IIFE final** — quando
  `_upgradeFinalizadoNoCliente()` era `true` (usuário já está no
  Fedora 45+), mostrava uma mensagem estática **e retornava ANTES**
  de chamar `_renderizarAreaUpgrade`. Com isso, os botões de
  pós-upgrade **nunca apareciam**, mesmo quando o marcador
  `upgrade-f45-download` estava setado. Agora monta um `data`
  sintético com `status: 'no_upgrade_needed'` e passa para
  `_renderizarAreaUpgrade`, que decide entre os botões e a mensagem
  estática.
- **`ajustes-manutencao.html` → `case 'no_upgrade_needed'`** —
  removida a condição `isExecutado('upgrade-f45-download')` que
  **impedia os botões de aparecerem** quando o marcador se perdia
  (reset de progresso, troca de diretório, SSE perdido no download).
  Agora os botões aparecem sempre que o usuário está no Fedora 45.
  As ações pós-upgrade são genéricas e úteis mesmo para quem
  atualizou por fora.

### ✨ Adicionado

- **Checkbox "ações pós-upgrade concluídas"** — no final do bloco de
  pós-upgrade, um checkbox com label + descrição explicativa. Ao
  marcar, chama `marcarComoExecutado('pos-upgrade-concluido')` e a
  área inteira vira uma mensagem estática ("Ações pós-upgrade
  concluídas"). O marcador fica no `.progresso.json` e **só volta
  atrás com "Resetar progresso"** na sessão 13.
- **Novo idComando `pos-upgrade-concluido`** em
  `SESSOES.ajustes-manutencao.comandos`, com `sempreClicavel: true`.
  Isso mantém o ID no `.progresso.json` (sem ele, o
  `_limparIdsOrfaos` removeria na próxima limpeza) e **não conta no
  progresso** da sessão 11.
- **Funções `_plugarListenersPosUpgrade` e
  `_marcarPosUpgradeConcluido`** em `ajustes-manutencao.html`.
- **~4 chaves novas** em `locales/en.json` e `locales/es.json`:
  `upgrade_pos_concluido_titulo`, `upgrade_pos_concluido_desc`,
  `upgrade_pos_checkbox_label`, `upgrade_pos_checkbox_aviso`.

### 🔄 Alterado

- **`package.json`** — versão `1.4.6-11042026`.
- **`README.md` / `README.en.md` / `README.es.md`** — badge de versão.
- **`BRIEFING.md`** — versão atual + histórico + regras novas
  descobertas na v1.4.6.

### 🧪 Requisito

- **Fedora 44 ou 45.**
