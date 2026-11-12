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

## v1.5.9-11122026

Release incremental sobre a `v1.5.8-11112026`. Adiciona o componente
`.fap-badge-info` (exclamação + popup) para informações de contexto sem
poluir a UI com retângulos, usa-o no RustDesk (com verificação de
bloqueios SELinux read-only), migra o Opera de Flathub para o
repositório RPM oficial da Opera Software, corrige o log do "Preparar
Secure Boot" na Sessão 12, fecha uma race no NTSYNC, restaura "Abrir +
lixeira" para Firefox e Thunderbird (padrão do FAP para apps de
usuário), adiciona quoting defensivo de URLs e alinha a execução via
`pkexec` ao padrão do Fedora (`dnf` em `/var/cache/dnf/`). **Nenhuma
migração em massa de `.info-extra` para `.fap-badge-info` nesta
release** — a Fase 2 fica para versão futura.

### 🆕 Novo — Componente `.fap-badge-info` (exclamação + popup)

- **`style.css` → `.fap-badge-info`.** Irmão do `.fap-badge-origem`: ícone de exclamação de 16×16, clicável, com pulsação sutil. Posiciona-se à direita do badge de origem (quando os dois coexistem) ou no canto esquerdo do botão (quando só ele existe). Cores: `warn` (amarelo, padrão) e `info` (azul). Sem auto-open — o usuário descobre que é clicável pelo `title` + pulsação. Reusa o `.fap-popover` existente (mesmo layout, mesmo comportamento de Esc/clique-fora/posicionamento).
- **`script.js` → `_INFO_BADGES_REGISTRY` + `_registrarInfoBadge(idInstall, dados)`.** Registro centralizado (igual a `_ABRIR_REGISTRY` / `APPS_REMOVIVEIS`). Cada sessão declara `{ tituloKey, tituloFallback, corpoKey, corpoFallback, cor, acaoKey, acaoFallback, acaoFn }`. Os `*Fallback` (PT-BR) cobrem o caso em que `i18n.js` não carrega JSON para PT-BR. A ação opcional chama uma função global no clique do botão do popup. A chave `tituloKey` alimenta o `title` do badge (truncado).
- **`script.js` → `_renderizarInfoBadge(idInstall)` + `_renderizarInfoBadgesFixas()`.** Injeta o `<span class="fap-badge-info">` no `.btn-flatpak-wrapper` do botão correspondente. Cria o wrapper on-the-fly se não existir. Idempotente (o `_renderizarInfoBadge` só cria se não existir e sempre reaplica o `data-cor`). Chamado no `DOMContentLoaded` (boot), no `sessao-carregada` (troca de sessão) e no `i18n-pronto` (atualiza o `title` traduzido). `_abrirPopoverInfo` reusa `_fecharPopoverOrigem` para limpeza.
- **Hooks de ciclo de vida:** `setTimeout(_renderizarInfoBadgesFixas, 400)` no `DOMContentLoaded`; `setTimeout(_renderizarInfoBadgesFixas, 260)` no `sessao-carregada`; `setTimeout(_renderizarInfoBadgesFixas, 50)` no `i18n-pronto`.
- **Critério de uso:** urgente/risco (perda de dados, brick, "não desligue", sobrescreve config do usuário, Secure Boot ativo) = retângulo (`.aviso-caixa`); contexto útil ("o que isso resolve", "o que muda", "sobre o pacote") = badge de info; pré-requisito = depende (bloqueia = retângulo, nota = badge).

### 🆕 Novo — RustDesk: badge de info + verificação SELinux (read-only)

