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

## v1.6.0-11162026

Release incremental sobre a `v1.5.9-11122026`. Corrige abertura de
Lightworks e Telegram, que mostravam "aberto" no log mas a janela
não aparecia. **Em andamento** — mais correções/adições desta série
serão incorporadas a esta mesma seção.

### 🟡 Corrigido — Lightworks: "Abrir" não abre

- **`aplicativos.html` → `abrirLightworks()` usa `lightworks` (binário direto) em vez de `gtk-launch lightworks`.** O `gtk-launch lightworks` procura por `lightworks.desktop` no `$XDG_DATA_DIRS`. Se o `.desktop` do Lightworks tem outro nome (ex.: `lightworks-2023.2.desktop`), o `gtk-launch` falha silenciosamente — o `setsid -f` desacopla e retorna 0, então o log mostrava "Lightworks aberto!" mas a janela não aparecia. O atalho do menu iniciar aponta para `/usr/bin/lightworks` (binário direto), que funciona. Correção: usar o binário direto.
- **`server.js` → `lightworks` re-adicionado à `_BINARIOS_ABRIR_WHITELIST`.** Removido na v1.5.9 como dead code (junto com os 13 apps ArtCraft individuais). Sem ele, o comando `setsid -f lightworks > /tmp/fap-open-instalar-lightworks.log 2>&1 < /dev/null` cairia em `pkexec`.

### 🟡 Corrigido — Telegram: "Abrir" não abre

- **`aplicativos.html` → `_registrarAbrir('instalar-telegram', ...)` explícito, sobrescrevendo o registro do `_registrarAbrirEmMassa`.** O Telegram Flatpak (`org.telegram.desktop`) tem um `.desktop` com `DBusActivatable=true`. O `gtk-launch org.telegram.desktop` (padrão usado por `_registrarAbrirEmMassa` → `abrirAppGenerico` para `APPS_FLATPAK`) falha silenciosamente. O atalho do menu iniciar usa `/usr/bin/flatpak run org.telegram.desktop`. Correção: `abrirTelegram()` chama `abrirFerramentaExterna('flatpak run org.telegram.desktop', ...)`.
- **`server.js` → `_REDIRECT_FLATPAK_RUN_PADRAO` (novo) + `_ehRedirectAbrirValido` checa esse padrão ANTES do genérico.** Regex restrito: `setsid -f flatpak run <appId> > /tmp/fap-open-*.log 2>&1 < /dev/null`, com `<appId>` casando `[a-zA-Z0-9][a-zA-Z0-9._-]*`. **Sem** `--command`, `-c`, ou argumentos extras. Isso permite `flatpak run org.telegram.desktop` sem `pkexec`, **sem** abrir brecha para `flatpak run --command=bash <appId> -c "rm -rf ~"`. **Não** adicionar `flatpak` à `_BINARIOS_ABRIR_WHITELIST` — o regex genérico aceitaria `flatpak <qualquer coisa>`.

### 📌 Pendências de teste (hardware real)

- **Lightworks (após correção).** Botão "🚀 Abrir Lightworks" abre a janela. Log mostra `setsid -f lightworks > /tmp/fap-open-instalar-lightworks.log 2>&1 < /dev/null`. Sem `pkexec`.
- **Telegram (após correção).** Botão "🚀 Abrir Telegram" abre a janela. Log mostra `setsid -f flatpak run org.telegram.desktop > /tmp/fap-open-instalar-telegram.log 2>&1 < /dev/null`. Sem `pkexec`.

### ✅ Validação estática (16/11/2026)

- `make check-basico`: **11/11 checks passando**.
- `node scripts/validar-botoes.js`: contratos de botões OK.
- `CHANGELOG.md` vs `package.json`: strings `v1.6.0-11162026` batem.

### Arquivos tocados

| Arquivo | Tipo de mudança |
|---|---|
| `server.js` | `_BINARIOS_ABRIR_WHITELIST` (lightworks readicionado); `_REDIRECT_FLATPAK_RUN_PADRAO` (novo); `_ehRedirectAbrirValido` (checa novo padrão) |
| `aplicativos.html` | `abrirLightworks` (binário direto); `_registrarAbrir('instalar-telegram', ...)` + `abrirTelegram()` |
| `package.json` | bump `1.6.0-11162026` |
| `CHANGELOG.md` | seção `## v1.6.0-11162026` (inicial, em andamento) |
