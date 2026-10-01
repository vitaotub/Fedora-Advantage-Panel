#!/usr/bin/env bash
# ============================================================
# Fedora Only Fans (FOF) - Script de Inicialização
# ============================================================
#
# Este script inicia o servidor e abre a interface do FOF.
#
# Uso: ./iniciar_fof.sh [opções]
#
# Opções:
#   --debug, -d      Modo debug (logs detalhados)
#   --no-clean       Não limpar perfis do navegador
#   --help, -h       Mostra esta ajuda
# ============================================================

set -e
set -o pipefail

# ============================================================
# RESOLUÇÃO DE SYMLINK
# ============================================================
#
# Quando o usuário clica no ícone do menu (ou roda `fof`), o script
# é invocado via o symlink ~/.local/bin/fof → <install>/iniciar_fof.sh.
#
# Sem resolver o symlink, BASH_SOURCE[0] aponta para ~/.local/bin/fof,
# então `dirname` retorna ~/.local/bin — e o script não encontra
# server.js, style.css, etc. (ficam no diretório real de instalação).
#
# readlink -f resolve toda a cadeia de symlinks e retorna o caminho
# real do arquivo. Usamos dirname disso para chegar ao diretório certo.
if [ -L "${BASH_SOURCE[0]}" ]; then
    DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
else
    DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
cd "$DIR"

# ============================================================
# AUTOCORREÇÃO DE PERMISSÕES
# ============================================================
# Caso o projeto tenha sido copiado sem +x (zip, USB, scp sem -p),
# garante que os scripts e o binário sejam executáveis antes de
# qualquer verificação. Idempotente: se já estiver certo, não
# faz nada. O `|| true` mantém compatibilidade com `set -e`.
for f in iniciar_fof.sh iniciar_fof_compat.sh build-container.sh install.sh fof-container; do
    [ -f "$f" ] && [ ! -x "$f" ] && chmod +x "$f" 2>/dev/null || true
done

