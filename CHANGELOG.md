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

## v1.4.1-10302026

Rodada de correções focada em **detecção de estado do sistema** e na
**uniformização dos botões de GPU**. O FAP deixou de apresentar "Instalar"
para apps já presentes no sistema, e os drivers de código livre AMD/Intel
passaram a ser one-shot (instalam e ficam cinza, sem lixeira).

### 🐛 Corrigido

**Detecção de estado (`/system-state`):**

- `SystemState` não cacheia mais falha de rede como `{}`. Antes, uma falha
  no primeiro fetch travava todos os ~165 botões em "Instalar" até o
  usuário recarregar a página. Agora a próxima chamada refaz a consulta.
- O retry automático de resposta suspeita (listas vazias) passou a cobrir
  `packages_installed` e `repos_enabled` (antes só checava
  `flatpaks_installed`).
- `appJaInstaladoNoSistema` passou a funcionar para itens sem `pacotes[]`.
  Adicionados registros faltantes em: `codecs-essenciais`,
  `firmware-vendor-install`, `driver-openrazer-install`,
  `driver-xpadneo-install`, `driver-broadcom-wl-install`,
  `driver-realtek-r8168-install`, `waydroid-helper-install`,
  `ntsync-install`, `instalar-obs-studio`, `instalar-easyeffects`.
- A combinação `ignorarPreExistente: true` + `permitirRemocaoPreExistente: false`
  não se anula mais. Removido `ignorarPreExistente` de `fontes-ms-all`,
  `cups-install` e `samba-install` — agora o usuário vê "✅ Já estava ativo"
  com tooltip e sem lixeira (antes via "Instalar" para sempre e a lixeira
  apagava pacotes que já existiam).
- `codecs-essenciais` ganhou `onSucesso` — a lixeira aparece imediatamente
  após instalar, sem precisar recarregar a sessão.
- `aplicativos.html` tinha um `}` faltando em `restaurarEstadoSessao` que
  causava `SyntaxError: Unexpected end of script` no `guiado.html` — a
  sessão 6 inteira ficava em "Instalar" mesmo com apps pré-instalados.

**Drivers de GPU:**

- `vulkan-amd`, `vaapi-amd`, `intel-media-install`, `libva-intel-install`,
  `intel-vaapi-utils`, `nvidia-vaapi-install` e `nvidia-vaapi-utils`
  agora usam `aplicarEstadoOneShot`. Antes, a lixeira de `vulkan-amd`
  cascateava `dnf remove` para `steam`, `kinfocenter`, `lm_sensors`,
  `gamemode` e ~34 dependências de 32 bits, quebrando o sistema.
- Avisos informativos no topo das seções AMD e Intel explicam o que
  cada botão instala, o que já vem no Fedora e por que não há botão
  de remoção.
- `nvidia-driver-install` — dupla fonte de estado removida. O botão era
  gerenciado simultaneamente por `aplicarEstadoInstalavel` (código morto)
  e `aplicarEstadoToggle`; agora só o toggle.
- `nvidia-driver-remove`, `nvidia-modeset-on` e `nvidia-modeset-off`
  passaram a ser rastreados em `SESSOES` (antes `sempreClicavel: true`
  fazia o estado se perder entre reloads).
- `nvidia-modeset-off` agora reseta o marker `nvidia-modeset-on` — antes
  o botão continuava "✅ Modesetting ativado" após desativar.
- `amdgpu-overclock` — revert oculto até ativar (padrão consistente com
  os demais toggles).

**Sessão 12 — toggles:**

- `vm-max-map-count`, `vm-swappiness-cache` e `tcp-bbr` — o botão de
  reverter agora aparece após aplicar. Antes `_resetarIrmao` restaurava
  texto e cor, mas não removia o `display: none` do revert (que começa
  oculto por `esconderRevertSeNaoFeito: true`).
- O loop de `restaurarEstadoSessao` passou a usar só `aplicarEstadoToggle`
  como fonte de verdade visual. Antes misturava com `_marcarBotaoConcluido`,
  que divergia do toggle em relação a cor do install e `display` do revert.

**Sessão 6 — Rclone Manager:**

- Estado 2 puro: instalar → "🚀 Abrir Rclone Manager" + lixeira. A
  lixeira executa o `comandoRemocao` completo (pacotes + atalhos +
  ícones + caches), mas preserva `~/.config/rclone/` (contas de nuvem).
- `<button class="btn-executar destrutivo">` removido do HTML.
- Aviso de texto órfão ("Remover completamente o Rclone Manager?...")
  removido.

**Sessão 8 — NTSYNC:**

- Estado 2 puro: instalar → cinza + lixeira. A lixeira remove
  `wine-ntsync`, `/etc/modules-load.d/ntsync.conf` e descarrega o
  módulo do kernel — mesmo comportamento do antigo botão destrutivo.
- `<button class="btn-executar destrutivo">` e o aviso de texto
  órfão removidos.
- `pacotes: ['wine-ntsync']` adicionado ao registro (antes o
  console emitia `[appJaInstalado] desfazerTudo sem pacotes`).

**Sessão 9 — Waydroid:**

- `abrir-waydroid` tem guard de instalação: fica desabilitado até
  o Waydroid ser instalado e inicializado. Antes, o usuário podia
  clicar sem nada instalado e recebia "comando não encontrado".

### ✨ Adicionado

- Novo helper `aplicarEstadoOneShot` em `script.js` — instalar, marcar
  como feito, sem lixeira, sem revert. Respeita apenas `isExecutado`
  (estado do FAP); não consulta o sistema.
