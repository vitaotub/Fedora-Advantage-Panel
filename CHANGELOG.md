# Changelog — Fedora Only Fans (FOF)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e o FOF usa versionamento baseado em data: `v1.0.0-MMDDAAAA`.

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FOF, na sessão **Sobre o FOF**.

> **Regra importante para quem for editar:** use apenas `## vX.Y.Z-...` para os
> cabeçalhos de versão. Dentro de uma seção, use `###` (três hashes) para
> subseções — um `##` no meio de uma versão encerra a captura do parser e o
> resto é descartado silenciosamente.

---

## v1.0.0-09282026

### 🔄 Reestruturação completa das sessões

As sessões foram reorganizadas para refletir a ordem lógica de configuração
de um Fedora novo, e os IDs agora são **semânticos** (sem número). Reordenar
sessões passou a ser apenas uma questão de mover linhas no array `SESSOES`
em `script.js` — nada mais precisa mudar.

**De 13 para 12 sessões:**

- 🚀 **Primeiros Passos** — atualização do sistema + RPM Fusion + Flatpak
- 🔤 **Codecs e Compatibilidade** — (antes `04-codecs-compatibilidade`)
- 🖥️ **Hardware** — (antes `05-hardware`)
- 🎬 **Produção Multimídia** — (antes `07-loja`, sem os ajustes de áudio)
- 📦 **Aplicativos Recomendados** — (antes `09-softwares-uteis`)
- 🏠 **Casa e Escritório** — (antes `10-casa-pronta`)
- 🎮 **Gaming** — (antes `06-gaming`, sem o teste de bufferbloat)
- 📱 **Waydroid** — (antes `08-waydroid`)
- 📊 **Diagnóstico** — (antes `11-diagnostico`, sem o Baobab)
- 🛠️ **Ajustes e Manutenção** — sessão nova, funde `02-otimizacao` + ajustes de áudio + manutenção do Fedora
- 🐧 **Estado do Fedora** — (antes `12-fedora`)
- 📖 **Sobre o FOF** — sessão nova, com o "sobre" + manutenção do FOF + changelog dinâmico

**Sessões removidas:**

- 💾 **Restauração** (Btrfs-Assistant) — considerada fora do escopo do FOF
- 🔧 **Manutenção** (página standalone `manutencao.html`) — conteúdo dividido entre **Ajustes e Manutenção** e **Sobre o FOF**

**Conteúdo movido entre sessões:**

- Ajustes de Áudio (realtime-setup, PipeWire low latency) — de **Produção Multimídia** → **Ajustes e Manutenção**
- Ajustes de Desempenho (vm.max_map_count, swappiness, TCP BBR) — de **Otimização** → **Ajustes e Manutenção**
- Manutenção do Fedora (limpeza, kernels, GRUB) — da página **Manutenção** → **Ajustes e Manutenção**
- Sobre o FOF (texto institucional) — de **Boas-vindas** → **Sobre o FOF**
- Atualizar FOF / Desinstalar FOF — da página **Manutenção** → **Sobre o FOF**

**Conteúdo removido:**

- Teste de bufferbloat (Rede para Jogos Online) — removido do **Gaming**
- Análise Visual de Disco (Baobab) — removido do **Diagnóstico**

### 🎨 Tela inicial redesenhada

- Landing page agora exibe **relógio ao vivo** no topo do card principal
- Card único com **texto explicativo à esquerda** e **botão "Iniciar" à direita**,
  verticalmente centralizados
- Texto reescrito em dois parágrafos mais escaneáveis, destacando que o FOF
  **não faz backup** e recomendando backup antes de aplicar alterações
- Removidos: resumo curto e ícone antigo do card

### 📝 Changelog dinâmico

- O changelog exibido dentro do FOF agora é carregado dinamicamente deste arquivo, via `GET /changelog`
- O servidor faz parse do markdown, encontra a seção da versão atual e devolve HTML pronto
- Cache em memória por 12h
- Botão "Ver Changelog Completo no GitHub" corrigido — usava `window.open`, que o WebKitGTK bloqueia silenciosamente; agora usa `window.location.href` (o container detecta navegação externa e abre no navegador do sistema via `xdg-open`)
- Título do changelog dentro do FOF passou a usar `{versao}` dinâmico (antes era hardcoded e ficava desatualizado)

### 🐛 Correções

