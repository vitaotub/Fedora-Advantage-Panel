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

## v1.5.8-11112026

Re-tag da v1.5.8 (mesma série, data `11112026`) consolidando quatro rodadas de auditoria — correções de segurança, expansão do Secure Boot, dívida técnica e bugs descobertos nas fases A–J dos testes de 09–11/11/2026. O PoC de injeção via `>` no `/executar` está fechado. O Secure Boot reconhece **8 estados** (incluindo o combinado). `_matarArvoreProcessos` cobre `pkexec`/`setsid`. A corrida i18n do boot foi eliminada. Todos os 11 checks do `make check-basico` passam. Validação em software: **11/11 fases A–J** (Fase I com ressalva documentada). Pendências restantes são apenas de **hardware real**.

### 🔴 Crítico — Segurança

- **`server.js` → `_temRedirectInvalido`.** O regex anterior `(?:^|\s)>>?(?![&\d])` só bloqueava `>` quando precedido por espaço. Variantes como `rpm -q kernel>~/.bashrc` (sem espaço) passavam pela whitelist de prefixo e o `bash` do `exec` interpretava `>` como redirect, sobrescrevendo arquivos do usuário. Agora `_temRedirectInvalido()` remove primeiro `2>&1`, `1>&2` e `>&2` (dup-fd legítimos) e bloqueia qualquer `>` remanescente. Cobre `>`, `>>`, `2>`, `2>>`, `>&file`, `2>&file`. O `_ehRedirectAbrirValido` (regex exato `/tmp/fap-open-*.log 2>&1 < /dev/null`) continua sendo a única exceção. **PoC fechado:** `POST /executar` com `{"comando":"rpm -q kernel>~/.bashrc"}` → `PrecisaAuth=true`.

### 🟡 Corrigido — Estabilidade e processos

- **`server.js` → `_matarArvoreProcessos` com `_listarDescendentes` (Fase I).** SIGINT agora mata a árvore completa (mesmo UID), não só o bash pai. Cobre `pkexec`/`setsid` — o `pkexec` quebra o grupo com `setsid()`, então `kill(-pid)` sozinho não alcança os netos. Correção: snapshot recursivo (`pgrep -P` até 5 níveis) **antes** de matar, SIGTERM em todos, SIGTERM no grupo, `pkill -9 -f "fap-cmd-"` como usuário, filtro `EPERM` tratado como vivo, `[cleanup] PIDs root órfãos:` logado quando `pkexec` deixa filhos root (sem `NOPASSWD: /usr/bin/kill`), SIGKILL de segurança no grupo. **Limitação documentada:** filhos root órfãos são limpos por `install.sh --update/--uninstall` e `scripts/fap-cleanup.sh` (ambos com sudo).
- **`server.js` → `_execReadOnly` registra o `ChildProcess` em `_processosAtivos` (Fase I).** `detached: true` isola o filho em seu próprio PGID, mas o `timeout` do `execFile` só mata o filho direto — subprocessos (ex.: `dnf check-update` chamado por script bash) ficavam órfãos. Agora o SIGINT cobre `_execReadOnly` também.
- **`server.js` → remoção de `vainfo`, `vdpauinfo` e `env LIBVA_DRIVER_NAME=nvidia vainfo` de `COMANDOS_SEM_AUTENTICACAO` (rodada 3).** A verificação VA-API usa `/vaapi-check` via `_execReadOnly`, bypassando `/executar`. Entradas eram dead code.
- **`system-state-service.js` → `_exec` com `execFile --noprofile --norc` (rodada 1).** Ambientes com `.bashrc` que carrega banner (`fastfetch`, `neofetch`) tinham `stdout` contaminado. Sintoma: `public_key.der` existia mas `_detectarArquivosConfig` retornava vazio → badge "enrollment necessário" falso; `rpmfusion-nonfree` ativo mas `_detectarRepos` via lixo; usuário no grupo `input` mas `_detectarGrupos` via lixo.
- **`hardware-service.js` → `_exec` com `execFile --noprofile --norc` (rodada 1).** Mesmo fix do `system-state-service.js` (v1.5.6). `env` limpo (`BASH_ENV: ''`, `ENV: ''`).

### 🟡 Corrigido — Secure Boot

