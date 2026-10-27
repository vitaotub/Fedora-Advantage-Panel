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
# Mesmo `grep -oP` dos outros scripts (install.sh, iniciar_fap.sh,
# build-container.sh). Fallback "unknown" garante que o build
# continua mesmo sem o package.json.
FAP_VERSION := $(shell grep -oP '"version"\s*:\s*"\K[^"]+' package.json 2>/dev/null | head -1)
ifeq ($(FAP_VERSION),)
FAP_VERSION := unknown
endif

# Macro com a versão — passada ao gcc como string literal.
# A sintaxe '"..."' (single quote fora, double dentro) é
# necessária para o Make passar as aspas literais ao gcc.
CPPFLAGS += -DFAP_VERSION='"$(FAP_VERSION)"'

# ============================================================
# DETECÇÃO DE WEBKITGTK — SOB DEMANDA
# ============================================================
#
# Antes, a checagem do WebKitGTK rodava no topo do Makefile via
# `$(error ...)`. Isso fazia QUALQUER alvo (`clean`, `version`,
# `check`, `help`) falhar sem WebKitGTK instalado — inclusive os
# que não precisam dele.
#
# Agora a checagem roda SÓ quando o alvo `$(TARGET)` é construído,
# dentro da receita do próprio alvo. Os demais alvos funcionam
# sem WebKitGTK.
#
# Detecção: preferimos `webkit2gtk-4.1` (base GTK3, pacote atual).
# O 4.0 foi removido dos Fedora suportados e não é opção.
WEBKIT_PKG := $(shell pkg-config --exists webkit2gtk-4.1 2>/dev/null && echo webkit2gtk-4.1)

TARGET = fap-container
SRC = src/fap-container.c

.PHONY: all clean install uninstall run version check check-basico help

all: $(TARGET)

$(TARGET): $(SRC)
	@if [ -z "$(WEBKIT_PKG)" ]; then \
		echo "❌ WebKitGTK 4.1 não encontrado."; \
		echo ""; \
		echo "Instale com:"; \
		echo "  sudo dnf install webkit2gtk4.1-devel gtk3-devel"; \
		echo ""; \
		echo "Se você instalou webkitgtk6.0-devel (base GTK4), ele NÃO serve:"; \
		echo "este programa é escrito para GTK3 e precisa do webkit2gtk4.1."; \
		exit 1; \
	fi
	$(CC) $(CFLAGS) $(CPPFLAGS) \
		$(shell pkg-config --cflags $(WEBKIT_PKG) gtk+-3.0) \
		-o $(TARGET) $(SRC) \
		$(shell pkg-config --libs $(WEBKIT_PKG) gtk+-3.0) $(LDFLAGS)

clean:
	rm -f $(TARGET)

install: $(TARGET)
	install -d $(DESTDIR)$(BINDIR)
	install -m 755 $(TARGET) $(DESTDIR)$(BINDIR)/$(TARGET)
	install -d $(DESTDIR)$(ICONDIR)
	install -m 644 icone_app.png $(DESTDIR)$(ICONDIR)/fap-container.png

uninstall:
	rm -f $(DESTDIR)$(BINDIR)/$(TARGET)
	rm -f $(DESTDIR)$(ICONDIR)/fap-container.png

run: $(TARGET)
	./$(TARGET) --url http://localhost:3000 --icon icone_app.png

