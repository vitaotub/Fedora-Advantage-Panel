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

## v1.2.0-10202026

Redesign visual e de navegação. Sidebar lateral substitui os chips
horizontais, busca funcional (sessões + itens internos), badge de origem
em cada pacote, filtros combináveis na sessão 6, card de status na
landing, log dock fixo no rodapé, tema preto/cinza e janela 1280×900.

Nenhuma lógica existente foi alterada: máquina de 3 estados, fila de
Flatpaks, bloqueios (sessão / entre sessões / navegação), `SystemState`,
autenticação `pkexec` e as 13 proteções de itens críticos continuam
idênticos. Todos os botões continuam reagindo exatamente como antes.

### ✨ Novo — Navegação lateral

- **Sidebar** substitui os chips horizontais do topo. Fica fixa à
  esquerda com logo do FAP, botão de colapsar (`«`/`»`), busca no topo,
  lista de 14 sessões com ícone + nome + indicador de progresso
  (`●` concluída / `◐` parcial / `○` não iniciada / `⊘` N/A) + contagem
  `feitos/total · N⊘` e, no rodapé, o botão **"Marcar esta sessão como
  N/A"**.

- **Auto-colapso abaixo de 1100 px** via `matchMedia`. A escolha manual
  do usuário prevalece: se ele expandiu ou colapsou manualmente, o
  auto-colapso não sobrescreve e o estado salvo é restaurado ao
  redimensionar a janela de volta. Persistência em `localStorage`
  (`fap_sidebar_colapsada`).

- **Modo colapsado** (~56 px) mostra só o ícone + indicador de progresso
  (`⊘` quando N/A). Hover revela o nome da sessão via tooltip.

- **Neon por sessão no modo colapsado.** Cada um dos 14 ícones tem uma
  cor própria (`--neon-sessao` no container do item), ativada apenas no
  hover do modo colapsado. O SVG usa `stroke: currentColor` e herda a
  cor; o efeito é reforçado com `filter: drop-shadow()` duplo (4px + 10px).
  No modo expandido, o hover continua neutro.

- **Drawer em mobile** (`< 768 px`): a sidebar sai do grid e vira painel
  deslizante com botão ☰ no header + backdrop semitransparente.

- **Ícones SVG monocromáticos** (`currentColor`, stroke 2, sem `fill`,
  viewBox 24×24) para as 14 sessões, estilo Lucide/Feather. Fallback
  para emoji se a chave SVG não existir.

- **Sincronização do log dock com o colapso.** A classe
  `body.sidebar-colapsada` é aplicada por `_alternarSidebar` e
  `_inicializarSidebar`, e o CSS move o dock para `left: 56px` quando
  colapsado. Sem esse ajuste, o log ficava como uma "janela à parte" da
  interface.

### ✨ Novo — Busca funcional

- **Busca na sidebar** filtra **sessões** (pelo nome traduzido) e
  **itens internos** (por texto visível, `idComando`, `data-i18n`,
  `flatpakId`, `pacotes[]`, `appId`, `binAbrir`, `nome`).
  Case-insensitive e sem acento (normalização NFD + remoção de
  diacríticos dos dois lados).

- **Índice construído no boot em idle** (`requestIdleCallback`, com
  fallback `setTimeout` de 2 s). As 14 sessões são pré-carregadas em
  background via `fetch` silencioso e o índice fica em memória. Filtro
  responde em 0 ms — sem fetch por tecla. Mínimo de 2 caracteres.

- **Cobre todas as 14 sessões**, incluindo `aplicativos.html` e
  `gaming.html` (que usam `.launcher-item`/`.acordeao` em vez de
  `.bloco-comando`). A indexação itera todos os `[data-comando]` do
  HTML de cada sessão e extrai o contexto mais próximo.

- **Resultado em sessão** → destaca a sessão na sidebar. **Resultado em
  item** → destaca a sessão-mãe com badge `N itens` na contagem.
  Clicar na sessão abre-a com filtro aplicado.

- **Banner de filtro fixo no topo do conteúdo**:
  `🔍 Filtrando por "vlc" — 2 itens. [Limpar filtro]`. Blocos
  não-matching ficam `display: none`.

- **Navegação zera o filtro** (efêmero, não persiste entre sessões).

### ✨ Novo — Badge de origem

