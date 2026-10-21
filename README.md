# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Idioma:** Português (BR) | [English](README.en.md) | [Español](README.es.md)

![Versão](https://img.shields.io/badge/Vers%C3%A3o-v1.2.1--10212026-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44%20%7C%2045-294172?style=flat-square&logo=fedora)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-GPL--3.0-green?style=flat-square)
![Idiomas](https://img.shields.io/badge/Idiomas-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Deixando o seu Fedora pronto para o "play" — visual, rápido e sem terminal.

## 📖 O que é

O **Fedora Advantage Panel (FAP)** é um painel de automação visual para o Fedora Linux. Ele transforma uma instalação limpa em um sistema completo — codecs, drivers, repositórios, ferramentas — através de cliques, sem abrir o terminal.

Um único botão, **Iniciar Configuração**, leva você por **14 sessões guiadas** passo a passo. Cada botão lembra o próprio estado: feche o FAP, reabra, e ele mostra exatamente onde você parou.

## 📸 Telas

### Tela inicial — seu Fedora em um relance

![Tela inicial do FAP](prints/01-landing.png)

Logo ao abrir, o FAP consulta o estado real do sistema (repositórios ativos, apps instalados, ajustes aplicados) e mostra **4 barras de progresso** — Uso geral, Gaming, Produção e Segurança. A frase abaixo resume: *"Faltam N passos para deixar o Fedora completo"*. Quando tudo estiver pronto, vira *"Seu Fedora está pronto. 🎉"*.

### Navegação lateral + busca

![Navegação lateral do FAP](prints/02-sidebar.png)

Sidebar lateral retrátil com as 14 sessões, cada uma com ícone, nome e indicador de progresso (`●` concluída, `◐` parcial, `○` não iniciada, `⊘` N/A). Tem **busca global** — digite "vlc" ou "steam" e a sidebar filtra tanto sessões quanto itens internos. Clique no resultado e a sessão abre já filtrada.

No modo colapsado, cada ícone ganha um **efeito neon próprio** ao passar o mouse, para identificar rápido cada sessão.

### Origem de cada pacote, filtros e badges

![Filtros e origem dos pacotes](prints/03-filtros.png)

Cada aplicativo mostra de onde vem — **Flathub, Fedora, RPM Fusion, Fabricante, Download ou Comunidade**. Cada origem tem uma cor distinta (azul, vermelho, laranja, violeta, âmbar, ciano) para identificação rápida. Passe o mouse em qualquer parte do botão e o tooltip mostra a origem; clique no selo colorido para abrir um popover com **comando exato**, **como atualizar** e **como remover**.

Filtros combináveis (estado + origem) deixam você ver só o que já foi feito, só o que falta, só os pré-existentes (instalados antes do FAP), ou só os pulados.

### Log em tempo real com tema Matrix

![Log em tempo real do FAP](prints/04-log.png)

Tudo que o FAP faz passa por um **terminal fixo no rodapé**, com cores distinguindo saída normal, sucesso e erro real. O log começa colapsado (clique no toggle `[▲/▼]` para expandir) e acompanha a sidebar quando ela colapsa. Fechar o FAP não mata comandos em execução — a árvore de processos é encerrada corretamente.

## 🎯 Para quem é

- **Quem está começando no Fedora** e quer deixá-lo pronto para uso diário (codecs, repositórios, apps) sem pesquisar 20 tutoriais.
- **Quem vem de Ubuntu/Mint** e quer a mesma fluidez de configuração inicial.
- **Quem joga no Linux** e quer Steam, Heroic, Lutris, Proton, MangoHud e afins funcionando rapidamente.
- **Quem já usa Fedora há tempo** e quer automatizar o pós-instalação (drivers, COPRs, ajustes de kernel).
- **Quem cuida do PC de outra pessoa** (família, amigos) e quer configurar sem terminal.

## 🚀 Instalação

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
```

**Comandos após instalar:**

```bash
fap              # inicia o FAP
fap-compat       # modo compatibilidade (GPUs antigas, VMs)
fap --update     # atualiza (ou clique no badge dentro do FAP)
fap --uninstall  # desinstala
```

Atualizações são feitas **em cima da instalação existente** — não precisa desinstalar entre versões. Progresso, tema e idioma são preservados.

## ✨ As 14 Sessões

| # | Sessão | O que faz |
|---|---|---|
| 1 | 🚀 Primeiros Passos | Atualização do sistema, RPM Fusion, Flathub, Terra Repository (com avisos sobre subrepositórios opcionais) |
| 2 | 🔤 Codecs | Codecs multimídia completos (grupo `multimedia` oficial do RPM Fusion), DVD comercial, fontes Microsoft |
| 3 | 🖥️ Hardware | Drivers AMD/NVIDIA/Intel, CoreCtrl, LACT, overclock de GPU |
| 4 | 🔌 Dispositivos | Detecção automática de hardware, drivers COPR de comunidade, controles, firmwares |
| 5 | 🎬 Produção Multimídia | OBS Studio, câmera virtual, EasyEffects |
| 6 | 📦 Aplicativos | Flatpaks selecionados, 20+ apps `dnf`, navegadores via RPM oficial, **Suíte ArtCraft (13 apps)** e ferramentas de acesso remoto |
| 7 | 🏠 Casa e Escritório | CUPS, Samba, LocalSend, KeePassXC |
| 8 | 🎮 Gaming | Steam nativo, Heroic (Flatpak), Lutris, Wine, GameMode, emuladores |
| 9 | 📱 Waydroid | Android no Linux via container |
| 10 | 🖥️ Virtualização | QEMU/KVM, VirtualBox, GNOME Boxes |
| 11 | 📊 Diagnóstico | Painel do sistema, saúde de disco (SMART), temperaturas, journal de erros |
| 12 | 🛠️ Ajustes e Manutenção | Tunings de performance e áudio, DNF, dual-boot, configuração interativa do GRUB, kernels |
| 13 | 🐧 Estado do Fedora | Versão, detecção de Atomic/Silverblue, gerenciamento do SELinux |
| 14 | 📖 Sobre o FAP | Atualizar/desinstalar, changelog dinâmico, histórico de mudanças |

## 🛡️ Segurança e transparência

- **Nunca instala nada sem você ver.** Todo comando fica visível no log em tempo real.
- **Detecção de pré-existência.** Se você já tinha VLC, Steam ou driver NVIDIA antes do FAP, o botão mostra "Abrir" desde o início, com tooltip avisando a origem.
- **13 itens críticos protegidos.** Drivers, codecs, CUPS, Samba, virtualização: se já existiam antes do FAP, a lixeira não aparece. Evita quebrar o sistema sem querer.
- **Detecção real de idiomas.** Os 3 botões de tradução consultam o estado do sistema — se já estava aplicado, mostram "✅ Já estava ativo".
- **Autenticação via `pkexec`.** Diálogo de senha nativo do seu desktop, nunca digitada no terminal.
- **Bloqueio inteligente.** Enquanto um comando `dnf` está rodando, outros botões `dnf` de outras sessões ficam travados. A fila de Flatpaks resolve o lock global.
- **Container nativo WebKitGTK.** Interface própria, sem depender do Firefox/Chromium. Modo compatibilidade (`fap-compat`) para GPUs antigas.
- **`install.sh` recusa rodar como root.** Instala em `~/.local/share` e usa `sudo` apenas onde precisa.

## 🎨 Recursos da Interface (v1.2)

- **Tema preto/cinza de alto contraste** no dark; tema claro mantém os azuis Fedora.
- **Sidebar lateral colapsável** com ícones SVG monocromáticos e **efeito neon por sessão** no modo colapsado.
- **Busca global** com índice construído em background no boot — cobre todas as 14 sessões.
- **Badges de origem** (6 variantes com cores distintas) com tooltip em qualquer parte do botão e popover com comando exato, como atualizar e como remover.
- **Filtros combináveis** (estado + origem) na sessão 6, sempre em duas linhas.
- **Card de status na landing** com 4 barras calculadas no boot.
- **Log dock fixo** de 160px, sempre inicia colapsado, com scroll interno.
- **Sessões N/A** que saem do cálculo de progresso.
- **Botão 🔄 no header** que recarrega o estado do sistema sem fechar o FAP.

### 🔒 Proteção de itens críticos

**13 itens de alto risco** (codecs, drivers NVIDIA, VA-API, CUPS, Samba, QEMU/KVM, VirtualBox, GNOME Boxes) têm a remoção bloqueada quando pré-existentes. O botão mostra "✅ Já estava ativo" com tooltip incluindo o comando exato de reversão manual.

## 🖥️ Requisitos e suporte

- **Fedora 44 ou 45** (desenvolvido e testado amplamente nos dois).
- **GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3** e outros tiling WMs.
- **PT-BR, EN e ES.** Trocável no header do FAP.

## 🔄 Atualizar e desinstalar

**Atualizar:**
```bash
./install.sh --update
```
Ou clique no badge de atualização (aparece automaticamente quando há nova versão no GitHub) ou use o botão na sessão **Sobre o FAP**.

**Desinstalar:**
```bash
./install.sh --uninstall
```
Ou use o botão na sessão **Sobre o FAP** (com dupla confirmação).

## 🐛 Feedback, bugs e sugestões

O FAP é um projeto open-source (GPL-3.0), mantido por **VitãoTub** em tempo livre.

- **Bugs:** abra uma [issue](https://github.com/vitaotub/Fedora-Advantage-Panel/issues) com a saída de `/tmp/fap-*.log` (se possível) e a versão do Fedora.
- **Sugestões:** também via issue.
- **Print screens:** se algo estiver estranho, um print ajuda muito.

## 📄 Licença

**GPL-3.0** — veja [LICENSE](LICENSE).

## 👤 Autor

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Agradecimentos

[![Fedora Project](https://img.shields.io/badge/Fedora-Project-294172?style=flat-square&logo=fedora&logoColor=white)](https://getfedora.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://www.deepseek.com/)

**Feito com ❤️ para a comunidade Fedora**
