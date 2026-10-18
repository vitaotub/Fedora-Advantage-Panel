# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> Use apenas `## vX.Y.Z-...` para os cabeçalhos de versão. Dentro de uma
> seção, use `###` para subseções — um `##` no meio encerra a captura.
> Versões anteriores ficam nas releases do GitHub.

---

## v1.1.1-10182026

O FAP passa a **enxergar o estado real do Fedora do usuário**. Até esta versão, ele só sabia o que ele mesmo tinha feito (`.progresso.json`). Se o usuário já tinha o Terra ativo, o RPM Fusion habilitado, o Flathub configurado, o VLC instalado ou o grupo `input` já configurado antes de usar o FAP, o botão correspondente continuava clicável — e o clique falhava (o `dnf install` recusa a transação com "already installed"; o `flatpak install` idem).

Agora, um novo endpoint `GET /system-state` roda comandos read-only no boot e devolve o estado consolidado do sistema. A UI se adapta em **duas camadas**, dependendo do tipo de item:

**Apps instaláveis** (`aplicarEstadoInstalavel` — sessões 2, 3, 5, 6, 7, 8, 10, 11, 13):

- **Instalado/ativo pelo FAP** → botão verde "🚀 Abrir X" + lixeira (padrão).
- **Instalado/ativo por fora** (pré-existente) → **mesma UI**: "🚀 Abrir X" + lixeira. Tooltip avisa que o FAP não foi a causa; `confirmMsg` da lixeira prefixa aviso extra. O usuário tem controle total, com transparência sobre a origem. **Exceto 14 itens de alto risco** (ver seção 🔒 Mitigação abaixo).
- **Não instalado** → botão azul clicável original.

**Kernel params e drivers de hardware** (`aplicarEstadoToggle` / `aplicarEstadoItemCompleto` — sessões 4 e 12):

- **Instalado/ativo pelo FAP** → botão cinza "concluído", revert habilitado.
- **Instalado/ativo por fora** → botão cinza "✅ Já estava ativo" com tooltip; revert **oculto** (FAP não foi a causa). Mantido conservador para evitar remoção acidental de ajustes de kernel ou drivers de sistema que o usuário configurou manualmente.

Além disso, esta versão corrige uma série de bugs de dispatcher e de abertura de aplicativos encontrados durante testes manuais (FreeCAD, Avidemux, MPV, Lightworks, KRDC, OnlyOffice).

### ✨ Novo

- **`GET /system-state`** — endpoint read-only com TTL de 60s em memória. Devolve `repos_enabled`, `packages_installed`, `flatpaks_installed`, `groups_membership`, `kernel_params`, `services_active`, `config_files_present` e `waydroid` (com `installed`, `initialized`, `extras_prepared`). Todas as consultas rodam em paralelo; na máquina típica o custo é ~1s (limitado por `dnf repolist`).

- **Módulo `system-state-service.js`** — roda os comandos read-only (`dnf repolist`, `rpm -qa`, `flatpak list`, `id -nG`, `systemctl is-active`, `sysctl -n`, `grubby --info=DEFAULT`, `test -f`, `rpm -q waydroid`). Cache em memória, invalidado a cada 60s.

- **Cache cliente `SystemState` em `script.js`** — uma única `fetch('/system-state')` no boot. Helpers síncronos (`repoAtivo`, `remoteFlatpakAtivo`, `pacoteInstalado`, `flatpakInstalado`, `membroDoGrupo`, `kernelParam`, `servicoAtivo`, `arquivoPresente`, `waydroid`) usados por todas as sessões.

- **Método `SystemState.invalidar()`** — invalida o cache cliente após operações que mudam o estado do sistema (remoção de app, instalação por fora). Sem ele, o cache ficava obsoleto por até 60s (TTL do servidor), e o botão de um app removido continuava mostrando "Abrir + lixeira" nesse intervalo.