# ============================================================
# VERSÃO DO FOF — fonte única: package.json
# ============================================================
#
# Aqui o $DIR já foi resolvido e o script já fez `cd "$DIR"`, então
# o package.json está sempre ao lado. `grep -oP` em vez de `node -p`
# pela mesma razão do install.sh: o Node pode não estar instalado
# ainda (este script o instala mais adiante, se necessário). O
# fallback "desconhecida" não impede nada — só afeta o banner.
VERSION="$(grep -oP '"version"\s*:\s*"\K[^"]+' "$DIR/package.json" 2>/dev/null | head -1)"
[ -z "$VERSION" ] && VERSION="desconhecida"

# ============================================================
# DETECÇÃO DE DESKTOP
# ============================================================
#
# XDG_CURRENT_DESKTOP é o padrão do freedesktop.org e é respeitado
# por todos os ambientes modernos. Alguns sistemas também setam
# DESKTOP_SESSION (mais antigo). Usamos os dois concatenados para
# maximizar a chance de detectar corretamente — e normalizamos para
# maiúsculas para facilitar os `case` abaixo.
#
# Se nenhuma das variáveis estiver setada (ambiente mínimo, SSH,
# tiling WM sem XDG setado), cai no fallback genérico.
DESKTOP_ATUAL="$(echo "${XDG_CURRENT_DESKTOP:-} ${DESKTOP_SESSION:-}" | tr '[:lower:]' '[:upper:]')"

DEBUG=false
NO_CLEAN=false

# FOF_LOG_FILE é herdado do processo pai durante a reinvocação, para
# que pai e filho escrevam no mesmo arquivo de log. Sem isso, cada
# invocação cria um log novo com timestamp diferente, e o log útil
# (do filho que efetivamente roda o servidor) fica separado do log
# do pai (que só tentou abrir o terminal).
LOG_FILE="${FOF_LOG_FILE:-/tmp/fof-$(date +%Y%m%d-%H%M%S).log}"
export FOF_LOG_FILE="$LOG_FILE"

SERVER_PID_FILE="$DIR/.fof.pid"

# ============================================================
# FUNÇÕES DE LOG
# ============================================================

log() {
    local msg="[$(date '+%H:%M:%S')] $1"
    echo -e "$msg"
    echo "$msg" >> "$LOG_FILE"
}

log_debug() {
    if [ "$DEBUG" = true ]; then
        log "🐛 DEBUG: $1"
    fi
}

log_info() {
    log "ℹ️ $1"
}

log_success() {
    log "✅ $1"
}

log_warning() {
    log "⚠️ $1"
}

log_error() {
    log "❌ $1"
}

log_header() {
    echo ""
    echo "============================================================"
    echo " 🐧 Fedora Only Fans (FOF) v$VERSION"
    echo "============================================================"
    echo ""
}

# ============================================================
# FUNÇÕES DE TERMINAL
# ============================================================
#
# Estratégia para não travar o KDE:
#
# 1. NUNCA usar `exec` para chamar o terminal. `exec` substitui o
#    processo rastreado pelo KDE, e como o script é um bash (não
#    envia o sinal de "startup complete"), o KDE mata o processo
#    filho após o timeout do StartupNotify (~10s).
#
# 2. Usar `setsid ... &` + `disown` + `exit 0`. Isso cria uma
#    sessão independente para o terminal, remove do job control
#    e sai limpo, deixando o terminal sobreviver.
#
# ORDEM DE PREFERÊNCIA POR DESKTOP
# --------------------------------
# Antes, o script tentava konsole primeiro, mesmo em GNOME — o que
# abria o terminal errado se o usuário tivesse konsole instalado.
# Agora a ordem é:
#
#   1. Terminal nativo do desktop detectado
#   2. Terminal genérico do freedesktop (xdg-terminal-exec)
#   3. Terminais de outros DEs (fallback, mantém funcionalidade)
#   4. Terminais universais (xterm, x-terminal-emulator)
#
# Cada `case` abaixo monta um array de prioridade. Se o desktop não
# é reconhecido, o array fica vazio — e a função cai direto nos
# genéricos.

_terminais_para_desktop() {
    # Retorna os terminais preferidos, na ordem, separados por espaço.
    # O desktop detectado está em $DESKTOP_ATUAL (uppercase).
    case "$DESKTOP_ATUAL" in
        *KDE*|*PLASMA*)
            echo "konsole"
            ;;
        *GNOME*)
            echo "ptyxis gnome-terminal"
            ;;
        *XFCE*)
            echo "xfce4-terminal"
            ;;
        *CINNAMON*)
            echo "gnome-terminal"
            ;;
        *MATE*)
            echo "mate-terminal gnome-terminal"
            ;;
        *LXQT*)
            echo "qterminal konsole"
            ;;
        *LXDE*)
            echo "lxterminal x-terminal-emulator"
            ;;
        *BUDGIE*)
            echo "gnome-terminal tilix"
            ;;
        *SWAY*|*HYPRLAND*|*I3*|*RIVER*)
            # Tiling WMs geralmente configuram um terminal default
            # via $TERMINAL, e não têm "terminal nativo" no sentido
            # tradicional. Tentamos primeiro respeitar $TERMINAL.
            echo "${TERMINAL:-} kitty alacritty foot"
            ;;
        *)
            echo ""
            ;;
    esac
}

