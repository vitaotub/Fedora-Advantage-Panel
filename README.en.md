# <img src="icone_app.png" width="55" align="center"> Fedora Only Fans (FOF)

**🌐 Language:** [Português (BR)](README.md) | English | [Español](README.es.md)

![Version](https://img.shields.io/badge/Version-v1.0.0--09272026-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44+-294172?style=flat-square&logo=fedora)
![License](https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square)
![Languages](https://img.shields.io/badge/Languages-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Getting your Fedora ready to "play" — visual, fast, no terminal.

---

## 🚀 Installation

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotek/Fedora-Only-Fans/main/install.sh)
```

## 📦 Commands

```bash
fof                                 # Launch (normal mode)
fof-compat                          # Launch (compatibility mode — older GPUs)
# Update:     pass --update to install.sh
# Uninstall:  pass --uninstall to install.sh
```

---

## 📖 About

**Fedora Only Fans (FOF)** is a visual automation panel for Fedora Linux. It turns a clean installation into a complete system — codecs, drivers, repositories, tools — through clicks, without opening the terminal.

FOF has **two entry points**:

- **🧭 Start Setup** — step by step, one session at a time, with Previous/Next navigation and a fixed menu at the top. The order matters for the end result.
- **🛠️ Maintenance** — standalone tasks that don't depend on order: cleanup, kernels, GRUB, update and uninstall FOF.

Each button remembers its own state. Closing and reopening FOF (or rebooting) always shows exactly where you stopped.

---

## ✨ Setup Sessions

| # | Session | What it does |
|---|---|---|
| 1 | 👋 Welcome | Introduction + full `dnf upgrade --refresh` |
| 2 | ⚙️ Optimization | Parallel DNF, PT-BR locale, dual-boot, **performance tunings** (`vm.max_map_count`, `swappiness`/`vfs_cache_pressure`, TCP BBR) |
| 3 | 📦 Repositories | RPM Fusion (free + nonfree), Flathub |
| 4 | 🔤 Codecs and Compatibility | Multimedia codecs, commercial DVD playback (tainted), Microsoft fonts |
| 5 | 🖥️ Hardware | AMD (Vulkan/Mesa/RADV, VA-API, CoreCtrl, LACT, overclock), NVIDIA (proprietary driver, modeset), controllers (input group) |
| 6 | 🎮 Gaming | Launchers, Wine/Proton/NTSYNC, GameMode/MangoHud/Gamescope, ProtonUp-Qt, vkBasalt, emulators, bufferbloat, anti-cheat awareness, Flatpak updates |
| 7 | 🎬 Media Production | OBS Studio, EasyEffects, **realtime-setup**, **PipeWire low latency**, streaming, qpwgraph, HandBrake, wf-recorder |
| 8 | 📱 Waydroid | Android on Linux via COPR, GApps, libndk/libhoudini, Magisk, Widevine, SmartDock, waydroid-helper |
| 9 | 📦 Recommended Apps | ~45 apps via Flatpak (productivity, media, graphics, internet, video/audio editing, cloud) |
| 10 | 🏠 Home Ready | CUPS, Samba/LocalSend/Warpinator, KeePassXC, Okular+Tesseract (PDF+OCR) |
| 11 | 📊 Diagnostics | System panel, top processes, partitions, Baobab, GSmartControl, CoolerControl, journal, **tunings status** |
| 12 | 🐧 Fedora | Version, Atomic/Silverblue detection, SELinux (status, AVCs, setroubleshoot, GUI) |

## 🛠️ Maintenance

- **Fedora** — cache cleanup, kernel management, GRUB configuration
- **FOF** — update, uninstall, changelog

---

## 🎨 Features

- **Dark/light theme** — real-time toggle, saved preference
- **Multilingual** — PT-BR, EN, ES with real-time switching
- **Real-time logs** via SSE, expanded by default
- **Global search (Ctrl+K)** on any page
- **Uninstall icon** next to each installed Flatpak app
- **External Flatpak removal detection** — if the user deletes the app outside FOF, the button reverts to its initial state
- **Global progress bar** in the header (N/M sessions completed)
- **Toasts + native notifications** on long tasks (>30s)
- **Secure authentication** via pkexec/kdesu with a read-only command whitelist
- **Dual persistence** — local server + localStorage
- **Native WebKitGTK container** (no external browser)
- **Centralized version** in `package.json`

---

## 📂 Structure

```
Fedora-Only-Fans/
├── index.html                       # Landing page (mode selection)
├── guiado.html                      # Step-by-step setup
├── manutencao.html                  # Maintenance (Fedora + FOF)
├── style.css                        # Shared CSS
├── script.js                        # Shared JS (sessions, progress, search)
├── i18n.js                          # i18n module (PT-BR / EN / ES)
├── locales/
│   ├── pt-BR.json                   # Translations (default)
│   ├── en.json                      # EN translations
│   └── es.json                      # ES translations
├── 00-boas-vindas.html              # Session 1
├── 01-restauracao.html              # Session 2
├── 02-otimizacao.html               # Session 3
├── 03-repositorios.html             # Session 4
├── 04-codecs-compatibilidade.html   # Session 5
├── 05-hardware.html                 # Session 6
├── 06-gaming.html                   # Session 7
├── 07-loja.html                     # Session 8
├── 08-waydroid.html                 # Session 9
├── 09-softwares-uteis.html          # Session 10
├── 10-casa-pronta.html              # Session 11
├── 11-diagnostico.html              # Session 12
├── 12-fedora.html                   # Session 13
├── template-sessao.html             # Template for new sessions
├── server.js                        # Node.js server + SSE
├── iniciar_fof.sh                   # Startup script
├── iniciar_fof_compat.sh            # Compatibility mode
├── install.sh                       # Installer / uninstaller
├── build-container.sh / Makefile    # Native container build
├── src/fof-container.c              # WebKitGTK container (C + GTK3)
├── package.json                     # Node deps + FOF version
├── icone_app.png                    # App icon
└── LICENSE                          # GPL-3.0
```

---

## 🛠️ Technologies

- **HTML5 / CSS3** — responsive UI, light/dark theme
- **Vanilla JavaScript** — local API requests, i18n, global search, dashboard
- **Node.js** — local backend server, secure process execution
- **Server-Sent Events (SSE)** — real-time logs
- **Bash** — startup, installation
- **pkexec / kdesu** — secure authentication
- **WebKitGTK** — native container

---

## 🛡️ Security

- **pkexec/kdesu** authentication (never exposes passwords)
- **Whitelist** of read-only commands without authentication (`rpm -q`, `uname -r`, `flatpak`, `systemctl --user`, `gtk-launch`)
- **Input sanitization** and `idComando` validation
- **Rate limiting** 1.5s per `idComando`
- **Automatic log rotation** (7 days in `/tmp/fof-*.log`)

---

## 🎯 Changelog

### v1.0.0-09272026 (Current) 🚧

**Session restructuring**
- ✅ Session **04-codecs-compatibilidade** replaces `04-fontes.html` — groups codecs + tainted + MS fonts into a compatibility narrative
- ✅ Session **03-repositorios** streamlined (only RPM Fusion + Flathub)

**New performance tunings (all with apply/revert pairs)**
- ✅ Session 02: `vm.max_map_count`, `vm.swappiness` + `vfs_cache_pressure`, TCP BBR
- ✅ Session 07: `realtime-setup` (realtime group) and PipeWire low latency

**Gaming**
- ✅ NTSYNC now loads the module immediately + persists via `modules-load.d`
- ✅ New "Update Flatpak Apps" button (sessions 06 and 09)
- ✅ Educational warning about Gamescope + NVIDIA + Flatpak

**Flatpak apps**
- ✅ Uninstall (trash) icon next to each installed Flatpak app (sessions 06, 07, 09, 10)
- ✅ **External Flatpak removal detection** — button reverts to initial state automatically

**Diagnostics**
- ✅ New "Performance Tunings" panel (KSM, max_map_count, TCP BBR, PipeWire quantum)

**Backend**
- ✅ `systemctl --user` on the whitelist + generalized env context
- ✅ New `/flatpak-installed` endpoint
- ✅ `/system-info` extended with 5 new fields

### v1.0.0-09232026 ✅

- ✅ Automatic update check via GitHub Releases (⬆️ badge in the header)
- ✅ Post-update popup (warns to restart FOF)
- ✅ Session 00 reworked into 2 accordions
- ✅ Gaming session with detailed NTSYNC warning
- ✅ Session logs expanded by default; uniform height (120–200px)
- ✅ Header with inline controls next to title

### v1.0.0 (Future) 🔮

- □ ?

---

## ➕ How to add a session

1. Copy `template-sessao.html` to `NN-name.html`
2. Fill in the placeholders
3. Add an entry to the `SESSOES` array in `script.js`
4. (Optional) Add the icon to `ICONES_SESSOES` in `guiado.html`
5. (Optional) Add translations to the 3 locale JSONs

---

## 🌐 How to add a language

1. Copy `locales/pt-BR.json` to `locales/XX.json`
2. Translate the values (keep the keys)
3. Add `XX` to `LANGS_DISPONIVEIS` (`i18n.js`) and `LANGS_SUPORTADOS` (`server.js`)
4. Add the option to the `opcoes` array in `criarSeletorIdioma()`

---

## 🏷️ How to release a version

1. Edit `package.json` → `"version": "1.0.0-<NEW>"`
2. Edit `i18n.js` → `FALLBACK_VERSION = '1.0.0-<NEW>'` (the only exception to the single-source rule)
3. Create the tag/release on GitHub with the same name

Everything else (`install.sh` banner, FOF badge, container `--help`) is automatic.

---

## 🤝 Contributing

1. Fork → branch → commit → push → Pull Request

## 🐛 Bug reports

Open an issue at [github.com/vitaotek/Fedora-Only-Fans/issues](https://github.com/vitaotek/Fedora-Only-Fans/issues) with:
- Fedora version
- Desktop environment
- Logs (`/tmp/fof-*.log`)
- Steps to reproduce

## ⚠️ Legal notice

Project in development (alpha). Production use at your own risk. **Always back up** before making system changes.

## 📄 License

**GPL-3.0** — see [LICENSE](LICENSE).

## 👤 Author

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Acknowledgments

[Fedora Project](https://getfedora.org/) · [RPM Fusion](https://rpmfusion.org/) · [Flathub](https://flathub.org/)

**Made with ❤️ for the Fedora community**
