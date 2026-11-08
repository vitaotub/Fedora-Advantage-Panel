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

## v1.5.6-11072026

Consistência do fluxo de instalação/desinstalação, ferramenta de troubleshooting e correção do falso positivo do Secure Boot. A v1.5.4 corrigiu o fluxo de update (`git reset --hard`), mas dois pontos ficaram de fora: **(1)** o `instalar_fap()` ainda usava `git pull --ff-only` — o mesmo padrão que causou os conflitos da v1.5.3 — e **(2)** o `desinstalar()` não cobria o esquema FOF legado nem os 3 `/etc/sysctl.d/99-fap-*.conf` (tunings aplicados pelo usuário na Sessão 11). Além disso, o `_remover()` do `desinstalar()` só tentava `sudo -n` (NOPASSWD) e `sudo` puro — sem `sudo -A` (askpass), os arquivos em `/etc/` **ficavam órfãos** quando o botão "Desinstalar" do FAP chamava o `install.sh --uninstall` via `setsid -f` (sem TTY). Por fim, o usuário pediu um **script de limpeza pesada** para troubleshooting manual — quando a instalação está tão corrompida que nem reinstalar funciona. **Revisão pós-publicação (mesma versão):** os arquivos `.fap-backup` do MangoHud/GameMode (criados pelo botão "Aplicar Presets" da Sessão 8) ficavam órfãos quando o usuário desinstalava sem clicar na lixeira. **Segunda revisão (mesma versão, bug reportado em hardware real):** o Secure Boot mostrava "enrollment necessário" mesmo com o driver NVIDIA funcionando — falso positivo quando o usuário enrollou uma chave DIFERENTE da `public_key.der` local (chave do RPM Fusion direto, chave de outra instalação, chave antiga do diretório). A v1.5.6 expande o `_checkMokEnrolled` com 4 camadas e adiciona um aviso neutro (não "enrollment necessário") quando um akmod está carregado mas a chave local não está enrolled.

### 🟡 Corrigido

- **`install.sh` → `instalar_fap()`** — o ramo "repo já existe" trocou `git pull --ff-only` por `git fetch origin main` + `git reset --hard origin/main` + `git stash drop` + `git clean -fd`. Alinhado com `atualizar()` (v1.5.4). Antes, se o usuário tinha arquivos rastreados modificados (por `git stash pop` de execuções antigas, edições locais, `git checkout` interrompido), o `bash <(curl ...)` sem `--update` falhava com conflito e abortava o `install.sh`. O `--update` estava corrigido desde a v1.5.4, mas o fluxo de "reinstalar por cima" (comando padrão) não.

- **`install.sh` → `desinstalar()`** — quatro correções num bloco:
  - **FOF legado:** adicionado `$OLD_INSTALL_DIR` (`~/.local/share/fedora-only-fans`), symlinks `fof`/`fof-compat`/`fof-container`, `.desktop` FOF (`$DESKTOP_FILE_FOF*`), ícone hicolor FOF e caches WebKitGTK FOF (`~/.cache/fof-container`, `~/.local/share/fof-container`, `~/.config/fof-container`). Antes, `desinstalar()` só limpava FAP — usuário que tinha migrado do FOF e desinstalava o FAP ficava com metade dos arquivos órfãos.
  - **Tunings de sistema:** adicionado `/etc/sysctl.d/99-fap-vm-max-map-count.conf`, `99-fap-vm-swappiness.conf` e `99-fap-tcp-bbr.conf` + `sysctl --system` (para reverter o runtime ao default do Fedora imediatamente, sem reboot). Sem isso, os 3 arquivos ficavam órfãos no sistema após o FAP sumir — sem UI para reverter.
  - **`sudo -A` no `_remover()`:** adicionada uma tentativa com askpass entre `sudo -n` e `sudo` puro. Sem isso, o botão "Desinstalar" do FAP (que chama `install.sh --uninstall -y` via `setsid -f`, sem TTY) falhava silenciosamente nos arquivos em `/etc/` — o `sudo` puro retornava "no tty present and no askpass program specified" e o `_remover` printava warning sem remover.
  - **`.fap-backup` dos presets:** adicionada remoção de `~/.config/MangoHud/MangoHud.conf.fap-backup` e `~/.config/gamemode.ini.fap-backup`. Esses arquivos são criados pelo botão "Aplicar Presets" da Sessão 8 (backup antes de sobrescrever um config pré-existente do usuário). Antes, ficavam órfãos se o usuário desinstalasse sem clicar na lixeira.

