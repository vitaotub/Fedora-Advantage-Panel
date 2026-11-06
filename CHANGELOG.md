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

## v1.5.0-11062026

Rodada de auditoria completa do projeto (cinco passadas). Passada 1: `check_failed` com i18n, 5 ids `pos-upgrade-*` em `SESSOES`, `_renderUpgradePosUpgrade` checando `isExecutado`, `_detectarComponentesTerceiros` cobrindo `akmod-nvidia-open`, `_sinalTimeout` em fetches de versão, `_renderizarBadgeOrigem`, `_aplicarFiltroSessao`, `instalar-affinity`, `_ehBlackwell`, `fontconfig`. Passada 2: `pgrep -x` → `pgrep -f "/usr/sbin/akmods"` (evitava rollback prematuro do driver NVIDIA), `_prepararSecureBoot` propagando falha via `|| exit 1`, tradução do `{ctx}` do badge de Secure Boot, cache de `/hardware-scan`, remoção de `template-sessao.html`. Passada 3: IDs `btn-upgrade-*` desalinhados do `idComando`, guard de estado confiável em `_sincronizarEstadoFlatpaks`, lixeira ausente após instalar codecs extras/fontes MS, `_renderUpgradePosUpgrade` PT-BR hardcoded, cache NVIDIA remove, `_sinalTimeout` em fetch local, limpeza de `_MAPA_MOTIVO_BLOQUEIO` / `mitigacao.realtime_setup` / registro de `upgrade-f45-*`. Passada 4: IDs `pos-upgrade-*` no `_renderUpgradePosUpgrade` (botões travados/duplo clique), `_renderizarPanelDriverStatus` consultando repo à toa, `_refreshEstadoSessao` invalidando `_hardwareScanCache`, `setsid -f heroic` removida. **Passada 5 (pós-auditoria de 11/06/2026):** dois 🟡 e um 🟢. **`hardware.html` → `executarNvidiaVaapiInstall`**: o pacote correto no Fedora 44+ é `libva-nvidia-driver` (o antigo `nvidia-vaapi-driver` foi descontinuado/renomeado) — instalar o nome velho falhava com "No match for argument" e o botão nunca ficava verde. Corrigido o comando + 3 textos visíveis (fallback PT-BR em `hardware.html`, `nvidia_vaapi_desc`/`nvidia_vaapi_info`/`nvidia_vaapi_env_desc` em `en.json`/`es.json`). **Detecção de enrollment MOK** (`hardware-service.js` → `_checkMokEnrolled`, `scanHardware` → campo `secure_boot_mok`; `script.js` → cache + helper `_mokEnrolled()`, `_renderizarPainelSecureBoot` com banner verde quando enrolled, `_renderizarBadgeSecureBoot` escondendo quando enrolled, `_prepararSecureBoot` e `_refreshEstadoSessao` invalidando o MOK cache). Antes, o painel mostrava o passo a passo mesmo quando o usuário já tinha feito o enrollment. **Total: 16 chaves i18n novas, 5 alteradas, 2 removidas.** Nenhuma release separada — reescrita em cima da v1.5.0 antes da publicação.

### 🔴 Corrigido

- **`ajustes-manutencao.html` → `_renderUpgradePosUpgrade`** — os 5 botões `pos-upgrade-*` tinham `id="btn-pos-limpeza"` / `btn-pos-rpmconf` / `btn-pos-distrosync` / `btn-pos-fixfiles` / `btn-pos-rescue`, mas o `idComando` era `pos-upgrade-*`. `executarComandoGenerico` busca `btn-<idComando>` (que não existia) — o botão ficava habilitado durante a execução (30s–1h para distro-sync/fixfiles), permitindo duplo clique. Em **falha**, `restaurarBotaoAposExecucao` não conseguia reabilitar (mesmo problema de `id`), e o botão travava em `"⏳"` até reload. Os 5 `id` foram renomeados, os 5 botões ganharam `data-texto-original` (para `_textoOriginalTraduzido` funcionar), e `aplicarEstadoPosUpgrade` foi alinhado para usar `getTextoAposExecucao` (o texto específico do `textoConcluidoKey` não é mais sobrescrito por `"✅ Concluído"`).

