# <img src="icone_app.png" width="55" align="center"> Fedora Only Fans (FOF)

**🌐 Idioma:** [Português (BR)](README.md) | [English](README.en.md) | Español

![Versión](https://img.shields.io/badge/Versi%C3%B3n-v1.0.0--09282026-orange?style=flat-square)
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

FOF tiene **un único punto de entrada**: el botón **"Iniciar"**, que te lleva por las 12 sesiones paso a paso, en orden lógico. Cada sesión agrupa tareas relacionadas, y el progreso se guarda automáticamente.

Cada botón recuerda su propio estado. Cerrar y reabrir FOF (o reiniciar el equipo) siempre muestra exactamente dónde te detuviste.

---

## ✨ Sesiones de Configuración

| # | Sesión | Qué hace |
|---|---|---|
| 1 | 🚀 Primeros Pasos | Actualización completa del sistema + RPM Fusion + Flathub + eliminación opcional del repositorio Fedora Flatpak |
| 2 | 🔤 Códecs y Compatibilidad | Códecs multimedia, reproducción de DVD comercial (tainted), fuentes Microsoft |
| 3 | 🖥️ Hardware | AMD (Vulkan/Mesa/RADV, VA-API, CoreCtrl, LACT, overclock), NVIDIA (controlador propietario, modeset), mandos (grupo input) |
| 4 | 🎬 Producción Multimedia | OBS Studio, EasyEffects, streaming, qpwgraph, HandBrake, wf-recorder |
| 5 | 📦 Aplicaciones Recomendadas | ~45 apps vía Flatpak (productividad, multimedia, gráficos, internet, edición de vídeo/audio, nube) |
| 6 | 🏠 Hogar y Oficina | CUPS, Samba/LocalSend/Warpinator, KeePassXC, Okular+Tesseract (PDF+OCR) |
| 7 | 🎮 Gaming | Launchers, Wine/Proton/NTSYNC, GameMode/MangoHud/Gamescope, ProtonUp-Qt, vkBasalt, emuladores, anti-cheat awareness |
| 8 | 📱 Waydroid | Android en Linux vía COPR, GApps, libndk/libhoudini, Magisk, Widevine, SmartDock |
| 9 | 📊 Diagnóstico | Panel del sistema, top procesos, particiones, GSmartControl, CoolerControl, journal, **estado de optimizaciones** |
| 10 | 🛠️ Ajustes y Mantenimiento | Ajustes de rendimiento, audio, DNF, idioma, dual-boot, limpieza, kernels, GRUB |
| 11 | 🐧 Estado de Fedora | Versión, detección de Atomic/Silverblue, SELinux (estado, AVCs, setroubleshoot, GUI) |
| 12 | 📖 Acerca de FOF | Sobre el proyecto + actualizar/desinstalar FOF + changelog dinámico |

---

## 🎨 Características

- **Tema claro/oscuro** — alternancia en tiempo real, preferencia guardada
- **Multiidioma** — PT-BR, EN, ES con cambio en tiempo real
- **Registros en tiempo real** vía SSE, expandidos por defecto
- **Icono de desinstalar** al lado de cada app Flatpak instalada
- **Detección de Flatpak eliminado externamente** — si el usuario borra la app por fuera, el botón de FOF vuelve al estado inicial
- **Barra de progreso global** en el header (N/M sesiones completadas)
- **Toasts + notificaciones nativas** al completar tareas largas (>30s)
- **Autenticación segura** vía pkexec/kdesu con whitelist de comandos de solo lectura
- **Doble persistencia** — servidor local + localStorage
- **Limpieza automática de IDs huérfanos** — sesiones renombradas no dejan residuos en el progreso
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
├── producao-multimidia.html         # Sesión 4
├── aplicativos.html                 # Sesión 5
├── casa-escritorio.html             # Sesión 6
├── gaming.html                      # Sesión 7
├── waydroid.html                    # Sesión 8
├── diagnostico.html                 # Sesión 9
├── ajustes-manutencao.html          # Sesión 10
├── estado-fedora.html               # Sesión 11
├── sobre-fof.html                   # Sesión 12
├── template-sessao.html             # Plantilla para nuevas sesiones
├── CHANGELOG.md                     # Historial de cambios (leído por FOF)
├── server.js                        # Servidor Node.js + SSE + endpoints
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

- Autenticación vía **pkexec/kdesu** (nunca expone contraseñas)
- **Whitelist** de comandos de solo lectura sin autenticación (`rpm -q`, `uname -r`, `flatpak`, `systemctl --user`, `gtk-launch`)
- **Sanitización** de entrada y validación de `idComando`
- **Rate limiting** de 1.5s por `idComando`
- **Rotación automática de registros** (7 días en `/tmp/fof-*.log`)

---

## 🎯 Changelog

El historial completo de cambios está en [`CHANGELOG.md`](CHANGELOG.md). FOF mismo muestra el changelog de la versión actual dentro de la sesión **Acerca de FOF** — cargado dinámicamente del archivo.

### v1.0.0-09282026 (Actual) 🚧

- Reestructuración completa de las sesiones (13 → 12), con IDs semánticos (sin número)
- Nueva sesión **Ajustes y Mantenimiento** agrupa ajustes de rendimiento, audio, DNF, idioma, dual-boot, limpieza, kernels y GRUB
- Nueva sesión **Acerca de FOF** agrupa el texto institucional, actualización y desinstalación del FOF
- Eliminadas: sesión **Restauración** (Btrfs-Assistant) y página **Mantenimiento** (contenido redistribuido)
- Pantalla inicial rediseñada: reloj en vivo y tarjeta única con texto + botón "Iniciar"
- Búsqueda global (Ctrl+K) eliminada — presentaba problemas en WebKitGTK
- Sesión **Primeros Pasos** ganó opción de eliminar el repositorio Fedora Flatpak (con aviso explícito sobre eliminación de datos)
- Changelog dinámico vía `GET /changelog`
- Botón "Ver changelog completo" corregido (usaba `window.open`, bloqueado por WebKitGTK)
- `install.sh --update` ahora limpia archivos de sesiones antiguas antes del `git pull`
- El progreso limpia automáticamente IDs huérfanos al inicio
- Badge de actualización apunta a `guiado.html?session=sobre-fof`

### v1.0.0-09232026 ✅

- Verificación automática de actualizaciones vía GitHub Releases
- Popup post-actualización
- Icono de desinstalar en cada app Flatpak
- Detección de Flatpak eliminado externamente
- Panel "Ajustes de Rendimiento" en Diagnóstico

### v1.0.0 ✅

- Versión inicial pública

---

## ➕ Cómo añadir una sesión

1. Copia `template-sessao.html` a `<nombre>.html` (sin número)
2. Rellena los placeholders
3. Añade una entrada al array `SESSOES` en `script.js` (con `id: '<nombre>'`)
4. Añade el emoji a `ICONES_SESSOES` en `guiado.html`
5. Añade las claves i18n a `locales/en.json` y `locales/es.json` (y también al HTML como fallback PT-BR)

El orden de visualización viene de la posición de la entrada en el array `SESSOES`, no del nombre del archivo.

---

## 🌐 Cómo añadir un idioma

1. Copia `locales/en.json` a `locales/XX.json`
2. Traduce los valores (mantén las claves)
3. Añade `XX` a `LANGS_DISPONIVEIS` (`i18n.js`) y `LANGS_SUPORTADOS` (`server.js`)
4. Añade la opción al array `opcoes` de `criarSeletorIdioma()`

**Nota:** el idioma predeterminado (pt-BR) **no tiene archivo JSON** a propósito. El HTML de cada sesión contiene el texto en portugués como fallback, y `i18n.js` hace corto-circuito cuando el idioma es el predeterminado — nunca dispara `fetch` a `/locales/pt-BR.json`. Esto evita mantener strings duplicadas.

---

## 🏷️ Cómo publicar una versión

1. Edita `package.json` → `"version": "1.0.0-<NUEVA>"`
2. Edita `i18n.js` → `FALLBACK_VERSION = '1.0.0-<NUEVA>'` (única excepción a la regla de fuente única — usado como cache-buster antes de que `/info` responda)
3. Añade una sección nueva al inicio de `CHANGELOG.md`, con encabezado exactamente `## v1.0.0-<NUEVA>` (que coincida con el `package.json`)
4. Crea el tag/release en GitHub con el mismo nombre

Todo lo demás (banner del `install.sh`, badge del FOF, `--help` del contenedor) es automático.

---

## 🤝 Contribuir

1. Fork → branch → commit → push → Pull Request

## 🐛 Reportar errores

Abre un issue en [github.com/vitaotek/Fedora-Only-Fans/issues](https://github.com/vitaotek/Fedora-Only-Fans/issues) incluyendo:
- Versión de Fedora
- Entorno de escritorio
- Registros (`/tmp/fof-*.log`)
- Pasos para reproducir

## ⚠️ Aviso legal

Proyecto en desarrollo (alpha). Uso en producción bajo tu propio riesgo. **Haz siempre copia de seguridad** antes de alterar el sistema.

## 📄 Licencia

**GPL-3.0** — ver [LICENSE](LICENSE).

## 👤 Autor

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Agradecimientos

[Fedora Project](https://getfedora.org/) · [RPM Fusion](https://rpmfusion.org/) · [Flathub](https://flathub.org/)

**Hecho con ❤️ para la comunidad Fedora**
