#!/usr/bin/env bash
# ============================================================
# Fedora Advantage Panel (FAP) — Verificação de dependências
# de compilação do container nativo (WebKitGTK 4.1 + GTK3).
# ============================================================
#
# Usado por `install.sh` e `iniciar_fap.sh`. Ambos precisam das
# mesmas dependências para compilar `fap-container`. Manter o
# código em UM lugar evita drift entre os dois chamadores.
#
# Uso:
#   bash scripts/verificar-deps-container.sh
#
# Comportamento:
#   • Se o binário `fap-container` já existe (no diretório pai),
#     sai imediatamente com 0 (nada a checar).
#   • Senão, checa BINÁRIOS (`gcc`, `make`, `pkg-config`) e
#     BIBLIOTECAS (`webkit2gtk-4.1`, `gtk+-3.0`) via
#     `pkg-config --exists`.
#   • Se faltar algo, roda `sudo dnf install -y <pkgs>`.
#
# Retorno:
#   0 → todas as deps presentes (ou instaladas com sucesso)
#   1 → alguma dep não pôde ser instalada
#
# Idempotente: no-op (~50ms) se nada faltar.
#
# NÃO usar `set -e`: reportamos o status via `exit` explícito.

set -o pipefail

# Se o binário já existe, sai imediatamente — não vale a pena
# gastar segundos checando pacotes de compilação quando não há
# nada a compilar. O `cd ..` é porque este script vive em
# `scripts/` e o binário fica na raiz do projeto.
if [ -f "$(dirname "$0")/../fap-container" ]; then
    echo "✅ Container já compilado — deps não checadas."
    exit 0
fi

faltando=()

if ! command -v gcc &> /dev/null; then
    faltando+=("gcc")
fi

if ! command -v make &> /dev/null; then
    faltando+=("make")
fi

# `pkgconfig` foi renomeado para `pkgconf-pkg-config` no Fedora 40+.
# O nome antigo só existe como Provides virtual, que `rpm -q` não
# enxerga — por isso a checagem é pelo BINÁRIO, não pelo pacote.
if ! command -v pkg-config &> /dev/null; then
    faltando+=("pkgconf-pkg-config")
fi

# Bibliotecas: `pkg-config --exists` é a forma correta de checar
# headers. Se `pkg-config` não existir, os dois testes falham e
# as duas devel entram na lista (correto — sem pkg-config o
# build não funciona de qualquer jeito).
if command -v pkg-config &> /dev/null; then
    if ! pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
        faltando+=("webkit2gtk4.1-devel")
    fi
    if ! pkg-config --exists gtk+-3.0 2>/dev/null; then
        faltando+=("gtk3-devel")
    fi
else
    faltando+=("webkit2gtk4.1-devel")
    faltando+=("gtk3-devel")
fi

if [ ${#faltando[@]} -eq 0 ]; then
    echo "✅ Dependências de compilação do container já estão instaladas."
    exit 0
fi

echo "ℹ️  Instalando dependências de compilação: ${faltando[*]}"
echo "ℹ️  (será solicitada sua senha de administrador)"

if sudo dnf install -y "${faltando[@]}"; then
    echo "✅ Dependências de compilação instaladas."
    exit 0
else
    echo "⚠️  Algumas dependências não puderam ser instaladas."
    exit 1
fi
