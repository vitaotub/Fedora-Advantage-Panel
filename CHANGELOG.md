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

## v1.6.2-22112026

Release com **correções** e **duas novidades** sobre a `v1.6.1-11172026`: (1) as sessões **Hardware** (AMD / Intel / NVIDIA) e o tratamento de **Secure Boot**; (2) uma varredura de **todos os arquivos e sessões** (HTML, i18n, GRUB, remoções via DNF5, scripts de shell, Flatpak, firmware, USB); (3) novo quadrado **"!" Sobre o software** nos botões de instalação e aviso de **Flatpaks instalados como root**. Nenhuma sessão nova; as mudanças visuais são o quadrado "!", o aviso de Flatpak de sistema (só aparece quando há o que limpar) e o botão Reverter de firmware removido. Inclui tudo da 1.6.1 (segurança do servidor, Codecs, container) — ver "Incluído da 1.6.1".

### 🔴 Removido — verificação de reinício pendente (atualizações do Fedora)

- O FAP não trata mais nada relacionado a atualizações do Fedora: removidos o aviso "Reinicie o computador para aplicar as atualizações" da Sessão 1, a rota `GET /reboot-needed` (`dnf needs-restarting -r`), a função `_verificarRebootNecessario`, as chaves i18n `aviso_reboot_*` e a seção de troubleshooting correspondente dos READMEs. Resta apenas o aviso amarelo informativo da Sessão 1. (O aviso de reinício após instalar driver/Secure Boot na sessão Hardware é outro recurso e foi mantido.)

### 🔴 Removido — GNOME Boxes

- O bloco do **GNOME Boxes** saiu da sessão Virtualização (botão, registro de lixeira/Abrir, tradução, popup "Sobre" e validador). Ele dependia do libvirt/QEMU e era removido junto com o QEMU/KVM. A sessão agora tem QEMU/KVM + virt-manager e VirtualBox. Popup "Sobre o software": **105** apps.

### 🔴 Lixeira de um app não atualizava os outros que o DNF removeu junto

- Remover QEMU/KVM + libvirt faz o DNF remover também o **GNOME Boxes** (dependência). O botão do Boxes continuava "Abrir" e a lixeira dele dizia "não está instalado" até recarregar. Agora, após qualquer remoção, o FAP relê o estado real e repinta os demais botões instaláveis; a lixeira de um app já removido por fora também corrige o botão antes do aviso. O aviso de confirmação do QEMU/KVM já cita o GNOME Boxes.

### 🟢 NTSYNC — o botão agora muda para "ativado", persiste e tem lixeira

- Causa: o FAP verificava o pacote `wine-ntsync`, que é só um *Provides*; o RPM real é `ntsync-autoload`. Agora o estado vem da checagem real do módulo carregado (`/sys/module/ntsync` ou `/dev/ntsync`, campo novo `kernel_modules_loaded` em `/system-state`) e é relido como nos demais botões.
- Ao clicar: instala `ntsync-autoload`, carrega o módulo, o botão vira "✅ NTSYNC ativado" e o estado fica salvo.
- Lixeira: descarrega o módulo (`modprobe -r`) e desativa o carregamento automático mascarando `/etc/modules-load.d/ntsync.conf`; o pacote é mantido (não é cascateado).
- Novo campo opcional `detectar` em `registrarAppRemovivel` (função de detecção do estado real).

### 🟡 Firmwares adicionais — sem lixeira (de propósito)

- Instalar é inofensivo, mas **remover** não é: o `linux-firmware` exige esses subpacotes e o `dnf remove` arrastaria o `linux-firmware` inteiro (Wi-Fi/vídeo sem firmware). Por isso o botão fica cinza "✅ Instalado", sem lixeira. A lixeira que aparecia após o clique foi removida.

### 🔴 Virtualização — apps já instalados apareciam como "Já estava ativo"

- QEMU/KVM, VirtualBox e GNOME Boxes agora mostram **Abrir** + lixeira quando já instalados (como na sessão Aplicativos). QEMU/KVM tem remoção própria que filtra os pacotes realmente instalados.

### 🟠 Sessão 1 — botão "Atualizar Fedora" removido

