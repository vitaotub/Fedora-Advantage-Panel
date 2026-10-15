# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Idioma:** Português (BR) | [English](README.en.md) | [Español](README.es.md)

![Versão](https://img.shields.io/badge/Vers%C3%A3o-v1.0.0--10152026.c-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44+-294172?style=flat-square&logo=fedora)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-GPL--3.0-green?style=flat-square)
![Idiomas](https://img.shields.io/badge/Idiomas-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Deixando o seu Fedora pronto para o "play" — visual, rápido e sem terminal.

## 🚀 Instalação

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
```

**Comandos disponíveis após instalar:**

```bash
fap                       # Iniciar (modo normal)
fap-compat                # Iniciar (modo compatibilidade — GPUs antigas)
./install.sh --update     # Atualizar
./install.sh --uninstall  # Desinstalar
```

## 📖 O que é

O Fedora Advantage Panel (FAP) é um painel de automação visual para o Fedora Linux. Ele transforma uma instalação limpa em um sistema completo — codecs, drivers, repositórios, ferramentas — através de cliques, sem abrir o terminal.

**Um único ponto de entrada.** O botão **"Iniciar"** leva você por 14 sessões guiadas passo a passo. Cada botão lembra seu próprio estado. Fechar e reabrir o FAP mostra exatamente onde você parou.

## ✨ As 14 Sessões

| # | Sessão | O que faz |
|---|---|---|
| 1 | 🚀 Primeiros Passos | Atualização do sistema, RPM Fusion, Flathub, Terra Repository (com avisos sobre subrepositórios opcionais) |
| 2 | 🔤 Codecs | Codecs multimídia completos (grupo `multimedia` oficial do RPM Fusion), DVD comercial, fontes Microsoft |
| 3 | 🖥️ Hardware | Drivers AMD/NVIDIA/Intel, CoreCtrl, LACT, overclock de GPU |
| 4 | 🔌 Dispositivos | Detecção automática de hardware, drivers COPR de comunidade, controles, firmwares |
| 5 | 🎬 Produção Multimídia | OBS Studio, câmera virtual, EasyEffects |
| 6 | 📦 Aplicativos | Flatpaks selecionados, 20+ apps `dnf`, navegadores via RPM oficial, **Suíte ArtCraft (13 apps)** e ferramentas de acesso remoto |
| 7 | 🏠 Casa e Escritório | CUPS, Samba, LocalSend, KeePassXC, OCR (Okular + Tesseract) |
| 8 | 🎮 Gaming | Steam nativo, Heroic (RPM oficial), Lutris, Wine, GameMode, Gamescope Session, emuladores |
| 9 | 📱 Waydroid | Android no Linux via container |
| 10 | 🖥️ Virtualização | QEMU/KVM, VirtualBox, GNOME Boxes |
| 11 | 📊 Diagnóstico | Painel do sistema, saúde de disco (SMART), temperaturas, journal de erros |
| 12 | 🛠️ Ajustes e Manutenção | Tunings de performance, DNF, configuração interativa do GRUB, kernels |
| 13 | 🐧 Estado do Fedora | Versão, detecção de Atomic/Silverblue, gerenciamento do SELinux |
| 14 | 📖 Sobre o FAP | Atualizar/desinstalar, changelog dinâmico, histórico de mudanças |

## 🎨 Recursos

### Interface e usabilidade

- **Interface escura e clara** com troca em tempo real, sem recarregar a página
- **Multilíngue** (PT-BR, EN, ES) com seletor no cabeçalho
- **Logs em tempo real** por comando, com cores que distinguem saída normal, sucesso e erro real
- **Bloqueio inteligente** — impede conflitos de lock no `rpm` e trava a navegação entre sessões enquanto um comando está rodando
- **Sessão retomável** — cada botão lembra seu estado no `.progresso.json`, fechar e reabrir mostra onde você parou

### Instalação de aplicativos

- **Lixeira unificada** — todo app instalável tem um ícone de remoção ao lado, que remove o pacote e, quando aplicável, desativa o repositório de origem
- **Origem por tipo de app** — o FAP escolhe automaticamente a melhor forma de instalação:
  - **Flatpak (Flathub)** — quando não existe repo oficial no Fedora nem pacote nos repos da distro
  - **`dnf` (repos oficiais do Fedora ou RPM Fusion)** — quando a própria distro empacota o software
  - **RPM via repo oficial do fabricante** — quando o fabricante distribui para Fedora (navegadores, Heroic)
  - **RPM baixado de URL** — quando só existe essa opção. Suporta tanto URL estática (OnlyOffice) quanto URL resolvida em runtime via API do GitHub (Suíte ArtCraft, RustDesk, Lightworks, Rclone Manager). `--setopt=localpkg_gpgcheck=0` obrigatório no Fedora 44/45
- **Fila de Flatpaks** — clicar em vários apps em sequência os enfileira e instala um por vez, sem erro de lock do Flathub
- **Botão "Abrir"** em todos os apps GUI — abre em sessão própria, sobrevivendo ao fechamento do FAP
- **Detecção de apps instalados por fora** — se você já tem um app instalado antes do FAP, o botão aparece como "Abrir" desde o início
- **Remoção inteligente de codecs** — a lixeira dos codecs faz o swap de volta de `ffmpeg` para `ffmpeg-free` e reinstala os plugins base do Fedora, em vez de deixar o sistema sem codecs

### Container WebKitGTK nativo

- **Interface própria**, sem depender de navegador externo
- **Container nativo em WebKitGTK 4.1 + GTK3**, compilado na instalação
- **Modo compatibilidade** (`fap-compat`) para GPUs sem aceleração 3D — força renderização por software via Mesa/llvmpipe
- **Sem popups incômodas** — EULA do Chromium suprimida e permissões do WebKit (localização, câmera, microfone) negadas automaticamente

### Autenticação e segurança

- **`pkexec` universal** — diálogo de senha integrado em todos os desktops (KDE usa `polkit-kde-agent`, GNOME usa `polkit-gnome`, etc.), sem precisar digitar senha no terminal
- **Comandos read-only em whitelist** — `rpm -q`, `uname -r`, `gtk-launch`, `flatpak`, `systemctl --user` e afins rodam sem pedir senha
- **Update e uninstall do FAP rodam como usuário**, com `SUDO_ASKPASS` (zenity/kdialog) para os passos privilegiados internos — evita que arquivos fiquem com owner root
- **Bloqueio de injeção de shell** — comandos com `;`, `&&`, `|`, `$(...)` ou `&` são rejeitados pela whitelist e exigem autenticação

### Ciclo de vida

- **Fechamento limpo** — ao fechar a janela do FAP, o servidor Node.js é encerrado e a porta 3000 é liberada automaticamente. Não sobra nada na memória.
- **Árvore de processos protegida** — se um comando `dnf` está rodando quando o FAP é fechado, a árvore inteira de processos é morta via PGID, evitando locks órfãos no `rpm`
- **Log persistente** — cada sessão escreve um arquivo `/tmp/fap-YYYYMMDD-HHMMSS.log`, com limpeza automática de logs com mais de 7 dias
- **`install.sh` recusa execução como root** — instala em `$HOME` do usuário, com `sudo` interno apenas para os passos que precisam

### Suíte ArtCraft

Alternativas open-source (desenvolvidas em Rust) aos produtos Adobe e Microsoft Office. Cada app tem seu próprio repositório no GitHub e seu RPM `.x86_64` na release mais recente — o FAP resolve a URL em runtime, sempre baixando a última versão publicada:

- 🖼️ **PhotoCraft** — edição de fotos
- ✏️ **VectorCraft** — ilustração vetorial
- 🎬 **FilmCraft** — edição de vídeo
- 💡 **LightCraft** — iluminação 3D
- 📄 **PDFCraft** — edição de PDF
- ✨ **EffectCraft** — efeitos visuais
- 🎨 **DesignCraft** — design gráfico
- 🖌️ **FigCraft** — vetores e ilustração
- 📽️ **DeckCraft** — apresentações
- 📊 **GridCraft** — planilhas
- 📝 **WordCraft** — editor de texto
- 📐 **CadCraft** — CAD
- 🔊 **SoundCraft** — edição de áudio

### Detecção automática de hardware

- **Escaner de hardware** via `lspci` / `lsusb`, cruzado com um mapa de vendors mantido pela comunidade
- **Detecção de NVIDIA** com heurística para sugerir a série correta de driver (`akmod-nvidia`, `580xx`, `470xx` ou `390xx`), com tratamento especial para a GTX 745 (que é Maxwell, não Kepler)
- **Verificação de RPM Fusion** — avisa se o repositório não está ativo antes de tentar instalar drivers que dependem dele
- **Verificação de Secure Boot** — avisa se está ativo e o driver NVIDIA precisará de assinatura MOK

## 🖥️ Desktops suportados

GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3 e outros tiling WMs.

A autenticação via `pkexec` funciona em todos — o diálogo de senha é gerido pelo agente polkit do desktop em uso.

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

## 📄 Licença

**GPL-3.0** — veja [LICENSE](LICENSE).

## 👤 Autor

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Agradecimentos

[![Fedora Project](https://img.shields.io/badge/Fedora-Project-294172?style=flat-square&logo=fedora&logoColor=white)](https://getfedora.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://www.deepseek.com/)

**Feito com ❤️ para a comunidade Fedora**
