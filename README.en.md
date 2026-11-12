# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Language:** [Português (BR)](README.md) | English | [Español](README.es.md)

![Version](https://img.shields.io/badge/Version-v1.5.9--11122026-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44%20%7C%2045-294172?style=flat-square&logo=fedora)
![License](https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square)
![Languages](https://img.shields.io/badge/Languages-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Getting your Fedora ready to "play" — visual, fast, and without the terminal.

## 📖 What it is

The **Fedora Advantage Panel (FAP)** turns a clean Fedora installation into a complete system — codecs, drivers, repositories, tools, apps — through clicks, without opening the terminal. A single button, **Start Setup**, takes you through guided sessions step by step. Each button remembers its own state: close FAP, reopen it, and it shows exactly where you stopped.

## 📸 Screenshots

<table>
<tr>
<td align="center" width="50%">
<img src="prints/01-landing.png" alt="Landing page"><br>
<sub><b>Landing page</b> — per-group progress, one-line status, single start button</sub>
</td>
<td align="center" width="50%">
<img src="prints/02-sidebar.png" alt="Sidebar"><br>
<sub><b>Sidebar</b> — 13 sessions, per-session progress, global search</sub>
</td>
</tr>
<tr>
<td align="center" width="50%">
<img src="prints/03-filtros.png" alt="Filters and badges"><br>
<sub><b>Filters and badges</b> — origin of each package, combinable filters</sub>
</td>
<td align="center" width="50%">
<img src="prints/04-log.png" alt="Matrix log"><br>
<sub><b>Real-time log</b> — Matrix theme, starts collapsed</sub>
</td>
</tr>
</table>

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

## 💡 What you get

- **Multimedia ready** — full codecs, commercial DVD playback, Microsoft fonts, hardware video acceleration (VA-API on AMD, Intel and NVIDIA).
- **Drivers that work** — automatic GPU detection, correct series by generation (from Fermi to Blackwell), CoreCtrl / LACT, overclocking, `akmods` with guided MOK enrollment.
- **Network and peripherals** — Broadcom, Realtek, Xbox Wireless (xpadneo), Razer (OpenRazer), extra firmware, all with hardware detection.
- **Gaming stack** — native Steam, Heroic, Lutris, Wine, Proton-GE (ProtonUp-Qt), GameMode, MangoHud, Gamescope, vkBasalt, NTSYNC, emulators (RetroArch, Dolphin, PCSX2, RPCS3, Duckstation).
- **Production and office** — OBS Studio + virtual camera, EasyEffects, CUPS + Avahi, Samba, LocalSend, KeePassXC, Rclone Manager, ArtCraft Launcher.
- **Remote access with SELinux awareness** — RustDesk installs normally, and FAP checks for SELinux blocks (`avc: denied`) from the last 24h, with a link to the official policy when needed. FAP does **not** install the policy automatically (the broad policy weakens SELinux globally).
- **Virtualization** — QEMU/KVM + virt-manager, VirtualBox, GNOME Boxes, with Secure Boot warnings.
- **Diagnostics** — system panel, top 5 processes, partitions, journal, GSmartControl (SMART), CoolerControl (temperatures + fan curves).
- **Reversible tweaks** — `vm.max_map_count`, `vm.swappiness`, TCP BBR, realtime for audio, dual-boot RTC, parallel DNF, GRUB, kernels.
- **Info badge** — clickable exclamation icon next to apps that need context (SELinux, usage notes, non-urgent warnings). Popup explains without polluting the UI. Urgent warnings (data risk, "do not power off") stay in boxes.
- **Guided 44 → 45 upgrade** — automatic availability detection, third-party warnings (NVIDIA, Broadcom, COPRs, Terra), download, scheduled reboot and post-upgrade actions (`rpmconf`, `distro-sync`, SELinux relabel, rescue kernel).
- **Multi-language** — PT-BR, EN and ES, with PT-BR HTML fallback and JSON loaded on demand.

## 🛡️ Security and transparency

- **Never installs anything without you seeing it.** Every command is visible in the real-time log.
- **Pre-existence detection.** Apps installed before FAP appear as "Open" from the start.
- **Critical items protected.** Proprietary drivers, codecs, CUPS, Samba, virtualization: if they already existed, the trash icon doesn't appear (removing the base would break other apps). User apps (like Firefox) follow the FAP pattern: "Open" + trash, with a tooltip warning that they were installed before FAP.
- **Backup before overwriting.** GameMode + MangoHud presets back up the user's files before applying — and the trash icon restores them.
- **Authentication via `pkexec`.** Native desktop password dialog. The script to be executed is logged **before** pkexec opens — you see what you're authorizing.
- **File-based audit.** Every `pkexec` leaves a trail in `/tmp/fap-audit-*.log` (removed after 7 days).
- **Local CSRF protection.** `/executar` and `/shutdown` reject requests with an `Origin` from another host. `/executar` also blocks `>` (file redirection) unless it's a legitimate dup-fd (`2>&1`, `1>&2`, `>&2`) — closes the `~/.bashrc` overwrite vector.
- **Secure Boot aware.** When installing any `akmod-*` with Secure Boot enabled, FAP guides the user through MOK enrollment (kmodgenca + mokutil) before installing. If the user already has an enrolled key (from any source), FAP detects it and hides the instructions.
- **Does not weaken SELinux.** FAP does **not** install broad SELinux policies to "solve" app blocks (RustDesk, etc.). It detects the AVCs (via `journalctl -g`), warns, and points to the official documentation — the user decides.
- **Native WebKitGTK container.** Own interface, no dependence on Firefox/Chromium.
- **`install.sh` refuses to run as root.** Installs to `~/.local/share` and uses `sudo` only where needed.

## 🖥️ Requirements

- **Fedora 44 or 45.** Both are **officially supported**. Active development and testing focus on **Fedora 45 and future versions**, but Fedora 44 remains homologated — every FAP command is tested on both versions.
- **GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3** and other tiling WMs.
- **PT-BR, EN and ES.**

## 🔄 Update and uninstall

```bash
./install.sh --update     # or click the badge inside FAP
./install.sh --uninstall  # or use the button in "About FAP"
```

Updates are applied on top of the existing installation — progress, theme, and language are preserved.

## 🧹 Troubleshooting

### FAP won't install or won't open, even after uninstall/reinstall

If you already ran `./install.sh --uninstall` and reinstalling keeps failing (server doesn't start, window closes in ~15s, `git pull` with conflict, lost `.sh` permissions), there may be leftovers from older installations that the standard uninstall didn't cover. In that case, use the heavy cleanup script (it lives in `scripts/`):

```bash
sudo bash ~/.local/share/fedora-advantage-panel/scripts/fap-cleanup.sh
# or, if you installed from a dev clone:
sudo bash ~/Downloads/fap/scripts/fap-cleanup.sh
```

> **⚠️ WARNING:** this script deletes **everything** related to FAP, including:
> - The official installation at `~/.local/share/fedora-advantage-panel/`
> - The dev clone at `~/Downloads/fap/` (if you have unpushed local commits, run `git push` first!)
> - The old FOF scheme (if you migrated from it)
> - `.progresso.json` — all clicked-button history
> - Theme, language, saved filters
> - The 3 `sysctl.d/99-fap-*` (tunings)
> - `PATH` entries in rc files (with automatic backup)
>
> It does **not** remove installed packages (Flatpak, DNF, akmods), COPRs, Terra, vendor repos, the MOK key, `/etc/chromium/master_preferences` or MangoHud/GameMode presets.

After running cleanup, reinstall from scratch:

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
```

### When NOT to use `fap-cleanup.sh`

- **To update FAP:** use the update badge or `./install.sh --update`. Neither needs cleanup.
- **To uninstall normally:** use the "Uninstall" button in **About FAP** or `./install.sh --uninstall`. The standard uninstall already covers everything FAP installed and preserves history and the dev clone.
- **To clean up packages installed by FAP:** the cleanup does not remove packages (Flatpak, DNF, akmods) by design. Use the "Revert" button in each session, or remove manually with `flatpak uninstall <app>` / `sudo dnf remove <pkg>`.

### The "reboot your computer" warning doesn't appear after updating

`dnf needs-restarting -r` only returns 1 when a critical package was updated (kernel, glibc, systemd, dbus, openssl-libs, pam, selinux-policy, polkit). If your update was only apps (Firefox, GIMP, VLC), the warning **correctly** does not appear. To confirm:

```bash
dnf needs-restarting -r; echo "Exit: $?"
# Exit: 0 → no reboot needed
# Exit: 1 → reboot needed (the warning should appear)
```

Since v1.5.5, if `dnf needs-restarting` itself fails (RPM DB lock, missing `dnf5-plugins`, timeout), FAP shows a neutral banner: *"Could not check if a reboot is needed. Check in the terminal: dnf needs-restarting -r"*.

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