- Em seu lugar, aviso com **contorno e texto amarelos** (`.aviso-atencao`, claro/escuro, PT/EN/ES) explicando a necessidade de manter o Fedora sempre atualizado: sessões e recursos do FAP funcionam melhor com o sistema completo e atualizado; sistema desatualizado pode causar problemas no sistema, na segurança e nos recursos do FAP. O aviso de reinício pendente foi mantido.

### 🔴 Removido — upgrade 44 → 45

- O Fedora 45 já foi lançado: removidos o acordeão "Upgrade do Fedora", os botões pós-upgrade, a rota `/fedora-upgrade-status`, a detecção no `server.js`, os IDs `upgrade-f45-*`/`pos-upgrade-*` (limpos do `.progresso.json` automaticamente) e 88 chaves i18n `upgrade_*`. O FAP segue suportando Fedora 44 e 45.

### 🔍 Auditoria dos demais botões que não são software

- Drivers de vídeo (Vulkan/VA-API Intel/AMD/NVIDIA), RPM Fusion, idioma, GRUB e manutenção **não ganham lixeira**: remover cascateia em pacotes críticos (Steam, Mesa, codecs) ou já tem botão de reverter. Nenhuma lixeira nova foi adicionada para evitar risco em instalações de usuários.

### ✅ Validação

- `make check-basico` 12/12; `node --check`/`bash -n` OK; navegação Chromium nas 13 sessões sem erros (só CORS esperado sem internet); Sessão 1 verificada (sem botão, caixa amarela). Locales en/es: **1182** chaves cada, paridade perfeita. Contratos: 160 `data-comando`, 97 `registrarAppRemovivel`, 34 `_registrarAbrir`. Não testado em Fedora real (ntsync, remoção e Abrir dependem do sistema).

### 🔴 Corrigido — "Firmwares adicionais de fabricantes" instalava o pacote errado

- O botão instalava `linux-firmware-vendor`, que na verdade é do projeto Asahi Linux (Apple Silicon) e só cria a pasta `/lib/firmware/vendor`: não trazia nenhum firmware Realtek/Intel como o texto prometia.
- Agora instala os **subpacotes de firmware do `linux-firmware`** do Fedora (Wi-Fi/Bluetooth Realtek, Intel, MediaTek, Atheros, Broadcom, NXP, TI; GPUs AMD/Intel/NVIDIA; áudio Intel/Cirrus) com `dnf install -y --skip-unavailable`, ignorando o que não existir na versão do Fedora. Textos PT/EN/ES atualizados.
- O botão **Reverter** foi removido: o `linux-firmware` exige esses subpacotes, então `dnf remove` arrastaria o próprio `linux-firmware` e deixaria Wi-Fi/vídeo sem firmware. A lixeira também fica bloqueada com explicação.
- Popup "Sobre o software": descrições de ArtCraft Launcher, Lightworks e Realtek r8168 atualizadas com as informações fornecidas.

### 🟢 Novo — Quadrado "!" "Sobre o software" em todos os botões de instalação

- Ao lado do quadrado colorido de origem (RPM, COPR, repositório oficial, Flathub, fabricante, download) de **todos os 105 botões de instalação** há agora um quadrado cinza-azulado com "!". O clique abre um popup com **o que é**, **para que serve**, **quem desenvolve** e o **site oficial**, em PT/EN/ES.
- Os textos são fixos, em `apps_sobre.json` (servido por `GET /apps-sobre`), escritos a partir de fontes oficiais: ficha do app no Flathub, site/repositório oficial do projeto e páginas dos pacotes no Fedora/RPM Fusion. Nada é buscado na internet em tempo de uso.
- Quando a descrição não pôde ser confirmada em página oficial (Foliate e QEMU/KVM), o popup avisa e aponta o site oficial. Descrições do ArtCraft Launcher, Lightworks e Realtek r8168 vêm das informações oficiais fornecidas pelo autor do FAP.
- O círculo amarelo/azul de aviso (`fap-badge-info`) continua existindo nos apps que o têm e passa para a 3ª posição.

### 🔴 Corrigido — Flatpak do Flathub não instalava ("Nenhum remoto escolhido")

