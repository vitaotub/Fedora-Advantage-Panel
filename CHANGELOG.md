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

## v1.5.2-11062026

Bugfix pós-publicação da v1.5.1. Testes em hardware real (RTX 5060 / GB206 / Fedora 45 / KDE Wayland) revelaram **dois bugs** no fluxo de atualização e na detecção de enrollment MOK. O usuário que atualizou via **"Atualizar FAP"** (Sessão 13) via o badge "enrollment necessário" mesmo com o MOK já enrolled — o servidor antigo continuava rodando porque o `install.sh --update` usava `pgrep -f "node .*$INSTALL_DIR/server\.js"`, padrão que **nunca casa** (o processo real é `node server.js`, com cwd = `$INSTALL_DIR`, e o path completo **não aparece** no cmdline). O cliente novo (v1.5.1) lia `secure_boot_mok` do `/hardware-scan`, mas falava com o servidor antigo (v1.4.9 sem o campo, ou v1.5.0 com outra forma). Depois de uninstall+reinstall, o servidor reiniciava com o código novo e funcionava. O segundo bug só apareceu depois de logout/login: `_checkMokEnrolled` (backend) e `_renderizarPainelSecureBoot` (frontend) colapsavam `enrolled: null` ("não deu para verificar") em "não enrolled" — em D-Bus transitório pós-login ou `efivar` restrito, o `mokutil --test-key` falhava silenciosamente e o painel mostrava o passo-a-passo (falso positivo que assusta).

### 🔴 Corrigido

- **`install.sh` → `atualizar()` / `_migrar_via_update()` / `desinstalar()`** — os 3 call sites usavam `pgrep -f "node .*$INSTALL_DIR/server\.js"` para detectar o servidor antigo antes de encerrar. Esse padrão **nunca casa** porque o processo real (`node server.js`, iniciado por `iniciar_fap.sh` após `cd "$DIR"`) não tem `$INSTALL_DIR` no `cmdline`. Sintoma: o servidor antigo sobrevivia ao `--update`, o cliente novo carregava do disco mas as requisições iam para o servidor antigo — mistura de versões. Reportado pelo testador: badge "enrollment necessário" falso positivo após "Atualizar FAP"; só sumia com uninstall+reinstall. Correção: helper compartilhado `_matar_servidor_fap_antigo()` que detecta o PID via `lsof -t -i:3000` (mais confiável) com fallback em `$INSTALL_DIR/.fap.pid` (escrito por `iniciar_fap.sh`); valida com `ps -p <pid> -o cmd=` antes de matar (defensivo — evita matar processo alheio que pegou a porta); SIGTERM e, após 1s, SIGKILL. Os 3 call sites agora chamam o helper (eliminando a duplicação que existia antes).

### 🟡 Corrigido

- **`hardware-service.js` → `_checkMokEnrolled`** — só tentava `mokutil --test-key` **sem sudo**. Em firmwares que restringem `MokListRT` (raros, mas existem), ou em D-Bus transitório pós-login/logout, a chamada falhava e retornava `{ enrolled: null }` (correto: "não sei"). Agora: (a) tenta sem sudo (caso comum — `MokListRT` é `0444` na maioria); (b) se não concluir, tenta `sudo -n mokutil --test-key` (rápido, não trava se NOPASSWD não configurado — falha imediata); (c) retorna campo `erro` (motivo da falha) para o frontend exibir no banner. `enrolled: null` continua sendo o retorno **correto** quando ambas as tentativas falham — a diferença é que agora o frontend **distingue** `null` de `false`.

- **`script.js` → `_renderizarPainelSecureBoot`** — colapsava `enrolled: null` em "não enrolled" (mostrava o passo-a-passo completo + botão "Preparar Secure Boot"). Agora, quando `chaveLocal === true` **e** `_secureBootMokCache.enrolled === null` (mas não `false`), mostra **banner amarelo** ("Não foi possível verificar se a chave do akmods está enrolled") + botão "🔄 Verificar novamente" (chama `_refreshEstadoSessao`), **antes** do passo-a-passo. Distinção preservada: `null` = "não sei, tente de novo", `false` = "definitivamente não enrolled". O `hardware.html` (`_renderizarBadgeSecureBoot`) já tratava `chaveLocal` como "preparada" (não colapsava em "não enrolled"), então não precisou de fix — só o painel completo (Sessão 12) estava afetado.

### ✅ Validação empírica (RTX 5060 / GB206 / Fedora 45 / KDE Wayland)

- **Update flow:** `fap` → "Atualizar FAP" → após o toast, o servidor antigo morre em ~3s (confirmado com `pgrep -f "node server.js"` vazio). Ao reabrir, o badge mostra "chave preparada" + painel verde (ou amarelo se `enrolled: null` transitório). Antes: servidor antigo sobrevivia; badge "enrollment necessário" falso positivo; só sumia com uninstall+reinstall.
- **Enrollment MOK:** `mokutil --test-key` sem sudo passa em firmwares com `MokListRT` 0444 (caso comum). Em firmwares restritos, fallback `sudo -n` cobre.
- **KDE Wayland:** o leve travamento de 1–2s após logout/login (reconfiguração do compositor para `nvidia-drm`) é esperado com driver proprietário; o FAP não causa — só o `99-fap-nvidia-vaapi.conf` é escrito em `~/.config/environment.d/`, sem efeito no compositor.

### 🧪 Requisito

- **Fedora 44 ou 45.**

### 📌 Pendências de teste (registrar em issues)

- **Update via `--update` em hardware real:** validar que o servidor antigo morre e o cliente novo fala com o novo. Já validado em RTX 5060 do `fgc`, mas revalidar em outras máquinas.
- **`_checkMokEnrolled` com `efivar` restrito** (`MokListRT` 0400) — validar que `sudo -n` cobre.
- **`_renderizarPainelSecureBoot` com `enrolled: null`** — simular D-Bus transitório (parar `dbus-broker` do usuário brevemente) e verificar banner amarelo + "Verificar novamente".
- **Demais pendências da v1.5.1 permanecem válidas** — ver release notes da v1.5.1 para a lista completa.
