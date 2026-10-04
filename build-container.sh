#!/usr/bin/env bash
# ============================================================
# Build do Container FAP
# ============================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# ============================================================
# VERSÃO DO FOF — fonte única: package.json
# ============================================================
#
# O C não lê arquivos em runtime. Injetamos a versão via macro
# `-DFOF_VERSION="..."` no gcc, lendo do package.json com o mesmo
# `grep -oP` dos outros scripts. Fallback "unknown" — o binário
# continua compilando mesmo sem o arquivo.
FOF_VERSION="$(grep -oP '"version"\s*:\s*"\K[^"]+' "$DIR/package.json" 2>/dev/null | head -1)"
[ -z "$FOF_VERSION" ] && FOF_VERSION="unknown"

echo "============================================================"
echo " 🏗️ Fedora Advantage Panel - Build do Container"
echo "============================================================"
echo ""

echo "🔍 Verificando dependências..."

# ============================================================
# DETECÇÃO AUTOMÁTICA DA VERSÃO DO WEBKITGTK
# ============================================================
#
# CORREÇÃO: o Fedora removeu o pacote webkit2gtk2.0 (a API "4.0") da
# distribuição há algumas versões — não existe mais em nenhum Fedora
# suportado por este projeto (40+). O código C usa APIs exclusivas do
# WebKitGTK 4.1 (webkit_policy_decision_use,
# webkit_navigation_policy_decision_get_navigation_action), então 4.0
# não é mais uma opção válida.
#
# Existe hoje um TERCEIRO pacote de WebKit no Fedora: webkitgtk6.0 (base
# GTK4). Este programa é escrito para GTK3 (webkit2gtk4.1) e não compila
# contra o webkitgtk6.0 sem uma reescrita grande (APIs diferentes). Se só
# o pacote GTK4 estiver instalado, agora detectamos isso especificamente
# e explicamos com um comando exato, em vez de um erro genérico.

WEBKIT_VERSION=""
WEBKIT_PKG=""

# Verifica a versão suportada (GTK3): webkit2gtk-4.1 é o pacote atual no
# Fedora 40+.
if pkg-config --exists webkit2gtk-4.1 gtk+-3.0 2>/dev/null; then
WEBKIT_VERSION="4.1"
WEBKIT_PKG="webkit2gtk-4.1"
echo "✅ WebKitGTK-4.1 detectado"
fi

if [ -z "$WEBKIT_VERSION" ]; then
echo "❌ Nenhuma versão compatível do WebKitGTK encontrada!"
echo ""
if pkg-config --exists webkitgtk-6.0 2>/dev/null; then
echo " Detectamos webkitgtk6.0-devel instalado (base GTK4), mas este"
echo " programa foi escrito para GTK3 e precisa do webkit2gtk4.1."
echo " Os dois pacotes podem conviver no mesmo sistema — instale também:"
echo ""
echo " sudo dnf install webkit2gtk4.1-devel gtk3-devel"
else
echo " Instale com:"
echo ""
echo " sudo dnf install webkit2gtk4.1-devel gtk3-devel"
echo ""
echo " Se o comando acima disser que o pacote não foi encontrado,"
echo " confirme a versão do seu Fedora com 'cat /etc/fedora-release'"
echo " e verifique se os repositórios padrão estão habilitados"
echo " ('dnf repolist')."
fi
echo ""
echo " Se o pacote já está instalado e mesmo assim isto falha, rode:"
echo " pkg-config --list-all | grep -i webkit"
echo " para conferir se o pkg-config está enxergando o pacote certo."
echo ""
exit 1
fi

echo "✅ Dependências OK"

mkdir -p src

if [ ! -f "src/fof-container.c" ]; then
echo "❌ Arquivo src/fof-container.c não encontrado!"
echo ""
echo " Certifique-se de que o arquivo existe."
exit 1
fi

echo ""
echo "📦 Compilando container com WebKitGTK-$WEBKIT_VERSION..."

# Compila usando o pacote WebKitGTK detectado, passando a versão do
# FOF como macro C (-DFOF_VERSION=...). O .c tem um #ifndef que cai
# em "unknown" se a macro não for passada.
if gcc -Wall -O2 \
-DFOF_VERSION="\"$FOF_VERSION\"" \
$(pkg-config --cflags $WEBKIT_PKG gtk+-3.0) \
-o fof-container src/fof-container.c \
$(pkg-config --libs $WEBKIT_PKG gtk+-3.0) -lm; then
echo ""
echo "============================================================"
echo " ✅ Container compilado com sucesso!"
echo "============================================================"
echo ""
echo "📁 Arquivo: $DIR/fof-container"
echo "📦 Tamanho: $(du -h fof-container | cut -f1)"
echo "🔧 WebKitGTK: $WEBKIT_VERSION"
echo "🏷️ Versão do FOF: $FOF_VERSION"
echo ""
echo "Para executar:"
echo " ./fof-container"
echo ""
echo "Com opções:"
echo " ./fof-container --url http://localhost:3000 --icon icone_app.png"
echo ""
echo "Para instalar no sistema:"
echo " sudo make install"
echo ""
else
echo "❌ Falha na compilação"
exit 1
fi
