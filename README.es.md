# <img src="icone_app.png" width="55" align="center"> Fedora Only Fans (FOF)

**🌐 Idioma:** [Português (BR)](README.md) | [English](README.en.md) | Español

![Versión](https://img.shields.io/badge/Versi%C3%B3n-v1.0.0--10012026-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44+-294172?style=flat-square&logo=fedora)
![Licencia](https://img.shields.io/badge/Licencia-GPL--3.0-green?style=flat-square)
![Idiomas](https://img.shields.io/badge/Idiomas-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Dejando tu Fedora listo para el "play" — visual, rápido y sin terminal.

---

## 🚀 Instalación

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotek/Fedora-Only-Fans/main/install.sh)
```

## 📦 Comandos

```bash
fof                                 # Iniciar (modo normal)
fof-compat                          # Iniciar (modo compatibilidad — GPUs antiguas)
# Actualizar:    pasa --update a install.sh
# Desinstalar:   pasa --uninstall a install.sh
```

---

## 📖 Sobre

**Fedora Only Fans (FOF)** es un panel de automatización visual para Fedora Linux. Transforma una instalación limpia en un sistema completo — códecs, controladores, repositorios, herramientas — a través de clics, sin abrir la terminal.

FOF tiene **un único punto de entrada**: el botón **"Iniciar"**, que te lleva por las 14 sesiones paso a paso, en orden lógico. Cada sesión agrupa tareas relacionadas, y el progreso se guarda automáticamente.

Cada botón recuerda su propio estado. Cerrar y reabrir FOF siempre muestra exactamente dónde te detuviste.

---

## ✨ Sesiones de Configuración

| # | Sesión | Qué hace |
|---|---|---|
| 1 | 🚀 Primeros Pasos | Actualización completa del sistema + RPM Fusion + Flathub + eliminación opcional del repositorio Fedora Flatpak |
| 2 | 🔤 Códecs y Compatibilidad | Códecs multimedia, reproducción de DVD comercial (tainted), fuentes Microsoft |
| 3 | 🖥️ Hardware | AMD (Vulkan/Mesa/RADV, VA-API, CoreCtrl, LACT, overclock), NVIDIA (detección de generación + controlador propietario + modeset), Intel (Intel Media Driver) |
| 4 | 🔌 Dispositivos y Periféricos | Detección automática de hardware, firmware adicional, COPRs de la comunidad (Razer/OpenRazer, xpadneo, Broadcom), mandos (grupo input, reglas udev) |
| 5 | 🎬 Producción Multimedia | OBS Studio, cámara virtual, EasyEffects |
| 6 | 📦 Aplicaciones Recomendadas | ~45 apps vía Flatpak (productividad, multimedia, gráficos, internet, edición de vídeo/audio, nube) |
| 7 | 🏠 Hogar y Oficina | CUPS, Samba/LocalSend/Warpinator, KeePassXC, Okular+Tesseract (PDF+OCR) |
| 8 | 🎮 Gaming | Launchers, Wine/Proton/NTSYNC, GameMode/MangoHud/Gamescope, ProtonUp-Qt, vkBasalt, emuladores, anti-cheat awareness |
| 9 | 📱 Waydroid | Android en Linux vía COPR, GApps, libndk/libhoudini, Magisk, Widevine, SmartDock |
| 10 | 🖥️ Virtualización | QEMU/KVM + virt-manager, VirtualBox (con akmod-VirtualBox) y GNOME Boxes |
| 11 | 📊 Diagnóstico | Panel del sistema, top procesos, particiones, GSmartControl, CoolerControl, journal, estado de optimizaciones |
| 12 | 🛠️ Ajustes y Mantenimiento | Ajustes de rendimiento, audio, DNF, idioma, dual-boot, limpieza, kernels, GRUB |
| 13 | 🐧 Estado de Fedora | Versión, detección de Atomic/Silverblue, SELinux (estado, AVCs, setroubleshoot, GUI) |
| 14 | 📖 Acerca de FOF | Sobre el proyecto + actualizar/desinstalar FOF + changelog dinámico |

---

## 🎨 Características

- **Tema claro/oscuro** — alternancia en tiempo real, preferencia guardada
- **Multiidioma** — PT-BR, EN, ES con cambio en tiempo real
- **Registros en tiempo real** vía SSE, expandidos por defecto
- **Estructura visual consistente** — cada sesión comienza con una tarjeta de información, y los acordeones de contenido están colapsados por defecto
- **Icono de desinstalar** al lado de cada app Flatpak instalada
- **Detección de Flatpak eliminado externamente**
- **Detección automática de hardware** — endpoint `/hardware-scan` cruza IDs PCI/USB con `hardware_map.json`
- **Detección de generación de GPU NVIDIA** — elige automáticamente la serie correcta (`akmod-nvidia`, `580xx`, `470xx` o `390xx`)
- **Soporte multi-escritorio** — funciona en GNOME, KDE, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie y tiling WMs
- **Pares install/revert consistentes** — el botón de revertir comienza deshabilitado
- **Barra de progreso global** en el header (N/M sesiones completadas)
- **Toasts + notificaciones nativas** al completar tareas largas (>30s)
- **Autenticación segura** vía pkexec/kdesu con whitelist de comandos de solo lectura
- **Doble persistencia** — servidor local + localStorage
- **Limpieza automática de IDs huérfanos**
- **Contenedor nativo WebKitGTK** (sin navegador externo)
- **Changelog dinámico** — leído del `CHANGELOG.md` en runtime
- **Versión centralizada** en `package.json`

---

## 📂 Estructura

```
Fedora-Only-Fans/
├── index.html                       # Landing page (entrada única)
├── guiado.html                      # Configuración paso a paso
├── style.css                        # CSS compartido
├── script.js                        # JS compartido (sesiones, progreso)
├── i18n.js                          # Módulo i18n (PT-BR / EN / ES)
├── locales/
│   ├── en.json                      # Traducciones EN
│   └── es.json                      # Traducciones ES
│   # PT-BR no tiene archivo propio — el HTML es la fuente
├── primeiros-passos.html            # Sesión 1
├── codecs.html                      # Sesión 2
├── hardware.html                    # Sesión 3
├── dispositivos-perifericos.html    # Sesión 4
├── producao-multimidia.html         # Sesión 5
├── aplicativos.html                 # Sesión 6
├── casa-escritorio.html             # Sesión 7
├── gaming.html                      # Sesión 8
├── waydroid.html                    # Sesión 9
├── virtualizacao.html               # Sesión 10
├── diagnostico.html                 # Sesión 11
├── ajustes-manutencao.html          # Sesión 12
├── estado-fedora.html               # Sesión 13
├── sobre-fof.html                   # Sesión 14
├── template-sessao.html             # Plantilla para nuevas sesiones
├── CHANGELOG.md                     # Historial de cambios (leído por FOF)
├── server.js                        # Servidor Node.js + SSE + endpoints
├── hardware-service.js              # Detección de hardware (lspci/lsusb + rpm)
├── hardware_map.json                # Mapa de vendors PCI/USB → paquetes
├── iniciar_fof.sh                   # Script de inicio
├── iniciar_fof_compat.sh            # Modo compatibilidad
├── install.sh                       # Instalador / desinstalador / updater
├── build-container.sh / Makefile    # Build del contenedor nativo
├── src/fof-container.c              # Contenedor WebKitGTK (C + GTK3)
├── package.json                     # Deps Node + versión del FOF
├── icone_app.png                    # Icono de la app
└── LICENSE                          # GPL-3.0
```

---

## 🖥️ Escritorios soportados

FOF es agnóstico al escritorio — fue construido para funcionar en cualquier entorno Linux que siga el stack XDG estándar.

| Escritorio | Estado | Notas |
|---|---|---|
| **KDE Plasma** | ✅ Probado | Auth vía `kdesu`/`kdialog`; terminal nativo `konsole` |
| **GNOME** | ✅ Probado | Auth vía `pkexec`+`zenity`; terminal `ptyxis`/`gnome-terminal` |
| **XFCE** | ✅ Funciona | Auth vía `pkexec`+`zenity`; terminal `xfce4-terminal` |
| **Cinnamon** | ✅ Funciona | Auth vía `pkexec`+`zenity` |
| **MATE** | ✅ Funciona | Auth vía `pkexec`+`zenity` |
| **LXQt** | ✅ Funciona | Auth vía `pkexec`+`kdialog` |
| **LXDE** | ✅ Funciona | Auth vía `pkexec`+`zenity` |
| **Budgie** | ✅ Funciona | Auth vía `pkexec`+`zenity` |
| **Sway / Hyprland / i3** | ✅ Funciona | Requiere `$TERMINAL` definido o un terminal gráfico instalado |

### Qué es automático

- **Terminal de arranque** — `iniciar_fof.sh` detecta tu escritorio vía `XDG_CURRENT_DESKTOP`
- **Autenticación** — `install.sh` instala `zenity` automáticamente si no tienes `kdialog` ni `zenity`
- **Acceso directo en el menú** — en `~/.local/share/applications/`
- **Icono** — instalado en `hicolor/256x256/apps/` con el nombre `fof-container`

### Qué NO es automático

- **Fijar en la barra de tareas.** FOF **no** fija accesos directos automáticamente. Fija manualmente por el menú de tu escritorio.

### Requisitos mínimos

- Fedora 43, 44 o 45 (probado en 44)
- Kernel con WebKitGTK 4.1 (todo Fedora 40+ lo tiene)
- `nodejs` >= 18 (`iniciar_fof.sh` lo instala si falta)
- `zenity` **o** `kdialog` (para autenticación gráfica)

---

## 🛠️ Tecnologías

- **HTML5 / CSS3** — interfaz responsive, tema claro/oscuro
- **JavaScript puro** — peticiones a la API local, i18n, dashboard
- **Node.js** — servidor backend local, ejecución segura de procesos
- **Server-Sent Events (SSE)** — registros en tiempo real
- **Bash** — inicio, instalación
- **pkexec / kdesu** — autenticación segura
- **WebKitGTK** — contenedor nativo

---

## 🛡️ Seguridad

- Autenticación vía **pkexec/kdesu**
- **Whitelist** de comandos de solo lectura sin autenticación
- **Rechazo de encadenamiento de shell** en comandos sin auth
- **Sanitización** de entrada y validación de `idComando`
- **Rate limiting** de 1.5s por `idComando`
- **Rotación automática de registros** (7 días en `/tmp/fof-*.log`)

---

## 🎯 Changelog

El historial completo está disponible en las [releases de GitHub](https://github.com/vitaotek/Fedora-Only-Fans/releases). FOF también muestra el changelog de la versión actual dentro de la sesión **Acerca de FOF**, cargado dinámicamente del `CHANGELOG.md`.

### v1.0.0-10012026 (Actual) 🚧

- **Nueva sesión Virtualización** (posición 10), entre Waydroid y Diagnóstico. Reúne QEMU/KVM + virt-manager, VirtualBox y GNOME Boxes. Cada herramienta tiene botones separados de Instalar, Eliminar (solo se habilita tras instalar) y Abrir (solo aparece tras instalar).
- **NVIDIA con detección de generación** — FOF lee el modelo de la GPU vía `lspci` y elige automáticamente la serie correcta: `akmod-nvidia-390xx` (Fermi), `akmod-nvidia-470xx` (Kepler), `akmod-nvidia-580xx` (Maxwell/Pascal) o `akmod-nvidia` (Turing+).
- **Panel de detección NVIDIA** — muestra el modelo de la GPU, el controlador recomendado y la serie. En máquinas sin GPU NVIDIA, muestra un aviso y deshabilita los botones.
- **Modesetting NVIDIA protegido** — los botones de activar/desactivar `nvidia-drm.modeset=1` se deshabilitan cuando no se detecta ninguna GPU NVIDIA.
- **Correcciones de i18n** — el panel de detección NVIDIA ahora traduce correctamente en EN/ES.
- **Corrección de seguridad** — el comando de instalar el controlador NVIDIA ya no se instala en máquinas sin GPU NVIDIA (antes, caía en un `else` e instalaba el controlador por error).

---

## ➕ Cómo añadir una sesión

1. Copia `template-sessao.html` a `<nombre>.html` (sin número)
2. Rellena los placeholders
3. Añade una entrada al array `SESSOES` en `script.js`
4. Añade el emoji a `ICONES_SESSOES` en `guiado.html`
5. Añade las claves i18n a `locales/en.json` y `locales/es.json`

El orden de visualización viene de la posición de la entrada en el array `SESSOES`.

---

## 🌐 Cómo añadir un idioma

1. Copia `locales/en.json` a `locales/XX.json`
2. Traduce los valores
3. Añade `XX` a `LANGS_DISPONIVEIS` (`i18n.js`) y `LANGS_SUPORTADOS` (`server.js`)
4. Añade la opción al array `opcoes` de `criarSeletorIdioma()`

---

## 🏷️ Cómo publicar una versión

1. Edita `package.json` → `"version": "1.0.0-<NUEVA>"`
2. Edita `i18n.js` → `FALLBACK_VERSION = '1.0.0-<NUEVA>'`
3. Reemplaza `CHANGELOG.md` con la sección de la nueva versión (el historial completo queda en las releases de GitHub)
4. Crea el tag/release en GitHub con el mismo nombre

---

## 🤝 Contribuir

1. Fork → branch → commit → push → Pull Request

## 🐛 Reportar errores

Abre un issue en [github.com/vitaotek/Fedora-Only-Fans/issues](https://github.com/vitaotek/Fedora-Only-Fans/issues)

## ⚠️ Aviso legal

Proyecto en desarrollo (alpha). **Haz siempre copia de seguridad** antes de alterar el sistema.

## 📄 Licencia

**GPL-3.0** — ver [LICENSE](LICENSE).

## 👤 Autor

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Agradecimientos

[Fedora Project](https://getfedora.org/) · [RPM Fusion](https://rpmfusion.org/) · [Flathub](https://flathub.org/)

**Hecho con ❤️ para la comunidad Fedora**