- **`hardware.html` → `executarNvidiaDriver`** — a detecção de falha do polling usava `pgrep -x akmods` / `pgrep -x akmodsbuild`. Como `akmods` e `akmodsbuild` são scripts bash, o `comm` do processo é `bash`/`sh` — `pgrep -x` casa contra `comm` e **nunca encontrava**. O branch de falha disparava na 1ª iteração, dormia 10s, checava `modinfo` de novo e **revertia o driver aos ~25s**, mesmo com a compilação em andamento (que leva 2–10min). Na prática, todo usuário NVIDIA perdia o driver e voltava ao nouveau. Corrigido para `pgrep -f "/usr/sbin/akmods"` (casa `bash /usr/sbin/akmods` e `bash /usr/sbin/akmodsbuild`, já que o segundo contém o primeiro como prefixo).

- **`script.js` → `_prepararSecureBoot`** — a cadeia `sudo dnf install ... && sudo kmodgenca ... || true; chmod; chmod` era parseada como `((A && B) || true); C; D`. Se `dnf install` falhasse, o `&&` curto-circuitava, o `|| true` engolia, e o script terminava com o exit code do último `chmod ... || true` (sempre 0). O `onSucesso` rodava e mostrava "✅ Chave do akmods gerada" mesmo sem nada instalado. O usuário com Secure Boot ativo achava que preparou a chave, o botão "Instalar Driver NVIDIA" liberava, e o `akmod-nvidia` compilava mas **não carregava no boot** (sem MOK enrollment). Agora o `dnf install` propaga a falha via `|| exit 1` (o `kmodgenca` continua tolerante com `|| true`, pois a chave pode já existir).

- **`ajustes-manutencao.html` → `_renderUpgradePronto`, `_plugarListenersUpgradePronto`, `_renderUpgradeBaixado`** — os botões do upgrade usavam `id="btn-upgrade-baixar"`, `id="btn-upgrade-reboot"`, `id="btn-upgrade-cancelar"`, mas o `idComando` passado a `executarComandoGenerico` era `upgrade-f45-download` / `upgrade-f45-reboot` / `upgrade-f45-cancelar`. `executarComandoGenerico` procura `document.getElementById('btn-' + idComando)` → `btn-upgrade-f45-download`, que não existia. O botão real ficava habilitado durante o download (30min–2h) sem feedback, e o usuário podia clicar várias vezes (o server só barra pelo rate limit de 1.5s, não pelo estado do botão). Os 3 `id` foram renomeados para casar com o `idComando`, e o `_plugarListenersUpgradePronto` foi ajustado para o novo `id`.

- **`script.js` → `_sincronizarEstadoFlatpaks`** — o guard de cache fresco só pulava a sincronização se `idadeCache < 10s`. Quando `SystemState.carregar()` falhava (rede caiu, `/system-state` retornou erro), o `catch` setava `_dados = null` e `cacheIdade()` devolvia `Infinity` — que não é `< 10s` —, então o loop continuava e `flatpakInstalado()` retornava `false` para todos (porque `_lista()` devolve `[]` quando `_dados` é `null`). Resultado: **todos os Flatpaks marcados como instalados pelo FAP eram desmarcados** após uma falha transitória de rede. Agora há um guard explícito: se `SystemState.bruto()` é `null` ou `bruto.flatpaks_installed` não é array, o sync é pulado.

### 🟡 Corrigido (i18n)

- **`hardware.html` → `_renderizarPanelDriverStatus`** — o painel de bloqueio por geração (Kepler/Fermi) usava `_t()` em `nvidia_serie_legado_bloqueada`, cuja tradução em EN/ES tem `{nome}`. `_t` não interpola, então em EN/ES o usuário via `Series **{nome}** requires...`. Trocado por `_tVars(..., { nome: info.geracao.nome })`.

- **`hardware.html` → `_aplicarEstadoNvidia`** — o tooltip de driver indisponível (Blackwell sem `akmod-nvidia-open`) usava `_t()` em `nvidia_driver_indisponivel_curto`, cuja tradução tem `{pkg}` e `{modelo}`. Em EN/ES, o tooltip mostrava `The driver "{pkg}"...`. Trocado por `_tVars(..., { pkg, modelo })`.