- **Bug de sintaxe em `script.js`** — vírgula faltando e entrada duplicada no array `SESSOES` quebravam o arquivo inteiro. Sintoma: badge de versão vazio no `index.html` e spinner infinito no `guiado.html`
- **Regex de arquivos de sessão no `server.js`** — exigia prefixo numérico (`^\/(\d{2}-[a-z-]+\.html)$`), o que impedia as sessões com IDs semânticos de serem servidas. Corrigido para aceitar qualquer `.html` iniciado por letra minúscula
- **`limpar_arquivos_antigos()` no `install.sh`** — estava definida dentro de `reaplicar_permissoes()`, o que a tornava inacessível durante `--update` em sessões novas do bash. Movida para escopo top-level
- **Permissões defensivas** — `iniciar_fof.sh` e `iniciar_fof_compat.sh` agora autocorrigem `+x` em arquivos do projeto. Protege contra cópias sem bit de execução (zip, USB, `scp` sem `-p`)
- **`install.sh --update`** — limpa arquivos de sessões antigas antes do `git pull`. Evita resquícios quando o git não detecta renomeações
- **IDs órfãos** — o progresso agora é limpo automaticamente. IDs de comandos que não existem mais são removidos do `.progresso.json` no boot, e o contador global de sessões concluídas deixa de mentir
- **Badge de atualização** — agora aponta para `guiado.html?session=sobre-fof` (antes ia para `manutencao.html`, que foi removida)

### 🗑️ Removido

- Página `manutencao.html` (conteúdo absorvido por **Ajustes e Manutenção** e **Sobre o FOF**)
- Rotas e referências a `manutencao.html` em `server.js`, `script.js`, `iniciar_fof.sh` e `install.sh`
- `locales/pt-BR.json` — o arquivo era código morto: o `i18n.js` nunca o carregava (pt-BR é o idioma padrão e usa o próprio HTML como fonte). Manter só gerava manutenção dupla
- **Busca global (Ctrl+K)** — a implementação apresentava problemas de compatibilidade com o WebKitGTK do container nativo. Função removida completamente: overlay, listeners de teclado e CSS associados

---

## v1.0.0-09232026

### ✨ Adicionado

- Verificação automática de atualizações via GitHub Releases API (badge ⬆️ no header quando há versão mais nova; cache de 12h)
- Popup pós-atualização (avisa para fechar e reabrir o FOF)
- Aviso educativo detalhado sobre NTSYNC na sessão Gaming
- Botões "Atualizar Apps Flatpak" nas sessões de Gaming e Aplicativos
- Ícone de desinstalar ao lado de cada app Flatpak instalado
- Detecção de Flatpak removido externamente — botão volta ao estado inicial automaticamente
- Endpoint `/flatpak-installed` no servidor
- Campos novos em `/system-info` (KSM, BBR, max_map_count, PipeWire quantum)
- Painel "Ajustes de Otimizações" no Diagnóstico

### 🔄 Modificado

- Sessão 00 (Boas-vindas) reformulada em 2 acordeãos
- Logs de sessão expandidos por padrão; altura uniforme (120–200px)
- Header com controles inline ao título

### 🐛 Corrigido

- Bug de permissão no `flatpak uninstall` (rodava via kdesu/pkexec, quebrando o DBus de sessão; agora roda como usuário via whitelist)
- `systemctl --user` movido para a whitelist de comandos sem autenticação, com env ajustado automaticamente

---

## v1.0.0

### ✨ Versão inicial pública

- Painel de automação visual para configurar Fedora Linux
- Sessões organizadas em ordem guiada (boas-vindas, restauração, otimização, repositórios, codecs, hardware, gaming, produção multimídia, waydroid, aplicativos, casa pronta, diagnóstico, fedora)
- Container nativo WebKitGTK (sem dependência de navegador externo)
- Logs em tempo real via Server-Sent Events
- Persistência de progresso (servidor local + localStorage)
- Internacionalização: PT-BR, EN, ES
- Tema claro/escuro alternável
- Busca global (Ctrl+K)
- Autenticação segura via pkexec/kdesu com whitelist de comandos read-only
- Toasts + notificações nativas ao concluir tarefas longas (>30s)
- Barra de progresso global no header

---

### Como adicionar uma versão nova

Ao lançar uma versão nova:

1. Atualize o campo `version` no `package.json` (ex.: `"1.0.0-10012026"`)
2. Atualize `FALLBACK_VERSION` no `i18n.js` (a única exceção à regra de fonte única)
3. Adicione uma seção nova **no topo deste arquivo**, antes da versão anterior. O cabeçalho precisa ser `## v<versão>` — por exemplo, `## v1.0.0-10012026` — batendo exatamente com o `version` do `package.json`.
4. Use `###` (três hashes) para subseções dentro de uma versão. Um `##` no meio da seção encerra a captura do parser e o resto é descartado.
5. Crie a tag/release no GitHub com o mesmo nome.

Se o cabeçalho não bater exatamente com o `version` do `package.json`, o FOF não encontrará a seção correspondente e mostrará apenas o link para o changelog completo no GitHub.
