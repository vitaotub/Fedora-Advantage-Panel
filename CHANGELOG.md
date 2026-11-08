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

Consistência do fluxo de instalação/desinstalação, ferramenta de troubleshooting e correção do falso positivo do Secure Boot. A v1.5.4 corrigiu o fluxo de update (`git reset --hard`), mas dois pontos ficaram de fora: **(1)** o `instalar_fap()` ainda usava `git pull --ff-only` — o mesmo padrão que causou os conflitos da v1.5.3 — e **(2)** o `desinstalar()` não cobria o esquema FOF legado nem os 3 `/etc/sysctl.d/99-fap-*.conf`. Além disso, o `_remover()` só tentava `sudo -n` e `sudo` puro — sem `sudo -A` (askpass), os arquivos em `/etc/` **ficavam órfãos** quando o botão "Desinstalar" do FAP chamava o `install.sh --uninstall` via `setsid -f` (sem TTY). O usuário pediu um **script de limpeza pesada** para troubleshooting manual. **Revisão pós-publicação (mesma versão):** os `.fap-backup` do MangoHud/GameMode ficavam órfãos no uninstall. **Segunda revisão (mesma versão, bug reportado em hardware real):** o Secure Boot mostrava "enrollment necessário" mesmo com o driver NVIDIA funcionando — falso positivo quando o usuário enrollou uma chave DIFERENTE da `public_key.der` local. **Terceira revisão (mesma versão, bug reportado no fgc após publicar):** o banner "akmod carregado mas chave local não enrolled" aparecia com o output do `fastfetch` no lugar do nome do módulo. **Quarta revisão (mesma versão):** o `bash -c` do `_exec` e do `_execReadOnly` carregava o `.bashrc` do usuário em alguns cenários (Fedora 45 + KDE + bash 5.3.15), mesmo com `BASH_ENV=''`, poluindo o stdout de todo comando shell. O `test -d /etc/pki/akmods/certs/ && echo yes` retornava `"<fastfetch>\nyes\n"`, e o `_checkMokEnrolled` (que compara `trim() === 'yes'`) falhava.

### 🟡 Corrigido

- **`install.sh` → `instalar_fap()`** — o ramo "repo já existe" trocou `git pull --ff-only` por `git fetch origin main` + `git reset --hard origin/main` + `git stash drop` + `git clean -fd`. Alinhado com `atualizar()` (v1.5.4). Antes, se o usuário tinha arquivos rastreados modificados, o `bash <(curl ...)` sem `--update` falhava com conflito e abortava o `install.sh`.

- **`install.sh` → `desinstalar()`** — quatro correções num bloco:
  - **FOF legado:** adicionado `$OLD_INSTALL_DIR`, symlinks `fof*`, `.desktop` FOF, ícone hicolor FOF e caches WebKitGTK FOF.
  - **Tunings de sistema:** adicionado `/etc/sysctl.d/99-fap-*.conf` (3 arquivos) + `sysctl --system`.
  - **`sudo -A` no `_remover()`:** adicionada uma tentativa com askpass entre `sudo -n` e `sudo` puro.
  - **`.fap-backup` dos presets:** adicionada remoção de `~/.config/MangoHud/MangoHud.conf.fap-backup` e `~/.config/gamemode.ini.fap-backup`.

- **`hardware-service.js` → `_checkMokEnrolled()` — falso positivo do Secure Boot.** A v1.5.5 só testava a chave `public_key.der` via `mokutil --test-key`. Se o usuário enrollou uma chave **diferente** — chave do RPM Fusion direto, chave de outra instalação, ou chave antiga cujo symlink `public_key.der` aponta para outra — o teste local retornava `"not enrolled"`, e o FAP mostrava **"enrollment necessário"** mesmo com o driver funcionando. Correção em **4 camadas**: (1) `mokutil --test-key public_key.der` sem sudo; (2) `sudo -n mokutil --test-key`; (3) varredura de **todos** os `.der` em `/etc/pki/akmods/certs/`; (4) **`_akmodCarregado()`** — evidência empírica via `lsmod` (cobre chaves fora do diretório). O `akmod_carregado` é retornado como campo adicional.

- **`script.js` → `_renderizarPainelSecureBoot` e `_renderizarBadgeSecureBoot` — aviso neutro.** Quando `enrolled: false` **E** `akmod_carregado !== null`, o FAP mostra **banner amarelo** em vez do painel completo. O painel vermelho continua aparecendo quando `enrolled: false` **E** `akmod_carregado === null`. 3 chaves i18n novas em EN/ES.

- **`hardware-service.js` → `_exec` — `execFile` com `--noprofile --norc` (bug reportado no fgc).** O `_exec` usava `exec` com `shell: '/bin/bash'` e `env: { ...process.env, BASH_ENV: '', ENV: '' }`. Em alguns cenários (Fedora 45 + KDE + bash 5.3.15), o `bash -c` resultante **ainda carrega o `.bashrc` do usuário**, mesmo com `BASH_ENV=''`. O `.bashrc` do fgc roda `fastfetch`, que polui o `stdout` de **todo** comando shell. Sintoma: `test -d /etc/pki/akmods/certs/ && echo yes` retornava `"<fastfetch inteiro>\nyes\n"`, e o `_checkMokEnrolled` (que compara `stdout.trim() === 'yes'`) caía no bloco "chave não gerada". Correção: `execFile('/bin/bash', ['--noprofile', '--norc', '-c', cmd], { ... })` — o bash **ignora** `.bash_profile`, `.bashrc` e `$BASH_ENV`. Nenhum arquivo de inicialização é carregado.

