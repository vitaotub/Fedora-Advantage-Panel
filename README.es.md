# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Idioma:** [Português (BR)](README.md) | [English](README.en.md) | Español

![Versión](https://img.shields.io/badge/Versi%C3%B3n-v1.3.1--10272026-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44%20%7C%2045-294172?style=flat-square&logo=fedora)
![Licencia](https://img.shields.io/badge/Licencia-GPL--3.0-green?style=flat-square)
![Idiomas](https://img.shields.io/badge/Idiomas-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Dejando tu Fedora listo para el "play" — visual, rápido y sin terminal.

## 📖 Qué es

**Fedora Advantage Panel (FAP)** es un panel de automatización visual para Fedora Linux. Transforma una instalación limpia en un sistema completo — códecs, controladores, repositorios, herramientas — a través de clics, sin abrir la terminal.

Un único botón, **Iniciar Configuración**, te lleva por **14 sesiones guiadas** paso a paso. Cada botón recuerda su propio estado: cierra FAP, vuelve a abrirlo, y muestra exactamente dónde te detuviste.

## 📸 Capturas de pantalla

### Página de inicio — tu Fedora de un vistazo

![Página de inicio del FAP](prints/01-landing.png)

Al arrancar, FAP consulta el estado real del sistema y muestra **4 barras de progreso** — Uso general, Gaming, Producción y Seguridad. La línea de abajo resume: *"Faltan {n} pasos para dejar Fedora completo."* Cuando todo está listo, se convierte en *"Tu Fedora está listo. 🎉"*.

### Navegación lateral + búsqueda

![Barra lateral del FAP](prints/02-sidebar.png)

Barra lateral retráctil con las 14 sesiones. Tiene **búsqueda global** — escribe "vlc" o "steam" y la barra filtra tanto sesiones como ítems internos.

En modo colapsado, cada ícono recibe su propio **efecto neón** al pasar el mouse.

### Origen de cada paquete, filtros e insignias

![Filtros y origen de paquetes del FAP](prints/03-filtros.png)

Cada aplicación muestra de dónde viene — **Flathub, Fedora, RPM Fusion, Fabricante, Descarga o Comunidad**, cada origen con un color distinto. Pasa el mouse en cualquier parte del botón y el tooltip muestra el origen; haz clic en la insignia para abrir un popover con el **comando exacto**, **cómo actualizar** y **cómo eliminar**.

Los filtros combinables (estado + origen) están en la sesión 6.

### Registro en tiempo real con tema Matrix

![Registro en tiempo real del FAP](prints/04-log.png)

Todo lo que FAP hace pasa por un **terminal fijo en la parte inferior**, con colores que distinguen salida normal, éxito y error real. El registro comienza colapsado y acompaña la barra lateral.

## 🎯 Para quién es

- **Quien está empezando con Fedora** y quiere dejarlo listo para uso diario.
- **Quien viene de Ubuntu/Mint** y quiere la misma fluidez de configuración inicial.
- **Quien juega en Linux** y quiere Steam, Heroic, Lutris, Proton, MangoHud y similares.
- **Quien ya usa Fedora desde hace tiempo** y quiere automatizar el post-instalación.
- **Quien administra la PC de otra persona** sin terminal.

## 🚀 Instalación

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
```

> **💡 ¿No sabes cómo ejecutar ese comando?** Es más simple de lo que parece:
>
> 1. **Copia el comando completo** — selecciona todo el texto de arriba con el mouse, o haz clic en el ícono de copiar que aparece en el lado derecho del bloque de código.
> 2. **Abre la terminal** — busca **"Terminal"** en el menú de aplicaciones de tu Fedora. En la mayoría de los escritorios (GNOME, KDE, XFCE, Cinnamon, MATE), el atajo `Ctrl+Alt+T` también funciona.
> 3. **Pega el comando** — en la terminal, presiona `Ctrl+Shift+V` o haz clic con el botón derecho del mouse y elige **"Pegar"**.
> 4. **Presiona `Enter`** — el instalador pedirá tu contraseña de administrador (la misma que usas para iniciar sesión en la computadora). Eso es normal — el instalador está pidiendo permiso para instalar los paquetes del sistema.
>
> Al terminar, abre FAP escribiendo `fap` en la terminal o buscando **"Fedora Advantage Panel"** en el menú de aplicaciones.

**Comandos tras instalar:**

```bash
fap              # inicia FAP
fap-compat       # modo compatibilidad (GPUs antiguas, VMs)
fap --update     # actualiza (o haz clic en el badge dentro de FAP)
fap --uninstall  # desinstala
```

Las actualizaciones se aplican **sobre la instalación existente** — no es necesario desinstalar entre versiones. El progreso, el tema y el idioma se conservan.

## ✨ Las 14 Sesiones

| # | Sesión | Qué hace |
|---|---|---|
| 1 | 🚀 Primeros Pasos | Actualización, RPM Fusion, Flathub, Terra Repository |
| 2 | 🔤 Códecs | Códecs completos, DVD comercial, fuentes Microsoft |
| 3 | 🖥️ Hardware | Controladores AMD/NVIDIA/Intel, CoreCtrl, LACT, overclock |
| 4 | 🔌 Dispositivos | Detección automática, controladores COPR, mandos, firmware |
| 5 | 🎬 Producción Multimedia | OBS Studio, cámara virtual, EasyEffects |
| 6 | 📦 Aplicaciones | Flatpaks, 20+ apps `dnf`, **ArtCraft Launcher**, acceso remoto, **utilidades** |
| 7 | 🏠 Hogar y Oficina | CUPS, Samba, LocalSend, KeePassXC |
| 8 | 🎮 Gaming | Steam nativo, Heroic, Lutris, Wine, GameMode, emuladores |
| 9 | 📱 Waydroid | Android en Linux vía contenedor |
| 10 | 🖥️ Virtualización | QEMU/KVM, VirtualBox, GNOME Boxes |
| 11 | 📊 Diagnóstico | Panel del sistema, SMART, temperaturas, journal |
| 12 | 🛠️ Ajustes y Mantenimiento | Ajustes, DNF, dual-boot, GRUB, kernels, actualización de Fedora |
| 13 | 🐧 Estado de Fedora | Versión, Atomic/Silverblue, SELinux |
| 14 | 📖 Acerca de FAP | Actualizar/desinstalar, changelog |

### 📦 Sesión 6 — bloques y destacados

- **📄 Productividad y Oficina** — OnlyOffice, Obsidian, Thunderbird, Okular, Kate, Joplin, Foliate, **Visual Studio Code**.
- **🎬 Entretenimiento y Multimedia** — Haruna, VLC, MPV, Spotify, Plex, Stremio.
- **🎨 Herramientas Gráficas** — Krita, Inkscape, Pinta, GIMP, Darktable, FreeCAD, LibreCAD, Cura, Upscayl, XnView MP, **Drawy**.
- **🎨 Suite ArtCraft** — **ArtCraft Launcher** (instala/actualiza las 13 apps de la suite por la propia interfaz del launcher).
- **🌐 Internet y Comunicación** — Opera, Brave, Edge, Chromium, Zoom, Vivaldi, Discord, Telegram, **Firefox**, **Packet**.
- **🎞️ Edición de Vídeo, Audio y 3D** — Kdenlive, Shotcut, Pitivi, OpenShot, Avidemux, Lightworks, Drift, Blender, Ardour, LMMS, Audacity.
- **☁️ Sincronización en la Nube** — Rclone Manager.
- **📡 Herramientas de Acceso Remoto** — RustDesk, Remmina, GNOME Connections, KRDC.
- **🔧 Utilidades** — **Gear Lever** (gestor de AppImages).

## 🛡️ Seguridad y transparencia

- **Nunca instala nada sin que lo veas.** Todo comando es visible en el registro en tiempo real.
- **Detección de preexistencia.** Apps instaladas antes de FAP aparecen como "Abrir" desde el inicio.
- **13 ítems críticos protegidos.** Controladores, códecs, CUPS, Samba, virtualización: si existían antes, la papelera no aparece.
- **Detección real de idiomas.** Los 3 botones de traducción consultan el estado del sistema.
- **Autenticación vía `pkexec`.** Diálogo de contraseña nativo.
- **Bloqueo inteligente.** `dnf` bloquea otros `dnf`; la cola de Flatpaks maneja el bloqueo global.
- **Contenedor WebKitGTK nativo.** Interfaz propia, sin dependencia de Firefox/Chromium. `fap-compat` para GPUs antiguas.
- **`install.sh` se niega a ejecutarse como root.** Instala en `~/.local/share`.

## 🎨 Características de la Interfaz (v1.2)

- **Tema negro/gris de alto contraste** en dark; el claro mantiene los azules Fedora.
- **Barra lateral colapsable** con íconos SVG monocromáticos y **efecto neón por sesión** en modo colapsado.
- **Búsqueda global** con índice en segundo plano cubriendo las 14 sesiones.
- **Insignias de origen** (6 variantes) con tooltip en cualquier parte del botón y popover.
- **Filtros combinables** (estado + origen) en la sesión 6.
- **Tarjeta de estado en la landing** con 4 barras.
- **Dock de registro fijo** de 160px, siempre comienza colapsado.
- **Sesiones N/A** eliminadas del cálculo de progreso.
- **Botón 🔄 en el encabezado** que recarga el estado del sistema.

### 🔒 Protección de ítems críticos

**13 ítems de alto riesgo** tienen la eliminación bloqueada cuando son preexistentes. El botón muestra "✅ Ya estaba activo" con un tooltip que incluye el comando exacto de reversión manual.

## 🖥️ Requisitos y soporte

- **Fedora 44 o 45** (desarrollado y probado ampliamente en ambos).
- **GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3** y otros tiling WMs.
- **PT-BR, EN y ES.**

## 🔄 Actualizar y desinstalar

**Actualizar:**
```bash
./install.sh --update
```
O haz clic en el badge de actualización o usa el botón en la sesión **Acerca de FAP**.

**Desinstalar:**
```bash
./install.sh --uninstall
```
O usa el botón en la sesión **Acerca de FAP**.

## 🐛 Feedback, bugs y sugerencias

FAP es un proyecto open-source (GPL-3.0), mantenido por **VitãoTub** en su tiempo libre.

- **Bugs:** abre un [issue](https://github.com/vitaotub/Fedora-Advantage-Panel/issues) con la salida de `/tmp/fap-*.log` y la versión de Fedora.
- **Sugerencias:** también vía issue.
- **Capturas de pantalla:** si algo se ve raro, una captura ayuda mucho.

## 📄 Licencia

**GPL-3.0** — ver [LICENSE](LICENSE).

## 👤 Autor

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Agradecimientos

[![Fedora Project](https://img.shields.io/badge/Fedora-Project-294172?style=flat-square&logo=fedora&logoColor=white)](https://getfedora.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://www.deepseek.com/)

**Hecho con ❤️ para la comunidad Fedora**
