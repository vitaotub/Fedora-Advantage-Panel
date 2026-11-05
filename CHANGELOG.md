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

Novas chaves sob `seguranca.secureboot_*` (16 no total) em EN e ES.
O namespace `sessoes.hardware.nvidia_secureboot_*` (v1.4.7) é
**preservado** — o tooltip do botão de instalar NVIDIA e o `confirm()`
ainda o usam. Zero mudança de comportamento para NVIDIA.

### 🧪 Requisito

- **Fedora 44 ou 45.**

Duas rodadas de auditoria na mesma versão (pré-publicação):

- **Rodada 1 (auditoria original):** 20 achados mapeados e endereçados +
  limpeza de dívida técnica. Corrige `sudo -n` silencioso no painel de
  SELinux, detecção de download parcial do `system-upgrade`, reboot
  fire-and-forget, TDZ de `comandoCorrigido` e `set -e` faltante em
  `executarExtrasTainted`.
- **Rodada 2 (segurança + NVIDIA + polimento):** auditoria de segurança
  no `/executar` (CSRF), reformulação completa da área NVIDIA com suporte
  a Secure Boot, correção do bug crítico do `fontes-ms-all`, e uma série
  de fixes menores (i18n ao remover app, dead code, hints de URL, timeout
  do updater, Steam sem pré-checar RPM Fusion, etc.).

### 🐛 Corrigido

#### Rodada 1

- **`estado-fedora.html` → `verificarSelinuxTroubleshoot`** — `sudo -n
  ausearch` falhava silenciosamente sem TTY, e o painel de AVCs do SELinux
  sempre reportava "0 avisos" mesmo com o sistema cheio deles. Trocado para
  `sudo ausearch` (o pkexec abre o diálogo normal). O painel agora funciona
  de verdade.
- **`server.js` → `_verificarDownloadConcluido`** — a detecção usava
  `[ -d /usr/lib/sysimage/libdnf5/offline ] && [ -n "$(ls -A ...)" ]`. Um
  download **interrompido no meio** deixa o diretório populado de arquivos
  parciais, e o FAP mostrava "Download concluído! Reiniciar agora e
  atualizar". O reboot falhava no meio do upgrade. Agora exige
  `transaction.json` (DNF5) ou o marcador final do DNF4 — só presentes
  quando o download termina com sucesso.
- **`ajustes-manutencao.html` → `executarUpgradeReboot`** — o comando
  `dnf5 system-upgrade reboot -y` reinicia a máquina; o `pkexec` morre e o
  SSE nunca recebe `end`. O `aguardarConclusaoReal` ficava pendurado por
  30 min. Trocado para fire-and-forget: dispara o POST, registra no log e
  retorna imediatamente.
- **`codecs.html` → `executarExtrasTainted`** — sem `set -e`, falha no
  primeiro `dnf install` não abortava os seguintes e o exit code final
  podia ser 0 mesmo com falha no meio. Adicionado `set -e;` no início.
- **`server.js` → `executarComAutenticacaoSegura`** — `comandoCorrigido` era
  usado em `enviarLog()` e `fs.writeFileSync()` **antes** de ser declarado
  com `const`, disparando `ReferenceError: Cannot access 'comandoCorrigido'
  before initialization` (Temporal Dead Zone). Toda autenticação falhava com
  "Autenticação cancelada" sem o pkexec nem ser invocado. Declaração
  movida para antes dos usos.
- **`install.sh` → `verificar_sistema`** — o `}` de fechamento da função
  ficou órfão na correção do `os-release`: o `desabilitar_eula_chromium()`
  passou a ser lido como bloco aninhado, e `bash -n install.sh` falhava com
  "fim inesperado do arquivo do comando `{`". Corrigido.
- **`aplicativos.html` → `instalarFlatpak` / `instalarDnf` / `instalarRpmRepo`
  / `instalarUrlRpm` / `executarRemmina` / `executarGnomeConnections` /
  `executarKrdc`** — todos chamavam `aplicarEstadoInstalavel(id, _derivarIdAbrir(id))`.
  Como o `_ABRIR_REGISTRY` já tem precedência desde a v1.4.1, o segundo
  argumento era **dead code**. Trocado por `null`.