- **`hardware-service.js` → `_checkMokEnrolled()` — falso positivo do Secure Boot (v1.5.6, bug reportado em hardware real).** A v1.5.5 só testava a chave `public_key.der` via `mokutil --test-key`. Se o usuário enrollou uma chave **diferente** — chave gerada pelo RPM Fusion direto, chave de outra instalação de FAP em outro HD, ou chave antiga cujo symlink `public_key.der` aponta para outra — o `mokutil --test-key` local retornava `"not enrolled"`, e o FAP mostrava **"enrollment necessário"** mesmo com o driver NVIDIA funcionando (porque a chave enrolled É reconhecida pelo firmware, só não é a local). Correção em **4 camadas**: (1) `mokutil --test-key public_key.der` sem sudo; (2) `sudo -n mokutil --test-key public_key.der`; (3) **varredura de todos os `.der` em `/etc/pki/akmods/certs/`** (cobre chaves antigas/paralelas do mesmo diretório); (4) **`_akmodCarregado()`** — evidência empírica via `lsmod` (cobre chaves fora do diretório: RPM Fusion direto, outra máquina). O `akmod_carregado` é retornado como campo adicional (não substitui `enrolled: false`) — o frontend decide o que mostrar.

- **`script.js` → `_renderizarPainelSecureBoot` e `_renderizarBadgeSecureBoot` — aviso neutro (v1.5.6).** Quando `enrolled: false` **E** `akmod_carregado !== null`, o FAP mostra um **banner amarelo** ("O módulo X está funcionando, mas a chave local do FAP não está enrolled. Se for instalar outros akmods pelo FAP, complete o enrollment em Estado do Fedora → Secure Boot") em vez do painel completo de 3 passos. O painel vermelho de "enrollment necessário" continua aparecendo quando `enrolled: false` **E** `akmod_carregado === null` (nenhum akmod funcionando — enrollment realmente necessário). Adicionado helper `_akmodCarregadoFora()` no `script.js`. 3 chaves i18n novas em EN/ES (`secureboot_akmod_carregado_titulo`, `secureboot_akmod_carregado_desc`, `secureboot_badge_akmod_carregado`).

### 🟢 Melhorado

- **`install.sh` → `ARQUIVOS_PRINCIPAIS` + `reaplicar_permissoes()`** — adicionado `scripts/fap-cleanup.sh` na verificação de arquivos e chmod `+x` explícito após o clone. O loop defensivo de `*.sh` em `reaplicar_permissoes()` só cobria arquivos na raiz; o novo script vive em `scripts/`, então precisava de tratamento específico.

### 📄 Novo

- **`scripts/fap-cleanup.sh`** — script de limpeza pesada para troubleshooting. Roda sob `sudo` (usa `$SUDO_USER` para o home do usuário real), pede 5s de confirmação, e remove **tudo** relacionado ao FAP, FOF, caches, tunings e `~/Downloads/fap`. Também remove os `.fap-backup` de MangoHud/GameMode. Não remove pacotes (Flatpak/DNF/akmods), COPRs, Terra, repos de fabricante, chave MOK, `/etc/chromium/master_preferences` nem presets do MangoHud/GameMode (por design — são de sistema, não do FAP). Documentado nos 3 READMEs com avisos claros sobre `~/Downloads/fap` e `.progresso.json`.

### ✅ Validação empírica (VM Fedora 44)