- **Detecção automática em `aplicarEstadoInstalavel`, `aplicarEstadoToggle` e `aplicarEstadoItemCompleto`** — quando o chamador não passa `preExistente` explicitamente, as funções consultam `appJaInstaladoNoSistema(idComando)`, que cruza `APPS_REMOVIVEIS` com `SystemState`. **Toda a base de apps do FAP ganha detecção de pré-existência sem alteração individual nas sessões.**

- **Flag `permitirRemocaoPreExistente` no registro de `APPS_REMOVIVEIS`** — permite que um item específico recuse a remoção quando for pré-existente, mantendo a lixeira funcional para o caso "instalado pelo FAP". Aplicada em `aplicarEstadoInstalavel` (camada visual) e em `_executarRemocaoApp` (camada de execução, defesa em profundidade). Ver seção 🔒 Mitigação.

- **Sessão 4 exibe botões progressivamente com pré-existência** — `aplicarEstadoItemCompleto` detecta repo pré-existente, pacote pré-existente e mostra `✅ Já estava ativo` / `✅ Já instalado (antes do FAP)` conforme o caso, com revert desabilitado quando o FAP não foi a causa.

- **Sessão 9 (Waydroid)** — `restaurarEstadoSessao` consulta `SystemState.waydroid()` para distinguir "instalado pelo FAP" de "já instalado antes". Os 3 botões de estágio (`install`, `init`, `extras-prep`) refletem o estado real.

### 🔒 Mitigação: lixeira bloqueada para pré-existentes de alto risco

Com a Opção B (pré-existente tratado como instalado), todo app passou a ter lixeira. Isso é o comportamento desejado para apps de uso cotidiano — desinstalar um flatpak que já estava no sistema é reversível em 1 clique. Mas para **14 itens de alto risco**, permitir remoção via FAP é destrutivo: a remoção pode derrubar serviços, alterar grupos do usuário, ou (no caso de `fontes-ms-all`) arrastar pacotes base do Fedora.

Para esses 14 itens, foi adicionada a flag `permitirRemocaoPreExistente: false` no registro de `APPS_REMOVIVEIS`, com um `motivoBloqueio` explicando como reverter manualmente. **Comportamento resultante:**

- **Pré-existente** (usuário já tinha antes do FAP) → botão cinza "✅ Já estava ativo", tooltip com o `motivoBloqueio`, **sem lixeira**. Clique não faz nada.
- **Instalado pelo FAP** → "🚀 Abrir X" (se tiver GUI) ou "✅ Nome do recurso instalado" + **lixeira funcional**. A mitigação só bloqueia o caso pré-existente.

**Itens bloqueados:**

| Item | Sessão | Por que bloqueado |
|---|---|---|
| `codecs-essenciais` | 2 | Swap destrutivo de `ffmpeg` → `ffmpeg-free`; pode deixar sistema sem reprodução até reinstalar pacotes base |
| `extras-tainted` | 2 | Remove `rpmfusion-*-tainted` + `libdvdcss`; quebra leitura de DVDs comerciais |
| `fontes-ms-all` | 2 | Registro inclui `fontconfig` (pacote base); `dnf remove` arrasta dezenas de dependências |
| `vulkan-amd` | 3 | Remove Mesa + Vulkan; jogos e apps 3D param |
| `vaapi-amd` | 3 | Remove aceleração VA-API por hardware |
| `vaapi-swap` | 3 | Remove Mesa/VDPAU freeworld |
| `nvidia-driver-install` | 3 | Deixa GPU sem driver até reiniciar |
| `intel-media-install` | 3 | Remove aceleração VA-API em Intel |
| `cups-install` | 7 | Remove CUPS + Avahi; todas as impressoras param |
| `samba-install` | 7 | Remove Samba; compartilhamentos de rede param |
| `qemu-kvm-install` | 10 | Remove QEMU/KVM + libvirt; VMs param de rodar |
| `virtualbox-install` | 10 | Idem |
| `gnome-boxes-install` | 10 | Idem |
| `realtime-setup` | 12 | `gpasswd -d $USER realtime` — remove um grupo que o FAP não criou |

