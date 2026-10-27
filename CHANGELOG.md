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

## v1.3.0-10272026

Primeira feature nova desde a `1.2.0`. A sessão **Ajustes e Manutenção**
ganha uma área dedicada ao upgrade do Fedora 44 → 45, com detecção
automática de disponibilidade e três pontos de escape para o usuário.

### ✨ Novo — Área "Upgrade do Fedora" (Sessão 12)

Accordion visível sempre na sessão 12, logo abaixo de "Manutenção do
Fedora". O conteúdo interno muda conforme o status retornado pelo novo
endpoint `GET /fedora-upgrade-status`, e cobre 9 estados possíveis:

- **`waiting_ga`** — Fedora 45 ainda não lançado oficialmente. Mostra
  as checagens em andamento (GA + RPM Fusion) e uma mensagem
  informando que não há nada a fazer.
- **`waiting_rpmfusion`** — Fedora 45 GA confirmado, mas RPM Fusion 45
  ainda não publicado. Explica por que o botão permanece bloqueado.
- **`outdated_current`** — Fedora 44 desatualizado (packages ou reboot
  pendentes). Instrui a abrir a sessão 1 e rodar "Atualizar Fedora".
- **`no_disk_space`** — Menos de 8 GB livres em `/var`. Detalha o
  espaço detectado.
- **`ready`** — Todos os checks passaram. Exibe 6 checagens verdes,
  lista de avisos sobre componentes de terceiros detectados (NVIDIA,
  Broadcom, Terra, COPRs, Razer, xpadneo, Realtek), bloco completo de
  **termos e responsabilidade**, e checkbox obrigatório ("Li os avisos
  e entendo os riscos") antes de habilitar o botão.
- **`downloaded`** — Pacotes já baixados. Mostra **dois botões**:
  "Reiniciar agora e atualizar" + "Cancelar upgrade". O reboot é
  decisão do usuário, nunca automático.
- **`no_upgrade_needed`** — Já está no 45 (ou mais novo). Mensagem
  verde, área continua visível.
- **`unsupported`** — Fedora < 44. Salto direto não é permitido.
- **`atomic`** — Fedora Atomic/Silverblue. Explica que o método é
  diferente (`rpm-ostree rebase`).

### 🔧 Novo — Endpoint `GET /fedora-upgrade-status`

Consulta fontes oficiais para decidir se é seguro expor o botão de
upgrade:

- **Fedora 45 GA** — parse do `releases.json` oficial
  (`https://fedoraproject.org/releases.json`), verificando
  `version == 45`, `release_date` no passado e `eol` futuro/ausente.
- **Canal `updates/45/`** — HEAD em
  `mirrors.kernel.org/fedora/updates/45/Everything/x86_64/repodata/repomd.xml`.
- **RPM Fusion 45** — HEAD em
  `mirrors.rpmfusion.org/free/fedora/updates/45/Everything/x86_64/repodata/repomd.xml`.
- **Sistema atual atualizado** — `dnf check-update` (exit 0) +
  `dnf needs-restarting -r` (exit 0).
- **Espaço em `/var`** — `df -BG`, mínimo 8 GB.
- **Download pendente** — `/var/lib/dnf/system-upgrade/` tem conteúdo.
- **Componentes de terceiros** — NVIDIA, Broadcom, Terra, Razer,
  xpadneo, Realtek, contagem de COPRs.

Cache de 6h em memória. Todos os comandos são read-only.

### 🔒 Segurança

- **Nenhuma operação destrutiva ocorre sem ação explícita.** A área
  só executa após: (a) todos os checks passarem; (b) usuário marcar
  o checkbox de confirmação; (c) usuário clicar no botão de download.
- **Reboot nunca é automático.** Após o download, o usuário escolhe
  entre reiniciar ou cancelar. O `dnf system-upgrade reboot` só roda
  após segunda confirmação explícita.
- **Cancelamento possível em 3 pontos:** antes do download (área
  não expõe botão), após o download (botão "Cancelar upgrade"), e
  após o reboot via `dnf system-upgrade clean` manual.
- **Salto único de versão.** Nunca 43 → 45. Sempre 44 → 45.
- **Fedora Atomic não é afetado.** Detectado e bloqueado com
  explicação.

### ⚠️ Nota de atualização

- **`server.js`** ganhou o endpoint `/fedora-upgrade-status` e helpers
  (`_calcularUpgradeStatus`, `_verificarGaFedora`, etc.). Reabra o FAP
  depois de atualizar.
- **`ajustes-manutencao.html`** ganhou o accordion novo + as funções
  `_carregarUpgradeStatus`/`_renderizarAreaUpgrade`/`executarUpgrade*`.
  Nada existente foi modificado.
- **`locales/en.json`** e **`locales/es.json`** — 50 chaves novas
  sob `sessoes.ajustes-manutencao.upgrade_*`, incluindo as 7 warnings
  (`upgrade_warn_nvidia`, `upgrade_warn_broadcom`, `upgrade_warn_terra`,
  `upgrade_warn_razer`, `upgrade_warn_xpadneo`, `upgrade_warn_realtek`,
  `upgrade_warn_coprs`).
- **`.progresso.json`** não muda de formato. `fap-container` não
  precisa ser recompilado.

### 🧪 Não testado nesta release

- **Fedora 45 real** — o endpoint não pôde ser validado com o 45
  efetivamente publicado. A lógica de detecção (`releases.json` +
  HEAD `repomd.xml`) foi testada com o 44 GA, que retorna corretamente
  `waiting_ga` (releases.json aponta para versão 44, target é 45).
- **Download de 45 real** — o `dnf system-upgrade download --releasever=45`
  não pôde ser testado com a versão real. O fluxo de estado
  (`ready` → `downloaded` → `reboot`/`cancelar`) foi validado com
  mocks do endpoint.
- **Waydroid** — pendência desde a `1.2.2`.
- **Hardware NVIDIA real** — pendência desde a `1.2.2`.

---
