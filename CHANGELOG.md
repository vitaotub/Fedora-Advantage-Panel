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

## v1.2.3-10242026

Correções de bugs encontrados durante a rodada de testes em uma instalação
limpa do Fedora 44 (notebook com GPU AMD Barceló), e melhoria de UX no
fechamento do FAP após desinstalação.

### 🐛 Corrigido

- **Pacotes pré-instalados no Fedora sendo marcados como "já instalados
  pelo FAP"** — Fontes Microsoft (`fontconfig`), Vulkan/Mesa
  (`mesa-vulkan-drivers`, `mesa-dri-drivers`), VA-API (`ffmpeg-libs`,
  `libva`), CUPS (`cups`, `avahi`, `ghostscript`) e Samba vêm por padrão
  em qualquer Fedora Workstation com GUI. O botão mostrava
  "✅ Já estava ativo" numa instalação limpa, antes do usuário clicar em
  nada. Adicionada flag `ignorarPreExistente: true` no registro de
  `registrarAppRemovivel` — esses botões começam em "Instalar" e só
  passam para "Concluído" quando o FAP realmente instala. A detecção
  continua funcionando para o resto do FAP.

- **Erro de conflito de pacotes ao instalar VA-API no Fedora 44** —
  `sudo dnf install mesa-va-drivers-freeworld mesa-va-drivers-freeworld.i686`
  disparava `mesa-libgl requires mesa-dri-drivers, but none of the
  providers can be installed`. Causa: o `mesa-va-drivers-freeworld.i686`
  exige `mesa-dri-drivers.i686` na versão exata, mas o Fedora 44 está
  eliminando o multilib i686 e o RPM Fusion pode não ter a versão
  correspondente. Correção: instalação padrão instala só x86_64
  (`sudo dnf install -y ffmpeg-libs libva libva-utils mesa-va-drivers-freeworld`),
  sem `swap` e sem `.i686`. Quem precisa de 32-bit (Steam) instala
  manualmente.

- **`dnf swap` desnecessário no VA-API** — no Fedora 44, o
  `mesa-va-drivers-freeworld` instala em `/usr/lib64/dri-freeworld/`,
  diretório separado do `mesa-va-drivers` do Fedora. Não há mais conflito
  de arquivos, então `dnf install` puro é a receita correta. O `swap`
  (receita antiga) disparava erro de `mesa-filesystem`. Trocado em
  `executarVaapi` (hardware.html) e em `DRIVER_COMMANDS` de
  `driver-amd-vaapi-install`/`remove` (dispositivos-perifericos.html).

- **Botão "Desinstalar FAP" não desinstalava nada** — três bugs
  encadeados:
  1. `install.sh` rodava com `cwd = $INSTALL_DIR`, e `rm -rf` no
     diretório atual falha com `EBUSY`. Corrigido com `cd ~` no início
     de `desinstalar()`.
  2. O `echo "s" |` era consumido pelo `curl` dentro de `<(...)` antes
     do `install.sh` rodar, então o `read` nunca recebia o `"s"` e caía
     no default `"n"`. Corrigido com flag `-y`/`--yes` que pula o
     prompt, sem depender de stdin.
  3. `bash <(curl ...) --uninstall` era filho do node; quando o
     `install.sh` removia o diretório do node (ou o node recebia
     SIGTERM), o bash filho era morto junto. Corrigido rodando sob
     `setsid -f bash -c '...'`.

  Complementado por: `_remover` com fallback `sudo rm` (para arquivos
  criados por root), relatório final de sucessos/falhas, `install.sh`
  não aborta mais no primeiro `rm` com falha (`set +e`).

- **Terminal e container do FAP não fechavam após desinstalação** — o
  `install.sh --uninstall` removia os arquivos mas não avisava o node
  nem o `fap-container`, que ficavam "zumbis" até o usuário fechar a
  janela manualmente. Adicionado endpoint `POST /shutdown` no
  `server.js`, que mata o `fap-container` e encerra o node
  graciosamente. O `install.sh` chama `/shutdown` no final da
  desinstalação. Quando o container fecha, o `iniciar_fap.sh` (que
  estava bloqueante no `abrir_navegador`) detecta e fecha o terminal.

### ⚠️ Nota de atualização

- **`server.js`** ganhou o endpoint `POST /shutdown` e o regex do
  `PADROES_UPDATE_WHITELIST` foi expandido para aceitar
  `setsid -f bash -c '... --uninstall -y'`. Reabra o FAP depois de
  atualizar.
- **`install.sh`** ganhou a função `desinstalar()` reescrita (defensiva)
  e a flag `-y`/`--yes`. Aplica em `~/Downloads/fap/install.sh` **e**
  `~/.local/share/fedora-advantage-panel/install.sh` para manter
  sincronia.
- **`sobre-fap.html`** mudou o comando do botão de desinstalação para
  `setsid -f bash -c '... --uninstall -y'`.
- **`.progresso.json`** não muda de formato. `fap-container` não precisa
  ser recompilado.
- **Nenhum efeito em**: waydroid, gaming, virtualização, diagnóstico,
  estado-fedora, sobre-fap (fora do comando de desinstalação).

### 🧪 Não testado nesta release

- **Waydroid** — ambiente de teste é VM, sem suporte a container
  Android. Continua como pendência desde a `1.2.2`.
- **Hardware NVIDIA real** — ambiente de teste sem GPU NVIDIA. Continua
  como pendência desde a `1.2.2`.

---

## v1.2.2-10232026

A Suíte ArtCraft deixa de instalar os 13 apps individualmente e passa a
instalar apenas o **launcher oficial**. Cinco novos aplicativos entram na
sessão 6, um novo bloco **"🔧 Utilitários"** é criado, e três rodadas de
testes pós-implementação corrigiram bugs funcionais (5 apps novos +
ArtCraft Launcher + Firefox), de consistência i18n (botões com status
diferente em PT/EN/ES) e de UX (feedback do "Verificar Versão", tooltip
indevido em botões "Abrir X", setroubleshoot sem botão de abrir).

Disponível nas [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases/tag/v1.2.2-10232026).

## v1.2.1-10212026

Disponível nas [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases).

## v1.2.0-10202026

Disponível nas [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases).
