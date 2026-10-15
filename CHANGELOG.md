# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> Use apenas `## vX.Y.Z-...` para os cabeçalhos de versão. Dentro de uma
> seção, use `###` para subseções — um `##` no meio encerra a captura.
> Versões anteriores ficam nas releases do GitHub.

---

## v1.0.0-10152026.c

### 🐛 Correção crítica

- **`server.js` restaurado em UTF-8.** O arquivo estava salvo com encoding corrompido (bytes CP1251 interpretados como UTF-8), o que deixava ilegíveis o banner de inicialização do servidor e todas as mensagens enviadas ao frontend via SSE — acentos viravam caracteres estranhos (`VERSГѓO`) e emojis viravam símbolos sem sentido (`рџђ§`, `вњ…`). O conteúdo lógico não mudou; apenas o encoding foi corrigido. Sem isso, o usuário via mensagens como `Comando concluГdo com sucesso` no log de cada sessão.

### 🐛 Outras correções

- **22 entradas `setsid -f <app>` adicionadas à whitelist de comandos sem autenticação.** Antes, clicar em **"🚀 Abrir VLC"** — ou em qualquer outro app que abrisse por binário próprio em vez de `gtk-launch` (Krita, GIMP, Inkscape, Blender, Kdenlive, Audacity, Ardour, LMMS, Shotcut, Avidemux, Pitivi, Darktable, FreeCAD, LibreCAD, Opera, Brave, Vivaldi, Microsoft Edge, Chromium, Heroic, RustDesk) — disparava o diálogo do `pkexec`, pedindo senha de administrador sem motivo. Agora todos abrem direto. Os que já usavam `gtk-launch` continuam cobertos pela entrada única.
- **`.progresso.json` não registra mais ids terminados em `-remove`.** A remoção de apps via lixeira (e o botão "desfazer tudo") gravava entradas transientes no arquivo de progresso, que o `_limparIdsOrfaos` (frontend) removia no boot seguinte. O filtro agora é feito no servidor, alinhado ao que já era feito para `-open`. Efeito prático: o arquivo para de acumular lixo e o contador global de sessões concluídas deixa de oscilar no boot.

### 🧹 Limpeza

- **Código morto removido em `script.js`:**
  - `_atualizarIconeDesinstalarSeExistir` — chamava `_atualizarIconeDesinstalar`, que não existe em lugar nenhum do projeto. A função estava envolvida num `try/catch` que engolia o erro em silêncio.
  - `atualizarIconeRemover` e `esconderIconeRemover` — funções legadas do fluxo de lixeira, substituídas por `_mostrarLixeira` e `_esconderLixeira` (ambas chamadas a partir de `aplicarEstadoInstalavel`). Nenhuma sessão as invocava.
- **Comentário desatualizado em `_executarRemocaoApp` corrigido.** Citava `desinstalarAppFlatpak`, que não existe mais no `script.js`. Substituído pela descrição do padrão atual (remoções das sessões que não passam pelo `executarComandoGenerico`).

### 🔧 Melhorias

- **Summary do changelog não mostra mais "v?"** quando a versão ainda não chegou via `/info`. Antes, se o fetch do endpoint atrasasse (rede lenta, primeiro boot), o `<summary>` da seção "Versão atual" exibia `🆕 Versão atual — v?`. Agora mostra apenas `🆕 Versão atual` e preenche o número quando o evento `fap-versao-pronta` chega. Transitório e cosmético — mas evita a impressão de erro.