- Quando o remoto `flathub` existe **no sistema e no usuário**, `flatpak install flathub X` pergunta qual usar; sem terminal a pergunta é abortada e a instalação falha. O problema era ambiental (Flatpaks antigos instalados como root), não da limpeza de código.
- O servidor agora **força o nível de usuário**: todo `flatpak install`/`remote-add` simples do Flathub vira `--user`, o `sudo` é removido e o remoto `flathub` do usuário é garantido antes da instalação. Comandos encadeados (`&&`), `--system` e `remote-delete` não são reescritos.
- Nova rota `GET /flatpak-diagnostico` (somente leitura) e, na sessão **Aplicativos**, um aviso com a lista dos Flatpaks instalados no sistema e o botão **Remover Flatpaks do sistema** (pede confirmação, remove com os dados e o aviso some).

### 🔴 Corrigido — Desinstalar app DNF pela lixeira deixava o botão em "Abrir"

- O cache do servidor (60 s) não era renovado após a remoção, então o app ainda aparecia como instalado. A remoção agora invalida o cache local **e** força a releitura no servidor.

### 🔴 Corrigido — setroubleshoot: "Abrir" não abria a ferramenta

- O `sealert -b` precisa do pacote gráfico `setroubleshoot`, que não era instalado. Ele entrou na instalação e na lixeira; quem já tinha só o `-server` recebe o convite para instalar a interface ao clicar em Abrir.

### 🟡 Corrigido — Diagnóstico: "Top processos" mostrava média de vida, não uso atual

- O `/top-processes` usava `ps -o pcpu`, que é a CPU média desde o **início** do processo (um navegador aberto há horas aparecia quase em 0% mesmo travando a máquina agora). Agora o servidor lê `utime+stime` de `/proc/<pid>/stat` duas vezes, com 500 ms de intervalo, e calcula o delta (o mesmo método do `top`; % de um núcleo, pode passar de 100 em multithread). A memória continua via `ps`. Testado com um processo ocupando CPU: aparece em ~99%.

### 🧹 Limpeza de código morto e duplicado (sem mudança de comportamento)

Critério: só saiu o que uma análise estática (acorn) e buscas em todos os arquivos mostraram sem nenhuma referência — nem direta, nem por prefixo dinâmico, nem em atributos HTML. Verificado depois carregando as 13 sessões no Chromium real: zero erros de JavaScript.

- **JS:** função `ehPreExistente` (script.js), variável `btn` em `registrarAppRemovivel`/remoção de ícone, `_home` (ajustes-manutencao), `containerPath` (server.js), `extrairMapaOrigem` + `mapaOrigem` (validar-botoes.js); imports sem uso (`exec` em hardware-service.js e system-state-service.js, `path` em system-state-service.js).
- **Duplicação:** 22 cópias idênticas de `_t`/`_tVars` nas sessões (já definidas globalmente em script.js, carregado antes de qualquer sessão) e a cópia de `_escapeHTML` em dispositivos-perifericos.html. Só saíram cópias com corpo **idêntico** ao canônico.
- **i18n:** 25 chaves sem referência em en/es (landing.*, seletor.*, comum.btn_* antigos, etc.); ambos os arquivos agora têm **1271** chaves. Chaves montadas dinamicamente (`'sessoes.' + id`, `btn_abrir_<app>`, `notesKey` do mapa de hardware) foram preservadas.
- **CSS:** regras do menu horizontal legado (`.session-menu`, `.session-menu-wrapper`, `.session-icon/label/numero`) e do bloco `.fap-status-*` (a landing não usa mais). `.session-menu-item`, que a sidebar reaproveita, foi mantido.
- **Mantido de propósito:** `restaurarEstadoSessao`, `APPS_FLATPAK`, `_fetchJSON` e `_atualizarBotaoAbrir` repetidos entre sessões — cada sessão é reexecutada por `eval` e usa a sua própria versão/dados.

### 🟢 Novo — Periféricos USB reconhecidos (`usb_devices` do `hardware_map.json`)

