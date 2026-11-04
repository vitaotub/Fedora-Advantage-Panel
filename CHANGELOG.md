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

## v1.4.3-11042026

Rodada de manutenção pós-lançamento do Fedora 45. Corrige um bloco CSS
quebrado, remove código morto acumulado e limpa inconsistências de UI
(landing + container). **Não altera nenhuma funcionalidade existente**
— todas as mudanças são de limpeza, consistência ou correção de
defeitos visuais.

### 🐛 Corrigido

- **`style.css`** — bloco CSS quebrado após a regra de neon por sessão
  (havia um `}` órfão e um `opacity: 0.55` solto). Isso impedia que
  `.fap-sidebar-item.na` aplicasse o esmaecimento correto em sessões
  marcadas como N/A. O `opacity` foi movido de volta para o corpo da
  regra correta.
- **`style.css`** — removida a entrada morta
  `[data-sessao="waydroid"]` do bloco de neon por sessão (a sessão foi
  deletada na v1.4.2, mas a regra CSS permaneceu).
- **`iniciar_fap.sh`** — `mostrar_ajuda()` dizia "14 sessões" no lugar
  de "13" (ficou desatualizado após a remoção do Waydroid).
- **`src/fap-container.c`** — removido o label de status ("Pronto" /
  "Carregando..." / "Redirecionando..." / "Carregando conteúdo...")
  do header bar. O feedback de carregamento agora é dado apenas pelo
  spinner + barra de progresso. `atualizar_status()` virou no-op
  (mantida para não quebrar as chamadas existentes). O título central
  e o botão de fechar/minimizar/maximizar permanecem intactos.
- **`index.html`** — removido o bloco `#card-status` (as 4 barras de
  progresso — Uso geral, Gaming, Produção, Segurança — e a frase
  "Faltam N passos..."). O progresso global continua visível na
  sidebar do `guiado.html` e no `progresso-global` do header.
  `_renderizarCardStatus()` em `script.js` detecta a ausência e
  retorna cedo — sem erro, sem warning.

### 🗑️ Removido

- **`server.js`** — regex legada em `PADROES_UPDATE_WHITELIST` que casava
  `echo "s" | bash <(curl ...) --uninstall` (formato antigo, sem `-y`).
  O frontend atual usa `--uninstall -y`, que tem regex própria.
- **`system-state-service.js`** — `dkms` removido de `SERVICOS_FAP`.
  `dkms` não é um serviço systemd no Fedora; `systemctl is-active dkms`
  sempre retornava `inactive`, e a entrada era morta.
- **`locales/en.json`** e **`locales/es.json`** — chaves órfãs removidas:
  `btn_rclone`, `texto_concluido_rclone`, `rclone_uninstall_aviso`,
  `btn_desfazer_rclone_manager` e `btn_desfazer_ntsync`. Nenhuma delas
  era referenciada por HTML ou JS desde a v1.4.1/v1.4.2.

### 🔄 Alterado

- **`system-state-service.js`** — `_detectarArquivosConfig` agora inclui
  `~/.config/MangoHud/MangoHud.conf` e `~/.config/gamemode.ini` (criados
  pelo FAP na sessão Gaming). Consistência com o estado real do sistema;
  a detecção de UI continua usando `isExecutado` (sem regressão).
- **`package.json`** — versão atualizada para `1.4.3-11042026`.

### ⚠️ Nota sobre o Fedora 45

O Fedora 45 foi lançado oficialmente em **3 de novembro de 2026**, e o
RPM Fusion 45 já está publicado. A área de upgrade da sessão 11
(Ajustes e Manutenção) continua funcional: usuários no Fedora 44 com
sistema atualizado verão o botão "Baixar pacotes do Fedora 45". Nenhuma
mudança de lógica foi necessária nesta versão — a detecção via
`releases.json` + `HEAD` nos canais `updates/45` do Fedora e do RPM
Fusion já cobre o cenário pós-GA.

### 🧪 Não testado (pendências para a próxima rodada)

- **Presets de GameMode com backup/restore** — testado com e sem
  arquivos pré-existentes no notebook AMD. Cenário "usuário já tinha
  config personalizada e faz remoção duas vezes" validado
  conceitualmente, não em hardware.
- **Fila de Flatpaks com 3+ apps em sequência** — validado
  conceitualmente. Recomendado testar com múltiplas instalações
  disparadas em rápida sucessão.
- **Upgrade Fedora 44 → 45 em hardware real** — o fluxo
  `ready → downloaded → reboot` foi validado com mocks e com o Fedora 45
  já publicado nos mirrors. Falta testar o reboot real em hardware.
- **Container WebKitGTK após remoção do label de status** — validar
  visualmente em KDE Plasma e GNOME que o spinner + barra de progresso
  continuam dando feedback adequado durante o carregamento, sem o label
  textual que existia antes.

### 🧪 Requisito

- **Fedora 44 ou 45.**