abrir_no_terminal_nativo() {
    local script_path="$1"
    local titulo="Fedora Only Fans - Servidor"

    log_debug "Tentando abrir no terminal nativo..."
    log_debug "Desktop detectado: ${DESKTOP_ATUAL:-(desconhecido)}"

    # --- Etapa 1: terminal nativo do desktop detectado ---
    local terminais_nativos
    terminais_nativos="$(_terminais_para_desktop)"

    for term in $terminais_nativos; do
        # Ignora entradas vazias (caso de $TERMINAL não setado em tiling WM)
        [ -z "$term" ] && continue

        if command -v "$term" &> /dev/null; then
            log_debug "Usando $term (terminal nativo de $DESKTOP_ATUAL)"
            _executar_terminal "$term" "$script_path" "$titulo"
            return 0
        fi
    done

    # --- Etapa 2: xdg-terminal-exec (genérico do freedesktop) ---
    if command -v xdg-terminal-exec &> /dev/null; then
        log_debug "Usando xdg-terminal-exec (genérico)"
        setsid xdg-terminal-exec bash "$script_path" --no-fork \
            >> "$LOG_FILE" 2>&1 &
        disown 2>/dev/null || true
        exit 0
    fi

    # --- Etapa 3: terminais de outros DEs (fallback) ---
    # Ordem: os mais prováveis de existir, agnósticos de DE.
    for term in konsole ptyxis gnome-terminal xfce4-terminal mate-terminal qterminal lxterminal; do
        if command -v "$term" &> /dev/null; then
            log_debug "Usando $term (fallback cross-DE)"
            _executar_terminal "$term" "$script_path" "$titulo"
            return 0
        fi
    done

    # --- Etapa 4: terminais universais ---
    # Se nem isso funcionar, aceitamos que pode ser um DE/TWM muito
    # minimalista. Tentamos os "genéricos de terminal" mais comuns.
    for term in tilix alacritty kitty foot xterm x-terminal-emulator; do
        if command -v "$term" &> /dev/null; then
            log_debug "Usando $term (universal)"
            _executar_terminal "$term" "$script_path" "$titulo"
            return 0
        fi
    done

    log_error "Nenhum emulador de terminal compatível foi encontrado."
    log_error "Instale um terminal gráfico (ex.: gnome-terminal, konsole, xfce4-terminal, xterm)."
    exit 1
}

# Encapsula o `setsid ... & disown` para não repetir 6 linhas por
# terminal. Recebe o binário do terminal, o script a executar e o
# título da janela. Suporta o padrão genérico `-e bash <script> --no-fork`.
_executar_terminal() {
    local term="$1"
    local script_path="$2"
    local titulo="$3"

    # Alguns terminais usam `--title` longo, outros aceitam `-T`.
    # Usamos `--title` para todos os modernos; se falhar, o fallback
    # abaixo (sem título) entra.
    case "$term" in
        konsole)
            setsid konsole --title "$titulo" -e bash "$script_path" --no-fork \
                >> "$LOG_FILE" 2>&1 &
            ;;
        xfce4-terminal)
            # xfce4-terminal -e espera comando e argumentos como
            # argumentos separados (não uma única string).
            setsid xfce4-terminal --title="$titulo" -e bash "$script_path" --no-fork \
                >> "$LOG_FILE" 2>&1 &
            ;;
        ptyxis)
            setsid ptyxis --title "$titulo" -- bash "$script_path" --no-fork \
                >> "$LOG_FILE" 2>&1 &
            ;;
        gnome-terminal)
            setsid gnome-terminal --title="$titulo" -- bash "$script_path" --no-fork \
                >> "$LOG_FILE" 2>&1 &
            ;;
        mate-terminal)
            setsid mate-terminal --title="$titulo" -e bash "$script_path" --no-fork \
                >> "$LOG_FILE" 2>&1 &
            ;;
        qterminal)
            setsid qterminal --title "$titulo" -e bash "$script_path" --no-fork \
                >> "$LOG_FILE" 2>&1 &
            ;;
        lxterminal)
            setsid lxterminal --title="$titulo" -e bash "$script_path" --no-fork \
                >> "$LOG_FILE" 2>&1 &
            ;;
        *)
            # Fallback genérico: `-e bash <script> --no-fork`.
            # Funciona em tilix, alacritty, kitty, xterm, foot e a
            # maioria dos terminais universais.
            setsid "$term" -e bash "$script_path" --no-fork \
                >> "$LOG_FILE" 2>&1 &
            ;;
    esac

    disown 2>/dev/null || true
    exit 0
}

