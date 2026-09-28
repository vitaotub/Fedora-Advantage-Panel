# <img src="icone_app.png" width="55" align="center"> Fedora Only Fans (FOF)

**🌐 Idioma:** [Português (BR)](README.md) | [English](README.en.md) | Español

![Versión](https://img.shields.io/badge/Versi%C3%B3n-v1.0.0--09272026-orange?style=flat-square)
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

FOF tiene **dos puntos de entrada**:

- **🧭 Iniciar Configuración** — paso a paso, una sesión a la vez, con navegación Anterior/Siguiente y menú fijo en la parte superior. El orden importa para el resultado final.
- **🛠️ Mantenimiento** — tareas sueltas que no dependen del orden: limpieza, kernels, GRUB, actualizar y desinstalar el FOF.

Cada botón recuerda su propio estado. Cerrar y reabrir FOF (o reiniciar el equipo) siempre muestra exactamente dónde te detuviste.

---

## ✨ Sesiones de Configuración

| # | Sesión | Qué hace |
|---|---|---|
| 1 | 👋 Bienvenida | Presentación + `dnf upgrade --refresh` completo |
| 2 | ⚙️ Optimización | DNF paralelo, idioma PT-BR, dual-boot, **ajustes de rendimiento** (`vm.max_map_count`, `swappiness`/`vfs_cache_pressure`, TCP BBR) |
| 3 | 📦 Repositorios | RPM Fusion (free + nonfree), Flathub |
| 4 | 🔤 Códecs y Compatibilidad | Códecs multimedia, reproducción de DVD comercial (tainted), fuentes Microsoft |
| 5 | 🖥️ Hardware | AMD (Vulkan/Mesa/RADV, VA-API, CoreCtrl, LACT, overclock), NVIDIA (controlador propietario, modeset), mandos (grupo input) |
| 6 | 🎮 Gaming | Launchers, Wine/Proton/NTSYNC, GameMode/MangoHud/Gamescope, ProtonUp-Qt, vkBasalt, emuladores, bufferbloat, anti-cheat awareness, actualización de Flatpaks |
| 7 | 🎬 Producción Multimedia | OBS Studio, EasyEffects, **realtime-setup**, **PipeWire baja latencia**, streaming, qpwgraph, HandBrake, wf-recorder |
| 8 | 📱 Waydroid | Android en Linux vía COPR, GApps, libndk/libhoudini, Magisk, Widevine, SmartDock, waydroid-helper |
| 9 | 📦 Aplicaciones Recomendadas | ~45 apps vía Flatpak (productividad, multimedia, gráficos, internet, edición de vídeo/audio, nube) |
| 10 | 🏠 Casa Lista | CUPS, Samba/LocalSend/Warpinator, KeePassXC, Okular+Tesseract (PDF+OCR) |
| 11 | 📊 Diagnóstico | Panel del sistema, top procesos, particiones, Baobab, GSmartControl, CoolerControl, journal, **estado de optimizaciones** |
| 12 | 🐧 Fedora | Versión, detección de Atomic/Silverblue, SELinux (estado, AVCs, setroubleshoot, GUI) |

## 🛠️ Mantenimiento

- **Fedora** — limpieza de caché, gestión de kernels, configuración de GRUB
- **FOF** — actualizar, desinstalar, changelog

---

## 🎨 Características

- **Tema claro/oscuro** — alternancia en tiempo real, preferencia guardada
- **Multiidioma** — PT-BR, EN, ES con cambio en tiempo real
- **Registros en tiempo real** vía SSE, expandidos por defecto
- **Búsqueda global (Ctrl+K)** en cualquier página
- **Icono de desinstalar** al lado de cada app Flatpak instalada
- **Detección de Flatpak eliminado externamente** — si el usuario borra la app por fuera, el botón de FOF vuelve al estado inicial
- **Barra de progreso global** en el header (N/M sesiones completadas)
- **Toasts + notificaciones nativas** al completar tareas largas (>30s)
- **Autenticación segura** vía pkexec/kdesu con whitelist de comandos de solo lectura
- **Doble persistencia** — servidor local + localStorage
- **Contenedor nativo WebKitGTK** (sin navegador externo)
- **Versión centralizada** en `package.json`

---

## 📂 Estructura

```
Fedora-Only-Fans/
├── index.html                       # Landing page (elección de modo)
├── guiado.html                      # Configuración paso a paso
├── manutencao.html                  # Mantenimiento (Fedora + FOF)
├── style.css                        # CSS compartido
├── script.js                        # JS compartido (sesiones, progreso, búsqueda)
├── i18n.js                          # Módulo i18n (PT-BR / EN / ES)
├── locales/
│   ├── pt-BR.json                   # Traducciones (predeterminado)
│   ├── en.json                      # Traducciones EN
│   └── es.json                      # Traducciones ES
├── 00-boas-vindas.html              # Sesión 1
├── 01-restauracao.html              # Sesión 2
├── 02-otimizacao.html               # Sesión 3
├── 03-repositorios.html             # Sesión 4
├── 04-codecs-compatibilidade.html   # Sesión 5
├── 05-hardware.html                 # Sesión 6
├── 06-gaming.html                   # Sesión 7
├── 07-loja.html                     # Sesión 8
├── 08-waydroid.html                 # Sesión 9
├── 09-softwares-uteis.html          # Sesión 10
├── 10-casa-pronta.html              # Sesión 11
├── 11-diagnostico.html              # Sesión 12
├── 12-fedora.html                   # Sesión 13
├── template-sessao.html             # Plantilla para nuevas sesiones
├── server.js                        # Servidor Node.js + SSE
├── iniciar_fof.sh                   # Script de inicio
├── iniciar_fof_compat.sh            # Modo compatibilidad
├── install.sh                       # Instalador / desinstalador
├── build-container.sh / Makefile    # Build del contenedor nativo
├── src/fof-container.c              # Contenedor WebKitGTK (C + GTK3)
├── package.json                     # Deps Node + versión del FOF
├── icone_app.png                    # Icono de la app
└── LICENSE                          # GPL-3.0
```

---

## 🛠️ Tecnologías

- **HTML5 / CSS3** — interfaz responsive, tema claro/oscuro
- **JavaScript puro** — peticiones a la API local, i18n, búsqueda global, dashboard
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

### v1.0.0-09272026 (Actual) 🚧

**Reestructuración de sesiones**
- ✅ Sesión **04-codecs-compatibilidade** reemplaza `04-fontes.html` — agrupa códecs + tainted + fuentes MS en una narrativa de compatibilidad
- ✅ Sesión **03-repositorios** simplificada (solo RPM Fusion + Flathub)

**Nuevos ajustes de rendimiento (todos con par aplicar/revertir)**
- ✅ Sesión 02: `vm.max_map_count`, `vm.swappiness` + `vfs_cache_pressure`, TCP BBR
- ✅ Sesión 07: `realtime-setup` (grupo realtime) y PipeWire en baja latencia

**Gaming**
- ✅ NTSYNC ahora carga el módulo inmediatamente + persiste vía `modules-load.d`
- ✅ Nuevo botón "Actualizar Apps Flatpak" (sesiones 06 y 09)
- ✅ Aviso educativo sobre Gamescope + NVIDIA + Flatpak

**Apps Flatpak**
- ✅ Icono de papelera al lado de cada app Flatpak instalada (sesiones 06, 07, 09, 10)
- ✅ **Detección de Flatpak eliminado externamente** — el botón vuelve al estado inicial automáticamente

**Diagnóstico**
- ✅ Nuevo panel "Ajustes de Rendimiento" (KSM, max_map_count, TCP BBR, PipeWire quantum)

**Backend**
- ✅ `systemctl --user` en la whitelist + contexto de env generalizado
- ✅ Nuevo endpoint `/flatpak-installed`
- ✅ `/system-info` extendido con 5 campos nuevos

### v1.0.0-09232026 ✅

- ✅ Verificación automática de actualizaciones vía GitHub Releases (badge ⬆️ en el header)
- ✅ Popup post-actualización (avisa para reiniciar el FOF)
- ✅ Sesión 00 reformulada en 2 acordeones
- ✅ Sesión Gaming con aviso detallado sobre NTSYNC
- ✅ Registros de sesión expandidos por defecto; altura uniforme (120–200px)
- ✅ Header con controles inline junto al título

- □ ?

---

## ➕ Cómo añadir una sesión

1. Copia `template-sessao.html` a `NN-nombre.html`
2. Rellena los placeholders
3. Añade una entrada al array `SESSOES` en `script.js`
4. (Opcional) Añade el icono a `ICONES_SESSOES` en `guiado.html`
5. (Opcional) Añade las traducciones a los 3 JSONs de locale

---

## 🌐 Cómo añadir un idioma

1. Copia `locales/pt-BR.json` a `locales/XX.json`
2. Traduce los valores (mantén las claves)
3. Añade `XX` a `LANGS_DISPONIVEIS` (`i18n.js`) y `LANGS_SUPORTADOS` (`server.js`)
4. Añade la opción al array `opcoes` de `criarSeletorIdioma()`

---

## 🏷️ Cómo publicar una versión

1. Edita `package.json` → `"version": "1.0.0-<NUEVA>"`
2. Edita `i18n.js` → `FALLBACK_VERSION = '1.0.0-<NUEVA>'` (única excepción a la regla de fuente única)
3. Crea el tag/release en GitHub con el mismo nombre

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