- **`hardware-service.js` → `_checkMokEnrolled` expandido (rodadas 1 e 2).** 5 camadas: `mokutil --test-key` sem sudo; `sudo -n mokutil --test-key`; varredura de outros `.der` em `/etc/pki/akmods/certs/`; `_akmodCarregado()`; `_detectarOutrasChavesAkmosEnrolled()`. Retorna `enrolled: true | false | null` (indeterminado). Detecta `pending_import` (via `mokutil --list-new` + SHA1), `current_key_not_enrolled` (chave antiga enrolled, atual não), `other_akmods_keys_enrolled`. **Removido na rodada 3:** `pending_import_files` do retorno (sem consumidor).
- **`script.js` → `_renderizarBadgeSecureBoot` reordenado (Fase A1/rodada 2).** A v1.5.8 original colocava o caso "chave antiga enrolled" ANTES do caso "pending_import + chave antiga" — como o primeiro fazia `return` incondicional, o caso **COMBINADO** (`secureboot_badge_pending_import_combined`) **nunca disparava no badge**. Ordem correta (8 estados): `pending_import` (combinado + sozinho) → `mokIndeterminado` (`enrolled === null`) → `other_akmods_keys_enrolled` → `chave antiga enrolled` → `akmod carregado` → `chaveLocal` → vermelho.
- **`script.js` → `_renderizarPainelSecureBoot`/`_renderizarBadgeSecureBoot` com fonte primária `_secureBootMokCache.chave_gerada` (rodada 1).** `SystemState.arquivoPresente()` fica como fallback. Evita divergência entre as duas fontes (quando o usuário tem NOPASSWD e a chave existe, `/system-state` vê mas `/hardware-scan` não).
- **`script.js` → `_prepararSecureBoot` guard `[ ! -f public_key.der ]` (rodada 1) + re-renderização dos painéis/badges após sucesso (rodada 2).** O guard elimina ruído de erro; o re-render dá feedback visual imediato.
- **`script.js` → `_executarRemocaoApp` passa `idRemocao` (não `idComando`) como 3º argumento de `aplicarEstadoInstalavel` (rodada 1).** Metadata `data-comando-remover` errada.
- **`hardware.html` → `_atualizarSecaoNvidia` pré-popula `_secureBootMokCache` (rodada 2).** `await _detectarSecureBoot()` antes de `_aplicarEstadoNvidia` — evita estado divergente entre 1ª abertura e refresh.
- **`hardware.html` → `executarNvidiaDriver` usa `_tVars` em `nvidia_secureboot_bloqueio` (rodada 2).** A chave contém `{sessao}`; `_t` não interpola.
- **`hardware.html` → regex Turing cobre `TITAN RTX` (rodada 1).** Antes caía em Maxwell/Pascal → `akmod-nvidia-580xx` → black screen.

### 🟡 Corrigido — i18n (fix estrutural + bugs)

- **`i18n.js` → guard em `t()` durante carregamento (fix estrutural, Fase H).** A primeira carga em EN/ES disparava ~20 `[i18n] Chave não encontrada: ... em en` — todos durante o boot (o `script.js` e o `guiado.html` chamam `_t()` em handlers de `DOMContentLoaded`, que rodam em paralelo ao fetch assíncrono do JSON). Esses warnings eram ruído (o `aplicarTraducoes` corrige o DOM depois), mas mascaravam warnings REAIS. Correção: `t()` só loga warning quando `estado.carregado === true`. `tOr()` continua retornando o fallback normalmente.
- **`i18n.js` → expor `I18N.ready` (Promise).** Resolve quando o idioma atual terminou de carregar. Permite que consumidores adiem renderização até o JSON estar disponível.
- **`guiado.html` → `_reaplicarTextosDinamicos` reaplica `atualizarBotaoTema()` e `loadingTexto`.** O title do botão de tema e o texto de loading inicial são setados via `_t()` sem `data-i18n` — `I18N.aplicarTraducoes()` não os cobria. Sem essas chamadas, em EN/ES esses textos ficavam em PT até reload.
- **`guiado.html` → `carregarSessao` aguarda `I18N.ready` antes do loading.** Evita o flash "Carregando X..." em PT-BR quando o idioma ativo é EN/ES.
- **`i18n.js` → `_chaveCache` retorna `null` se versão indisponível (rodada 2).** `carregarDoCache`/`salvarNoCache` fazem no-op. Evita cache `_unknown` descartado.
- **`i18n.js` → `_limparCachesAntigos` remove `_unknown` legacy (rodada 2).** Além das versões antigas, remove também caches com sufixo `_unknown`.
- **`i18n.js` → `setLang(lang)` no-op quando `lang === estado.lang` (Fase J/rodada 3).** Antes recarregava a página à toa.
- **`locales/en.json` + `es.json` → removidas 12 chaves `nvidia_secureboot_*` órfãs (rodada 2).** Mantida apenas `nvidia_secureboot_bloqueio`. Adicionada `secureboot_badge_other_keys`.
- **`locales/en.json` + `es.json` → `btn_abrir_kate` adicionado em `sessoes.aplicativos` (rodada 4).** Sem a chave, o botão de instalar o Kate caía no fallback PT-BR em EN/ES.
- **`locales/en.json` + `es.json` → `rclone_aviso` alinhado com o novo `comandoRemocao` (rodada 3).** Menciona explicitamente que a lixeira remove apenas o `r-clone-manager` e preserva o CLI `rclone` se instalado separadamente.

