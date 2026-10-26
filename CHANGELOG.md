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

## v1.2.4-10262026

Rodada de testes em instalação limpa do Fedora 44 revelou uma série de
inconsistências entre sessões. Correções de detecção de hardware, estado
inicial de botões, comportamento de tooltips, e feedback visual em
operações de repositório. Nenhuma feature nova — apenas consistência,
manutenção e otimizações.

### 🐛 Corrigido

- **Sessão 1 — botão "Remover repositório Fedora Flatpak" não detectava
  estado real.** Iniciava habilitado mesmo quando o remote `fedora` /
  `fedora-testing` já havia sido removido manualmente. Agora consulta
  `SystemState.remoteFlatpakAtivo`: se o remote não existe, mostra
  "✅ Já removido (antes do FAP)" em cinza, desabilitado.

- **Sessão 3 — seções AMD e Intel sem detecção de hardware.** O botão
  "Instalar Intel Media Driver" aparecia habilitado em APU AMD. As
  seções AMD e Intel agora têm a mesma verificação da NVIDIA: se o
  hardware do vendor não está presente (`lspci` + `hardware_map.json`),
  a seção fica cinza, desabilitada, com aviso "Nenhuma GPU X detectada
  neste sistema". AMD detecta `1002` (GPU) e `1022` (APU); Intel detecta
  `8086` (iGPU).

- **Sessão 4 — OpenRazer falhava com `kernel-headers-${VERSION}`.** O
  comando `sudo dnf install -y kernel-devel-${CURRENT_KERNEL} kernel-headers-${CURRENT_KERNEL}`
  falhava com "Nenhuma correspondência para o argumento:
  kernel-headers-7.x.x". `kernel-headers` é pacote genérico (sem
  versão) no Fedora. Corrigido para `kernel-headers` sem sufixo.

- **Sessão 4 — botão "Ativar repositório" da OpenRazer travava em 30%.**
  O comando era rápido (`dnf config-manager addrepo`), mas o SSE podia
  perder o `end` se a conexão não estivesse estabelecida quando o
  comando terminava. Adicionado fallback em `aguardarConclusaoEEntao`:
  se o timeout disparar, consulta `/progress` e completa o progresso
  manualmente se o id estiver marcado. Timeout do `executarCoprEnable`
  reduzido para 60s.

- **Sessão 4 — Broadcom duplicado.** O driver aparecia em "Detecção
  automática" (via `hardware_map.json`) e em "Drivers da comunidade
  (COPR)" (bloco HTML dedicado). Removido o bloco dedicado; Broadcom
  fica apenas na detecção automática (aparece só quando o hardware é
  detectado).

- **Sessão 5 — OBS Studio e EasyEffects não detectados.** Ambos estavam
  instalados via Flatpak, mas `SystemState.flatpakInstalado` retornava
  `false` porque o `/system-state` do server era consultado antes do
  `flatpak list` terminar (cache de 60s). Adicionado retry em
  `SystemState.carregar`: se `flatpaks_installed` vier vazio com
  `flatpak:flathub` ativo, refetch com `?refresh=1` (que invalida o
  cache do server via `systemStateService.invalidarCache()`).

- **Sessão 6 — aviso redundante do Lightworks.** O `<div class="aviso-caixa">`
  sobre Lightworks não atualizar sozinho era redundante com o badge de
  origem "Download" no botão. Removido o aviso (HTML + chave
  `lightworks_aviso` dos locales).

- **Tooltip de origem duplicado em todo o FAP.** Botões com badge
  colorido mostravam dois tooltips diferentes: "Instalado via DNF..."
  (no badge) e "Fedora — Instalado via DNF..." (no botão). O
  `_renderizarBadgeOrigem` aplicava tooltip no botão inteiro, e o
  `aplicarEstadoInstalavel` limpava-o a cada render, causando
  inconsistência. Correção: tooltip de origem **só no badge**.
  `_renderizarBadgeOrigem` não toca mais em `btn.title`. O tooltip de
  pré-existente (setado por `aplicarEstadoInstalavel`) continua
  funcionando — é independente.

- **Sessão 8 — "Teste de Controle" renomeado.** O app se chama
  **Joystick Preferences** (`jstest-gtk`), não "Teste de Controle".
  Renomeados: título da área, botão de instalar, botão de abrir, texto
  de conclusão, chaves i18n (`controller_test_*` → `joystick_prefs_*`),
  e o `textoConcluido` em `SESSOES.gaming`.

- **Sessão 8 — "Abrir Joystick Preferences" via binário direto.**
  `gtk-launch jstest-gtk` podia falhar em alguns sistemas;
  `abrirControllerTest` usa `jstest-gtk` direto. Adicionado
  `setsid -f jstest-gtk` à whitelist do `server.js`.

