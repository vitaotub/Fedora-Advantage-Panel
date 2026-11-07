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

## v1.5.5-11072026

Hardening do endpoint `/reboot-needed` e do seu consumidor na Sessão 1 (Primeiros Passos → Atualizar Fedora). A v1.5.4 corrigiu o fluxo de update mas o aviso de "reinicie o computador" tinha dois furos: **(1)** o endpoint silenciava a saída do `dnf needs-restarting -r` (`2>&1` no final só capturava o exit code); se o comando falhasse por qualquer motivo que não seja "reboot pendente" (RPM DB lock, `dnf5-plugins` ausente, timeout), o código de saída era `!= 0` e `!= 1`, e o endpoint devolvia `{reboot: false}` — **falso negativo** que escondia o aviso mesmo quando o usuário precisava reiniciar. **(2)** o frontend tratava apenas dois estados (`reboot: true/false`), sem distinguir "definitivamente não precisa" de "não foi possível verificar" — quem caía no falso negativo não via nem o aviso verde nem o amarelo, e o banner desaparecia silenciosamente.

**Correção backend:** o comando agora preserva o stdout (`2>&1` no meio, não no final) para capturar o `motivo`, o timeout subiu de 10s para 15s (cache frio do `dnf needs-restarting -r` pode levar 8–12s), e o JSON inclui `erro: boolean`, `code: number` e `motivo: string | null`. `erro === true` significa "não foi possível verificar" (código != 0 e != 1), o que é diferente de `reboot: true` (definitivamente precisa) e de `reboot: false` (definitivamente não precisa).

**Correção frontend:** `_verificarRebootNecessario` agora trata **três** estados: (1) `erro === true` → banner neutro com instrução `dnf needs-restarting -r` no terminal; (2) `reboot === true` → banner amarelo com "Reinicie o computador para aplicar as atualizações"; (3) `reboot === false` → banner escondido. O `innerHTML` é reescrito em (1) e (2) reutilizando o mesmo elemento `#aviso-reboot-necessario` (evita duplicar `id` no DOM). 1 chave i18n nova em EN/ES (`sessoes.primeiros-passos.aviso_reboot_nao_verificado`).

### 🟡 Corrigido

- **`server.js` → endpoint `/reboot-needed`** — o comando mudou de `dnf needs-restarting -r > /dev/null 2>&1; echo "exit=$?"` para `dnf needs-restarting -r 2>&1; echo "---EXIT=$?---"`. O `2>&1` no **meio** (não no fim) preserva o stdout+stderr do `dnf` para o campo `motivo`. O `---EXIT=N---` substitui o `exit=N` simples porque é mais robusto contra mensagens do `dnf` que contenham a string `exit` acidentalmente. Timeout de 10s → 15s. JSON expandido com `erro`, `code` e `motivo`. Sem essa mudança, um `dnf needs-restarting -r` que retorna exit 2 (RPM DB lock, por exemplo) fazia o FAP esconder o aviso de reboot — falso negativo.

- **`primeiros-passos.html` → `_verificarRebootNecessario`** — a função agora trata `data.erro === true` como terceiro estado. Antes, tratava só `reboot: true/false`, e o falso negativo (código != 0 e != 1) caía no ramo "esconde o banner" — silenciosamente, sem aviso nenhum. Agora, `erro === true` mostra um banner neutro com instrução para o usuário verificar manualmente no terminal. O `innerHTML` é reescrito em ambos os casos (erro e reboot) porque o banner no HTML da sessão começa com o texto fixo "Reinicie o computador...", que não serve para o caso de erro.

### 🟢 Melhorado

- **`locales/en.json` + `locales/es.json`** — 1 chave nova em cada: `sessoes.primeiros-passos.aviso_reboot_nao_verificado` ("Could not check if a reboot is needed. Check in the terminal: `dnf needs-restarting -r`"). Sem ela, o novo banner de erro cairia no fallback PT-BR hardcoded.

### ✅ Validação empírica (VM Fedora 44)

- **`make check-basico`:** todos os 10 checks passam (sintaxe JS, sintaxe Bash, JSON, CHANGELOG vs package.json, `_MAPA_ORIGEM`, chaves i18n, `_meta.lang`, DNF5).
- **Teste 1 (sem reboot pendente):** `dnf needs-restarting -r; echo $?` → exit 0. Abrir Sessão 1 → banner escondido (`display: none`). Console: `fetch('/reboot-needed').then(r=>r.json())` → `{reboot: false, erro: false, code: 0, motivo: null}`.
- **Teste 2 (reboot pendente):** `sudo dnf reinstall -y kernel-core` → `dnf needs-restarting -r; echo $?` → exit 1. Abrir Sessão 1 → banner amarelo visível com "Reinicie o computador...". Console: `{reboot: true, erro: false, code: 1, motivo: null}`.
- **Teste 3 (verificação falhou — simulado):** `mv /usr/libexec/dnf-3/needs-restarting /tmp/` (ou renomear o binário equivalente do DNF5) → `dnf needs-restarting -r; echo $?` → exit != 0 e != 1. Abrir Sessão 1 → banner neutro visível com "Não foi possível verificar se é necessário reiniciar...". Console: `{reboot: false, erro: true, code: 2, motivo: "dnf needs-restarting retornou código 2"}`. Restaurar o binário em seguida.
- **Teste 4 (chave i18n em EN):** trocar idioma para EN → banner de erro mostra "Could not check if a reboot is needed. Check in the terminal: `dnf needs-restarting -r`".

### 🧪 Requisito

- **Fedora 44 ou 45.**

### 📌 Pendências de teste (registrar em issues)

- **`/reboot-needed` em Fedora 45 (DNF5)** — validar que o exit code do `dnf needs-restarting -r` é propagado corretamente. O DNF5 tem a mesma interface do DNF4 para esse subcomando, mas a saída de erro é diferente (`Error: ...` em vez de `Error: ...` com prefixo DNF5). O `motivo` deve continuar legível.
- **Banner de erro em EN/ES** — forçar `erro: true` via `kill -STOP` no processo `dnf` (bloqueia o RPM DB e o `needs-restarting` falha em ~15s) e confirmar que o texto traduz corretamente nos 3 idiomas.
- **Falso negativo com `dnf5-plugins` ausente** — simular `sudo dnf remove -y dnf5-plugins` (não recomendado em produção) e confirmar que o endpoint retorna `erro: true` em vez de `reboot: false`. Restaurar o pacote em seguida.
- **Demais pendências da v1.5.4, v1.5.3, v1.5.2 e v1.5.1 permanecem válidas** — ver release notes anteriores.
