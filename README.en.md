# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Language:** [Português (BR)](README.md) | English | [Español](README.es.md)

![Version](https://img.shields.io/badge/Version-v1.0.0--10152026.b-orange?style=flat-square)
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

Fedora Advantage Panel (FAP) is a visual automation panel for Fedora Linux. It turns a clean installation into a complete system — codecs, drivers, repositories, tools — through clicks, without opening the terminal.

**Single entry point.** The **"Start"** button walks you through 14 guided sessions step by step. Each button remembers its own state. Closing and reopening FAP shows exactly where you stopped.

## ✨ The 14 Sessions

| # | Session | What it does |
|---|---|---|
| 1 | 🚀 First Steps | System update, RPM Fusion, Flathub, Terra Repository (with warnings about optional subrepositories) |
| 2 | 🔤 Codecs | Complete multimedia codecs (official RPM Fusion `multimedia` group), commercial DVD, Microsoft fonts |
| 3 | 🖥️ Hardware | AMD/NVIDIA/Intel drivers, CoreCtrl, LACT, GPU overclocking |
| 4 | 🔌 Devices | Automatic hardware detection, community COPR drivers, controllers, firmware |
| 5 | 🎬 Media Production | OBS Studio, virtual camera, EasyEffects |
| 6 | 📦 Apps | Curated Flatpaks, 20+ `dnf` apps, browsers via official RPM, **ArtCraft Suite (13 apps)** and remote access tools |
| 7 | 🏠 Home and Office | CUPS, Samba, LocalSend, KeePassXC, OCR (Okular + Tesseract) |
| 8 | 🎮 Gaming | Native Steam, Heroic (official RPM), Lutris, Wine, GameMode, Gamescope Session, emulators |
| 9 | 📱 Waydroid | Android on Linux via container |
| 10 | 🖥️ Virtualization | QEMU/KVM, VirtualBox, GNOME Boxes |
| 11 | 📊 Diagnostics | System panel, disk health (SMART), temperatures, error journal |
| 12 | 🛠️ Tunings and Maintenance | Performance tunings, DNF, interactive GRUB configuration, kernels |
| 13 | 🐧 Fedora Status | Version, Atomic/Silverblue detection, SELinux management |
| 14 | 📖 About FAP | Update/uninstall, dynamic changelog, change history |

## 🎨 Features

### Interface and usability

- **Dark and light interface** with real-time toggle, no page reload
- **Multilingual** (PT-BR, EN, ES) with a header selector
- **Real-time logs** per command, with colors distinguishing normal output, success, and real errors
- **Smart lock** — prevents `rpm` lock conflicts and freezes session navigation while a command is running
- **Resumable session** — each button remembers its state in `.progresso.json`; close and reopen shows where you stopped

### App installation

- **Unified trash icon** — every installable app has a removal icon next to it, which removes the package and, when applicable, disables the source repository
- **Origin by app type** — FAP automatically picks the best install method:
  - **Flatpak (Flathub)** — when there's no official Fedora repo nor package in the distro repos
  - **`dnf` (official Fedora repos or RPM Fusion)** — when the distro packages the software
  - **RPM via vendor's official repo** — when the vendor ships for Fedora (browsers, Heroic)
  - **RPM downloaded from URL** — when that's the only option. Supports both a static URL (OnlyOffice) and a URL resolved at runtime via the GitHub API (ArtCraft Suite, RustDesk, Lightworks, Rclone Manager). `--setopt=localpkg_gpgcheck=0` required on Fedora 44/45
- **Flatpak queue** — clicking on multiple apps in sequence enqueues and installs them one at a time, avoiding Flathub lock errors
- **"Open" button** on all GUI apps — launches in its own session, surviving FAP closing
- **Detection of externally installed apps** — if you already have an app installed before FAP, the button appears as "Open" from the start
- **Smart codec removal** — the trash icon for codecs swaps `ffmpeg` back to `ffmpeg-free` and reinstalls base Fedora plugins, instead of leaving the system without any codecs

### Native WebKitGTK container

- **Own interface**, no dependency on external browsers
- **Native container in WebKitGTK 4.1 + GTK3**, compiled at install time
- **Compatibility mode** (`fap-compat`) for GPUs without 3D acceleration — forces software rendering via Mesa/llvmpipe
- **No annoying popups** — Chromium EULA suppressed and WebKit permissions (geolocation, camera, microphone) automatically denied

### Authentication and security

- **Universal `pkexec`** — integrated password dialog on all desktops (KDE uses `polkit-kde-agent`, GNOME uses `polkit-gnome`, etc.), no need to type the password in the terminal
- **Read-only commands in whitelist** — `rpm -q`, `uname -r`, `gtk-launch`, `flatpak`, `systemctl --user` and similar run without asking for a password
- **FAP update and uninstall run as the user**, with `SUDO_ASKPASS` (zenity/kdialog) for internal privileged steps — avoids files ending up owned by root
- **Shell injection blocking** — commands with `;`, `&&`, `|`, `$(...)` or `&` are rejected by the whitelist and require authentication

### Lifecycle

- **Clean shutdown** — closing the FAP window ends the Node.js server and frees port 3000 automatically. Nothing is left in memory.
- **Protected process tree** — if a `dnf` command is running when FAP closes, the entire process tree is killed via PGID, avoiding orphan locks on `rpm`
- **Persistent log** — each session writes a `/tmp/fap-YYYYMMDD-HHMMSS.log` file, with automatic cleanup of logs older than 7 days
- **`install.sh` refuses to run as root** — installs into the user's `$HOME`, with internal `sudo` only for the steps that need it

### ArtCraft Suite

Open-source alternatives (written in Rust) to Adobe and Microsoft Office products. Each app has its own GitHub repository and its `.x86_64` RPM in the latest release — FAP resolves the URL at runtime, always downloading the latest published version:

- 🖼️ **PhotoCraft** — photo editing
- ✏️ **VectorCraft** — vector illustration
- 🎬 **FilmCraft** — video editing
- 💡 **LightCraft** — 3D lighting
- 📄 **PDFCraft** — PDF editing
- ✨ **EffectCraft** — visual effects
- 🎨 **DesignCraft** — graphic design
- 🖌️ **FigCraft** — vectors and illustration
- 📽️ **DeckCraft** — presentations
- 📊 **GridCraft** — spreadsheets
- 📝 **WordCraft** — text editor
- 📐 **CadCraft** — CAD
- 🔊 **SoundCraft** — audio editing

### Automatic hardware detection

- **Hardware scanner** via `lspci` / `lsusb`, cross-referenced with a community-maintained vendor map
- **NVIDIA detection** with heuristics to suggest the correct driver series (`akmod-nvidia`, `580xx`, `470xx`, or `390xx`), with special handling for the GTX 745 (which is Maxwell, not Kepler)
- **RPM Fusion check** — warns if the repository isn't active before trying to install drivers that depend on it
- **Secure Boot check** — warns if it's enabled and the NVIDIA driver will need MOK signing

## 🖥️ Supported Desktops

GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3 and other tiling WMs.

The `pkexec` authentication works on all of them — the password dialog is managed by the desktop's polkit agent.

## 🔄 Update and uninstall

**Update:**
```bash
./install.sh --update
```
Or click the update badge (appears automatically when a new version is on GitHub) or use the button in the **About FAP** session.

**Uninstall:**
```bash
./install.sh --uninstall
```
Or use the button in the **About FAP** session (with double confirmation).

## 📄 License

**GPL-3.0** — see [LICENSE](LICENSE).

## 👤 Author

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Acknowledgments

[![Fedora Project](https://img.shields.io/badge/Fedora-Project-294172?style=flat-square&logo=fedora&logoColor=white)](https://getfedora.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://www.deepseek.com/)

**Made with ❤️ for the Fedora community**