- **6 variantes** coloridas (16×16 px, canto esquerdo de cada botão,
  tooltip acessível e `aria-label`), com nome textual no popover.
  **Cores em 6 famílias distintas** para máxima distinção:
  - 🟦 **Flathub** (`#3b82f6`) — azul.
  - 🟥 **Fedora** (`#dc2626`) — vermelho.
  - 🟧 **RPM Fusion** (`#ea580c`) — laranja.
  - 🟪 **Fabricante** (`#9333ea`) — violeta.
  - 🟨 **Download** (`#ca8a04`) — âmbar.
  - 🟦 **Comunidade** (`#0891b2`) — ciano.

- **Injeção dinâmica** em `aplicarEstadoInstalavel`. A badge fica como
  irmão do botão dentro de `.btn-flatpak-wrapper` — sobrevive a
  `btn.textContent = ...` e não conflita com a lixeira.

- **Itens sem origem de pacote** (toggles de kernel, GRUB, idioma,
  dual-boot, limpeza, kernel list/remove, `hw-scan`) **não recebem
  badge**.

- **Tooltip replicado no botão** — hover em qualquer parte do botão
  mostra a origem, não só no selo de 16×16.

- **Popover "Sobre este app"** (`position: fixed`, fecha com `Esc`,
  clique fora ou `✕`): mostra **Origem** (nome + descrição), **Comando
  exato** (quando derivável de `APPS_REMOVIVEIS`), **Como atualizar** e
  **Como remover**.

### ✨ Novo — Filtros da sessão 6

- **Dois filtros combináveis (AND)** no topo da sessão 6:
  - **Estado**: Todos / Não feitos / Feitos / Pré-existentes / Pulados.
  - **Origem**: Todas / Flathub / Fedora / RPM Fusion / Fabricante /
    Download / Comunidade.

- **Layout sempre em duas linhas** (`flex-direction: column` em
  `.fap-filtros`): **Estado** na primeira linha, **Origem** na segunda,
  "Limpar filtros" alinhado à direita. Independente do colapso da
  sidebar.

- **Classificação** (via `_classificarApp`):
  - **Feitos** = `isExecutado(id)` — o FAP instalou.
  - **Pré-existentes** = `appJaInstaladoNoSistema(id) && !isExecutado(id)`.
  - **Não feitos** = nenhum dos dois.
  - **Pulados** = marcado em `pulados`.

- **Contagem por bloco**: blocos com 0 itens visíveis mostram o título
  com `(N itens, 0 visíveis)`.

### ✨ Novo — UI de itens pulados

- **Sidebar** mostra a contagem como `feitos/total · N⊘` quando há
  pulados na sessão.
- **Filtro "Pulados"** na sessão 6 lista os apps com `marcarComoPulado`
  ativo.

### ✨ Novo — Card de status na landing

- **4 barras de progresso** calculadas no boot a partir de
  `SystemState` + `.progresso.json`, sem nenhum clique:
  - **Uso geral**: sessões 1, 2, 7, 9, 10, 12.
  - **Gaming**: sessão 8.
  - **Produção**: sessões 5, 6.
  - **Segurança**: sessões 3, 4, 11, 13.

- **Sessão 14** e sessões marcadas como N/A ficam **fora do cálculo**.

- **Frase contextual**: "Faltam N passos para deixar o Fedora completo".
  Quando N = 0, mostra "Seu Fedora está pronto. 🎉".

- **Card reorganizado em blocos retangulares separados**: cada bloco
  tem `border: 1px solid var(--border); border-radius: 8px`.
  **Retângulo 1** — relógio + data centralizados. **Retângulo 2** —
  resumo das sessões. **Retângulo 3** — h2 "Iniciar Configurações do
  Fedora" + textos descritivos. **Botão "🚀 Iniciar Configuração"**
  fica **fora** dos retângulos, com `margin-top: 1.5rem`.