- **`make check-basico`:** todos os 10 checks passam (sintaxe JS, sintaxe Bash, JSON, CHANGELOG vs package.json, `_MAPA_ORIGEM`, chaves i18n, `_meta.lang`, DNF5).
- **`install.sh` padrão (reinstalar sobre clone existente):** com arquivo rastreado modificado (`echo "x" >> server.js`), `bash <(curl ...)` antigo falhava no `git pull --ff-only`. Com o reset atômico, o clone é restaurado ao estado do `origin/main` e a instalação prossegue. `.progresso.json` (não tracked) é preservado.
- **`install.sh --uninstall` a partir do botão "Desinstalar":** com 3 arquivos em `/etc/sysctl.d/99-fap-*` e `SUDO_ASKPASS` setado, o `_remover` agora os apaga via `sudo -A`. `sysctl --system` é invocado; `vm.max_map_count` volta a `65530`, `net.ipv4.tcp_congestion_control` a `cubic`, `vm.swappiness` a `60`. Sem `SUDO_ASKPASS` (terminal interativo), o `_remover` cai no `sudo` puro.
- **`install.sh --uninstall` com FOF legado:** se `~/.local/share/fedora-only-fans/` existir, é removido. Symlinks `fof*`, `.desktop` FOF, ícone hicolor FOF e caches WebKitGTK FOF também.
- **`install.sh --uninstall` com `.fap-backup`:** com `~/.config/MangoHud/MangoHud.conf.fap-backup` e `~/.config/gamemode.ini.fap-backup` presentes, ambos são removidos.
- **`scripts/fap-cleanup.sh`:** roda como `sudo bash scripts/fap-cleanup.sh`. Mostra aviso de 5s, executa os 9 passos, faz verificação final. Detecta resíduos corretamente (nenhum falso positivo/negativo), incluindo os `.fap-backup`.
- **Bug do Secure Boot (v1.5.6, hardware real do `fgc`):** com o FAP v1.5.5 instalado no HD principal, o driver NVIDIA 5060 funcionando, e a chave do Secure Boot enrollada manualmente (diferente da `public_key.der` local), o painel mostrava "enrollment necessário". Com a correção, o FAP detecta `_akmodCarregado()` (`nvidia`) e mostra o **banner amarelo** com a mensagem "O módulo nvidia está funcionando, mas a chave local do FAP não está enrolled. Se for instalar outros akmods pelo FAP, complete o enrollment em Estado do Fedora → Secure Boot." Não é mais falso positivo.
- **READMEs:** nova seção Troubleshooting renderiza corretamente nos 3 idiomas.

### 🧪 Requisito

- **Fedora 44 ou 45.** Foco ativo de desenvolvimento e testes em **Fedora 45 e futuras versões**. Fedora 44 é mantido como legado — o código continua funcionando, mas não fazemos mais testes ativos nele.

### 📌 Pendências de teste (registrar em issues)

- **Bug do Secure Boot em hardware real (fgc, v1.5.6):** com a correção, o painel mostra o banner amarelo. **Pendente:** rodar o enrollment da chave local (`public_key.der`) e confirmar que o banner desaparece e o painel mostra "OK verde". Precisa testar também o caso `enrolled: false` + `akmod_carregado: null` (nenhum akmod funcionando) — deve continuar mostrando o painel de 3 passos.
- **`install.sh` padrão (reinstalar sobre clone) em Fedora 45** — validar o reset atômico com `git stash pop` de execuções antigas (o `git clean -fd` deve remover `fap-container` stale).
- **`install.sh --uninstall` com `SUDO_ASKPASS` setado (botão "Desinstalar" do FAP)** — forçar arquivos em `/etc/sysctl.d/99-fap-*` e confirmar que são removidos via `sudo -A`. Se o askpass falhar (usuário cancelou), o `_remover` cai no `sudo` puro e reporta falha no relatório final.
- **`install.sh --uninstall` com `.fap-backup` presentes** — forçar `~/.config/MangoHud/MangoHud.conf.fap-backup` e `~/.config/gamemode.ini.fap-backup`, rodar o uninstall e confirmar que são removidos.
- **`scripts/fap-cleanup.sh` em máquina com FOF legado** — confirmar que os 8 nomes de `.desktop` são removidos (FAP + FOF) e que os 2 ícones hicolor vão embora.
- **`scripts/fap-cleanup.sh` preservando MOK** — confirmar que `/etc/pki/akmods/certs/public_key.der` continua intacto após rodar (mesmo com Secure Boot ativo).
- **`scripts/fap-cleanup.sh` com `.fap-backup` presentes** — forçar os 2 `.fap-backup` e confirmar que são removidos.
- **READMEs em EN/ES** — validar a seção Troubleshooting renderizada.
- **Demais pendências da v1.5.5, v1.5.4 e v1.5.3 permanecem válidas** — ver release notes anteriores.