- **`aplicativos.html` → `_registrarInfoBadge('instalar-rustdesk', ...)`.** Badge de exclamação (`cor: 'warn'`) no botão do RustDesk. O popup explica o problema de SELinux (RustDesk instala, mas em alguns sistemas o SELinux bloqueia o serviço) e oferece um botão "🔍 Check for SELinux blocks" que chama `verificarSelinuxRustDesk()`. Os `*Fallback` PT-BR preenchem o popup em PT-BR (título "Sobre o SELinux e o RustDesk", corpo com "Não desative o SELinux" + link, botão "🔍 Verificar bloqueios do SELinux").
- **`aplicativos.html` → `verificarSelinuxRustDesk()`.** Read-only. Consulta `GET /rustdesk-selinux-check` e escreve o resultado no `log-sessao-aplicativos` (via `_getLogBox('instalar-rustdesk')`). Três estados: `0 AVCs` → `✅ Sem bloqueios`; `N > 0` → `⚠️ N AVC(s) nas últimas 24h — consulte a doc oficial em rustdesk.com`; erro → `❌ Não foi possível verificar`.
- **`server.js` → `GET /rustdesk-selinux-check`.** Endpoint dedicado, read-only, sem auth (usa `_execReadOnly`, que já tem `execFile --noprofile --norc`). Conta linhas de `journalctl -g "avc:.*rustdesk" -S "24 hours ago"` via `wc -l`. Retorna `{ avcs: N }` ou `{ avcs: 0, erro: "..." }`. **Não instala política SELinux** — a doc oficial do RustDesk recomenda aplicar política **apenas se** houver AVC, porque a política "allow init_t ..." enfraquece o SELinux globalmente.

### 🟡 Corrigido — Secure Boot na Sessão 12

- **`script.js` → `_renderizarPainelSecureBoot` com `data-logbox="log-sessao-estado-fedora"`.** Antes, o botão "Preparar Secure Boot" apontava para `log-sessao-hardware` (id da Sessão 3). Na Sessão 12, esse log não existia visível — o `restaurarEstadoSessao` criava um oculto (`display: none`) para o `_getLogBox` resolver. Resultado: o output do `dnf install` ia para o oculto, e o `log-sessao-estado-fedora` visível ficava vazio. Agora o output aparece em tempo real no log compartilhado da Sessão 12.
- **`estado-fedora.html` → `restaurarEstadoSessao` sem log oculto.** O `log-sessao-hardware` oculto (criado para a Sessão 12 resolver o `_getLogBox`) foi removido. O log da Sessão 12 é sempre visível, então o `_getLogBox` resolve direto. A Sessão 3 continua usando `log-sessao-hardware` visível via `_renderizarBadgeSecureBoot` (badge compacto, sem botão) — sem regressão.

### 🟡 Corrigido — NTSYNC: race no `completarProgresso`

- **`gaming.html` → `executarNTSync` aguarda `marcarComoExecutado` antes de `aplicarEstadoInstalavel`.** `ntsync-install` **não** está em `SEMPRE_CLICAVEIS`, então `completarProgresso(idComando, true)` chama `marcarComoExecutado(idComando)` **assíncrono** (Promise não aguardada). Em paralelo, o `onSucesso` do `executarComandoGenerico` rodava `aplicarEstadoInstalavel('ntsync-install', null)`, que consulta `isExecutado` **antes** da Promise ter persistido → `false` → botão pintava "Instalar" de novo. Sintoma reportado em teste real (Fedora 44, kernel 6.14+): `lsmod | grep ntsync` mostra `ntsync 20480 0` (módulo carregado), mas o botão continua clicável. Correção: `async function onSucesso() { await marcarComoExecutado(idComando); aplicarEstadoInstalavel(...); }` — mesma solução já usada em `executarGrubAplicarRecomendado`. `marcarComoExecutado` é idempotente, então o `completarProgresso` ainda tentaria marcar de novo (bloqueado pelo `if (!includes)`).

### 🟡 Corrigido — Opera: Flathub → repositório oficial RPM (3 rodadas)

