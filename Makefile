# ============================================================
# Fedora Advantage Panel (FAP) - Makefile
# Versão lida dinamicamente do package.json (alvo: make version)
# ============================================================

PREFIX ?= /usr/local
BINDIR = $(PREFIX)/bin
ICONDIR = $(PREFIX)/share/icons/hicolor/256x256/apps

CC = gcc
CFLAGS = -Wall -O2
LDFLAGS = -lm

# ============================================================
# VERSÃO DO FAP — fonte única: package.json
# ============================================================
#
# Definida ANTES de ser usada em CPPFLAGS. Isto é obrigatório:
# se CPPFLAGS += for processado antes desta definição, o Make
# adia a expansão para o momento do build e funciona por
# acidente — mas quebra silenciosamente se alguém trocar o
# operador (:=, =) ou a ordem. Manter esta ordem.
#
# Mesmo `grep -oP` dos outros scripts (install.sh, iniciar_fof.sh,
# build-container.sh). Fallback "unknown" garante que o build
# continua mesmo sem o package.json.
FOF_VERSION := $(shell grep -oP '"version"\s*:\s*"\K[^"]+' package.json 2>/dev/null | head -1)
ifeq ($(FOF_VERSION),)
FOF_VERSION := unknown
endif

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

ifeq ($(WEBKIT_PKG),)
$(error WebKitGTK 4.1 não encontrado. Instale: sudo dnf install webkit2gtk4.1-devel gtk3-devel)
endif

PKG_CFLAGS := $(shell pkg-config --cflags $(WEBKIT_PKG) gtk+-3.0)
PKG_LIBS := $(shell pkg-config --libs $(WEBKIT_PKG) gtk+-3.0)

TARGET = fof-container
SRC = src/fof-container.c

.PHONY: all clean install uninstall run version check check-basico

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

# Alvo de sanidade — roda os mesmos checks que o install.sh
# e o build-container.sh poderiam rodar. Útil antes de commitar.
#
# `check` é um alias de `check-basico` — mantido para compatibilidade
# com quem já tem o hábito de rodar `make check`.
check: check-basico

# Checagem de sintaxe JS/Bash/JSON + consistência de versão entre
# package.json e CHANGELOG.md. Alvo principal de validação do projeto.
check-basico:
	@echo "==> Checando sintaxe JavaScript..."
	@for f in script.js i18n.js server.js hardware-service.js; do \
		node --check "$$f" && echo "  OK: $$f" || exit 1; \
	done
	@echo "==> Checando sintaxe Bash..."
	@for f in iniciar_fof.sh iniciar_fof_compat.sh install.sh build-container.sh; do \
		bash -n "$$f" && echo "  OK: $$f" || exit 1; \
	done
	@echo "==> Checando JSON dos locales e do mapa de hardware..."
	@for f in locales/*.json hardware_map.json; do \
		node -e "JSON.parse(require('fs').readFileSync('$$f','utf8'))" && echo "  OK: $$f" || exit 1; \
	done
	@echo "==> Checando CHANGELOG.md vs package.json..."
	@node -e " \
		const fs = require('fs'); \
		const v = require('./package.json').version; \
		const c = fs.readFileSync('CHANGELOG.md', 'utf8'); \
		const re = new RegExp('^##\\\\s+v?' + v.replace(/[.*+?^\$${}()|[\\]\\\\]/g, '\\\\\$$&') + '\\\\s*\$$', 'm'); \
		if (!re.test(c)) { console.error('  ERRO: seção ## v' + v + ' não encontrada no CHANGELOG.md'); process.exit(1); } \
		console.log('  OK: seção v' + v + ' encontrada no CHANGELOG.md'); \
	"
	@echo ""
	@echo "✅ Todos os checks básicos passaram."