- **`hardware-service.js` → `_checkMokEnrolled` — defesa em profundidade.** Os `test -d` e `test -f` agora usam `stdout.indexOf('yes') !== -1` em vez de `stdout.trim() === 'yes'`. Mesmo que algum `.bashrc` rode no futuro, o `yes` é detectado no meio do output.

- **`server.js` → `_execReadOnly` — `execFile` com `--noprofile --norc`.** Mesmo problema do `_exec` do `hardware-service.js`. O `_execReadOnly` alimenta `/system-info`, `/top-processes`, `/disk-usage`, `/journal-errors`, `/kernel-atual`, `/reboot-needed`, `/check-package`, `/check-package-available`, `/hardware-detect-atomic`, `/grub-info`. Todos herdavam o mesmo problema. Correção: `execFile('/bin/bash', ['--noprofile', '--norc', '-c', comando], { ... })` + `detached: true` (para o kill em timeout).

### 🟢 Melhorado

- **`install.sh` → `ARQUIVOS_PRINCIPAIS` + `reaplicar_permissoes()`** — adicionado `scripts/fap-cleanup.sh` na verificação de arquivos e chmod `+x` explícito após o clone.

### 📄 Novo

- **`scripts/fap-cleanup.sh`** — script de limpeza pesada para troubleshooting. Remove FAP + FOF + caches + tunings + `.fap-backup` + `~/Downloads/fap`. Não remove pacotes, COPRs, Terra, repos de fabricante, chave MOK, `/etc/chromium/master_preferences` nem presets do MangoHud/GameMode. Documentado nos 3 READMEs.

### ✅ Validação empírica (VM Fedora 44)

- **`make check-basico`:** todos os 10 checks passam.
- **`install.sh` padrão (reinstalar sobre clone existente):** com arquivo rastreado modificado, `bash <(curl ...)` antigo falhava no `git pull --ff-only`. Com o reset atômico, o clone é restaurado.
- **`install.sh --uninstall` a partir do botão:** com 3 arquivos em `/etc/sysctl.d/99-fap-*` e `SUDO_ASKPASS` setado, o `_remover` os apaga via `sudo -A`.
- **`install.sh --uninstall` com FOF legado e `.fap-backup`:** ambos removidos.
- **`scripts/fap-cleanup.sh`:** roda como `sudo bash scripts/fap-cleanup.sh`. 9 passos + verificação final.
- **Bug do Secure Boot (hardware real do `fgc`):** com o FAP v1.5.5, driver NVIDIA 5060 funcionando, chave enrollada manualmente (diferente da `public_key.der` local) — painel mostrava "enrollment necessário". Com a v1.5.6, o FAP detecta `_akmodCarregado()` e mostra o **banner amarelo**.
- **Bug do fastfetch no `_akmodCarregado` (hardware real do `fgc`):** o banner amarelo mostrava o fastfetch no `{modulo}`. Causa: `_exec` herdava `BASH_ENV`. Correção: limpar `BASH_ENV`/`ENV` + prefixo `MATCH:` no `_akmodCarregado`.
- **Bug do fastfetch no `_checkMokEnrolled` (hardware real do `fgc`, quarta revisão):** `test -d ... && echo yes` retornava `"<fastfetch>\nyes\n"`, e a comparação `=== 'yes'` falhava. Causa: `bash -c` do `exec` ainda carregava o `.bashrc` mesmo com `BASH_ENV=''`. Correção: `execFile` com `--noprofile --norc`. **Pendente:** confirmar no fgc que o `_checkMokEnrolled` retorna `enrolled: true` e o painel mostra o banner verde.
- **READMEs:** seção Troubleshooting renderiza corretamente nos 3 idiomas.

### 🧪 Requisito

- **Fedora 44 ou 45.** Foco ativo em **Fedora 45 e futuras versões**. Fedora 44 é mantido como legado.

### 📌 Pendências de teste (registrar em issues)

- **Bug do fastfetch no `_checkMokEnrolled` (v1.5.6, quarta revisão):** aplicar a correção no fgc e confirmar que `test -d ... && echo yes` retorna só `yes\n`, que `_checkMokEnrolled` retorna `enrolled: true`, e que o painel mostra o banner verde. Verificar também `/system-info`, `/top-processes`, `/disk-usage`, `/journal-errors` no fgc — o fastfetch não deve aparecer em nenhum.
- **Bug do Secure Boot em hardware real (fgc):** com a correção, o painel mostra o banner verde (chave enrolled). Testar também `enrolled: false` + `akmod_carregado: null` (remover driver NVIDIA, reboot, abrir Sessão 12) — deve mostrar o painel vermelho de 3 passos.
- **`install.sh` padrão (reinstalar sobre clone) em Fedora 45** — validar o reset atômico.
- **`install.sh --uninstall` com `SUDO_ASKPASS` setado** — validar `sudo -A`.
- **`install.sh --uninstall` com `.fap-backup`** — validar remoção.
- **`scripts/fap-cleanup.sh` em máquina com FOF legado** — validar os 8 `.desktop` + 2 ícones.
- **`scripts/fap-cleanup.sh` preservando MOK** — validar.
- **`scripts/fap-cleanup.sh` com `.fap-backup`** — validar.
- **READMEs em EN/ES** — validar Troubleshooting.
- **Demais pendências da v1.5.5, v1.5.4 e v1.5.3 permanecem válidas** — ver release notes anteriores.
