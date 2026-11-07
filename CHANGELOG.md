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

## v1.5.1-11062026

Rodada de correção da instalação do driver NVIDIA em Blackwell (RTX 50xx) e do enrollment MOK com Secure Boot ativo. Testes em hardware real (RTX 5060 / GB206 / Fedora 45) revelaram **três bugs empilhados** no endpoint `/check-package-available` do `server.js`: (1) DNF5 removeu o flag `--all` do subcomando `list`, fazendo `dnf list --all --quiet` falhar com "Argumento desconhecido --all"; (2) os pacotes `akmod-nvidia-*` e `xorg-x11-drv-nvidia-*` vivem no sub-repositório `rpmfusion-nonfree-nvidia-driver`, que vem com `enabled=0` por padrão no Fedora 44/45 — nenhum comando do `dnf` os encontra sem `--enablerepo` explícito; (3) `--enablerepo` com **lista** de repos aborta se **qualquer** repo da lista não existir (o `rpmfusion-nonfree-tainted` não vem instalado por padrão), e o loop individual com `|| true` cobre isso. Além disso, o `executarNvidiaDriver` fazia `dnf install` sem habilitar o sub-repo — mesmo que a checagem passasse, o install real falhava com "no match for argument". Por fim, a compilação do `akmods` em prioridade normal travava o KWin (KDE Wayland) por starvation de CPU/I/O, e o polling de 15s no log só detectava o problema — não o mitigava. A correção remove o polling, roda o `akmods` bloqueante com `nice -n 19 ionice -c 3`, e faz `depmod`/`modprobe` condicional: em X11 carrega em runtime, em Wayland **não carrega** (evita DRM handoff prematuro que congela o compositor). Validação empírica: driver `akmod-nvidia-open` 615.71.09 + CUDA UMD 13.4 instalados com sucesso em RTX 5060 (GB206) sob Fedora 45; `nvidia-smi` funcional; VA-API NVDEC ativo (`VAProfileH264`, `VAProfileVP9`, `VAProfileAV1` com `VAEntrypointVLD`). **Passada final:** as 4 funções auxiliares de verificação (`_verificarPacoteDisponivel`, `_verificarDriverNvidiaDisponivel`, `_renderizarPanelDriverStatus`, `_aplicarEstadoNvidia`) ganharam cache TTL 60s, campo `error` no JSON e tratamento diferenciado para "definitivamente não existe" (`disponivel: false`) vs "não consegui verificar" (`disponivel: null` → painel amarelo, botão continua habilitado). O `Makefile` ganhou o check DNF5 que detecta `dnf list --all` em código (falso positivo em comentários resolvido pulando `//`, `*`, `/*`). O `install.sh` → `limpar_arquivos_antigos` agora inclui `template-sessao.html` (defesa contra órfãos em updates via `git stash pop`).

### 🔴 Corrigido

- **`server.js` → `/check-package-available`** — o endpoint usava `dnf list --all --quiet "<pkg>" | grep -q "^<pkg>"`, que é sintaxe DNF4. No DNF5 (padrão no Fedora 41+), o flag `--all` foi **removido** do subcomando `list` — o comando erra com "Argumento desconhecido --all para o comando list", o `grep` nunca casa, e o shell cai no `else → status=not_available`. Resultado: **qualquer** pacote do RPM Fusion era reportado como "não disponível", mesmo estando nos repos ativos. Bloqueava a instalação do driver NVIDIA em **todas** as gerações (não só Blackwell) e qualquer fluxo futuro que consultasse o endpoint. Correção em 4 camadas: `rpm -q` (instalado) → `dnf repoquery --available --quiet` (repos habilitados) → **loop individual** de `dnf --enablerepo=<repo> repoquery --available` nos sub-repos NVIDIA (`rpmfusion-nonfree-nvidia-driver`, `rpmfusion-nonfree`, `rpmfusion-nonfree-tainted`) → `dnf --cacheonly list --available` (fallback sem rede). O loop individual cobre o caso do `-tainted` não existir na instalação padrão. Timeout 15s → 60s. O JSON agora inclui campo `error` para distinguir "definitivamente não existe" de "não foi possível verificar".

- **`hardware.html` → `executarNvidiaDriver`** — o comando de instalação fazia `sudo dnf install -y <pkg> <cuda>` sem habilitar o sub-repositório `rpmfusion-nonfree-nvidia-driver`, que vem com `enabled=0` por padrão no Fedora 44/45. O `dnf install` falhava com "no match for argument" mesmo com o pacote presente no RPM Fusion. Agora, antes do install, o FAP verifica `dnf repolist --enabled | grep -q "rpmfusion-nonfree-nvidia-driver"` e, se não encontrar, roda `sudo dnf config-manager setopt rpmfusion-nonfree-nvidia-driver.enabled=1`. A habilitação é **permanente** (não só `--enablerepo` one-shot), porque reinstalações futuras (após update de kernel, troca de série 580xx, reboot) precisam do repo ativo.

