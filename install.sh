#!/usr/bin/env bash
# ============================================================
# Fedora Advantage Panel (FAP) - Script de Instalação
# ============================================================

set -e

# ============================================================
# REFUSE-AS-ROOT
# ============================================================
#
# O FAP instala em $HOME do usuário e usa `sudo` internamente para
# os passos que precisam de root (dnf install, /etc/default/grub,
# etc.). Rodar o script inteiro como root faz duas coisas ruins:
#
#   1. ~/.local/share do root é usado em vez do ~ do usuário real,
#      então o FAP é instalado no lugar errado.
#   2. Os arquivos ficam com owner root, e a PRÓXIMA atualização
#      (que roda como usuário, via SUDO_ASKPASS) falha por
#      permissão.
#
# O update/uninstall agora roda como usuário por design — o
# server.js whitelista esses idComandos e usa o askpass do sudo
# para os passos privilegiados. Portanto, rodar o install.sh
# inteiro como root é sempre um erro.
if [ "$(id -u)" -eq 0 ]; then
    echo "❌ Não rode este script como root (sudo)."
    echo ""
    echo "O FAP instala em \$HOME do seu usuário e usa sudo apenas"
    echo "internamente, para os passos que precisam de privilégio."
    echo ""
    echo "Rode sem sudo:"
    echo "  ./install.sh"
    exit 1