- **Antes:** `usb_devices` estava vazio, então nenhum periférico USB era reconhecido e o código USB do `hardware-service.js` nunca produzia resultado; além disso, a interface não sabia instalar nada para cartões USB (mostraria "pacote `?`" sem botão).
- **Agora:** o mapa aceita chave exata `vid:pid` **ou** curinga de fabricante `vid:*` (exata tem precedência). Primeira entrada: **Razer (`1532:*`)** → recomenda o OpenRazer. O cartão diz que o periférico foi detectado, avisa que o driver vem de repositório de comunidade e traz o botão **"Ir para a instalação guiada"**, que abre o acordeão "Drivers da comunidade" e destaca o bloco do OpenRazer (repo + pacote + grupo `plugdev` já existentes). Vários dispositivos do mesmo item (teclado + mouse) viram **um** cartão com contagem.
- **Robustez:** sem `usbutils` (Fedora mínimo) o `lsusb` não existe; o FAP agora lê `/sys/bus/usb/devices` como alternativa. "Instalado" passa a significar qualquer um dos pacotes listados (`packages`).
- **Decisão consciente:** controles Xbox com fio funcionam com o `xpad` do kernel e o `xpadneo` é só para Bluetooth; por isso **não** mapeei o fabricante Microsoft (`045e`), para não sugerir driver desnecessário. Novos periféricos entram só com pacote de repositório confirmado.
- Chaves novas em en/es (+5).

### 🔴 Corrigido — install.sh: confirmação não-interativa sempre respondia "não"

- `_perguntar_sim_nao` usava `read -t 0`, que **não lê nada** (só testa disponibilidade): a variável ficava vazia e a resposta virava sempre "n"; em `< /dev/null` o EOF contava como "dado disponível". Reproduzido: `echo s |` devolvia NÃO. Agora lê a linha de verdade (timeout de 3 s) e cai no padrão com stdin vazio. Testado com `echo s`, `echo n`, linha vazia, `/dev/null` e produtor atrasado. O prompt interativo também mostra `S/n` quando o padrão é "s".

### 🔴 Corrigido — Desinstalar apagava o config original do MangoHud/GameMode

- O FAP guarda o config do usuário em `*.fap-backup` antes de sobrescrever; a lixeira da Sessão 8 restaura, mas o `install.sh --uninstall` apagava preset **e** backup. Agora restaura o backup (e só remove o preset quando não há backup). Testado em HOME isolado.

### 🟡 Corrigido — install.sh: opção inválida instalava tudo

- Um argumento errado (ex.: `--updte`) caía numa instalação completa. Agora responde "Opção desconhecida" e sai com código 2. Também: a linha de PATH não é mais duplicada em `.bashrc`/`.zshrc` em reinstalações, `fap-compat` só é anunciado quando existe, e emojis duplicados nas mensagens finais foram removidos.

### 🟡 Corrigido — Diagnóstico: auto-refresh acumulava timers

- O script da sessão roda de novo a cada visita e o `setInterval` (30 s) guardava o id numa variável local — o guarda nunca barrava e cada visita empilhava mais um timer, que seguia atualizando o painel mesmo com a sessão fechada. Agora o id fica em `window`, o anterior é cancelado e o timer se encerra sozinho quando a sessão sai do DOM.

### 🟡 Corrigido — Changelog renderizado: links com esquema disfarçado

- O renderizador Markdown do servidor bloqueava `javascript:` por lista negra, que `java<TAB>script:` contornava. Agora é lista de permitidos (`http(s)`, `mailto`, `#`, caminho relativo), ignorando caracteres de controle. Também: `aria-label` "Fechar" do popover de origem passou a ser traduzido.

### 🔴 Corrigido — Hardware: placas de rede apareciam como GPU (e vice-versa)

- **`hardware-service.js` → `scanHardware`.** A categoria do dispositivo vinha do **fabricante** (`hardware_map.json`), não da classe PCI real. Reproduzido com `lspci` falso: uma Intel I225-V (Ethernet) e uma Intel AX200 (Wi-Fi) saíam como `gpu` com `intel-media-driver`; um Wi-Fi Realtek saía como `ethernet` com `akmod-r8168`; uma Ethernet Broadcom saía como `wifi` com `akmod-wl`. Efeitos: seção Intel da Sessão Hardware "detectando" GPU inexistente e cartões de Dispositivos oferecendo driver errado.
- **Correção:** a classe vem do `lspci` (`VGA/3D/Display` → `gpu`; `Ethernet` → `ethernet`; demais `Network` → `wifi`). O mapa só vale quando a classe real bate com a categoria dele; caso contrário o dispositivo é ignorado. Casos legítimos (iGPU Intel + NVIDIA, Broadcom Wi-Fi, Realtek Ethernet) continuam detectados — testado nos dois cenários.