# ============================================================
# REINVOCAÇÃO (abrir terminal separado antes de prosseguir)
# ============================================================
#
# Se o usuário não passou --no-fork, reabrimos o script num terminal
# próprio. Isso permite que o servidor fique rodando em uma janela
# dedicada, enquanto o processo pai sai limpo.

PRECISA_REINVOCAR=true
for arg in "$@"; do
    case "$arg" in
        --no-fork|--debug|-d|--help|-h)
            PRECISA_REINVOCAR=false
            ;;
    esac
done

if [ "$PRECISA_REINVOCAR" = true ]; then
    SCRIPT_PATH="$(realpath "${BASH_SOURCE[0]}")"
    # FOF_LOG_FILE já foi exportado acima; o filho herda o mesmo
    # arquivo de log, então tudo fica registrado num lugar só.
    abrir_no_terminal_nativo "$SCRIPT_PATH"
    exit 0
fi

# ============================================================
# CONTAINER WEBKITGTK
# ============================================================

abrir_container() {
    local url="$1"
    local icone="$DIR/icone_app.png"
    local extra_args=""

    if [ "$DEBUG" = true ]; then
        extra_args="--debug"
    fi

    if [ -f "$DIR/fof-container" ]; then
        log_info "📦 Abrindo no container nativo (WebKitGTK)..."
        "$DIR/fof-container" --url "$url" --icon "$icone" --name "Fedora Only Fans" $extra_args
        exit 0
    fi

    if command -v fof-container &> /dev/null; then
        log_info "📦 Abrindo no container nativo (WebKitGTK)..."
        fof-container --url "$url" --icon "$icone" --name "Fedora Only Fans" $extra_args
        exit 0
    fi

    return 1
}

compilar_container() {
    log_info "🔧 Compilando container nativo..."

    if [ -f "$DIR/build-container.sh" ]; then
        chmod +x "$DIR/build-container.sh"
        if "$DIR/build-container.sh" && [ -f "$DIR/fof-container" ]; then
            log_success "Container compilado com sucesso!"
            return 0
        fi
    fi

    log_warning "Não foi possível compilar o container"
    return 1
}

# ============================================================
# VERIFICAÇÕES
# ============================================================

verificar_arquivos() {
    log_info "Verificando arquivos do projeto..."

    if [ ! -f "$DIR/server.js" ]; then
        log_error "Arquivo server.js não encontrado!"
        log_error "Certifique-se de estar no diretório correto."
        exit 1
    fi

    # hardware-service.js é require()'d no topo do server.js. Se
    # estiver ausente, o Node falha antes de subir o servidor — e
    # o usuário só vê "servidor não respondeu após 15s" sem saber
    # por quê. Por isso é um erro fatal, não um warning.
    if [ ! -f "$DIR/hardware-service.js" ]; then
        log_error "Arquivo hardware-service.js não encontrado!"
        log_error "Ele é obrigatório — o server.js depende dele para subir."
        exit 1
    fi

    # hardware_map.json é lido em runtime pelo hardware-service.js
    # quando /hardware-scan é chamado. Sem ele, o servidor sobe,
    # mas a detecção de hardware falha silenciosamente — daí o
    # warning (não é crítico para o resto do FOF funcionar).
    if [ ! -f "$DIR/hardware_map.json" ]; then
        log_warning "Arquivo hardware_map.json não encontrado!"
        log_warning "A sessão 'Dispositivos e Periféricos' não conseguirá detectar hardware."
    fi

    if [ ! -f "$DIR/index.html" ]; then
        log_error "Arquivo index.html não encontrado!"
        exit 1
    fi

    if [ ! -f "$DIR/guiado.html" ]; then
        log_warning "Arquivo guiado.html não encontrado!"
    fi

    if [ ! -f "$DIR/style.css" ]; then
        log_warning "Arquivo style.css não encontrado!"
    fi

    if [ ! -f "$DIR/script.js" ]; then
        log_warning "Arquivo script.js não encontrado!"
    fi

    if [ ! -f "$DIR/i18n.js" ]; then
        log_warning "Arquivo i18n.js não encontrado!"
    fi

    # ============================================================
    # ARQUIVOS DE SESSÃO
    # ============================================================
    #
    # Os IDs de sessão são semânticos (sem número) — reordenar
    # sessões é só mover linhas no array SESSOES em script.js.
    # A ordem de exibição vem da posição no array, não do nome
    # do arquivo.
    #
    # Páginas standalone (index, guiado) são verificadas acima.
    # manutencao.html foi removida — conteúdo absorvido pelas
    # sessões ajustes-manutencao e sobre-fof.
    local sessoes=(
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
        "sobre-fof.html"
    )

    local missing=0
    for sessao in "${sessoes[@]}"; do
        if [ ! -f "$DIR/$sessao" ]; then
            log_warning "Arquivo $sessao não encontrado!"
            missing=$((missing + 1))
        fi
    done

    if [ $missing -eq 0 ]; then
        log_success "Todas as sessões encontradas!"
    else
        log_warning "$missing arquivo(s) de sessão não encontrado(s)"
    fi

    if [ ! -f "$DIR/icone_app.png" ]; then
        log_warning "Arquivo icone_app.png não encontrado. Ícone pode não aparecer."
    fi

    log_success "Arquivos verificados com sucesso"
}