fi

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
# LEITURA INTERATIVA SEGURA
# ============================================================
#
# `read -p` bloqueia se o stdin não for um TTY (CI, `bash <(...)`
# redirecionando entrada, `< /dev/null`). Em vez de travar, essa
# função responde automaticamente com um default.
#
# Uso:
#   _perguntar "Continuar?" "s"    → retorna 0 se default for "s"
#   _perguntar "Continuar?" "n"    → retorna 0 se default for "n"
#
# Se o stdin for TTY, mostra o prompt real e lê a resposta.
_perguntar_sim_nao() {
    local prompt="$1"
    local default="$2"  # "s" ou "n"

    # ============================================================
    # CASO 1 — stdin é TTY: pergunta normalmente, bloqueando
    # ============================================================
    if [ -t 0 ]; then
        local resposta
        read -p "$prompt (s/N): " -n 1 -r resposta
        echo
        # Enter vazio respeita o default passado — antes, a função
        # ignorava `$default` no modo TTY e sempre retornava falso,
        # quebrando qualquer prompt com default="s" (não existe hoje,
        # mas o contrato da função passa a ser consistente com o
        # modo não-TTY).
        if [ -z "$resposta" ]; then
            [ "$default" = "s" ]
            return $?
        fi
        [[ $resposta =~ ^[Ss]$ ]]
        return $?
    fi

    # ============================================================
    # CASO 2 — stdin NÃO é TTY: pode ter conteúdo (`echo "s" |`)
    # ou estar vazio (`< /dev/null`). Precisamos distinguir.
    # ============================================================
    #
    # `read -t 0` retorna 0 se houver dados disponíveis no stdin
    # (buffer não-vazio), e != 0 se não houver. Usamos isso como
    # sonda: se houver dados, lemos normalmente; se não houver,
    # caímos no default.
    #
    # Antes, a função assumia que "stdin não-TTY" == "sem dados",
    # e respondia sempre com o default. Isso quebrava o fluxo do
    # botão "Desinstalar FAP", que invoca:
    #
    #   setsid -f bash -c 'echo "s" | bash <(curl ...) --uninstall'
    #
    # O `echo "s" |` alimenta o stdin com "s\n", mas a função
    # curto-circuitava para o default "n" antes de ler.
    local resposta=""
    if read -t 0 -n 1 -r resposta 2>/dev/null; then
        # Havia 1 byte disponível no stdin (provavelmente o "s"
        # do `echo "s" |`). Consumimos o resto da linha para não
        # deixar lixo no buffer.
        read -t 1 -r _resto 2>/dev/null || true
        [[ $resposta =~ ^[Ss]$ ]]
        return $?
    fi

    # stdin vazio: usa o default, sem bloquear.
    echo "$prompt (não-interativo, usando padrão: $default)"
    [ "$default" = "s" ]
    return $?
}

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
"system-state-service.js"
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
"CHANGELOG.md"
"scripts/fap-cleanup.sh"
"scripts/verificar-deps-container.sh"
"scripts/validar-botoes.js"
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
"install.sh"
)
# Inclui qualquer outro .sh na raiz (defensivo — se novos scripts
# forem adicionados no futuro, já entram automaticamente).
local outros_sh
for outros_sh in "$INSTALL_DIR"/*.sh; do
    [ -f "$outros_sh" ] || continue
    local nome
    nome="$(basename "$outros_sh")"
    # Evita duplicata (já está no array acima)
    local ja_tem=0
    for arquivo in "${arquivos_para_permissoes[@]}"; do
        if [ "$arquivo" = "$nome" ]; then ja_tem=1; break; fi
    done
    if [ "$ja_tem" = "0" ]; then
        arquivos_para_permissoes+=("$nome")
    fi
done

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

# Scripts em `scripts/` — não entram no loop defensivo de `*.sh`
# da raiz (que cobre só arquivos no top-level).
# Inclui o `validar-botoes.js` (chamado por `make check-buttons`
# via `node`, mas o `+x` permite invocação direta).
for script_aux in "scripts/fap-cleanup.sh" "scripts/verificar-deps-container.sh" "scripts/validar-botoes.js"; do
    if [ -f "$INSTALL_DIR/$script_aux" ]; then
        chmod +x "$INSTALL_DIR/$script_aux" 2>/dev/null || true
        print_info "Permissão aplicada: $script_aux"
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

# Arquivos que existiram em versões anteriores do FAP e foram
# removidos/renomeados. Roda em --update, DEPOIS do git pull:
# - Se o git já tiver removido, o `rm -f` é no-op.
# - Se o git não detectou a remoção (arquivo commitado localmente
#   e trazido de volta pelo `git stash pop` do install.sh), limpamos
#   o resquício aqui.
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
"template-sessao.html"
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
# MATAR SERVIDOR FAP ANTIGO (helper compartilhado — v1.5.2)
# ============================================================
#
# Usado em 3 lugares que tinham o MESMO padrão `pgrep -f "node
# .*$INSTALL_DIR/server\.js"` — padrão que **nunca casa**, porque
# o processo real é `node server.js` (cwd = $INSTALL_DIR, mas o
# path completo NÃO aparece no cmdline). Sintoma: o servidor
# antigo sobrevivia ao `--update`; o cliente novo carregava do
# disco, mas as requisições iam para o servidor antigo — mistura
# de versões. Sintoma reportado pelo testador (v1.5.2): badge
# "enrollment necessário" com o MOK já enrolled; só sumia com
# uninstall+reinstall.
#
# Detecção em 2 camadas:
#   1. `lsof -t -i:3000` — PID escutando na porta (mais confiável).
#   2. `$INSTALL_DIR/.fap.pid` — escrito por `iniciar_fap.sh`.
# Validação: `ps -p <pid> -o cmd=` deve conter "node" + "server.js"
# (defensivo — evita matar processo alheio que pegou a porta).
#
# Também mata os containers (fap-container e fof-container) antes
# do node. O SIGTERM do node NÃO propaga para o container — são
# processos separados, iniciados pelo `iniciar_fap.sh`/`iniciar_fof.sh`.
# Sem isso, o container fica órfão quando o node morre por SIGTERM.
_matar_servidor_fap() {
    # ============================================================
    # ORDEM CORRETA: container primeiro, node depois
    # ============================================================
    #
    # O `pkill` do container PRIMEIRO tem DUAS funções:
    #   1. Faz o cliente SSE desconectar antes do node, evitando
    #      que o `_encerrarGraciosamente` do node fique 3s
    #      esperando conexões SSE fecharem.
    #   2. **Elimina a possibilidade de `lsof` devolver o PID do
    #      container** (ver `-sTCP:LISTEN` abaixo).
    #
    # O `|| true` cobre o caso de o container já ter fechado
    # (o usuário pode ter fechado manualmente antes do update).
    if command -v pkill > /dev/null 2>&1; then
    # SIGTERM primeiro (fecha graciosamente)
    pkill -f "fap-container.*--url http://localhost:3000" 2>/dev/null || true
    pkill -f "fof-container.*--url http://localhost:3000" 2>/dev/null || true
    # Se o container não morrer em 2s, força com SIGKILL. Sem isso,
    # o WebKit pode ficar vivo mostrando a página antiga — e o badge
    # de atualização permanece mesmo após o servidor novo subir.
    sleep 2
    pkill -9 -f "fap-container.*--url http://localhost:3000" 2>/dev/null || true
    pkill -9 -f "fof-container.*--url http://localhost:3000" 2>/dev/null || true
    # Órfãos do pkexec (Fase I). O `_matarArvoreProcessos` do
    # server.js limpa o mesmo UID, mas filhos root do pkexec
    # sobrevivem sem `NOPASSWD: /usr/bin/kill`. Como o install.sh
    # já tem sudo, limpamos aqui também.
    sudo pkill -9 -f "fap-cmd-" 2>/dev/null || true
    sudo pkill -9 -f "pkexec /tmp/fap-cmd-" 2>/dev/null || true
fi

    # ============================================================
    # `-sTCP:LISTEN` — FILTRA SÓ O SERVIDOR
    # ============================================================
    #
    # `lsof -i:3000` sem filtro retorna servidor (LISTEN) E
    # clientes (ESTABLISHED). O `fap-container` tem conexões
    # abertas com o node, então o `lsof -i:3000 | head -1` podia
    # retornar o PID do CONTAINER — não do node.
    #
    # Sintoma (bug v1.5.2, reportado em teste real fgc/RTX 5060):
    # o `case *node*server.js*` não casava, e o node sobrevivia ao
    # `--update`. Cliente novo (v1.5.1) lia `secure_boot_mok` do
    # `/hardware-scan`, mas falava com o servidor antigo (v1.4.9
    # sem o campo) → badge "enrollment necessário" falso positivo.
    #
    # `-sTCP:LISTEN` casa apenas sockets em estado LISTEN (o
    # servidor HTTP), nunca ESTABLISHED (clientes). Também evita
    # matar por engano algum processo que tenha conexão na porta
    # 3000 mas não seja o node.
    local pid=""
    if command -v lsof > /dev/null 2>&1; then
        pid=$(lsof -t -i:3000 -sTCP:LISTEN 2>/dev/null | head -1 || true)
    fi

    # Fallback: `.fap.pid` escrito por `iniciar_fap.sh`. Útil em
    # sistemas sem `lsof`, ou se o node morreu entre o `lsof` e o
    # `kill -0` abaixo. O arquivo guarda o PID do node (não do
    # container), então não corre o risco do `-sTCP:LISTEN` original.
    if [ -z "$pid" ] && [ -f "$INSTALL_DIR/.fap.pid" ]; then
        pid=$(cat "$INSTALL_DIR/.fap.pid" 2>/dev/null || true)
    fi

    if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
        rm -f "$INSTALL_DIR/.fap.pid" 2>/dev/null || true
        return 0
    fi

    local cmd
cmd=$(ps -p "$pid" -o cmd= 2>/dev/null || true)
case "$cmd" in
    *node*server.js*)
        print_info "🔄 Encerrando o servidor antigo em 5 segundos (PID: $pid)..."
        print_info "💡 Reabra o FAP com o comando 'fap' para usar a versão nova."
        # `setsid -f` desacopla o processo de kill da sessão do
        # install.sh. Sem isso, se o install.sh (ou o node pai)
        # morresse antes do `sleep`, o bash -c era morto junto e
        # o node antigo sobrevivia — exatamente o bug que este
        # bloco deveria evitar (v1.5.2).
        #
        # `sleep 5` (era 3): margem extra para o install.sh
        # terminar o próprio cleanup (`criar_atalhos`,
        # `reaplicar_permissoes`, etc.).
        #
        # Retry loop com SIGTERM → 2s de espera → SIGKILL: mais
        # gracioso que o `sleep 1 && kill -9` anterior. Dá tempo
        # do `_encerrarGraciosamente` do server.js fechar as
        # conexões SSE e matar as árvores de processos
        # (dnf/pkexec) que ainda estiverem rodando.
        setsid -f bash -c "
            sleep 5
            if kill -0 $pid 2>/dev/null; then
                kill -TERM $pid 2>/dev/null || true
                for i in \$(seq 1 20); do
                    if ! kill -0 $pid 2>/dev/null; then exit 0; fi
                    sleep 0.1
                done
                kill -KILL $pid 2>/dev/null || true
            fi
        " < /dev/null > /dev/null 2>&1 &
        ;;
    *)
        print_info "PID $pid não é o servidor FAP — não vou encerrar."
        ;;
esac
    rm -f "$INSTALL_DIR/.fap.pid" 2>/dev/null || true
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

    # Garante node/npm/git/curl antes de clonar. Sem isso, uma
    # máquina limpa (sem Node instalado) falharia dentro de
    # `instalar_fap` com erro obscuro do `git clone`, sem que
    # o usuário entenda que a causa é dependência faltante.
    verificar_dependencias

    instalar_fap
    desabilitar_eula_chromium
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
    # rodando com o código do FOF. O `_matar_servidor_fap()`
    # detecta via `lsof -t -i:3000` (não depende do path, que está
    # ausente do cmdline) e mata node + container. Antes, o
    # `pgrep -f "node .*/(fedora-only-fans|fedora-advantage-panel)/server\.js"`
    # nunca casava (cmdline = `node server.js`) e o FOF sobrevivia.
    _matar_servidor_fap
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
    print_step "Verificando dependências de compilação do container..."

    # Delega para o script comum (compartilhado com iniciar_fap.sh).
    # O script é idempotente: retorna 0 rapidamente se nada faltar,
    # ou roda `sudo dnf install` do que faltar e retorna o status
    # do dnf. Evita duplicação (auditoria v1.5.8).
    local script="$INSTALL_DIR/scripts/verificar-deps-container.sh"
    if [ ! -f "$script" ]; then
        # Fallback defensivo: instalação antiga (pré-v1.5.8) que
        # ainda não tem o script. Roda a checagem inline.
        print_warning "Script de verificação ausente — usando fallback inline"
        local instalar=()
        command -v gcc &> /dev/null || instalar+=("gcc")
        command -v make &> /dev/null || instalar+=("make")
        command -v pkg-config &> /dev/null || instalar+=("pkgconf-pkg-config")
        if command -v pkg-config &> /dev/null; then
            pkg-config --exists webkit2gtk-4.1 2>/dev/null || instalar+=("webkit2gtk4.1-devel")
            pkg-config --exists gtk+-3.0 2>/dev/null || instalar+=("gtk3-devel")
        else
            instalar+=("webkit2gtk4.1-devel" "gtk3-devel")
        fi
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
        return 0
    fi

    chmod +x "$script" 2>/dev/null || true
    if bash "$script"; then
        print_success "Dependências do container OK"
    else
        print_warning "Algumas dependências do container não foram instaladas"
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