- **`aplicativos.html` → `instalarLightworks` / `instalarRcloneManager` /
  `instalarArtCraftLauncher`** — literais `'abrir-*'` inline nos `onSucesso`.
  Trocados por `null` pelo mesmo motivo.
- **`hardware.html` → `executarCoreCtrl` / `executarLACT`** — idem.
- **`virtualizacao.html` → `executarQemuKvm` / `executarVirtualBox` /
  `executarGnomeBoxes`** — idem.
- **`producao-multimidia.html` → `executarOBSStudio` / `executarEasyEffects`**
  — idem.
- **`estado-fedora.html` → `executarSetroubleshootInstall` /
  `executarSelinuxGUIInstall`** — idem.
- **`diagnostico.html` → `executarGSmartControl`** — idem.
- **`script.js` → `_dispararFlatpak`** — o `flatpak install` podia retornar
  antes do app aparecer em `flatpak list` (race condition). O auto-reset
  `_estaRealmenteInstalado` desmarcava o botão e ele voltava a "Instalar".
  Adicionado retry de até 3× com 500 ms até o `appId` aparecer.
- **`index.html`** — bloco `.fap-toast-container` duplicado inline (já
  coberto por `style.css`). Removido. Agora `style.css` é a única fonte.

#### Rodada 2

- **`codecs.html` → `fontes-ms-all`** — o registro incluía `fontconfig` em
  `pacotes`. `fontconfig` está instalado em toda instalação Fedora com
  ambiente gráfico, então `appJaInstaladoNoSistema` retornava `true` sempre
  e o botão nascia "✅ Já estava ativo" **desabilitado** — impossível
  instalar as fontes em Fedora limpo. Pior: se o FAP já tinha instalado,
  a lixeira executava `sudo dnf remove -y cabextract fontconfig`, removendo
  `fontconfig` (dependência de dezenas de apps GUI). Corrigido: `pacotes`
  agora é só `['cabextract']`, e `comandoRemocao` apaga apenas
  `/usr/share/fonts/microsoft` + `cabextract` (nunca `fontconfig`).
- **`script.js` → `_estaRealmenteInstalado`** — o branch `dnf` só testava
  `Array.isArray(info.pacotes)`, sem checar `.length > 0`. Itens com
  `pacotes: []` (ex.: `gamemode-presets-apply`) caíam no `return false`,
  disparando auto-reset indevido. O botão "Aplicar Presets" voltava para
  o texto original após reload. Corrigido: `&& info.pacotes.length > 0`,
  alinhado com `appJaInstaladoNoSistema`.
- **`script.js` → `aplicarEstadoInstalavel`** — o branch "não instalado"
  lia `data-texto-original` (texto PT-BR bruto do HTML). Ao remover um
  app em EN/ES, o botão voltava para o PT-BR. Corrigido: usa
  `_textoOriginalTraduzido(btn)`, que respeita o idioma corrente.
  Alinhado com `aplicarEstadoToggle` (que já fazia certo).
- **`hardware.html` → `_detectarSerieNvidia`** — restaurada a regex real
  (a v1.4.7 inicial a tinha virado placeholder `akmod-nvidia*`). Agora
  cobre Fermi, Maxwell/Pascal/Volta (Titan, GTX 745/750, MX, 8xxM, 9xx,
  10xx, Quadro M/P), Kepler e Turing+. Adicionado `_serieAPartirDePkg`
  para derivar a série a partir do nome do pacote.
- **`hardware.html` → `_detectarGpuNvidia`** — agora prefere o pacote
  exato devolvido por `nvidia-detect` (via `/hardware-scan`); se ausente,
  cai na regex. O painel mostra o pacote exato (`<code>akmod-nvidia-XXX</code>`),
  não mais "auto-selecionado".
