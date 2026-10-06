# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Language:** [Português (BR)](README.md) | English | [Español](README.es.md)

![Version](https://img.shields.io/badge/Version-v1.0.0--10062026-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44+-294172?style=flat-square&logo=fedora)
![License](https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square)
![Languages](https://img.shields.io/badge/Languages-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Getting your Fedora ready to "play" — visual, fast, no terminal.

## 🚀 Installation

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
```

**Commands available after installing:**

```bash
fap                       # Launch (normal mode)
fap-compat                # Launch (compatibility mode — older GPUs)
./install.sh --update     # Update
./install.sh --uninstall  # Uninstall
```

## 📖 About

Visual automation panel for Fedora Linux. Turns a clean installation into a complete system — codecs, drivers, repositories, tools — through clicks, without opening the terminal.

**Single entry point**: the **"Start"** button walks you through the 14 sessions step by step. Each button remembers its own state. Closing and reopening FAP shows exactly where you stopped.

## ✨ Sessions

| # | Session | What it does |
|---|---|---|
| 1 | 🚀 First Steps | System update, RPM Fusion, Flathub |
| 2 | 🔤 Codecs | Multimedia codecs, commercial DVD, MS fonts |
| 3 | 🖥️ Hardware | AMD/NVIDIA/Intel drivers, CoreCtrl, LACT, overclock |
| 4 | 🔌 Devices | Auto-detection, COPRs, controllers, firmware |
| 5 | 🎬 Media Production | OBS Studio, virtual camera, EasyEffects |
| 6 | 📦 Recommended Apps | ~45 Flatpak apps (productivity, media, graphics, internet) + Remote Access Tools |
| 7 | 🏠 Home and Office | CUPS, Samba, LocalSend, KeePassXC, OCR |
| 8 | 🎮 Gaming | Native Steam, Heroic, Lutris, Wine, GameMode, Gamescope Session, emulators |
| 9 | 📱 Waydroid | Android on Linux via container |
| 10 | 🖥️ Virtualization | QEMU/KVM, VirtualBox, GNOME Boxes |
| 11 | 📊 Diagnostics | System panel, disk health, temperatures |
| 12 | 🛠️ Tunings and Maintenance | Performance tunings, DNF, GRUB, kernels |
| 13 | 🐧 Fedora Status | Version, Atomic/Silverblue, SELinux |
| 14 | 📖 About FAP | Update/uninstall, dynamic changelog |

## 🎨 Highlights

- **Dark/light theme** with real-time toggle
- **Multilingual** (PT-BR, EN, ES) with real-time switching
- **Real-time logs** via SSE
- **Unified trash icon** for Flatpaks and non-Flatpak apps
- **"Open" button** on every GUI app — launches in its own session (survives FAP closing)
- **Native Steam** via RPM Fusion — required for the Gamescope session
- **Official Gamescope Session** — launcher and `.desktop` created following the Fedora Docs recipe, with `TryExec` (plasmalogin-compatible), dynamic resolution detection and a diagnostic log
- **Remote Access Tools** — RustDesk, Remmina, GNOME Connections and KRDC, with automatic desktop detection to hide the "Install" button when the native app is already present
- **Install queue** for Flatpaks — click on multiple in sequence
- **Smart lock** — prevents `rpm` lock conflicts
- **Automatic hardware detection** — GPUs, Wi-Fi, Ethernet
- **Detection of externally installed apps** — recognized on session load
- **Native WebKitGTK container** (no external browser)
- **Secure authentication** via pkexec/kdesu

## 🖥️ Supported Desktops

GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3 and other tiling WMs.

## 📄 License

**GPL-3.0** — see [LICENSE](LICENSE).

## 👤 Author

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Acknowledgments

[Fedora Project](https://getfedora.org/) · [RPM Fusion](https://rpmfusion.org/) · [Flathub](https://flathub.org/)

**Made with ❤️ for the Fedora community**
