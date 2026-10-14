# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> Use apenas `## vX.Y.Z-...` para os cabeçalhos de versão. Dentro de uma
> seção, use `###` para subseções — um `##` no meio encerra a captura.
> Versões anteriores ficam nas releases do GitHub.

---

## v1.0.0-10142026.b

### 🔧 Correções

- **"Ativar Terra Extras" só aparece depois que o Terra principal está ativo.** Antes, o botão ficava visível desde o início da sessão. Se o usuário clicasse nele antes de ativar o Terra principal, o comando falhava silenciosamente — os pacotes `terra-release-*` só existem no repo `terra`, que ainda não estava configurado. Agora o botão só é exibido depois que o Terra principal foi ativado, seguindo a mesma lógica visual dos outros botões da sessão.
- **Codecs agora reportam falha corretamente.** O comando de instalação usava `;` como separador, que não propaga o exit code — se o `dnf swap ffmpeg-free ffmpeg` falhasse (por exemplo, RPM Fusion não ativo), o shell continuava para os próximos comandos e o FAP via apenas o código do último, reportando "✅ Tarefa concluída" mesmo com falha no meio. Adicionado `set -e` no início do comando para abortar na primeira falha.
- **`--allowerasing` no `dnf group install multimedia`.** O grupo `multimedia` do RPM Fusion traz `gstreamer1-plugins-bad-freeworld`, que **substitui** o `gstreamer1-plugins-bad-free` do Fedora. Sem `--allowerasing`, o `dnf` podia recusar a transação com erro de conflito de pacotes.
- **Remoção de codecs agora é inteligente.** A lixeira do "Codecs Multimídia Essenciais" fazia um `dnf remove` simples dos pacotes instalados — o que deixava o sistema **sem ffmpeg nenhum** (o `ffmpeg` foi instalado via swap de `ffmpeg-free`) e **sem os plugins base** (o grupo `multimedia` havia substituído `gstreamer1-plugins-bad-free` por `-freeworld`). Agora a remoção usa um comando customizado que faz o swap de volta (`ffmpeg` → `ffmpeg-free`), remove os pacotes `-freeworld`, e reinstala os plugins base do Fedora.
- **`_executarRemocaoApp` suporta `comandoRemocao` para qualquer tipo.** Antes, o campo `comandoRemocao` só era respeitado no tipo `arquivos`. Agora funciona como override universal — permite que apps do tipo `dnf` (como os codecs) usem um comando de remoção complexo em vez de uma lista simples de `pacotes`.
- **Descrição do bloco "DVD Comercial" reescrita.** O texto prometia "firmware proprietário para alguns hardwares", mas o comando só instala a `libdvdcss` e habilita os repos `tainted` (que apenas **dão acesso** a firmware, não instalam). O texto agora reflete com precisão o que o comando faz.
- **`vulkan-amd` não passa mais `idAbrir` inexistente.** A função `aplicarEstadoInstalavel()` recebia `'abrir-vulkan-amd'` mesmo não existindo esse botão no HTML — o código caía no estado 3 (cinza) por acidente, mas era frágil. Corrigido para `null`, deixando explícito que Vulkan não tem "Abrir".
- **`en.json` corrigido.** Dois caracteres `'` (aspas simples) que sobraram após uma edição manual quebravam o JSON — o arquivo não era parseável pelo `JSON.parse`, e o FAP caía no fallback PT-BR ao trocar para inglês. Removidos.

### 🎯 Melhorias

- **Aspas corretas em `--setopt='install_weak_deps=False'`.** Estava com aspas duplas, funcionava por acidente mas era frágil. Agora usa aspas simples, forma canônica.

---

## v1.0.0-10142026

### ✨ Novidades

- **Suíte ArtCraft ampliada para 13 aplicativos.** A suíte de alternativas open-source aos produtos Adobe e Microsoft Office agora cobre também áudio, CAD, apresentações, planilhas, editor de texto, vetores gráficos e PDF:
  - **Novos:** SoundCraft (edição de áudio), GridCraft (planilhas), CadCraft (CAD), PDFCraft (PDF), DeckCraft (apresentações), FigCraft (vetores/ilustração) e WordCraft (editor de texto)
  - **Substituído:** PrintCraft foi removido do FAP — substituído por **PDFCraft**, que é o sucessor oficial do mesmo projeto
  - Todos os botões baixam sempre a última versão do RPM `.x86_64` direto do GitHub Releases de cada projeto, resolvido em runtime
  - O bloco foi renomeado para **"🎨 Suíte ArtCraft (Adobe e Office no Linux)"**
