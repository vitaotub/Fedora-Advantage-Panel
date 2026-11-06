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

## v1.4.9-11062026

Reescrita completa da área NVIDIA após teste em hardware real (RTX 5060
/ GB206 / Blackwell). A v1.4.8 instalou o driver proprietário
tradicional (`akmod-nvidia`) em uma placa que **não é compatível** com
ele — o módulo não compilou, o sistema ficou sem driver gráfico, e a
tela congelou. Combinado com a ativação manual do `nvidia-drm.modeset=1`
(que o RPM Fusion desaconselha), o sistema ficou irrecuperável sem TTY.

### 🔴 Corrigido

- **`hardware.html` → `executarNvidiaDriver`** — reescrito. Nova ordem:
  1. Detecta geração da GPU (Blackwell / Ada / Ampere / Turing /
     Maxwell / Pascal / Kepler / Fermi).
  2. Blackwell → exige `akmod-nvidia-open` (o driver proprietário
     `akmod-nvidia` **não suporta** Blackwell).
  3. Verifica se o pacote correto existe no RPM Fusion
     (`/check-package-available`). Se não existir, **avisa e não
     instala nada**.
  4. Aviso explícito: "não feche o FAP / não reinicie até o aviso".
  5. Instala o pacote correto + pré-requisitos
     (`kernel-devel-matched kernel-headers`).
  6. **Polling de compilação**: `modinfo nvidia` a cada 15s, até
     40 iterações (10 min). O polling também detecta quando
     `akmods`/`akmodsbuild` sumiu sem o módulo compilar (falha
     imediata, não precisa esperar 10 min).
  7. **Reversão automática em caso de falha**: `dnf remove
     akmod-nvidia*` + `dracut -f` → restaura o nouveau. O usuário
     **não** fica com tela congelada.
- **`hardware.html` → `_detectarGeracaoNvidia`** — nova função
  (substitui `_detectarSerieNvidia` + `_serieAPartirDePkg`).
  Retorna `{ tipo, nome, precisaOpen, bloqueado, pkg, cuda }` por
  geração. Blackwell detectado por `\bgb2\d`, `rtx 50[0-9]{2}\b` ou
  `blackwell`.
- **`hardware.html` → `_detectarGpuNvidia`** — retorna `geracao`
  completo. Não depende mais de `nvidia-detect` (a regex cobre
  todas as gerações, inclusive Blackwell, sem precisar de pacote
  extra).
- **`hardware.html` → `_aplicarEstadoNvidia`** — `async`. Novos
  bloqueios, em ordem: (a) geração bloqueada (Kepler/Fermi);
  (b) Blackwell sem `akmod-nvidia-open` disponível no repo; (c)
  Secure Boot sem chave. Cada bloqueio tem tooltip específico.
- **`hardware.html` → `_renderizarPanelDriverStatus`** — novo painel
  entre o painel de hardware e o botão. Mostra o motivo do bloqueio
  (geração bloqueada, driver indisponível).
- **`hardware.html` → `registrarAppRemovivel('nvidia-driver-install')`**
  — `pacotes` inclui `akmod-nvidia-open`. `comandoRemocao` remove
  `akmod-nvidia-open` também.
- **`hardware.html` → `executarNvidiaDriverRemove`** — o `dnf remove`
  agora inclui `akmod-nvidia-open` (o `dnf remove akmod-nvidia` não
  expande para o pacote `-open`).
- **`hardware.html` → código órfão removido** — a substituição da
  `_aplicarEstadoNvidia` na v1.4.8 deixou um bloco `botoesHabilitar`
  (o final da versão antiga da função) solto depois de
  `_verificarPacoteDisponivel`. Isso causava `SyntaxError` ao
  carregar o `<script>` da Sessão 3, e **nenhuma** função da sessão
  ficava definida. Removido.
- **`server.js` → `GET /check-package-available`** — novo endpoint.
  Retorna `{ installed, available, pkg }` para um pacote (read-only).
  Usado pelo FAP para decidir se `akmod-nvidia-open` existe no
  RPM Fusion **antes** de tentar instalar.
- **`script.js` → `_renderizarBadgeSecureBoot`** — o badge e o link
  agora usam o nome **traduzido** da Sessão 12
  (`_t('sessoes.estado-fedora.nome', ...)`), via interpolação
  `{sessao}`. Antes, o link dizia "Abrir passo a passo" (genérico,
  sem indicar para onde vai) e o badge verde hardcodava "Estado do
  Fedora" em PT-BR (quebrava em EN/ES). Agora o texto funciona
  nos 3 idiomas e acompanha se a sessão for renomeada.

### 🚫 Removido