- **`script.js` → `_renderizarBadgeSecureBoot`** — o `{ctx}` interpolado em `secureboot_badge_desc`/`secureboot_badge_ok` vinha dos call sites como PT-BR hardcoded (`'o driver NVIDIA'`, `'a câmera virtual do OBS'`, `'Broadcom, Realtek ou xpadneo'`). Em EN/ES, o badge mostrava "Before installing o driver NVIDIA..." — vazamento de PT-BR. Agora há um mapa `_CTX_I18N` que traduz o contexto antes de interpolar, com 3 chaves novas (`secureboot_ctx_nvidia`, `secureboot_ctx_obs`, `secureboot_ctx_perifericos`). Em PT-BR, `_t` cai no fallback (a própria string), então o comportamento não muda.

- **`ajustes-manutencao.html` → `_renderUpgradePosUpgrade`** — os 5 botões `pos-upgrade-*` eram renderizados com texto PT-BR hardcoded (`'🧹 Executar Limpeza'`, `'⚙️ Mesclar Configurações'`, `'🔄 Distro-Sync'`, `'🛡️ Agendar Relabel'`, `'🛟 Instalar dracut-config-rescue'`). Em EN/ES, o usuário via todo o bloco pós-upgrade em português. Além disso, `executarPosLimpeza`/`executarPosRpmconf`/etc usavam `_t('sessoes.ajustes-manutencao.upgrade_pos_*_btn', ...)`, mas **as 5 chaves não existiam em `en.json`/`es.json`** — o `_t` caía no fallback PT-BR de qualquer jeito. Agora os 5 textos usam `_tUpgrade('upgrade_pos_*_btn', ...)` e as 5 chaves foram adicionadas.

- **`hardware.html` → `executarNvidiaVaapiInstall`** — o comando de instalação usava `nvidia-vaapi-driver`, mas no Fedora 44/45 o pacote correto é **`libva-nvidia-driver`** (o antigo foi renomeado). O botão "Instalar Tradutor VA-API" falhava com `No match for argument: nvidia-vaapi-driver` e nunca ficava verde. Corrigido o comando (`sudo dnf install -y libva-nvidia-driver`) + 3 textos visíveis: o fallback PT-BR em `hardware.html` (2 ocorrências: `nvidia_vaapi_desc` e `nvidia_vaapi_info`) e as chaves `nvidia_vaapi_desc`/`nvidia_vaapi_info`/`nvidia_vaapi_env_desc` em `en.json`/`es.json`.

- **`hardware.html` → `_renderizarPanelDriverStatus`** (passada 4) — a função chamava `_verificarDriverNvidiaDisponivel(info.geracao)` em toda abertura da Sessão 3 em GPUs Blackwell, mesmo quando o driver já tinha sido instalado pelo FAP. Com `isExecutado('nvidia-driver-install') === true`, `_aplicarEstadoNvidia` já está no modo revert e o painel de bloqueio é irrelevante — a consulta só gastava ~2s de `dnf list --all`. Agora só consulta quando `!isExecutado('nvidia-driver-install')`.

- **`hardware.html` → `_mostrarAvisoX11Nvidia`** — o teste era `isLegado = /470xx|390xx/.test(info.serie)`. Desde a v1.4.9, `info.serie` é o **nome da geração** (`'Kepler'`, `'Fermi'`), não o pacote — a regex nunca casava e o painel `#nvidia-aviso-legado` (com o texto explicativo grande) nunca era exibido. O bloqueio real já era feito por `_aplicarEstadoNvidia` (via `info.geracao.bloqueado`), então o botão continuava corretamente desabilitado, mas o usuário Kepler/Fermi só via o tooltip curto em vez do painel vermelho explicativo. Corrigido para checar `info.geracao.bloqueado`.

### 🟢 Corrigido (robustez)

- **`aplicativos.html` → `instalarUrlRpm`, `instalarRcloneManager`, `instalarArtCraftLauncher`** — os três fetches à API do GitHub (para resolver a URL do RPM mais recente de RustDesk, Rclone Manager e ArtCraft Launcher) rodavam sem `signal`. Se o GitHub estivesse lento/instável, o `await` ficava pendurado até o timeout de TCP do WebKitGTK (~2min), com o botão em "⏳" sem feedback. O `_sinalTimeout` da v1.5.0 só cobriu os fetches de versão em `script.js`; estes três ficaram de fora. Agora usam `_sinalTimeout(10000)` com fallback para `undefined` quando o WebKitGTK é antigo.