- **`hardware.html` → `executarNvidiaDriver`** — o bash instalava
  `akmod-nvidia-470xx`/`-390xx` sem avisar, contrariando o design
  (briefing: "Drivers 470xx/390xx — o FAP **desabilita** a instalação").
  Agora: (a) early-return no frontend com `alert`; (b) regex alinhada
  com o frontend; (c) `exit 1` no bash para 470xx/390xx com mensagem
  clara. Nada é instalado nessas séries.
- **`hardware.html` → `executarNvidiaDriver`** — regex do bash tinha
  lacunas: GTX 8xxM, Titan X, Titan V, Tesla M40 caíam no `else`
  (Turing+), e o regex de Fermi (`tesla (20|m?4)[0-9]{2}`) capturava
  Tesla M40 por engano. Corrigido: nova regex em 3 branches (Fermi →
  580xx → Kepler), com 580xx vindo antes de Kepler para capturar
  GTX 745/750 sem cair em `[67][0-9]{2}`.
- **`hardware.html` → `executarNvidiaModeset`** — o `onSucesso` não chamava
  `aplicarEstadoToggle`, então o botão "Desativar modesetting" só aparecia
  após reload. Corrigido: chama `aplicarEstadoToggle('nvidia-modeset-on',
  'nvidia-modeset-off', true, false)`, espelhando `executarOverclockAMD`.
- **`hardware.html` → `_aplicarEstadoNvidia`** — quando Secure Boot ativo
  e a chave ainda não existe, o botão "Instalar Driver NVIDIA" fica
  desabilitado com tooltip apontando para o painel de Secure Boot.
  Sem isso, o usuário instalava e o driver não carregava (parecia bug).
- **`hardware-service.js` → `_nvidiaDetect`** — `sudo -n dnf install
  nvidia-detect` falhava silenciosamente em quase todo sistema (sem sudo
  NOPASSWD) e adicionava latência a cada `/hardware-scan`. Removido.
  Agora usa `nvidia-detect` **se já existir**; caso contrário, retorna
  `null` e o frontend usa a regex (idêntica à do bash).
- **`gaming.html` → `executarSteam`** — pré-checa o RPM Fusion Nonfree
  **com cache fresco** (`SystemState.invalidar()` +
  `SystemState.carregar(true)`) e verifica **os dois repositórios que
  fornecem o `steam`** (`rpmfusion-nonfree` **e**
  `rpmfusion-nonfree-updates`). Sem isso, o aviso podia **não
  aparecer** quando o usuário desativava o base e o cache local (TTL
  60s) ainda dizia "ativo" — e podia **aparecer indevidamente** quando
  só o `-updates` estava ativo (cenário em que o `dnf install steam`
  funciona normalmente). A verificação de cache é obrigatória porque
  o `rpmfusion-nonfree-updates` fornece o pacote mais recente e é o
  que efetivamente resolve a dependência na prática.
- **`ajustes-manutencao.html`** — fallback sintético de
  `_carregarUpgradeStatus` usava `current_version: '?'`; o IIFE de boot
  usa `'45'`. Alinhado para `'45'` (o `'?'` faria
  `_renderizarAreaUpgrade` mostrar "Você está no Fedora ?.").
- **`sobre-fap.html` → `carregarChangelog`** — se `versaoAtual` fosse
  `undefined` (fetch de `/info` pendente), o fallback mostrava "vundefined".
  Corrigido: `versaoAtual || 'desconhecida'`.
- **`install.sh` → `_perguntar_sim_nao`** — no modo TTY, Enter vazio
  sempre retornava `false`, ignorando o `default` passado. Corrigido:
  Enter vazio respeita `default`. Contrato consistente com o modo não-TTY.
- **`aplicativos.html` → `instalarUrlRpm`** — hint de URL de fallback
  apontava para `https://api.github.com/...` (JSON) e tinha um `.replace`
  no-op. Corrigido: converte para `https://github.com/...` (HTML para o
  usuário).
- **`style.css` → `.fap-popover`** — `max-width: 360px` estourava à
  direita em viewports < 360px. Trocado por `min(360px, calc(100vw - 16px))`.

### 🔒 Segurança

