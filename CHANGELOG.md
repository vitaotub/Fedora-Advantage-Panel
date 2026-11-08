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

Consistência do fluxo de instalação/desinstalação, ferramenta de troubleshooting e correção do falso positivo do Secure Boot. A v1.5.4 corrigiu o fluxo de update (`git reset --hard`), mas dois pontos ficaram de fora: **(1)** o `instalar_fap()` ainda usava `git pull --ff-only` — o mesmo padrão que causou os conflitos da v1.5.3 — e **(2)** o `desinstalar()` não cobria o esquema FOF legado nem os 3 `/etc/sysctl.d/99-fap-*.conf`. Além disso, o `_remover()` só tentava `sudo -n` e `sudo` puro — sem `sudo -A` (askpass), os arquivos em `/etc/` **ficavam órfãos** quando o botão "Desinstalar" do FAP chamava o `install.sh --uninstall` via `setsid -f` (sem TTY). O usuário pediu um **script de limpeza pesada** para troubleshooting manual. **Revisão pós-publicação (mesma versão):** os `.fap-backup` do MangoHud/GameMode ficavam órfãos no uninstall. **Segunda revisão (mesma versão, bug reportado em hardware real):** o Secure Boot mostrava "enrollment necessário" mesmo com o driver NVIDIA funcionando — falso positivo quando o usuário enrollou uma chave DIFERENTE da `public_key.der` local. **Terceira revisão (mesma versão, bug reportado no fgc após publicar):** o banner "akmod carregado mas chave local não enrolled" aparecia com o output do `fastfetch` no lugar do nome do módulo — porque o `_exec` e o `_execReadOnly` herdavam `BASH_ENV` do terminal e o `bash -c` carregava o `.bashrc` (que tem `fastfetch`).

### 🟡 Corrigido

- **`install.sh` → `instalar_fap()`** — o ramo "repo já existe" trocou `git pull --ff-only` por `git fetch origin main` + `git reset --hard origin/main` + `git stash drop` + `git clean -fd`. Alinhado com `atualizar()` (v1.5.4). Antes, se o usuário tinha arquivos rastreados modificados, o `bash <(curl ...)` sem `--update` falhava com conflito e abortava o `install.sh`. O `--update` estava corrigido desde a v1.5.4, mas o fluxo de "reinstalar por cima" (comando padrão) não.

- **`install.sh` → `desinstalar()`** — quatro correções num bloco:
  - **FOF legado:** adicionado `$OLD_INSTALL_DIR`, symlinks `fof*`, `.desktop` FOF, ícone hicolor FOF e caches WebKitGTK FOF. Antes, `desinstalar()` só limpava FAP.
  - **Tunings de sistema:** adicionado `/etc/sysctl.d/99-fap-*.conf` (3 arquivos) + `sysctl --system`. Sem isso, os 3 arquivos ficavam órfãos no sistema após o FAP sumir.
  - **`sudo -A` no `_remover()`:** adicionada uma tentativa com askpass entre `sudo -n` e `sudo` puro. Sem isso, o botão "Desinstalar" (via `setsid -f`, sem TTY) falhava silenciosamente nos arquivos em `/etc/`.
  - **`.fap-backup` dos presets:** adicionada remoção de `~/.config/MangoHud/MangoHud.conf.fap-backup` e `~/.config/gamemode.ini.fap-backup`. Esses arquivos são criados pelo botão "Aplicar Presets" da Sessão 8. Antes, ficavam órfãos se o usuário desinstalasse sem clicar na lixeira.

- **`hardware-service.js` → `_checkMokEnrolled()` — falso positivo do Secure Boot.** A v1.5.5 só testava a chave `public_key.der` via `mokutil --test-key`. Se o usuário enrollou uma chave **diferente** — chave do RPM Fusion direto, chave de outra instalação, ou chave antiga cujo symlink `public_key.der` aponta para outra — o teste local retornava `"not enrolled"`, e o FAP mostrava **"enrollment necessário"** mesmo com o driver funcionando. Correção em **4 camadas**: (1) `mokutil --test-key public_key.der` sem sudo; (2) `sudo -n mokutil --test-key`; (3) varredura de **todos** os `.der` em `/etc/pki/akmods/certs/`; (4) **`_akmodCarregado()`** — evidência empírica via `lsmod` (cobre chaves fora do diretório). O `akmod_carregado` é retornado como campo adicional.

- **`script.js` → `_renderizarPainelSecureBoot` e `_renderizarBadgeSecureBoot` — aviso neutro.** Quando `enrolled: false` **E** `akmod_carregado !== null`, o FAP mostra **banner amarelo** ("O módulo X está funcionando, mas a chave local do FAP não está enrolled. Se for instalar outros akmods pelo FAP, complete o enrollment em Estado do Fedora → Secure Boot") em vez do painel completo. O painel vermelho continua aparecendo quando `enrolled: false` **E** `akmod_carregado === null`. 3 chaves i18n novas em EN/ES.

- **`hardware-service.js` → `_exec` — limpeza de `BASH_ENV`/`ENV` (bug reportado no fgc).** O `_exec` passava `env: process.env` para o `bash -c`. Se o processo Node herdou `BASH_ENV` (ou `ENV`) do terminal, o `bash -c` carrega o arquivo apontado — e um `.bashrc` que executa `fastfetch`/`neofetch` polui o `stdout` de **qualquer** comando shell do FAP. Sintoma: o `_akmodCarregado` retornava o fastfetch inteiro como se fosse o nome do módulo, e o banner "Chave local do akmods não está enrolled" mostrava o fastfetch colado no `{modulo}`. Correção: `envLimpo = { ...process.env, BASH_ENV: '', ENV: '' }`. O `PATH` e outras variáveis continuam herdados; só o carregamento automático do `.bashrc` é suprimido.

