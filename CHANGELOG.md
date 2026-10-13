# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> Use apenas `## vX.Y.Z-...` para os cabeçalhos de versão. Dentro de uma
> seção, use `###` para subseções — um `##` no meio encerra a captura.
> Versões anteriores ficam nas releases do GitHub.

---

## v1.0.0-10132026

### ✨ Novidades

- **Navegadores migrados de Flatpak para RPM oficial do fabricante.** Opera, Brave, Vivaldi e Microsoft Edge agora são instalados via repositório oficial de cada projeto — com atualizações automáticas pelo `dnf` e integração nativa com o sistema (portal XDG, aceleração gráfica, sandbox do kernel). A remoção via lixeira remove o pacote **e** desativa o repositório, deixando o sistema no estado pré-instalação. Chromium foi migrado para `dnf` puro (pacote oficial do Fedora).
  - **Opera** — repo oficial em `rpm.opera.com`, chave GPG importada automaticamente
  - **Brave** — `.repo` oficial de `brave-browser-rpm-release.s3.brave.com`
  - **Vivaldi** — `.repo` oficial de `repo.vivaldi.com`
  - **Microsoft Edge** — `.repo` oficial de `packages.microsoft.com` (⚠️ com `gpgcheck=0` definido pela própria Microsoft)
  - **Chromium** — pacote oficial do Fedora via `dnf install chromium`
  - **Zen Browser** — mantido no Flatpak (ainda sem repo RPM oficial)

### 🎯 Melhorias

- **19 aplicativos migrados de Flatpak para `dnf` (repos oficiais do Fedora).** Apps multimídia, gráficos, escritório e produção de áudio/vídeo agora são instalados via repositórios mantidos pela própria distro — menor uso de disco (sem runtimes Flatpak duplicados), atualização integrada ao `dnf upgrade` do sistema e melhor integração com o ambiente desktop.
  - **Escritório:** Thunderbird, Okular, Foliate
  - **Multimídia:** Haruna, VLC, MPV
  - **Gráficos:** Krita, Inkscape, GIMP, Darktable, FreeCAD, LibreCAD
  - **Produção:** Kdenlive, Pitivi, Blender, Ardour, LMMS, Audacity
- **Regra de origem por tipo de app na sessão Aplicativos.** O HTML agora divide os apps em três registries distintos (`APPS_FLATPAK`, `APPS_DNF`, `APPS_RPM_REPO`), cada um com seu próprio dispatcher (`instalarFlatpak`, `instalarDnf`, `instalarRpmRepo`). A escolha da origem segue um critério claro: Flatpak só quando não existe repo oficial nem pacote nos repos da distro; `dnf` quando o Fedora empacota; repo RPM oficial quando o fabricante distribui para Fedora.

### 🔧 Correções

- **`--setopt=localpkg_gpgcheck=0` obrigatório em todos os RPMs baixados de URL.** O Fedora 44/45 rejeita por padrão pacotes locais (`localpkg`) que não tenham assinatura verificada no keyring do sistema. Todos os comandos do FAP que instalam RPM baixado diretamente de URL agora usam essa flag — ArtCraft, Lightworks e Rclone Manager. Sem ela, a instalação falha silenciosamente com um erro de "assinatura não encontrada".
- **Remoção de navegadores via lixeira desativa o repositório do fabricante.** Antes da migração, a lixeira só removia o pacote (comportamento do Flatpak). Para os navegadores RPM-com-repo, remover apenas o pacote deixaria o `.repo` órfão no sistema. Agora `_executarRemocaoApp` (em `script.js`) detecta o campo `reposRemover` no registro de cada app e apaga os arquivos `.repo` junto com o pacote.
