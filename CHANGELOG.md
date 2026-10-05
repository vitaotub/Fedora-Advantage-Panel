# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> Use apenas `## vX.Y.Z-...` para os cabeçalhos de versão. Dentro de uma
> seção, use `###` para subseções — um `##` no meio encerra a captura.
> Versões anteriores ficam nas releases do GitHub.

---

## v1.0.0-10052026.b

### ✨ Novidades

- **Lixeiras para apps não-Flatpak**: Samba, KeePassXC, Okular, Wine, Winetricks, GameMode, MangoHud, Goverlay, Gamescope, vkBasalt, Gamescope Session, Teste de Controle, Lightworks, QEMU/KVM, VirtualBox e GNOME Boxes agora têm lixeira ao lado do botão de instalar — mesmo visual dos Flatpaks.
- **Botão "Remover completamente"** para Rclone Manager e NTSYNC — remove pacotes e resíduos (arquivos de config, módulos, serviços), com dupla confirmação.
- **Botões "Abrir"** adicionados em: LocalSend, Warpinator, KeePassXC, Okular, OBS Studio, EasyEffects, Steam, Heroic, Lutris e Bottles.
- **Steam agora é instalado nativamente** (via RPM Fusion) em vez de Flatpak — necessário para a sessão Gamescope reconhecê-lo. Seus jogos ficam em `~/.steam/` e são preservados.
- **Apps abertos pelo FAP sobrevivem ao fechar o FAP** — todos os "Abrir" usam `setsid -f`, comportamento idêntico a clicar no atalho do menu do Fedora.
- **Sessão Waydroid reseta após desinstalar** — todos os botões voltam ao estado inicial, sem falsos "✅ concluído".

### 🔧 Correções

- Botão de lixeira dos apps não-Flatpak não fazia nada (bug silencioso).
- Botão "Abrir" do Rclone Manager não funcionava.
- Botão "Remover completamente" do Rclone Manager não removia o pacote principal.
- `{nome}` aparecia literalmente nos logs em PT-BR.
- **Gamescope e Gamescope Session**: o `gamescope` é instalado do repositório oficial do Fedora (sem dependência de terceiros). O script de sessão (`gamescope-session-steam`) vem do COPR `pvermeer`, que tem build específica para Fedora 43/44/45.
- Detecção de Flatpaks instalados por fora agora funciona no boot.

### 🎯 Melhorias

- Botão "Abrir" some imediatamente ao remover o app.
- Preset de GameMode + MangoHud agora é one-shot (trava após aplicar).
- Removido o botão "Instalar Rclone" — o Rclone Manager já oferece instalá-lo internamente.
- Logs de abertura de apps agora vão para `/tmp/fap-open-<id>.log` — permite diagnosticar falhas de abertura em vez de descartar a saída em `/dev/null`.
