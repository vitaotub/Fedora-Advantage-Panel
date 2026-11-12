#!/usr/bin/env bash
# ============================================================
# Fedora Advantage Panel (FAP) — Limpeza pesada
# ============================================================
#
# ⚠️  AVISO IMPORTANTE — LEIA ANTES DE RODAR
#
# Este script APAGA TUDO relacionado ao FAP, incluindo:
#   • A instalação oficial em ~/.local/share/fedora-advantage-panel/
#   • O clone de dev em ~/Downloads/fap/
#     (se você tem commits locais não enviados, faça `git push` antes!)
#   • O esquema antigo FOF (~/.local/share/fedora-only-fans/)
#   • .progresso.json — todo o histórico de botões clicados
#   • Tema, idioma, filtros salvos
#   • Os 3 sysctl.d/99-fap-* (tunings)
#   • environment.d / PipeWire configs do FAP
#   • Entradas PATH nos rc files (com backup automático)
#
# O que NÃO é removido (intencionalmente):
#   • Pacotes instalados (Flatpak, DNF, akmods)
#   • COPRs, Terra, repos de fabricante
#   • Chave MOK (/etc/pki/akmods/)
#   • /etc/chromium/master_preferences
#   • Presets do MangoHud / GameMode (~/.config/)
#
# QUANDO USAR:
#   Somente quando você suspeita de resíduos de instalações
#   antigas e o FAP não consegue reinstalar nem rodando o
#   `install.sh --uninstall` padrão. Sintomas típicos:
#     • servidor não sobe após reinstalar
#     • janela fecha em ~15s sem mensagem
#     • conflito de merge em arquivos rastreados
#     • permissões perdidas em .sh
#
# QUANDO NÃO USAR:
#   • Para atualizar o FAP → use o badge ou `install.sh --update`
#   • Para desinstalar normalmente → use o botão "Desinstalar"
#     em Sobre o FAP ou `install.sh --uninstall`
#
# Uso:
#   sudo bash scripts/fap-cleanup.sh
#
# O script precisa de root porque mexe em /etc/sysctl.d/. Usa
# SUDO_USER para descobrir o home do usuário real.

set +e

# ============================================================
# DETECTAR USUÁRIO REAL
# ============================================================
REAL_USER="${SUDO_USER:-}"
if [ -z "$REAL_USER" ] || [ "$REAL_USER" = "root" ]; then
    echo "❌ Rode com sudo, como o SEU usuário normal:"
    echo "   sudo bash $0"
    echo ""
    echo "   (não rode como root direto)"
    exit 1
fi

REAL_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"
if [ -z "$REAL_HOME" ] || [ ! -d "$REAL_HOME" ]; then
    echo "❌ Não foi possível detectar o home de $REAL_USER."
    exit 1
fi

# ============================================================
# CABEÇALHO
# ============================================================
echo "============================================"
echo "  FAP — Limpeza pesada (resíduos)"
echo "============================================"
echo "Usuário: $REAL_USER ($REAL_HOME)"
echo ""
echo "⚠️  Este script vai APAGAR TUDO relacionado ao FAP:"
echo "   - ~/.local/share/fedora-advantage-panel/"
echo "   - ~/Downloads/fap/   ⚠️ (inclui commits locais não enviados!)"
echo "   - ~/.local/share/fedora-only-fans/"
echo "   - .progresso.json (histórico de botões clicados)"
echo "   - Tema, idioma e filtros salvos"
echo "   - Symlinks fap / fap-compat / fap-container"
echo "   - Atalhos .desktop e ícones do menu"
echo "   - Caches WebKitGTK (~/.cache/fap-container/, etc.)"
echo "   - environment.d e pipewire.conf.d do FAP"
echo "   - /etc/sysctl.d/99-fap-*.conf (tunings)"
echo "   - Logs /tmp/fap-* e /tmp/fof-*"
echo "   - Entradas PATH nos rc files (com backup)"
echo ""
echo "✅ NÃO remove (de SISTEMA, não do FAP):"
echo "   - Pacotes Flatpak, DNF e akmods instalados pelo FAP"
echo "   - COPRs, Terra, repos de fabricante"
echo "   - Chave MOK (/etc/pki/akmods/)"
echo "   - /etc/chromium/master_preferences"
echo "   - MangoHud/GameMode presets"
echo ""
echo "Você tem 5 segundos para cancelar (Ctrl+C)..."
sleep 5
echo ""