- **`server.js` → `POST /executar`** — adicionado check de `Origin`. O
  comentário antigo justificava "não precisa porque Content-Type
  application/json não é simple request" — mas o servidor **nunca validava
  Content-Type**, então `fetch('http://localhost:3000/executar', { method:
  'POST', mode: 'no-cors', body: '...' })` de uma página maliciosa
  executava comandos sem interação do usuário. Agora, `Origin` precisa
  ser vazio (curl do `install.sh --uninstall`) ou same-origin
  (`http://localhost:3000` / `http://127.0.0.1:3000`). Origins externas
  recebem 403.
- **`server.js` → `_REDIRECT_ABRIR_PADRAO`** — o regex antigo aceitava
  `[^>\n]+` no lugar do binário, o que permitia `setsid -f bash -c
  'rm -rf ~' > /tmp/fap-open-x.log 2>&1 < /dev/null` passar pela
  whitelist (a exceção é testada **antes** do `_CARACTERES_ENCADEAMENTO`).
  Corrigido: whitelist explícita de binários permitidos
  (`_BINARIOS_ABRIR_WHITELIST`), espelhando `COMANDOS_SEM_AUTENTICACAO`
  + `xdg-open`.

### 🔄 Alterado

- **`script.js` → `_infoComando`** — busca O(n) em ~130 itens substituída por
  cache em objeto. Chamada centenas de vezes por sessão (aplicarEstado*,
  getTextoAposExecucao, restaurarBotao); cache é imperceptível na UX, mas
  elimina alocações desnecessárias.
- **`script.js` → remoção de `_derivarIdAbrir` e `_MAPA_ABRIR_EXCECOES`** —
  dead code desde a Rodada 2B (o `_ABRIR_REGISTRY` sempre vence). Removidos
  junto com os 16 call sites em 7 arquivos de sessão.
- **`script.js` → `_dispararAtualizacaoFAP`** — timeout de 10min → 30min.
  `install.sh --update` faz `git pull` + `npm install` + compilar o
  container; em conexões lentas ou máquinas com WebKitGTK frio, 10min
  era curto e o FAP declarava falha embora o update continuasse.
- **`aplicativos.html` → `_registrarAbrirEmMassa`** — `delete
  _ABRIR_REGISTRY['instalar-firefox']` e `['instalar-thunderbird']` logo
  após o registro em massa. Firefox e Thunderbird são apps de uso diário
  (o usuário abre pelo menu); "Abrir Firefox" no FAP abre uma nova janela
  a cada clique, o que é redundante. Ficam em "instalado-sem-abrir" (cinza
  + lixeira).
- **`aplicativos.html` → `_CMD_ABRIR_DNF`** — entradas de `instalar-firefox`
  e `instalar-thunderbird` removidas (dead code após o `delete` acima;
  `abrirAppGenerico` nunca é chamado para esses ids).
- **`aplicativos.html` → `_registrarAbrir('instalar-rustdesk')`** —
  removido. O loop de `_registrarAbrirEmMassa` (via `APPS_URL_RPM`) já
  registra `onclick: "abrirAppGenerico('instalar-rustdesk')"`, que chama
  `abrirFerramentaExterna('rustdesk', ...)`. Comportamento idêntico ao
  antigo `abrirRustDesk()` (que foi removida como órfã).
- **`hardware.html` → `executarNvidiaDriver`** — comando enriquecido com:
  (a) `kernel-devel-matched kernel-headers` (pré-requisito do akmods para
  compilar o módulo no kernel atual — documentação oficial NVIDIA);
  (b) pacotes CUDA por série (`xorg-x11-drv-nvidia-580xx-cuda` +
  `-cuda-libs` para 580xx; `xorg-x11-drv-nvidia-cuda` para Turing+) —
  sem eles, `nvidia-smi` não funciona e encoding por hardware fica
  indisponível; (c) `dnf mark user` (DNF5) / `dnf mark install` (DNF4)
  para evitar que `dnf autoremove` remova o driver; (d) `modinfo nvidia`
  pós-instalação para avisar se o módulo não foi compilado (kernel
  headers ausentes ou Secure Boot sem enrollment).