### 🔴 Corrigido — NVIDIA: "Reverter pro nouveau" falhava com pacotes não instalados

- **`hardware.html` → `executarNvidiaDriverRemove`.** O `dnf remove` listava todos os `akmod-nvidia*` possíveis; o DNF5 responde "No match for argument" para os que não estão instalados e o comando inteiro falhava — como o resto era encadeado com `&&`, o `autoremove` nunca rodava e a reversão ficava pela metade (um usuário Ampere nunca tem `akmod-nvidia-open` nem `-580xx`).
- **Correção:** filtra com `rpm -q` só o que está instalado, inclui `xorg-x11-drv-nvidia*` e `kmod-nvidia*` via `rpm -qa`, e cancela um reboot de segurança ainda pendente. Simulado com `rpm`/`dnf` falsos: Ampere, Blackwell e "nada instalado" terminam com sucesso; o comando antigo falhava no primeiro caso.

### 🟡 Corrigido — NVIDIA: reboot de segurança continuava agendado após falha

- **`hardware.html` → `executarNvidiaDriver`.** O `shutdown -r +10` (v1.5.9) era agendado antes de qualquer verificação e **nunca cancelado**: se o `dnf install`, o `akmods` ou o `modinfo` falhasse (e o driver fosse revertido), o computador reiniciava sozinho 10 minutos depois, possivelmente no meio do trabalho do usuário.
- **Correção:** o agendamento passou a vir **depois** da detecção da GPU, e todos os caminhos de falha executam `shutdown -c`. O caminho de sucesso é o mesmo de antes (reboot agendado, cancelável com `sudo shutdown -c`). Simulado: sem GPU → nada agendado; falha de `dnf`, de `akmods` e de `modinfo` → cancelado.

### 🟡 Corrigido — Secure Boot: botão de instalar só conferia o arquivo da chave

- **`hardware.html` → `_nvidiaSecureBootBloqueio()` (novo), usado por `_aplicarEstadoNvidia` e `executarNvidiaDriver`.** A trava só testava se `public_key.der` existia. Com a chave gerada mas **não registrada** no firmware, o akmod compilava e o módulo era recusado no boot. Além disso, o caminho de clique usava só o `SystemState`, divergindo do botão (que usa `/hardware-scan`).
- **Nova regra (uma só, para os dois caminhos):** sem chave → botão desabilitado (como antes); chave existe mas não registrada (nem importação pendente) → botão habilitado com aviso no tooltip e **confirmação explícita** ao clicar (não é bloqueio duro, porque o `mokutil` pode errar); importação pendente de reboot → liberado (o módulo carrega após o MOK Management); `mokutil` inconclusivo → liberado (sem falso positivo). 12 cenários testados.

### 🟡 Corrigido — VA-API: "Verificar Aceleração" herdava variáveis da NVIDIA

- **`server.js` → `/vaapi-check`.** Depois de "Configurar Variáveis" (NVIDIA) e novo login, o servidor herda `LIBVA_DRIVER_NAME=nvidia`; o `vainfo` de AMD/Intel passava a testar o driver da NVIDIA (erro ou resultado falso em notebooks híbridos). Agora AMD/Intel rodam com `env -u LIBVA_DRIVER_NAME -u NVD_BACKEND` e a NVIDIA com `LIBVA_DRIVER_NAME=nvidia NVD_BACKEND=direct` (o mesmo que o arquivo de variáveis grava). Verificado com `vainfo` falso.
- **`hardware.html` → `executarNvidiaVaapiEnv`.** Agora pede confirmação explicando que `MOZ_DISABLE_RDD_SANDBOX=1` desativa o sandbox de decodificação do Firefox e que `LIBVA_DRIVER_NAME=nvidia` vale para **todos** os aplicativos, com aviso extra quando há GPU Intel/AMD (notebook híbrido).

### 🔴 Corrigido — GRUB: "Aplicar Configuração Recomendada" apagava parâmetros de boot