### 🟡 Corrigido — Aplicativos e sessões

- **`aplicativos.html` → Rclone Manager usa `r-clone-manager` (não `rclone-manager`) (Fase C/rodada 4).** O nome real do RPM é `r-clone-manager` (com hífen entre `r` e `clone`). Antes: `pacotes: ['rclone-manager']` nunca instalava, a lixeira nunca removia, e o auto-reset (`_estaRealmenteInstalado`) limpava o marcador em loop.
- **`script.js` → `_COMANDOS_NAO_DETERMINISTICOS` (Fase D/rodada 2).** `_comandoInstalacaoDoApp` retorna `null` para RustDesk, Lightworks, Rclone Manager, ArtCraft Launcher, Brave, Vivaldi, Edge — comandos não reproduzíveis (URL resolvida em runtime, repo remoto). O popover omite o campo "Comando exato" nesses casos.
- **`script.js` → removidos `_GRUPOS_LANDING` e `_renderizarCardStatus` (rodada 2).** Dead code — `#card-status` foi removido do `index.html` na v1.4.3.
- **`script.js` → typo `_inicializarFiltrosApp` → `_inicializarFiltrosApps` (rodada 4).** Chamada silenciosamente quebrada em `DOMContentLoaded`/`sessao-carregada` (ReferenceError engolido por `setTimeout`).
- **`aplicativos.html` → `abrir-affinity` envolto em `.btn-flatpak-wrapper` (rodada 3).** Padronização do HTML.
- **`aplicativos.html` → `comandoRemocao` do Rclone Manager remove só `r-clone-manager`, preserva `rclone` (CLI) (rodada 3).** O CLI pode ter sido instalado pelo próprio Rclone Manager ou pelo usuário.
- **`gaming.html` → `gamemode-presets-apply` usa `aplicarEstadoInstalavel` (rodada 2).** Lixeira funciona; `comandoRemocao` restaura `MangoHud.conf` / `gamemode.ini` do `.fap-backup`.
- **`ajustes-manutencao.html` → `executarUpgradeReboot` bloqueia a sessão e desabilita o botão (rodada 2).** Antes, o usuário podia clicar em "Cancelar upgrade" durante o reboot.
- **`estado-fedora.html` → `grep -c ... || true` no AVC count (rodada 1).** Duplicava linha `TOTAL_AVC=0` no log.

### 🟡 Corrigido — Infraestrutura

- **`scripts/verificar-deps-container.sh` — NOVO (rodada 3).** Script idempotente de verificação de deps do container (gcc, make, pkgconf-pkg-config, `webkit2gtk4.1-devel`, `gtk3-devel`). Compartilhado entre `install.sh` e `iniciar_fap.sh`. Retorna 0 rapidamente (~6ms) se o binário `fap-container` já existe; senão checa `command -v` + `pkg-config --exists` e instala o que falta via `sudo dnf install`.
- **`install.sh` / `iniciar_fap.sh` → `instalar_dependencias_container` delega para `scripts/verificar-deps-container.sh` (rodada 3).** Fallback inline mantido para instalações antigas (pré-v1.5.8).
- **`install.sh` → `scripts/verificar-deps-container.sh` adicionado em `ARQUIVOS_PRINCIPAIS` e `reaplicar_permissoes` (rodada 3).**
- **`iniciar_fap.sh` → `while [ -f "$SERVER_PID_FILE" ]` no final (Fase B2/rodada 2).** Antes `while true` — travava para sempre se o arquivo sumisse (node morto com container aberto, SIGKILL).
- **`iniciar_fap.sh` → `.fap.pid` em `--debug` sem `tee` (Fase B2/rodada 4).** O `node server.js 2>&1 | tee -a "$LOG_FILE" &` gravava o PID do `tee` (não do node) no `.fap.pid`. `install.sh --update` matava o `tee`, deixando o node órfão. Correção: `nohup node server.js >> "$LOG_FILE" 2>&1 &` também em `--debug`.
- **`install.sh` → `_matar_servidor_fap` com `sudo pkill -9 -f "fap-cmd-"` + `sudo pkill -9 -f "pkexec /tmp/fap-cmd-"` (Fase I/rodada 4).** Limpa órfãos root do pkexec (sem `NOPASSWD: /usr/bin/kill`).
- **`scripts/fap-cleanup.sh` → `[1/9]` com `pkill -9 -f "fap-cmd-"` + `pkill -9 -f "pkexec /tmp/fap-cmd-"` (Fase I/rodada 4).** Mesmo motivo do `install.sh`.
- **`install.sh` → `_matar_servidor_fap` com `setsid -f` + retry SIGTERM→SIGKILL (rodada 1).** O `nohup bash -c "sleep 3 && kill ..."` anterior podia ser morto junto com o install.sh.
- **`Makefile` → `check-basico` inclui `scripts/fap-cleanup.sh` e `scripts/verificar-deps-container.sh` no `bash -n` (rodada 3).**
- **`Makefile` → novo check: extrair `<script>` de cada `*.html` (root) e rodar `node --check` (Fase H/rodada 4).** O `}` faltando em `hardware.html` (dentro de um `<script>` inline) passou batido em todas as versões anteriores. Sem isso, um erro de sintaxe JS em HTML de sessão quebra a sessão silenciosamente (o `eval.call` do `guiado.html` engole o erro).
- **`scripts/fap-cleanup.sh` verifica `fap-container-compat.desktop` na verificação final (rodada 1).**