# ============================================================
# [1/9] MATAR PROCESSOS
# ============================================================
echo "[1/9] Matando processos FAP/FOF/container..."
pkill -9 -f "fap-container" 2>/dev/null
pkill -9 -f "fof-container" 2>/dev/null
# Órfãos do pkexec (Fase I): `fap-cmd-*` são os scripts
# temporários criados pelo pkexec; `pkexec /tmp/fap-cmd-` são os
# wrappers que podem ter ficado vivos. Como o script roda como
# root (via sudo), `pkill` alcança os dois.
pkill -9 -f "fap-cmd-" 2>/dev/null
pkill -9 -f "pkexec /tmp/fap-cmd-" 2>/dev/null
lsof -t -i:3000 2>/dev/null | xargs -r kill -9 2>/dev/null
sleep 1
echo "  OK"

# ============================================================
# [2/9] DIRETÓRIOS DE INSTALAÇÃO
# ============================================================
echo "[2/9] Removendo diretórios de instalação..."
rm -rf "$REAL_HOME/.local/share/fedora-advantage-panel"
rm -rf "$REAL_HOME/.local/share/fedora-only-fans"
rm -rf "$REAL_HOME/Downloads/fap"
echo "  OK"

# ============================================================
# [3/9] SYMLINKS
# ============================================================
echo "[3/9] Removendo symlinks do FAP e FOF..."
rm -f "$REAL_HOME/.local/bin/fap"
rm -f "$REAL_HOME/.local/bin/fap-compat"
rm -f "$REAL_HOME/.local/bin/fap-container"
rm -f "$REAL_HOME/.local/bin/fof"
rm -f "$REAL_HOME/.local/bin/fof-compat"
rm -f "$REAL_HOME/.local/bin/fof-container"
echo "  OK"

# ============================================================
# [4/9] ATALHOS E ÍCONES
# ============================================================
echo "[4/9] Removendo atalhos e ícones do menu..."
rm -f "$REAL_HOME/.local/share/applications/fap-container.desktop"
rm -f "$REAL_HOME/.local/share/applications/fap-container-compat.desktop"
rm -f "$REAL_HOME/.local/share/applications/fedora-advantage-panel.desktop"
rm -f "$REAL_HOME/.local/share/applications/fedora-advantage-panel-compat.desktop"
rm -f "$REAL_HOME/.local/share/applications/fof-container.desktop"
rm -f "$REAL_HOME/.local/share/applications/fof-container-compat.desktop"
rm -f "$REAL_HOME/.local/share/applications/fedora-only-fans.desktop"
rm -f "$REAL_HOME/.local/share/applications/fedora-only-fans-compat.desktop"
rm -f "$REAL_HOME/.local/share/icons/hicolor/256x256/apps/fap-container.png"
rm -f "$REAL_HOME/.local/share/icons/hicolor/256x256/apps/fof-container.png"
sudo -u "$REAL_USER" update-desktop-database "$REAL_HOME/.local/share/applications" 2>/dev/null
sudo -u "$REAL_USER" gtk-update-icon-cache -f -t "$REAL_HOME/.local/share/icons/hicolor" 2>/dev/null
echo "  OK"

