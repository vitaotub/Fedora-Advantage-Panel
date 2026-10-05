# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Idioma:** [Português (BR)](README.md) | [English](README.en.md) | Español

![Versión](https://img.shields.io/badge/Versi%C3%B3n-v1.0.0--10052026.b-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44+-294172?style=flat-square&logo=fedora)
![Licencia](https://img.shields.io/badge/Licencia-GPL--3.0-green?style=flat-square)
![Idiomas](https://img.shields.io/badge/Idiomas-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Dejando tu Fedora listo para el "play" — visual, rápido y sin terminal.

## 🚀 Instalación

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
```

**Comandos disponibles después de instalar:**

```bash
fap                       # Iniciar (modo normal)
fap-compat                # Iniciar (modo compatibilidad — GPUs antiguas)
./install.sh --update     # Actualizar
./install.sh --uninstall  # Desinstalar
```

## 📖 Sobre

Panel de automatización visual para Fedora Linux. Transforma una instalación limpia en un sistema completo — códecs, controladores, repositorios, herramientas — a través de clics, sin abrir la terminal.

**Un único punto de entrada**: el botón **"Iniciar"** te lleva por las 14 sesiones paso a paso. Cada botón recuerda su propio estado. Cerrar y reabrir FAP muestra exactamente dónde te detuviste.

## ✨ Sesiones

| # | Sesión | Qué hace |
|---|---|---|
| 1 | 🚀 Primeros Pasos | Actualización del sistema, RPM Fusion, Flathub |
| 2 | 🔤 Códecs | Códecs multimedia, DVD comercial, fuentes MS |
| 3 | 🖥️ Hardware | Controladores AMD/NVIDIA/Intel, CoreCtrl, LACT, overclock |
| 4 | 🔌 Dispositivos | Detección automática, COPRs, mandos, firmware |
| 5 | 🎬 Producción Multimedia | OBS Studio, cámara virtual, EasyEffects |
| 6 | 📦 Aplicaciones | ~45 apps Flatpak (productividad, multimedia, gráficos, internet) |
| 7 | 🏠 Hogar y Oficina | CUPS, Samba, LocalSend, KeePassXC, OCR |
| 8 | 🎮 Gaming | Steam nativo, Heroic, Lutris, Wine, GameMode, Gamescope Session, emuladores |
| 9 | 📱 Waydroid | Android en Linux vía contenedor |
| 10 | 🖥️ Virtualización | QEMU/KVM, VirtualBox, GNOME Boxes |
| 11 | 📊 Diagnóstico | Panel del sistema, salud del disco, temperaturas |
| 12 | 🛠️ Ajustes y Mantenimiento | Ajustes de rendimiento, DNF, GRUB, kernels |
| 13 | 🐧 Estado de Fedora | Versión, Atomic/Silverblue, SELinux |
| 14 | 📖 Acerca de FAP | Actualizar/desinstalar, changelog dinámico |

## 🎨 Destaques

- **Tema claro/oscuro** con alternancia en tiempo real
- **Multiidioma** (PT-BR, EN, ES) con cambio en tiempo real
- **Registros en tiempo real** vía SSE
- **Papelera unificada** para Flatpaks y apps no-Flatpak
- **Botón "Abrir"** en cada app GUI — se inicia en sesión propia (sobrevive al cierre de FAP)
- **Steam nativo** vía RPM Fusion — necesario para la sesión Gamescope
- **Cola de instalación** de Flatpaks — haz clic en varios en secuencia
- **Bloqueo inteligente** — evita conflictos de lock en `rpm`
- **Detección automática de hardware** — GPUs, Wi-Fi, Ethernet
- **Detección de apps instaladas por fuera** — reconocidas al cargar la sesión
- **Contenedor WebKitGTK nativo** (sin navegador externo)
- **Autenticación segura** vía pkexec/kdesu

## 🖥️ Escritorios soportados

GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3 y otros tiling WMs.

## 📄 Licencia

**GPL-3.0** — ver [LICENSE](LICENSE).

## 👤 Autor

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Agradecimientos

[Fedora Project](https://getfedora.org/) · [RPM Fusion](https://rpmfusion.org/) · [Flathub](https://flathub.org/)

**Hecho con ❤️ para la comunidad Fedora**