### 🟢 Melhorado

- **`install.sh` → `_matar_servidor_fap` rename cosmético.** `atras` → `ar`.
- **`READMEs` → "Fedora 44 e 45 são oficialmente suportados" (rodada 2).** Removida contradição anterior ("Fedora 44 is maintained as legacy").
- **`scripts/fap-cleanup.sh` → `[1/9]` agora também limpa `fap-cmd-*` e `pkexec /tmp/fap-cmd-*` (rodada 4).**
  - **Textos PT-BR de Secure Boot — "enrolled" → "registrado(a)".** Os fallbacks PT-BR em `script.js` (`_renderizarBadgeSecureBoot`, `_renderizarPainelSecureBoot`, `_prepararSecureBoot`) e em `estado-fedora.html` (`secureboot_desc`) usavam "enrolled"/"enrollment", que soa estranho em português brasileiro. Tradução aplicada:
  - **`enrolled`** (estado) → **"registrada no firmware"** (longo) / **"registrada"** (curto)
  - **`enrollment`** (processo) → **"registro no firmware"** (longo) / **"registro"** (curto)
  - **`enrole`** (verbo) → **"registre"**
  - **`enrollada`** → **"registrada"**

  **Mantido literal:** `"Enroll MOK"` → `"Continue"` → `"Yes"` no passo 3 do painel — é o texto exato do menu do firmware que o usuário precisa buscar na tela azul. Traduzir confundiria. **`locales/en.json` e `es.json` NÃO foram tocados** — "enrolled" é o termo técnico correto nessas línguas.
  - **`_executarRemocaoApp` sem `--skip-broken` + filtra pacotes instalados (Fase K).** O `--skip-broken` (v1.5.1) foi adicionado para "ignorar pacotes não instalados" no `dnf remove`. Mas no DNF5 (Fedora 45) isso é **alias de `strict=0`** (depsolve), **não** de "ignore uninstalled". Pode também ser rejeitado pelo subcomando `remove` no DNF5, causando "Argumento desconhecido". Sintoma: Avidemux, Ardour e outros apps DNF falhavam na lixeira, exibindo erro no log. Flatpak funcionava (está na whitelist, sem pkexec, sem `--skip-broken`). Correção: filtrar `info.pacotes` por `SystemState.pacoteInstalado()` antes de montar o comando; se sobrar zero, alerta "não instalado" (mais claro que erro do dnf).
  - **`_executarRemocaoApp` libera a sessão quando `sucesso === false` (Fase K).** O `return` dentro do `if (!sucesso)` deixava `_bloquearSessao` ativo permanentemente — todos os botões da sessão ficavam cinzas/inativos após uma falha de remoção. Correção: `_liberarSessao(idComando) + _liberarOutrasSessoes() + _atualizarBloqueioNavegacao()` antes do `return`. O `catch` já cobria exceções, mas o retorno limpo do `aguardarConclusaoReal` não era coberto.
  - **`_executarRemocaoApp` sem delay de 1-2s no popup de confirmação (Fase K).** O `await SystemState.carregar(true)` estava **antes** do `confirm()`. Esse `await` faz `fetch('/system-state?refresh=1')`, que re-roda 10 comandos no servidor (`dnf repolist`, `rpm -qa`, `flatpak list`, `systemctl is-active` × 6, `sysctl -n` × 5, `grubby`, `test -f` × 8, `timedatectl`, `localectl`, `lspci -nn`). Total: 1-2s de delay **antes** do popup aparecer — perceptível e reportado. Correção: usar só dados em memória nos checks pré-confirm (`marcadoPeloFap` do `.progresso.json`, `instaladoNoSistema` do cache, `visualDizInstalado` do DOM). O refresh de verdade só acontece **depois** do `confirm`, e só quando necessário (`dnf` sem `comandoRemocao` custom — para o filtro `pacotesInstalados`). **Trade-off:** perde o alerta "não instalado" pré-confirm no cenário raro de "app removido por fora com FAP aberto". O `Fix 2` cobre com log claro.
  - **`_executarRemocaoApp` sem delay de 1-2s no popup de confirmação (Fase K).** O `await SystemState.carregar(true)` estava ANTES do `confirm()`. Esse `await` faz `fetch('/system-state?refresh=1')`, que re-roda 10 comandos no servidor (`dnf repolist`, `rpm -qa`, `flatpak list`, `systemctl is-active` × 6, `sysctl -n` × 5, `grubby`, `test -f` × 8, `timedatectl`, `localectl`, `lspci -nn`). Total: 1-2s de delay **antes** do popup aparecer — perceptível e reportado. Correção: usar só dados em memória nos checks pré-confirm (`marcadoPeloFap` do `.progresso.json`, `instaladoNoSistema` do cache, `visualDizInstalado` do DOM). O refresh de verdade só acontece **depois** do `confirm`, e só quando necessário (`dnf` sem `comandoRemocao` custom — para o filtro `pacotesInstalados`).
  - **`scripts/validar-botoes.js` — NOVO (v1.5.8-11112026).** Validador estático de contratos de botões, sem dependências. Executa em ~2s via `make check-buttons` (ou `make check-basico`, que o inclui). Pega botões que quebram silenciosamente ("cliquei e não aconteceu nada") **sem precisar clicar em nenhum**. Cobre 7 regras:
  1. Todo `data-comando` no HTML tem entrada em `SESSOES` (exceto transientes `open-*`, `abrir-*` e `resetar-progresso-fap`).
  2. Todo `idComando` em `SESSOES` tem botão no HTML (exceto flags puros `nvidia-secureboot-prepare` e `pos-upgrade-concluido`).
  3. Todo `onclick="fnName(...)"` referencia função definida em `script.js` ou no `<script>` inline da própria sessão.
  4. Todo `data-logbox="X"` tem `id="X"` no mesmo HTML.
  5. Todo `registrarAppRemovivel(id, {...})` tem `nome` + (`appId` OU `pacotes[]` OU `comandoRemocao`).
  6. Todo `_registrarAbrir(id, { textoKey })` tem a chave em `locales/en.json` **e** `locales/es.json`.
  7. `data-comando` é único em todos os HTMLs (sem duplicata entre sessões).
  
  **Bug real detectado pelo validador na 1ª execução:** `instalar-avidemux` estava em `aplicativos.html` e no `registrarAppRemovivel`, mas **faltava em `SESSOES`**. Efeito prático: o botão "Avidemux" nunca progredia (o `isExecutado` sempre retornava `false`), e o `_limparIdsOrfaos` removia o id do `.progresso.json` a cada ~5s. Adicionado em `SESSOES` com `textoConcluidoKey: 'sessoes.aplicativos.texto_concluido_avidemux'` (a chave já existia em `en.json` e `es.json`).