- **Sessão 11 — "Abrir CoolerControl" não abria.** O `.desktop` se
  chama `org.coolercontrol.CoolerControl.desktop`, não
  `coolercontrol.desktop`. `gtk-launch coolercontrol` falhava com "no
  such application". Trocado por binário direto `coolercontrol`
  (`/usr/bin/coolercontrol`). Adicionado `setsid -f coolercontrol` à
  whitelist do `server.js`.

- **Sessão 12 — GRUB sem preview das mudanças.** O botão "Aplicar
  Configuração Recomendada" aplicava mudanças sem o usuário ver o que
  seria alterado. Adicionado bloco "🔍 O que será aplicado" entre o
  painel atual e os botões, com diff (`valor atual → valor novo`) de
  cada parâmetro: `GRUB_TIMEOUT`, `GRUB_TIMEOUT_STYLE`, `GRUB_GFXMODE`,
  `GRUB_DISABLE_OS_PROBER`, `GRUB_DEFAULT`, `GRUB_DISABLE_SUBMENU`,
  `GRUB_TERMINAL_OUTPUT`, `GRUB_CMDLINE_LINUX`, `GRUB_DISABLE_RECOVERY`.
  O preview é escondido após "Aplicar" com sucesso.

- **Sessão 13 — "Verificar Versão do Fedora" com auto-load.** O painel
  era preenchido automaticamente no boot (via `verificarVersaoFedora(true)`).
  Agora só aparece após o clique no botão, por consistência com o resto
  da sessão (que só mostra dados após ação explícita).

- **Sistema de atualização — cache "sem atualização" longo demais.**
  O `verificarAtualizacoes` usava um único TTL de 12 horas para todos
  os casos. Quando o cache dizia "não há atualização", o FAP não
  consultava o GitHub novamente por 12h — então uma versão publicada
  logo após o último check ficava invisível até o TTL expirar.
  Correção: TTLs separados. **"Há atualização"** continua com 12h
  (uma vez detectado, o estado já é verdadeiro; e o
  `mostrarBadgeSeHouverAtualizacao` faz uma confirmação fresca antes
  de renderizar o badge). **"Sem atualização"** caiu para **15
  minutos**. Adicionado também `?_=<timestamp>` + `cache: 'no-store'`
  na chamada do fetch, para vencer o `Cache-Control: max-age=60` que
  o GitHub API envia por padrão — sem isso, uma release recém-publicada
  podia ficar invisível por até 1 minuto mesmo com o TTL curto.

### ⚠️ IMPORTANTE — reinstalar o FAP

**A v1.2.4 corrige um bug no sistema de notificação de atualizações.**
O cache de "não há atualização" tinha TTL de 12 horas, o que impedia o
badge de atualizações aparecer.

- reinstale o FAP para que esta correção seja aplicada.
  ```
  bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
  ```
  A reinstalação preserva `.progresso.json`, tema e idioma.

- **Se você instalou a `1.2.4` depois da republicação (o asset atual
  no GitHub):** nada a fazer. Sua cópia já tem o fix.

- **Efeito prático sem reinstalar:** quem ficou com o `script.js`
  antigo só vai ver o badge de "atualização disponível" para `1.2.5+`
  quando o cache de 12h expirar. Reinstalar é o caminho mais rápido
  e confiável.

### ⚠️ Nota de atualização

- **`server.js`** ganhou 2 entradas em `COMANDOS_SEM_AUTENTICACAO`
  (`setsid -f coolercontrol`, `setsid -f jstest-gtk`) e aceita
  `?refresh=1` no endpoint `/system-state` (invalida o cache do server).
  Reabra o FAP depois de atualizar.
- **`script.js`** — correção do TTL do cache de atualização (descrita
  acima) + repasse de `timeoutMs` na sobrescrita de
  `executarComandoGenerico` (o parâmetro estava sendo engolido em
  chamadas como a do `executarCoprEnable`).
- **`locales/en.json`** e **`locales/es.json`** ganharam 12 chaves novas
  cada (`amd_sem_gpu_*`, `intel_sem_gpu_*`, `remover_fedora_flatpak_ja_removido`,
  `tooltip_ja_removido_fedora_flatpak`, `grub_preview_*`) e 5 chaves
  renomeadas (`controller_test_*` → `joystick_prefs_*`). A chave
  `lightworks_aviso` foi removida.
- **`.progresso.json`** não muda de formato. `fap-container` não precisa
  ser recompilado.

### 🧪 Não testado nesta release

- **Waydroid** — ambiente de teste é VM, sem suporte a container
  Android. Continua como pendência desde a `1.2.2`.
- **Hardware NVIDIA real** — ambiente de teste sem GPU NVIDIA. Continua
  como pendência desde a `1.2.2`.

---

## v1.2.3-10242026

Disponível nas [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases/tag/v1.2.3-10242026).

## v1.2.2-10232026

Disponível nas [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases/tag/v1.2.2-10232026).

## v1.2.1-10212026

Disponível nas [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases).

## v1.2.0-10202026

Disponível nas [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases).
