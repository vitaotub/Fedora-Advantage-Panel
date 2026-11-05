# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Language:** [Português (BR)](README.md) | English | [Español](README.es.md)

![Version](https://img.shields.io/badge/Version-v1.4.7--11052026-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44%20%7C%2045-294172?style=flat-square&logo=fedora)
![License](https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square)
![Languages](https://img.shields.io/badge/Languages-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Getting your Fedora ready to "play" — visual, fast, and without the terminal.

## 📖 What it is

The **Fedora Advantage Panel (FAP)** is a visual automation panel for Fedora Linux. It turns a clean installation into a complete system — codecs, drivers, repositories, tools — through clicks, without opening the terminal.

A single button, **Start Setup**, takes you through **13 guided sessions** step by step. Each button remembers its own state: close FAP, reopen it, and it shows exactly where you stopped.

## 📸 Screenshots

### Landing page — your Fedora at a glance

![FAP landing page](prints/01-landing.png)

Progress bars per group (General, Gaming, Production, Security), with the line *"N steps left to get Fedora ready."*

### Sidebar navigation + search

![FAP sidebar](prints/02-sidebar.png)

Collapsible sidebar with the 13 sessions, per-session progress indicator, and global search. In collapsed mode, each icon gets a neon effect on hover.

### Origin of each package, filters, and badges

![FAP filters and package origin](prints/03-filtros.png)

Every app shows where it comes from (Flathub, Fedora, RPM Fusion, Vendor, Download, or Community). Click the badge to see the exact command, how to update, and how to remove. Combinable filters (state + origin) in session 6.

### Real-time log with Matrix theme

![FAP real-time log](prints/04-log.png)

Fixed terminal at the bottom, with colors distinguishing normal output, success, and real errors. Starts collapsed.

## 🎯 Who it's for

- **Those migrating from Windows 10 or 11 to Fedora** who want a practical transition without the terminal.
- **Those starting out with Fedora** who want it ready for daily use.
- **Those coming from Ubuntu/Mint** who want the same fluidity of initial configuration.
- **Those gaming on Linux** who want Steam, Heroic, Lutris, Proton, MangoHud, and similar.
- **Those taking care of someone else's PC** (family, friends) without the terminal.

## 🚀 Installation

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
```

> **💡 Don't know how to run that command?**
>
> 1. **Copy the entire command** — select the text above and copy it.
> 2. **Open the terminal** — look for **"Terminal"** in the application menu. The `Ctrl+Alt+T` shortcut also works on most desktops.
> 3. **Paste the command** — `Ctrl+Shift+V` or right-click → **Paste**.
> 4. **Press `Enter`** — the installer will ask for your administrator password (the same one you use to log in). That's normal — it's asking permission to install system packages.
>
> When finished, open FAP by typing `fap` in the terminal or searching for **"Fedora Advantage Panel"** in the menu.

**Commands after installing:**

```bash
fap              # starts FAP
fap-compat       # compatibility mode (old GPUs, VMs)
```

To **update**: click the **update badge** (top of the home screen) or use the **"🔄 Update FAP"** button in the **About FAP** session.
To **uninstall**: use the **"🗑️ Uninstall FAP"** button in the **About FAP** session.

Updates are applied **on top of the existing installation** — progress, theme, and language are preserved.

## ✨ The 13 Sessions

| # | Session | What it does |
|---|---|---|
| 1 | 🚀 First Steps | Update, RPM Fusion, Flathub, Terra Repository |
| 2 | 🔤 Codecs | Full codecs, commercial DVD, Microsoft fonts |
| 3 | 🖥️ Hardware | AMD/NVIDIA/Intel drivers, CoreCtrl, LACT, overclock, VA-API |
| 4 | 🔌 Devices | Automatic detection, COPR network drivers, controllers, firmware |
| 5 | 🎬 Media Production | OBS Studio, virtual camera, EasyEffects |
| 6 | 📦 Apps | Flatpaks, 20+ `dnf` apps, ArtCraft, remote access, utilities |
| 7 | 🏠 Home and Office | CUPS, Samba, LocalSend, KeePassXC |
| 8 | 🎮 Gaming | Steam, Heroic, Lutris, Wine, GameMode, emulators, NTSYNC |
| 9 | 🖥️ Virtualization | QEMU/KVM, VirtualBox, GNOME Boxes |
| 10 | 📊 Diagnostics | System panel, SMART, temperatures, CoolerControl, journal |
| 11 | 🛠️ Tunings and Maintenance | Tunings, DNF, dual-boot, GRUB, kernels, **Fedora 44 → 45 upgrade**, **post-upgrade actions** |
| 12 | 🐧 Fedora Status | Version, Atomic/Silverblue, SELinux |
| 13 | 📖 About FAP | Update/uninstall, changelog |

**Session 11 in focus:** detects when Fedora 45 is available, downloads the packages, and reboots to upgrade. After the reboot, it shows the **post-upgrade actions recommended by the official Fedora documentation** — basic cleanup, `rpmconf`, `distro-sync`, SELinux relabel, rescue kernel regeneration. A checkbox "I already migrated to Fedora 45…" hides the area when you're done.

## 🛡️ Security and transparency

- **Never installs anything without you seeing it.** Every command is visible in the real-time log.
- **Pre-existence detection.** Apps installed before FAP appear as "Open" from the start.
- **Critical items protected.** Proprietary drivers, codecs, CUPS, Samba, virtualization: if they already existed, the trash icon doesn't appear.
- **Backup before overwriting.** GameMode + MangoHud presets back up the user's files before applying.
- **Authentication via `pkexec`.** Native desktop password dialog. The script to be executed is logged **before** pkexec opens — you see what you're authorizing.
- **File-based audit.** Every `pkexec` leaves a trail in `/tmp/fap-audit-*.log` (removed after 7 days).
- **Local CSRF protection.** The `/executar` endpoint rejects requests with a `Origin` from another host. A malicious page can't trigger FAP commands via `fetch(..., { mode: 'no-cors' })`.
- **Secure Boot aware.** When installing the NVIDIA driver with Secure Boot enabled, FAP guides the user through MOK enrollment (kmodgenca + mokutil) before installing — without it, the module wouldn't load.
- **Native WebKitGTK container.** Own interface, no dependence on Firefox/Chromium.
- **`install.sh` refuses to run as root.** Installs to `~/.local/share` and uses `sudo` only where needed.

## 🖥️ Requirements

- **Fedora 44 or 45.**
- **GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3** and other tiling WMs.
- **PT-BR, EN, and ES.**

## 🔄 Update and uninstall

```bash
./install.sh --update     # or click the badge inside FAP
./install.sh --uninstall  # or use the button in "About FAP"
```

## 🐛 Feedback

Open an [issue](https://github.com/vitaotub/Fedora-Advantage-Panel/issues) with the output of `/tmp/fap-*.log` and your Fedora version. Screenshots help a lot.

## 📄 License

**GPL-3.0** — see [LICENSE](LICENSE).

## 👤 Author

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Acknowledgments

[![Fedora Project](https://img.shields.io/badge/Fedora-Project-294172?style=flat-square&logo=fedora&logoColor=white)](https://getfedora.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://www.deepseek.com/)

**Made with ❤️ for the Fedora community**