- **`hardware.html` → bloco "NVIDIA Modesetting (Wayland)"** —
  removido do HTML + JS (`executarNvidiaModeset`,
  `executarNvidiaModesetRemove`, os botões e as barras de
  progresso). O RPM Fusion HowTo diz explicitamente para **não**
  usar `nvidia-drm.modeset=1` no Fedora atual — o parâmetro
  conflita com o `simpledrm` do kernel e causa tela congelada em
  Wayland. O driver do RPM Fusion já configura KMS por padrão.
- **`script.js` → `SESSOES.hardware.comandos['nvidia-modeset-on']` e
  `['nvidia-modeset-off']`** — removidos. O `_limparIdsOrfaos`
  remove do `.progresso.json` na próxima limpeza.
- **`script.js` → `_MAPA_HARDWARE_DEPENDENTE['nvidia-modeset-on']` e
  `['nvidia-modeset-off']`** — removidos.

### 🔄 Alterado

- **`hardware.html` → `_renderizarPanelNvidia`** — mostra a geração
  como linha separada (`Geração: Blackwell (RTX 50xx)`) e o pacote
  exato (`akmod-nvidia-open`, `akmod-nvidia`, `akmod-nvidia-580xx`).
- **`hardware.html` → `_mostrarAvisoX11Nvidia`** — simplificado: só
  mostra/esconde o painel de aviso de Xorg. A lógica de desabilitar
  o botão foi movida para `_aplicarEstadoNvidia` (que faz o check
  completo).
- **`hardware.html` → `_atualizarSecaoNvidia`** — usa
  `_renderizarBadgeSecureBoot` (badge compacto) em vez de
  `_renderizarPainelSecureBoot` (painel completo). O painel completo
  vive só na Sessão 12 (Estado do Fedora), fonte única. Consistente
  com Sessões 4/5/9.
- **`hardware.html` → `restaurarEstadoSessao`** — remove o
  `aplicarEstadoToggle('nvidia-modeset-on', ...)`. `_aplicarEstadoNvidia`
  é `await`ado.
- **`script.js` → `_refreshEstadoSessao`** — mantém o `await
  _atualizarSecaoNvidia()` (da v1.4.8).

### 📝 i18n

Novas chaves sob `sessoes.hardware.nvidia_*` e `seguranca.secureboot_*`
em EN e ES:
- `nvidia_panel_label_geracao` — "Geração" / "Generation"
- `nvidia_aviso_espera` — aviso antes de instalar
- `nvidia_install_ok` — toast de sucesso
- `nvidia_install_ok_toast` — notificação nativa (corpo)
- `nvidia_driver_indisponivel` — alert completo (Blackwell sem -open)
- `nvidia_driver_indisponivel_curto` — tooltip do botão
- `nvidia_driver_indisponivel_panel` — painel vermelho
- `nvidia_serie_legado_bloqueada` — painel de Kepler/Fermi

Chaves alteradas para usar `{sessao}`:
- `seguranca.secureboot_badge_desc`
- `seguranca.secureboot_badge_link`
- `seguranca.secureboot_badge_ok`
- `sessoes.hardware.nvidia_secureboot_bloqueio`

### 🧪 Requisito

- **Fedora 44 ou 45.**

### ⚠️ Fluxo correto (documentado para futuros testes)

1. RPM Fusion free + nonfree ativos (Sessão 1).
2. `dnf upgrade` + reboot (garante `kernel-devel` atualizado).
3. **Secure Boot** (Sessão 12): "Preparar Secure Boot" → reboot →
   MOK Management enrollment. **Obrigatório antes do driver.**
4. **NVIDIA** (Sessão 3): "Instalar Driver NVIDIA".
   - FAP detecta geração.
   - FAP verifica disponibilidade do `akmod-nvidia-open` (Blackwell).
   - FAP instala + polling de compilação (15s × 40).
   - Popup de sucesso = pode reiniciar.
   - Falha = reversão automática (restaura nouveau).
5. Reboot → `nvidia-smi`.

---

## v1.4.8-11052026

Correção de escopo do Secure Boot. O painel de enrollment MOK, introduzido
na v1.4.7 junto com a reformulação da área NVIDIA, ficou originalmente
**restrito ao bloco NVIDIA** — mas o `akmods` assina com a MESMA chave
todos os módulos compilados localmente: `akmod-nvidia` (sessão 3),
`akmod-VirtualBox` (sessão 9), `akmod-wl` / `akmod-r8168` (sessão 4),
`xpadneo` via DKMS (sessão 4) e `akmod-v4l2loopback` (câmera virtual
do OBS, sessão 5). Um único enrollment cobre os seis.

