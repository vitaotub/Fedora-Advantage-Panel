# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Idioma:** [Português (BR)](README.md) | [English](README.en.md) | Español

![Versión](https://img.shields.io/badge/Versi%C3%B3n-v1.4.7--11052026-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44%20%7C%2045-294172?style=flat-square&logo=fedora)
![Licencia](https://img.shields.io/badge/Licencia-GPL--3.0-green?style=flat-square)
![Idiomas](https://img.shields.io/badge/Idiomas-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Dejando tu Fedora listo para el "play" — visual, rápido y sin terminal.

## 📖 Qué es

**Fedora Advantage Panel (FAP)** es un panel de automatización visual para Fedora Linux. Transforma una instalación limpia en un sistema completo — códecs, controladores, repositorios, herramientas — a través de clics, sin abrir la terminal.

Un único botón, **Iniciar Configuración**, te lleva por **13 sesiones guiadas** paso a paso. Cada botón recuerda su propio estado: cierra FAP, vuelve a abrirlo, y muestra exactamente dónde te detuviste.

## 📸 Capturas de pantalla

### Página de inicio — tu Fedora de un vistazo

![Página de inicio del FAP](prints/01-landing.png)

Barras de progreso por grupo (Uso general, Gaming, Producción, Seguridad), con la línea *"Faltan {n} pasos para dejar Fedora completo."*

### Navegación lateral + búsqueda

![Barra lateral del FAP](prints/02-sidebar.png)

Barra lateral retráctil con las 13 sesiones, indicador de progreso por sesión y búsqueda global. En modo colapsado, cada ícono recibe un efecto neón al pasar el mouse.

### Origen de cada paquete, filtros e insignias

![Filtros y origen de paquetes del FAP](prints/03-filtros.png)

Cada app muestra de dónde viene (Flathub, Fedora, RPM Fusion, Fabricante, Descarga o Comunidad). Haz clic en la insignia para ver el comando exacto, cómo actualizar y cómo eliminar. Filtros combinables (estado + origen) en la sesión 6.

### Registro en tiempo real con tema Matrix

![Registro en tiempo real del FAP](prints/04-log.png)

Terminal fijo en la parte inferior, con colores que distinguen salida normal, éxito y error real. Comienza colapsado.

## 🎯 Para quién es

- **Quien está migrando de Windows 10 u 11 a Fedora** y quiere una transición práctica, sin terminal.
- **Quien está empezando con Fedora** y quiere dejarlo listo para uso diario.
- **Quien viene de Ubuntu/Mint** y quiere la misma fluidez de configuración inicial.
- **Quien juega en Linux** y quiere Steam, Heroic, Lutris, Proton, MangoHud y similares.
- **Quien administra la PC de otra persona** sin terminal.

## 🚀 Instalación

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
```

> **💡 ¿No sabes cómo ejecutar ese comando?**
>
> 1. **Copia el comando completo** — selecciona el texto de arriba y cópialo.
> 2. **Abre la terminal** — busca **"Terminal"** en el menú de aplicaciones. El atajo `Ctrl+Alt+T` también funciona en la mayoría de los escritorios.
> 3. **Pega el comando** — `Ctrl+Shift+V` o clic derecho → **Pegar**.
> 4. **Presiona `Enter`** — el instalador pedirá tu contraseña de administrador (la misma del login). Es normal — está pidiendo permiso para instalar los paquetes del sistema.
>
> Al terminar, abre FAP escribiendo `fap` en la terminal o buscando **"Fedora Advantage Panel"** en el menú.

**Comandos tras instalar:**

```bash
fap              # inicia FAP
fap-compat       # modo compatibilidad (GPUs antiguas, VMs)
```

Para **actualizar**: haz clic en el **badge de actualización** (esquina superior de la pantalla de inicio) o usa el botón **"🔄 Actualizar FAP"** en la sesión **Acerca de FAP**.
Para **desinstalar**: usa el botón **"🗑️ Desinstalar FAP"** en la sesión **Acerca de FAP**.

Las actualizaciones se aplican **sobre la instalación existente** — el progreso, el tema y el idioma se conservan.

## ✨ Las 13 Sesiones

| # | Sesión | Qué hace |
|---|---|---|
| 1 | 🚀 Primeros Pasos | Actualización, RPM Fusion, Flathub, Terra Repository |
| 2 | 🔤 Códecs | Códecs completos, DVD comercial, fuentes Microsoft |
| 3 | 🖥️ Hardware | Controladores AMD/NVIDIA/Intel, CoreCtrl, LACT, overclock, VA-API |
| 4 | 🔌 Dispositivos | Detección automática, COPRs de red, mandos, firmware |
| 5 | 🎬 Producción Multimedia | OBS Studio, cámara virtual, EasyEffects |
| 6 | 📦 Aplicaciones | Flatpaks, 20+ apps `dnf`, ArtCraft, acceso remoto, utilidades |
| 7 | 🏠 Hogar y Oficina | CUPS, Samba, LocalSend, KeePassXC |
| 8 | 🎮 Gaming | Steam, Heroic, Lutris, Wine, GameMode, emuladores, NTSYNC |
| 9 | 🖥️ Virtualización | QEMU/KVM, VirtualBox, GNOME Boxes |
| 10 | 📊 Diagnóstico | Panel del sistema, SMART, temperaturas, CoolerControl, journal |
| 11 | 🛠️ Ajustes y Mantenimiento | Ajustes, DNF, dual-boot, GRUB, kernels, **actualización de Fedora 44 → 45**, **acciones post-actualización** |
| 12 | 🐧 Estado de Fedora | Versión, Atomic/Silverblue, SELinux |
| 13 | 📖 Acerca de FAP | Actualizar/desinstalar, changelog |

**Sesión 11 en foco:** detecta cuando Fedora 45 está disponible, descarga los paquetes y reinicia para actualizar. Tras el reinicio, muestra las **acciones post-actualización recomendadas por la documentación oficial de Fedora** — limpieza básica, `rpmconf`, `distro-sync`, relabel SELinux, regeneración del rescue kernel. Un checkbox "Ya migré a Fedora 45…" oculta el área cuando terminas.

## 🛡️ Seguridad y transparencia

- **Nunca instala nada sin que lo veas.** Todo comando es visible en el registro en tiempo real.
- **Detección de preexistencia.** Apps instaladas antes de FAP aparecen como "Abrir" desde el inicio.
- **Ítems críticos protegidos.** Controladores propietarios, códecs, CUPS, Samba, virtualización: si existían antes, la papelera no aparece.
- **Backup antes de sobrescribir.** Los presets de GameMode + MangoHud hacen backup de los archivos del usuario antes de aplicar.
- **Autenticación vía `pkexec`.** Diálogo de contraseña nativo. El script a ejecutar se registra en el log **antes** de que pkexec abra — ves lo que autorizas.
- **Auditoría en archivo.** Cada `pkexec` deja rastro en `/tmp/fap-audit-*.log` (eliminado en 7 días).
- **Protección contra CSRF local.** El endpoint `/executar` rechaza peticiones con `Origin` de otro host. Una página maliciosa no puede disparar comandos en el FAP vía `fetch(..., { mode: 'no-cors' })`.
- **Consciente de Secure Boot.** Al instalar el driver NVIDIA con Secure Boot activo, el FAP guía al usuario por el enrollment MOK (kmodgenca + mokutil) antes de instalar — sin eso, el módulo no cargaría.
- **Contenedor WebKitGTK nativo.** Interfaz propia, sin depender de Firefox/Chromium.
- **`install.sh` se niega a ejecutarse como root.** Instala en `~/.local/share` y usa `sudo` solo donde hace falta.

## 🖥️ Requisitos

- **Fedora 44 o 45.**
- **GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3** y otros tiling WMs.
- **PT-BR, EN y ES.**

## 🔄 Actualizar y desinstalar

```bash
./install.sh --update     # o haz clic en el badge dentro de FAP
./install.sh --uninstall  # o usa el botón en "Acerca de FAP"
```

## 🐛 Feedback

Abre un [issue](https://github.com/vitaotub/Fedora-Advantage-Panel/issues) con la salida de `/tmp/fap-*.log` y la versión de Fedora. Las capturas de pantalla ayudan mucho.

## 📄 Licencia

**GPL-3.0** — ver [LICENSE](LICENSE).

## 👤 Autor

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Agradecimientos

[![Fedora Project](https://img.shields.io/badge/Fedora-Project-294172?style=flat-square&logo=fedora&logoColor=white)](https://getfedora.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://www.deepseek.com/)

**Hecho con ❤️ para la comunidad Fedora**
