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

## v1.4.2-10312026

Rodada de correções baseada em teste completo em instalação limpa do
**Fedora 44** em hardware real (GPU AMD Barceló). Corrige 10 bugs de UX
identificados nesse teste (6 na primeira rodada + 4 que só apareceram
durante a validação) e **remove completamente a sessão Waydroid
(Android no Linux)**.

### 🐛 Corrigido

**Sessão 1 — Terra Extras:**

- Botão "Habilitar Terra Extras" não reaparecia após remover os
  repositórios extras. `_atualizarVisibilidadeTerra` consultava o
  `SystemState` com cache antigo (TTL 60s) e escondia o botão até
  reload. Agora `executarTerraExtras` e `executarTerraExtrasRemove`
  invalidam o cache (`SystemState.invalidar()`) e aguardam o
  recarregamento antes de recalcular a visibilidade.

**Sessão 6 — Aplicativos:**

- Botão "🐙 GitHub do Projeto" da suíte Affinity não abria nada.
  `window.open(..., '_blank')` não funciona no WebKitGTK (o
  `decide_policy` do container trata apenas `NAVIGATION_ACTION`,
  não `NEW_WINDOW_ACTION`). Agora usa
  `abrirFerramentaExterna('xdg-open <url>')`, que abre no navegador
  padrão do sistema, independente do FAP.

**Sessão 7 — Casa e Escritório:**

- LocalSend e Warpinator instalavam mas o botão não mudava para "🚀 Abrir"
  até reload da sessão. O `onSucesso` passava `idAbrir` do DOM antigo
  (não existe mais desde a Rodada 2B). Agora passa `null` e usa
  exclusivamente o `_ABRIR_REGISTRY`.
- **Bug de Flatpak (crítico, corrigido na 2ª rodada):** todo app
  Flatpak instalado via FAP (VLC, Haruna, OBS, Kdenlive, etc.) ficava
  com o botão "Instalar" até reload, enquanto apps DNF (MPV, GIMP)
  funcionavam. Causa: `_dispararFlatpak` chamava `onSucesso` sem
  invalidar e recarregar o `SystemState`, então `_estaRealmenteInstalado`
  consultava um cache de até 60s atrás (de antes do `flatpak install`
  terminar). Agora `_dispararFlatpak` replica o padrão de
  `aguardarConclusaoEEntao`: `SystemState.invalidar()` +
  `await SystemState.carregar(true)` antes de `onSucesso`.

**Sessão 8 — Gaming:**

- Presets de GameMode + MangoHud sobrescreviam
  `~/.config/MangoHud/MangoHud.conf` e `~/.config/gamemode.ini` sem
  backup. Agora faz backup (`.fap-backup`) antes de sobrescrever. A
  lixeira restaura o backup original (se existia antes do FAP) ou
  remove os arquivos criados pelo FAP (se não existiam).
  `registrarAppRemovivel` ganhou `comandoRemocao` e `confirmMsg`.

**Sessão 10 — Diagnóstico:**

- CoolerControl instalava mas o botão não mudava para "Abrir" porque
  `sudo usermod -aG coolercontrol $USER` falhava (o grupo não existe
  no momento da instalação; só o daemon o cria na primeira execução).
  Comando reescrito conforme documentação oficial
  (`docs.coolercontrol.org/installation/fedora`):
  ```bash
  sudo dnf install dnf-plugins-core
  sudo dnf copr enable codifryed/CoolerControl -y
  sudo dnf install -y coolercontrol liquidctl
  sudo systemctl enable --now coolercontrold
  ```
  `liquidctl` adiciona suporte a AIOs USB, fan hubs e telas LCD.
  Removido o `usermod` (desnecessário — o daemon sobe com as
  permissões corretas via systemd). Adicionado `comandoRemocao` que
  desabilita o serviço, remove os pacotes e limpa o arquivo `.repo`
  do COPR.

**Sessão 13 — Sobre o FAP:**

- Botão "🔄 Atualizar FAP" ficava sempre habilitado, mesmo quando o FAP
  já estava na última versão. Agora, ao carregar a sessão,
  `_verificarVersaoParaBotaoAtualizar()` compara a versão local
  (`window.FAP_VERSION_UI18N`) com a versão remota
  (`verificarAtualizacoesForcado`) e desabilita se forem iguais.
  Tooltip explica ("Você já está na versão mais recente"). Não
  interfere na notificação da landing
  (`mostrarBadgeSeHouverAtualizacao`), que continua funcionando
  normalmente.
- Botão "📝 Ver Changelog Completo no GitHub" também usava
  `window.open` e não abria no WebKitGTK. Mesmo fix do item anterior:
  agora usa `abrirFerramentaExterna('xdg-open <url>')`.

**Auto-reset (afeta todas as sessões):**

- `_estaRealmenteInstalado` foi simplificado: se o cache do
  `SystemState` diz que o pacote está ausente, o auto-reset dispara
  (limpa o marker). Antes, um guard de "cache fresco = confiar" impedia
  o auto-reset legítimo quando o cache tinha dados de antes da
  instalação. A proteção contra cache velho agora é feita no
  `aguardarConclusaoEEntao` e no `_dispararFlatpak`, que forçam
  `SystemState.carregar(true)` antes de `onSucesso`.