Usuário com Secure Boot ativo que instalasse VirtualBox (sessão 9) ou
câmera virtual do OBS (sessão 5) **não recebia nenhum aviso** — o módulo
compilava e assinava, mas o kernel recusava no boot e o sistema caía no
fallback (VirtualBox abria mas as VMs não subiam; a câmera virtual não
aparecia). O mesmo acontecia com Broadcom, Realtek e xpadneo.

### 🐛 Corrigido

- **`hardware-service.js` → `_checkSecureBoot`** — sistemas em **BIOS
  legacy** (não-UEFI) retornavam `'unknown'`, e o painel da Sessão 12
  mostrava "Não foi possível determinar o estado do Secure Boot…" —
  tecnicamente correto (Secure Boot só existe em UEFI), mas confuso
  (parece erro quando na verdade é "não se aplica"). Agora o backend
  captura STDERR (`2>&1`), detecta a string `EFI variables are not
  supported` (que o `mokutil` escreve quando não há variáveis EFI) e
  devolve `'not_efi'`. O painel da Sessão 12 renderiza uma mensagem
  verde ("não se aplica — BIOS legacy"), e os badges das Sessões
  4/5/9 continuam escondidos (mesmo tratamento de `'disabled'`).
  Distinto de `'unknown'`, que segue reservado para "mokutil
  ausente ou quebrado".
- **`script.js` → `_renderizarPainelSecureBoot`** — novo branch
  `'not_efi'` antes do `'unknown'`.
- **`script.js` → `_renderizarBadgeSecureBoot`** — `'not_efi'` entra
  no grupo que esconde o badge (junto com `'disabled'` e `'unknown'`).
- **`locales/en.json` e `locales/es.json`** — nova chave
  `seguranca.secureboot_nao_aplica`.
- **`estado-fedora.html` + `locales/en.json` + `locales/es.json`** —
  a Sessão 12 (Estado do Fedora) descrevia o FAP como "desenvolvido e
  testado no Fedora 44". O FAP é homologado para **Fedora 44 e 45**
  desde o início (o briefing lista 44 e 45 como alvo). Corrigido:
  - `versao_desc`: "Fedora 44" → "Fedora 44 e Fedora 45"
  - `versao_info`: "Fedora 43, 44 e 45" → "Fedora 44 e 45";
    "mais antigas (42 e anteriores)" → "mais antigas (43 e anteriores)"
  - `versao_suportada`: "nesta faixa" → "no Fedora 44 e no Fedora 45"
  - `versao_antiga`: "(< 43)" → "(< 44)"
  - Range no HTML (`label_suporte_fap`): "43 — 45" → "44 — 45"
  - Código JS (`verificarVersaoFedora`): `>= 43 && <= 45` →
    `>= 44 && <= 45`; `< 43` → `< 44`

### 🔄 Alterado

- **`estado-fedora.html`** — novo bloco "Secure Boot" no acordeão
  (entre "Fedora Atomic" e "SELinux"). Vira a **fonte única** do texto
  completo (3 passos: `kmodgenca` → `mokutil --import` → reboot + MOK
  Management). Cobre os 6 `akmod-*` do FAP.
- **`hardware.html`** — mantém o painel completo no bloco NVIDIA (o
  caso mais crítico), mas agora usa as funções globais de `script.js`.
  Removidas as funções locais `_detectarSecureBootNvidia`,
  `_prepararSecureBootNvidia`, `_renderizarPainelSecureBoot` e
  `executarPrepararSecureBootNvidia` — zero duplicação de texto.
- **`virtualizacao.html`** — badge compacto no topo da sessão. Só
  aparece se Secure Boot ativo e chave ausente, apontando para Estado
  do Fedora.
- **`dispositivos-perifericos.html`** — badge compacto no bloco
  "Drivers da comunidade (COPR)" (cobre Broadcom, Realtek, xpadneo).
- **`producao-multimidia.html`** — badge compacto no bloco
  "OBS Studio - Instalação e Câmera Virtual".
- **`script.js`** — novas funções globais: `_detectarSecureBoot()`
  (genérica, sem "Nvidia" no nome), `_prepararSecureBoot()`,
  `_renderizarPainelSecureBoot()`, `_renderizarBadgeSecureBoot()`,
  `_secureBootCache`, `executarPrepararSecureBoot()`. O
  `_refreshEstadoSessao` agora invalida `_secureBootCache` também (o
  botão 🔄 do header força re-detecção).

### 📝 i18n

Novas chaves sob `seguranca.secureboot_*` (19 no total) em EN e ES.
O namespace `sessoes.hardware.nvidia_secureboot_*` (v1.4.7) é
**preservado** — o tooltip do botão de instalar NVIDIA e o `confirm()`
ainda o usam.

### 🧪 Requisito

- **Fedora 44 ou 45.**

---