### 📌 Pendências de teste (hardware real)

As correções abaixo foram validadas por **mock** (Fases A1/A2) ou em software, mas **ainda requerem validação em hardware real** — registradas como pendências no release:

- **NVIDIA Blackwell (RTX 5060, GB206).** Fluxo `akmod-nvidia-open` + polling + reversão automática.
- **NVIDIA Ada, Ampere, Turing.** Fluxo `akmod-nvidia` + `xorg-x11-drv-nvidia-cuda`.
- **NVIDIA Kepler, Fermi.** Bloqueio correto (não instala).
- **Enrollment MOK end-to-end.** Secure Boot ativo + `kmodgenca` + `mokutil --import` + reboot + MOK Management + `modinfo nvidia`.
- **Intel legado (`libva-intel-driver`).** Haswell/Ivy Bridge/Sandy Bridge.
- **Drivers 470xx/390xx.** Desabilitados por design.
- **`_matarArvoreProcessos` em pkexec real.** Confirmar que os filhos root órfãos são logados e limpos por `install.sh --update/--uninstall`.
- **Fase combinada de Secure Boot.** (1) `kmodgenca -a` (chave A), (2) `mokutil --import` + reboot + enroll (chave A), (3) `kmodgenca -f` (chave B), (4) `mokutil --import public_key.der` (chave B pending). Esperado: painel/badge mostram a mensagem combinada. Validado por mock (Fase A1), falta validação em hardware real.

### ✅ Validação de software (11/11/2026)

**Fases A–J executadas em ambiente real (Fedora 45 + KDE):**

