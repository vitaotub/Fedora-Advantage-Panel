# <img src="icone_app.png" width="55" align="center"> Fedora Only Fans (FOF)

**🌐 Language:** [Português (BR)](README.md) | English | [Español](README.es.md)

![Version](https://img.shields.io/badge/Version-v1.0.0--09282026-orange?style=flat-square)
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

FOF has a **single entry point**: the **"Start"** button, which takes you through the 12 sessions step by step, in logical order. Each session groups related tasks, and progress is saved automatically.

Each button remembers its own state. Closing and reopening FOF (or rebooting) always shows exactly where you stopped.

---

## ✨ Setup Sessions

| # | Session | What it does |
|---|---|---|
| 1 | 🚀 First Steps | Full system upgrade + RPM Fusion + Flathub |
| 2 | 🔤 Codecs and Compatibility | Multimedia codecs, commercial DVD playback (tainted), Microsoft fonts |
| 3 | 🖥️ Hardware | AMD (Vulkan/Mesa/RADV, VA-API, CoreCtrl, LACT, overclock), NVIDIA (proprietary driver, modeset), controllers (input group) |
| 4 | 🎬 Media Production | OBS Studio, EasyEffects, streaming, qpwgraph, HandBrake, wf-recorder |
| 5 | 📦 Recommended Apps | ~45 apps via Flatpak (productivity, media, graphics, internet, video/audio editing, cloud) |
| 6 | 🏠 Home and Office | CUPS, Samba/LocalSend/Warpinator, KeePassXC, Okular+Tesseract (PDF+OCR) |
| 7 | 🎮 Gaming | Launchers, Wine/Proton/NTSYNC, GameMode/MangoHud/Gamescope, ProtonUp-Qt, vkBasalt, emulators, anti-cheat awareness |
| 8 | 📱 Waydroid | Android on Linux via COPR, GApps, libndk/libhoudini, Magisk, Widevine, SmartDock |
| 9 | 📊 Diagnostics | System panel, top processes, partitions, GSmartControl, CoolerControl, journal, **tunings status** |
| 10 | 🛠️ Tunings and Maintenance | Performance tunings, audio adjustments, DNF, locale, dual-boot, cleanup, kernels, GRUB |
| 11 | 🐧 Fedora Status | Version, Atomic/Silverblue detection, SELinux (status, AVCs, setroubleshoot, GUI) |
| 12 | 📖 About FOF | About the project + update/uninstall FOF + dynamic changelog |

---

## 🎨 Features

- **Dark/light theme** — real-time toggle, saved preference
- **Multilingual** — PT-BR, EN, ES with real-time switching
- **Real-time logs** via SSE, expanded by default
- **Uninstall icon** next to each installed Flatpak app
- **External Flatpak removal detection** — if the user deletes the app outside FOF, the button reverts to its initial state
- **Global progress bar** in the header (N/M sessions completed)
- **Toasts + native notifications** on long tasks (>30s)
- **Secure authentication** via pkexec/kdesu with a read-only command whitelist
- **Dual persistence** — local server + localStorage
- **Automatic orphan ID cleanup** — renamed sessions don't leave leftovers in progress
- **Native WebKitGTK container** (no external browser)
- **Dynamic changelog** — read from `CHANGELOG.md` at runtime
- **Centralized version** in `package.json`

---

## 📂 Structure

```
Fedora-Only-Fans/
├── index.html                       # Landing page (single entry)
├── guiado.html                      # Step-by-step setup
├── style.css                        # Shared CSS
├── script.js                        # Shared JS (sessions, progress)
├── i18n.js                          # i18n module (PT-BR / EN / ES)
├── locales/
│   ├── en.json                      # EN translations
│   └── es.json                      # ES translations
│   # PT-BR has no file of its own — the HTML is the source
├── primeiros-passos.html            # Session 1
├── codecs.html                      # Session 2
├── hardware.html                    # Session 3
├── producao-multimidia.html         # Session 4
├── aplicativos.html                 # Session 5
├── casa-escritorio.html             # Session 6
├── gaming.html                      # Session 7
├── waydroid.html                    # Session 8
├── diagnostico.html                 # Session 9
├── ajustes-manutencao.html          # Session 10
├── estado-fedora.html               # Session 11
├── sobre-fof.html                   # Session 12
├── template-sessao.html             # Template for new sessions
├── CHANGELOG.md                     # Change history (read by FOF)
├── server.js                        # Node.js server + SSE + endpoints
├── iniciar_fof.sh                   # Startup script
├── iniciar_fof_compat.sh            # Compatibility mode
├── install.sh                       # Installer / uninstaller / updater
├── build-container.sh / Makefile    # Native container build
├── src/fof-container.c              # WebKitGTK container (C + GTK3)
├── package.json                     # Node deps + FOF version
├── icone_app.png                    # App icon
└── LICENSE                          # GPL-3.0
```

---

## 🛠️ Technologies

- **HTML5 / CSS3** — responsive UI, light/dark theme
- **Vanilla JavaScript** — local API requests, i18n, dashboard
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

The full change history is in [`CHANGELOG.md`](CHANGELOG.md). FOF itself displays the current version's changelog inside the **About FOF** session — loaded dynamically from the file.

### v1.0.0-09282026 (Current) 🚧

- Complete session restructuring (13 → 12), with semantic IDs (no numbers)
- New **Tunings and Maintenance** session groups performance tunings, audio adjustments, DNF, locale, dual-boot, cleanup, kernels and GRUB
- New **About FOF** session groups the institutional text, update and uninstall FOF
- Removed: **Restore** session (Btrfs-Assistant) and **Maintenance** page (content redistributed)
- Home screen redesigned: live clock and single card with text + "Start" button
- Global search (Ctrl+K) removed — it had issues with WebKitGTK
- Dynamic changelog via `GET /changelog`
- "View full changelog" button fixed (was using `window.open`, blocked by WebKitGTK)
- `install.sh --update` now cleans up old session files before `git pull`
- Progress automatically cleans orphan IDs at boot
- Update badge points to `guiado.html?session=sobre-fof`

### v1.0.0-09232026 ✅

- Automatic update check via GitHub Releases
- Post-update popup
- Uninstall icon on each Flatpak app
- External Flatpak removal detection
- "Performance Tunings" panel in Diagnostics

### v1.0.0 ✅

- Initial public release

---

## ➕ How to add a session

1. Copy `template-sessao.html` to `<name>.html` (no number)
2. Fill in the placeholders
3. Add an entry to the `SESSOES` array in `script.js` (with `id: '<name>'`)
4. Add the emoji to `ICONES_SESSOES` in `guiado.html`
5. Add the i18n keys to `locales/en.json` and `locales/es.json` (and to the HTML as PT-BR fallback)

Display order comes from the position of the entry in the `SESSOES` array, not the file name.

---

## 🌐 How to add a language

1. Copy `locales/en.json` to `locales/XX.json`
2. Translate the values (keep the keys)
3. Add `XX` to `LANGS_DISPONIVEIS` (`i18n.js`) and `LANGS_SUPORTADOS` (`server.js`)
4. Add the option to the `opcoes` array in `criarSeletorIdioma()`

**Note:** the default language (pt-BR) **has no JSON file** on purpose. Each session's HTML contains the Portuguese text as fallback, and `i18n.js` short-circuits when the language is the default — it never fires a `fetch` to `/locales/pt-BR.json`. This avoids maintaining duplicate strings.

---

## 🏷️ How to release a version

1. Edit `package.json` → `"version": "1.0.0-<NEW>"`
2. Edit `i18n.js` → `FALLBACK_VERSION = '1.0.0-<NEW>'` (the only exception to the single-source rule — used as a cache-buster before `/info` responds)
3. Add a new section at the top of `CHANGELOG.md`, with a header exactly `## v1.0.0-<NEW>` (matching `package.json`)
4. Create the tag/release on GitHub with the same name

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