verificar_sudo() {
    log_info "Verificando permissões sudo..."

    if ! sudo -n true 2>/dev/null; then
        log_warning "Sudo requer senha. Você será solicitado durante a execução."
        log_warning "Alguns comandos podem pedir autenticação."
    else
        log_success "Permissões sudo disponíveis (sem senha)"
    fi
}

verificar_fedora() {
    if [ -f /etc/fedora-release ]; then
        local version=$(cat /etc/fedora-release | grep -oP '[0-9]+' | head -1)
        log_info "🖥️ Fedora $version detectado"
    else
        log_warning "Sistema não identificado como Fedora"
        log_warning "Este aplicativo foi desenvolvido para Fedora Linux"
    fi
}

# ============================================================
# DEPENDÊNCIAS
# ============================================================

instalar_nodejs() {
    if ! command -v node &> /dev/null; then
        log_warning "Node.js não encontrado. Instalando..."

        # NOTA: `if cmd | while ...` avalia o exit code do `while`, não
        # do `cmd`. O `while` sempre retorna 0, então a checagem antiga
        # nunca detectava falha do dnf. Solução: redirecionar a saída
        # do dnf para um arquivo temporário, checar o $? real, e só
        # então ler o arquivo para o log de debug.
        if sudo dnf install -y nodejs npm > /tmp/fof-dnf-nodejs.log 2>&1; then
            if [ "$DEBUG" = true ]; then
                while read -r line; do log_debug "dnf: $line"; done < /tmp/fof-dnf-nodejs.log
            fi
            rm -f /tmp/fof-dnf-nodejs.log
            log_success "Node.js instalado"
        else
            log_error "Falha ao instalar Node.js"
            log_error "Saída do dnf:"
            cat /tmp/fof-dnf-nodejs.log >> "$LOG_FILE"
            rm -f /tmp/fof-dnf-nodejs.log
            log_error "Tente instalar manualmente: sudo dnf install nodejs npm"
            exit 1
        fi
    fi

    local versao_node
    versao_node="$(node --version 2>/dev/null | sed 's/^v//')"
    local major="${versao_node%%.*}"

    if [ -z "$major" ] || [ "$major" -lt 18 ] 2>/dev/null; then
        log_warning "Node.js $versao_node detectado (requer 18+). Atualizando..."
        if sudo dnf install -y nodejs npm; then
            log_success "Node.js atualizado: $(node --version)"
        else
            log_error "Falha ao atualizar Node.js"
            exit 1
        fi
    else
        log_info "Node.js: $(node --version)"
    fi
}

