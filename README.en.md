# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Language:** [Português (BR)](README.md) | English | [Español](README.es.md)

![Version](https://img.shields.io/badge/Version-v1.2.1--10212026-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44%20%7C%2045-294172?style=flat-square&logo=fedora)
![License](https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square)
![Languages](https://img.shields.io/badge/Languages-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Getting your Fedora ready to "play" — visual, fast, no terminal.

## 📖 What it is

**Fedora Advantage Panel (FAP)** is a visual automation panel for Fedora Linux. It turns a clean installation into a complete system — codecs, drivers, repositories, tools — through clicks, without opening the terminal.

A single button, **Start Setup**, walks you through **14 guided sessions** step by step. Each button remembers its own state: close FAP, reopen it, and it shows exactly where you stopped.

## 📸 Screenshots

### Landing page — your Fedora at a glance

![FAP landing page](prints/01-landing.png)

On boot, FAP queries the real system state (active repositories, installed apps, applied tunings) and shows **4 progress bars** — General use, Gaming, Production and Security. The line below summarizes it: *"{n} steps left to get Fedora ready."* When everything is done, it becomes *"Your Fedora is ready. 🎉"*.

### Lateral navigation + search

![FAP sidebar](prints/02-sidebar.png)

Collapsible sidebar with the 14 sessions, each with icon, name and progress indicator (`●` done, `◐` partial, `○` not started, `⊘` N/A). It has **global search** — type "vlc" or "steam" and the sidebar filters both sessions and inner items. Click a result and the session opens already filtered.

In collapsed mode, each icon gets its own **neon effect** on hover, for quick session identification.

### Package origin, filters and badges

![FAP filters and origin badges](prints/03-filtros.png)

Each app shows where it comes from — **Flathub, Fedora, RPM Fusion, Vendor, Download or Community**. Each origin has a distinct color (blue, red, orange, violet, amber, cyan) for quick identification. Hover anywhere on the button and the tooltip shows the origin; click the colored badge to open a popover with the **exact command**, **how to update** and **how to remove**.

Combinable filters (state + origin) let you see only what's done, only what's missing, only pre-existing items (installed before FAP), or only skipped ones.

### Real-time log with Matrix theme

![FAP real-time log](prints/04-log.png)

Everything FAP does passes through a **fixed terminal at the bottom**, with colors distinguishing normal output, success and real error. The log starts collapsed (click the `[▲/▼]` toggle to expand) and follows the sidebar when it collapses.

## 🎯 Who it's for

- **Those starting with Fedora** who want it ready for daily use (codecs, repositories, apps) without searching through 20 tutorials.
- **Those coming from Ubuntu/Mint** who want the same fluid initial setup experience.
- **Linux gamers** who want Steam, Heroic, Lutris, Proton, MangoHud and similar up and running fast.
- **Long-time Fedora users** who want to automate post-install (drivers, COPRs, kernel tunings).
- **Anyone setting up someone else's PC** (family, friends) without the terminal.

## 🚀 Installation

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
```

**Commands after installing:**

```bash
fap              # launch FAP
fap-compat       # compatibility mode (older GPUs, VMs)
fap --update     # update (or click the badge inside FAP)
fap --uninstall  # uninstall
```

Updates are applied **on top of the existing installation** — no need to uninstall between versions. Progress, theme and language are preserved.

## ✨ The 14 Sessions

| # | Session | What it does |
|---|---|---|
| 1 | 🚀 First Steps | System update, RPM Fusion, Flathub, Terra Repository (with warnings about optional subrepositories) |
| 2 | 🔤 Codecs | Complete multimedia codecs, commercial DVD, Microsoft fonts |
| 3 | 🖥️ Hardware | AMD/NVIDIA/Intel drivers, CoreCtrl, LACT, GPU overclocking |
| 4 | 🔌 Devices | Automatic hardware detection, community COPR drivers, controllers, firmware |
| 5 | 🎬 Media Production | OBS Studio, virtual camera, EasyEffects |
| 6 | 📦 Apps | Curated Flatpaks, 20+ `dnf` apps, browsers via official RPM, **ArtCraft Suite (13 apps)** and remote access tools |
| 7 | 🏠 Home and Office | CUPS, Samba, LocalSend, KeePassXC |
| 8 | 🎮 Gaming | Native Steam, Heroic (Flatpak), Lutris, Wine, GameMode, emulators |
| 9 | 📱 Waydroid | Android on Linux via container |
| 10 | 🖥️ Virtualization | QEMU/KVM, VirtualBox, GNOME Boxes |
| 11 | 📊 Diagnostics | System panel, disk health (SMART), temperatures, error journal |
| 12 | 🛠️ Tunings and Maintenance | Performance and audio tunings, DNF, dual-boot, interactive GRUB configuration, kernels |
| 13 | 🐧 Fedora Status | Version, Atomic/Silverblue detection, SELinux management |
| 14 | 📖 About FAP | Update/uninstall, dynamic changelog, change history |

## 🛡️ Safety and transparency

- **Never installs anything without you seeing it.** Every command is visible in the real-time log.
- **Pre-existing detection.** If you already had VLC, Steam or the NVIDIA driver before FAP, the button shows "Open" from the start, with a tooltip explaining the origin.
- **13 critical items protected.** Drivers, codecs, CUPS, Samba, virtualization: if they existed before FAP, the trash icon does not appear.
- **Real language detection.** The 3 translation buttons query the system state — if already applied, they show "✅ Already active".
- **Authentication via `pkexec`.** Native password dialog from your desktop.
- **Smart locking.** While a `dnf` command is running, other `dnf` buttons from other sessions are locked. The Flatpak queue handles the global lock.
- **Native WebKitGTK container.** Own interface. Compatibility mode (`fap-compat`) for older GPUs.
- **`install.sh` refuses to run as root.** Installs into `~/.local/share`.

## 🎨 Interface Features (v1.2)

- **High-contrast black/gray theme** in dark; light theme keeps the Fedora blues.
- **Collapsible lateral sidebar** with monochrome SVG icons and **per-session neon effect** in collapsed mode.
- **Global search** with an index built in the background at boot — covers all 14 sessions.
- **Origin badges** (6 variants with distinct colors) with tooltip on the entire button and popover.
- **Combinable filters** (state + origin) in session 6, always in two rows.
- **Status card on landing** with 4 bars computed at boot.
- **Fixed log dock** of 160px, always starts collapsed.
- **N/A sessions** removed from the progress calculation.
- **🔄 header button** that reloads the system state without closing FAP.

### 🔒 Protection of critical items

**13 high-risk items** have removal blocked when pre-existing. The button shows "✅ Already active" with a tooltip including the exact manual revert command.

## 🖥️ Requirements and support

- **Fedora 44 or 45** (developed and extensively tested on both).
- **GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3** and other tiling WMs.
- **PT-BR, EN and ES.** Switchable in the FAP header.

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

## 🐛 Feedback, bugs and suggestions

FAP is an open-source project (GPL-3.0), maintained by **VitãoTub** in his spare time.

- **Bugs:** open an [issue](https://github.com/vitaotub/Fedora-Advantage-Panel/issues) with the output of `/tmp/fap-*.log` (if possible) and the Fedora version.
- **Suggestions:** also via issue.
- **Screenshots:** if something looks odd, a print helps a lot.

## 📄 License

**GPL-3.0** — see [LICENSE](LICENSE).

## 👤 Author

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Acknowledgments

[![Fedora Project](https://img.shields.io/badge/Fedora-Project-294172?style=flat-square&logo=fedora&logoColor=white)](https://getfedora.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://www.deepseek.com/)

**Made with ❤️ for the Fedora community**