| Fase | Escopo | Resultado |
|---|---|---|
| A1 | Badge Secure Boot — 8 estados (incluindo combinado) | ✅ 8/8 |
| A2 | Painel Secure Boot — 8 estados | ✅ (mesma ordem do badge) |
| B1 | Fechar container → terminal fecha sozinho | ✅ |
| B2 | Node morto (SIGKILL) + container aberto → terminal fecha sem travar | ✅ 3/3 |
| C | Rclone Manager remove `r-clone-manager`, preserva CLI `rclone` | ✅ |
| D | Popover omite "Comando exato" nos 7 apps não-determinísticos | ✅ |
| F | `verificar-deps-container.sh` idempotente (6ms com binário, 74ms sem) | ✅ 5/5 |
| G | PoC `rpm -q kernel>~/.bashrc` bloqueado; `rpm -q kernel` e `2>&1` passam | ✅ 6/6 |
| H | Zero `_unknown` em `localStorage`; cache legacy removido | ✅ 2/2 |
| I | `_matarArvoreProcessos` mata árvore (mesmo UID); filhos root do pkexec logados | ✅ **com ressalva** (documentada) |
| J | `setLang(mesmo idioma)` é no-op | ✅ 3/3 |
| **Extra** | Fix estrutural da corrida i18n (não catalogado no briefing original) | ✅ V1–V5 |

`make check-basico`: **11/11 checks passando.**

### 🔧 Correções pós-auditoria (mesma versão)

Rodada de auditoria completa (27 achados) executada sobre a v1.5.8-11112026. Todas as correções são incrementais — nenhuma muda arquitetura, nenhuma regride os checks do `make check-basico`. Os 11 checks seguem passando e `scripts/validar-botoes.js` continua reportando 170 data-comando, 13 sessões, 402 funções, 99 `registrarAppRemovivel`, 32 `_registrarAbrir` e 0 duplicatas.

#### 🔴 Crítico — funcionalidade

- **`server.js` → `_BINARIOS_ABRIR_WHITELIST` inclui `kate`.** Antes, "Abrir Kate" caía em `precisaAutenticacao=true` e disparava `pkexec` — único caso entre todos os apps DNF com `.desktop` (os demais binários já estavam na whitelist). Correção: uma entrada adicionada.
- **`script.js` → `_sincronizarEstadoFlatpaks` com guard duplo.** Quando o `server.js` responde `200` com `{ flatpaks_installed: [], error: "..." }` (catch do `/system-state`), o guard antigo deixava passar (array vazio é `Array.isArray` válido) e o loop desmarcava em massa todos os flatpaks instalados via FAP. Correção: rejeita também quando `bruto.error` é string não vazia.
- **`ajustes-manutencao.html` → `executarGrubAplicarRecomendado` re-busca `/grub-info` e aborta se `dualBoot` não for booleano.** Antes, se `_grubInfoCache` fosse `null` (fetch falhou), `info.dualBoot` virava `undefined` → `osProber = 'true'` (desabilitava) → `grub2-mkconfig` regenerava o `grub.cfg` sem a entrada do Windows. Usuário de dual-boot perdia o Windows até clicar "Reverter" (se percebesse). Correção: sempre re-busca antes de aplicar; aborta com mensagem clara se leitura falhou; chave i18n `grub_info_indisponivel` adicionada em EN/ES.

#### 🟡 Corrigido — médio