# Lê /etc/os-release (padrão freedesktop, presente em todo Fedora e
# derivados). Antes usávamos /etc/fedora-release, que é específico do
# Fedora "puro" e pode não existir em derivados (Nobara, Ultramarine).
#
# ============================================================
# LEITURA EM SUBSHELL (v1.5.8 — auditoria C6)
# ============================================================
#
# Antes, o `. /etc/os-release` era sourceado no shell principal,
# sobrescrevendo `$VERSION` (definido no topo do script com o
# valor do package.json). O banner é impresso ANTES desta
# função, então não quebrava o output atual — mas qualquer
# código futuro que use `$VERSION` depois de `verificar_sistema`
# herdaria o valor errado (ex.: "Fedora 44 (Workstation
# Edition)" em vez de "1.5.8-11112026").
#
# Correção: subshell (`$( ... )`). O `. /etc/os-release` roda
# em um shell filho, e as variáveis não vazam para o pai.
local os_id os_version_id
os_id="$(. /etc/os-release 2>/dev/null && echo "$ID")"
os_version_id="$(. /etc/os-release 2>/dev/null && echo "$VERSION_ID")"

if [ -n "$os_id" ]; then
    if [ "$os_id" = "fedora" ]; then
        print_success "Fedora $os_version_id detectado"
        log "Sistema: Fedora $os_version_id"
    else
        print_warning "Sistema não identificado como Fedora (detectado: ${os_id:-desconhecido} ${os_version_id:-})"
        print_warning "A instalação pode não funcionar corretamente"
        if ! _perguntar_sim_nao "Continuar mesmo assim?" "n"; then
            print_error "Instalação cancelada"
            exit 1
        fi
    fi
