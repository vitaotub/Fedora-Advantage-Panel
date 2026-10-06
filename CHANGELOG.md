# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> Use apenas `## vX.Y.Z-...` para os cabeçalhos de versão. Dentro de uma
> seção, use `###` para subseções — um `##` no meio encerra a captura.
> Versões anteriores ficam nas releases do GitHub.

---

## v1.0.0-10062026.b

### 🔧 Correções

- **Broadcom BCM43xx — botão Reverter não fica mais sempre clicável.** O item "Broadcom BCM43xx (Wi-Fi)" não tem repositório separado (usa o RPM Fusion já configurado na Sessão 1), e isso fazia o botão "🗑️ Reverter" aparecer habilitado desde o início — mesmo antes do driver ser instalado. A função `aplicarEstadoItemCompleto()` agora diferencia itens **com** repositório (Razer, Xbox) de itens **sem** repositório (Broadcom): no segundo caso, o Reverter só habilita após o pacote ser de fato instalado. Alinha o comportamento com o resto da sessão, onde Reverter fica desabilitado até que o recurso seja ativado.
- **Suíte ArtCraft — botões nunca instalavam.** Os 7 botões (PhotoCraft, VectorCraft, FilmCraft, LightCraft, PrintCraft, EffectCraft, DesignCraft) falhavam silenciosamente: o comando usava `grep -oP '\.x86_64\.rpm'` para extrair a URL do asset da API do GitHub, mas o JSON da release quebra o campo `browser_download_url` em **múltiplas linhas** — então o padrão nunca casava. Além disso, os projetos publicam os RPMs com hífen antes da arquitetura (`<app>-<versao>-linux-x86_64.rpm`), não com ponto. Corrigido em duas frentes: (1) substituído o `grep` por `node -e` (parse JSON robusto, já que o Node já está no sistema), e (2) regex flexível `/x86[_-]64\.rpm$/i` que aceita ambos os formatos de nome.
- **`controller-test-install` registrado duas vezes em `gaming.html`.** Havia duas chamadas idênticas a `registrarAppRemovivel('controller-test-install', ...)` — a segunda sobrescrevia a primeira, com o mesmo conteúdo. Código morto removido.
- **`'obs-cam'` duplicado no array `SESSOES` (`script.js`).** No bloco `producao-multimidia`, a chave `'obs-cam'` aparecia duas vezes no objeto `comandos` — JavaScript sobrescrevia a primeira com a segunda (idênticas), mas era redundância silenciosa. Entrada duplicada removida.
- **Apps instalados fora do FAP não faziam o swap "Instalar" → "Abrir".** Quando o usuário instalava um Flatpak por fora (via terminal, GNOME Software, etc.), o FAP detectava corretamente e mostrava a lixeira — mas o botão de instalar continuava em cinza com "✅ instalado", sem virar "🚀 Abrir <App>". A causa: `_sincronizarEstadoFlatpaks()` chamava `restaurarBotaoAposExecucao()`, que só pinta o botão de cinza, em vez de `aplicarEstadoInstalavel()`, que faz o swap completo. Corrigido nos dois sentidos (marcar como instalado e desmarcar quando removido por fora).
- **Sessão Aplicativos não tinha botões "Abrir" para os Flatpaks.** Como consequência do item acima, os ~43 apps Flatpak da sessão 6 não tinham botão `btn-abrir-<nome>` no HTML — então `aplicarEstadoInstalavel()` caía sempre no estado 3 (cinza) em vez do estado 2 (verde "Abrir"). A função `_criarBotoesAbrirFlatpak()` cria esses botões dinamicamente a partir do registry `APPS_FLATPAK` no boot da sessão, cobrindo todos os apps atuais e futuros sem editar o HTML.

### 🎯 Melhorias

- **Aviso informativo ao instalar a Gamescope Session sem Steam nativo.** O comando `gamescope-session-install` agora verifica `command -v steam` antes de criar o launcher. Se o Steam nativo não estiver presente (usuário só tem o Flatpak, por exemplo), o FAP emite um aviso claro no log — mas **não aborta**, porque o usuário pode instalar o Steam depois e a sessão passa a funcionar sem reinstalar os arquivos. Antes, a sessão Gamescope aparecia no seletor mas travava no login sem nenhum aviso rastreável.
- **Mensagens de erro claras na Suíte ArtCraft.** Antes, qualquer falha no download do RPM exibia "❌ Nenhum RPM x86_64 encontrado" — mesmo quando a causa real era rede fora ou rate limit da API do GitHub. Agora cada cenário tem mensagem própria:
  - **Rede fora** → "❌ Falha ao contatar a API do GitHub. Verifique sua conexão de rede e tente novamente."
  - **Rate limit / 404** → "⚠️ API do GitHub respondeu com erro" + link direto para a release
  - **Sem `.rpm` publicado** → "❌ Release encontrada, mas sem arquivo .x86_64.rpm" + link para a release