version:
	@echo "FAP version: $(FAP_VERSION)"

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
	@for f in script.js i18n.js server.js hardware-service.js system-state-service.js; do \
		node --check "$$f" && echo "  OK: $$f" || exit 1; \
	done
	@echo "==> Checando sintaxe Bash..."
	@for f in iniciar_fap.sh iniciar_fap_compat.sh install.sh build-container.sh; do \
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
	@echo "==> Checando se todo instalar-* tem origem mapeada (#36)..."
	@node -e " \
		const fs = require('fs'); \
		const path = require('path'); \
		const scriptJs = fs.readFileSync('script.js', 'utf8'); \
		const mapaMatch = scriptJs.match(/_MAPA_ORIGEM\s*=\s*\{([\s\S]*?)\n\};/); \
		if (!mapaMatch) { console.error('  ERRO: não achei _MAPA_ORIGEM em script.js'); process.exit(1); } \
		const mapaSet = new Set(); \
		mapaMatch[1].replace(/'([^']+)':\s*'[^']+'/g, (_, k) => mapaSet.add(k)); \
		const sessoes = fs.readdirSync('.').filter(f => /^[a-z][a-z0-9-]*\.html$$/.test(f) && f !== 'template-sessao.html'); \
		const faltando = []; \
		for (const arq of sessoes) { \
			const html = fs.readFileSync(arq, 'utf8'); \
			const ids = new Set(); \
			html.replace(/data-comando=\"(instalar-[^\"]+)\"/g, (_, id) => ids.add(id)); \
			for (const id of ids) if (!mapaSet.has(id)) faltando.push(arq + ':' + id); \
		} \
		if (faltando.length) { console.error('  ERRO: IDs sem _MAPA_ORIGEM:'); faltando.forEach(x => console.error('    ' + x)); process.exit(1); } \
		console.log('  OK: todos os instalar-* têm origem mapeada'); \
	"
	@echo "==> Checando se data-i18n / _t() têm chave nos locales (#43)..."
	@node -e " \
		const fs = require('fs'); \
		const path = require('path'); \
		const locales = ['en', 'es'].map(l => ({ nome: l, dados: JSON.parse(fs.readFileSync('locales/' + l + '.json', 'utf8')) })); \
		const scriptJs = fs.readFileSync('script.js', 'utf8'); \
		const sessoes = fs.readdirSync('.').filter(f => /^[a-z][a-z0-9-]*\.html$$/.test(f) && f !== 'template-sessao.html'); \
		const chavesUsadas = new Set(); \
		const isChaveValida = k => /^[a-zA-Z][a-zA-Z0-9_.-]*$$/.test(k) && !/[._]$$/.test(k); \
		const addChave = k => { if (isChaveValida(k)) chavesUsadas.add(k); }; \
		for (const arq of sessoes) { \
			const html = fs.readFileSync(arq, 'utf8'); \
			html.replace(/data-i18n(?:-html|-placeholder|-title|-aria-label)?=\"([^\"]+)\"/g, (_, k) => addChave(k)); \
			html.replace(/_t(?:Vars)?\(\s*'([a-zA-Z0-9_.-]+)'/g, (_, k) => addChave(k)); \
		} \
		scriptJs.replace(/_t(?:Vars)?\(\s*'([a-zA-Z0-9_.-]+)'/g, (_, k) => addChave(k)); \
		function buscarChave(obj, caminho) { \
			const partes = caminho.split('.'); \
			let atual = obj; \
			for (const p of partes) { if (atual == null || typeof atual !== 'object') return undefined; atual = atual[p]; } \
			return atual; \
		} \
		const faltando = []; \
		for (const loc of locales) { \
			for (const k of chavesUsadas) { \
				if (buscarChave(loc.dados, k) === undefined) faltando.push(loc.nome + ':' + k); \
			} \
		} \
		if (faltando.length) { console.error('  ERRO: chaves i18n faltando:'); faltando.slice(0, 30).forEach(x => console.error('    ' + x)); if (faltando.length > 30) console.error('    ... e mais ' + (faltando.length - 30)); process.exit(1); } \
		console.log('  OK: ' + chavesUsadas.size + ' chaves i18n presentes em en+es'); \
	"
	@echo ""
	@echo "✅ Todos os checks básicos passaram."

# Ajuda rápida. Não depende de WebKitGTK.
help:
	@echo "Alvos disponíveis:"
	@echo "  all / fap-container   Compila o container (requer WebKitGTK 4.1)"
	@echo "  clean                 Remove o binário"
	@echo "  install / uninstall   Instala/remove em \$$PREFIX"
	@echo "  run                   Roda o container apontando para localhost:3000"
	@echo "  version               Mostra a versão (lida do package.json)"
	@echo "  check / check-basico  Validação de sintaxe + consistência"
	@echo "  help                  Mostra esta ajuda"
