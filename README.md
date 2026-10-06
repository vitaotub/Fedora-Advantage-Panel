# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Idioma:** Português (BR) | [English](README.en.md) | [Español](README.es.md)

![Versão](https://img.shields.io/badge/Vers%C3%A3o-v1.0.0--10062026.b-orange?style=flat-square)
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

Painel de automação visual para Fedora Linux. Transforma uma instalação limpa em um sistema completo — codecs, drivers, repositórios, ferramentas — através de cliques, sem abrir o terminal.

**Um único ponto de entrada**: o botão **"Iniciar"** leva você pelas 14 sessões passo a passo. Cada botão lembra seu próprio estado. Fechar e reabrir o FAP mostra exatamente onde você parou.

## ✨ Sessões

| # | Sessão | O que faz |
|---|---|---|
| 1 | 🚀 Primeiros Passos | Atualização do sistema, RPM Fusion, Flathub, Terra |
| 2 | 🔤 Codecs | Codecs multimídia, DVD comercial, fontes MS |
| 3 | 🖥️ Hardware | Drivers AMD/NVIDIA/Intel, CoreCtrl, LACT, overclock |
| 4 | 🔌 Dispositivos | Detecção automática, COPRs, controles, firmwares |
| 5 | 🎬 Produção Multimídia | OBS Studio, câmera virtual, EasyEffects |
| 6 | 📦 Aplicativos | ~45 apps Flatpak + Suíte ArtCraft (7 apps Rust) + Ferramentas de Acesso Remoto |
| 7 | 🏠 Casa e Escritório | CUPS, Samba, LocalSend, KeePassXC, OCR |
| 8 | 🎮 Gaming | Steam nativo, Heroic, Lutris, Wine, GameMode, Gamescope Session, emuladores |
| 9 | 📱 Waydroid | Android no Linux via container |
| 10 | 🖥️ Virtualização | QEMU/KVM, VirtualBox, GNOME Boxes |
| 11 | 📊 Diagnóstico | Painel do sistema, saúde de disco, temperaturas |
| 12 | 🛠️ Ajustes e Manutenção | Tunings de performance, DNF, GRUB, kernels |
| 13 | 🐧 Estado do Fedora | Versão, Atomic/Silverblue, SELinux |
| 14 | 📖 Sobre o FAP | Atualizar/desinstalar, changelog dinâmico |

## 🎨 Destaques

- **Interface escura/clara** com troca em tempo real
- **Multilíngue** (PT-BR, EN, ES) com troca em tempo real
- **Logs em tempo real** via SSE
- **Lixeira unificada** para Flatpaks e apps não-Flatpak
- **Botão "Abrir"** em todos os apps GUI — abre em sessão própria (sobrevive ao fechar o FAP)
- **Steam nativo** via RPM Fusion — necessário para a sessão Gamescope
- **Sessão Gamescope oficial** — launcher e `.desktop` criados conforme a receita do Fedora Docs, com `TryExec` (compatível com plasmalogin), detecção dinâmica de resolução e log de diagnóstico em `/tmp/fap-gamescope-session.log`. Aviso não-bloqueante se o Steam nativo não estiver presente.
- **Suíte ArtCraft** — 7 apps de criação (PhotoCraft, VectorCraft, FilmCraft, LightCraft, PrintCraft, EffectCraft, DesignCraft) desenvolvidos em Rust, open source, com botões que baixam sempre o RPM `.x86_64` mais recente direto do GitHub Releases de cada projeto
- **Ferramentas de Acesso Remoto** — RustDesk, Remmina, GNOME Connections e KRDC, com detecção automática do desktop para esconder o botão "Instalar" quando o app nativo já está presente
- **Terra Repository** — repositório comunitário que complementa o RPM Fusion, habilitável em um clique
- **Fila de instalação** de Flatpaks — clique em vários em sequência
- **Bloqueio inteligente** — evita conflitos de lock no `rpm` e bloqueia navegação entre sessões durante execução
- **Detecção automática de hardware** — GPUs, Wi-Fi, Ethernet
- **Detecção de apps instalados por fora** — reconhecidos ao carregar a sessão
- **Container WebKitGTK nativo** (sem navegador externo)
- **Autenticação segura** via pkexec/kdesu

## 🖥️ Desktops suportados

GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3 e outros tiling WMs.

## 📄 Licença

**GPL-3.0** — veja [LICENSE](LICENSE).

## 👤 Autor

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Agradecimentos

[![Fedora Project](https://img.shields.io/badge/Fedora-Project-294172?style=flat-square&logo=fedora&logoColor=white)](https://getfedora.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://www.deepseek.com/)

**Feito com ❤️ para a comunidade Fedora**
