# ============================================================
# Fedora Only Fans (FOF) - Makefile
# Versão lida dinamicamente do package.json (alvo: make version)
# ============================================================

PREFIX ?= /usr/local
BINDIR = $(PREFIX)/bin
ICONDIR = $(PREFIX)/share/icons/hicolor/256x256/apps

CC = gcc
CFLAGS = -Wall -O2
LDFLAGS = -lm

# Macro com a versão — passada ao gcc como string literal.
# A sintaxe '"..."' (single quote fora, double dentro) é
# necessária para o Make passar as aspas literais ao gcc.
CPPFLAGS += -DFOF_VERSION='"$(FOF_VERSION)"'

# Detecção de WebKitGTK 4.1 (base GTK3). Este é o único pacote
# válido em qualquer Fedora suportado por este projeto (40+).
# O pacote 4.0 (API antiga, webkit2gtk2.0) foi removido da
# distribuição e não é mais uma opção — o build-container.sh
# segue a mesma decisão, para manter os dois caminhos de build
# consistentes.
WEBKIT_PKG := $(shell pkg-config --exists webkit2gtk-4.1 && echo webkit2gtk-4.1)

# ============================================================
# VERSÃO DO FOF — fonte única: package.json
# ============================================================
#
# Mesmo `grep -oP` dos outros arquivos. `$(shell ...)` executa o
# comando no parse do Makefile. Fallback "unknown" garante que o
# build continua mesmo sem o package.json.
FOF_VERSION := $(shell grep -oP '"version"\s*:\s*"\K[^"]+' package.json 2>/dev/null | head -1)
ifeq ($(FOF_VERSION),)
FOF_VERSION := unknown
endif

ifeq ($(WEBKIT_PKG),)
$(error WebKitGTK 4.1 não encontrado. Instale: sudo dnf install webkit2gtk4.1-devel gtk3-devel)
endif

PKG_CFLAGS := $(shell pkg-config --cflags $(WEBKIT_PKG) gtk+-3.0)
PKG_LIBS := $(shell pkg-config --libs $(WEBKIT_PKG) gtk+-3.0)

TARGET = fof-container
SRC = src/fof-container.c

.PHONY: all clean install uninstall run version

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(CPPFLAGS) $(PKG_CFLAGS) -o $(TARGET) $(SRC) $(PKG_LIBS) $(LDFLAGS)

clean:
	rm -f $(TARGET)

install: $(TARGET)
	install -d $(DESTDIR)$(BINDIR)
	install -m 755 $(TARGET) $(DESTDIR)$(BINDIR)/$(TARGET)
	install -d $(DESTDIR)$(ICONDIR)
	install -m 644 icone_app.png $(DESTDIR)$(ICONDIR)/fof-container.png

uninstall:
	rm -f $(DESTDIR)$(BINDIR)/$(TARGET)
	rm -f $(DESTDIR)$(ICONDIR)/fof-container.png

run: $(TARGET)
	./$(TARGET) --url http://localhost:3000 --icon icone_app.png

version:
	@echo "FOF version: $(FOF_VERSION)"