- `_sincronizarEstadoFlatpaks` ganhou guard de cache recente: pula o
  ciclo se o `SystemState` foi carregado há menos de 10s (evita
  desmarcar apps recém-instalados enquanto o `flatpak list` do server
  ainda está com dados velhos). Também passou a usar `null` no segundo
  argumento de `aplicarEstadoInstalavel` (o "Abrir X" vem do
  `_ABRIR_REGISTRY`, não do DOM).
- `_executarRemocaoApp` agora invalida o `SystemState` **depois** de
  `desmarcarComoExecutado`, garantindo que a próxima renderização veja
  o pacote ausente.
- `SystemState.carregar()` aceita parâmetro `forcarRefresh` — passa
  `?refresh=1` no server, invalidando o cache de 60s do
  `system-state-service.js`. Usado após instalar/remover algo.
- `SystemState.cacheIdade()` exposto para debug.
- `server.js`: `salvarProgresso` agora filtra `-revert` (antes só
  `-open`/`-remove`/`open-*`) — IDs transientes não poluem mais o
  `.progresso.json`.
- `desinstalarPacote()` (legado) removida — usava `idComando + '-revert'`
  como ID de execução e era código morto desde a v1.3.0.

### 🗑️ Removido

- **Sessão Waydroid (Android no Linux) — removida completamente.**
  Arquivos alterados: `waydroid.html` (deletado), `script.js` (entrada
  em `SESSOES`, `_MAPA_ORIGEM`, `_GRUPOS_LANDING`, método
  `SystemState.waydroid()`), `guiado.html` (emoji + SVG do ícone),
  `iniciar_fap.sh` e `install.sh` (arrays de arquivos de sessão),
  `server.js` (endpoint `/waydroid-status`, entradas `waydroid status`
  / `waydroid show-full-ui` em `COMANDOS_SEM_AUTENTICACAO`, entrada
  `waydroid show-full-ui` em `COMANDOS_USER_CONTEXT`),
  `system-state-service.js` (`_detectarWaydroid` e ajuste dos índices
  em `scanSystemState`), `locales/en.json` e `locales/es.json` (bloco
  `sessoes.waydroid.*` inteiro).

  **Motivo:** sessão difícil de manter (bugs do COPR yanqiyu/waydroid
  no Fedora 44, dependências quebradas, sem hardware AMD/Intel nas
  máquinas de teste do autor), escopo fora do público-alvo principal
  (usuários migrando do Windows) e o uso de Android em Linux hoje é
  bem atendido por alternativas nativas (`adb`, scrcpy, apps Flatpak
  de mirroring).

### 🔄 Alterado

- **`script.js` → `_GRUPOS_LANDING`** — grupo "Uso geral" perdeu a
  entrada `waydroid`. Total global passa de **14** para **13 sessões**.
- **`script.js` → `_dispararFlatpak`** — replica o padrão de
  `aguardarConclusaoEEntao` (invalidar + `carregar(true)`) antes de
  `onSucesso`.
- **`.gitignore`** — adicionados `*.bak`, `*.orig`, `*.rej`,
  `.fap-backup-*`, `*.fap-backup` e `.history/` (artefatos de
  patch/merge e histórico local de editores). Defesa em profundidade
  (regras `!`) mantida.

### ⚠️ Nota de atualização

- **Sessão removida.** Usuários que tinham o Waydroid instalado pelo
  FAP continuam com o container funcionando no sistema — o FAP apenas
  deixa de gerenciá-lo. Para remover manualmente:
  ```bash
  systemctl stop waydroid-container
  waydroid container stop
  sudo dnf remove waydroid lzip
  rm -rf ~/.local/share/fap-waydroid ~/.local/share/waydroid
  sudo rm -rf /var/lib/waydroid /var/lib/waydroid-data
  ```
- `.progresso.json` existente continua compatível. IDs órfãos do
  Waydroid (`waydroid-install`, `waydroid-init`,
  `waydroid-extras-prep`, etc.) são removidos automaticamente pelo
  `_limparIdsOrfaos` no próximo boot. IDs `-revert` também são
  removidos (o `salvarProgresso` passou a filtrá-los).
- **Requisito:** `Fedora 44` ou `45`.

### 🧪 Não testado

- **`xdg-open` no container** — testado apenas em VM (Intel) e notebook
  (AMD). Ambientes sem `xdg-open` (desktop minimalista, SSH) podem
  falhar com `xdg-open: command not found` no log. Correção: instalar
  `xdg-utils` via `dnf`.
- **Presets backup/restore do GameMode** — testado com e sem arquivos
  pré-existentes no notebook AMD. Cenário "usuário já tinha config
  personalizada e faz remoção duas vezes" validado conceitualmente,
  não em hardware.
- **`_verificarVersaoParaBotaoAtualizar` offline** — comportamento
  esperado é manter o botão habilitado (fallback conservador). Cenário
  testado com mock, não com GitHub realmente offline.
- **Fila de Flatpaks com múltiplas instalações em sequência** —
  validado conceitualmente. Recomendado testar com 3+ apps na fila.