- **`ajustes-manutencao.html` e `server.js` (preview) → `_mesclarCmdlineGrub()` (novo).** O botão regravava o `/etc/default/grub` inteiro a partir de um modelo, e `GRUB_CMDLINE_LINUX` virava sempre `"rhgb quiet"`. Isso descartava parâmetros que o instalador ou o usuário tinham ali — `rd.luks.uuid=` (disco criptografado), `resume=` (hibernação), `rd.lvm.lv=`, `nvidia-drm.modeset=1`, `amdgpu.*`, `intel_iommu=` — e um sistema com LUKS pode deixar de montar a raiz em um kernel instalado depois.
- **Correção:** os parâmetros existentes são **mantidos** e o FAP só garante `rhgb` e `quiet`. Valores com aspas internas, crase, `\` ou `$` (em aspas duplas) são mantidos exatamente como estão. A prévia (servidor e fallback do cliente) mostra o mesmo valor que será gravado. Testado com 12 formatos de valor.
- **Outras chaves preservadas.** Qualquer outra chave ativa do arquivo original que o modelo não gerencia (ex.: `GRUB_ENABLE_CRYPTODISK=y` — sem ela um `/boot` criptografado deixa de abrir —, `GRUB_THEME`, `GRUB_BACKGROUND`, `GRUB_SAVEDEFAULT`, `GRUB_CMDLINE_LINUX_DEFAULT`) é copiada ao final do arquivo novo, em bloco comentado. Linhas de várias linhas (aspas desbalanceadas) não são copiadas.

### 🟡 Corrigido — Remoções que falhavam inteiras no DNF5

- **`dispositivos-perifericos.html` → `driver-openrazer-remove`.** Listava 4 pacotes fixos; se um deles não estivesse instalado (o instalador usa `akmod-openrazer` **ou** o DKMS) o DNF5 recusava o `remove` inteiro, e os pacotes de módulo (`akmod-openrazer`, `openrazer-kernel-modules-dkms`, `kmod-openrazer*`) nunca eram removidos. Agora filtra com `rpm -q` e inclui esses pacotes. Simulado em 3 cenários.
- **`diagnostico.html` → CoolerControl.** `dnf remove coolercontrol liquidctl` falhava inteiro se só um dos dois estivesse instalado. Mesmo filtro.

### 🟡 Corrigido — Scripts: `lsof -i:3000` matava o processo errado

- **`iniciar_fap.sh` (início e saída) e `scripts/fap-cleanup.sh`.** Sem `-sTCP:LISTEN`, o `lsof -t -i:3000` devolve também os **clientes** conectados (navegador ou container com o FAP aberto) e o `kill -9` seguinte os matava. O `install.sh` já tinha essa correção documentada; os outros três pontos tinham ficado de fora. Agora os quatro usam `-sTCP:LISTEN`.

### 🟡 Corrigido — HTML: blocos sem fechamento nas sessões

- **`producao-multimidia.html`:** o bloco "OBS Studio" nunca era fechado, então o bloco "EasyEffects" ficava **aninhado dentro dele** (e herdava o estilo `destaque`). Agora são irmãos, como pretendido (mudança visual leve).
- **`gaming.html` (3 acordeões) e `ajustes-manutencao.html` (Manutenção):** faltava o `</div>` do `acordeao-conteudo`. O navegador fechava sozinho, sem efeito visível, mas era HTML inválido.
- **Prevenção:** novo `scripts/validar-html.js` (`make check-html`, chamado pelo `check-basico`) que acusa tag sem fechamento nos 15 HTML. Entrou nos manifestos do `install.sh`.

### 🟢 Corrigido — i18n

- **Mensagens de erro fixas em português** (`❌ Erro HTTP:` / `❌ Erro de conexão:`) em `ajustes-manutencao`, `estado-fedora`, `primeiros-passos` e `sobre-fap`: agora usam as chaves `comum.erro_http` e `comum.erro_conexao`, que já existiam.
- **❌ duplicado em EN/ES.** Cinco pontos escreviam `'❌ ' + _tVars('comum.erro_conexao', …)`, mas o texto traduzido já começa com ❌ (resultado: "❌ ❌ Connection error"). Corrigido em `ajustes-manutencao`, `aplicativos`, `dispositivos-perifericos`, `hardware` e `sobre-fap`.
- **Textos que nunca eram traduzidos** agora têm chave em `en.json`/`es.json` (+17 chaves): resultado do journal em Diagnóstico, mensagens do changelog/tooltip de atualização/dica de log em Sobre o FAP, linha de detecção Atomic/Tradicional em Estado do Fedora, falhas do journal/ArtCraft/erro genérico em Aplicativos e a falha de verificação do driver NVIDIA em Hardware.

### 🟢 Corrigido — Menores (Hardware)

- **`hardware-service.js` → `_akmodCarregado`:** procura também `hid_xpadneo` (nome real do módulo; só `xpadneo` nunca casava).
- **`hardware-service.js`:** campo `needs_secure_boot_disabled` (nunca lido, nome enganoso) substituído por `needs_signed_module` (`true` quando o driver sugerido é um `akmod-*`).
- **`script.js` → painel e badge de Secure Boot:** os textos de "não foi possível verificar o registro da chave" (`mokutil` indeterminado) e o botão "Verificar novamente" estavam fixos em PT-BR; agora usam `_t`/`_tVars` com chaves novas em `en.json` e `es.json` (+10 chaves; ambos os arquivos em **1274** chaves).

### Verificado sem alteração

- `mesa-va-drivers-freeworld` por `dnf install` (sem `swap`) é o método recomendado pelo RPM Fusion no Fedora 44 — mantido.

### Incluído da 1.6.1

Correção do regex de "abrir app" (comando sem autenticação + ReDoS), validação do cabeçalho `Host` (DNS rebinding), teto de 1 MB nos corpos de `/progress` e `/executar`, filtro de navegação do container com `GUri`, lixeira de Codecs Multimídia Essenciais sem `--skip-broken`, Lightworks/Telegram (série 1.6.0) e badges dos READMEs.

### ✅ Validação (20/11/2026)

- `make check-basico`: **12/12** (novo: balanceamento de tags HTML); `validar-botoes.js`: 170 `data-comando`, 13 sessões, 419 funções, 0 duplicatas.
- Varredura estática de todas as sessões: sintaxe de todos os `<script>` inline, handlers `onclick` sem função, ids duplicados, `getElementById` sem id, 116 comandos shell avaliados com `bash -n`, paridade EN/ES (1284 chaves, placeholders iguais).
- `_mesclarCmdlineGrub` e o filtro de chaves preservadas do GRUB: 12 formatos de `GRUB_CMDLINE_LINUX` e um `/etc/default/grub` com `GRUB_ENABLE_CRYPTODISK`, tema e valor multilinha.
- Remoção do OpenRazer simulada com `rpm`/`dnf` falsos (3 cenários).
- `scanHardware` real com `lspci` falso em dois cenários (desktop AMD + 4 placas de rede; notebook Intel+NVIDIA com Broadcom e Realtek).
- Scripts de instalação e remoção da NVIDIA extraídos do `hardware.html` real, `bash -n` OK e executados com `rpm`, `dnf`, `lspci`, `shutdown` etc. falsos.
- `_nvidiaSecureBootBloqueio` extraída do `hardware.html` real e testada em 12 cenários.
- `/vaapi-check` com o servidor real e `vainfo` falso, com `LIBVA_DRIVER_NAME=nvidia` herdado.
- Reescrita `--user` do Flatpak (8 casos), `/flatpak-diagnostico` e o aviso de Flatpaks de sistema com um `flatpak` simulado e o servidor real; `flatpak install` confirmado como `install --user` no log do stub.
- Quadrado "!" em 72 botões (Aplicativos e Jogos) no Chromium real: todos os ids têm texto, popup conferido em screenshot; navegação pelas 13 sessões sem erros de JS do FAP.
- Sessão Dispositivos e Periféricos com o botão de firmware novo (sem Reverter) carregada sem erros.

### 📌 Pendências de teste (hardware real)

- NVIDIA em todas as gerações: instalação, falha forçada (reboot cancelado), reversão para o nouveau com e sem `kmod-nvidia-*`.
- Secure Boot ponta a ponta: chave gerada → não registrada (confirmação) → `mokutil --import` → reboot → MOK → botão liberado.
- Notebook híbrido: aviso de "Configurar Variáveis" e "Verificar Aceleração" de AMD/Intel com a variável herdada.
- Não verificados (sem acesso ao RPM Fusion a partir do ambiente de análise): `intel-media-driver` por `dnf install` quando o `libva-intel-media-driver` do Fedora já está instalado (pode exigir `swap`); COPR `ilyaz/LACT` ainda é a fonte do LACT; `dnf swap ffmpeg ffmpeg-free` em `codecs.html`.
- GRUB: aplicar a configuração recomendada em máquina com LUKS/hibernação e conferir que `rd.luks.uuid=`/`resume=` continuam no `/etc/default/grub` e que `Reverter` restaura o original.
- `producao-multimidia`: conferir visualmente que "EasyEffects" ficou separado do bloco do OBS.
- Flatpak em nível de usuário: instalar um app do Flathub com o remoto duplicado (sistema + usuário), conferir o aviso de Flatpaks de sistema e o botão de limpeza.
- Lixeira de app DNF: o botão volta para "Instalar" logo após a remoção.
- setroubleshoot: botão Abrir abre a janela (pacote `setroubleshoot`).
- Firmwares de hardware: instalar os subpacotes em um Fedora real (e em um Fedora mínimo) e conferir o `--skip-unavailable`.
- Popup "Sobre o software": abrir em PT/EN/ES, tema claro, tela estreita e botões com o círculo de aviso (RustDesk, NVIDIA) para conferir o alinhamento dos 3 ícones.
- Periférico USB Razer: detecção e botão "Ir para a instalação guiada".
- Herdadas da 1.6.1: compilar o `fap-container`, botões "Abrir", lixeira de Codecs, MOK end-to-end, Intel legado, `pkexec` real, RustDesk com AVC, Opera/Brave/Vivaldi/Edge, NTSYNC, Firefox/Thunderbird após reversão.

### Arquivos tocados

- `hardware-service.js` — classe PCI real; `hid_xpadneo`; `needs_signed_module`
- `hardware.html` — `_nvidiaSecureBootBloqueio`; instalar (reboot cancelável); remover (filtro `rpm -q`); confirmação das variáveis VA-API; texto traduzível de verificação do driver; ❌ duplicado
- `ajustes-manutencao.html` — GRUB preserva parâmetros e chaves; `</div>` do acordeão; erros traduzíveis
- `server.js` — `/vaapi-check` com ambiente limpo; prévia do GRUB com `_mesclarCmdlineGrub`; Flatpak sempre `--user` (`_forcarFlatpakUsuario`); rotas `/flatpak-diagnostico` e `/apps-sobre`; `/top-processes` instantâneo; lista de links permitidos do changelog
- `script.js` — textos do `mokutil` indeterminado traduzíveis; quadrado "!" e popup "Sobre o software"; remoção DNF força a releitura do servidor; `limpar-flatpak-sistema`
- `apps_sobre.json` (novo) — textos do popup "Sobre o software" (105 apps, PT/EN/ES); incluído em `install.sh`, `.gitignore`, `iniciar_fap.sh` e no check JSON do `Makefile`
- `style.css` — `.fap-badge-sobre` e posições dos 3 ícones; remoção das regras do menu legado
- `hardware_map.json`, `hardware-service.js` — periféricos USB (Razer `1532:*`, curinga `vid:*`, leitura de `/sys/bus/usb/devices`)
- `dispositivos-perifericos.html`, `diagnostico.html` — remoções filtradas; textos traduzíveis; firmware: subpacotes do `linux-firmware`, sem Reverter; cartão USB
- `aplicativos.html` — aviso e limpeza de Flatpaks instalados como root
- `estado-fedora.html` — setroubleshoot (pacote GUI e convite de instalação)
- `producao-multimidia.html`, `gaming.html` — HTML balanceado
- `aplicativos.html`, `estado-fedora.html`, `primeiros-passos.html`, `sobre-fap.html` — textos/erros traduzíveis
- `iniciar_fap.sh`, `scripts/fap-cleanup.sh` — `lsof -sTCP:LISTEN`
- `scripts/validar-html.js` (novo), `Makefile`, `install.sh` — validador de HTML e manifestos
- `locales/en.json`, `locales/es.json` — +32 chaves e -25 removidas pela limpeza; +7 (aviso de Flatpak de sistema e setroubleshoot); +8 (popup "Sobre o software"); +firmware (3 textos reescritos, 3 chaves do Reverter removidas); 1284 no total
- `package.json`, `README.md`, `README.en.md`, `README.es.md` — versão `1.6.2-22112026`
- `CHANGELOG.md`, `RELEASE NOTES.txt`, `BRIEFING.md` — documentação
