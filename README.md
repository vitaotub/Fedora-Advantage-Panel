# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Idioma:** Português (BR) | [English](README.en.md) | [Español](README.es.md)

![Versão](https://img.shields.io/badge/Vers%C3%A3o-v1.5.8--11112026-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44%20%7C%2045-294172?style=flat-square&logo=fedora)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-GPL--3.0-green?style=flat-square)
![Idiomas](https://img.shields.io/badge/Idiomas-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Deixando o seu Fedora pronto para o "play" — visual, rápido e sem terminal.

## 📖 O que é

O **Fedora Advantage Panel (FAP)** transforma uma instalação limpa do Fedora num sistema completo — codecs, drivers, repositórios, ferramentas, apps — através de cliques, sem abrir o terminal. Um único botão, **Iniciar Configuração**, leva você por sessões guiadas passo a passo. Cada botão lembra seu próprio estado: feche o FAP, reabra, e ele mostra exatamente onde você parou.

## 📸 Telas

<table>
<tr>
<td align="center" width="50%">
<img src="prints/01-landing.png" alt="Tela inicial"><br>
<sub><b>Tela inicial</b> — progresso por grupo, frase-guia e botão único</sub>
</td>
<td align="center" width="50%">
<img src="prints/02-sidebar.png" alt="Sidebar"><br>
<sub><b>Sidebar</b> — 13 sessões, progresso por sessão e busca global</sub>
</td>
</tr>
<tr>
<td align="center" width="50%">
<img src="prints/03-filtros.png" alt="Filtros e badges"><br>
<sub><b>Filtros e badges</b> — origem de cada pacote, filtros combináveis</sub>
</td>
<td align="center" width="50%">
<img src="prints/04-log.png" alt="Log Matrix"><br>
<sub><b>Log em tempo real</b> — tema Matrix, inicia recolhido</sub>
</td>
</tr>
</table>

## 🚀 Instalação

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
```

> **💡 Não sabe como rodar esse comando?**
>
> 1. **Copie o comando inteiro** — selecione o texto acima e copie.
> 2. **Abra o terminal** — procure **"Terminal"** no menu de aplicativos. O atalho `Ctrl+Alt+T` também funciona na maioria dos desktops.
> 3. **Cole o comando** — `Ctrl+Shift+V` ou clique com o botão direito → **Colar**.
> 4. **Pressione `Enter`** — o instalador vai pedir sua senha de administrador (a mesma do login). É normal — ele está pedindo permissão para instalar os pacotes do sistema.
>
> Ao final, abra o FAP digitando `fap` no terminal ou procurando por **"Fedora Advantage Panel"** no menu.

## 💡 O que você ganha

- **Multimídia pronta** — codecs completos, DVD comercial, fontes Microsoft, aceleração de vídeo por hardware (VA-API em AMD, Intel e NVIDIA).
- **Drivers que funcionam** — detecção automática de GPU, série correta por geração (do Fermi ao Blackwell), CoreCtrl / LACT, overclock, `akmods` com enrollment MOK guiado.
- **Rede e periféricos** — Broadcom, Realtek, Xbox Wireless (xpadneo), Razer (OpenRazer), firmware adicional, tudo com detecção de hardware.
- **Ambiente de jogos** — Steam nativo, Heroic, Lutris, Wine, Proton-GE (ProtonUp-Qt), GameMode, MangoHud, Gamescope, vkBasalt, NTSYNC, emuladores (RetroArch, Dolphin, PCSX2, RPCS3, Duckstation).
- **Produção e escritório** — OBS Studio + câmera virtual, EasyEffects, CUPS + Avahi, Samba, LocalSend, KeePassXC, Rclone Manager, ArtCraft Launcher.
- **Virtualização** — QEMU/KVM + virt-manager, VirtualBox, GNOME Boxes, com avisos de Secure Boot.
- **Diagnóstico** — painel do sistema, top 5 processos, partições, journal, GSmartControl (SMART), CoolerControl (temperaturas + curvas de fan).
- **Ajustes reversíveis** — `vm.max_map_count`, `vm.swappiness`, TCP BBR, realtime para áudio, dual-boot RTC, DNF paralelo, GRUB, kernels.
- **Upgrade 44 → 45 guiado** — detecção automática de disponibilidade, warnings de terceiros (NVIDIA, Broadcom, COPRs, Terra), download, reboot agendado e ações pós-upgrade (`rpmconf`, `distro-sync`, relabel SELinux, rescue kernel).
- **Multi-idioma** — PT-BR, EN e ES, com fallback PT-BR no HTML e JSON sob demanda.

## 🛡️ Segurança e transparência

- **Nunca instala nada sem você ver.** Todo comando é visível no log em tempo real.
- **Detecção de pré-existência.** Apps instalados antes do FAP aparecem como "Abrir" desde o início.
- **Itens críticos protegidos.** Drivers proprietários, codecs, CUPS, Samba, virtualização: se já existiam, a lixeira não aparece.
- **Backup antes de sobrescrever.** Presets de GameMode + MangoHud fazem backup dos arquivos do usuário antes de aplicar — e a lixeira restaura.
- **Autenticação via `pkexec`.** Diálogo de senha nativo. O script a executar é logado **antes** do pkexec abrir — você vê o que está autorizando.
- **Auditoria em arquivo.** Cada `pkexec` deixa trilha em `/tmp/fap-audit-*.log` (removida em 7 dias).
- **Proteção contra CSRF local.** `/executar` e `/shutdown` rejeitam requisições com `Origin` de outros hosts. `/executar` também bloqueia `>` (redirecionamento de arquivo) que não seja dup-fd legítimo (`2>&1`, `1>&2`, `>&2`) — fecha o vetor de sobrescrita de `~/.bashrc`.
- **Ciente de Secure Boot.** Ao instalar qualquer `akmod-*` com Secure Boot ativo, o FAP guia pelo enrollment MOK (kmodgenca + mokutil) antes de instalar. Se o usuário já tem uma chave enrolled (de qualquer origem), o FAP detecta e esconde as instruções.
- **Container nativo WebKitGTK.** Interface própria, sem depender de Firefox/Chromium.
- **`install.sh` recusa rodar como root.** Instala em `~/.local/share` e usa `sudo` apenas onde precisa.

## 🖥️ Requisitos

- **Fedora 44 ou 45.** Ambos são **oficialmente suportados**. O desenvolvimento e os testes ativos focam em **Fedora 45 e futuras versões**, mas o Fedora 44 continua homologado — todos os comandos do FAP são testados nas duas versões.
- **GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3** e outros tiling WMs.
- **PT-BR, EN e ES.**

## 🔄 Atualizar e desinstalar

```bash
./install.sh --update     # ou clique no badge dentro do FAP
./install.sh --uninstall  # ou use o botão em "Sobre o FAP"
```

Atualizações são feitas em cima da instalação existente — progresso, tema e idioma são preservados.

## 🧹 Solução de problemas

### O FAP não instala ou não abre, mesmo desinstalando e reinstalando

Se você já rodou `./install.sh --uninstall` e a reinstalação continua falhando (servidor não sobe, janela fecha em ~15s, `git pull` com conflito, permissões perdidas em `.sh`), pode haver resíduos de instalações antigas que o uninstall padrão não cobriu. Nesse caso, use o script de limpeza pesada (que fica em `scripts/`):

```bash
sudo bash ~/.local/share/fedora-advantage-panel/scripts/fap-cleanup.sh
# ou, se instalou a partir de um clone de dev:
sudo bash ~/Downloads/fap/scripts/fap-cleanup.sh
```

> **⚠️ ATENÇÃO:** este script apaga **tudo** relacionado ao FAP, incluindo:
> - A instalação oficial em `~/.local/share/fedora-advantage-panel/`
> - O clone de dev em `~/Downloads/fap/` (se você tem commits locais não enviados, faça `git push` antes!)
> - O esquema antigo FOF (se você migrou dele)
> - `.progresso.json` — todo o histórico de botões clicados
> - Tema, idioma, filtros salvos
> - Os 3 `sysctl.d/99-fap-*` (tunings)
> - Entradas `PATH` nos rc files (com backup automático)
>
> **Não** remove pacotes instalados (Flatpak, DNF, akmods), COPRs, Terra, repos de fabricante, chave MOK, `/etc/chromium/master_preferences` ou presets do MangoHud/GameMode.

Depois de rodar o cleanup, reinstale do zero:

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
```

### Quando NÃO usar o `fap-cleanup.sh`

- **Para atualizar o FAP:** use o badge de atualização ou `./install.sh --update`. Nenhum dos dois precisa do cleanup.
- **Para desinstalar normalmente:** use o botão "Desinstalar" em **Sobre o FAP** ou `./install.sh --uninstall`. O desinstalar padrão já cobre tudo que o FAP instalou e preserva o histórico e o clone de dev.
- **Para limpar pacotes instalados pelo FAP:** o cleanup não remove pacotes (Flatpak, DNF, akmods) por design. Use o botão "Reverter" de cada sessão, ou remova manualmente com `flatpak uninstall <app>` / `sudo dnf remove <pkg>`.

### O aviso "reinicie o computador" não aparece após atualizar

`dnf needs-restarting -r` só retorna 1 quando um pacote crítico foi atualizado (kernel, glibc, systemd, dbus, openssl-libs, pam, selinux-policy, polkit). Se a sua atualização foi só de apps (Firefox, GIMP, VLC), o aviso **corretamente** não aparece. Para confirmar:

```bash
dnf needs-restarting -r; echo "Exit: $?"
# Exit: 0 → não precisa reiniciar
# Exit: 1 → precisa reiniciar (o aviso deve aparecer)
```

A partir da v1.5.5, se o próprio `dnf needs-restarting` falhar (RPM DB lock, `dnf5-plugins` ausente, timeout), o FAP mostra um banner neutro: *"Não foi possível verificar se é necessário reiniciar. Verifique no terminal: dnf needs-restarting -r"*.

## 🐛 Feedback

Abra uma [issue](https://github.com/vitaotub/Fedora-Advantage-Panel/issues) com a saída de `/tmp/fap-*.log` e a versão do Fedora. Print screens ajudam muito.

## 📄 Licença

**GPL-3.0** — veja [LICENSE](LICENSE).

## 👤 Autor

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Agradecimentos

[![Fedora Project](https://img.shields.io/badge/Fedora-Project-294172?style=flat-square&logo=fedora&logoColor=white)](https://getfedora.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://www.deepseek.com/)

**Feito com ❤️ para a comunidade Fedora**