- **`codecs.html` → `executarExtrasTainted`, `executarFontesMS`** — os dois fluxos não passavam `onSucesso` a `executarComandoGenerico`. Após sucesso, o `restaurarBotaoAposExecucao` pintava o botão de cinza `✅ instalado`, mas **não** criava a lixeira (`_mostrarLixeira` só é chamada por `aplicarEstadoInstalavel`). A lixeira só aparecia quando o usuário trocava de sessão e voltava. Agora ambos chamam `aplicarEstadoInstalavel(idComando, null)` no `onSucesso`, alinhados com `executarCodecs`.

- **`hardware.html` → `executarNvidiaDriverRemove`** — o fluxo de install já chamava `_invalidarHardwareScanCache()` antes do `desmarcarComoExecutado('nvidia-driver-remove')`. O fluxo de remove não chamava, e `_atualizarSecaoNvidia` (chamada no `onSucesso`) reutilizava o cache de 5s com o driver ainda instalado — o painel NVIDIA ficava stale por até 5s. Agora o remove também invalida o cache antes de repintar.

- **`script.js` → `_refreshEstadoSessao`** — o botão de refresh global do header (`#btn-refresh-estado`) não invalidava o cache de 5s de `hardware.html` (`_hardwareScanCache`). Se o usuário clicasse em refresh e abrisse a Sessão 3 dentro de 5s, os dados exibidos eram os antigos. Agora invalida via `_invalidarHardwareScanCache()` quando disponível (`typeof` guard — a função só existe no `<script>` do `hardware.html`). Também invalida `_secureBootMokCache` junto com `_secureBootCache` (sem isso, refresh + abrir Sessão 12 continuava mostrando o painel antigo mesmo após o usuário fazer o enrollment MOK em outro terminal).

- **`script.js` → `_dispararAtualizacaoFAP`** — o `fetch(API_URL + '/executar', { ..., signal: _sinalTimeout(10000) })` violava a regra do briefing ("Nunca em fetch local — esses são rápidos e o timeout só mascararia bugs"). Se o `/executar` demorasse > 10s para responder, o abort matava a atualização sem o usuário saber. O `signal` foi removido.

- **`hardware-service.js` → `scanHardware`** — para NVIDIA, o server ainda usava `nvidia-detect` como fonte primária de sugestão de pacote. Em versões antigas do RPM Fusion, `nvidia-detect` retorna `akmod-nvidia` para RTX 50xx (incompatível — precisa de `akmod-nvidia-open`). Agora o server detecta Blackwell por regex (mesma do client) e força `akmod-nvidia-open`, ignorando `nvidia-detect` nesse caso. Adicionado helper `_ehBlackwell()`.

- **`codecs.html` → `executarFontesMS`** — `sudo dnf install -y curl cabextract fontconfig` incluía `fontconfig`, que já é dependência do GTK (o FAP roda em GTK3 + WebKitGTK) e portanto sempre presente em ambiente gráfico. Removido da lista de instalação.

- **`server.js` → `_verificarAtualizacoesPendentes`** — timeout de `dnf check-update` era 20s, insuficiente em conexões lentas ou cache frio (podia resultar em `check_failed` falso-negativo). Bumpado para 30s.

- **`server.js` → `COMANDOS_SEM_AUTENTICACAO`** — `'setsid -f heroic'` removida. A entrada era dead code: o Heroic é instalado como Flatpak (`com.heroicgameslauncher.hgl`), e `abrirHeroic()` usa `abrirFerramentaExterna('gtk-launch com.heroicgameslauncher.hgl', ...)` — nunca `setsid -f heroic`. A entrada em `_BINARIOS_ABRIR_WHITELIST` permanece (`'heroic'`), usada pelo regex de redirect `_REDIRECT_ABRIR_PADRAO`.

- **`hardware-service.js` → `_checkMokEnrolled` (novo)** — antes, o FAP só verificava se `public_key.der` existia (chave gerada), mas **nunca** se ela tinha sido enrolled no firmware. Resultado: após o usuário fazer o enrollment MOK (passo 3 do painel Secure Boot) e reiniciar, o painel continuava mostrando o passo a passo do zero, e os badges de "enrollment necessário" nas Sessões 3/4/5/9 continuavam aparecendo. Agora o `/hardware-scan` retorna `secure_boot_mok: { chave_gerada, enrolled }` via `mokutil --test-key` (canônico, exit 0 = enrolled). O frontend (`_mokEnrolled()` em `script.js`) usa esse campo para: (a) esconder o painel completo e mostrar banner verde "Secure Boot está ativo e a chave do akmods já está enrolled no firmware"; (b) esconder os badges nas outras sessões; (c) invalidar o cache em `_prepararSecureBoot` e `_refreshEstadoSessao` para o refresh pegar o estado real.

