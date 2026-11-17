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

## v1.6.1-11172026

Release de **segurança e correções**, resultado de uma auditoria completa do projeto sobre a `v1.6.0-11162026`. Consolida também as correções de abertura de Lightworks e Telegram da série 1.6.0. Nenhum botão novo, nenhuma sessão nova e nenhuma mudança de comportamento visível, exceto o conserto da lixeira de **Codecs Multimídia Essenciais**.

### 🔴 Corrigido — Segurança: comando arbitrário sem autenticação via "abrir app"

- **`server.js` → `_REDIRECT_ABRIR_PADRAO` reescrito (regex estrito).** O regex antigo aceitava como argumento sem aspas `[^>\n'"]+` — ou seja `;`, `$(`, crase, `|`, `&` — e `"..."` aceitava `$(...)`. Como `_ehRedirectAbrirValido` é consultado **antes** de `_CARACTERES_ENCADEAMENTO`, um comando como `setsid -f xdg-open $(touch /tmp/x) > /tmp/fap-open-a.log 2>&1 < /dev/null` era classificado como "sem autenticação" e executado por `exec(..., {shell:'/bin/bash'})` **sem `pkexec`**. Uma quebra de linha também passava como separador (`\s+` casa `\n`). Uma página web externa **não** conseguia explorar isso (o `Origin` é bloqueado no `/executar`), mas qualquer processo local ou outro usuário da máquina conseguia rodar comandos como o usuário do FAP sem senha.
- **Regra nova:** binário `[A-Za-z0-9._-]+`; argumento sem aspas só do conjunto `[A-Za-z0-9_./:@%+=,~-]` (o mesmo que `_shellQuote` deixa sem aspas, mais `~`); `'...'` aceito integralmente; `"..."` aceito **sem** `$`, crase e `\`; separadores só com espaço (`[ ]`, nunca `\s`).
- **ReDoS eliminado.** O regex antigo tinha `\s+` seguido de `[^>\n'"]+` (que também casa espaço) — ambíguo, com backtracking exponencial (26 palavras ≈ 580 ms; algumas dezenas de palavras travavam o servidor single-thread). Os tokens agora não têm espaço interno; 5000 palavras levam 0 ms.
- **`server.js` → `_REDIRECT_FLATPAK_RUN_PADRAO`** (criado na 1.6.0): mesmos separadores só com espaço.
- **Compatibilidade:** todos os comandos que o cliente gera (`gtk-launch <id>`, `xdg-open 'url?a=1&b=2'`, `sealert -b`, `lightworks`, `flatpak run org.telegram.desktop` etc.) continuam passando sem `pkexec`. URL com aspa simples dentro continua caindo em `pkexec` (limitação já documentada).

### 🟡 Corrigido — Codecs: a lixeira de "Codecs Multimídia Essenciais" não removia os pacotes

- **`codecs.html` → `comandoRemocao` de `codecs-essenciais`.** Terminava o `dnf remove` com `--skip-broken`, opção que o `dnf5 remove` não aceita ("argumento desconhecido"; o próprio `script.js` já tinha removido essa opção pelo mesmo motivo). O `remove` nunca rodava, os pacotes `*-freeworld` ficavam instalados e o `;` seguia para o `install`, deixando o sistema meio revertido.
- **Correção:** o próprio script filtra, via `rpm -q`, só os pacotes realmente instalados e chama `dnf remove -y` apenas com eles; se nenhum estiver instalado, o `remove` é pulado e o `install` final roda normalmente. Mesmo padrão do `instalar-rclone-manager`.

### 🟡 Corrigido — Segurança: servidor sem validação do cabeçalho `Host` (DNS rebinding)

- **`server.js` → handler principal.** Os POST já checavam `Origin`, mas nenhum GET validava o `Host`. Um site que apontasse o próprio domínio para `127.0.0.1` (DNS rebinding) lia `/system-info`, `/progress`, `/hardware-scan` etc. como same-origin.
- **Correção:** requisições com `Host` diferente de `localhost` / `127.0.0.1` (com ou sem porta) recebem `403`. `Host` vazio (HTTP/1.0) continua aceito. Todos os chamadores legítimos (container, `install.sh`, `iniciar_fap.sh`) já usam `localhost` ou `127.0.0.1`.

### 🟢 Corrigido — Robustez: corpo de requisição sem limite

- **`server.js` → `/progress` e `/executar`.** Acumulavam o corpo da requisição em memória sem teto. Agora, acima de 1 MB a conexão é cortada. Corpos legítimos (poucos KB) não são afetados.

### 🟢 Corrigido — Container: filtro de navegação conferia só o prefixo da URL

- **`src/fap-container.c` → `fap_uri_e_local()` (novo) usado em `on_webview_decide_policy`.** `g_str_has_prefix(uri, "http://localhost:")` também aceitava `http://localhost:@outro-site.com/` (o host real ali é `outro-site.com`). Agora a URI é interpretada com `GUri` (GLib ≥ 2.66) e só passa `http` com host exatamente `localhost` ou `127.0.0.1` e sem `userinfo`. `file://` e `about:` seguem permitidos como antes.

### 🟢 Corrigido — Documentação

- **`README.md`, `README.en.md`, `README.es.md`:** badge de versão atualizado (estava em `v1.5.9`).
- **`server.js`:** comentário desatualizado do `/shutdown` (dizia que `/executar` depende de `Content-Type`/preflight; a defesa real é o `Origin`).

### Incluído da série 1.6.0

- **Lightworks:** `abrirLightworks()` usa o binário direto `lightworks` (em vez de `gtk-launch lightworks`) e `lightworks` está na `_BINARIOS_ABRIR_WHITELIST`.
- **Telegram:** `abrirTelegram()` chama `flatpak run org.telegram.desktop` via `abrirFerramentaExterna`; `_REDIRECT_FLATPAK_RUN_PADRAO` autoriza exclusivamente esse formato (sem `--command`/`-c`). **Não** adicionar `flatpak` à `_BINARIOS_ABRIR_WHITELIST`.

### ✅ Validação (17/11/2026)

- `make check-basico`: **11/11 checks passando**.
- Código real do `server.js` carregado em `vm`: **22 comandos legítimos aceitos, 18 ataques bloqueados**, whitelist read-only preservada, sem ReDoS.
- `server.js` iniciado de verdade: `Host: localhost`/`127.0.0.1` → 200; `Host: evil.com` e `localhost.evil.com` → 403; `Origin` externo no `/executar` → 403; corpo de 3 MB cortado (conexão resetada) e servidor continua vivo; corpo de 500 KB segue o fluxo normal.
- `fap_uri_e_local()` compilada isoladamente contra GLib 2.80 e testada com 17 URIs (inclui `http://localhost:@evil.com/` e `http://localhost:3000@evil.com/`). O `fap-container.c` **completo** não foi compilado no ambiente da auditoria (sem headers GTK/WebKit) — rode `make`.
- Comando novo de remoção dos codecs: sintaxe `bash -n` OK e simulação com `rpm`/`dnf` falsos (2 pacotes instalados → `dnf remove` só com eles; nenhum instalado → `remove` pulado; zero ocorrências de `--skip-broken`).