- **Codecs Multimídia seguem a receita oficial do RPM Fusion.** O botão "Instalar Codecs" agora usa `dnf group install multimedia` (grupo oficial), cobrindo codecs restritos do GStreamer (`gstreamer1-plugins-bad-freeworld`, `gstreamer1-plugins-ugly`), bibliotecas complementares (`libavcodec-freeworld`, `libheif-freeworld`) e codecs de áudio Bluetooth (`pipewire-codec-aptx`). Também instala `ffmpegthumbnailer` para geração de thumbnails de vídeo em gerenciadores de arquivos.
- **Terra Repository com prioridade baixa configurada automaticamente.** Ao habilitar o Terra, o FAP define `terra.priority=150` (o padrão do Fedora é 99 — menor número = maior precedência). Isso garante que Fedora e RPM Fusion sempre vençam em caso de conflito de pacote, e o Terra só é consultado quando o pacote não existe em nenhum dos dois.
- **Terra Extras com os 4 subrepositórios oficiais.** O botão "Ativar Terra Extras" instala `terra-release-extras`, `terra-release-mesa`, `terra-release-nvidia` e `terra-release-multimedia` de uma vez — todos os subrepositórios opcionais disponíveis. O botão "Remover Terra Extras" desinstala os quatro, deixando o repo principal `terra` intacto.
- **Botões de remoção do Terra só aparecem após a ativação.** Tanto "Remover Terra Repository" quanto "Remover Terra Extras" agora seguem a mesma lógica de visibilidade dos botões "Abrir X" — só ficam visíveis quando o repositório correspondente foi ativado.

### 🎯 Melhorias

- **Log em tempo real funciona corretamente em todos os desktops.** O `stderr` não é mais tratado como erro — o `dnf`, `flatpak` e a maioria das ferramentas CLI escrevem logs informativos (download, progresso, avisos) em `stderr` por convenção Unix. O log agora aparece todo em verde, e só o próprio servidor emite linhas vermelhas quando algo realmente falha.
- **Autenticação unificada via `pkexec` em todos os desktops.** O `kdesu` foi removido — o diálogo do pkexec é gerido pelo `polkit-kde-agent-1` no KDE (que já vem por padrão), o que dá a mesma UX do kdesu sem os bugs de retorno de processo e redirecionamento de saída.
- **Contêiner WebKitGTK fecha o servidor junto.** Quando o usuário fecha a janela do FAP, o `iniciar_fap.sh` mata o processo `node server.js` e libera a porta 3000 automaticamente. Não fica mais nada na memória.
- **`iniciar_fap.sh` instala dependências de compilação automaticamente.** Se o `fap-container` não existe e o `gcc`/`make`/`pkg-config` estiverem faltando, o script instala sozinho — cobrindo o caso de rodar o FAP direto de um clone (sem passar pelo `install.sh`).
- **Detecção de pacotes por binário em vez de por nome.** O `rpm -q pkgconfig` falha no Fedora 40+ porque o pacote foi renomeado para `pkgconf-pkg-config`. A verificação agora usa `command -v` + `pkg-config --exists`, que funcionam independente do nome do pacote.

### 🔧 Correções

- **Comando do Terra Repository corrigido.** O comando anterior usava uma URL direta descontinuada (`terra.fyralabs.com/terra-release-*.noarch.rpm`). O correto agora é `--repofrompath 'terra,https://repos.fyralabs.com/terra$releasever'`, que resolve o pacote num repositório temporário — é a forma oficial recomendada pelo projeto.
- **Terra Extras não colide mais com o repo principal.** O `--repofrompath` com ID `terra` colidia com o repo `terra` já registrado pelo `terra-release` (o dnf abortava com "ID presente mais de uma vez"). A correção remove a necessidade de `--repofrompath` no Extras — os pacotes `terra-release-*` vivem no repo principal já ativado.
- **`--setopt=localpkg_gpgcheck=0` obrigatório em RPMs baixados de URL.** O Fedora 44/45 rejeita por padrão pacotes locais sem assinatura verificada. Todos os comandos que instalam RPM de URL (Suíte ArtCraft, Lightworks, Rclone Manager) agora usam essa flag.
- **Remoção de navegadores desativa o repositório do fabricante.** A lixeira dos navegadores Opera, Brave, Vivaldi e Edge remove o pacote **e** apaga o arquivo `.repo` correspondente — deixando o sistema no estado pré-instalação.
- **EULA do Chromium suprimida.** O Fedora empacota o Chromium com uma verificação de "Additional Terms of Service" na primeira execução. O FAP cria `/etc/chromium/master_preferences` (durante a instalação) e garante a existência em runtime, suprimindo a popup.
- **Popup de permissão de localização eliminado.** O container WebKitGTK agora nega automaticamente qualquer solicitação de permissão da página (localização, câmera, microfone, notificações, clipboard) — o FAP é uma UI local e não precisa de nenhuma delas.