- **`#card-status` começa visível** com um placeholder ("Calculando
  progresso...") e é substituído pelas barras quando o `SystemState`
  resolve. Se o `SystemState` falhar, o `#card-status` esconde e o
  texto descritivo continua visível ao lado — não há mais estado de
  "fallback" separado.

### ✨ Novo — Marcar sessão como N/A

- **Botão no rodapé da sidebar** alterna entre "Marcar N/A" e
  "Desmarcar N/A" para a sessão atual. Estado em
  `localStorage('fap_sessoes_na')`.
- **Sessão N/A sai do contador global** (`0/14` → `0/13`), sai do
  cálculo das barras da landing e aparece com `⊘` na sidebar.
- **Banner discreto no topo da sessão** quando N/A: "Esta sessão está
  marcada como não aplicável. [Desmarcar]".

### ✨ Novo — Refresh do estado do sistema

- **Botão 🔄 no header** chama `SystemState.invalidar()` +
  `SystemState.carregar()` + `restaurarEstadoSessao()` +
  `_sincronizarEstadoFlatpaks()` + `_renderizarBadgesFixas()`. Útil
  após instalar algo por fora (via terminal).
- **Feedback**: spinner durante, `✓` verde por 1 s.

### ✨ Novo — Log dock fixo no rodapé

- O `.terminal-log-wrapper` da sessão é **movido para `#fap-log-dock`**
  (filho de `<body>`, `position: fixed; bottom: 0`).
- **Altura fixa em pixels**: **160 px** quando expandido. Scroll interno.
- **Sempre inicia colapsado** ao carregar uma sessão. Não persiste entre
  sessões nem reloads.
- **Seta do toggle**: `▲` colapsado (clique para abrir); `▼` expandido
  (clique para fechar).
- **`body.log-dock-visivel`** → `padding-bottom: 4rem` no `main`;
  **`body.log-dock-expandido`** → `210px`.
- **Sincronização com a sidebar**: `body.sidebar-colapsada .fap-log-dock
  { left: 56px }`.
- **Tema Matrix verde preservado**.

### 🎨 Interface

- **Janela nativa**: 980×880 → **1280×900**. Novos args `--min-width`
  (padrão 640) e `--min-height` (padrão 480).
- **Fallback Firefox/Chromium**: `--window-size` → **1280×900**.
- **Tema escuro reformulado**: paleta azul → **preto/cinza**
  (`#0a0a0a`, `#161616`, `#1e1e1e`, `#2a2a2a`, `#3a3a3a`, `#4d4d4d`).
  Tema claro mantém os azuis. Variável `--accent-rgb` para shadows/glows
  theme-aware.
- **SVGs data-URI** (`.kernel-dropdown`, `.i18n-seletor`) usam
  `stroke='currentColor'`.
- **Layout do guiado** virou CSS Grid
  (`grid-template-columns: var(--fap-sidebar-width, 220px) minmax(0, 1fr)`).
- **Media queries**: `1099px` (auto-colapso via JS), `768px` (drawer),
  `600px` (1 coluna).
- **`body.fap-guiado`** e **`body:has(.fap-layout)`** desfazem o
  `display: flex` centralizado herdado do `index.html`.

### 🐛 Correções durante a validação

- **Sessão 1 — Flathub não detectava pré-existência.** A condição em
  `restaurarEstadoSessao` exigia `SystemState.repoAtivo('flathub')`, mas
  Flathub é um **remote Flatpak**, não um repo DNF — `repoAtivo('flathub')`
  sempre retornava `false`. Resultado: o botão ficava clicável mesmo com
  Flathub já configurado. Corrigido para usar apenas
  `SystemState.remoteFlatpakAtivo('flathub')`.

- **Busca não indexava a sessão 6 (e outras).** `_construirIndiceBusca`
  iterava só `.bloco-comando`, mas `aplicativos.html` e `gaming.html`
  usam `.launcher-item` dentro de `<details class="acordeao">`. Resultado:
  "plex", "okular", "steam" e qualquer app da sessão 6 nunca casavam.
  Corrigido iterando **todos os `[data-comando]`** e extraindo contexto
  via `_contextoDoBotao` (cobre `.bloco-comando` e `.acordeao`). Botões
  de abrir/remover/reverter são ignorados para não duplicar a contagem.

- **Busca antes do índice terminar retornava vazio.** Adicionado evento
  `fap-indice-pronto` disparado ao fim de `_construirIndiceBusca()`, e
  listener em `guiado.html` que re-roda a busca se o usuário já tinha
  digitado algo.

- **Falso positivo na busca.** `_aplicarDestaqueBusca` só atualizava
  sessões com hit; as outras mantinham a contagem antiga (progresso
  normal, ou o badge "N itens" de uma busca anterior). Agora toda sessão
  é explicitamente resetada (contagem de progresso normal) ou atualizada
  ("N itens") a cada busca.

- **Tooltip de origem sumia após o primeiro render.**
  `_renderizarBadgeOrigem` fazia `if (wrapper.querySelector('.fap-badge-origem')) return;`
  — então o tooltip só era aplicado na **primeira** chamada. Como
  `aplicarEstadoInstalavel` limpa `btnInstall.title` no topo, as chamadas
  subsequentes (ex.: `_sincronizarEstadoFlatpaks`) deixavam o botão sem
  tooltip. Agora o badge só é **criado** uma vez, mas o tooltip é
  **sempre reaplicado** no badge e no botão.

- **Detecção de idiomas (3 botões).** `idioma-packs`, `idioma-hunspell`,
  `idioma-localectl` só checavam `isExecutado` — nunca o estado real.
  Corrigido via `SystemState.pacoteInstalado('langpacks-pt_BR')` /
  `'hunspell-br'` e novo campo `locale_lang` em `/system-state`
  (executa `localectl status`). Quando pré-existente, o botão mostra
  "✅ Já estava ativo" com tooltip.

- **Log do Flatpak bufferizado.** `flatpak install` usa libc buffering
  quando stdout não é TTY, então o log parecia "travado" no início e
  explodia no final. Corrigido aplicando `stdbuf -oL -eL` no `server.js`
  **apenas** a comandos que começam com `flatpak` (ou `sudo flatpak`).

- **`_limparLogDock` vazava `MutationObserver`.** Cada troca de sessão
  acumulava um observer vivo (o `null` só perdia a referência, não
  parava de observar). Corrigido com `_observadorLogDock.disconnect()`
  antes de recriar.

- **Cores dos badges confundiam.** Fedora (`#294172`) e Flathub
  (`#4a7fe0`) eram ambos azuis; RPM Fusion (`#e05a3a`) e Fabricante
  (`#e07b3a`) eram ambos laranja. Nova paleta com 6 famílias distintas
  (azul, vermelho, laranja, violeta, âmbar, ciano), distinguível a 16×16.

- **Contraste no tema escuro.** `.version-badge` (badge da versão na
  landing) herdava `var(--accent)` (`#3a3a3a`) sobre fundo azul
  residual, ficando ilegível. Corrigido para `--bg-secondary` +
  `--accent-soft` + `--text-main`. `.relogio-hora` idem (agora
  `--text-main` + sombra `rgba(var(--accent-rgb), 0.3)`). `footer a`
  (VitãoTub, GitHub, Documentação, Reportar Bug) idem (agora
  `--accent-soft`).

- **Flash do texto descritivo na landing.** O card tinha um estado de
  "fallback" (`#card-status-fallback`) que aparecia por 1-2 s antes das
  barras, sumindo em seguida. Corrigido removendo o fallback — a
  descrição é conteúdo permanente; `#card-status` começa com placeholder
  ("Calculando progresso...") e é substituído pelas barras.

### 🔧 Melhorias

- **`_contagemSessao(id)`** retorna `{ feitos, pulados, total, na }`
  numa única chamada. Usado pela sidebar e pelo card de status.

- **`_renderizarBadgesFixas()`** varre `[data-comando]` após cada
  sessão carregada e injeta badges em botões `sempreClicavel`.

- **`_inicializarFiltrosApps()`** é idempotente (flag
  `data-listeners-ready`).

- **`_termoBuscaAtual`** é preservado durante o carregamento da sessão,
  para o filtro ser reaplicado depois que o HTML entra no DOM.

- **`_limparLogDock()`** é chamada no início de cada `carregarSessao()`.

- **`_alternarSidebar` e `_estadoEfetivoSidebar`** centralizam a lógica
  de colapso. O auto-colapso **não sobrescreve** a escolha manual.

### 🌐 Internacionalização

- **Novas chaves em `locales/en.json` e `locales/es.json`:**
  - `origem.*` — nome, tooltip, como atualizar e como remover de cada
    origem + labels do popover.
  - `busca.*` — placeholder, banner de filtro, `item`/`itens`,
    `limpar_filtro`.
  - `filtros.*` — `label_estado`, `label_origem`, valores dos chips.
  - `landing.*` — `grupo_geral`, `grupo_gaming`, `grupo_producao`,
    `grupo_seguranca`, `faltam`, `pronto`, `calculando`.
  - `sidebar.*` — `busca_placeholder`, `na_btn`, `na_btn_ativo`.
  - `na.*` — `banner_texto`, `desmarcar`.
  - `refresh.*` — `tooltip`.
  - `sessoes.primeiros-passos.repositorios_titulo` — título do acordeão
    "Repositórios do Fedora" (faltava em EN/ES).

### 🧹 Limpeza

- **`criarMenuSessoes` e `atualizarMenuSessoes` do `guiado.html`** foram
  substituídas por `criarSidebar` e `atualizarSidebar`. As classes
  `.session-menu-item` e o atributo `data-sessao` foram mantidos por
  compatibilidade.
- **`#session-menu-wrapper` e `#session-menu`** removidos do HTML.
- **`.iniciar-conteudo` da landing** virou `display: block`.
- **`#card-status-fallback` removido** do `index.html`.
