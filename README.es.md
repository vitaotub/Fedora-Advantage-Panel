# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Idioma:** [Português (BR)](README.md) | [English](README.en.md) | Español

![Versión](https://img.shields.io/badge/Versi%C3%B3n-v1.0.0--10072026-orange?style=flat-square)
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
| 1 | 🚀 Primeros Pasos | Actualización del sistema, RPM Fusion, Flathub, Terra |
| 2 | 🔤 Códecs | Códecs multimedia, DVD comercial, fuentes MS |
| 3 | 🖥️ Hardware | Controladores AMD/NVIDIA/Intel, CoreCtrl, LACT, overclock |
| 4 | 🔌 Dispositivos | Detección automática, COPRs, mandos, firmware |
| 5 | 🎬 Producción Multimedia | OBS Studio, cámara virtual, EasyEffects |
| 6 | 📦 Aplicaciones | ~45 apps Flatpak + Suite ArtCraft (7 apps Rust) + Herramientas de Acceso Remoto |
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
- **Sesión Gamescope oficial** — launcher y `.desktop` creados siguiendo la receta oficial de Fedora Docs, con `TryExec` (compatible con plasmalogin), detección dinámica de resolución y log de diagnóstico en `/tmp/fap-gamescope-session.log`. Aviso no bloqueante si el Steam nativo no está presente.
- **Suite ArtCraft** — 7 apps de creación (PhotoCraft, VectorCraft, FilmCraft, LightCraft, PrintCraft, EffectCraft, DesignCraft) desarrolladas en Rust, código abierto, con botones que siempre descargan el RPM `.x86_64` más reciente directamente desde los GitHub Releases de cada proyecto
- **Herramientas de Acceso Remoto** — RustDesk, Remmina, GNOME Connections y KRDC, con detección automática del escritorio para ocultar el botón "Instalar" cuando la app nativa ya está presente
- **Configurador de GRUB** — panel interactivo que lee la configuración actual, explica cada parámetro en lenguaje claro, detecta automáticamente la resolución del monitor y la presencia de dual boot, y aplica un conjunto recomendado con copia de seguridad automática y reversión fácil
- **Terra Repository** — repositorio comunitario que complementa RPM Fusion, habilitable en un clic
- **Cola de instalación** de Flatpaks — haz clic en varios en secuencia
- **Bloqueo inteligente** — evita conflictos de lock en `rpm` y bloquea la navegación entre sesiones durante la ejecución
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

[![Fedora Project](https://img.shields.io/badge/Fedora-Project-294172?style=flat-square&logo=fedora&logoColor=white)](https://getfedora.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://www.deepseek.com/)

**Hecho con ❤️ para la comunidad Fedora**