# ============================================================
# [5/9] CACHES WEBKITGTK, DNF/LIBDNF5 ÓRFÃOS E CONFIG DO APP
# ============================================================
#
# `~/.cache/dnf/` e `~/.cache/libdnf5/` podem ter sido criados
# por versões do FAP anteriores à v1.5.9, que exportavam
# `HOME=<home-do-usuário>` no script do pkexec. Resultado: o
# `dnf` (rodando como root) escrevia cache com dono `root` no
# home do usuário.
#
# A v1.5.9 alinha o FAP com o padrão do Fedora: `dnf` via pkexec
# usa `/var/cache/dnf/` (system), não o cache do usuário. Mas os
# arquivos antigos ficam órfãos (não são mais lidos, mas ocupam
# espaço e o usuário não consegue apagar sem `sudo`).
#
# Como este script roda como root (via `sudo`), o `rm -rf`
# remove os arquivos `root-owned` sem precisar de `sudo -u`.
#
# ATENÇÃO: `~/.cache/dnf/` e `~/.cache/libdnf5/` também são
# usados pelo `dnf` quando o PRÓPRIO USUÁRIO o executa (ex.:
# `dnf search`). Se o dono do diretório for o usuário (não
# `root`), é cache LEGÍTIMO e NÃO deve ser apagado.
echo "[5/9] Removendo caches WebKitGTK, dnf/libdnf5 órfãos e config do FAP..."
rm -rf "$REAL_HOME/.cache/fap-container"
rm -rf "$REAL_HOME/.local/share/fap-container"
rm -rf "$REAL_HOME/.config/fap-container"
rm -rf "$REAL_HOME/.cache/fof-container"
rm -rf "$REAL_HOME/.local/share/fof-container"
rm -rf "$REAL_HOME/.config/fof-container"
# Caches do dnf/libdnf5 criados por versões antigas do FAP
# (root-owned no home do usuário). Só remove se o dono for `root`
# — se for user-owned, é cache legítimo do `dnf` do usuário e é
# preservado.
for cache_dnf in "$REAL_HOME/.cache/dnf" "$REAL_HOME/.cache/libdnf5"; do
    if [ -e "$cache_dnf" ]; then
        dono_cache=$(stat -c '%U' "$cache_dnf" 2>/dev/null || echo "")
        if [ "$dono_cache" = "root" ]; then
            rm -rf "$cache_dnf"
        fi
    fi
done
echo "  OK"

# ============================================================
# [6/9] environment.d, pipewire.conf.d E BACKUPS DE PRESETS
# ============================================================
echo "[6/9] Removendo variáveis de ambiente, config de áudio e backups de presets do FAP..."
rm -f "$REAL_HOME/.config/environment.d/99-fap-nvidia-vaapi.conf"
rm -f "$REAL_HOME/.config/pipewire/pipewire.conf.d/99-fap-quantum.conf"
# v1.5.6: `.fap-backup` é resíduo do FAP (criado pelo botão
# "Aplicar Presets" da Sessão 8, que sobrescreve MangoHud.conf
# e gamemode.ini do usuário). Se o usuário nunca clicou na
# lixeira, ficam órfãos. Removê-los é seguro — o original
# restaurado está em `.conf`/`.ini`.
rm -f "$REAL_HOME/.config/MangoHud/MangoHud.conf.fap-backup"
rm -f "$REAL_HOME/.config/gamemode.ini.fap-backup"
echo "  OK"

# ============================================================
# [7/9] TUNINGS DE SISTEMA (/etc/sysctl.d)
# ============================================================
echo "[7/9] Removendo tunings de sistema do FAP..."
rm -f /etc/sysctl.d/99-fap-vm-max-map-count.conf
rm -f /etc/sysctl.d/99-fap-vm-swappiness.conf
rm -f /etc/sysctl.d/99-fap-tcp-bbr.conf
sysctl --system > /dev/null 2>&1
echo "  OK — runtime revertido ao default do Fedora"

# ============================================================
# [8/9] LOGS E TEMPORÁRIOS
# ============================================================
echo "[8/9] Removendo logs e temporários do FAP/FOF..."
rm -f /tmp/fap-*.log
rm -f /tmp/fap-out-*.log
rm -f /tmp/fap-askpass-*.sh
rm -f /tmp/fap-cmd-*.sh
rm -f /tmp/fap-audit-*.log
rm -f /tmp/fap-open-*.log
rm -f /tmp/fap-install-*.log
rm -rf /tmp/fap-affinity
rm -f /tmp/fap-dnf-nodejs.log
rm -f /tmp/fap-npm-install.log
rm -f /tmp/fof-*.log
rm -f /tmp/fof-out-*.log
rm -f /tmp/fof-cmd-*.sh
echo "  OK"

