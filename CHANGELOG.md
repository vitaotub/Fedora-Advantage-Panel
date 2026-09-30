# Changelog — Fedora Only Fans (FOF)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e o FOF usa versionamento baseado em data: `v1.0.0-MMDDAAAA`.

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FOF, na sessão **Sobre o FOF**.

> **Regra importante para quem for editar:** use apenas `## vX.Y.Z-...` para os
> cabeçalhos de versão. Dentro de uma seção, use `###` (três hashes) para
> subseções — um `##` no meio de uma versão encerra a captura do parser e o
> resto é descartado silenciosamente.

---

## v1.0.0-09292026

### 🔌 Nova sessão: Dispositivos e Periféricos

A sessão **Hardware** foi dividida em duas. A nova sessão
**Dispositivos e Periféricos** aparece logo depois de Hardware
(posição 4) e reúne tudo que não é driver gráfico: detecção
automática de hardware, firmwares e suplementos seguros, drivers
da comunidade via COPR, e controles/periféricos (movidos de
Hardware).

**Hardware** ficou focada em drivers gráficos (AMD, NVIDIA, Intel) —
a sessão ganhou um acórdeão **Intel** com drivers de vídeo Intel, e
o bloco de controles (que estava misturado com AMD/NVIDIA) foi movido
para a nova sessão.

#### 🎯 Detecção automática de hardware

- Novo endpoint `GET /hardware-scan` (via `hardware-service.js`)
- Novo arquivo `hardware_map.json` com o mapa de vendors (NVIDIA,
  AMD, Intel, Broadcom, Realtek Wi-Fi/Ethernet)
- Cruza IDs PCI/USB com o mapa e sugere pacotes; usa `nvidia-detect`
  quando disponível para refinar a sugestão da NVIDIA
- Detecta conflitos (ex.: Broadcom `akmod-wl` vs `brcmfmac`, Realtek
  `akmod-r8168` vs `r8169`) e mostra aviso quando o driver padrão já
  está funcionando
- Mostra banner de RPM Fusion desativado e aviso de Secure Boot +
  NVIDIA
- Detecção do estado real via `rpm -q` substitui o `.progresso.json`
  para esses drivers — mais confiável: se o usuário removeu o pacote
  manualmente, o botão volta ao estado inicial automaticamente

#### 📦 Suplementos seguros

- `linux-firmware-vendor` (firmwares adicionais de fabricantes)
- Botões separados de instalar/reverter

#### 🌐 COPRs de comunidade (Wi-Fi USB Realtek)

- RTL8811CU / RTL8821CU (`morrownr/8821cu`)
- RTL8812BU / RTL8822BU (`morrownr/8822bu`)
- RTL8812AU (`morrownr/8812au`)
- RTL8811AU (`morrownr/8811au`)
- Cada um com 4 botões: habilitar repositório, desabilitar repositório,
  instalar driver, reverter driver. **Os COPRs são opcionais** — o
  usuário escolhe se quer habilitar. Aviso explícito sobre riscos:
  mantidos por terceiros, podem ser descontinuados, FOF não controla
  o conteúdo.

#### 🎮 Controles e periféricos (movidos de Hardware)

- Adicionar/remover usuário do grupo `input`
- Instalar regras udev (`steam-devices`)

### 🟦 Hardware ganha acórdeão Intel

- `intel-media-driver` para aceleração de vídeo VA-API em iGPUs Intel
  Skylake ou mais recentes

### 🖥️ Suporte a múltiplos desktops

O FOF sempre foi desktop-agnóstico na arquitetura, mas alguns
detalhes de implementação assumiam KDE. Esta versão corrige:

- **`zenity` adicionado como dependência do instalador.** Fedora
  GNOME minimal não traz `zenity` por padrão, o que quebrava a
  autenticação gráfica em DEs não-KDE (o comando travava esperando
  input que nunca vinha). Agora o `install.sh` instala
  automaticamente se nem `zenity` nem `kdialog` estiverem presentes.
- **Terminal de inicialização agora segue o desktop detectado.**
  Antes, o `iniciar_fof.sh` tentava `konsole` primeiro mesmo em
  GNOME/XFCE/etc., o que abria o terminal errado se o usuário
  tivesse konsole instalado por outro motivo. Agora a ordem é:
  terminal nativo do DE → `xdg-terminal-exec` → terminal de outro
  DE (fallback) → terminal universal (`xterm`, etc.).