instalar_dependencias_npm() {
    if [ -f "$DIR/package.json" ]; then
        if [ ! -d "$DIR/node_modules" ]; then
            log_info "Instalando dependências do Node.js..."

            # Mesmo bug do dnf: `npm ... | while` avalia o `while`, não
            # o exit code do npm. Capturamos o código real via arquivo
            # temporário.
            if npm install --no-audit --no-fund --silent > /tmp/fof-npm-install.log 2>&1; then
                if [ "$DEBUG" = true ]; then
                    while read -r line; do log_debug "npm: $line"; done < /tmp/fof-npm-install.log
                fi
                rm -f /tmp/fof-npm-install.log
                log_success "Dependências instaladas"
            else
                log_error "Falha ao instalar dependências"
                log_error "Saída do npm:"
                cat /tmp/fof-npm-install.log >> "$LOG_FILE"
                rm -f /tmp/fof-npm-install.log
                log_error "Tente instalar manualmente: npm install"
                exit 1
            fi
        else
            log_info "Dependências já estão instaladas"
        fi
    else
        log_warning "package.json não encontrado"
        log_warning "Crie um package.json com as dependências necessárias"
    fi
}

verificar_dependencias() {
    instalar_nodejs
    instalar_dependencias_npm
}

# ============================================================
# PERFIS DO NAVEGADOR
# ============================================================

limpar_perfis() {
    if [ "$NO_CLEAN" = true ]; then
        log_info "🧹 Limpeza de perfis desabilitada (--no-clean)"
        return 0
    fi

    log_info "Limpando perfis antigos do navegador..."

    if [ -d "$DIR/.perfil_firefox" ]; then
        rm -rf "$DIR/.perfil_firefox"
        log_debug "Perfil Firefox removido"
    fi

    if [ -d "$DIR/.perfil_app" ]; then
        rm -rf "$DIR/.perfil_app"
        log_debug "Perfil Chromium removido"
    fi

    log_success "Perfis limpos"
}

# ============================================================
# SERVIDOR
# ============================================================

liberar_porta() {
    if command -v lsof &> /dev/null; then
        local port_pid=$(lsof -t -i:3000 2>/dev/null)
        if [ ! -z "$port_pid" ]; then
            log_warning "Porta 3000 ocupada. Liberando..."
            kill -9 $port_pid 2>/dev/null
            sleep 1
            log_success "Porta liberada"
        fi
    fi
}

iniciar_servidor() {
    log_info "Iniciando servidor na porta 3000..."

    if [ -f "$SERVER_PID_FILE" ]; then
        rm -f "$SERVER_PID_FILE"
    fi

    local server_pid

    if [ "$DEBUG" = true ]; then
        node server.js 2>&1 | tee -a "$LOG_FILE" &
        server_pid=$!
    else
        nohup node server.js >> "$LOG_FILE" 2>&1 &
        server_pid=$!
    fi

    echo $server_pid > "$SERVER_PID_FILE"

    local tentativas=0
    local max_tentativas=15

    log_info "Aguardando servidor iniciar..."

    while [ $tentativas -lt $max_tentativas ]; do
        if curl -s --max-time 1 http://localhost:3000/status > /dev/null 2>&1; then
            log_success "Servidor iniciado (PID: $server_pid)"
            log_info "🌐 http://localhost:3000"
            return 0
        fi
        sleep 1
        tentativas=$((tentativas + 1))
        log_debug "Aguardando servidor... ($tentativas/$max_tentativas)"
    done

    log_error "Servidor não respondeu após $max_tentativas segundos"
    log_error "Verifique o log: $LOG_FILE"
    kill $server_pid 2>/dev/null
    exit 1
}

# ============================================================
# NAVEGADOR (FALLBACK)
# ============================================================

abrir_firefox() {
    local url="$1"
    local perfil_dir="$DIR/.perfil_firefox"

    mkdir -p "$perfil_dir"

    if [ "$DEBUG" = true ]; then
        firefox --profile "$perfil_dir" --window-size 950,850 --new-window "$url" 2>&1 | tee -a "$LOG_FILE" &
    else
        firefox --profile "$perfil_dir" --window-size 950,850 --new-window "$url" > /dev/null 2>&1 &
    fi

    log_info "🦊 Firefox aberto"
}