**Itens que mantêm a lixeira mesmo se pré-existentes** (baixo e médio risco — o `confirmMsg` já avisa sobre dados preservados, e remover é reversível):

- **Sessão 5**: `instalar-obs-studio`, `instalar-easyeffects`, `obs-cam`
- **Sessão 6**: todos os flatpaks, navegadores (Brave/Vivaldi/Edge — remove pacote + repo), OnlyOffice, RustDesk, Lightworks, apps `dnf`, Rclone Manager
- **Sessão 7**: `localsend-install`, `warpinator-install`, `keepassxc-install`
- **Sessão 8**: `steam-install`, `heroic-install`, `lutris-install`, `wine-install`, `winetricks-install`, `bottles-install`, `ntsync-install`, `gamemode-install`, `mangohud-install`, `goverlay-install`, `gamescope-install`, `vkbasalt-install`, `controller-test-install`, emuladores (RetroArch, Dolphin, PCSX2, RPCS3, Duckstation)
- **Sessão 11**: `gsmartcontrol-install`, `coolercontrol-install`
- **Sessão 13**: `selinux-setroubleshoot-install`, `selinux-gui-install`

### 🐛 Correções

- **Terra Repository não falha mais em quem já tinha o repo ativo.** Era o caso mais visível: o `dnf install terra-release` recusava a transação porque o pacote já existia, mas o botão continuava azul clicável. Agora aparece como `✅ Já estava ativo` cinza, com tooltip. O mesmo vale para RPM Fusion, Flathub e os 4 subrepositórios do Terra.

- **Repositórios de fabricante e COPRs** (Opera, Brave, Vivaldi, Edge, OpenRazer, xpadneo) deixam de ser reconfigurados quando o arquivo `.repo` já está em `/etc/yum.repos.d/`.

- **Sessão 12 (Ajustes)** — os 4 toggles de kernel (`vm-max-map-count`, `vm-swappiness-cache`, `tcp-bbr`, `pipewire-quantum-low`) e o `realtime-setup` passam a detectar estado real. Se o usuário já tinha `bbr` no kernel, `swappiness=150`, o grupo `realtime`, ou o arquivo `99-fap-quantum.conf`, o botão "Aplicar" vira `✅ Já estava ativo` cinza e o "Reverter" fica oculto. **Exceção:** `realtime-setup` usa `aplicarEstadoInstalavel`, então com Opção B ele viraria "Abrir + lixeira" — **mas com a mitigação acima, ele também fica bloqueado para pré-existentes** (a lixeira só aparece se o FAP instalou).

- **Sessão 4 (Dispositivos)** — o toggle `input-group-add` detecta se o usuário já está no grupo `input` via `SystemState.membroDoGrupo('input')`.

- **FreeCAD (sessão 6) não chamava `instalarFlatpak`.** O botão tinha `onclick="instalarDnf('instalar-freecad')"` no HTML, mas o app está registrado em `APPS_FLATPAK`, não em `APPS_DNF`. `instalarDnf` fazia `if (!info) return;` silenciosamente — o clique não fazia nada. Corrigido para `onclick="instalarFlatpak('instalar-freecad')"`.

- **Avidemux (sessão 6) usava binário/app-id errado.** A cadeia de aberturas erradas: `avidemux` (não existia) → `avidemux3_qt5` (não existia) → finalmente `gtk-launch org.avidemux.Avidemux` (correto — o `.desktop` oficial no Fedora 44 é `org.avidemux.Avidemux.desktop`, não mais `avidemux.desktop`).

- **MPV (sessão 6) usava `gtk-launch io.mpv.Mpv`** (app-id de flatpak). O pacote `mpv` do Fedora instala `mpv.desktop`, não `io.mpv.Mpv.desktop`. Corrigido para `gtk-launch mpv`.

