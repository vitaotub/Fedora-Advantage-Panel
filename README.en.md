# <img src="icone_app.png" width="55" align="center"> Fedora Only Fans (FOF)

**🌐 Language:** [Português (BR)](README.md) | English | [Español](README.es.md)

![Version](https://img.shields.io/badge/Version-v1.0.0--09302026-orange?style=flat-square)
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

FOF has a **single entry point**: the **"Start"** button, which takes you through the 13 sessions step by step, in logical order. Each session groups related tasks, and progress is saved automatically.

Each button remembers its own state. Closing and reopening FOF (or rebooting) always shows exactly where you stopped.

---

## ✨ Setup Sessions

| # | Session | What it does |
|---|---|---|
| 1 | 🚀 First Steps | Full system upgrade + RPM Fusion + Flathub + optional removal of the Fedora Flatpak repository |
| 2 | 🔤 Codecs and Compatibility | Multimedia codecs, commercial DVD playback (tainted), Microsoft fonts |
| 3 | 🖥️ Hardware | AMD (Vulkan/Mesa/RADV, VA-API, CoreCtrl, LACT, overclock), NVIDIA (proprietary driver, modeset), Intel (Intel Media Driver) |
| 4 | 🔌 Devices and Peripherals | Automatic hardware detection, additional firmware, community COPRs (Razer/OpenRazer, xpadneo, Broadcom), controllers (input group, udev rules) |
| 5 | 🎬 Media Production | OBS Studio, virtual camera, EasyEffects |
| 6 | 📦 Recommended Apps | ~45 apps via Flatpak (productivity, media, graphics, internet, video/audio editing, cloud) |
| 7 | 🏠 Home and Office | CUPS, Samba/LocalSend/Warpinator, KeePassXC, Okular+Tesseract (PDF+OCR) |
| 8 | 🎮 Gaming | Launchers, Wine/Proton/NTSYNC, GameMode/MangoHud/Gamescope, ProtonUp-Qt, vkBasalt, emulators, anti-cheat awareness |
| 9 | 📱 Waydroid | Android on Linux via COPR, GApps, libndk/libhoudini, Magisk, Widevine, SmartDock |
| 10 | 📊 Diagnostics | System panel, top processes, partitions, GSmartControl, CoolerControl, journal, tunings status |
| 11 | 🛠️ Tunings and Maintenance | Performance tunings, audio adjustments, DNF, locale, dual-boot, cleanup, kernels, GRUB |
| 12 | 🐧 Fedora Status | Version, Atomic/Silverblue detection, SELinux (status, AVCs, setroubleshoot, GUI) |
| 13 | 📖 About FOF | About the project + update/uninstall FOF + dynamic changelog |

---

## 🎨 Features

- **Dark/light theme** — real-time toggle, saved preference
- **Multilingual** — PT-BR, EN, ES with real-time switching
- **Real-time logs** via SSE, expanded by default
- **Consistent visual structure** — every session starts with a session info card, and content accordions are collapsed by default
- **Uninstall icon** next to each installed Flatpak app
- **External Flatpak removal detection** — if the user deletes the app outside FOF, the button reverts to its initial state
- **Automatic hardware detection** — `/hardware-scan` endpoint cross-references PCI/USB IDs with `hardware_map.json` and suggests drivers
- **Multi-desktop support** — works on GNOME, KDE, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie and tiling WMs. The startup terminal follows the detected desktop
- **Consistent install/revert pairs** — the revert button starts disabled and only becomes clickable after the corresponding install runs
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
├── dispositivos-perifericos.html    # Session 4
├── producao-multimidia.html         # Session 5
├── aplicativos.html                 # Session 6
├── casa-escritorio.html             # Session 7
├── gaming.html                      # Session 8
├── waydroid.html                    # Session 9
├── diagnostico.html                 # Session 10
├── ajustes-manutencao.html          # Session 11
├── estado-fedora.html               # Session 12
├── sobre-fof.html                   # Session 13
├── template-sessao.html             # Template for new sessions
├── CHANGELOG.md                     # Change history (read by FOF)
├── server.js                        # Node.js server + SSE + endpoints
├── hardware-service.js              # Hardware detection (lspci/lsusb + rpm)
├── hardware_map.json                # Vendor map PCI/USB → packages
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

## 🖥️ Supported Desktops

FOF is desktop-agnostic — it was built to run on any Linux environment that follows the standard XDG stack.

| Desktop | Status | Notes |
|---|---|---|
| **KDE Plasma** | ✅ Tested | Auth via `kdesu`/`kdialog`; native terminal `konsole` |
| **GNOME** | ✅ Tested | Auth via `pkexec`+`zenity`; terminal `ptyxis`/`gnome-terminal` |
| **XFCE** | ✅ Works | Auth via `pkexec`+`zenity`; terminal `xfce4-terminal` |
| **Cinnamon** | ✅ Works | Auth via `pkexec`+`zenity` |
| **MATE** | ✅ Works | Auth via `pkexec`+`zenity` |
| **LXQt** | ✅ Works | Auth via `pkexec`+`kdialog` |
| **LXDE** | ✅ Works | Auth via `pkexec`+`zenity` |
| **Budgie** | ✅ Works | Auth via `pkexec`+`zenity` |
| **Sway / Hyprland / i3** | ✅ Works | Requires `$TERMINAL` set or a graphical terminal installed |

### What's automatic

- **Startup terminal** — `iniciar_fof.sh` detects your desktop via `XDG_CURRENT_DESKTOP` and prefers its native terminal.
- **Authentication** — `install.sh` automatically installs `zenity` if you have neither `kdialog` nor `zenity`.
- **Menu shortcut** — created at `~/.local/share/applications/`
- **Icon** — installed at `hicolor/256x256/apps/` named `fof-container`

### What's NOT automatic

- **Pinning to the taskbar.** FOF does **not** pin shortcuts automatically. Pin manually through your desktop's menu.

### Minimum requirements

- Fedora 43, 44 or 45 (tested on 44)
- Kernel with WebKitGTK 4.1 (every Fedora 40+ has it)
- `nodejs` >= 18 (`iniciar_fof.sh` installs it if missing)
- `zenity` **or** `kdialog` (for graphical authentication)

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
- **Chain rejection** in no-auth commands (`;`, `` ` ``, `|`, `$(`, `&&`)
- **Input sanitization** and `idComando` validation
- **Rate limiting** 1.5s per `idComando`
- **Automatic log rotation** (7 days in `/tmp/fof-*.log`)

---

## 🎯 Changelog

The full history is available in the [GitHub releases](https://github.com/vitaotek/Fedora-Only-Fans/releases). FOF also displays the changelog for the current version inside the **About FOF** session, loaded dynamically from `CHANGELOG.md`.

### v1.0.0-09302026 (Current) 🚧

- **Visual standardization across sessions** — every session starts with a session info card (blue rectangle with ℹ️, always visible, no collapse toggle). All content accordions are collapsed by default.
- **Session-wide notices** (affecting the whole session) now appear outside the accordions, prominently, right below the title.
- **First Steps** — the three repository-related blocks (RPM Fusion, Flathub, Fedora Flatpak removal) were merged into a single accordion called **📦 Fedora Repositories**.
- **Media Production** — the two blocks (OBS Studio and EasyEffects) were merged into a single thematic accordion.
- **Waydroid** — the removal button was moved to the end of the session, renamed to "Undo Changes and Remove Completely", and now performs a complete cleanup (package, container, extras folder, venv, shortcuts, `/var/lib` data). Waydroid now survives closing FOF (started in its own session via `setsid -f`). The removal button is disabled when there's nothing to remove.
- **Home and Office** — fixed the missing `.sessao-container` wrapper.
- **Recommended Apps** — fixed six extra `</div>` tags that made the first block appear inside the session's main card.
- **`python3-pyqt6` removed from `install.sh`** — now installed on demand by the Affinity Suite button.
- **Removed `validar.sh`** and all references to it.

---

## ➕ How to add a session

1. Copy `template-sessao.html` to `<name>.html` (no number)
2. Fill in the placeholders
3. Add an entry to the `SESSOES` array in `script.js`
4. Add the emoji to `ICONES_SESSOES` in `guiado.html`
5. Add the i18n keys to `locales/en.json` and `locales/es.json`

Display order comes from the position of the entry in the `SESSOES` array.

---

## 🌐 How to add a language

1. Copy `locales/en.json` to `locales/XX.json`
2. Translate the values
3. Add `XX` to `LANGS_DISPONIVEIS` (`i18n.js`) and `LANGS_SUPORTADOS` (`server.js`)
4. Add the option to the `opcoes` array in `criarSeletorIdioma()`

---

## 🏷️ How to release a version

1. Edit `package.json` → `"version": "1.0.0-<NEW>"`
2. Edit `i18n.js` → `FALLBACK_VERSION = '1.0.0-<NEW>'`
3. Replace `CHANGELOG.md` with the new version's section (full history stays on GitHub releases)
4. Create the tag/release on GitHub with the same name

---

## 🤝 Contributing

1. Fork → branch → commit → push → Pull Request

## 🐛 Bug reports

Open an issue at [github.com/vitaotek/Fedora-Only-Fans/issues](https://github.com/vitaotek/Fedora-Only-Fans/issues)

## ⚠️ Legal notice

Project in development (alpha). **Always back up** before making system changes.

## 📄 License

**GPL-3.0** — see [LICENSE](LICENSE).

## 👤 Author

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Acknowledgments

[Fedora Project](https://getfedora.org/) · [RPM Fusion](https://rpmfusion.org/) · [Flathub](https://flathub.org/)

**Made with ❤️ for the Fedora community**