---

## v1.0.0-10062026

### ✨ Novidades

- **Sessão Gamescope reformulada (receita oficial do Fedora)**: a sessão Gamescope agora é criada manualmente seguindo a documentação oficial do Fedora Docs, em vez de depender do COPR `pvermeer/gamescope-session-steam`. O script `/usr/bin/gamescope-session` passa as flags `-steamdeck -steamos3` ao Steam (obrigatórias para abrir em Big Picture) e a entrada `.desktop` inclui `TryExec` (obrigatório no plasmalogin, display manager do Fedora 45 KDE).
- **Detecção dinâmica de resolução** na sessão Gamescope: em vez de 1920x1080 fixos, o FAP lê o modo atual via `/sys/class/drm/card*/mode`. Funciona em 1440p, 4K, ultrawide e monitores com resolução não-padrão.
- **Log de sessão Gamescope** em `/tmp/fap-gamescope-session.log`: se a sessão falhar, o motivo fica registrado. O script anterior engolia stdout/stderr.
- **Pré-requisito gamescope automático**: o botão "Instalar Gamescope Session" agora instala o `gamescope` (do Fedora oficial) antes de criar o script e o `.desktop`. Não é mais necessário clicar em dois botões separados.
- **Novo bloco "📡 Ferramentas de Acesso Remoto"** na sessão Aplicativos Recomendados: RustDesk (controle remoto assistido, Flatpak), Remmina (cliente RDP/VNC completo), GNOME Connections (cliente RDP/VNC do GNOME) e KRDC (cliente RDP/VNC do KDE). Todos com botão "Abrir" após instalação e lixeira para remover.
- **Detecção de app nativo por desktop**: em GNOME, se o `gnome-connections` já estiver instalado, o FAP esconde o botão "Instalar" e mostra o "Abrir" direto. O mesmo vale para o KRDC em KDE. A checagem usa o novo endpoint `/check-package`.
- **Novo endpoint `/check-package`** no `server.js`: consulta `rpm -q` e devolve se um pacote está instalado. Reutilizável em outras sessões que queiram checar presença de pacotes nativos.
- **Suíte ArtCraft (Adobe no Linux)**: novo bloco na sessão Aplicativos com 7 apps open-source desenvolvidos em Rust, distribuídos como `.rpm` no GitHub Releases. Os botões resolvem a URL da release mais recente em runtime via API pública do GitHub e instalam com `--setopt=localpkg_gpgcheck=0` (RPMs do GitHub não são assinados pelo Fedora).
- **Terra Repository na Sessão 1**: novo botão para habilitar o repositório comunitário Terra, que complementa o RPM Fusion com versões atualizadas de softwares populares.

### 🔧 Correções

- **Steam Big Picture não abria** na sessão Gamescope: o launcher do COPR não passava `-steamdeck -steamos3`, então o Steam abria em modo desktop e a sessão travava. O script novo corrige isso.
- **Gamescope Session não aparecia no seletor** do plasmalogin (Fedora 45 KDE): faltava `TryExec` no arquivo `.desktop`. O plasmalogin descarta silenciosamente entradas sem essa chave.
- **`/tmp/fap-gamescope-session.log` não era criado**: o script anterior não redirecionava a saída. Agora há um log rastreável para diagnóstico.
- **Remmina não instalava**: o comando incluía `remmina-plugins-ssh`, que não existe no Fedora. Como o `dnf` aborta a transação inteira quando encontra um pacote inexistente — mesmo com `-y` — a instalação falhava silenciosamente. Pacote removido da lista.
- **Botão "Abrir" não aparecia** em RustDesk, GNOME Connections e KRDC: a função `_atualizarBotaoAbrir` não estava definida em `aplicativos.html`, causando um `ReferenceError` engolido por callbacks. Definida localmente.
- **Ajuste por desktop do KRDC não rodava** em KDE: a mesma `ReferenceError` interrompia a `restaurarEstadoSessao()` antes da chamada ao `_ajustarFerramentasPorDesktop()`.

### 🎯 Melhorias

- **Ícone do bloco de acesso remoto** trocado de `🌐` para `📡`, evitando colisão com o bloco "Internet e Comunicação" da mesma sessão.
- **Limpeza automática do COPR antigo** no install da Gamescope Session: remove `gamescope-session-steam` e desabilita o repo `pvermeer`. Sem isso, dois `.desktop` concorrentes apareceriam no seletor de sessão.
- **`tipo: 'arquivos'` no `registrarAppRemovivel`**: a lixeira do Gamescope Session agora remove os arquivos criados pelo FAP (`/usr/bin/gamescope-session`, `/usr/share/wayland-sessions/gamescope-session.desktop`) além do pacote do COPR antigo.
- **Pré-requisitos da sessão Gamescope** atualizados nos três idiomas, mencionando "SteamOS mode (Gamescope)" e o caminho do log.