- **Lightworks (sessão 6) ficava em "✅ instalado" em vez de "Abrir X" na recarga.** `restaurarEstadoSessao` chamava `aplicarEstadoInstalavel('instalar-lightworks', null)` — passando `null` no `idAbrir`. Sem botão de abrir, `aplicarEstadoInstalavel` caía no Estado 3 (cinza), apagando o swap "Instalar → Abrir" que `instalarLightworks` aplicava corretamente após a instalação. Corrigido para `aplicarEstadoInstalavel('instalar-lightworks', 'abrir-lightworks')`.

- **KRDC e GNOME Connections (sessão 6) tinham lixeira escondida.** `_ajustarFerramentasPorDesktop()` escondia o `.btn-flatpak-wrapper` inteiro quando o pacote nativo do desktop (KRDC em KDE, GNOME Connections em GNOME) já estava instalado — mas a lixeira é criada **dentro** do wrapper por `_mostrarLixeira`, então sumia junto. Com a Opção B, isso passou a ser redundante (o `aplicarEstadoInstalavel` já trata pré-existente como "Abrir + lixeira") e prejudicial. A chamada foi removida de `restaurarEstadoSessao`. As funções `_ajustarFerramentasPorDesktop` e `_esconderSePacoteInstalado` permanecem definidas como código morto (não chamadas), para minimizar o diff.

- **Lightworks e OnlyOffice pediam senha de root ao abrir (menu FAP).** `setsid -f lightworks` e `setsid -f desktopeditors` não estavam na whitelist `COMANDOS_SEM_AUTENTICACAO`, então caíam no `pkexec` — popup nativo de autenticação para abrir um app GUI. Adicionados à whitelist.

- **Entradas mortas de Avidemux na whitelist.** As entradas `setsid -f avidemux3_qt5`, `setsid -f avidemux3_gtk` e `setsid -f avidemux3_cli` referenciavam binários que **não existem no Fedora 44**. Removidas. O botão agora usa `gtk-launch org.avidemux.Avidemux`, que é coberto pela entrada única `setsid -f gtk-launch`.

- **`abrirLightworks()` usava `setsid -f lightworks` (binário direto).** Trocado para `gtk-launch lightworks` (o `.desktop` oficial), que é mais robusto contra mudanças no nome do wrapper entre releases (`lightworks`, `lightworks2023`, `lightworks-2023`).

- **`gtk-launch` e `waydroid show-full-ui` não estavam em `COMANDOS_USER_CONTEXT`.** Quando o `node server.js` era iniciado num contexto sem `DBUS_SESSION_BUS_ADDRESS` (systemd user unit, SSH sem forwarding, ambientes restritos), todos os botões "Abrir X" de flatpaks e vários de dnf falhavam silenciosamente — o `gtk-launch` não conseguia falar com o D-Bus do usuário. Ambos os comandos foram adicionados à lista, e `_precisaEnvUserContext()` agora ajusta `XDG_RUNTIME_DIR`, `DBUS_SESSION_BUS_ADDRESS` e `HOME` para eles.

### 🎨 Interface

- **Opção B implementada em `aplicarEstadoInstalavel`:** pré-existente é tratado **identicamente** a instalado pelo FAP (exceto os 14 itens protegidos). O usuário não precisa mais entender a distinção "quem instalou" — se o app está no sistema, o botão mostra "🚀 Abrir X" + lixeira. A transparência fica em duas camadas discretas:
  - **Tooltip no botão de abrir** quando pré-existente: *"Este app já estava instalado antes do FAP. A lixeira remove o app do sistema, mas o FAP não foi o responsável pela instalação."*
  - **Prefixação do `confirmMsg` da lixeira** quando pré-existente: o `confirm()` começa com *"⚠️ ATENÇÃO! Este app já estava instalado antes do FAP. Removê-lo do sistema pode apagar configurações e dados que você criou (perfis, favoritos, saves)."*

- **Espaço vazio abaixo do "Abrir Obsidian" (sessão 6) resolvido.** A causa era o design antigo: pré-existente empilhava dois botões (cinza "Já instalado" + verde "Abrir X" criado por `_criarBotoesAbrir`). Com a Opção B, o botão de instalar **é** o botão de abrir — um só, com a lixeira ao lado. O espaço vazio desaparece em todas as sessões, não só na 6.

