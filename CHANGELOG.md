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

## v1.2.2-10232026

A Suíte ArtCraft deixa de instalar os 13 apps individualmente e passa a
instalar apenas o **launcher oficial**. Cinco novos aplicativos entram na
sessão 6, um novo bloco **"🔧 Utilitários"** é criado, e três rodadas de
testes pós-implementação corrigiram bugs funcionais (5 apps novos +
ArtCraft Launcher + Firefox), de consistência i18n (botões com status
diferente em PT/EN/ES) e de UX (feedback do "Verificar Versão", tooltip
indevido em botões "Abrir X", setroubleshoot sem botão de abrir).

Os 13 apps antigos (PhotoCraft, VectorCraft, FilmCraft, LightCraft, PDFCraft,
EffectCraft, DesignCraft, FigCraft, DeckCraft, GridCraft, WordCraft,
CadCraft e SoundCraft) **saíram do FAP**. Quem já os tinha instalado
continua com eles funcionando — só não aparecem mais na interface. Para
desinstalar, use o terminal (`sudo dnf remove <pacote>`).

### ✨ Novo — ArtCraft Launcher

- **O FAP agora instala apenas o launcher oficial** da suíte ArtCraft
  ([storytold/craft-launcher](https://github.com/storytold/craft-launcher)).
  O launcher é um RPM baixado direto do GitHub Releases e resolve a URL
  em runtime via GitHub API — sempre a versão mais recente publicada.

- **A resolução da URL acontece no frontend** (WebKitGTK, roda como
  usuário), não dentro do `pkexec`. Motivo: rodando como root, o `curl`
  recebia resposta vazia da API do GitHub (rate limit por IP, restrição
  de CA no ambiente do pkexec, PATH reduzido). O `fetch` do frontend tem
  CA correto e conectividade normal; a URL resolvida é passada como
  argumento para o `dnf install` (que usa `libcurl` interno, mecanismo
  distinto do binário `curl`). Sem fallback fixo: se o `fetch` falhar,
  aborta com mensagem clara e link para verificação manual — nunca
  instala versão antiga.

- **A instalação usa `--setopt=localpkg_gpgcheck=0`** (RPM não assinado,
  exigência do Fedora 44/45).

- **A lixeira remove apenas o pacote `artcraft-launcher`**. Os apps
  instalados *pelo launcher* **não são removidos junto** — o launcher
  tem sua própria gestão de remoção.

- **Botão "Abrir"** chama o binário direto `artcraft-launcher`
  (`/usr/bin/artcraft-launcher`). O `gtk-launch` não funciona porque o
  nome do `.desktop` é `ai.storyteller.artcraft-launcher.desktop`.

### ✨ Novo — 5 aplicativos na sessão 6

- **Mozilla Firefox** (RPM, repo oficial do Fedora) — bloco **Internet e Comunicação**.
- **Visual Studio Code** (Flatpak `com.visualstudio.code`) — bloco **Produtividade e Escritório**.
- **Drawy** (Flatpak `org.kde.drawy`) — bloco **Ferramentas Gráficas**.
- **Gear Lever** (Flatpak `it.mijorus.gearlever`) — bloco **Utilitários** (novo).
- **Packet** (Flatpak `io.github.nozwock.Packet`) — bloco **Internet e Comunicação**.

### ✨ Novo — Bloco "🔧 Utilitários"

- Acordeão novo na sessão 6, dedicado a ferramentas de sistema que não
  se encaixam nas outras categorias. Inaugurado com o **Gear Lever**
  (gerenciador de AppImages — instala, atualiza e integra ao menu).

### 🐛 Corrigido — ciclo 1 (bugs funcionais)

- **5 apps novos não instalavam** — `instalar-vscode`, `instalar-drawy`,
  `instalar-gear-lever`, `instalar-packet` (Flatpak) e `instalar-firefox`
  (DNF) estavam sem entrada em `APPS_FLATPAK` / `APPS_DNF`. O clique caía
  num `return` silencioso — sem log, sem progresso, sem botão cinza.
  Adicionadas as 5 entradas + `_CMD_ABRIR_DNF` para o Firefox.

- **ArtCraft Launcher não instalava** — o regex `\.x86_64\.rpm` exigia
  um ponto literal antes de `x86_64`, mas o asset se chama
  `artcraft-launcher-0.7.0-linux-x86_64.rpm` (hífen). O `grep -oP` não
  casava.

- **Firefox pedia senha de root ao abrir** — `setsid -f firefox` não
  estava em `COMANDOS_SEM_AUTENTICACAO`. Adicionado à whitelist.
  Comando simplificado: `gtk-launch firefox` → `firefox` (binário direto).

- **ArtCraft Launcher não abria** — `gtk-launch artcraft-launcher`
  falhava porque o nome do `.desktop` é
  `ai.storyteller.artcraft-launcher.desktop`. Trocado para binário
  direto `artcraft-launcher`, adicionado à whitelist do `server.js`.

### 🐛 Corrigido — ciclo 2 (consistência i18n)

Sintomas: botões com status diferente em PT-BR vs EN/ES. Detecção de
pré-existente inconsistente entre idiomas (funcionava em ES, falhava em
EN).

- **`i18n.js` → `aplicarTraducoes`** sobrescrevia `textContent` de
  botões gerenciados por estado. Corrigido com skip de elementos cujo
  `textContent !== data-texto-original`.

- **`guiado.html` → `carregarSessao`** não aguardava
  `SystemState.carregar()` antes de `restaurarEstadoSessao()`. Sessões
  com `restaurarEstadoSessao` síncrono liam `SystemState._dados = null`
  em boot, fazendo `appJaInstaladoNoSistema` retornar `false` para tudo.
  Era a causa do "em espanhol funciona, em inglês não" — dependia da
  corrida entre `/system-state` e o fetch do HTML.

- **`_resetarBotao`** (Ajustes) e **`aplicarEstadoToggle`** (Hardware,
  Dispositivos, Gaming) usavam `data-texto-original` direto — voltava
  PT-BR em runtime. Corrigido com `_textoOriginalTraduzido`.

- **`waydroid.html`**, **`hardware.html`** (NVIDIA), **`estado-fedora.html`**,
  **`script.js`** (Gaming presets) — ~30 strings PT-BR hardcoded que
  escapavam do `data-i18n`.

- **`primeiros-passos.html`** e **`gaming.html`** — 2 branches latentes
  com a mesma causa, corrigidos por consistência.

### 🐛 Corrigido — ciclo 3 (UX e tooltips)

- **Botão "Abrir setroubleshoot" agora existe** — `aplicarEstadoInstalavel`
  era chamado com `idAbrir = null`, então o botão nunca virava "Abrir X".
  Adicionado botão verde (oculto) + função `abrirSetroubleshoot()` que
  chama `sealert -b`, e `setsid -f sealert` à whitelist do `server.js`.

- **"Verificar Versão do Fedora" com feedback visível** — auto-load
  silencioso (`verificarVersaoFedora(true)`) não polui o log; clique no
  botão roda `cat /etc/fedora-release; uname -r` e dá sinal visível
  (~1s no botão + linha no log dock).

- **Tooltip de origem indevido em botões "Abrir X"** — quando o FAP
  instalava um pacote, o botão "Abrir X" continuava com tooltip de
  origem ("Instalado via DNF dos repositórios oficiais..."). Adicionado
  guard em `_renderizarBadgeOrigem` e `_renderizarBadgesFixas`
  (`data-estado !== 'instalado-abrir'`), e o branch `instalado-abrir`
  de `aplicarEstadoInstalavel` limpa `title`/`data-title-origem` quando
  FAP instalou. Pré-existente **continua** com seu tooltip próprio.

### 🗑️ Removido

- **13 apps ArtCraft individuais** de `script.js` → `SESSOES.aplicativos.comandos`
  e `_MAPA_ORIGEM`.

- **13 `.launcher-item`** e seus progress containers de `aplicativos.html`.

- **`ARTCRAFT_REPOS`** (objeto de 13 repos), `executarArtCraft` e
  `abrirArtCraft` de `aplicativos.html`.

- **13 `registrarAppRemovivel`** dos apps ArtCraft.

- **13×4 chaves** dos locales `en.json` e `es.json`.

### 🌐 Internacionalização

Chaves novas em `locales/en.json` e `locales/es.json`:

- **Sessão 6:** `btn_artcraft_launcher`, `texto_concluido_artcraft_launcher`,
  `btn_abrir_artcraft_launcher`, `bloco_artcraft_desc`, `bloco_artcraft_aviso`,
  `btn_firefox`/`texto_concluido_firefox`/`btn_abrir_firefox`,
  `btn_vscode`/`texto_concluido_vscode`/`btn_abrir_vscode`,
  `btn_drawy`/`texto_concluido_drawy`/`btn_abrir_drawy`,
  `btn_gear_lever`/`texto_concluido_gear_lever`/`btn_abrir_gear_lever`,
  `btn_packet`/`texto_concluido_packet`/`btn_abrir_packet`,
  `bloco_utilidades_titulo`, `bloco_utilidades_desc`.

- **Waydroid:** `ja_feito_preexistente`, `tooltip_preexistente_waydroid`.

- **Hardware:** `nvidia_sem_gpu_curto`, `nvidia_detectando`.

- **Gaming:** `texto_concluido_gamemode_presets`.

- **Estado do Fedora:** `versao_indisponivel`, `versao_suportada`,
  `versao_antiga`, `versao_nova`, `label_distribuicao`, `label_versao`,
  `label_kernel`, `label_suporte_fap`, `atomic_aviso`, `atomic_ok`,
  `label_tipo`, `atomic_imutavel`, `atomic_tradicional`,
  `label_variante`, `label_gerenciador`, `selinux_status_enforcing`,
  `selinux_status_permissive`, `selinux_status_disabled`,
  `selinux_status_outro`, `selinux_label_modo_atual`,
  `selinux_label_modo_config`, `selinux_log_atual`,
  `selinux_avc_nenhum`, `selinux_avc_poucos`, `selinux_avc_muitos`,
  `btn_setroubleshoot_abrir`.

### ⚠️ Nota de atualização

- **`server.js`** ganhou 3 entradas em `COMANDOS_SEM_AUTENTICACAO`:
  `setsid -f firefox`, `setsid -f artcraft-launcher`, `setsid -f sealert`.
  Reabra o FAP depois de atualizar — o processo `node` carrega o array
  uma única vez, no boot.

- **Quem já tinha apps ArtCraft instalados via FAP:** os apps continuam
  instalados e funcionando. O `.progresso.json` mantém os IDs órfãos
  até o próximo boot, quando `_limparIdsOrfaos` os remove
  automaticamente.

- **`fap-container`** não precisa ser recompilado.

### 🧪 Não testado nesta release

- **Waydroid em sistema com Android instalado** — ambiente de teste é
  VM, sem suporte a container Android.
- **Hardware NVIDIA real** — ambiente de teste sem GPU NVIDIA.
- Testadores com esses dois hardwares devem reportar problemas via
  issue no GitHub.

---

## v1.2.1-10212026

Disponível nas [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases).

## v1.2.0-10202026

Disponível nas [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases).