- **`hardware-service.js` → `_akmodCarregado()` — dupla defesa com prefixo `MATCH:`.** O script agora imprime `MATCH:$mod` (não `$mod`). O parse só aceita linhas que começam com `MATCH:` e cujo sufixo está na lista de módulos esperados. Mesmo que o `bash -c` carregue o `.bashrc` por algum motivo (ex.: `BASH_ENV` setado em outro lugar), o `fastfetch` não tem o prefixo e é ignorado.

- **`server.js` → `_execReadOnly` — limpeza de `BASH_ENV`/`ENV` (mesmo problema, endpoints de diagnóstico).** O `_execReadOnly` alimenta `/system-info`, `/top-processes`, `/disk-usage`, `/journal-errors`, `/kernel-atual`, `/reboot-needed`, `/check-package`, `/check-package-available`, `/hardware-detect-atomic`, `/grub-info`. Todos herdam o mesmo `process.env` — e o `fastfetch` do `.bashrc` pode aparecer no JSON (o `_parseChaveValor` recebia linhas `fedora=...` no meio do fastfetch). Correção idêntica: `BASH_ENV: '', ENV: ''` no `env` do `exec`.

### 🟢 Melhorado

- **`install.sh` → `ARQUIVOS_PRINCIPAIS` + `reaplicar_permissoes()`** — adicionado `scripts/fap-cleanup.sh` na verificação de arquivos e chmod `+x` explícito após o clone.

### 📄 Novo

- **`scripts/fap-cleanup.sh`** — script de limpeza pesada para troubleshooting. Remove FAP + FOF + caches + tunings + `.fap-backup` + `~/Downloads/fap`. Não remove pacotes, COPRs, Terra, repos de fabricante, chave MOK, `/etc/chromium/master_preferences` nem presets do MangoHud/GameMode. Documentado nos 3 READMEs.

### ✅ Validação empírica (VM Fedora 44)

- **`make check-basico`:** todos os 10 checks passam.
- **`install.sh` padrão (reinstalar sobre clone existente):** com arquivo rastreado modificado (`echo "x" >> server.js`), `bash <(curl ...)` antigo falhava no `git pull --ff-only`. Com o reset atômico, o clone é restaurado.
- **`install.sh --uninstall` a partir do botão:** com 3 arquivos em `/etc/sysctl.d/99-fap-*` e `SUDO_ASKPASS` setado, o `_remover` os apaga via `sudo -A`. `sysctl --system` é invocado.
- **`install.sh --uninstall` com FOF legado e `.fap-backup`:** ambos removidos.
- **`scripts/fap-cleanup.sh`:** roda como `sudo bash scripts/fap-cleanup.sh`. 9 passos + verificação final.
- **Bug do Secure Boot (hardware real do `fgc`):** com o FAP v1.5.5, driver NVIDIA 5060 funcionando, chave enrollada manualmente (diferente da `public_key.der` local) — painel mostrava "enrollment necessário". Com a v1.5.6, o FAP detecta `_akmodCarregado()` e mostra o **banner amarelo**.
- **Bug do fastfetch (hardware real do `fgc`, v1.5.6 pós-publicação):** o banner amarelo mostrava o fastfetch no `{modulo}`. Causa: `_exec` herdava `BASH_ENV`. Correção: limpar `BASH_ENV`/`ENV` + prefixo `MATCH:` no `_akmodCarregado`. **Pendente:** confirmar no fgc que o banner mostra `O módulo nvidia está carregado...` (sem o fastfetch).
- **READMEs:** seção Troubleshooting renderiza corretamente nos 3 idiomas.

### 🧪 Requisito

- **Fedora 44 ou 45.** Foco ativo em **Fedora 45 e futuras versões**. Fedora 44 é mantido como legado.

### 📌 Pendências de teste (registrar em issues)

- **Bug do fastfetch no `_akmodCarregado` (v1.5.6):** aplicar a correção no fgc e confirmar que o banner amarelo mostra `O módulo nvidia está carregado...` (sem o fastfetch). Verificar também `/system-info`, `/top-processes`, `/disk-usage`, `/journal-errors` no fgc — o fastfetch não deve aparecer em nenhum.
- **Bug do Secure Boot em hardware real (fgc):** com a correção, o painel mostra o banner amarelo. **Pendente:** rodar o enrollment da chave local (`public_key.der`) e confirmar que o painel mostra "OK verde". Testar também `enrolled: false` + `akmod_carregado: null` (remover driver NVIDIA, reboot, abrir Sessão 12) — deve mostrar o painel vermelho de 3 passos.
- **`install.sh` padrão (reinstalar sobre clone) em Fedora 45** — validar o reset atômico.
- **`install.sh --uninstall` com `SUDO_ASKPASS` setado** — validar `sudo -A`.
- **`install.sh --uninstall` com `.fap-backup`** — validar remoção.
- **`scripts/fap-cleanup.sh` em máquina com FOF legado** — validar os 8 `.desktop` + 2 ícones.
- **`scripts/fap-cleanup.sh` preservando MOK** — validar.
- **`scripts/fap-cleanup.sh` com `.fap-backup`** — validar.
- **READMEs em EN/ES** — validar Troubleshooting.
- **Demais pendências da v1.5.5, v1.5.4 e v1.5.3 permanecem válidas** — ver release notes anteriores.