abrir_chromium() {
    local url="$1"
    local perfil_dir="$DIR/.perfil_app"
    local icone="$DIR/icone_app.png"

    mkdir -p "$perfil_dir"

    local binario=""
    for cmd in chromium chromium-browser google-chrome brave microsoft-edge opera vivaldi; do
        if command -v $cmd &> /dev/null; then
            binario=$cmd
            break
        fi
    done

    if [ -z "$binario" ]; then
        log_warning "Nenhum navegador Chromium encontrado"
        return 1
    fi

    if [ "$DEBUG" = true ]; then
        $binario --user-data-dir="$perfil_dir" --app="$url" --window-size=950,850 2>&1 | tee -a "$LOG_FILE" &
    else
        $binario --user-data-dir="$perfil_dir" --app="$url" --window-size=950,850 > /dev/null 2>&1 &
    fi

    log_info "🌐 $binario aberto"
}

abrir_navegador() {
    local url="http://localhost:3000"

    if abrir_container "$url"; then
        return 0
    fi

    if compilar_container; then
        if abrir_container "$url"; then
            return 0
        fi
    fi

    log_warning "Container não disponível. Usando navegador..."

    if command -v firefox &> /dev/null; then
        abrir_firefox "$url"
        return 0
    fi

    if command -v chromium &> /dev/null || command -v chromium-browser &> /dev/null; then
        abrir_chromium "$url"
        return 0
    fi

    log_warning "Nenhum navegador encontrado. Tentando instalar Chromium..."
    if sudo dnf install -y chromium && command -v chromium &> /dev/null; then
        abrir_chromium "$url"
        return 0
    fi

    log_error "Não foi possível abrir a interface"
    return 1
}

# ============================================================
# ATALHO DO MENU
# ============================================================

criar_atalho() {
    # O nome do arquivo .desktop DEVE ser igual ao app_id definido em
    # g_set_prgname() no C (fof-container). O KDE Plasma em Wayland é
    # rigoroso com isso: se o nome do .desktop não bater com o app_id
    # da janela, o ícone não é associado e o toolkit mostra o ícone
    # genérico ("W" do WebKitGTK).
    #
    # StartupNotify=false: o processo é um script bash, que não envia o
    # sinal de "startup complete" que o KDE espera. Com StartupNotify=true,
    # o KDE fica aguardando, desiste após ~10s e mata o processo inteiro
    # (incluindo o konsole filho). Com false, o KDE considera o launch
    # concluído de imediato.
    local desktop_file="$HOME/.local/share/applications/fof-container.desktop"
    local icone="$DIR/icone_app.png"

    log_info "Criando atalho no menu de aplicativos..."

    mkdir -p "$(dirname "$desktop_file")"

    if [ ! -f "$icone" ]; then
        icone="applications-utilities"
        log_warning "Ícone não encontrado, usando ícone genérico"
    fi

    # Ícone no tema hicolor com o MESMO nome do app_id
    if [ -f "$DIR/icone_app.png" ]; then
        mkdir -p "$HOME/.local/share/icons/hicolor/256x256/apps"
        cp "$DIR/icone_app.png" "$HOME/.local/share/icons/hicolor/256x256/apps/fof-container.png"
        gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
        log_success "Ícone do container instalado em hicolor"
    fi

    # Remove .desktop antigo com nome errado, se existir
    rm -f "$HOME/.local/share/applications/fedora-only-fans.desktop" 2>/dev/null

    cat > "$desktop_file" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Fedora Only Fans
Comment=Painel de Automação do Fedora
Exec=$DIR/iniciar_fof.sh
Icon=fof-container
Terminal=false
Categories=System;Settings;
StartupNotify=false
StartupWMClass=fof-container
EOF

    chmod +x "$desktop_file"
    update-desktop-database ~/.local/share/applications/ 2>/dev/null

    log_success "Atalho criado: $desktop_file"
}