- **Desktop detectado agora aparece nos logs** (`XDG_CURRENT_DESKTOP`
  e `DESKTOP_SESSION`), facilitando o diagnóstico de problemas
  relatados por usuários em DEs específicos.
- **Fixação automática na barra de tarefas removida.** A
  implementação só cobria KDE via `kwriteconfig5`/`qdbus` e, na
  prática, raramente funcionava — o Plasma sobrescreve alterações
  externas no arquivo de configuração com frequência. Fixar na
  barra agora é responsabilidade do usuário, e o FOF não promete
  fazer isso. Os READMEs explicam como fazer em cada desktop.
- **Removido `X-GNOME-Autostart-enabled=true`** do `.desktop`
  gerado (era um campo específico do GNOME, ignorado nos outros
  DEs).

### 🎛️ Comportamento consistente de pares install/revert

Todos os pares install/revert do FOF (toggles de ajuste, suplementos
e controles) agora seguem a mesma regra:

- **Estado inicial**: botão de install ativo, botão de reverter
  **desabilitado** — não há nada para reverter.
- **Após instalar**: install fica desabilitado com texto final
  ("✅ ... instalado"), reverter fica habilitado.
- **Após reverter**: install volta a ficar ativo com o texto
  original, reverter fica desabilitado novamente.

Antes, o botão de reverter ficava clicável desde o carregamento da
sessão, sem indicação visual de que não havia nada a reverter. E o
`firmware-vendor-install`/`firmware-vendor-remove` nem seguia esse
padrão (era `sempreClicavel`, então nunca desabilitava).

A lógica foi centralizada num helper novo, `aplicarEstadoToggle()`,
em `script.js` — usado pelas sessões Hardware, Dispositivos e
Periféricos, e Ajustes e Manutenção. Reduz duplicação e garante
comportamento idêntico em qualquer sessão futura.

### 🛡️ Melhorias de segurança

