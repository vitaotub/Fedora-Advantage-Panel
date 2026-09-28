#!/usr/bin/env bash
# ============================================================
# Fedora Only Fans (FOF) - Modo Compatibilidade
# ============================================================
#
# Este script força renderização por software para GPUs
# sem aceleração 3D (NVIDIA legacy, Intel antiga, VMs, etc.)
#
# Uso: ./iniciar_fof_compat.sh [opções]
#
# Opções:
#   --debug, -d      Modo debug (logs detalhados)
#   --no-clean       Não limpar perfis do navegador
#   --help, -h       Mostra esta ajuda
# ============================================================

# ============================================================
# FORÇAR RENDERIZAÇÃO POR SOFTWARE
# ============================================================

# Desabilitar aceleração gráfica do WebKit
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1

# Forçar X11 (evita problemas com Wayland)
export GDK_BACKEND=x11

# Forçar renderização por software (OpenGL via CPU)
export LIBGL_ALWAYS_SOFTWARE=1
export GALLIUM_DRIVER=llvmpipe

# Desabilitar aceleração de vídeo
export WEBKIT_DISABLE_ACCELERATED_2D_CANVAS=1

# ============================================================
# RESOLUÇÃO DE SYMLINK
# ============================================================
#
# Mesma lógica do iniciar_fof.sh: se o script for invocado via
# symlink (ex.: ~/.local/bin/fof-compat), BASH_SOURCE[0] aponta
# para o symlink, não para o arquivo real. readlink -f resolve a
# cadeia inteira e nos dá o diretório de instalação verdadeiro.
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
# invocar o iniciar_fof.sh. Idempotente: se já estiver certo, não
# faz nada. O `|| true` mantém compatibilidade com `set -e`.
for f in iniciar_fof.sh iniciar_fof_compat.sh build-container.sh install.sh fof-container; do
    [ -f "$f" ] && [ ! -x "$f" ] && chmod +x "$f" 2>/dev/null || true
done

# ============================================================
# VERIFICAÇÕES
# ============================================================

if [ ! -f "$DIR/iniciar_fof.sh" ]; then
    echo "❌ Arquivo iniciar_fof.sh não encontrado em: $DIR"
    echo " Certifique-se de estar no diretório correto."
    exit 1
fi

# ============================================================
# AJUDA ESPECÍFICA DO MODO COMPATIBILIDADE
# ============================================================
#
# Tratamos --help/-h aqui (antes de chamar o principal) porque o
# help do iniciar_fof.sh não menciona o modo compatibilidade. Se
# deixássemos passar direto, o usuário veria o help padrão — o que
# seria confuso, já que ele invocou o modo compat de propósito.
#
# Todas as OUTRAS flags (--debug, --no-clean) são repassadas via
# "$@" e o próprio iniciar_fof.sh se encarrega de parseá-las. Não
# duplicamos esse parsing aqui para evitar mensagens repetidas.
for arg in "$@"; do
    case $arg in
        --help|-h)
            echo "🐧 Fedora Only Fans (FOF) - Modo Compatibilidade"
            echo ""
            echo "Uso: ./iniciar_fof_compat.sh [opções]"
            echo ""
            echo "Opções:"
            echo "  --debug, -d      Modo debug (logs detalhados)"
            echo "  --no-clean       Não limpar perfis do navegador"
            echo "  --help, -h       Mostra esta ajuda"
            echo ""
            echo "Este modo força renderização por software para"
            echo "GPUs sem aceleração 3D (NVIDIA legacy, Intel antiga, VMs)"
            exit 0
            ;;
    esac
done

# ============================================================
# EXECUTAR O SCRIPT NORMAL
# ============================================================

echo ""
echo "============================================================"
echo " 🐧 Fedora Only Fans (FOF) - Modo Compatibilidade"
echo "============================================================"
echo ""
echo "ℹ️ Renderização por software ativada"
echo "ℹ️ Ideal para GPUs sem aceleração 3D"
echo "ℹ️ (NVIDIA legacy, Intel antiga, VMs, etc.)"
echo ""
echo "🔄 Iniciando o FOF em modo compatível..."
echo ""

# Executar o script normal com as variáveis de ambiente já exportadas.
# Todas as opções (--debug, --no-clean, --help) são repassadas via
# "$@" e tratadas pelo iniciar_fof.sh. O --help já foi interceptado
# acima, então na prática só chegam aqui as flags de debug/clean.
./iniciar_fof.sh "$@"