- **`aplicativos.html` → Opera migrado de `APPS_FLATPAK` para `APPS_RPM_REPO`.** O repositório oficial da Opera Software (`rpm.opera.com/rpm`) é YUM/DNF válido. `registrarAppRemovivel` muda para `tipo: 'dnf'`, `pacotes: ['opera-stable']`, `reposRemover: ['/etc/yum.repos.d/opera.repo']`. `_MAPA_ORIGEM` muda de `'flathub'` para `'fabricante'`. `_CMD_ABRIR_RPM_REPO['instalar-opera'] = 'opera'`. `SESSOES` remove `flatpakId`. Botão muda de `instalarFlatpak` para `instalarRpmRepo`.
- **Rodada 1 — `repoSetup` via `tee` + heredoc (FALHOU em runtime).** O comando final era `FAP_OPERA_REPO && dnf install -y opera-stable`. O delimitador `FAP_OPERA_REPO` precisa estar **sozinho na linha** para o bash fechar o heredoc. Com ` && dnf install` na mesma linha, o bash não reconhece o delimitador e o heredoc consome o `dnf install` até o fim do arquivo (aviso: "here-document ... delimitado pelo fim do arquivo"). O `tee` escrevia o `.repo` com sucesso e o comando terminava com `exit 0`, mas o `dnf install` **nunca rodava** — Opera não instalado, sem erro visível.
- **Rodada 2 — `instalarRpmRepo` com `\n&&` (FALHOU em runtime).** A tentativa de forçar o `&&` a começar em uma linha nova gerou `FAP_OPERA_REPO\n&& dnf install`. O bash rejeita `&&` no início de linha (`erro de sintaxe próximo ao token inesperado '&&'`). **Não há posição válida** para o `&&` com heredoc fechado — o delimitador precisa estar sozinho na linha, e o `&&` precisa estar na mesma linha que o comando que **abre** o heredoc.
- **Rodada 3 — solução final: `printf` + `tee` (FUNCIONA).** O `repoSetup` usa `printf '[opera]\nname=...\n...' | sudo tee /etc/yum.repos.d/opera.repo > /dev/null`, uma linha só, sem heredoc. O `\n` literal no `printf` (escape de string JS `\\n`) vira newline real na saída do comando. Funciona com ` && ` em sequência — o comando final é uma linha só. `instalarRpmRepo` volta a usar `repoSetup + ' && sudo dnf install -y ' + info.pacote` (sem `\n`). **Regra de manutenção para `APPS_RPM_REPO`:** `repoSetup` deve ser **uma linha só**; para conteúdo multi-linha, usar `printf` + `tee` (nunca heredoc).

### 🟡 Corrigido — Avidemux: DNF → Flathub

- **`aplicativos.html` → `instalar-avidemux` migrado de DNF para Flathub (`org.avidemux.Avidemux`).** O botão "Abrir Avidemux" usava `gtk-launch org.avidemux.Avidemux` (app-id de Flathub) para o pacote **DNF** `avidemux`, cujo `.desktop` é `avidemux.desktop` — `gtk-launch` falhava silenciosamente (setsid retornava 0, botão mostrava "🚀 opened!" mesmo sem abrir nada). Migrado para `flatpak install flathub org.avidemux.Avidemux -y`; `_MAPA_ORIGEM` mudou de `'fedora'` para `'flathub'`; `registrarAppRemovivel` mudou para `tipo: 'flatpak'`; botão chama `instalarFlatpak`.

### 🟡 Corrigido — Firefox e Thunderbird: revertida a proteção contra remoção + "Abrir" restaurado

