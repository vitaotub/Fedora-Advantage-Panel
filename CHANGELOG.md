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

## v1.3.1-10272026

Point release focada na responsividade da área de upgrade do Fedora
(sessão 12). Reduz a latência de detecção após o Fedora 45 e o RPM
Fusion 45 serem publicados, adiciona `?refresh=1` como escape hatch,
e interrompe toda a verificação permanentemente quando o usuário já
está na versão alvo.

### ⚡ Detecção de upgrade mais rápida

- **TTL do `/fedora-upgrade-status` reduzido de 6h para 1h.** O cache
  interno do servidor foi ajustado para detectar Fedora 45 GA e RPM
  Fusion 45 em até 1 hora após a publicação — em vez de até 6 horas.
  Os endpoints externos consultados (`releases.json` oficial e
  `repomd.xml` dos mirrors de kernel.org e RPM Fusion) são leves e
  suportam a frequência maior com folga. O `dnf check-update` interno
  já roda 1× por hora via `dnf-makecache.timer` padrão do Fedora, então
  o FAP agora simplesmente se alinha com o ritmo do próprio sistema.

### ✨ Novo — `?refresh=1` no `/fedora-upgrade-status`

- **`GET /fedora-upgrade-status?refresh=1`** invalida o cache do
  servidor e força nova consulta às fontes oficiais. Mesmo padrão já
  usado em `/system-state`.
- O frontend usa `?refresh=1` após as ações que mudam o estado do
  upgrade — "Download concluído" e "Cancelar upgrade". Sem isso, o
  cache do servidor (agora de 1h) devolveria o estado antigo logo
  após o download, e o botão "Baixar" continuaria visível em vez de
  "Reiniciar agora".

### 🔒 Novo — Upgrade finalizado interrompe a área permanentemente

- **Backend**: ao detectar que o sistema já está na versão alvo
  (Fedora 45 ou superior), `_calcularUpgradeStatus()` marca a flag
  `_upgradeConcluidoPermanente` e **para de spawnar subprocessos e
  de consultar a rede**. Chamadas subsequentes — mesmo com
  `?refresh=1` — retornam imediatamente o resultado em cache.
- **Frontend**: a primeira vez que `_renderizarAreaUpgrade()` vê
  `no_upgrade_needed`, grava a flag `fap_upgrade_finalizado` no
  `localStorage`. Nas próximas cargas da sessão, a área mostra uma
  mensagem estática ("Você já está no Fedora 45") **sem disparar
  fetch algum**.
- **Efeito prático**: depois do upgrade — via FAP, manual ou por
  fora —, a área de upgrade deixa de rodar `dnf check-update`, deixa
  de consultar `releases.json` e deixa de checar RPM Fusion. O
  "trabalho" daquela área está encerrado até o FAP ser reinstalado.

### ⚠️ Nota de atualização

- **`server.js`** — TTL de 6h → 1h; nova flag `_upgradeConcluidoPermanente`;
  suporte a `?refresh=1` no handler de `/fedora-upgrade-status`.
- **`ajustes-manutencao.html`** — `_carregarUpgradeStatus(forcar)`
  aceita parâmetro; `_renderizarAreaUpgrade` grava flag no
  `localStorage` quando detecta `no_upgrade_needed`; IIFE renderiza
  mensagem estática quando a flag existe; callbacks de download e
  cancelamento passam `?refresh=1`.
- **`package.json`** — bump para `1.3.1-10272026`.
- **`CHANGELOG.md`** — esta seção.
- Nada no `fap-container`, `style.css`, `script.js`, locales,
  `hardware_map.json`, `install.sh` ou `iniciar_fap.sh` mudou.

### 🧪 Não testado

- O estado `no_upgrade_needed` só pode ser validado com Fedora 45 real
  (ou mock da versão). A lógica de "parar ao detectar 45" foi validada
  por inspeção de código.
- Fedora 45 real — pendência desde a `1.3.0`.
- Waydroid em bare metal — pendência desde a `1.2.2`.
- Hardware NVIDIA real — pendência desde a `1.2.2`.

---