- **Whitelist de comandos sem autenticação agora rejeita
  encadeamento de shell.** A validação antiga (`startsWith`) aceitaria
  um comando como `rpm -q kernel; rm -rf ~` como se fosse apenas
  `rpm -q`. Agora comandos sem autenticação que contenham `;`, `` ` ``,
  `|`, `$(` ou `&&` são rejeitados e exigem pkexec/kdesu.
- **Ctrl+Enter exige foco explícito no botão.** Antes, o atalho
  disparava o primeiro botão visível da tela — o que podia acionar
  acidentalmente "Remover repositório Fedora Flatpak" ou
  "Desinstalar FOF". Agora só funciona com o botão em foco.

### 🚀 Melhorias de performance

- **Detecção de hardware paralela.** O scan agora roda os comandos
  `lspci -k` / `rpm -q` via `Promise.all` em vez de sequencialmente.
  Em máquinas com várias GPUs e NICs, a detecção fica 1–2 segundos
  mais rápida.
- **`isExecutado()` / `isPulado()` usam cache.** Antes faziam
  `JSON.parse` do `localStorage` a cada chamada, o que somava
  centenas de parses em cada atualização do progresso global. Agora
  usam o `progressCache` já populado.

### 🔤 i18n — novas chaves

- `locales/en.json` e `locales/es.json` ganharam a seção completa
  `sessoes.dispositivos-perifericos.*`
- Chaves `hardware.intel_*` adicionadas
- Chaves `hardware.controles_*` e `hardware.steam_devices_*` removidas
  (foram movidas para a nova sessão)
- Chaves `texto_concluido_firmware_vendor` e
  `texto_concluido_firmware_vendor_remove` adicionadas

### 🧪 Ferramenta de validação unificada

- Novo script `validar.sh` que roda 10 checks de sanidade em uma
  única passada: ambiente, presença de arquivos, sintaxe JS/JSON/
  Bash/C, cross-references entre `script.js` e os `.html` de sessão,
  ícones em `guiado.html`, chaves i18n usadas vs. presentes nos
  locales, e consistência de versão (`package.json` ↔
  `CHANGELOG.md` ↔ `i18n.js`).
- `make check` agora delega para `validar.sh` quando presente, com
  fallback para `check-basico` se o script não existir.
- `Makefile` ganhou alvo `check-basico` para validação mínima de
  sintaxe sem depender do `validar.sh`.

### 🐛 Corrigido

- **Comentários de sessão no `script.js`** estavam fora de sincronia
  após a inserção da nova sessão — `aplicativos`,
  `casa-escritorio`, `gaming`, `waydroid`, `diagnostico`,
  `ajustes-manutencao`, `estado-fedora` e `sobre-fof` agora
  numerados corretamente de 6 a 13.
- **`data-i18n` com HTML literal.** Em `hardware.html`,
  `codecs.html` e `gaming.html`, três elementos usavam `data-i18n`
  (que substitui por `textContent`) mas continham `<strong>` ou
  `<code>`. Usuários em EN/ES viam as tags na tela. Corrigido para
  `data-i18n-html`.
- **Referências a "Sessão 4" erradas.** O RPM Fusion está na
  Sessão 1 (Primeiros Passos), não na 4. Texto corrigido em
  `hardware.html` e nos dois locales.
- **`hardware.descricao` em EN/ES desatualizado.** Ainda mencionava
  um "bloco de controles" que foi removido da sessão. Reescrito para
  apontar para Dispositivos e Periféricos.
- **Comando de instalação do RTL8822BU errado.**
  `hardware_map.json` e `dispositivos-perifericos.html` apontavam
  para o pacote `rtw88` (driver in-tree do kernel) em vez do pacote
  DKMS do COPR. Corrigido para `rtl8822bu-morrownr-dkms`.
- **`hardware-service.js` tolera `hardware_map.json` vazio.** Antes,
  um JSON válido sem a chave `usb_devices` causava erro silencioso
  na detecção. Agora normaliza as chaves antes de usar.
- **Banner de atualização em `sobre-fof.html` não traduzia.** Estava
  hardcoded em PT-BR; agora usa a chave
  `sessoes.sobre-fof.atualizacao_disponivel`.
- **CPU no painel de Diagnóstico mostrava média desde o boot.**
  `top -bn1` retorna a primeira amostra (média histórica). Trocado
  para `top -bn2` — a segunda amostra reflete o uso real no
  intervalo.
- **7 comandos órfãos removidos da sessão Produção Multimídia.**
  Eram resquício de uma versão anterior em que a sessão era maior.
  Como não tinham botão correspondente no HTML, nunca podiam ser
  executados — mas poluíam o cálculo de progresso, fazendo a sessão
  nunca fechar.
- **Log órfão removido da sessão Dispositivos e Periféricos.** O
  botão "Detectar meu hardware" renderiza o resultado em cards, não
  em log — o `<div id="log-hw-scan">` nunca era usado. Removido.
- **Título interno da sessão Casa e Escritório estava desatualizado.**
  Mostrava "Casa Pronta" (nome antigo), enquanto o menu e os locales
  usavam "Casa e Escritório". Alinhado.

### 🗑️ Removido

- **`akmod-intel-ipu6`** — o kernel do Fedora 44+ já tem suporte
  nativo a webcams Intel MIPI (via `libcamera`). O pacote do RPM
  Fusion está desatualizado desde o final de 2024 e pode entrar em
  conflito com o suporte FOSS. O bloco foi removido da sessão
  Dispositivos e Periféricos.
- **Fixação automática na barra de tarefas** — implementação só
  cobria KDE e raramente funcionava. Removida completamente do
  `install.sh`.

### 📝 Documentação

- `README.md`, `README.en.md` e `README.es.md` atualizados para
  refletir as 13 sessões (antes listavam 12)
- Nova seção **"Desktops suportados"** nos três READMEs, com tabela
  de compatibilidade e explicação do que é automático vs. manual
- Badges de versão atualizadas para `v1.0.0-09292026`
- Tabela de estrutura de diretórios ganhou `hardware-service.js`,
  `hardware_map.json` e `dispositivos-perifericos.html`
- `template-sessao.html` reescrito com IDs semânticos, referências
  atualizadas e notas sobre `flatpakId` e `sempreClicavel`
- `iniciar_fof.sh --help` agora menciona 13 sessões e os arquivos
  novos

---

## v1.0.0-09282026

### 🔄 Reestruturação completa das sessões

As sessões foram reorganizadas para refletir a ordem lógica de configuração
de um Fedora novo, e os IDs agora são **semânticos** (sem número). Reordenar
sessões passou a ser apenas uma questão de mover linhas no array `SESSOES`
em `script.js` — nada mais precisa mudar.

**De 13 para 12 sessões:**

- 🚀 **Primeiros Passos** — atualização do sistema + RPM Fusion + Flatpak
- 🔤 **Codecs e Compatibilidade** — (antes `04-codecs-compatibilidade`)
- 🖥️ **Hardware** — (antes `05-hardware`)
- 🎬 **Produção Multimídia** — (antes `07-loja`, sem os ajustes de áudio)
- 📦 **Aplicativos Recomendados** — (antes `09-softwares-uteis`)
- 🏠 **Casa e Escritório** — (antes `10-casa-pronta`)
- 🎮 **Gaming** — (antes `06-gaming`, sem o teste de bufferbloat)
- 📱 **Waydroid** — (antes `08-waydroid`)
- 📊 **Diagnóstico** — (antes `11-diagnostico`, sem o Baobab)
- 🛠️ **Ajustes e Manutenção** — sessão nova, funde `02-otimizacao` + ajustes de áudio + manutenção do Fedora
- 🐧 **Estado do Fedora** — (antes `12-fedora`)
- 📖 **Sobre o FOF** — sessão nova, com o "sobre" + manutenção do FOF + changelog dinâmico

**Sessões removidas:**

- 💾 **Restauração** (Btrfs-Assistant) — considerada fora do escopo do FOF
- 🔧 **Manutenção** (página standalone `manutencao.html`) — conteúdo dividido entre **Ajustes e Manutenção** e **Sobre o FOF**

**Conteúdo movido entre sessões:**

- Ajustes de Áudio (realtime-setup, PipeWire low latency) — de **Produção Multimídia** → **Ajustes e Manutenção**
- Ajustes de Desempenho (vm.max_map_count, swappiness, TCP BBR) — de **Otimização** → **Ajustes e Manutenção**
- Manutenção do Fedora (limpeza, kernels, GRUB) — da página **Manutenção** → **Ajustes e Manutenção**
- Sobre o FOF (texto institucional) — de **Boas-vindas** → **Sobre o FOF**
- Atualizar FOF / Desinstalar FOF — da página **Manutenção** → **Sobre o FOF**

**Conteúdo removido:**

- Teste de bufferbloat (Rede para Jogos Online) — removido do **Gaming**
- Análise Visual de Disco (Baobab) — removido do **Diagnóstico**

### 🚫 Remoção opcional do repositório Fedora Flatpak

A sessão **Primeiros Passos** ganhou um bloco novo que permite remover o
repositório Flatpak próprio do Fedora (distinto do Flathub). Aplicativos
vindos dele podem ficar desatualizados em relação às versões oficiais
mantidas pelos desenvolvedores upstream — ou, em alguns casos, nem serem
os empacotamentos oficiais.

O bloco executa, em ordem:

1. Remove os apps Flatpak instalados a partir do repositório Fedora (e do
   `fedora-testing`, se existir) com `--delete-data` (apaga também os dados
   salvos dos apps)
2. Remove os repositórios `fedora` e `fedora-testing`
3. Limpa runtimes órfãos

O botão exige **duas confirmações** antes de executar, e o texto de aviso
deixa explícito que os dados dos aplicativos removidos (configurações,
perfis, favoritos, progresso de jogos) são perdidos permanentemente.

### 🎨 Tela inicial redesenhada

- Landing page agora exibe **relógio ao vivo** no topo do card principal
- Card único com **texto explicativo à esquerda** e **botão "Iniciar" à direita**,
  verticalmente centralizados
- Texto reescrito em dois parágrafos mais escaneáveis, destacando que o FOF
  **não faz backup** e recomendando backup antes de aplicar alterações
- Removidos: resumo curto e ícone antigo do card

### 📝 Changelog dinâmico

- O changelog exibido dentro do FOF agora é carregado dinamicamente deste arquivo, via `GET /changelog`
- O servidor faz parse do markdown, encontra a seção da versão atual e devolve HTML pronto
- Cache em memória por 12h
- Botão "Ver Changelog Completo no GitHub" corrigido — usava `window.open`, que o WebKitGTK bloqueia silenciosamente; agora usa `window.location.href` (o container detecta navegação externa e abre no navegador do sistema via `xdg-open`)
- Título do changelog dentro do FOF passou a usar `{versao}` dinâmico (antes era hardcoded e ficava desatualizado)

### 🐛 Correções

- **Bug de sintaxe em `script.js`** — vírgula faltando e entrada duplicada no array `SESSOES` quebravam o arquivo inteiro. Sintoma: badge de versão vazio no `index.html` e spinner infinito no `guiado.html`
- **Regex de arquivos de sessão no `server.js`** — exigia prefixo numérico (`^\/(\d{2}-[a-z-]+\.html)$`), o que impedia as sessões com IDs semânticos de serem servidas. Corrigido para aceitar qualquer `.html` iniciado por letra minúscula
- **`limpar_arquivos_antigos()` no `install.sh`** — estava definida dentro de `reaplicar_permissoes()`, o que a tornava inacessível durante `--update` em sessões novas do bash. Movida para escopo top-level
- **Permissões defensivas** — `iniciar_fof.sh` e `iniciar_fof_compat.sh` agora autocorrigem `+x` em arquivos do projeto. Protege contra cópias sem bit de execução (zip, USB, `scp` sem `-p`)
- **`install.sh --update`** — limpa arquivos de sessões antigas antes do `git pull`. Evita resquícios quando o git não detecta renomeações
- **IDs órfãos** — o progresso agora é limpo automaticamente. IDs de comandos que não existem mais são removidos do `.progresso.json` no boot, e o contador global de sessões concluídas deixa de mentir
- **Badge de atualização** — agora aponta para `guiado.html?session=sobre-fof` (antes ia para `manutencao.html`, que foi removida)

### 🗑️ Removido

- Página `manutencao.html` (conteúdo absorvido por **Ajustes e Manutenção** e **Sobre o FOF**)
- Rotas e referências a `manutencao.html` em `server.js`, `script.js`, `iniciar_fof.sh` e `install.sh`
- `locales/pt-BR.json` — o arquivo era código morto: o `i18n.js` nunca o carregava (pt-BR é o idioma padrão e usa o próprio HTML como fonte). Manter só gerava manutenção dupla
- **Busca global (Ctrl+K)** — a implementação apresentava problemas de compatibilidade com o WebKitGTK do container nativo. Função removida completamente: overlay, listeners de teclado e CSS associados

---

## v1.0.0-09232026

### ✨ Adicionado

- Verificação automática de atualizações via GitHub Releases API (badge ⬆️ no header quando há versão mais nova; cache de 12h)
- Popup pós-atualização (avisa para fechar e reabrir o FOF)
- Aviso educativo detalhado sobre NTSYNC na sessão Gaming
- Botões "Atualizar Apps Flatpak" nas sessões de Gaming e Aplicativos
- Ícone de desinstalar ao lado de cada app Flatpak instalado
- Detecção de Flatpak removido externamente — botão volta ao estado inicial automaticamente
- Endpoint `/flatpak-installed` no servidor
- Campos novos em `/system-info` (KSM, BBR, max_map_count, PipeWire quantum)
- Painel "Ajustes de Otimizações" no Diagnóstico

### 🔄 Modificado

- Sessão 00 (Boas-vindas) reformulada em 2 acordeãos
- Logs de sessão expandidos por padrão; altura uniforme (120–200px)
- Header com controles inline ao título

### 🐛 Corrigido

- Bug de permissão no `flatpak uninstall` (rodava via kdesu/pkexec, quebrando o DBus de sessão; agora roda como usuário via whitelist)
- `systemctl --user` movido para a whitelist de comandos sem autenticação, com env ajustado automaticamente

---

## v1.0.0

### ✨ Versão inicial pública

- Painel de automação visual para configurar Fedora Linux
- Sessões organizadas em ordem guiada (boas-vindas, restauração, otimização, repositórios, codecs, hardware, gaming, produção multimídia, waydroid, aplicativos, casa pronta, diagnóstico, fedora)
- Container nativo WebKitGTK (sem dependência de navegador externo)
- Logs em tempo real via Server-Sent Events
- Persistência de progresso (servidor local + localStorage)
- Internacionalização: PT-BR, EN, ES
- Tema claro/escuro alternável
- Busca global (Ctrl+K)
- Autenticação segura via pkexec/kdesu com whitelist de comandos read-only
- Toasts + notificações nativas ao concluir tarefas longas (>30s)
- Barra de progresso global no header

---

### Como adicionar uma versão nova

Ao lançar uma versão nova:

1. Atualize o campo `version` no `package.json` (ex.: `"1.0.0-10012026"`)
2. Atualize `FALLBACK_VERSION` no `i18n.js` (a única exceção à regra de fonte única)
3. Adicione uma seção nova **no topo deste arquivo**, antes da versão anterior. O cabeçalho precisa ser `## v<versão>` — por exemplo, `## v1.0.0-10012026` — batendo exatamente com o `version` do `package.json`.
4. Use `###` (três hashes) para subseções dentro de uma versão. Um `##` no meio da seção encerra a captura do parser e o resto é descartado.
5. Crie a tag/release no GitHub com o mesmo nome.

Se o cabeçalho não bater exatamente com o `version` do `package.json`, o FOF não encontrará a seção correspondente e mostrará apenas o link para o changelog completo no GitHub.
