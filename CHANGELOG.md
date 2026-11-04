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

## v1.4.4-11042026

Correções pontuais na detecção de upgrade do Fedora 44 → 45 e no aviso
de reboot da sessão 1.

### 🐛 Corrigido

- **`server.js` → `_verificarCanalRpmFusion`** — a verificação usava a URL
  `.../updates/45/.../repomd.xml`, que retorna **404** desde o lançamento
  do Fedora 45 (03/11/2026). O RPM Fusion publica o repositório
  `releases/45` no dia do GA, mas só popula o canal `updates/45` depois
  do primeiro batch de atualizações — o que pode levar dias ou semanas.
  O resultado era que o FAP mostrava "⏳ RPM Fusion 45 publicado —
  Aguardando" indefinidamente. Agora a verificação usa
  `.../releases/45/.../repomd.xml`, que é o critério correto: é esse
  repositório que o `dnf system-upgrade` do FAP consome como base.

### ✨ Adicionado

- **`server.js` → `GET /reboot-needed`** — novo endpoint read-only que
  roda `dnf needs-restarting -r` e devolve `{ reboot: boolean }`. Mesmo
  padrão de `/kernel-atual` (sem autenticação, sem SSE, timeout de 10s).
- **`primeiros-passos.html` → aviso dinâmico de reboot** — o botão
  "Atualizar Fedora" agora consulta `/reboot-needed` em dois momentos:
  (1) após o `dnf upgrade` terminar com sucesso, e (2) no boot da
  sessão (para cobrir o caso "atualizou, fechou o FAP sem reiniciar,
  voltou depois"). Se `reboot === true`, mostra o aviso
  "🔄 Reinicie o computador para aplicar as atualizações."; senão,
  esconde. Antes, o aviso "💡 Recomenda-se reiniciar…" era **estático**
  e aparecia sempre, mesmo quando não havia reboot pendente.
- **`locales/en.json`** e **`locales/es.json`** — chave
  `sessoes.primeiros-passos.aviso_reboot_necessario` (substitui
  `aviso_reiniciar`). PT-BR fica no HTML.

### 🔄 Alterado

- **`package.json`** — versão atualizada para `1.4.4-11042026`.
- **`README.md` / `README.en.md` / `README.es.md`** — badge de versão.
- **`BRIEFING.md`** — versão atual + histórico + nota pós-GA.
- **`RELEASE_NOTES.md`** — release notes da versão.

### 🧪 Não testado (pendências herdadas da v1.4.3)

- **Upgrade Fedora 44 → 45 em hardware real** — o fluxo
  `ready → downloaded → reboot` foi validado com mocks e com o Fedora 45
  já publicado nos mirrors. Falta testar o reboot real em hardware.
- **Presets de GameMode com backup/restore** — validado conceitualmente.
- **Fila de Flatpaks com 3+ apps em sequência** — validado conceitualmente.
- **Container WebKitGTK após remoção do label de status** (v1.4.3) —
  validar visualmente em KDE Plasma e GNOME.

### 🧪 Requisito

- **Fedora 44 ou 45.**