- **`aplicativos.html` → Avidemux migrado de DNF para Flathub.** Botão agora chama `instalarFlatpak` (não `instalarDnf`); entrada em `APPS_FLATPAK`; saiu de `_CMD_ABRIR_DNF`; `registrarAppRemovivel` mudou para `tipo: 'flatpak'`; `_MAPA_ORIGEM` mudou de `'fedora'` para `'flathub'`; `SESSOES` ganhou `flatpakId: 'org.avidemux.Avidemux'`. Resolve o bug de "Abrir Avidemux" (`gtk-launch org.avidemux.Avidemux` falhava silenciosamente para o pacote DNF, que não tem esse `.desktop`).
- **`sobre-fap.html` → `desinstalarFAP` libera a sessão em todos os caminhos.** Antes, se o `install.sh` falhasse em background (rede, `git clone`, `npm install`), a Sessão 13 ficava com todos os botões desabilitados até reload manual. Correção: `_liberarSessao` + reabilitação do próprio botão + esconde `progress-container` após 3s + `_atualizarBloqueioNavegacao` antes do `alert`.
- **`server.js` → `_verificarCanalFedora` com fontes canônicas do Fedora.** Antes, `mirrors.kernel.org` hardcoded (mirror dos EUA) — redes corporativas com proxy/firewall restritivo ficavam travadas em `waiting_ga` mesmo após o GA. Correção: tenta `dl.fedoraproject.org` e depois `download.fedoraproject.org` (fallback só para erro de rede/servidor, não 4xx).
- **`server.js` → `_verificarAtualizacoesPendentes` paraleliza os dois `dnf`.** Antes, `dnf check-update` (até 30s) e `dnf needs-restarting` (até 10s) rodavam sequencialmente. Combinado com `_verificarCanalFedora` (2 hosts após B3) e demais checks, o pior caso passava de 35s. Correção: `Promise.all` reduz para 30s; client (`_carregarUpgradeStatus`) com `_sinalTimeout(60000)` cobre a margem.
- **`server.js` → 5 endpoints migrados para `_execReadOnly`.** `/kernel-atual`, `/reboot-needed`, `/kernels`, `/check-package`, `/flatpak-installed` ainda usavam `exec` com `shell: '/bin/bash'`. Mesmo vetor do que foi corrigido na v1.5.6 (`.bashrc` com `fastfetch` poluindo stdout). Todos agora usam `execFile --noprofile --norc` via `_execReadOnly`. `/kernels` também foi paralelizado (`Promise.all`) e `/check-package` passou a inspecionar `exit=$?` do `rpm -q` (locale-independente).
- **`ajustes-manutencao.html` → `executarUpgradeDownload` sem `dnf install -y dnf-plugin-system-upgrade` cego.** No DNF5 (Fedora 41+), o subcomando `system-upgrade` já vem em `dnf5-plugins`. O pacote `dnf-plugin-system-upgrade` (era DNF4) **não existe mais nos repos do Fedora 44/45** — o `&&` abortava a cadeia antes mesmo do download. Correção: guard de detecção (`dnf system-upgrade --help`) — só instala o plugin antigo se o subcomando não responder.
- **`aplicativos.html` → `instalar-firefox` com `permitirRemocaoPreExistente: false`.** Firefox é o navegador padrão do Fedora Workstation e dependência de `gnome-shell` e outros pacotes. Sem a flag, a lixeira removia o Firefox pré-existente por clique acidental. Correção: flag + `motivoBloqueio` + chave `mitigacao.firefox_preexistente` em EN/ES.
- **`sobre-fap.html` → "Reset progress" limpa `fap_upgrade_finalizado`, `fap_ultima_verificacao` e `fap_versao_remota`.** Antes, o reset deixava a área de upgrade travada em `no_upgrade_needed` para sempre e o badge do GitHub podia ficar 12h mostrando informação obsoleta. Correção: `localStorage.removeItem` × 3 antes do `DELETE /progress`. `fap_tema`/`fap_lang`/`fap_sessao_ativa` não entram (são preferências, não estado de progresso).
- **`hardware.html` → `_detectarGpuPorVendor` repassa `secure_boot` + `secure_boot_mok`; `_atualizarSecaoNvidia` popula os caches globais antes de `_aplicarEstadoNvidia`.** Antes, `_detectarSecureBoot()` (em `script.js`) fazia um **segundo** `fetch('/hardware-scan')` bypassando o cache de 5s do `_fetchHardwareScan` — 2 scans completos por load da Sessão 3. Correção: reusa o JSON do primeiro scan; `executarNvidiaDriver` também se beneficia (cache já populado).
- **`sobre-fap.html` → `desinstalarFAP` fecha o SSE em todos os caminhos (`finally`).** Antes, a conexão `EventSource` ficava aberta até o node morrer (via `_encerrarGraciosamente`), ocupando slot em `sseClients` e buffer de replay (2000 mensagens). Correção: `finally { sseConnections[idComando].close() }`.

#### 🔵 Limpeza — cosmético