### 🚫 Removido

- **`template-sessao.html`** — obsoleto desde a rodada de redesign (v1.1.3). O molde ainda descrevia a estrutura anterior à `.fap-sidebar-item` / filtros / badges, e exigia manutenção em sincronia com `script.js`. Removido do projeto e de `install.sh` (`ARQUIVOS_PRINCIPAIS`). A documentação de "como criar uma sessão" agora vive no briefing.

- **`script.js` → `_MAPA_MOTIVO_BLOQUEIO['realtime-setup']`** — entrada morta. `realtime-setup` foi migrado para "toggle puro" na v1.1.2 (não usa mais `registrarAppRemovivel`), então `motivoBloqueio` nunca era consultado para esse ID.

- **`script.js` → `_MAPA_MOTIVO_BLOQUEIO['nvidia-vaapi-install']`** — entrada morta. `nvidia-vaapi-install` usa `aplicarEstadoOneShot` (que não consulta `motivoBloqueio` nem `APPS_REMOVIVEIS`). Removida.

- **`locales/en.json`, `locales/es.json` → `mitigacao.realtime_setup`** — chave órfã pela mesma razão acima.

- **`locales/en.json`, `locales/es.json` → `mitigacao.nvidia_vaapi`** — chave órfã pela mesma razão acima.

### 📝 i18n

Novas chaves em `en.json` e `es.json`:
- `sessoes.ajustes-manutencao.upgrade_check_failed_titulo`
- `sessoes.ajustes-manutencao.upgrade_check_failed_desc`
- `sessoes.ajustes-manutencao.upgrade_pos_limpeza_concluido`
- `sessoes.ajustes-manutencao.upgrade_pos_rpmconf_concluido`
- `sessoes.ajustes-manutencao.upgrade_pos_distrosync_concluido`
- `sessoes.ajustes-manutencao.upgrade_pos_fixfiles_concluido`
- `sessoes.ajustes-manutencao.upgrade_pos_rescue_concluido`
- `sessoes.ajustes-manutencao.upgrade_pos_limpeza_btn`
- `sessoes.ajustes-manutencao.upgrade_pos_rpmconf_btn`
- `sessoes.ajustes-manutencao.upgrade_pos_distrosync_btn`
- `sessoes.ajustes-manutencao.upgrade_pos_fixfiles_btn`
- `sessoes.ajustes-manutencao.upgrade_pos_rescue_btn`
- `seguranca.secureboot_ctx_nvidia`
- `seguranca.secureboot_ctx_obs`
- `seguranca.secureboot_ctx_perifericos`
- `seguranca.secureboot_configurado_ok`

Chaves alteradas:
- `sessoes.ajustes-manutencao.upgrade_warn_nvidia` — agora cobre `akmod-nvidia-open` além de `akmod-nvidia`.
- `sessoes.dispositivos-perifericos.notes.nvidia` — menciona detecção por regex (Blackwell incluído) e o pacote correto por geração.
- `sessoes.hardware.nvidia_vaapi_desc` — `<code>libva-nvidia-driver</code>` em vez de `nvidia-vaapi-driver`.
- `sessoes.hardware.nvidia_vaapi_info` — `<code>libva-nvidia-driver</code>`.
- `sessoes.hardware.nvidia_vaapi_env_desc` — `<code>libva-nvidia-driver</code>`.

Chaves removidas:
- `mitigacao.realtime_setup` — órfã (item migrou para toggle puro na v1.1.2).
- `mitigacao.nvidia_vaapi` — órfã (`nvidia-vaapi-install` usa `aplicarEstadoOneShot`).

### 🔄 Alterado

- **`README.md`, `README.en.md`, `README.es.md`** — simplificados. Removida a tabela das 13 sessões (que ficava desatualizada a cada release) e o detalhamento por bloco. Mantidas as prints (com legenda revisada) e a descrição do que o FAP entrega. Estrutura nova: o que é → prints → instalação → o que você ganha → segurança → requisitos → links.

### 🧪 Requisito

- **Fedora 44 ou 45.**