else
    print_warning "Arquivo /etc/os-release não encontrado ou sem \$ID — sistema não identificado"
    if ! _perguntar_sim_nao "Continuar mesmo assim?" "n"; then
        print_error "Instalação cancelada"
        exit 1
    fi
fi
}

# ============================================================
# EULA DO CHROMIUM
# ============================================================
#
# O Fedora empacota o Chromium com uma verificação de "Additional
# Terms of Service" que aparece na primeira inicialização de
# qualquer app baseado em Chromium. Isso afeta usuários que
# instalam o Chromium via FAP (sessão Aplicativos Recomendados)
# e veem a popup de EULA na primeira execução.
#
# O arquivo /etc/chromium/master_preferences desabilita essa
# verificação de forma permanente. Só escrevemos se ele ainda
# NÃO existir — assim não sobrescrevemos uma configuração que o
# usuário tenha feito manualmente.
#
# Isso não instala o Chromium; apenas garante que, se ele for
# instalado (pelo usuário ou por uma sessão do FAP), a EULA não
# apareça.

desabilitar_eula_chromium() {
    local pref_file="/etc/chromium/master_preferences"
    local pref_dir="/etc/chromium"

    if [ -f "$pref_file" ]; then
        print_info "Configuração do Chromium já existe, mantendo"
        return 0
    fi

    print_step "Configurando Chromium para pular EULA..."

    if sudo mkdir -p "$pref_dir" && \
       echo '{"distribution":{"require_eula":false}}' | sudo tee "$pref_file" > /dev/null; then
        sudo chmod 644 "$pref_file"
        print_success "EULA do Chromium desabilitada ($pref_file)"
    else
        print_warning "Não foi possível criar $pref_file — EULA pode aparecer"
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

# pciutils fornece `lspci`, usado por hardware-service.js para
# detectar GPUs (NVIDIA/AMD/Intel) e placas de rede. Sem ele,
# /hardware-scan retorna vazio e a sessão 3 (Hardware) não
# identifica a GPU — o painel mostra "Nenhuma GPU detectada" e o
# botão de instalação fica desabilitado por engano.
if ! command -v lspci &> /dev/null; then
faltando+=("pciutils")
print_warning "pciutils (lspci) não encontrado — necessário para detecção de hardware"
else
print_success "pciutils: $(lspci --version 2>/dev/null | head -1 || echo 'presente')"
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
# ============================================================
# RESET ATÔMICO (v1.5.6)
# ============================================================
#
# Alinhado com `atualizar()` (v1.5.4). O `git pull --ff-only`
# deixa conflito em arquivos rastreados modificados —
# `git reset --hard origin/main` é idempotente e sempre termina
# num estado limpo.
git fetch origin main 2>&1 || true
git reset --hard origin/main
git stash drop 2>/dev/null || true
git clean -fd 2>/dev/null || true
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

# ============================================================
# DESINSTALAÇÃO DEFENSIVA
# ============================================================
#
# `set -e` é perigoso no bloco de desinstalação: um único `rm`
# que falhe (permissão, arquivo já removido, symlink quebrado)
# aborta o script inteiro, deixando metade dos arquivos no lugar.
#
# Como o FAP chama `install.sh --uninstall` via `bash <(curl ...)`
# (subprocesso do node, sem TTY), qualquer `sudo` que peça senha
# trava silenciosamente. O `SUDO_ASKPASS` do server.js pode não
# estar disponível no ambiente do subprocesso.
#
# Solução: desabilitar `set -e`, envolver cada remoção com
# `|| true`, e usar `find -delete` (que não precisa de sudo) em
# vez de `sudo rm` para logs em /tmp.

desinstalar() {
print_header
print_warning "Desinstalando Fedora Advantage Panel..."

# ============================================================
# FLAG `-y` / `--yes`: pula o prompt de confirmação
# ============================================================
#
# O `--uninstall` era chamado como `echo "s" | bash <(curl ...)`.
# O problema: o `curl` dentro de `<( ... )` consome o stdin do
# pipe antes do `install.sh` rodar, então o `echo "s"` chegava
# ao `curl` (não ao `read`). Resultado: o `install.sh` recebia
# stdin vazio e caía no default "n".
#
# A correção: o `server.js` (via `sobre-fap.html`) passa a chamar
# com a flag `-y`, que pula o prompt diretamente. O fallback do
# `read` (via stdin) continua funcionando para uso interativo no
# terminal (`bash install.sh --uninstall`).
local auto_confirm=false
for arg in "$@"; do
    case "$arg" in
        -y|--yes)
            auto_confirm=true
            ;;
    esac
done

if [ "$auto_confirm" = false ]; then
    if ! _perguntar_sim_nao "Tem certeza?" "n"; then
        print_info "Desinstalação cancelada"
        exit 0
    fi
else
    print_info "Desinstalação confirmada (--yes)"
fi

set +e

# ============================================================
# SAIR DO $INSTALL_DIR ANTES DE REMOVER
# ============================================================
#
# `rm -rf` não consegue remover o diretório de trabalho atual
# (o kernel retorna EBUSY). Quando o install.sh foi chamado para
# --update, `instalar_fap()` fez `cd "$INSTALL_DIR"`. Se não
# sairmos daqui, o `rm -rf "$INSTALL_DIR"` falha silenciosamente
# e a desinstalação "não faz nada" — exatamente o sintoma
# relatado. Fazemos cd ~ antes de qualquer remoção.
cd "$HOME" 2>/dev/null || cd / 2>/dev/null || true

local removidos=0
local falhas=0
local caminho_falhou=()

# ============================================================
# _remover — tenta como usuário, cai para sudo se necessário
# ============================================================
#
# Alguns arquivos dentro do FAP podem ter sido criados por root
# (ex.: `sudo make install`, ou testes rodados como root). `rm`
# como usuário falha com "permissão negada". O fallback `sudo rm`
# resolve — mas só se houver como pedir senha. O FAP invoca o
# install.sh via `setsid -f bash -c` (correção 2 no server.js),
# então o sudo tem um TTY ou usa o SUDO_ASKPASS do ambiente.
#
# v1.5.6: adicionado `sudo -A` (askpass) antes do `sudo` interativo.
# Sem isso, quando o botão "Desinstalar" do FAP chama o
# `install.sh --uninstall` via `setsid -f` (sem TTY), o `sudo`
# puro falhava com "no tty present and no askpass program specified"
# e os arquivos em /etc/ ficavam órfãos.
#
# Se nem `rm` nem `sudo` funcionarem, reportamos no final.
_remover() {
    local caminho="$1"
    local tipo="$2"
    if [ ! -e "$caminho" ] && [ ! -L "$caminho" ]; then
        return 0
    fi

    # Tentativa 1: como usuário
    if rm -rf "$caminho" 2>/dev/null; then
        print_success "$tipo removido: $caminho"
        removidos=$((removidos + 1))
        return 0
    fi

    # Tentativa 2: com sudo -n (NOPASSWD)
    if sudo -n rm -rf "$caminho" 2>/dev/null; then
        print_success "$tipo removido (sudo): $caminho"
        removidos=$((removidos + 1))
        return 0
    fi

    # Tentativa 3: com sudo -A (askpass) — usado quando o FAP
    # chama o install.sh --uninstall via botão, sem TTY
    if [ -n "$SUDO_ASKPASS" ] && [ -x "$SUDO_ASKPASS" ]; then
        if sudo -A rm -rf "$caminho" 2>/dev/null; then
            print_success "$tipo removido (sudo -A): $caminho"
            removidos=$((removidos + 1))
            return 0
        fi
    fi

    # Tentativa 4: sudo interativo (TTY)
    if sudo rm -rf "$caminho" 2>/dev/null; then
        print_success "$tipo removido (sudo): $caminho"
        removidos=$((removidos + 1))
        return 0
    fi

    print_warning "Não foi possível remover: $caminho (permissão?)"
    caminho_falhou+=("$caminho")
    falhas=$((falhas + 1))
    return 1
}

print_step "Removendo arquivos..."

# ─── 1. Diretórios de instalação (FAP + FOF legado) ───────
_remover "$INSTALL_DIR" "Diretório"
_remover "$OLD_INSTALL_DIR" "Diretório FOF legado"

# ─── 2. Symlinks em ~/.local/bin (FAP + FOF legado) ───────
local links=("fap" "fap-compat" "fap-container" "fof" "fof-compat" "fof-container")
for link in "${links[@]}"; do
    _remover "$BIN_DIR/$link" "Link"
done

# ─── 3. Atalhos .desktop (FAP + FOF legado) ───────────────
local atalhos=(
"$DESKTOP_FILE"
"$DESKTOP_FILE_COMPAT"
"$DESKTOP_FILE_OLD"
"$DESKTOP_FILE_COMPAT_OLD"
"$DESKTOP_FILE_FOF"
"$DESKTOP_FILE_FOF_COMPAT"
"$DESKTOP_FILE_FOF_OLD"
"$DESKTOP_FILE_FOF_COMPAT_OLD"
)
for atalho in "${atalhos[@]}"; do
    _remover "$atalho" "Atalho"
done

# ─── 4. Ícones hicolor (FAP + FOF legado) ─────────────────
local icones=(
"$HOME/.local/share/icons/hicolor/256x256/apps/fap-container.png"
"$HOME/.local/share/icons/hicolor/256x256/apps/fof-container.png"
)
for icone in "${icones[@]}"; do
    if [ -f "$icone" ]; then
        if rm -f "$icone" 2>/dev/null; then
            print_success "Ícone removido: $icone"
            removidos=$((removidos + 1))
        else
            print_warning "Não foi possível remover o ícone: $icone"
            falhas=$((falhas + 1))
        fi
    fi
done
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

# ─── 5. Caches WebKitGTK (FAP + FOF legado) ───────────────
_remover "$HOME/.cache/fap-container" "Cache WebKitGTK FAP"
_remover "$HOME/.local/share/fap-container" "Dados WebKitGTK FAP"
_remover "$HOME/.config/fap-container" "Configurações FAP"
_remover "$HOME/.cache/fof-container" "Cache WebKitGTK FOF"
_remover "$HOME/.local/share/fof-container" "Dados WebKitGTK FOF"
_remover "$HOME/.config/fof-container" "Configurações FOF"

# ─── 6. Arquivos de configuração do FAP em ~/.config/ ─────
#
# Arquivos que o FAP grava em ~/.config/ durante o uso normal.
# Todos têm prefixo `99-fap-` (identificável e seguro) ou são
# específicos de um app cujo arquivo foi sobrescrito pelo FAP
# (MangoHud, GameMode). `_remover` já tenta como usuário primeiro
# e cai para sudo se necessário. Arquivos inexistentes são no-op
# (não contam como falha).
#
# Diretórios como ~/.config/environment.d/ e
# ~/.config/pipewire/pipewire.conf.d/ não são removidos mesmo
# que fiquem vazios — são padrão do sistema e outros apps podem
# usá-los.
_remover "$HOME/.config/environment.d/99-fap-nvidia-vaapi.conf" "Variáveis VA-API NVIDIA"
_remover "$HOME/.config/pipewire/pipewire.conf.d/99-fap-quantum.conf" "Configuração PipeWire (baixa latência)"
_remover "$HOME/.config/MangoHud/MangoHud.conf" "Preset MangoHud"
_remover "$HOME/.config/gamemode.ini" "Preset GameMode"
# v1.5.6: os arquivos `.fap-backup` são criados pelo botão
# "Aplicar Presets" da Sessão 8 (backup antes de sobrescrever um
# config pré-existente do usuário). Se o usuário desinstala sem
# clicar na lixeira, eles ficam órfãos. O `.fap-backup` do
# MangoHud/GameMode é resíduo do FAP (não existiria sem ele) e
# pode ser removido com segurança — o original restaurado está
# em `.conf` / `.ini`, e o `.fap-backup` só existe se o FAP foi
# quem sobrescreveu.
_remover "$HOME/.config/MangoHud/MangoHud.conf.fap-backup" "Backup do Preset MangoHud"
_remover "$HOME/.config/gamemode.ini.fap-backup" "Backup do Preset GameMode"

# ─── 7. Tunings de sistema aplicados pelo FAP (/etc/sysctl.d) ──
#
# v1.5.6: os 3 arquivos `/etc/sysctl.d/99-fap-*.conf` são criados
# pelo FAP quando o usuário aplica os tunings na Sessão 11. Sem
# removê-los, ficam órfãos no sistema (sem UI para reverter após
# o FAP sumir). O `sysctl --system` reaplica o default do Fedora
# (sem os `99-fap-*`), revertendo o runtime imediatamente — sem
# reboot.
print_step "Removendo tunings de sistema do FAP..."
_remover "/etc/sysctl.d/99-fap-vm-max-map-count.conf" "Tuning vm.max_map_count"
_remover "/etc/sysctl.d/99-fap-vm-swappiness.conf" "Tuning vm.swappiness + vfs_cache_pressure"
_remover "/etc/sysctl.d/99-fap-tcp-bbr.conf" "Tuning TCP BBR"

# `sysctl --system` reaplica todos os /etc/sysctl.d/ (agora sem
# os 99-fap-*). Precisa de root. `sudo -A` cobre o caso do botão
# "Desinstalar" (sem TTY); `sudo -n` cobre NOPASSWD; `sudo` puro
# cobre uso interativo no terminal.
if sudo -n sysctl --system > /dev/null 2>&1; then
    print_success "sysctl reaplicado (sem senha)"
elif [ -n "$SUDO_ASKPASS" ] && [ -x "$SUDO_ASKPASS" ]; then
    if sudo -A sysctl --system > /dev/null 2>&1; then
        print_success "sysctl reaplicado (askpass)"
    else
        print_warning "Rode manualmente: sudo sysctl --system"
    fi
elif sudo sysctl --system > /dev/null 2>&1; then
    print_success "sysctl reaplicado"
else
    print_warning "Rode manualmente: sudo sysctl --system"
fi

# ─── 8. Logs temporários (FAP + FOF legado) ───────────────
#
# Logs em /tmp pertencem ao usuário (instalação) ou ao root
# (pkexec). `find -delete` funciona sem sudo quando o dono é o
# usuário; para os do root, tentamos sudo com askpass, mas
# falha é tolerada.
print_step "Removendo logs temporários..."

find /tmp -maxdepth 1 -name 'fap-*.log' -user "$(id -un)" -delete 2>/dev/null || true
find /tmp -maxdepth 1 -name 'fap-out-*.log' -user "$(id -un)" -delete 2>/dev/null || true
find /tmp -maxdepth 1 -name 'fap-askpass-*.sh' -user "$(id -un)" -delete 2>/dev/null || true
find /tmp -maxdepth 1 -name 'fap-cmd-*.sh' -user "$(id -un)" -delete 2>/dev/null || true
find /tmp -maxdepth 1 -name 'fof-*.log' -user "$(id -un)" -delete 2>/dev/null || true
find /tmp -maxdepth 1 -name 'fof-out-*.log' -user "$(id -un)" -delete 2>/dev/null || true
find /tmp -maxdepth 1 -name 'fof-cmd-*.sh' -user "$(id -un)" -delete 2>/dev/null || true

# Logs de root (best-effort, sem travar se não houver askpass)
if [ -n "$SUDO_ASKPASS" ] && [ -x "$SUDO_ASKPASS" ]; then
    sudo -A rm -f /tmp/fap-out-*.log 2>/dev/null || true
    sudo -A rm -f /tmp/fap-cmd-*.sh 2>/dev/null || true
    sudo -A rm -f /tmp/fof-out-*.log 2>/dev/null || true
    sudo -A rm -f /tmp/fof-cmd-*.sh 2>/dev/null || true
fi

print_success "Logs temporários processados"

# ─── 9. Limpeza de PATH nos rc files ──────────────────────
remover_linha_path() {
local arquivo="$1"
local linha_a_remover='export PATH="$HOME/.local/bin:$PATH"'

if [ ! -f "$arquivo" ]; then
return 0
fi

if ! grep -qF "$linha_a_remover" "$arquivo"; then
return 0
fi

local backup="${arquivo}.fap-backup-$(date +%Y%m%d-%H%M%S)"
if cp "$arquivo" "$backup" 2>/dev/null; then
    if grep -vF "$linha_a_remover" "$arquivo" > "${arquivo}.tmp" 2>/dev/null && \
       mv "${arquivo}.tmp" "$arquivo" 2>/dev/null; then
        print_success "Linha removida de: $arquivo (backup: $backup)"
    else
        print_warning "Não foi possível reescrever: $arquivo"
        rm -f "${arquivo}.tmp" 2>/dev/null || true
    fi
else
    print_warning "Não foi possível criar backup de: $arquivo"
fi
}

remover_linha_path "$HOME/.bashrc"
remover_linha_path "$HOME/.zshrc"
remover_linha_path "$HOME/.profile"

# ─── 10. Reindexação do menu ──────────────────────────────
update-desktop-database ~/.local/share/applications/ 2>/dev/null || true
kbuildsycoca6 --noincremental 2>/dev/null || kbuildsycoca5 --noincremental 2>/dev/null || true

# ============================================================
# ENCERRA O FAP (o container precisa fechar depois da remoção)
# ============================================================
#
# O bloco original usava `pgrep -f "node .*$INSTALL_DIR/server\.js"`,
# que nunca casa (o cmdline é só `node server.js`). O `/shutdown`
# do server.js é quem mata o container + node. Como o node pode
# já ter morrido (ou o user fechou manualmente), o `/shutdown` é
# a primeira tentativa e o `_matar_servidor_fap` é o
# fallback (v1.5.2).
#
# ORDEM IMPORTA: o `/shutdown` PRIMEIRO, porque ele mata o container
# (via pkill) e o node (via `_encerrarGraciosamente`) na ordem certa.
# Se o `_matar_servidor_fap` rodasse primeiro, ele mataria só
# o node (SIGTERM), o container ficaria órfão, e o `/shutdown`
# falharia (node morto).
print_step "Encerrando servidor e container..."
if curl -s --max-time 2 -X POST http://127.0.0.1:3000/shutdown > /dev/null 2>&1; then
    print_success "Servidor e container encerrados"
    # Aguarda o node sair de verdade antes de sair, para o
    # terminal do iniciar_fap.sh fechar junto.
    sleep 1
else
    print_info "Servidor já estava encerrado — limpando processos remanescentes"
    _matar_servidor_fap
fi

# ============================================================
# RELATÓRIO FINAL
# ============================================================
echo ""
if [ $falhas -eq 0 ]; then
    print_success "✅ FAP completamente desinstalado! ($removidos caminhos removidos)"
else
    print_warning "⚠️ Desinstalação parcial: $removidos removidos, $falhas falharam"
    print_info "Caminhos que não puderam ser removidos:"
    for c in "${caminho_falhou[@]}"; do
        echo "  - $c"
    done
    print_info ""
    print_info "Para remover manualmente, rode com sudo:"
    for c in "${caminho_falhou[@]}"; do
        echo "  sudo rm -rf $c"
    done
fi

set -e
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

# ============================================================
# LIMPEZA DO ESQUEMA ANTIGO (FOF) DURANTE UPDATE
# ============================================================
#
# Antes, o `--update` só chamava `migrar_esquema_antigo` no
# cenário `_migrar_via_update` (quando $INSTALL_DIR/.git NÃO
# existia). Isso deixava um caso descoberto:
#
#   • Usuário tinha FOF + FAP instalados (raro, mas possível
#     após uma migração parcial que falhou no meio).
#   • Roda `./install.sh --update`.
#   • O FAP é atualizado, mas o FOF continua ocupando espaço e
#     brigando pelo symlink `fof` em ~/.local/bin.
#
# Agora rodamos a migração ANTES do git pull em qualquer update.
# Se não houver FOF, a função é no-op (só faz o scan e retorna).
migrar_esquema_antigo

# ============================================================
# RESET ATÔMICO PARA origin/main (v1.5.4)
# ============================================================
#
# A versão anterior fazia:
#
#   git stash push  → guarda mudanças locais
#   git pull --ff-only → puxa do remoto
#   git stash pop || true → reaplica as mudanças locais, ENGOLINDO
#                            conflito (o `|| true`)
#
# O `git stash pop` com conflito deixa marcadores `<<<<<<<` /
# `=======` / `>>>>>>>` nos arquivos que mudaram nas duas pontas.
# O `install.sh` "termina com sucesso", mas o `package.json`
# fica inválido (2 seções `"version"` — 1 de cada lado), e o
# `node server.js` aborta no `shouldUseESLoader` com
# `ERR_INVALID_PACKAGE_CONFIG` ANTES mesmo de rodar o
# `try/catch` do `require('./package.json')`.
#
# Sintoma em teste real (fgc/RTX 5060, update v1.5.0 → v1.5.3):
# "aguardando servidor iniciar" + janela fecha em 15s +
# `git status` mostra `UU package.json` + `grep '"version"'`
# retorna 2 linhas.
#
# Correção: `git fetch` + `git reset --hard origin/main` é
# ATÔMICO — restaura o working tree e o index ao estado exato
# do remoto, sem merge, sem conflito, sem stash. As mudanças
# locais NÃO COMMITADAS são descartadas (o que já era o
# comportamento efetivo — o `stash pop` só aplicava se não
# conflitasse).
#
# O `git stash drop` remove a entrada `stash@{0}` que o
# `stash push` eventualmente tenha criado antes (defensivo).
# O `git clean -fd` remove arquivos untracked (fap-container
# stale, se existir) que poderiam interferir.
git fetch origin main 2>&1 || true

# --ff-only descartado — usamos reset --hard, que é idempotente
# e não falha se o branch local tiver divergido.
git reset --hard origin/main

# Limpa stash antigo (do push acima ou de tentativas anteriores)
# para não acumular entradas órfãs. `stash list` pode ser vazio.
git stash drop 2>/dev/null || true
git clean -fd 2>/dev/null || true

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

desabilitar_eula_chromium
verificar_arquivos_instalados
reaplicar_permissoes
criar_atalhos

print_success "✅ FAP atualizado para a versão mais recente!"

# ============================================================
# ENCERRA O SERVIDOR ANTIGO APÓS A ATUALIZAÇÃO (v1.5.2)
# ============================================================
#
# O processo `node server.js` carrega FAP_VERSION uma única vez, no
# boot. Se ele continuar rodando após o update, o endpoint /info
# segue retornando a versão antiga — e o badge de "atualização
# disponível" continua aparecendo, mesmo com o FAP já atualizado
# no disco.
#
# Pior: o `hardware-service.js` antigo continua em memória. Quando
# a v1.5.0 introduziu o campo `secure_boot_mok` no `/hardware-scan`,
# o cliente novo lia o campo mas falava com o servidor antigo, que
# não o devolvia. Sintoma reportado pelo testador: badge
# "enrollment necessário" com o MOK já enrolled; só sumia com
# uninstall+reinstall (que reinicia o servidor com o código novo).
#
# O bloco anterior usava `pgrep -f "node .*$INSTALL_DIR/server\.js"`,
# que **nunca casa** (cmdline = `node server.js`, sem o path).
# O `_matar_servidor_fap()` detecta via `lsof -t -i:3000`
# (fallback em `.fap.pid`) e mata node + container.
_matar_servidor_fap
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

Nota sobre execução como root:
- NÃO rode este script com sudo. O FAP instala em \$HOME do
  usuário e usa sudo internamente apenas para os passos que
  precisam de privilégio. Rodar como root quebra as permissões
  do diretório de instalação.

EOF
exit 0
}

main() {
case "$1" in
--help|-h)
mostrar_ajuda
;;
--uninstall)
shift
desinstalar "$@"
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
desabilitar_eula_chromium
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