- **`hardware.html` → `restaurarEstadoSessao`** — invalida o cache de
  Secure Boot (`_secureBootNvidiaCache = null`) antes de chamar
  `_atualizarSecaoNvidia`. Se o usuário rodou `kmodgenca` em outra
  aba/terminal desde a última consulta, o painel ficaria desatualizado.
- **`install.sh` → `verificar_dependencias`** — adicionado `pciutils`
  (`lspci`) como dependência. Sem ele, `/hardware-scan` retorna vazio e
  nenhuma GPU é detectada (NVIDIA, AMD ou Intel). Já vem por padrão em
  Fedora com DE, mas a checagem garante em instalações minimalistas.
- **`server.js` → `_execReadOnly`** — adicionado `detached: true`.
  Quando o `timeout` do `exec` dispara SIGTERM no bash pai, os netos
  (`dnf repolist`, `lspci`) ficam órfãos segurando locks. Com o grupo
  isolado, o SO faz cleanup depois mesmo se o Node morrer abruptamente.
- **`server.js` → `install.sh`/`iniciar_fap.sh`** — leitura via
  `/etc/os-release` (padrão freedesktop) em vez de `/etc/fedora-release`.
  Funciona em derivados (Nobara, Ultramarine) e o teste é `ID=fedora`,
  não a existência de um arquivo específico.
- **`fap-container.c` → `set_app_icon`** — antes chamava
  `gtk_window_set_icon_from_file` e `gtk_window_set_icon` (redundante).
  Agora usa só o caminho `gdk_pixbuf_new_from_file` → `gtk_window_set_icon`
  com `g_object_unref` explícito.
- **`Makefile` → `check-basico`** — nova checagem: `_meta.lang` de
  `locales/en.json` e `locales/es.json` deve bater com o nome do arquivo.
  Pega PRs acidentais que trocaram os arquivos.

### 🚫 Removido

- **`_derivarIdAbrir` e `_MAPA_ABRIR_EXCECOES`** — dead code desde v1.4.1.
- **`_desmarcarBotaoDaFila`** — dead code (o retorno do app à fila é
  feito por `_reajustarPosicoesDaFila` e `_dispararFlatpak`).
- **`_executarDesfazerTudo` e branch `info.modo === 'desfazerTudo'` em
  `_executarRemocaoPeloWrapper`** — dead code (nenhum
  `registrarAppRemovivel` declara esse modo).
- **`abrirRustDesk`** — órfã após unificar o registro em
  `_registrarAbrirEmMassa`.
- **Firefox/Thunderbird do `_ABRIR_REGISTRY`** — "Abrir" redundante.
- **`_detectarSerieNvidia` placeholder e parâmetro `modelo` não usado** —
  substituído pela versão real com regex.
- **`sudo -n dnf install nvidia-detect`** em `hardware-service.js` —
  dead code (quase sempre falha sem NOPASSWD) e custo de fork por scan.
- **`.fap-toast-container` inline em `index.html`** — `style.css` é a
  fonte única.
- **Firefox/Thunderbird do `_CMD_ABRIR_DNF`** — dead code.

### 📝 Documentado (sem mudança de código)

- **`guiado.html` → `numerarSessao`** — `numerarSessao` depende da posição
  no array `SESSOES_PRINCIPAIS`. É intencional: reordenar o array reordena
  a numeração. Comportamento mantido.
- **`fap-container.c` → `atualizar_status`** — mantida como no-op. É
  chamada em 5 sites; remover exigiria editar 5 call sites sem ganho
  funcional. Mantida.
- **`guiado.html` → placeholders estáticos "1 de 13" e "1/13"** — são
  sobrescritos pelo JS no boot, mas aparecem "13" (correto) por uma
  fração de segundo. Correção cosmética.

### 📦 Dependências

- **`install.sh`** — `pciutils` adicionado à lista de dependências do
  sistema. Já vem por padrão em Fedora com DE; a checagem garante em
  instalações minimalistas.

### 🧪 Requisito

- **Fedora 44 ou 45.**
