# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e o FAP usa versionamento baseado em data: `v1.0.0-MMDDAAAA`.

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> **Regra importante para quem for editar:** use apenas `## vX.Y.Z-...` para os
> cabeçalhos de versão. Dentro de uma seção, use `###` (três hashes) para
> subseções — um `##` no meio de uma versão encerra a captura do parser e o
> resto é descartado silenciosamente.
>
> **Sobre versões antigas:** este arquivo guarda apenas a seção da versão
> atual. O histórico completo fica disponível nas
> [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases).

---

## v1.0.0-10052026

### 🚀 Fila de instalação de Flatpaks

Agora é possível clicar em vários botões de Flatpak em sequência sem esperar cada
instalação terminar. O FAP gerencia uma fila:

- O primeiro Flatpak clicado começa a instalar imediatamente.
- Os seguintes entram em fila, com o botão mostrando `⏳ Na fila (2º)`, `⏳ Na fila (3º)`.
- Quando um termina, o próximo começa automaticamente. As posições na fila se reajustam a cada término.
- Se um item falhar, o próximo da fila continua normalmente.
- Clicar duas vezes no mesmo botão é ignorado (não entra duplicado na fila).

Isso resolve o problema do `flatpak install` ter um lock global — só é possível rodar uma
instalação por vez — mas sem obrigar o usuário a esperar entre cliques.

### 🔒 Bloqueio de navegação durante execução

**Enquanto houver comando rodando na sessão atual** (dnf, rpm, flatpak, fila de Flatpaks ou
qualquer fluxo próprio, como o "Atualizar Fedora"), os chips do menu do topo e os botões
Anterior/Próximo ficam bloqueados.

- A navegação volta a funcionar quando **todos** os comandos da sessão atual terminam.
- O bloqueio cobre também comandos que não passam pelo `executarComandoGenerico` — a detecção é feita
  lendo o estado da barra de progresso da sessão.
- Passar o mouse sobre um chip bloqueado mostra um tooltip explicando o motivo. Clicar em um chip bloqueado exibe um toast com a mesma mensagem.
- Tema, idioma, botão "voltar ao início" e badge de atualização **não** são bloqueados — só a navegação entre sessões é.

Isso evita um problema real: as variáveis globais dos scripts inline de cada sessão
(`APPS_FLATPAK`, `_svgLixeira`, etc.) têm os mesmos nomes em sessões diferentes. Sair de uma
sessão no meio de uma instalação de Flatpak poderia fazer com que os botões de uma sessão usassem
as variáveis da outra.

### ✅ Detecção de Flatpaks já instalados no sistema

Antes, o FAP só marcava um botão como "instalado" se o próprio FAP tivesse executado a instalação.
Agora, ao carregar uma sessão, o FAP consulta a lista de Flatpaks instalados no sistema e marca
automaticamente todos os apps que já existem — mesmo que tenham sido instalados por fora (via
GNOME Software, KDE Discover, linha de comando, etc.).

Resultado: um usuário que já tenha o VLC instalado, por exemplo, vê o botão como
`✅ VLC instalado` (com o ícone de lixeira ao lado) sem precisar clicar em "instalar" primeiro.

### 🎯 "Atualizar Fedora" agora é realmente travado durante a execução

O botão **🔄 Atualizar Fedora** (sessão Primeiros Passos) tinha um bug antigo: reabilitava
após 3 segundos, independente de o `dnf upgrade` ter terminado. Agora ele fica cinza e
desabilitado até o comando realmente terminar (detecção via SSE). Também tem proteção contra
duplo clique.

### 🐛 Correção de exibição de progresso de pacotes

A barra de progresso do DNF mostrando "Pacote N de M" exibia os placeholders `{atual}` e `{total}`
literalmente, em vez dos números reais. Corrigido.

### 💾 Sessão ativa preservada ao trocar de idioma

Trocar o idioma da interface (PT-BR / EN / ES) recarregava o FAP e voltava para a **Sessão 1**.
Agora o FAP salva a sessão atual em `localStorage` a cada navegação e a restaura ao carregar — tanto
na troca de idioma quanto ao fechar e reabrir o app.

### 🧹 Melhorias internas

- **Bloqueio entre sessões**: enquanto um comando dnf/rpm está rodando em uma sessão, os botões que também usam dnf/rpm nas **outras** sessões ficam travados, evitando conflito de lock no `rpm`.
- **Fila de Flatpaks não bloqueia a sessão inteira**: só o botão do Flatpak clicado muda de estado. Os outros botões de Flatpak ficam livres para novos cliques.
- **`_reaplicarBloqueioSeNecessario()`**: o bloqueio entre sessões agora se reaplica quando o usuário navega para uma sessão que estava com o DOM desatualizado.
- **Detecção `completa` de "sessão ocupada"**: o bloqueio de navegação passa a detectar também comandos que criam barra de progresso mas não passam pelo `executarComandoGenerico` (fluxo próprio em `primeiros-passos.html`).

### 🔄 Alterações estruturais

- **Removida a preservação de progresso na migração FOF → FAP.** A migração agora é limpa: detecta o FOF antigo, remove tudo e instala o FAP do zero. Usuários que tinham o FOF precisam desinstalar pelo próprio FOF (ou rodar `install.sh --uninstall` de um clone anterior) e depois instalar o FAP pelo repositório novo. Isso evita problemas de estado misto entre as duas versões.
- **`migrar_esquema_antigo()` do `install.sh`** continua removendo tudo do FOF antigo: diretório, symlinks, atalhos `.desktop`, ícone no hicolor, dados/cache do WebKitGTK e logs em `/tmp`.

---

## Como adicionar uma versão nova

Ao lançar uma versão nova:

1. Atualize o campo `version` no `package.json` (ex.: `"1.0.0-10062026"`).
2. Substitua o conteúdo deste arquivo pela seção da nova versão, mantendo apenas ela. O histórico das versões anteriores fica disponível nas releases do GitHub.
3. Use `###` (três hashes) para subseções dentro de uma versão. Um `##` no meio da seção encerra a captura do parser e o resto é descartado.
4. Crie a tag/release no GitHub com o mesmo nome.

Se o cabeçalho não bater exatamente com o `version` do `package.json`, o FAP não
encontrará a seção correspondente e mostrará apenas o link para o changelog
completo no GitHub.
