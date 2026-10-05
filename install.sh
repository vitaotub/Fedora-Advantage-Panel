#!/usr/bin/env bash
# ============================================================
# Fedora Advantage Panel (FAP) - Script de Instalação
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="$HOME/.local/share/fedora-advantage-panel"
BIN_DIR="$HOME/.local/bin"

# ============================================================
# DIRETÓRIOS DO ESQUEMA ANTIGO (FOF) — para migração limpa
# ============================================================
#
# Se o usuário tem o FOF instalado, o install.sh detecta e remove
# toda a instalação antiga antes de instalar o FAP. É uma migração
# limpa — nenhum dado é preservado (progresso, tema, idioma).
OLD_INSTALL_DIR="$HOME/.local/share/fedora-only-fans"

# ============================================================
# VERSÃO DO FAP — fonte única: package.json
# ============================================================
#
# Procura o package.json em ordem de preferência:
#   1. No diretório de instalação (caso comum: --update em install
#      existente, ou execução de um clone já instalado)
#   2. No diretório atual (caso de ./install.sh rodado de um clone)
#
# NÃO usa `node -p`: no primeiro uso, o próprio install.sh instala
# o Node antes de qualquer coisa — então não dá para confiar que
# ele já esteja disponível. `grep -oP` (GNU grep, presente em todo
# Fedora) faz a leitura sem dependências.
#
# Se nada for encontrado, cai em "desconhecida" — o banner mostra
# isso, mas o script continua funcionando normalmente. Esta versão
# é apenas cosmética (o badge do FAP é alimentado pelo /info do
# server.js, que lê o package.json em runtime).
_ler_versao_package() {
    local arquivo
    for arquivo in "$INSTALL_DIR/package.json" "$PWD/package.json"; do
        if [ -f "$arquivo" ]; then
            local v
            v="$(grep -oP '"version"\s*:\s*"\K[^"]+' "$arquivo" 2>/dev/null | head -1)"
            if [ -n "$v" ]; then
                echo "$v"
                return 0
            fi
        fi
    done
    echo "desconhecida"
}

VERSION="$(_ler_versao_package)"

# ============================================================
# CORREÇÃO ÍCONE (KDE/Wayland): os nomes dos arquivos .desktop
# agora batem com o app_id definido em g_set_prgname("fap-container")
# no C. O KDE Plasma em Wayland é rigoroso: se o nome do .desktop
# não bater com o app_id da janela, o ícone não é associado e o
# toolkit mostra o ícone genérico ("W" do WebKitGTK).
# Não alterar sem atualizar o g_set_prgname no src/fap-container.c.
# ============================================================
DESKTOP_FILE="$HOME/.local/share/applications/fap-container.desktop"
DESKTOP_FILE_COMPAT="$HOME/.local/share/applications/fap-container-compat.desktop"

# Nomes antigos (para limpeza em desinstalação/atualização)
DESKTOP_FILE_OLD="$HOME/.local/share/applications/fedora-advantage-panel.desktop"
DESKTOP_FILE_COMPAT_OLD="$HOME/.local/share/applications/fedora-advantage-panel-compat.desktop"

# Nomes do esquema antigo (FOF) — removidos na migração
DESKTOP_FILE_FOF="$HOME/.local/share/applications/fof-container.desktop"
DESKTOP_FILE_FOF_COMPAT="$HOME/.local/share/applications/fof-container-compat.desktop"
DESKTOP_FILE_FOF_OLD="$HOME/.local/share/applications/fedora-only-fans.desktop"
DESKTOP_FILE_FOF_COMPAT_OLD="$HOME/.local/share/applications/fedora-only-fans-compat.desktop"

REPO_URL="https://github.com/vitaotub/Fedora-Advantage-Panel.git"
LOG_FILE="/tmp/fap-install-$(date +%Y%m%d-%H%M%S).log"

# ============================================================
# ARQUIVOS DE SESSÃO
# ============================================================
#
# Os IDs de sessão são semânticos (sem número) — reordenar sessões
# é só mover linhas no array SESSOES em script.js.
#
# manutencao.html foi removida — conteúdo absorvido pelas sessões
# ajustes-manutencao e sobre-fap. CHANGELOG.md é lido em runtime
# pelo endpoint /changelog do server.js.

SESSAO_ARQUIVOS=(
"primeiros-passos.html"
"codecs.html"
"hardware.html"
"dispositivos-perifericos.html"
"producao-multimidia.html"
"aplicativos.html"
"casa-escritorio.html"
"gaming.html"
"waydroid.html"
"virtualizacao.html"
"diagnostico.html"
"ajustes-manutencao.html"
"estado-fedora.html"
"sobre-fap.html"
)

ARQUIVOS_PRINCIPAIS=(
"server.js"
"hardware-service.js"
"hardware_map.json"
"index.html"
"guiado.html"
"style.css"
"script.js"
"i18n.js"
"icone_app.png"
"iniciar_fap.sh"
"iniciar_fap_compat.sh"
"build-container.sh"
"Makefile"
"template-sessao.html"
"CHANGELOG.md"
)

print_header() {
echo ""
echo "============================================================"
echo " 🐧 Fedora Advantage Panel (FAP) - Instalador v$VERSION"
echo "============================================================"
echo ""
}

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️ $1${NC}"; }
print_step() { echo -e "${CYAN}▶ $1${NC}"; }

log() { echo "[$(date '+%H:%M:%S')] $1" >> "$LOG_FILE"; }

reaplicar_permissoes() {
print_step "Reaplicando permissões dos arquivos..."

local arquivos_para_permissoes=(
"iniciar_fap.sh"
"iniciar_fap_compat.sh"
"fap-container"
"build-container.sh"
)

for arquivo in "${arquivos_para_permissoes[@]}"; do
if [ -f "$INSTALL_DIR/$arquivo" ]; then
chmod +x "$INSTALL_DIR/$arquivo"
print_info "Permissão aplicada: $arquivo"
fi
done

local links_para_permissoes=("fap" "fap-compat" "fap-container")
for link in "${links_para_permissoes[@]}"; do
# -L cobre symlinks (mesmo quebrados); -e cobre arquivos regulares.
if [ -L "$BIN_DIR/$link" ] || [ -e "$BIN_DIR/$link" ]; then
chmod +x "$BIN_DIR/$link" 2>/dev/null || true
print_info "Permissão aplicada: $link (link)"
fi
done

print_success "Permissões reaplicadas com sucesso!"
}

# ============================================================
# LIMPEZA DE ARQUIVOS DE VERSÕES ANTIGAS
# ============================================================
#
# Removida pelo git pull nas renomeações, mas o git nem sempre
# detecta renomeações. Roda em --update, DEPOIS do git pull:
# - Se o git já tiver removido, o `rm -f` é no-op.
# - Se o git não detectou a renomeação, limpamos o resquício.

limpar_arquivos_antigos() {
print_step "Removendo arquivos de versões anteriores..."

local antigos=(
"00-boas-vindas.html"
"01-restauracao.html"
"02-otimizacao.html"
"03-repositorios.html"
"04-codecs-compatibilidade.html"
"04-fontes.html"
"05-hardware.html"
"06-gaming.html"
"07-loja.html"
"08-waydroid.html"
"09-softwares-uteis.html"
"10-casa-pronta.html"
"11-diagnostico.html"
"12-fedora.html"
"manutencao.html"
"90-manutencao.html"
"91-fof-manutencao.html"
"sobre-fof.html"
"iniciar_fof.sh"
"iniciar_fof_compat.sh"
"src/fof-container.c"
"fof-container"
)

local removidos=0
for arquivo in "${antigos[@]}"; do
if [ -f "$INSTALL_DIR/$arquivo" ]; then
rm -f "$INSTALL_DIR/$arquivo"
print_info "Removido: $arquivo"
removidos=$((removidos + 1))
fi
done

if [ $removidos -gt 0 ]; then
print_success "$removidos arquivo(s) antigo(s) removido(s)"
else
print_info "Nenhum arquivo antigo encontrado"
fi
}

# ============================================================
# MIGRAÇÃO DO ESQUEMA ANTIGO (FOF → FAP)
# ============================================================
#
# Quando o usuário roda o install.sh da nova versão sobre uma
# instalação antiga do FOF, removemos TUDO do esquema antigo:
# diretório de instalação, symlinks, atalhos .desktop, ícone no
# hicolor, logs em /tmp, dados do WebKitGTK.
#
# É uma migração limpa — nenhum dado do usuário (progresso, tema,
# idioma) é preservado.

migrar_esquema_antigo() {
    print_step "Verificando instalação antiga do FOF..."

    local migrou=0

    # ─── 1. Diretório de instalação antigo ─────────────────────
    if [ -d "$OLD_INSTALL_DIR" ]; then
        rm -rf "$OLD_INSTALL_DIR"
        print_info "Diretório antigo removido: $OLD_INSTALL_DIR"
        migrou=1
    fi

    # ─── 2. Symlinks antigos em ~/.local/bin ────────────────────
    local links_antigos=("fof" "fof-compat" "fof-container")
    for link in "${links_antigos[@]}"; do
        if [ -L "$BIN_DIR/$link" ] || [ -e "$BIN_DIR/$link" ]; then
            rm -f "$BIN_DIR/$link"
            print_info "Symlink antigo removido: $BIN_DIR/$link"
            migrou=1
        fi
    done

    # ─── 3. Atalhos .desktop antigos ────────────────────────────
    local atalhos_antigos=(
        "$DESKTOP_FILE_FOF"
        "$DESKTOP_FILE_FOF_COMPAT"
        "$DESKTOP_FILE_FOF_OLD"
        "$DESKTOP_FILE_FOF_COMPAT_OLD"
    )
    for atalho in "${atalhos_antigos[@]}"; do
        if [ -L "$atalho" ] || [ -e "$atalho" ]; then
            rm -f "$atalho"
            print_info "Atalho antigo removido: $atalho"
            migrou=1
        fi
    done

    # ─── 4. Ícone no hicolor ────────────────────────────────────
    if [ -f "$HOME/.local/share/icons/hicolor/256x256/apps/fof-container.png" ]; then
        rm -f "$HOME/.local/share/icons/hicolor/256x256/apps/fof-container.png"
        gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
        print_info "Ícone antigo removido do hicolor"
        migrou=1
    fi

    # ─── 5. Dados e cache do WebKitGTK (esquema antigo) ────────
    for dir_antigo in \
        "$HOME/.cache/fof-container" \
        "$HOME/.local/share/fof-container" \
        "$HOME/.config/fof-container"; do
        if [ -d "$dir_antigo" ]; then
            rm -rf "$dir_antigo"
            print_info "Diretório antigo removido: $dir_antigo"
            migrou=1
        fi
    done

    # ─── 6. Logs antigos em /tmp ────────────────────────────────
    if ls /tmp/fof-*.log >/dev/null 2>&1; then
        rm -f /tmp/fof-*.log 2>/dev/null || true
        print_info "Logs antigos removidos de /tmp"
        migrou=1
    fi
    if ls /tmp/fof-out-*.log >/dev/null 2>&1; then
        sudo rm -f /tmp/fof-out-*.log 2>/dev/null || true
        print_info "Logs de autenticação antigos removidos de /tmp"
        migrou=1
    fi
    if ls /tmp/fof-cmd-*.sh >/dev/null 2>&1; then
        rm -f /tmp/fof-cmd-*.sh 2>/dev/null || true
        print_info "Scripts temporários antigos removidos de /tmp"
        migrou=1
    fi
    if [ -d "$HOME/.local/share/fof-waydroid" ]; then
        rm -rf "$HOME/.local/share/fof-waydroid"
        print_info "Extras antigos do Waydroid removidos: ~/.local/share/fof-waydroid"
        migrou=1
    fi

    if [ $migrou -eq 1 ]; then
        print_success "Migração do esquema antigo concluída"
    else
        print_info "Nenhuma instalação antiga do FOF encontrada"
    fi
}

# ============================================================
# MIGRAÇÃO VIA --update (FOF antigo → FAP)
# ============================================================
#
# Cenário: o usuário tem o FOF antigo instalado e clica no botão
# "Atualizar" do próprio FOF. O FOF executa:
#
#   bash <(curl .../install.sh) --update
#
# Esse --update chega no FAP novo, que procura em $INSTALL_DIR
# (~/.local/share/fedora-advantage-panel). Como o usuário ainda
# está no esquema antigo, o diretório NÃO existe — mas o
# $OLD_INSTALL_DIR (~/.local/share/fedora-only-fans) existe.
#
# Em vez de retornar "FAP não está instalado" e travar, caímos
# aqui e fazemos a instalação completa com migração limpa.
#
# Após o término, o processo do FOF antigo (que ainda está
# rodando com o server.js antigo) continua até ser fechado. Na
# próxima abertura, o usuário já estará no FAP.

_migrar_via_update() {
    print_header
    print_step "Detectada instalação do FOF antigo"
    print_info "Migrando automaticamente para o Fedora Advantage Panel (FAP)..."
    echo ""

    # Reaproveita a migração e a instalação completa. A ordem é
    # importante: primeiro remove TUDO do FOF, depois instala o
    # FAP do zero (clone + npm install + symlinks), depois
    # recompila o container e cria os atalhos.
    migrar_esquema_antigo

    instalar_fap
    verificar_arquivos_instalados
    instalar_dependencias_container
    compilar_container_install
    criar_atalhos
    configurar_path
    reaplicar_permissoes

    echo ""
    print_success "🎉 Migração para o Fedora Advantage Panel concluída!"
    echo ""
    print_info "📁 Instalado em: $INSTALL_DIR"
    print_info ""
    print_warning "⚠️  Feche o FOF antigo (esta janela) para concluir."
    print_info ""
    print_info "Para abrir o FAP:"
    echo " - Terminal: digite 'fap' ou 'fap-compat'"
    echo " - Menu: procure por 'Fedora Advantage Panel'"
    echo ""
    print_info "📋 Log da migração: $LOG_FILE"
    echo ""

    # Encerra o servidor antigo (node server.js) que ainda está
    # rodando com o código do FOF. Sem isso, o usuário pode
    # continuar vendo a UI antiga por trás do container.
    if pgrep -f "node server.js" > /dev/null 2>&1; then
        print_info "🔄 Encerrando o servidor antigo em 3 segundos..."
        print_info "   A janela do FOF vai fechar automaticamente."
        nohup bash -c 'sleep 3 && pkill -f "node server.js" 2>/dev/null' > /dev/null 2>&1 &
    fi
}

verificar_arquivos_instalados() {
print_step "Verificando arquivos instalados..."
local todos_ok=true
local arquivos_para_verificar=("${ARQUIVOS_PRINCIPAIS[@]}" "${SESSAO_ARQUIVOS[@]}")

for arquivo in "${arquivos_para_verificar[@]}"; do
if [ ! -f "$INSTALL_DIR/$arquivo" ]; then
print_warning "Arquivo não encontrado: $arquivo"
todos_ok=false
fi
done

if [ "$todos_ok" = true ]; then
print_success "Todos os arquivos verificados com sucesso!"
else
print_warning "Alguns arquivos podem estar faltando. Tente: $0 --update"
fi
}

instalar_dependencias_container() {
print_step "Instalando dependências do container nativo..."

local pacotes=(
"webkit2gtk4.1-devel"
"gtk3-devel"
"gcc"
"make"
"pkgconfig"
)

local instalar=()

for pkg in "${pacotes[@]}"; do
if ! rpm -q $pkg &> /dev/null; then
instalar+=($pkg)
fi
done

if [ ${#instalar[@]} -gt 0 ]; then
print_info "Instalando: ${instalar[*]}"
if sudo dnf install -y "${instalar[@]}"; then
print_success "Dependências instaladas"
else
print_warning "Algumas dependências podem não ter sido instaladas"
fi
else
print_success "Todas as dependências já estão instaladas"
fi
}

compilar_container_install() {
print_step "Compilando container nativo..."
cd "$INSTALL_DIR"

if [ ! -f "$INSTALL_DIR/build-container.sh" ]; then
print_warning "build-container.sh não encontrado"
print_info "O FAP usará o navegador como fallback"
return 1
fi

chmod +x "$INSTALL_DIR/build-container.sh"

# Captura stdout+stderr do build-container.sh no LOG_FILE.
# Assim, se a compilação falhar (pkg-config sem webkit2gtk4.1, gcc
# reclamando, etc.), o motivo fica visível para diagnóstico — em vez
# de um simples "não foi possível recompilar o container".
if "$INSTALL_DIR/build-container.sh" >> "$LOG_FILE" 2>&1; then
if [ -f "$INSTALL_DIR/fap-container" ]; then
ln -sf "$INSTALL_DIR/fap-container" "$BIN_DIR/fap-container"
chmod +x "$BIN_DIR/fap-container"
print_success "Container compilado e instalado"
return 0
else
print_warning "Compilação retornou sucesso, mas o binário não foi encontrado"
print_info "Verifique o log: $LOG_FILE"
return 1
fi
else
print_warning "Falha ao compilar o container"
print_info "Motivo registrado em: $LOG_FILE"
print_info "O FAP continuará usando o container antigo (se existir) ou o navegador como fallback"
return 1
fi
}

verificar_sistema() {
print_step "Verificando sistema operacional..."

if [ -f /etc/fedora-release ]; then
local version=$(cat /etc/fedora-release | grep -oP '[0-9]+' | head -1)
print_success "Fedora $version detectado"
log "Sistema: Fedora $version"
else
print_warning "Sistema não identificado como Fedora"
print_warning "A instalação pode não funcionar corretamente"
read -p "Continuar mesmo assim? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
print_error "Instalação cancelada"
exit 1
fi
fi
}

verificar_dependencias() {
print_step "Verificando dependências..."

local faltando=()

if ! command -v node &> /dev/null; then
faltando+=("nodejs")
print_warning "Node.js não encontrado"
else
local versao_node
versao_node="$(node --version 2>/dev/null | sed 's/^v//')"
local major="${versao_node%%.*}"
if [ -z "$major" ] || [ "$major" -lt 18 ] 2>/dev/null; then
print_warning "Node.js $versao_node é antigo (requer 18+)"
faltando+=("nodejs")
else
print_success "Node.js: $(node --version)"
fi
fi

if ! command -v npm &> /dev/null; then
faltando+=("npm")
print_warning "npm não encontrado"
else
print_success "npm: $(npm --version)"
fi

if ! command -v git &> /dev/null; then
faltando+=("git")
print_warning "git não encontrado"
else
print_success "git: $(git --version | cut -d' ' -f3)"
fi

if ! command -v curl &> /dev/null; then
faltando+=("curl")
print_warning "curl não encontrado"
else
print_success "curl: $(curl --version | head -1 | cut -d' ' -f2)"
fi

# ------------------------------------------------------------
# zenity: diálogo gráfico de senha em DEs não-KDE
# ------------------------------------------------------------
#
# Em KDE, o FAP usa kdesu/kdialog para autenticação. Em qualquer
# outro desktop (GNOME, XFCE, Cinnamon, MATE, LXQt, tiling WMs),
# o fallback é pkexec + zenity. Sem zenity, a autenticação
# quebra silenciosamente: pkexec não consegue abrir diálogo e o
# comando trava esperando input que nunca vem.
#
# Fedora Workstation (GNOME) não traz zenity por padrão desde o
# GNOME 42 — instalar explicitamente resolve.
#
# Só instala se o usuário não tiver kdialog tampouco (KDE puro).
if ! command -v zenity &> /dev/null && ! command -v kdialog &> /dev/null; then
faltando+=("zenity")
print_warning "zenity não encontrado (necessário para autenticação gráfica em DEs não-KDE)"
else
if command -v zenity &> /dev/null; then
print_success "zenity: $(zenity --version 2>/dev/null || echo 'presente')"
fi
fi

if [ ${#faltando[@]} -gt 0 ]; then
print_info "Instalando dependências faltando: ${faltando[*]}"
log "Instalando: ${faltando[*]}"
if ! sudo dnf install -y "${faltando[@]}"; then
print_error "Falha ao instalar dependências"
print_error "Tente manualmente: sudo dnf install ${faltando[*]}"
exit 1
fi
print_success "Dependências instaladas"
else
print_success "Todas as dependências estão instaladas"
fi
}

instalar_fap() {
print_step "Instalando Fedora Advantage Panel..."

mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

if [ -d "$INSTALL_DIR/.git" ]; then
print_info "Atualizando repositório existente..."
cd "$INSTALL_DIR"
git pull --ff-only
else
print_info "Clonando repositório..."
git clone "$REPO_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR"
fi

print_step "Instalando dependências do Node.js..."
# --omit=dev evita instalar nodemon (devDependency), que o FAP
# não usa em runtime.
if ! npm install --omit=dev --no-audit --no-fund --silent; then
print_error "Falha ao instalar dependências"
exit 1
fi

ln -sf "$INSTALL_DIR/iniciar_fap.sh" "$BIN_DIR/fap"
chmod +x "$INSTALL_DIR/iniciar_fap.sh"
chmod +x "$BIN_DIR/fap"

if [ -f "$INSTALL_DIR/iniciar_fap_compat.sh" ]; then
ln -sf "$INSTALL_DIR/iniciar_fap_compat.sh" "$BIN_DIR/fap-compat"
chmod +x "$INSTALL_DIR/iniciar_fap_compat.sh"
chmod +x "$BIN_DIR/fap-compat"
fi

print_success "FAP instalado em: $INSTALL_DIR"
print_success "Comando 'fap' disponível em: $BIN_DIR"
print_success "Comando 'fap-compat' disponível em: $BIN_DIR"
}

criar_atalhos() {
print_step "Criando atalhos no menu de aplicativos..."

# ============================================================
# CORREÇÃO ÍCONE (KDE/Wayland): o nome do arquivo .desktop agora
# é "fap-container.desktop", casando com o app_id definido em
# g_set_prgname("fap-container") no src/fap-container.c. Sem essa
# correspondência, o KDE Plasma em Wayland não associa o ícone do
# .desktop com a janela do container e mostra o ícone genérico do
# WebKitGTK (o "W" amarelo).
#
# O nome exibido no menu (Name=Fedora Advantage Panel) não depende do
# nome do arquivo — pode ser qualquer coisa.
#
# O Exec aponta para o caminho REAL do script (dentro do
# INSTALL_DIR), não para o symlink em ~/.local/bin. Isso é
# ligeiramente mais robusto: se algo remover o symlink, o
# atalho continua funcionando. Também dispensa a resolução de
# symlink que o iniciar_fap.sh faz no topo (embora essa resolução
# continue existindo para o caso de invocação via linha de comando).
# ============================================================

# Ícone no tema hicolor com o MESMO nome do app_id, para o KDE
# achar o ícone por nome (Icon=fap-container) em qualquer tema.
if [ -f "$INSTALL_DIR/icone_app.png" ]; then
mkdir -p "$HOME/.local/share/icons/hicolor/256x256/apps"
cp "$INSTALL_DIR/icone_app.png" "$HOME/.local/share/icons/hicolor/256x256/apps/fap-container.png"
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
print_success "Ícone do container instalado em hicolor"
fi

mkdir -p "$(dirname "$DESKTOP_FILE")"

# Remove .desktops antigos com nome errado (instalações anteriores)
rm -f "$DESKTOP_FILE_OLD" "$DESKTOP_FILE_COMPAT_OLD" 2>/dev/null

# --- Atalho principal ---
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Fedora Advantage Panel
Comment=Painel de Automação do Fedora
Exec=$INSTALL_DIR/iniciar_fap.sh
Icon=fap-container
Terminal=false
Categories=System;Settings;
StartupNotify=false
StartupWMClass=fap-container
EOF

chmod +x "$DESKTOP_FILE"
print_success "Atalho criado: $DESKTOP_FILE"

# --- Atalho de compatibilidade (modo software rendering) ---
if [ -f "$INSTALL_DIR/iniciar_fap_compat.sh" ]; then
cat > "$DESKTOP_FILE_COMPAT" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Fedora Advantage Panel (Modo Compatibilidade)
Comment=Painel de Automação do Fedora - Modo compatível com GPUs antigas
Exec=$INSTALL_DIR/iniciar_fap_compat.sh
Icon=fap-container
Terminal=false
Categories=System;Settings;
StartupNotify=false
StartupWMClass=fap-container
EOF

chmod +x "$DESKTOP_FILE_COMPAT"
print_success "Atalho de compatibilidade criado: $DESKTOP_FILE_COMPAT"
fi

update-desktop-database ~/.local/share/applications/ 2>/dev/null || true
kbuildsycoca6 --noincremental 2>/dev/null || kbuildsycoca5 --noincremental 2>/dev/null || true
}

configurar_path() {
print_step "Configurando PATH..."

if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
print_warning "~/.local/bin não está no PATH"

if [ -f "$HOME/.bashrc" ]; then
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
print_success "Adicionado ao .bashrc"
fi

if [ -f "$HOME/.zshrc" ]; then
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
print_success "Adicionado ao .zshrc"
fi

print_info "Reinicie o terminal ou execute: source ~/.bashrc"
else
print_success "PATH já configurado"
fi
}

desinstalar() {
print_header
print_warning "Desinstalando Fedora Advantage Panel..."

read -p "Tem certeza? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
print_info "Desinstalação cancelada"
exit 0
fi

print_step "Removendo arquivos..."

# ─── 1. Diretório de instalação ─────────────────────────────
if [ -d "$INSTALL_DIR" ]; then
rm -rf "$INSTALL_DIR"
print_success "Diretório removido: $INSTALL_DIR"
fi

# ─── 2. Symlinks em ~/.local/bin ────────────────────────────
# NOTA: usamos `-L` (testa symlink) em vez de `-f` (segue o
# symlink). Como o INSTALL_DIR foi removido acima, os symlinks
# ficam "quebrados" e `-f` retorna false — pulando a remoção.
local links=("fap" "fap-compat" "fap-container")
for link in "${links[@]}"; do
if [ -L "$BIN_DIR/$link" ] || [ -e "$BIN_DIR/$link" ]; then
rm -f "$BIN_DIR/$link"
print_success "Link removido: $BIN_DIR/$link"
fi
done

# ─── 3. Atalhos .desktop ────────────────────────────────────
local atalhos=(
"$DESKTOP_FILE"
"$DESKTOP_FILE_COMPAT"
"$DESKTOP_FILE_OLD"
"$DESKTOP_FILE_COMPAT_OLD"
)
for atalho in "${atalhos[@]}"; do
if [ -L "$atalho" ] || [ -e "$atalho" ]; then
rm -f "$atalho"
print_success "Atalho removido: $atalho"
fi
done

# ─── 4. Ícone hicolor ──────────────────────────────────────
if [ -f "$HOME/.local/share/icons/hicolor/256x256/apps/fap-container.png" ]; then
rm -f "$HOME/.local/share/icons/hicolor/256x256/apps/fap-container.png"
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
print_success "Ícone removido do hicolor"
fi

# ─── 5. Dados e cache do WebKitGTK ──────────────────────────
# O fap-container (WebKitGTK) cria esses dois diretórios em
# runtime. Sem removê-los, o cache HTTP e o localStorage ficam
# órfãos no sistema (incluindo o badge de atualização).
if [ -d "$HOME/.cache/fap-container" ]; then
rm -rf "$HOME/.cache/fap-container"
print_success "Cache do WebKitGTK removido: ~/.cache/fap-container"
fi

if [ -d "$HOME/.local/share/fap-container" ]; then
rm -rf "$HOME/.local/share/fap-container"
print_success "Dados do WebKitGTK removidos: ~/.local/share/fap-container"
fi

if [ -d "$HOME/.config/fap-container" ]; then
rm -rf "$HOME/.config/fap-container"
print_success "Configurações do FAP removidas: ~/.config/fap-container"
fi

# ─── 6. Logs temporários ────────────────────────────────────
# Os arquivos /tmp/fap-out-*.log são criados pelo kdesu/pkexec
# (que rodam como root) e ficam com owner root. O `rm -f` como
# usuário comum falha com "Operação não permitida", o que faz o# `set -e` abortar o script inteiro. Solução: tentar como user
# primeiro, e escalar para sudo apenas se sobrar algo.
print_step "Removendo logs temporários..."

# Logs do usuário (sempre removíveis)
rm -f /tmp/fap-install-*.log 2>/dev/null || true
rm -f /tmp/fap-waydroid-ui.log 2>/dev/null || true

# Logs de comandos autenticados — podem pertencer ao root
if ls /tmp/fap-out-*.log >/dev/null 2>&1; then
if ! rm -f /tmp/fap-out-*.log 2>/dev/null; then
print_info "Alguns logs pertencem ao root (kdesu/pkexec). Removendo com sudo..."
sudo rm -f /tmp/fap-out-*.log 2>/dev/null || true
fi
fi

print_success "Logs temporários removidos"

# ─── 7. Limpeza de PATH nos rc files ────────────────────────
remover_linha_path() {
local arquivo="$1"
local linha_a_remover='export PATH="$HOME/.local/bin:$PATH"'

if [ ! -f "$arquivo" ]; then
return 0
fi

# Só faz backup se o arquivo realmente contém a linha a remover.
# Se não contém, não mexe — evita criar backup de arquivo que
# não foi alterado.
if ! grep -qF "$linha_a_remover" "$arquivo"; then
return 0
fi

# Backup atômico com timestamp, mantido por segurança caso o
# usuário queira restaurar manualmente.
local backup="${arquivo}.fap-backup-$(date +%Y%m%d-%H%M%S)"
cp "$arquivo" "$backup"
grep -vF "$linha_a_remover" "$arquivo" > "${arquivo}.tmp"
mv "${arquivo}.tmp" "$arquivo"
print_success "Linha removida de: $arquivo (backup: $backup)"
}

remover_linha_path "$HOME/.bashrc"
remover_linha_path "$HOME/.zshrc"
remover_linha_path "$HOME/.profile"

# ─── 8. Reindexação do menu ─────────────────────────────────
update-desktop-database ~/.local/share/applications/ 2>/dev/null || true
kbuildsycoca6 --noincremental 2>/dev/null || kbuildsycoca5 --noincremental 2>/dev/null || true

echo ""
print_success "✅ FAP completamente desinstalado!"
}

atualizar() {
print_header

# ------------------------------------------------------------
# Detecção do cenário FOF → FAP
# ------------------------------------------------------------
#
# Se não existe FAP instalado ($INSTALL_DIR/.git ausente), mas
# existe o FOF antigo ($OLD_INSTALL_DIR presente), estamos num
# cenário de migração via botão "Atualizar" do próprio FOF.
# Delegamos para _migrar_via_update(), que faz a instalação
# completa com migração limpa (remove FOF, clona FAP, compila,
# cria atalhos).
if [ ! -d "$INSTALL_DIR/.git" ] && [ -d "$OLD_INSTALL_DIR" ]; then
    _migrar_via_update
    exit 0
fi

# ------------------------------------------------------------
# Cenário normal: FAP já está instalado, atualizar normalmente
# ------------------------------------------------------------
if [ ! -d "$INSTALL_DIR/.git" ]; then
    print_error "FAP não está instalado ou não foi clonado do Git"
    print_info "Execute a instalação primeiro: ./install.sh"
    exit 1
fi

print_step "Atualizando Fedora Advantage Panel..."
cd "$INSTALL_DIR"

# git stash push -m é o substituto moderno do git stash save (que foi
# deprecado no Git 2.13+, 2017). O -m define a mensagem, preservando o
# comportamento do save.
git stash push -m "Backup automático antes da atualização" 2>/dev/null || true

# --ff-only usa o upstream configurado (origin/main por padrão) e
# recusa merge commits. Se o upstream não estiver setado, falha
# com mensagem clara em vez de instalar uma versão quebrada.
if ! git pull --ff-only; then
print_error "Falha ao atualizar"
exit 1
fi

git stash pop 2>/dev/null || true

# Remove arquivos de sessões antigas que possam ter sobrado.
# Roda DEPOIS do git pull, porque:
# - Se o git já tiver removido, o `rm -f` é no-op.
# - Se o git não detectou a renomeação, limpamos o resquício.
limpar_arquivos_antigos

print_step "Atualizando dependências do Node.js..."
if ! npm install --omit=dev --no-audit --no-fund --silent; then
print_warning "Falha ao atualizar dependências, continuando..."
fi

# Recompila o container nativo. O install.sh --update é chamado pelo
# botão "Atualizar FAP" na sessão sobre-fap, então essa recompilação
# roda automaticamente em cada atualização.
compilar_container_install || true

print_step "Recriando symlinks dos comandos..."
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/iniciar_fap.sh" "$BIN_DIR/fap"
chmod +x "$INSTALL_DIR/iniciar_fap.sh" "$BIN_DIR/fap"
if [ -f "$INSTALL_DIR/iniciar_fap_compat.sh" ]; then
ln -sf "$INSTALL_DIR/iniciar_fap_compat.sh" "$BIN_DIR/fap-compat"
chmod +x "$INSTALL_DIR/iniciar_fap_compat.sh" "$BIN_DIR/fap-compat"
fi
if [ -f "$INSTALL_DIR/fap-container" ]; then
ln -sf "$INSTALL_DIR/fap-container" "$BIN_DIR/fap-container"
chmod +x "$BIN_DIR/fap-container"
fi
print_success "Symlinks atualizados"

verificar_arquivos_instalados
reaplicar_permissoes
criar_atalhos

print_success "✅ FAP atualizado para a versão mais recente!"

# ============================================================
# ENCERRA O SERVIDOR ANTIGO APÓS A ATUALIZAÇÃO
# ============================================================
#
# O processo `node server.js` carrega FAP_VERSION uma única vez, no
# boot. Se ele continuar rodando após o update, o endpoint /info
# segue retornando a versão antiga — e o badge de "atualização
# disponível" continua aparecendo, mesmo com o FAP já atualizado
# no disco.
#
# Solução: encerrar o servidor antigo automaticamente ao fim do
# update. O usuário só precisa reabrir o FAP com `fap`, e o novo
# servidor sobe com a versão nova.

if pgrep -f "node server.js" > /dev/null 2>&1; then
print_info "🔄 Encerrando o servidor antigo em 3 segundos..."
print_info "💡 Reabra o FAP com o comando 'fap' para usar a versão nova."

nohup bash -c 'sleep 3 && pkill -f "node server.js" 2>/dev/null' > /dev/null 2>&1 &
fi
}

mostrar_ajuda() {
cat <<EOF
🐧 Fedora Advantage Panel (FAP) - Instalador v$VERSION

Uso: $(basename "$0") [opções]

Opções:
--help, -h Mostra esta ajuda
--update Atualiza uma instalação existente
--uninstall Desinstala o FAP do sistema

Após a instalação:
- O comando 'fap' estará disponível no terminal
- O comando 'fap-compat' estará disponível (modo compatibilidade)
- Dois atalhos serão criados no menu de aplicativos

Nota sobre desktops:
- Todos os desktops Linux são suportados (GNOME, KDE, XFCE,
  Cinnamon, MATE, LXQt, tiling WMs).
- Em KDE, a autenticação usa kdesu/kdialog. Nos demais,
  pkexec+zenity (instalado automaticamente se faltar).
- O FAP NÃO fixa atalhos na barra de tarefas. Faça manualmente
  pelo menu do seu desktop (botão direito no ícone do FAP).

EOF
exit 0
}

main() {
case "$1" in
--help|-h)
mostrar_ajuda
;;
--uninstall)
desinstalar
exit 0
;;
--update)
atualizar
exit 0
;;
esac

print_header

verificar_sistema
verificar_dependencias

# Migração do esquema antigo (FOF → FAP) — roda ANTES de qualquer
# coisa, para garantir que nenhum resquício do FOF interfira.
migrar_esquema_antigo

instalar_fap
verificar_arquivos_instalados
instalar_dependencias_container
compilar_container_install
criar_atalhos
configurar_path
reaplicar_permissoes

echo ""
print_success "🎉 Fedora Advantage Panel instalado com sucesso!"
echo ""
print_info "📁 Instalado em: $INSTALL_DIR"
print_info ""
print_info "Para iniciar o FAP:"
echo " - Terminal: digite 'fap' ou 'fap-compat'"
echo " - Menu: procure por 'Fedora Advantage Panel'"
echo ""
print_info "💡 Para fixar na barra de tarefas, use o menu do seu desktop"
print_info "   (botão direito no ícone do FAP → 'Adicionar ao Painel' ou similar)"
echo ""
print_info "📋 Log da instalação: $LOG_FILE"
echo ""
}

main "$@"