- **`aplicativos.html` → `registrarAppRemovivel('instalar-firefox')` e `('instalar-thunderbird')` sem `permitirRemocaoPreExistente: false`.** O bloqueio foi adicionado ao Firefox na **mesma** v1.5.9 (correção B7) e **revertido** após revisão: Firefox e Thunderbird são **apps de usuário** instalados por padrão no Fedora Workstation, não itens críticos do sistema como CUPS/Samba/drivers/virtualização. Bloquear a lixeira fazia o botão virar "✅ Já estava ativo" (cinza, sem abrir), fugindo ao padrão do FAP. **Comportamento correto (restaurado):** botão "🚀 Abrir Firefox" / "🚀 Abrir Thunderbird" (verde) + lixeira, com tooltip de pré-existente. Se o `dnf remove` for recusado por dependentes (`gnome-shell`, `fedora-workstation-repositories`), o log mostra o motivo; senão, remove e o auto-reset (`_estaRealmenteInstalado === false`) volta o botão para "📦 Instalar Firefox" / "📦 Instalar Thunderbird".
- **`aplicativos.html` → `_registrarAbrir('instalar-firefox', ...)` e `_registrarAbrir('instalar-thunderbird', ...)` explícitos, fora do `_registrarAbrirEmMassa`.** Os dois são skipados no loop de massa (registros explícitos com `textoKey`/`textoFallback` próprios), logo abaixo do `_registrarAbrirEmMassa()`. O `_CMD_ABRIR_DNF` ganhou `'instalar-firefox': 'firefox'` e `'instalar-thunderbird': 'thunderbird'`. O `server.js` ganhou `'thunderbird'` em `_BINARIOS_ABRIR_WHITELIST` (o `firefox` já estava) — sem isso, o "Abrir Thunderbird" cairia em `pkexec`.

### 🟡 Corrigido — `.fap-badge-info`: popup vazio em PT-BR, exclamação solta, links externos

