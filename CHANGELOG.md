# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> Use apenas `## vX.Y.Z-...` para os cabeçalhos de versão. Dentro de uma
> seção, use `###` para subseções — um `##` no meio encerra a captura.
> Versões anteriores ficam nas releases do GitHub.

---

## v1.0.0-10152026.b

### 🐛 Correções críticas

- **Atualização e desinstalação do FAP agora rodam como usuário.** Antes, o clique em "Atualizar FAP" disparava `install.sh --update` via `pkexec` (root), o que reescrevia `~/.local/share/fedora-advantage-panel` com owner root. A segunda atualização, rodando como usuário, falhava por permissão. Agora o `install.sh` roda como usuário e usa `SUDO_ASKPASS` (zenity/kdialog) para as chamadas `sudo` internas.
- **Bloqueio de sessão e bloqueio entre sessões usam atributos separados.** Antes, ambos gravavam em `data-was-disabled`, causando uma race: `_liberarSessao` consumia o atributo e `_liberarOutrasSessoes` lia `disabled=false`, reabilitando botões que deveriam continuar desabilitados (ex.: "Ativar modesetting" numa máquina sem GPU NVIDIA).

### 🐛 Outras correções

- **Revert do GRUB volta a ficar acessível após falha no Apply.** Se `grub2-mkconfig` falha depois do `cp -n` já ter criado o backup, o botão "Reverter para Configuração Original" agora é reabilitado — antes, o usuário precisava recuperar via `sudo` manual.
- **Lixeira do `realtime-setup` remove o usuário do grupo.** O ícone de lixeira usava só `dnf remove`, deixando o usuário órfão no grupo `realtime`. Agora o `comandoRemocao` faz `gpasswd -d` + `dnf remove`, alinhado ao botão manual.
- **Parser do EDID usa offsets corretos** (bytes 56/58/59/61). Antes lia bytes 54/55 (pixel clock) como "H active" — valor errado quando as camadas de detecção de resolução superiores falhavam.
- **Guard de geração em `restaurarEstadoSessao` (guiado.html).** Se duas sessões carregarem em paralelo, a antiga não sobrescreve mais o DOM da nova.
- **`data-estado` residual limpo no uninstall do Waydroid.** Sem isso, o `!important` no CSS mantinha os botões cinzas mesmo após o reset inline.
- **Null checks em `webkit_settings_new` e `webkit_web_view_new_with_settings`** — evita segfault obscuro em builds sem backend.

### 🔧 Melhorias

- **Comparador de versão semântico.** `temAtualizacao` comparava strings lexicograficamente. Agora faz parsing numérico componente-a-componente, com suporte a sufixos alfanuméricos (`b`, `hotfix-1`).
- **Migração do FOF roda também no `--update`.** Antes só rodava no cenário de migração forçada (`$INSTALL_DIR` ausente).
- **`install.sh` recusa execução como root** e avisa para rodar sem `sudo`. O script instala em `$HOME` do usuário — rodar como root colocaria arquivos em `/root/.local/share`.
- **`pkill` cirúrgico no update e na migração.** Antes `pkill -f "node server.js"` matava TODOS os processos node do usuário com essa string na linha de comando. Agora casa apenas o `server.js` dentro do diretório do FAP (ou do FOF).
- **Healthcheck do servidor usa `127.0.0.1`** em vez de `localhost` (evita espera do timeout IPv6 quando `localhost` resolve para `::1`).
- **`read -p` protegido em contexto não-interativo** — evita travar em CI ou `< /dev/null`.
- **Signal handler do container é async-signal-safe.** Antes `sa.sa_handler = gtk_main_quit` era UB. Agora o handler seta um flag atômico e a main loop (via `g_timeout_add`) percebe.
- **Heurística NVIDIA: GTX 745 é Maxwell (GM107), não Kepler.** A regra agora testa `gtx 745|75x` antes de `[67]xx`. Sem isso, instalar `akmod-nvidia-470xx` numa GTX 745 resultaria em tela preta após o reboot.
- **Throttle em `_limparIdsOrfaos`.** O boot chamava a função 3x. Agora, se rodou nos últimos 5s, é no-op.
- **Cache de locale não é salvo com versão `unknown`.** Evita gravar uma chave que seria descartada no próximo `fap-versao-pronta`.
- **`hardware-service.js` faz uma única chamada `dnf repolist`** para checar rpmfusion-free e nonfree (antes eram duas).
- **`salvarProgresso` ignora ids terminados em `-open`.** Antes, cada clique em "Abrir X" criava uma entrada fantasma no `.progresso.json`.
- **Links com esquema perigoso em CHANGELOG.md** (`javascript:`, `data:`, `vbscript:`, `file:`) são rebaixados para texto puro no endpoint `/changelog`.

### 🌐 Internacionalização

- **Logs de kernel e limpeza em `ajustes-manutencao.html`** — antes PT-BR hardcoded, agora usam as chaves `kernel_*` e `log_*` dos locales.
- **Logs de desinstalação em `sobre-fap.html`** — antes PT-BR hardcoded, agora usam `desinstalar_log_iniciando` e `desinstalar_log_sucesso`.
- **`<h3>` duplicando `data-i18n` do `<summary>` pai removidos em `gaming.html`.**

### 🧹 Limpeza

- **Código morto removido:**
  - `_executarRemocaoPeloWrapper`: fallback que chamava uma função que retornava cedo.
  - `_CMD_ABRIR_DNF['instalar-onlyoffice']` e `['instalar-rustdesk']`: entradas que nunca eram alcançadas (apps estão em `APPS_URL_RPM`).
  - `aplicarEstadoInstalavel('vulkan-amd', 'abrir-vulkan-amd')`: idAbrir inexistente no DOM. Agora é `null` explícito.
  - `isReversao` decorativo no handler HTTP: sempre `false`, o parâmetro é interno.