# ============================================================
# [9/9] PATH DOS RC FILES
# ============================================================
echo "[9/9] Limpando entradas PATH dos rc files..."
PATTERN='export PATH="$HOME/.local/bin:$PATH"'
for rcfile in "$REAL_HOME/.bashrc" "$REAL_HOME/.zshrc" "$REAL_HOME/.profile"; do
    if [ -f "$rcfile" ] && grep -qF "$PATTERN" "$rcfile" 2>/dev/null; then
        cp "$rcfile" "${rcfile}.fap-backup-$(date +%s)"
        grep -vF "$PATTERN" "$rcfile" > "${rcfile}.tmp" && mv "${rcfile}.tmp" "$rcfile"
        chown "$REAL_USER:$REAL_USER" "$rcfile" 2>/dev/null
        echo "  Linha removida de: $rcfile"
    fi
done
echo "  OK"

# ============================================================
# VERIFICAÇÃO FINAL
# ============================================================
echo ""
echo "============================================"
echo "  Verificação final"
echo "============================================"
REMANESCENTES=0
for path in \
    "$REAL_HOME/.local/share/fedora-advantage-panel" \
    "$REAL_HOME/.local/share/fedora-only-fans" \
    "$REAL_HOME/Downloads/fap" \
    "$REAL_HOME/.local/bin/fap" \
    "$REAL_HOME/.local/bin/fap-compat" \
    "$REAL_HOME/.local/bin/fap-container" \
    "$REAL_HOME/.local/share/applications/fap-container.desktop" \
    "$REAL_HOME/.local/share/applications/fap-container-compat.desktop" \
    "$REAL_HOME/.local/share/icons/hicolor/256x256/apps/fap-container.png" \
    "$REAL_HOME/.cache/fap-container" \
    "$REAL_HOME/.config/fap-container" \
    "$REAL_HOME/.config/environment.d/99-fap-nvidia-vaapi.conf" \
    "$REAL_HOME/.config/pipewire/pipewire.conf.d/99-fap-quantum.conf" \
    "$REAL_HOME/.config/MangoHud/MangoHud.conf.fap-backup" \
    "$REAL_HOME/.config/gamemode.ini.fap-backup" \
    /etc/sysctl.d/99-fap-vm-max-map-count.conf \
    /etc/sysctl.d/99-fap-vm-swappiness.conf \
    /etc/sysctl.d/99-fap-tcp-bbr.conf
do
    if [ -e "$path" ]; then
        echo "  ⚠️  Ainda existe: $path"
        REMANESCENTES=$((REMANESCENTES + 1))
    fi
done
if pgrep -f "fap-container" > /dev/null 2>&1; then
    echo "  ⚠️  Processo fap-container ainda rodando"
    REMANESCENTES=$((REMANESCENTES + 1))
fi
if lsof -t -i:3000 > /dev/null 2>&1; then
    echo "  ⚠️  Porta 3000 ainda ocupada"
    REMANESCENTES=$((REMANESCENTES + 1))
fi

if [ $REMANESCENTES -eq 0 ]; then
    echo "  ✅ Nenhum resíduo do FAP encontrado."
else
    echo "  ⚠️  $REMANESCENTES resíduo(s) — revise a lista acima."
fi

# ============================================================
# RELATÓRIO FINAL
# ============================================================
echo ""
echo "============================================"
echo "  Limpeza concluída"
echo "============================================"
echo ""
echo "ℹ️  PRESERVADOS (são de SISTEMA, não do FAP):"
echo "   - Pacotes instalados (Flatpak, DNF, akmods)"
echo "   - COPRs, Terra e repos de fabricante"
echo "   - Chave MOK (/etc/pki/akmods/)"
echo "   - /etc/chromium/master_preferences"
echo "   - MangoHud/GameMode presets (~/.config/)"
echo ""
echo "Se quiser remover algum desses itens depois:"
echo "   - Chave MOK:     sudo mokutil --delete /etc/pki/akmods/certs/public_key.der"
echo "                    (só se NÃO tiver nenhum akmod-* instalado!)"
echo "   - Chromium EULA: sudo rm -f /etc/chromium/master_preferences"
echo "   - MangoHud:      rm ~/.config/MangoHud/MangoHud.conf"
echo "   - GameMode:      rm ~/.config/gamemode.ini"
echo ""
echo "Backups dos rc files preservados em ~/.bashrc.fap-backup-*, etc."
echo ""
echo "Para reinstalar do zero:"
echo "   bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)"
echo ""