# ============================================================
# FUNÇÃO DE AJUDA
# ============================================================

mostrar_ajuda() {
    cat <<EOF
🐧 Fedora Only Fans (FOF) v$VERSION

Uso: $(basename "$0") [opções]

Opções:
  --debug, -d      Modo debug (logs detalhados no terminal)
  --no-clean       Não limpar perfis do navegador
  --help, -h       Mostra esta ajuda

Descrição:
  Este script inicia o servidor e abre a interface do FOF.
  Ele detecta automaticamente seu ambiente desktop e
  abre o terminal apropriado.

Desktops suportados:
  GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE,
  Budgie, Sway, Hyprland, i3 e outros tiling WMs. A ordem de
  preferência de terminal é ajustada automaticamente.

Arquivos:
  server.js           Servidor Node.js
  hardware-service.js Detecção de hardware (endpoint /hardware-scan)
  hardware_map.json   Mapa de vendors PCI/USB → pacotes
  index.html          Landing page (botão único "Iniciar Configurações")
  guiado.html         Configuração passo a passo (14 sessões)
  CHANGELOG.md        Histórico de mudanças (lido em runtime)
  icone_app.png       Ícone do aplicativo

Logs:
  $LOG_FILE

Exemplos:
  ./iniciar_fof.sh                 # Inicialização normal
  ./iniciar_fof.sh --debug         # Modo debug
  ./iniciar_fof.sh --no-clean      # Manter perfis do navegador

EOF
    exit 0
}

# ============================================================
# MAIN
# ============================================================

main() {
    for arg in "$@"; do
        case $arg in
            --help|-h)
                mostrar_ajuda
                ;;
            --debug|-d)
                DEBUG=true
                ;;
            --no-clean)
                NO_CLEAN=true
                ;;
        esac
    done

    log_header

    log_info "🖥️ Desktop detectado: ${XDG_CURRENT_DESKTOP:-${DESKTOP_SESSION:-(desconhecido)}}"

    if [ "$DEBUG" = true ]; then
        log_info "🐛 Modo DEBUG ativado"
        log_info "📋 Arquivo de log: $LOG_FILE"
    fi

    if [ "$NO_CLEAN" = true ]; then
        log_info "🧹 Limpeza de perfis desabilitada"
    fi

    verificar_arquivos
    verificar_sudo
    verificar_fedora

    verificar_dependencias

    limpar_perfis

    liberar_porta
    iniciar_servidor

    abrir_navegador

    criar_atalho

    echo ""
    log_success "🎉 Fedora Only Fans está rodando!"
    log_info "🌐 http://localhost:3000"
    log_info "📋 Log: $LOG_FILE"
    echo ""
    log_info "Pressione Ctrl+C para encerrar o servidor"
    echo ""

    while true; do
        if [ -f "$SERVER_PID_FILE" ]; then
            local pid=$(cat "$SERVER_PID_FILE")
            if ! kill -0 $pid 2>/dev/null; then
                log_error "Servidor morreu inesperadamente!"
                log_error "Verifique o log: $LOG_FILE"
                break
            fi
        fi
        sleep 2
    done
}

# ============================================================
# LIMPEZA AO SAIR
# ============================================================

cleanup() {
    echo ""
    log_info "Encerrando o servidor..."

    if [ -f "$SERVER_PID_FILE" ]; then
        local pid=$(cat "$SERVER_PID_FILE")
        if kill -0 $pid 2>/dev/null; then
            kill $pid 2>/dev/null
            log_success "Servidor encerrado (PID: $pid)"
        fi
        rm -f "$SERVER_PID_FILE"
    fi

    log_info "👋 Até logo!"
    exit 0
}

trap cleanup EXIT INT TERM

# ============================================================
# EXECUÇÃO
# ============================================================

main "$@"
