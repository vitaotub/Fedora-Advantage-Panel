# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Idioma:** [Português (BR)](README.md) | [English](README.en.md) | Español

![Versión](https://img.shields.io/badge/Versi%C3%B3n-v1.0.0--10152026-orange?style=flat-square)
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

Fedora Advantage Panel (FAP) es un panel de automatización visual para Fedora Linux. Transforma una instalación limpia en un sistema completo — códecs, controladores, repositorios, herramientas — a través de clics, sin abrir la terminal.

**Un único punto de entrada.** El botón **"Iniciar"** te lleva por 14 sesiones guiadas paso a paso. Cada botón recuerda su propio estado. Cerrar y reabrir FAP muestra exactamente dónde te detuviste.

## ✨ Las 14 Sesiones

| # | Sesión | Qué hace |
|---|---|---|
| 1 | 🚀 Primeros Pasos | Actualización del sistema, RPM Fusion, Flathub, Terra Repository (con avisos sobre subrepositorios opcionales) |
| 2 | 🔤 Códecs | Códecs multimedia completos (grupo `multimedia` oficial de RPM Fusion), DVD comercial, fuentes Microsoft |
| 3 | 🖥️ Hardware | Controladores AMD/NVIDIA/Intel, CoreCtrl, LACT, overclock de GPU |
| 4 | 🔌 Dispositivos | Detección automática de hardware, controladores COPR de la comunidad, mandos, firmware |
| 5 | 🎬 Producción Multimedia | OBS Studio, cámara virtual, EasyEffects |
| 6 | 📦 Aplicaciones | Flatpaks seleccionados, 20+ apps `dnf`, navegadores vía RPM oficial, **Suite ArtCraft (13 apps)** y herramientas de acceso remoto |
| 7 | 🏠 Hogar y Oficina | CUPS, Samba, LocalSend, KeePassXC, OCR (Okular + Tesseract) |
| 8 | 🎮 Gaming | Steam nativo, Heroic (RPM oficial), Lutris, Wine, GameMode, Gamescope Session, emuladores |
| 9 | 📱 Waydroid | Android en Linux vía contenedor |
| 10 | 🖥️ Virtualización | QEMU/KVM, VirtualBox, GNOME Boxes |
| 11 | 📊 Diagnóstico | Panel del sistema, salud del disco (SMART), temperaturas, journal de errores |
| 12 | 🛠️ Ajustes y Mantenimiento | Ajustes de rendimiento, DNF, configuración interactiva del GRUB, kernels |
| 13 | 🐧 Estado de Fedora | Versión, detección de Atomic/Silverblue, gestión de SELinux |
| 14 | 📖 Acerca de FAP | Actualizar/desinstalar, changelog dinámico, historial de cambios |

## 🎨 Características

### Interfaz y usabilidad

- **Interfaz oscura y clara** con cambio en tiempo real, sin recargar la página
- **Multiidioma** (PT-BR, EN, ES) con selector en el encabezado
- **Registros en tiempo real** por comando, con colores que distinguen salida normal, éxito y errores reales
- **Bloqueo inteligente** — evita conflictos de lock en `rpm` y bloquea la navegación entre sesiones mientras un comando está en ejecución
- **Sesión reanudable** — cada botón recuerda su estado en `.progresso.json`, cerrar y reabrir muestra dónde te detuviste

### Instalación de aplicaciones

- **Papelera unificada** — cada app instalable tiene un ícono de eliminación al lado, que elimina el paquete y, cuando aplica, desactiva el repositorio de origen
- **Origen por tipo de app** — FAP elige automáticamente la mejor forma de instalación:
  - **Flatpak (Flathub)** — cuando no existe repo oficial en Fedora ni paquete en los repos de la distro
  - **`dnf` (repos oficiales de Fedora o RPM Fusion)** — cuando la propia distro empaqueta el software
  - **RPM vía repo oficial del fabricante** — cuando el fabricante distribuye para Fedora (navegadores, Heroic)
  - **RPM descargado de URL** — cuando es la única opción. Soporta tanto URL estática (OnlyOffice) como URL resuelta en runtime vía API de GitHub (Suite ArtCraft, RustDesk, Lightworks, Rclone Manager). `--setopt=localpkg_gpgcheck=0` obligatorio en Fedora 44/45
- **Cola de Flatpaks** — hacer clic en varias apps en secuencia las encola y las instala de a una, sin errores de lock de Flathub
- **Botón "Abrir"** en todas las apps GUI — se inicia en sesión propia, sobreviviendo al cierre de FAP
- **Detección de apps instaladas por fuera** — si ya tienes una app instalada antes de FAP, el botón aparece como "Abrir" desde el principio
- **Eliminación inteligente de códecs** — la papelera de los códecs hace el swap de vuelta de `ffmpeg` a `ffmpeg-free` y reinstala los plugins base de Fedora, en vez de dejar el sistema sin códecs

### Contenedor WebKitGTK nativo

- **Interfaz propia**, sin depender de navegador externo
- **Contenedor nativo en WebKitGTK 4.1 + GTK3**, compilado en la instalación
- **Modo compatibilidad** (`fap-compat`) para GPUs sin aceleración 3D — fuerza renderizado por software vía Mesa/llvmpipe
- **Sin popups molestas** — EULA de Chromium suprimida y permisos de WebKit (geolocalización, cámara, micrófono) denegados automáticamente

### Autenticación y seguridad

- **`pkexec` universal** — diálogo de contraseña integrado en todos los escritorios (KDE usa `polkit-kde-agent`, GNOME usa `polkit-gnome`, etc.), sin necesidad de escribir la contraseña en la terminal
- **Comandos read-only en whitelist** — `rpm -q`, `uname -r`, `gtk-launch`, `flatpak`, `systemctl --user` y similares se ejecutan sin pedir contraseña
- **Bloqueo de inyección de shell** — comandos con `;`, `&&`, `|`, `$(...)` o `&` son rechazados por la whitelist y requieren autenticación

### Ciclo de vida

- **Cierre limpio** — al cerrar la ventana de FAP, el servidor Node.js se cierra y el puerto 3000 se libera automáticamente. Nada queda en memoria.
- **Árbol de procesos protegido** — si un comando `dnf` está en ejecución cuando FAP se cierra, todo el árbol de procesos es terminado vía PGID, evitando locks huérfanos en `rpm`
- **Registro persistente** — cada sesión escribe un archivo `/tmp/fap-YYYYMMDD-HHMMSS.log`, con limpieza automática de registros mayores a 7 días

### Suite ArtCraft

Alternativas open-source (escritas en Rust) a los productos Adobe y Microsoft Office. Cada app tiene su propio repositorio en GitHub y su RPM `.x86_64` en la release más reciente — FAP resuelve la URL en runtime, siempre descargando la última versión publicada:

- 🖼️ **PhotoCraft** — edición de fotos
- ✏️ **VectorCraft** — ilustración vectorial
- 🎬 **FilmCraft** — edición de vídeo
- 💡 **LightCraft** — iluminación 3D
- 📄 **PDFCraft** — edición de PDF
- ✨ **EffectCraft** — efectos visuales
- 🎨 **DesignCraft** — diseño gráfico
- 🖌️ **FigCraft** — vectores e ilustración
- 📽️ **DeckCraft** — presentaciones
- 📊 **GridCraft** — hojas de cálculo
- 📝 **WordCraft** — editor de texto
- 📐 **CadCraft** — CAD
- 🔊 **SoundCraft** — edición de audio

### Detección automática de hardware

- **Escáner de hardware** vía `lspci` / `lsusb`, cruzado con un mapa de vendors mantenido por la comunidad
- **Detección de NVIDIA** con heurística para sugerir la serie correcta de controlador (`akmod-nvidia`, `580xx`, `470xx` o `390xx`)
- **Verificación de RPM Fusion** — avisa si el repositorio no está activo antes de intentar instalar controladores que dependen de él
- **Verificación de Secure Boot** — avisa si está activo y el controlador NVIDIA necesitará firma MOK

## 🖥️ Escritorios soportados

GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3 y otros tiling WMs.

La autenticación `pkexec` funciona en todos — el diálogo de contraseña lo gestiona el agente polkit del escritorio en uso.

## 🔄 Actualizar y desinstalar

**Actualizar:**
```bash
./install.sh --update
```
O haz clic en el badge de actualización (aparece automáticamente cuando hay nueva versión en GitHub) o usa el botón en la sesión **Acerca de FAP**.

**Desinstalar:**
```bash
./install.sh --uninstall
```
O usa el botón en la sesión **Acerca de FAP** (con doble confirmación).

## 📄 Licencia

**GPL-3.0** — ver [LICENSE](LICENSE).

## 👤 Autor

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Agradecimientos

[![Fedora Project](https://img.shields.io/badge/Fedora-Project-294172?style=flat-square&logo=fedora&logoColor=white)](https://getfedora.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://www.deepseek.com/)

**Hecho con ❤️ para la comunidad Fedora**
