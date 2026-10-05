# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e o FAP usa versionamento baseado em data: `v1.0-MMDDAAAA`.

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> **Regra importante para quem for editar:** use apenas `## vX.Y-...` para os
> cabeçalhos de versão. Dentro de uma seção, use `###` (três hashes) para
> subseções — um `##` no meio de uma versão encerra a captura do parser e o
> resto é descartado silenciosamente.
>
> **Sobre versões antigas:** este arquivo guarda apenas a seção da versão
> atual. O histórico completo fica disponível nas
> [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases).

---

## v1.0-10042026

### 🎨 Renomeação completa do projeto: FOF → FAP

O projeto passa a se chamar **Fedora Advantage Panel (FAP)** em todos os
níveis: nome de exibição, identificadores técnicos, nomes de arquivos e
comandos internos. Esta é a primeira versão distribuída exclusivamente
com os novos identificadores.

- **Novo logo** substitui o anterior. Aplicado ao app, ao atalho do menu e ao container nativo.
- **Todos os textos visíveis ao usuário** atualizados nos três idiomas (PT-BR, EN, ES).
- **Repositório renomeado no GitHub** para [`vitaotub/Fedora-Advantage-Panel`](https://github.com/vitaotub/Fedora-Advantage-Panel).

### 🔧 Identificadores técnicos renomeados

| Elemento | Antes (FOF) | Agora (FAP) |
|---|---|---|
| Comando do terminal | `fof` | `fap` |
| Comando (modo compat) | `fof-compat` | `fap-compat` |
| Pasta de instalação | `~/.local/share/fedora-only-fans` | `~/.local/share/fedora-advantage-panel` |
| Binário do container | `fof-container` | `fap-container` |
| Arquivo-fonte do container | `src/fof-container.c` | `src/fap-container.c` |
| Script de inicialização | `iniciar_fof.sh` | `iniciar_fap.sh` |
| Script (modo compat) | `iniciar_fof_compat.sh` | `iniciar_fap_compat.sh` |
| Atalho do menu | `fof-container.desktop` | `fap-container.desktop` |
| Ícone no hicolor | `fof-container.png` | `fap-container.png` |
| Dados do WebKitGTK | `~/.local/share/fof-container` | `~/.local/share/fap-container` |
| Cache do WebKitGTK | `~/.cache/fof-container` | `~/.cache/fap-container` |
| Configurações | `~/.config/fof-container` | `~/.config/fap-container` |
| Extras do Waydroid | `~/.local/share/fof-waydroid` | `~/.local/share/fap-waydroid` |
| Temporários em `/tmp` | `/tmp/fof-*` | `/tmp/fap-*` |
| Chaves de armazenamento | `fof_*` (tema, idioma, progresso, versão remota) | `fap_*` |
| Variável de versão (`.c`, Makefile, build) | `FOF_VERSION` | `FAP_VERSION` |
| Arquivo de PID do servidor | `.fof.pid` | `.fap.pid` |
| Evento JS de versão pronta | `fof-versao-pronta` | `fap-versao-pronta` |
| Container do toast | `fof-toast-container` | `fap-toast-container` |
| Classe CSS da versão | `.fof-version` | `.fap-version` |

### 🔄 Migração limpa no `install.sh`

Se um FOF antigo estiver instalado, o `install.sh` da versão nova detecta e
remove **tudo** do esquema antigo antes de instalar o FAP:

- Diretório `~/.local/share/fedora-only-fans`
- Symlinks `fof`, `fof-compat` e `fof-container` em `~/.local/bin`
- Atalhos `.desktop` antigos (`fof-container.desktop`, `fedora-only-fans.desktop` e variantes `-compat`)
- Ícone `fof-container.png` do hicolor
- Cache e dados do WebKitGTK (`~/.cache/fof-container`, `~/.local/share/fof-container`, `~/.config/fof-container`)
- Extras do Waydroid (`~/.local/share/fof-waydroid`)
- Logs órfãos em `/tmp` (`fof-*.log`, `fof-out-*.log`, `fof-cmd-*.sh`)

Não há preservação de dados — é um **reset completo**. Progresso, tema e
idioma escolhidos na versão antiga não são levados adiante.

### ✅ O que NÃO mudou

- **Comportamento das 14 sessões**: toda a lógica de tarefas, ordem de execução, progresso, i18n e temas continua exatamente igual.
- **Endpoints do servidor**: `/progress`, `/info`, `/status`, `/kernels`, `/flatpak-installed`, `/hardware-scan`, `/system-info`, `/top-processes`, `/disk-usage`, `/journal-errors`, `/changelog`, `/waydroid-status`, `/stream`, `/executar`. Todos inalterados.
- **Formato do `.progresso.json`**: mesma estrutura `{ executados: [...], pulados: [...] }`.
- **Chaves i18n**: a estrutura dos arquivos `locales/*.json` permanece idêntica — apenas o texto interno de algumas chaves foi atualizado para refletir o novo nome do projeto.