- **Reverter oculto em estados iniciais** (sessão 4 e sessão 12). Antes era visível mas desabilitado (opacidade 0.5). Agora fica `display: none` até existir algo a reverter. Consistente com o padrão visual das demais sessões.

- **Botão "Abrir X" com tooltip explicativo** quando o app é pré-existente. O tooltip substituiu o antigo "tooltip no botão de instalar" (que não existe mais no estado pré-existente, porque o botão de instalar virou botão de abrir).

- **Botão "✅ Já estava ativo" com tooltip estendido** para os 14 itens protegidos. O tooltip mostra o `motivoBloqueio` — que inclui o comando exato de reversão manual, caso o usuário queira desfazer a configuração.

### 🔧 Melhorias

- **`_sincronizarEstadoFlatpaks` não marca mais como executado.** Antes, a cada boot, a função chamava `marcarComoExecutado(idComando)` para todo Flatpak instalado no sistema. Isso gravava o id em `.progresso.json`, e a partir do 2º boot o app parecia ter sido instalado pelo FAP — o tooltip de pré-existente e o prefixo do `confirmMsg` desapareciam. Agora a função só chama `aplicarEstadoInstalavel(idComando, idAbrirMarc)`, que detecta pré-existência via `SystemState` e aplica o estado correto **sem gravar nada em `.progresso.json`**. Efeito colateral: a barra de progresso global ("N/M sessões concluídas") deixa de contar esses apps como "feitos pelo FAP" — tecnicamente correto, já que o FAP não os instalou.

- **`_executarRemocaoApp` aceita remoção via `SystemState`.** Antes, a lixeira só funcionava se `isExecutado(idComando) === true` (isto é, se o `.progresso.json` marcava o app). Para pré-existentes, o `.progresso.json` está vazio por design, então a lixeira ficava silenciosa. Agora aceita `isExecutado(idComando) || appJaInstaladoNoSistema(idComando)`. Bônus: depois de remover, chama `SystemState.invalidar()` para que o próximo `appJaInstaladoNoSistema` veja o estado real (sem cache obsoleto).

- **`appJaInstaladoNoSistema` cobre `modo: 'desfazerTudo'`** — Rclone Manager agora declara `pacotes: ['rclone-manager', 'rclone']` no registro, permitindo detectar pré-existência mesmo sem o `tipo`/`idDesfazer` clássicos.

- **`SystemState.carregar()` chamado no `DOMContentLoaded` e no evento `sessao-carregada`** — o cache cliente fica populado antes de as sessões pintarem os botões. Janela de corrida de ~500 ms coberta pelo `setTimeout` de restauração.

- **`_sincronizarEstadoFlatpaks` unificado com `SystemState`.** A função deixou de fazer um `fetch('/flatpak-installed')` próprio e passou a consultar `SystemState.flatpakInstalado()`, que por baixo usa `/system-state`. Eram 2 requisições por boot para a mesma informação; agora é 1. Bônus: o `_sincronizarEstadoFlatpaks` herda o cache cliente de `SystemState` (que já está populado pelo `DOMContentLoaded` do `script.js`), eliminando o throttle paralelo de 30s que existia na função antiga.

- **TTL do `/system-state` reduzido de 5 min para 60s.** Com o `/system-state` sendo a fonte única para repositórios, pacotes e Flatpaks (após a unificação acima), o cache de 5 min deixava a detecção de mudanças externas defasada demais. 60s alinha com o throttle cliente e mantém o custo de 1 `dnf repolist` a cada 60s de uso ativo — equivalente a ter um terminal com `watch -n 60 dnf repolist` (desprezível em SSD).

