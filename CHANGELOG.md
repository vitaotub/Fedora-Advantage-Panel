# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> Use apenas `## vX.Y.Z-...` para os cabeçalhos de versão. Dentro de uma
> seção, use `###` para subseções — um `##` no meio encerra a captura.
> Versões anteriores ficam nas releases do GitHub.

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