- **`hardware.html` → `executarNvidiaDriver`** — a compilação do `akmods` rodava em background com prioridade normal do systemd, competindo com o KWin por CPU/RAM/I/O. Em máquinas com recursos limitados, o compositor Wayland (KWin/Plasma 6) travava por starvation (o numlock continuava respondendo — o kernel estava vivo, só o servidor gráfico congelou). Reproduzido em RTX 5060 + KDE Wayland + Fedora 45: freeze após ~3 iterações do polling de 15s. Agora o `akmods@<kernel>.service` automático é pausado (`systemctl stop` + `pkill`) e o FAP roda `sudo nice -n 19 ionice -c 3 /usr/sbin/akmods --force` de forma **bloqueante** — prioridade mínima de CPU e I/O, o KWin tem recursos para respirar. O polling de 15s × 40 iterações foi **removido**; o log não repete mais `[iteração N/40]`.

- **`install.sh` → `limpar_arquivos_antigos`** — a lista de arquivos antigos removidos em `--update` não incluía `template-sessao.html`, que foi removido do projeto na v1.5.0. Usuários que atualizaram via `install.sh --update` (que faz `git stash push` + `git pull` + `git stash pop`) ficavam com o arquivo órfão no diretório de instalação. Agora está na lista, e o `install.sh --update` o remove automaticamente. No ambiente de dev (`~/Downloads/fap`), o `make check-basico` falha se o arquivo existir (checks #36 e #43 detectam) — a solução é `rm template-sessao.html` manualmente.

### 🟡 Corrigido

- **`hardware.html` → `_verificarPacoteDisponivel`** — a função retornava `{ installed: false, available: false }` em **qualquer** erro (fetch falhou, HTTP não-OK, timeout), sem distinguir "definitivamente não existe" de "não consegui verificar". O `_renderizarPanelDriverStatus` interpretava os dois como "driver indisponível" e pintava o painel vermelho. Agora: (a) erros transitórios retornam o campo `error` preenchido; (b) cache em memória com TTL 60s evita 2 chamadas HTTP idênticas por boot (`_renderizarPanelDriverStatus` + `_aplicarEstadoNvidia` chamam em sequência); (c) erros não entram no cache — a próxima chamada tenta de novo; (d) `forcarRefresh = true` adiciona `&_=<timestamp>` na URL.

- **`hardware.html` → `_verificarDriverNvidiaDisponivel`** — retornava `{ disponivel: false }` tanto para "pacote não existe" quanto para "verificação falhou". O `_aplicarEstadoNvidia` (com `!disp.disponivel`) e o `executarNvidiaDriver` desabilitavam o botão em ambos os casos. Agora retorna `{ disponivel: true | false | null, motivo, erro }` — `null` significa "não foi possível verificar", e os chamadores tratam diferente.

- **`hardware.html` → `_renderizarPanelDriverStatus`** — não tratava `disponivel: null`. Agora: `false` → painel vermelho ("não disponível"); `null` → painel amarelo ("não foi possível verificar — clique em Instalar mesmo assim, o dnf install dará o erro real se o pacote não existir"). O botão **não** é desabilitado quando `null`.

- **`hardware.html` → `_aplicarEstadoNvidia`** — o `!disp.disponivel` desabilitava o botão tanto para `false` quanto para `null`. Agora só desabilita em `disp.disponivel === false` (pacote definitivamente ausente). Em `null`, o botão continua habilitado — o `dnf install` real dá o erro claro se o pacote não existir.

- **`hardware.html` → `executarNvidiaDriver`** — agora valida **`cuda`** além de `pkg` antes do install. Cobre o caso de séries legadas (Maxwell/Pascal → `akmod-nvidia-580xx` + `xorg-x11-drv-nvidia-580xx-cuda`): se a série 580xx for removida do RPM Fusion em versões futuras do Fedora, o FAP aborta com mensagem clara ("nada foi instalado") em vez de falhar no meio da compilação e fazer rollback (que é lento). Confirmado empiricamente: `xorg-x11-drv-nvidia-580xx-cuda-3:580.196.07-1.fc45.x86_64` presente no RPM Fusion 45.

- **`hardware.html` → `executarNvidiaDriver`** — adicionado aviso extra no `confirm()` quando `geracao.tipo === 'desconhecida'` (fallback Turing+). Cobre GPUs futuras (RTX 60xx) e placas antigas fora das regex (Quadro/Tesla exóticas). O aviso explica: se a GPU for Kepler/Fermi não coberta, o driver compila mas o módulo recusa carregar → tela preta; se for futura, o driver pode ainda não suportar; e instrui o usuário a usar `nomodeset` no GRUB para recuperar se o boot travar.

### 🟢 Adicionado

- **`hardware.html` → `executarNvidiaDriver`** — `depmod` + `modprobe nvidia` condicional após o sucesso do `akmods`. Em **X11** (`XDG_SESSION_TYPE=x11`): carrega o módulo em runtime, driver ativa na hora (não precisa reboot). Em **Wayland** (`XDG_SESSION_TYPE=wayland`): **NÃO carrega** — o DRM handoff do `simpledrm`/`nouveau` para o `nvidia-drm` em runtime faz o KWin congelar. Só avisa "reboot necessário". Em **TTY** (`tty`): mesmo tratamento de Wayland (reboot necessário).

- **`Makefile` → `check-basico`** — adicionado sub-check `==> Checando sintaxe DNF5 em /check-package-available (v1.5.1)...` que detecta `dnf list --all` em **código executável** do `server.js` (flag removido no DNF5) e `--enablerepo` com **lista** de repos (aborta se algum repo da lista não existir). Pula linhas que começam com `//`, `*` ou `/*` (comentários JS) — sem isso, o check dava falso positivo nos comentários explicativos do bloco `/check-package-available`. Adiciona o número da linha no erro, para facilitar debug futuro. Validação empírica: teste negativo injetando `dnf list --all` numa string JS do `server.js` faz o check falhar; com o código correto, passa.

### 📝 i18n

Novas chaves em `en.json` e `es.json`:
- `sessoes.hardware.nvidia_cuda_indisponivel`
- `sessoes.hardware.nvidia_aviso_geracao_desconhecida`

### ✅ Validação empírica (RTX 5060 / GB206 / Fedora 45)

- **Detecção:** `_detectarGeracaoNvidia` retorna `{ tipo: 'blackwell', pkg: 'akmod-nvidia-open', cuda: 'xorg-x11-drv-nvidia-cuda' }`.
- **Pré-instalação:** `curl /check-package-available?pkg=akmod-nvidia-open` → `{ installed: false, available: true }` (após a correção).
- **Install:** `dnf install akmod-nvidia-open xorg-x11-drv-nvidia-cuda` → sub-repo habilitado + pacotes instalados.
- **Compilação:** `nice -n 19 ionice -c 3 akmods --force` → módulo compilado sem travar o KWin.
- **Pós-reboot:** `modinfo nvidia` → `/lib/modules/.../extra/nvidia/nvidia.ko.xz`; `lsmod | grep nvidia` → `nvidia`, `nvidia_drm`, `nvidia_modeset`, `nvidia_uvm` carregados; `nvidia-smi` → driver 615.71.09, CUDA UMD 13.4, RTX 5060 8151MiB, 45°C, KWin/plasma/plasmashell rodando via GPU.
- **VA-API NVDEC:** ativo — `VAProfileH264`, `VAProfileVP9`, `VAProfileAV1`, `VAProfileHEVCMain10/12` com `VAEntrypointVLD`; driver `VA-API NVDEC driver [direct backend]`, VA-API 1.24.
- **`make check-basico`:** todos os 8 checks passam (sintaxe JS/Bash, JSON, CHANGELOG vs package.json, `instalar-*` com origem, 853 chaves i18n, `_meta.lang`, DNF5).

### 🧪 Requisito

- **Fedora 44 ou 45.**

### 📌 Pendências de teste (registrar em issues)

- **Ada (RTX 40xx), Ampere (RTX 30xx), Turing (RTX 20xx/GTX 16xx), Maxwell/Pascal (GTX 9xx/10xx), Quadro/Tesla** — validar detecção de geração + instalação do driver correto + CUDA em hardware real. As regex e pacotes estão corretos na teoria, mas não foram testados nessas gerações.
- **Geração "desconhecida" (RTX 60xx futura ou Quadro exótica)** — validar que o aviso extra no `confirm()` aparece, que o `akmods` compila, e que o rollback funciona se o módulo recusar carregar.
- **`modprobe nvidia` em X11 pós-compilação** — validar que o driver carrega em runtime sem reboot e `nvidia-smi` funciona.
- **KWin sob `nice 19 ionice 3`** — validar que a compilação do `akmods` não trava o compositor em máquinas com RAM/disco limitados (o cenário da RTX 5060 foi reproduzido; a correção elimina a causa raiz, mas só teste em hardware real confirma).
- **`/check-package-available` com `rpmfusion-nonfree-tainted` ausente** — validar que o loop individual não aborta (o `-tainted` não vem por padrão, e o loop pula para o próximo repo se ele não existir).
- **`/check-package-available` com pacote inexistente** (`pacote-que-nao-existe-xyz`) — validar que retorna `{ available: false, error: null }` (definitivamente não existe, não "erro de verificação").
- **Verificação NVIDIA com rede instável** — simular queda de rede durante `_verificarPacoteDisponivel`: o painel deve mostrar amarelo ("não foi possível verificar"), não vermelho ("não disponível"), e o botão **Instalar Driver NVIDIA** deve continuar habilitado. Ao reconectar e clicar em `#btn-refresh-estado`, o painel amarelo some.
- **`template-sessao.html` órfão em update** — usuário com versão antiga fazendo `install.sh --update`: o arquivo deve ser removido por `limpar_arquivos_antigos()`. No ambiente de dev, `rm template-sessao.html` manualmente antes de `make check-basico`.