- Novo sistema de registry para "Abrir X": `_registrarAbrir()`,
  `_ABRIR_REGISTRY` e `_dadosAbrirDoApp()` em `script.js`. Cada sessão
  registra no boot como o botão de instalar deve virar "Abrir" após o
  sucesso. Elimina a dependência dos `<button class="verde">` no HTML.
- `aplicarEstadoInstalavel` adaptado para consultar o registry —
  funciona com ou sem o `<button>` verde no DOM (compatibilidade com
  sessões ainda não migradas).
- `_renderizarPanelAmd` e `_renderizarPanelIntel` em `hardware.html` —
  painéis detalhados com **GPU / Driver kernel / Pacote sugerido**.
  Uniformização cross-vendor com o painel do NVIDIA (**GPU / Driver
  recomendado / Série**).
- `_atualizarBotaoAbrirWaydroid` em `waydroid.html` — habilita/desabilita
  o botão "Abrir Waydroid" conforme o estado real do container.
- Chaves i18n em en+es: `hw_panel_titulo`, `hw_panel_label_gpu`,
  `hw_panel_label_driver_kernel`, `hw_panel_label_pacote`,
  `amd_aviso_one_shot`, `intel_aviso_one_shot`.

### 🗑️ Removido

- `<button class="btn-executar verde">` de 9 HTMLs de sessão (3, 5, 6,
  7, 8, 9, 10, 11, 13) — ~50 botões. O "Abrir X" agora é resolvido
  pelo registry, com o próprio botão de instalar virando verde após o
  sucesso.
- `_criarBotoesAbrir` em `aplicativos.html` — substituído por
  `_registrarAbrirEmMassa` (que registra ~50 apps em uma passada).
- **PipeWire quantum** da sessão 12 — ajuste perigoso (reduzia latência
  ao custo de CPU e podia causar crackling em máquinas modestas). A
  seção "Ajustes de Áudio" agora só tem `realtime-setup`.
- `desfazer-ntsync` de `SESSOES` — migrado para Estado 2.
- Entradas mortas de `SESSOES` (não tinham `<button>` no HTML):
  `instalar-lightworks-remove`, `samba-remove`, `keepassxc-remove`,
  `wine-remove`, `winetricks-remove`, `gamemode-remove`,
  `mangohud-remove`, `goverlay-remove`, `gamescope-remove`,
  `vkbasalt-remove`, `controller-test-remove`,
  `pipewire-quantum-low`, `pipewire-quantum-low-remove`.
- `ignorarPreExistente: true` de `fontes-ms-all`, `cups-install`,
  `samba-install` (anulava `permitirRemocaoPreExistente`).
- Chaves i18n `pipewire_quantum_titulo`, `pipewire_quantum_desc`,
  `pipewire_quantum_info`, `btn_pipewire_quantum`,
  `btn_pipewire_quantum_remove`, `texto_concluido_pipewire_quantum`,
  `texto_concluido_pipewire_quantum_remove` de en+es.

### 🔄 Alterado

- `aplicarEstadoInstalavel` aceita `dadosAbrir` do registry (Rodada 2B).
- `restaurarEstadoSessao` simplificado em 9 sessões (2º argumento
  `idAbrir` passou a ser `null` — o "Abrir X" vem do registry).
- `registrarAppRemovivel` de `vulkan-amd` reescrito (one-shot sem
  lixeira); `vaapi-amd`, `intel-media-install`, `libva-intel-install`,
  `intel-vaapi-utils`, `nvidia-vaapi-install` e `nvidia-vaapi-utils`
  tiveram o registro removido (viraram one-shot).

### ⚠️ Nota de atualização

- **Arquivos alterados:** `script.js`, `hardware.html`,
  `aplicativos.html`, `gaming.html`, `waydroid.html`,
  `casa-escritorio.html`, `codecs.html`, `dispositivos-perifericos.html`,
  `ajustes-manutencao.html`, `diagnostico.html`,
  `producao-multimidia.html`, `virtualizacao.html`,
  `estado-fedora.html`, `locales/en.json`, `locales/es.json`,
  `CHANGELOG.md`, `package.json`.
- **Arquivos não tocados:** `server.js`, `system-state-service.js`,
  `hardware-service.js`, `hardware_map.json`, `fap-container.c`,
  `build-container.sh`, `iniciar_fap.sh`, `iniciar_fap_compat.sh`,
  `install.sh`, `style.css`, `index.html`, `guiado.html`, `i18n.js`,
  `template-sessao.html`.
- `.progresso.json` existente continua compatível. IDs órfãos
  (`desfazer-ntsync`, `*-remove` fantasmas, `pipewire-quantum-low`,
  `pipewire-quantum-low-remove`) são removidos automaticamente pelo
  `_limparIdsOrfaos` no próximo boot.
- Usuário com `vulkan-amd`, `vaapi-amd` ou drivers Intel/NVIDIA-VAAPI
  marcados como feitos: o botão continua cinza (one-shot), e para
  reinstalar via FAP é preciso resetar o progresso (Sessão 14 →
  "Resetar progresso").

### 🧪 Não testado

- **NVIDIA driver em hardware real** — install/revert/modeset em
  Quadro/Tesla/MX; detecção por regex validada, mas não em GPU física.
- **`nvidia-vaapi-driver` em GPU com NVDEC** — receita validada por
  documentação (Arch Wiki, RPM Fusion).
- **`libva-intel-driver` em Haswell/Ivy Bridge/Sandy Bridge físico** —
  receita validada por documentação oficial.
- **Waydroid em bare metal** — testar em máquina com Waydroid funcional.
- **Painéis cross-vendor em máquina com múltiplas GPUs** (AMD+Intel,
  NVIDIA+Intel) — validado conceitualmente, não em hardware.