- **`script.js` → `_registrarInfoBadge` com `tituloFallback`, `corpoFallback`, `acaoFallback`.** Em PT-BR, o `i18n.js` não carrega JSON (o HTML é o fallback natural). Mas o badge de info é gerado dinamicamente (não existe no HTML da sessão), então o texto PT-BR precisa vir via `*Fallback`. Sem isso, o popup abria **vazio** em PT-BR (o `_abrirPopoverInfo` passava `''` como fallback do `_tVars`), e o botão de ação mostrava o literal `'Executar'`.
- **`style.css` → `.fap-popover-titulo .fap-badge-info` com reset.** O `.fap-badge-info` (que tem `position: absolute` no wrapper do botão) ancoreava no `.fap-popover` (`position: fixed`) e ficava solto sobre o título/corpo do popup, atrapalhando a leitura. Correção: reset de `position`/`transform`/`animation`/`box-shadow`/`hover`/`::before` no contexto `.fap-popover-titulo`. Análogo ao reset já existente para `.fap-badge-origem`.
- **`script.js` → handler global de `<a target="_blank">`.** No WebKitGTK, `<a target="_blank">` dispara `NEW_WINDOW_ACTION`, que o `decide_policy` do container **não trata** (só `NAVIGATION_ACTION`). Resultado: o clique era silenciosamente ignorado. Correção: `document.addEventListener('click', ...)` intercepta `<a target="_blank">`, roda `preventDefault`/`stopPropagation` e roteia para `abrirFerramentaExterna('xdg-open ' + href, ...)`. Usa `a.href` (URL resolvido/decodificado pelo navegador, com `&` real) em vez de `a.getAttribute('href')` (cru, com `&amp;`). Esquemas perigosos (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`) e URLs não-http(s) são ignorados. **Cobre popup do RustDesk, changelog e qualquer `<a target="_blank">` futuro.**
- **`script.js` → `verificarSelinuxRustDesk` usa `_getLogBox('instalar-rustdesk')`.** Antes usava `_getLogBox('rustdesk-selinux-info')`, que retornava `null` (não existe `[data-comando="rustdesk-selinux-info"][data-logbox]` nem `id="log-rustdesk-selinux-info"`). O log do `verificar` ficava vazio — só o toast. Correção: usa `instalar-rustdesk`, que tem `data-logbox="log-sessao-aplicativos"`.
- **`script.js` → `SESSOES.aplicativos.comandos` sem `'rustdesk-selinux-info'`.** Marcador era dead code (o `verificarSelinuxRustDesk` faz `fetch('/rustdesk-selinux-check')` direto, sem `executarComandoGenerico`). A presença dele quebrava a regra 2 do `validar-botoes.js` (todo idComando em `SESSOES` precisa de `<button data-comando="...">` — o badge de info é um `<span>`).

### 🟡 Corrigido — URLs: quoting defensivo + `_REDIRECT_ABRIR_PADRAO` expandido

- **`script.js` → `_shellQuote` + `_quotarUrlsNaoQuotadas`.** O `abrirFerramentaExterna` recebe string que vira comando shell (via `POST /executar` → `spawn`/`exec`). URLs com metacaracteres (`&`, `$`, backtick, `>`, `;`) eram interpretadas pelo bash — `https://x.com/?a=1&b=2` virava dois comandos. Correção: `_quotarUrlsNaoQuotadas(comando)` escaneia o comando e cita URLs (`https?://...`) não-quoteadas com `_shellQuote` (aspas simples, com escape `'\''` para aspas internas). Respeita aspas já existentes. Aplicado no topo do `abrirFerramentaExterna`.
- **`server.js` → `_REDIRECT_ABRIR_PADRAO` expandido para aceitar `'[^']*'` e `"[^"]*"` como argumentos.** URLs com `>` no query string (raro, mas possível) caíam fora do padrão antigo (`(?:\s+[^>\n]+)?`) e o comando ia parar em `pkexec`. Agora aceita argumentos entre aspas simples ou duplas, sem quebrar o PoC original (`setsid -f bash -c 'rm -rf ~' > …` continua bloqueado — `bash` não está em `_BINARIOS_ABRIR_WHITELIST`).

### 🟢 Melhorado — alinhamento com o padrão do Fedora (pkexec + HOME)

- **`server.js` → `_construirScripts` não exporta mais `HOME=<home-do-usuário>` incondicionalmente.** Antes, o script gerado para o `pkexec` sempre exportava `HOME=<home-do-usuário>`. Como o `pkexec` roda como `root`, o `dnf` (via pkexec) escrevia cache em `~/.cache/dnf/` e `~/.cache/libdnf5/` com dono `root` no home do usuário. Isso **não é o padrão do Fedora** — `sudo dnf` / `pkexec dnf` usam `HOME=/root` (implícito) e `/var/cache/dnf/` (system).
- **Alinhamento:** o `export HOME=<home-do-usuário>` agora é condicional a `IDS_COM_HOME_DO_USUARIO.has(idComando)`. A constante está **vazia** por enquanto — reservada para scripts EXTERNOS (baixados de URL) que usam `$HOME` **dentro do arquivo** (`install.sh`, `fap-cleanup.sh`, etc.). Comandos inline com `$HOME`/`~` na string **não** precisam: o `_substituirCaminhosUsuario` troca o caminho na string antes do pkexec.
- **Estado atual:** `desinstalar-fap` e `atualizar-fap` (que rodam `install.sh` baixado) estão em `IDS_SEM_AUTENTICACAO` — rodam como **usuário**, nunca via pkexec, então nunca chegam ao `_construirScripts`. O `install.sh --uninstall` continua funcionando (o `SUDO_ASKPASS` cobre os `sudo` internos).
- **Efeito colateral:** `dnf` via pkexec passa a usar `/var/cache/dnf/` (system). Botões existentes não mudam de comportamento — todos os comandos atuais usam caminho absoluto na string (substituído por `_substituirCaminhosUsuario`).
- **Resíduos antigos:** `~/.cache/dnf/` e `~/.cache/libdnf5/` de versões anteriores do FAP (donos `root`) podem ser removidos com:
  ```bash
  sudo rm -rf ~/.cache/dnf ~/.cache/libdnf5
  ```
  Ou via `scripts/fap-cleanup.sh` (o script já remove, mas só se o dono for `root` — cache legítimo do `dnf` do usuário é preservado).

### 🟢 Melhorado — i18n

- **`locales/en.json` + `es.json` → +6 chaves cada.** `rustdesk_selinux_titulo`, `rustdesk_selinux_corpo`, `rustdesk_selinux_acao`, `rustdesk_selinux_ok`, `rustdesk_selinux_ok_curto`, `rustdesk_selinux_avcs`, `rustdesk_selinux_avcs_curto`, `rustdesk_selinux_erro`. O `corpo` inclui link para `https://rustdesk.com/docs/en/client/linux/`.
- **`locales/en.json` + `es.json` → +3 chaves em `comum`.** `badge_info_aria`, `badge_info_tooltip`, `fechar` — usadas pelo `_renderizarInfoBadge`/`_abrirPopoverInfo`. Sem elas, o `make check-basico` #43 falhava.
- **`locales/en.json` + `es.json` → `btn_abrir_firefox` e `btn_abrir_thunderbird` restauradas.** Removidas na auditoria v1.5.9, voltaram com a reversão do Firefox/Thunderbird.
- **11 chaves órfãs removidas de `en.json` + `es.json`.** `btn_modeset_on`, `btn_modeset_off`, `nvidia_modeset_titulo`, `nvidia_modeset_desc`, `texto_concluido_modeset_on`, `texto_concluido_modeset_off` (bloco NVIDIA modeset removido na v1.4.9); `btn_grub_padrao`, `grub_confirmar_padrao`, `grub_msg_aplicado` (substituídos por `btn_grub_restaurar_backup`/`grub_msg_aplicado_res`).

### 🟢 Melhorado — limpeza e dead code

- **`server.js`:** 15 entradas mortas removidas de `COMANDOS_SEM_AUTENTICACAO` e `_BINARIOS_ABRIR_WHITELIST` (13 apps ArtCraft individuais + `desktopeditors` + `lightworks` — abrem via `gtk-launch`; só `artcraft-launcher` é aberto). `thunderbird` **adicionado** à whitelist. Strings de erro do `_parseVainfo` traduzidas para EN (lingua franca para detalhes técnicos). 5 endpoints migrados para `_execReadOnly` (`/kernel-atual`, `/reboot-needed`, `/kernels`, `/check-package`, `/flatpak-installed`) — mesmo vetor do fix de `fastfetch` da v1.5.6. `/kernels` paralelizado com `Promise.all`.
- **`aplicativos.html`:** `_registrarAbrirEmMassa` skipa Firefox/Thunderbird no loop (registros explícitos abaixo do loop).
- **`iniciar_fap.sh`:** bloco `pgrep -f "node .*$DIR/server\.js"` (dead code — cmdline real é `node server.js`, sem path) removido do `cleanup`. `return 0` dead code removidos após `_executar_terminal` em `abrir_no_terminal_nativo`.
- **`install.sh`:** `. /etc/os-release` em subshell (não sobrescreve `$VERSION`, definido no topo com o `package.json`).
- **`scripts/fap-cleanup.sh`:** remove `~/.cache/dnf` e `~/.cache/libdnf5` **se o dono for `root`** (resíduo das versões antigas do FAP). Cache legítimo do usuário é preservado.
- **`ajustes-manutencao.html`:** botão "Aplicar GRUB" desabilita quando `mudancas === 0`. `executarGrubAplicarRecomendado` re-busca `/grub-info` antes de aplicar e aborta se `dualBoot` não for booleano (evita esconder Windows em dual-boot quando o fetch falhou). `executarUpgradeDownload` não instala mais `dnf-plugin-system-upgrade` cegamente (guard `dnf system-upgrade --help`). `_verificarCanalFedora` usa `dl.fedoraproject.org` + fallback. `_verificarAtualizacoesPendentes` paraleliza os dois `dnf`; client `_carregarUpgradeStatus` com `_sinalTimeout(60000)`.
- **`hardware.html`:** `_detectarGpuPorVendor` repassa `secure_boot` + `secure_boot_mok`; `_atualizarSecaoNvidia` pré-popula caches (evita 2 fetches por load da Sessão 3). `vaapi-check-amd`/`vaapi-check-intel` não são mais desabilitados sem GPU do vendor. `serie` removida de `_detectarGpuNvidia`. `_escapeHTMLNvidia` removida (usa `_escapeHTML` global).
- **`script.js`:** `_prepararSecureBoot` sem `_invalidarContadorSessoes`/`_atualizarProgressoGlobal` (no-ops — `nvidia-secureboot-prepare` é `sempreClicavel`). `_aplicarFiltroSessao` preserva `bloco-comando` com `.progress-container` visível (não esconde `dnf` rodando). `_sincronizarEstadoFlatpaks` com guard duplo — rejeita `bruto === null` **e** `bruto.error` preenchido.
- **`sobre-fap.html`:** `desinstalarFAP` libera a sessão em **todos** os caminhos, esconde o `progress-container` após 3s e fecha o SSE em `finally`. `resetarProgressoFAP` limpa `fap_upgrade_finalizado`, `fap_ultima_verificacao` e `fap_versao_remota` do `localStorage`.

### 📌 Pendências de teste (hardware real)

- **`/rustdesk-selinux-check` com AVC ativo.** Em máquina limpa, `journalctl -g "avc:.*rustdesk"` retorna 0 — testar em sistema com `avc: denied` histórico (Issue #6301 do GitHub do RustDesk tem relatos).
- **Popup do RustDesk em PT/EN/ES.** Verificar que título/corpo/botão aparecem preenchidos em PT-BR (fallbacks), EN e ES; o `!` no cabeçalho alinhado; o link abre no navegador padrão.
- **Link com `&` no query string.** Testar que `setsid -f xdg-open 'https://httpbin.org/get?a=1&b=2'` (com aspas simples) abre correto no navegador, sem `pkexec`.
- **PoC do `>` continua bloqueado.** `POST /executar` com `rpm -q kernel>~/.bashrc` → `PrecisaAuth=true`.
- **Opera RPM.** Instalar em VM limpa; verificar `/etc/yum.repos.d/opera.repo` com 7 linhas exatas, `dnf remove opera-stable` na lixeira, popover do badge de origem mostrando `Fabricante`. **Regressão Brave/Vivaldi/Edge** (mesma `instalarRpmRepo`).
- **NTSYNC pós-correção.** Desfazer (`rm /etc/modules-load.d/ntsync.conf`, `dnf remove -y wine-ntsync`, `modprobe -r ntsync`), reclicar, verificar persistência.
- **Secure Boot log na Sessão 12.** VM limpa: clicar "Preparar Secure Boot", verificar output visível em tempo real.
- **Firefox e Thunderbird (após reversão).** Botão "🚀 Abrir X" + lixeira, tooltip de pré-existente, remoção + auto-reset para "📦 Instalar X", reinstalação.
- **Alinhamento com o padrão do Fedora.** Instalar um pacote via pkexec → verificar que `~/.cache/dnf/` e `~/.cache/libdnf5/` **não** são criados (ou são user-owned, se o `dnf` foi usado como usuário). `/var/cache/dnf/` populado (dono `root`). `scripts/fap-cleanup.sh` remove resíduos root-owned e preserva user-owned.
- **`install.sh --update` com `.git` quebrado.** Verificar que a Sessão 13 não trava e o SSE fecha.

### ✅ Validação estática (11–12/11/2026)

- `make check-basico`: **11/11 checks passando**.
- `node scripts/validar-botoes.js`: **170 data-comando, 13 sessões, 402 funções, 99 registrarAppRemovivel, 32 _registrarAbrir, 0 duplicatas**.
- `bash -n` em 6 `.sh`, `node --check` em 5 `.js` + 15 `<script>` inline de sessões: OK.
- `CHANGELOG.md` vs `package.json`: strings `v1.5.9-11122026` batem.
- **947 chaves i18n** presentes em `en.json` + `es.json` (936 originais + 6 `rustdesk_selinux_*` + 3 `comum.*` + 2 `btn_abrir_*`, − 11 órfãs removidas).

### Arquivos tocados

| Arquivo | Tipo de mudança |
|---|---|
| `style.css` | +bloco `.fap-badge-info`; +reset no `.fap-popover-titulo` |
| `script.js` | +`_INFO_BADGES_REGISTRY` +`_registrarInfoBadge` (com `*Fallback`) +`_renderizarInfoBadge` +`_renderizarInfoBadgesFixas` +`_abrirPopoverInfo` +`_shellQuote` +`_quotarUrlsNaoQuotadas` +handler `<a target="_blank">`; `_MAPA_ORIGEM` (Opera, Avidemux); `_MAPA_MOTIVO_BLOQUEIO` (Firefox removido); `SESSOES.aplicativos.comandos` (Opera sem flatpakId, Avidemux sem pacotes, `rustdesk-selinux-info` removido); `_renderizarPainelSecureBoot` (logbox); `_prepararSecureBoot`; `_aplicarFiltroSessao`; `_sincronizarEstadoFlatpaks`; `abrirFerramentaExterna` |
| `server.js` | +`GET /rustdesk-selinux-check`; 5 endpoints migrados para `_execReadOnly`; `_BINARIOS_ABRIR_WHITELIST` (kate, opera, thunderbird; 13 ArtCraft removidos); `_REDIRECT_ABRIR_PADRAO` expandido; `_parseVainfo` traduzido para EN; `_construirScripts` com `IDS_COM_HOME_DO_USUARIO` (HOME condicional) |
| `aplicativos.html` | +`_registrarInfoBadge('instalar-rustdesk', ...)`; +`verificarSelinuxRustDesk()`; Opera migrado (com `printf` + `tee`); Avidemux migrado; Firefox/Thunderbird sem `permitirRemocaoPreExistente` + `_registrarAbrir` explícito; `_registrarAbrirEmMassa` skipa Firefox/Thunderbird; `_CMD_ABRIR_DNF` com firefox/thunderbird |
| `estado-fedora.html` | −log oculto da Sessão 12 |
| `gaming.html` | `executarNTSync` async/await |
| `ajustes-manutencao.html` | `_verificarCanalFedora` (2 hosts); `_verificarAtualizacoesPendentes` (paralelo); `_carregarUpgradeStatus` (60s); `executarUpgradeDownload` (guard); `executarGrubAplicarRecomendado` (re-busca); `_renderizarPreviewGrub` (desabilita); botão GRUB desabilitado em `mudancas === 0` |
| `sobre-fap.html` | `desinstalarFAP` (libera sessão, esconde progress, fecha SSE); `resetarProgressoFAP` (limpa 3 chaves) |
| `hardware.html` | `_detectarGpuPorVendor`; `_atualizarSecaoNvidia`; `vaapi-check-*`; `serie` removida; `_escapeHTMLNvidia` removida |
| `iniciar_fap.sh` | `pgrep` dead code removido; `return 0` dead code removidos |
| `install.sh` | `. /etc/os-release` em subshell |
| `scripts/fap-cleanup.sh` | +rm de `~/.cache/dnf` e `~/.cache/libdnf5` (só root-owned) |
| `locales/en.json` | +6 `rustdesk_selinux_*`; +3 `comum.*`; +2 `btn_abrir_*`; −11 órfãs |
| `locales/es.json` | +6 `rustdesk_selinux_*`; +3 `comum.*`; +2 `btn_abrir_*`; −11 órfãs |
| `package.json` | bump `1.5.9-11122026` |
| `CHANGELOG.md` | seção atual substituída |