- **Campo `origem` no `.progresso.json` (só auditoria).** Cada comando marcado como executado agora grava `origem: { "<idComando>": "fap" }` no arquivo de progresso. **O FAP nunca lê esse campo** — a decisão de mostrar "🚀 Abrir X" para pré-existentes continua sendo runtime, via `appJaInstaladoNoSistema()` (cruza `.progresso.json` com `/system-state`), que é auto-corretiva. O campo existe apenas para inspeção manual do `.progresso.json` (auditar "o que o FAP instalou" sem precisar comparar com o sistema). O `GET /progress` e `GET /status` passam a devolver o campo, e o `POST /progress` **preserva** o que já estava no arquivo (o cliente não o envia, o servidor não o apaga).

### 🧹 Limpeza

- **`system-state-service.js` adicionado** ao `Makefile` (`check-basico` valida sintaxe) e ao `install.sh` (`ARQUIVOS_PRINCIPAIS`) e `iniciar_fap.sh` (`verificar_arquivos`, erro fatal se ausente).

- **Código morto identificado mas mantido** (minimização de diff, ainda referenciado em testes): `_ajustarFerramentasPorDesktop` e `_esconderSePacoteInstalado` em `aplicativos.html`. Nenhuma sessão as chama desde esta versão; remoção planejada para a próxima.

- **Entradas mortas de Avidemux removidas da whitelist** (`setsid -f avidemux3_qt5`, `avidemux3_gtk`, `avidemux3_cli`) — binários inexistentes no Fedora 44.

---

## v1.1.0-10182026

Primeira release da série 1.1.0. Consolida as correções da `1.0.0-10152026.d` e entrega três correções de estabilidade que afetavam diretamente o uso diário: CoreCtrl/LACT sem lixeira, apps que falhavam a instalação (FreeCAD, Opera, Heroic) e o OpenRazer que instalava mas não funcionava por falta dos headers do kernel.

### 🐛 Correções

- **Lixeira aparecendo em CoreCtrl e LACT (sessão 3).** Os botões de instalar desses dois apps ficavam soltos em `.grupo-botoes`, sem o `.btn-flatpak-wrapper` que `_mostrarLixeira` exige para ancorar o ícone. Ao instalar, o botão ficava cinza mas a lixeira nunca aparecia. Agora `_mostrarLixeira` **cria o wrapper na hora** se ele não existir no HTML — beneficia qualquer botão presente ou futuro, sem exigir alteração em cada sessão. (Defesa em profundidade: os dois botões também foram embrulhados no HTML, mantendo consistência com o padrão das outras sessões.)

- **FreeCAD, Opera e Heroic migrados para Flatpak.** O botão de FreeCAD falhava silenciosamente porque o pacote saiu dos repositórios oficiais do Fedora. Opera e Heroic falhavam com o repo oficial do fabricante. Todos os três agora instalam via Flathub (`org.freecad.FreeCAD`, `com.opera.Opera`, `com.heroicgameslauncher.hgl`), usando o mesmo fluxo dos outros apps Flatpak — inclusive a fila de instalação e a sincronização de estado do `.progresso.json`.

- **Lightworks agora vira "🚀 Abrir Lightworks" após instalar.** A chamada passava `null` como `idAbrir` para `aplicarEstadoInstalavel`, o que forçava o Estado 3 (cinza, sem "Abrir") porque não havia `btn-abrir-lightworks` no HTML. Agora o botão de abrir existe e a chamada aponta para ele. Abre em sessão própria via `setsid -f lightworks`, como todos os outros apps GUI.

- **Rclone Manager é removido de fato pelo "desfazer tudo".** O `comandoDesfazer` só removia pacotes `rclone*` via `dnf`. Deixava órfãos: `.desktop` no menu iniciar, ícone hicolor, `~/.local/share/rclone-manager/` e `~/.cache/rclone-manager/`. O usuário via o app no menu mesmo após clicar em "remover completamente". Agora o comando apaga todos esses resíduos. **As contas do usuário em `~/.config/rclone/` continuam intactas** — o `confirmMsg` específico do Rclone Manager deixa isso explícito.

