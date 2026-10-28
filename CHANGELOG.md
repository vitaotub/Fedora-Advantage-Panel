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

## v1.4.0-10282026

Rodada de reorganização da sessão **Hardware** e adição de suporte
completo a aceleração de vídeo (VA-API) em AMD, Intel e NVIDIA.

### ✨ Adicionado

- **AMD** — botão "Verificar aceleração" (`vainfo`, somente leitura).
- **Intel** — driver legado `libva-intel-driver` para CPUs de 7ª geração
  ou anteriores (Haswell, Ivy Bridge, etc.).
- **Intel** — utilitários `libva-utils` + `gstreamer1-vaapi`.
- **Intel** — botão "Verificar aceleração" (`vainfo`, somente leitura).
- **NVIDIA** — tradutor VA-API (`nvidia-vaapi-driver`) para permitir
  aceleração de vídeo por hardware via chip NVDEC.
- **NVIDIA** — utilitários `libva-utils` + `vdpauinfo` + `gstreamer1-vaapi`.
- **NVIDIA** — toggle de env vars VA-API (`NVD_BACKEND=direct` +
  `LIBVA_DRIVER_NAME=nvidia`) em `~/.config/environment.d/99-fap-nvidia-vaapi.conf`.
- **NVIDIA** — botão "Verificar aceleração" (`vainfo` + `vdpauinfo`).
- **Aviso de reinicialização** — toast automático após instalação/remoção
  de drivers NVIDIA, ativação de modeset, configuração de env vars VA-API
  e ajustes de kernel AMD (overclock).
- **Verificação de aceleração com painel visual** — os botões
  "Verificar Aceleração" (AMD, Intel, NVIDIA) agora renderizam o
  resultado num painel dentro da sessão (status ATIVA/parcial/NÃO ativa,
  driver, versão VA-API e tabela de perfis com badges Decode/Encode),
  em vez de despejar o output cru do `vainfo` no log. Endpoint novo
  `GET /vaapi-check?vendor=amd|intel|nvidia` retorna JSON estruturado.
  O log continua registrando início e resumo de cada verificação.

### 🐛 Corrigido

- **Intel** — `intel-media-driver` (driver moderno) só funciona em
  Broadwell / 8ª gen Core+ / Arc. O botão agora coexiste com o driver
  legado, ambos visíveis, com descrição clara de qual usar.
- **NVIDIA** — sem GPU NVIDIA, os 4 botões de aceleração de vídeo
  (`nvidia-vaapi-install`, `nvidia-vaapi-utils`, `nvidia-vaapi-env`,
  `nvidia-vaapi-check`) continuavam clicáveis. `_aplicarEstadoNvidia`
  desabilitava apenas os botões antigos (driver, modeset), botão-a-botão.
  Agora usa o mesmo padrão de AMD/Intel (`querySelectorAll` em toda a
  seção), com skip para itens já instalados e para o botão de reverter
  driver órfão.
- **AMD** — `mesa-vdpau-drivers-freeworld` foi removido do Fedora 44
  em diante. O comando de instalação do VA-API não inclui mais esse
  pacote, que causava falha total da transação (`dnf` abortava com
  "Nenhuma correspondência"). O `mesa-va-drivers-freeworld` continua
  sendo o pacote correto e necessário.
- **AMD** — a lixeira do VA-API tentava remover `ffmpeg-libs` e
  `libva` junto com `mesa-va-drivers-freeworld`. Esses pacotes são
  dependências do Plasma Desktop (via `kpipewire`) e de outros
  componentes do sistema; removê-los quebrava o `plasma-desktop`.
  O FAP agora remove **apenas** `mesa-va-drivers-freeworld` — o `dnf`
  cuida das dependências órfãs automaticamente, e pacotes ainda
  necessários permanecem no sistema.