- **`server.js` → 15 entradas mortas removidas de `COMANDOS_SEM_AUTENTICACAO` e `_BINARIOS_ABRIR_WHITELIST`.** Os 13 apps ArtCraft individuais (`photocraft`, `vectorcraft`, ..., `soundcraft`) e `desktopeditors`/`lightworks` (abrem via `gtk-launch`, já na whitelist) nunca são chamados pelo FAP — só `artcraft-launcher` é aberto.
- **`server.js` → strings de erro do `_parseVainfo` traduzidas para EN.** Antes, `'vainfo não encontrado...'` e `'Nenhum perfil VA-API...'` vazavam em PT-BR no painel EN/ES. Inglês como lingua franca para detalhes técnicos, consistente com o resto do código.
- **`locales/en.json` + `es.json` → 11 chaves órfãs removidas.** `btn_modeset_on`, `btn_modeset_off`, `nvidia_modeset_titulo`, `nvidia_modeset_desc`, `texto_concluido_modeset_on`, `texto_concluido_modeset_off` (bloco NVIDIA modeset removido na v1.4.9); `btn_grub_padrao`, `grub_confirmar_padrao`, `grub_msg_aplicado` (substituídos por `btn_grub_restaurar_backup`/`grub_msg_aplicado_res`); `btn_abrir_firefox`, `btn_abrir_thunderbird` (`_ABRIR_REGISTRY` deletado).
- **`aplicativos.html` → `_registrarAbrirEmMassa` skipa Firefox/Thunderbird no loop.** Antes, registrava e deletava logo depois. Skip no loop é mais direto; `delete _ABRIR_REGISTRY['instalar-firefox']` e `delete _ABRIR_REGISTRY['instalar-thunderbird']` removidos.
- **`iniciar_fap.sh` → bloco `pgrep -f "node .*$DIR/server\.js"` removido do `cleanup`.** Nunca casava (cmdline real = `node server.js`, sem path). Dead code. A limpeza efetiva continua no `lsof -t -i:3000` mais abaixo.
- **`iniciar_fap.sh` → `return 0` removidos após `_executar_terminal` em `abrir_no_terminal_nativo`.** A função faz `exit 0` internamente — os `return 0` dos callers eram dead code.
- **`install.sh` → `. /etc/os-release` em subshell.** Antes, sobrescrevia `$VERSION` (definido no topo com `package.json`). Não quebrava hoje (banner é impresso antes), mas qualquer uso futuro de `$VERSION` após `verificar_sistema` herdaria o valor errado.
- **`ajustes-manutencao.html` → botão "Aplicar GRUB" desabilita quando `mudancas === 0`.** Antes, clicava, reescrevia o arquivo com os mesmos valores, e o resultado era idêntico. Correção: `disabled=true` + `title` com a mensagem de "nada a alterar". Só desabilita se `!isExecutado('grub-aplicar-recomendado')` (não sobrescreve estado "aplicado").
- **`hardware.html` → `vaapi-check-amd`/`vaapi-check-intel` não são mais desabilitados sem GPU do vendor.** O `vainfo` é read-only e informativo mesmo em máquina Intel-only / NVIDIA-only / AMD-only. Skip no loop de desabilitar.
- **`hardware.html` → `serie` removida de `_detectarGpuNvidia`.** Dead property (`geracao.nome` duplicado; `_renderizarPanelNvidia` usa `info.geracao.nome`).
- **`hardware.html` → `_escapeHTMLNvidia` removida.** Duplicava `_escapeHTML` (global) com mesma implementação e regex. Chamadas em `_renderizarPanelNvidia`/`_renderizarPanelDriverStatus` agora usam `_escapeHTML`.
- **`script.js` → `_prepararSecureBoot` sem `_invalidarContadorSessoes`/`_atualizarProgressoGlobal`.** `nvidia-secureboot-prepare` é `sempreClicavel` → o contador nunca muda; as duas chamadas eram no-ops. `SystemState.invalidar/carregar(true)` continua (necessário para reler `public_key.der`).
- **`script.js` → `_aplicarFiltroSessao` preserva `bloco-comando` com progresso ativo.** Antes, filtrar durante uma execução escondia o `.progress-container` visível — o usuário "sumia" com o bloco mesmo com `dnf` rodando. Correção: mantém o bloco se algum `.progress-container` filho está visível. O contador do banner continua contando só matches reais.

#### 📌 Pendências de teste adicionais (hardware real)

As correções abaixo só foram validadas estaticamente — precisam de Fedora 44 ou 45 limpos (VM ou hardware):

- **Abrir Kate** (A1): confirmar que `setsid -f kate` não dispara `pkexec`.
- **Aplicar GRUB recomendado em dual-boot** (A3): `confirm` mostra "Sim"; Windows continua no menu após `grub2-mkconfig`.
- **Instalar e abrir Avidemux via Flathub** (B1): `flatpak install flathub org.avidemux.Avidemux`; "Abrir" via `gtk-launch org.avidemux.Avidemux` funciona.
- **Desinstalar FAP com `git` quebrado** (B2): sessão 13 não trava; botão reabilitado; log mostra "em andamento".
- **Baixar upgrade 44→45 em Fedora 44 limpo** (B6): não falha com "No match for argument dnf-plugin-system-upgrade".
- **Tentar remover Firefox pré-existente** (B7): lixeira escondida; tooltip com `motivoBloqueio`.
- **`/system-state` retornando erro** (A2): `_sincronizarEstadoFlatpaks` skipa; `.progresso.json` intacto.
- **`dnf check-update` + `dnf needs-restarting` em paralelo** (B4): tempo total ≤ 30s em cache frio; client não aborta.
- **5 endpoints migrados para `_execReadOnly`** (B5): `/kernel-atual`, `/reboot-needed`, `/kernels`, `/check-package`, `/flatpak-installed` funcionam sem poluição de `fastfetch` no `.bashrc`.
- **2 fetches de `/hardware-scan`** (B9): abrir Sessão 3 → `lspci`/`lsusb`/`dnf repolist`/`rpm -q`/`mokutil` rodam **uma** vez (não duas).
- **SSE do uninstall** (B10): `ss -tnp | grep :3000` após desinstalar → sem conexões penduradas.
- **`_execReadOnly` registra `ChildProcess`** (B5 + Fase I): SIGINT durante `/system-info` mata a árvore (`dnf`/`lspci`/`rpm` não ficam órfãos).