- **OpenRazer instala com `kernel-devel` do kernel em execução.** Antes, o `dnf install polychromatic openrazer-daemon openrazer-kernel-modules-dkms` falhava com exit 21 porque o `posttrans` do DKMS não conseguia compilar o módulo contra o kernel em execução (faltavam os headers daquele kernel específico). O FAP interpretava como falha total, mas o Polychromatic ficava instalado **e sem driver** — o usuário achava que nada tinha sido instalado. Agora o comando instala `kernel-devel-$(uname -r)` e `kernel-headers-$(uname -r)` antes, tenta `akmod-openrazer` se disponível no repo oficial, e usa `dkms` como fallback. No final, verifica se o módulo carregou e avisa se é preciso reiniciar.

### 🎨 Interface

- **OBS Studio e Câmera Virtual lado a lado (sessão 5).** Antes ficavam empilhados, cada um ocupando uma linha inteira. Agora ficam em 2 colunas iguais (`dashboard-grid` com `grid-template-columns: 1fr 1fr`), cada uma com seu próprio botão, lixeira e barra de progresso. Vira 1 coluna em telas pequenas.

- **Sessão 4 exibe botões progressivamente.** Os itens OpenRazer, Xbox Wireless e Broadcom exibiam os 3 botões simultaneamente (repo / instalar / reverter), mesmo quando os dois últimos não faziam sentido. Agora a progressão é: só o botão de ativar repo aparece → clicar nele revela o de instalar → instalar revela o de reverter. Os toggles `firmware-vendor`, `input-group` e `steam-devices` também passam a esconder o botão de reverter até o install ser marcado. **Comportamento restrito à sessão 4** — as outras mantêm o padrão atual (reverter visível mas desabilitado).

### 🗑️ Remoções

- **Sessão 7 (Casa e Escritório): item "PDF e OCR" removido.** O Fedora já traz o Okular por padrão, e o OCR do Tesseract estava fora do escopo do FAP. Bloco HTML, `registrarAppRemovivel`, funções `executarOkularTesseract()` e `abrirOkular()`, entradas de `SESSOES` e chaves i18n removidas. O Okular **continua** disponível na sessão 6 (Aplicativos), onde já era oferecido separadamente.

- **Sessão 8 (Gaming): item "Gamescope Session" removido.** O pacote `gamescope-session-steam` vem de COPR de terceiros e não está estável nos repositórios oficiais. Bloco HTML, `registrarAppRemovivel`, `executarGamescopeSession()`, entradas de `SESSOES` e chaves i18n removidas. O `install.sh --uninstall` mantém a limpeza residual (`/usr/bin/gamescope-session`, `.desktop`, pacote, COPR) para quem instalou em versões anteriores.

### 🧹 Limpeza

- **Código morto removido:**
  - `_MAPA_ABRIR_EXCECOES`: só tinha uma entrada (`okular-tesseract-install` → `abrir-okular`), removida com o item de PDF/OCR. Mapa agora vazio.
  - Funções `executarOkularTesseract` e `abrirOkular` (sessão 7).
  - Função `executarGamescopeSession` (sessão 8).
  - Entradas `okular-tesseract-install`, `okular-tesseract-remove`, `gamescope-session-install`, `gamescope-session-remove` do array `SESSOES`.

### 🌐 Internacionalização

- **Novas chaves adicionadas em `locales/en.json` e `locales/es.json`:**
  - `sessoes.producao-multimidia.obs_coluna_titulo` e `cam_coluna_titulo` (títulos das colunas do OBS e Câmera Virtual).
  - `sessoes.aplicativos.btn_abrir_lightworks` (texto do botão "Abrir Lightworks").
- **Chaves removidas** com as duas features deletadas: `pdfocr_titulo`, `okular_tesseract_*`, `btn_okular_tesseract`, `texto_concluido_okular_tesseract`, `btn_abrir_okular`, `gamescope_session_titulo`, `gamescope_session_desc`, `gamescope_session_aviso`, `btn_gamescope_session`, `texto_concluido_gamescope_session`.
