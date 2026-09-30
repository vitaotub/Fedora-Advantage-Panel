# <img src="icone_app.png" width="55" align="center"> Fedora Only Fans (FOF)

**🌐 Language:** [Português (BR)](README.md) | English | [Español](README.es.md)

![Version](https://img.shields.io/badge/Version-v1.0.0--09292026-orange?style=flat-square)
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
| 4 | 🔌 Devices and Peripherals | Automatic hardware detection, additional firmware, community COPRs (Realtek USB Wi-Fi), controllers (input group, udev rules) |
| 5 | 🎬 Media Production | OBS Studio, virtual camera and EasyEffects |
| 6 | 📦 Recommended Apps | ~45 apps via Flatpak (productivity, media, graphics, internet, video/audio editing, cloud) |
| 7 | 🏠 Home and Office | CUPS, Samba/LocalSend/Warpinator, KeePassXC, Okular+Tesseract (PDF+OCR) |
| 8 | 🎮 Gaming | Launchers, Wine/Proton/NTSYNC, GameMode/MangoHud/Gamescope, ProtonUp-Qt, vkBasalt, emulators, anti-cheat awareness |
| 9 | 📱 Waydroid | Android on Linux via COPR, GApps, libndk/libhoudini, Magisk, Widevine, SmartDock |
| 10 | 📊 Diagnostics | System panel, top processes, partitions, GSmartControl, CoolerControl, journal, **tunings status** |
| 11 | 🛠️ Tunings and Maintenance | Performance tunings, audio adjustments, DNF, locale, dual-boot, cleanup, kernels, GRUB |
| 12 | 🐧 Fedora Status | Version, Atomic/Silverblue detection, SELinux (status, AVCs, setroubleshoot, GUI) |
| 13 | 📖 About FOF | About the project + update/uninstall FOF + dynamic changelog |

---

## 🎨 Features

- **Dark/light theme** — real-time toggle, saved preference
- **Multilingual** — PT-BR, EN, ES with real-time switching
- **Real-time logs** via SSE, expanded by default
- **Uninstall icon** next to each installed Flatpak app
- **External Flatpak removal detection** — if the user deletes the app outside FOF, the button reverts to its initial state
- **Automatic hardware detection** — `/hardware-scan` endpoint cross-references PCI/USB IDs with `hardware_map.json` and suggests drivers
- **Multi-desktop support** — works on GNOME, KDE, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie and tiling WMs. The startup terminal follows the detected desktop
- **Consistent install/revert pairs** — the revert button starts disabled and only becomes clickable after the corresponding install runs
- **Unified validation** — `./validar.sh` runs 10 sanity checks in a single pass
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

FOF is desktop-agnostic — it was built to run on any Linux
environment that follows the standard XDG stack. It doesn't depend
on KDE, GNOME or any specific DE.

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

- **Startup terminal** — `iniciar_fof.sh` detects your desktop via
  `XDG_CURRENT_DESKTOP` and prefers its native terminal (e.g.
  `konsole` on KDE, `ptyxis` on GNOME, `xfce4-terminal` on XFCE).
  Falls back to universal terminals if not found.
- **Authentication** — `install.sh` automatically installs `zenity`
  if you have neither `kdialog` nor `zenity` (required for graphical
  auth on non-KDE desktops).
- **Menu shortcut** — created at `~/.local/share/applications/`
  (works on every XDG-compliant DE).
- **Icon** — installed at `hicolor/256x256/apps/` named
  `fof-container`, matching the `.desktop`'s `StartupWMClass`.

### What's NOT automatic

- **Pinning to the taskbar.** FOF does **not** pin shortcuts to the
  taskbar automatically. The old implementation used `kwriteconfig5`
  and `qdbus` on KDE, but Plasma frequently overwrites external
  changes to its config file — pinning rarely worked. On any desktop,
  pin manually:
  - **KDE:** right-click FOF's icon in the menu → *Pin to panel*
  - **GNOME:** open FOF once, then *right-click the icon in the dock → Add to Favorites*
  - **XFCE/Cinnamon/MATE:** drag the menu icon to the panel

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
- **Input sanitization** and `idComando` validation
- **Rate limiting** 1.5s per `idComando`
- **Automatic log rotation** (7 days in `/tmp/fof-*.log`)

---

## 🎯 Changelog

The full change history is in [`CHANGELOG.md`](CHANGELOG.md). FOF itself displays the current version's changelog inside the **About FOF** session — loaded dynamically from the file.

### v1.0.0-09292026 (Current) 🚧

- New **Devices and Peripherals** session (position 4), between Hardware and Media Production
- **Hardware** session gains an Intel accordion (`intel-media-driver`) and loses the controllers block
- New `/hardware-scan` endpoint + `hardware-service.js` + `hardware_map.json`
- Automatic detection via `lspci`/`lsusb` cross-referenced with the vendor map, with `nvidia-detect` to refine NVIDIA
- Safe supplements: `linux-firmware-vendor`
- Community COPRs for Realtek USB Wi-Fi (RTL8811CU/8821CU, RTL8812BU/8822BU, RTL8812AU, RTL8811AU) — optional, with risk warnings
- Real state detection via `rpm -q` replaces `.progresso.json` for those drivers
- Multi-desktop support (GNOME, KDE, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, tiling WMs)
- Consistent install/revert pairs — revert button starts disabled
- Unified validation via `./validar.sh` (10 checks)
- Removed: `akmod-intel-ipu6` (native kernel support on Fedora 44+)
- Removed: automatic taskbar pinning (was KDE-only and rarely worked)
- Session comments in `script.js` renumbered (6 to 13)
- READMEs updated to reflect the 13 sessions

### v1.0.0-09282026 ✅

- Complete session restructuring (13 → 12), with semantic IDs (no numbers)
- New **Tunings and Maintenance** session groups performance tunings, audio adjustments, DNF, locale, dual-boot, cleanup, kernels and GRUB
- New **About FOF** session groups the institutional text, update and uninstall FOF
- Removed: **Restore** session (Btrfs-Assistant) and **Maintenance** page (content redistributed)
- Home screen redesigned: live clock and single card with text + "Start" button
- Global search (Ctrl+K) removed — it had issues with WebKitGTK
- **First Steps** session gained an option to remove the Fedora Flatpak repository (with explicit warning about data deletion)
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

**About `flatpakId` and `sempreClicavel`:** commands that install a Flatpak should have `flatpakId: 'org.example.App'` in the `script.js` registry — this lets FOF detect external removal and restore the button. Commands whose real state can be queried via `rpm -q` (hardware drivers, for example) should use `sempreClicavel: true` and verify state via endpoint, instead of trusting `.progresso.json`.

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