- **NVIDIA** — aviso sobre drivers 470xx/390xx agora reflete a realidade
  do Fedora: Xorg não é mais oficialmente suportado (apenas Wayland).
  Instalar 470xx/390xx deixaria o sistema sem interface gráfica em Wayland.
  O FAP passou a desabilitar esses drivers na detecção automática.

### 🗑️ Removido

- **AMD** — botão "Alternativa" (`vaapi-swap`). A receita correta para
  Fedora 44+ é `dnf install mesa-va-drivers-freeworld` (o `swap` era
  necessário apenas até o Fedora 43). O botão `vaapi-amd` cobre o caso
  normal; casos extremos podem ser resolvidos no terminal.
- **`install.sh`** — a desinstalação agora remove os arquivos de
  configuração que o FAP cria em `~/.config/`:
  `99-fap-nvidia-vaapi.conf`, `99-fap-quantum.conf`,
  `MangoHud.conf` e `gamemode.ini`. Antes, esses arquivos ficavam
  órfãos após desinstalar, e apps como PipeWire e MangoHud
  continuavam aplicando configurações do FAP sem o FAP presente.

### 🔄 Alterado

- **GPU drivers movidos de sessão.** Os drivers de GPU que estavam
  duplicados em **Dispositivos e Periféricos** (`driver-nvidia-install`,
  `driver-amd-vaapi-install`, `driver-intel-media-install`) foram
  consolidados apenas na sessão **Hardware**. A sessão **Dispositivos e
  Periféricos** agora cobre apenas rede (Broadcom, Realtek), controles
  (xpadneo, Steam Devices, grupo `input`) e firmwares.
- **Todos os drivers têm remoção.** AMD (VA-API, Vulkan, CoreCtrl, LACT),
  Intel (moderno, legado, utils) e NVIDIA (driver, VA-API, env) têm
  botão/ícone de remoção consistente. NVIDIA mantém o "Reverter pro
  nouveau" como botão dedicado.
- **`nvidia-vaapi-env`** — toggle que escreve/remove
  `~/.config/environment.d/99-fap-nvidia-vaapi.conf` (escopo de usuário,
  reversível, sem dependência do sistema).
- **`vaapi-check-*` e `nvidia-vaapi-check`** — botões de leitura que
  executam `vainfo`/`vdpauinfo` e mostram o resultado no log. Não
  alteram estado nem contam progresso.
- **`system-state-service.js`** — detecta `99-fap-nvidia-vaapi.conf` em
  `_detectarArquivosConfig()` para que o toggle restaure o estado correto.
- **`_MAPA_HARDWARE_DEPENDENTE`** (script.js) — novos ids adicionados,
  para que progresso de sessão respeite o vendor presente.

### ⚠️ Nota de atualização

- Arquivos alterados: `hardware.html`, `dispositivos-perifericos.html`,
  `script.js`, `system-state-service.js`, `locales/en.json`,
  `locales/es.json`, `CHANGELOG.md`, `package.json`.
- Arquivos **não** tocados: `server.js`, `codecs.html`, `fap-container.c`,
  `build-container.sh`, `install.sh`, `iniciar_fap.sh`.
- `.progresso.json` existente continua compatível. Ids novos só passam
  a ser considerados "relevantes" quando o vendor do hardware está
  presente (`_comandoRelevante`).
- Usuário com driver AMD `vaapi-swap` já marcado como feito: o id
  foi removido da lista de comandos, então o progresso ignora. Nenhuma
  migração necessária — o estado real do sistema continua sendo
  detectado por `/system-state`.

### 🧪 Não testado

- Hardware Intel real com iGPU legada (Skylake-): a receita do
  `libva-intel-driver` é a documentada oficialmente, mas não foi
  validada em máquina física.
- `nvidia-vaapi-driver` em hardware NVIDIA físico: receita validada
  por documentação (Arch Wiki, RPM Fusion), não em hardware real.
- Drivers 470xx/390xx: o FAP agora desabilita esses drivers na
  detecção, mas não foi testado em GPU Kepler/Fermi real.
