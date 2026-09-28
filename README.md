# <img src="icone_app.png" width="55" align="center"> Fedora Only Fans (FOF)

**🌐 Idioma:** Português (BR) | [English](README.en.md) | [Español](README.es.md)

![Versão](https://img.shields.io/badge/Vers%C3%A3o-v1.0.0--09282026-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44+-294172?style=flat-square&logo=fedora)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-GPL--3.0-green?style=flat-square)
![Idiomas](https://img.shields.io/badge/Idiomas-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Deixando o seu Fedora pronto para o "play" — visual, rápido e sem terminal.

---

## 🚀 Instalação

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotek/Fedora-Only-Fans/main/install.sh)
```

## 📦 Comandos

```bash
fof                                 # Iniciar (modo normal)
fof-compat                          # Iniciar (modo compatibilidade — GPUs antigas)
# Atualizar:    passe --update ao install.sh
# Desinstalar:  passe --uninstall ao install.sh
```

---

## 📖 Sobre

O **Fedora Only Fans (FOF)** é um painel de automação visual para o Fedora Linux. Transforma uma instalação limpa em um sistema completo — codecs, drivers, repositórios, ferramentas — através de cliques, sem abrir o terminal.

O FOF tem **um único ponto de entrada**: o botão **"Iniciar"**, que leva você pelas 12 sessões passo a passo, na ordem lógica. Cada sessão agrupa tarefas relacionadas, e o progresso é salvo automaticamente.

Cada botão lembra seu próprio estado. Fechar e reabrir o FOF (ou reiniciar o computador) sempre mostra exatamente onde você parou.

---

## ✨ Sessões de Configuração

| # | Sessão | O que faz |
|---|---|---|
| 1 | 🚀 Primeiros Passos | Atualização completa do sistema + RPM Fusion + Flathub |
| 2 | 🔤 Codecs e Compatibilidade | Codecs multimídia, reprodução de DVD comercial (tainted), fontes Microsoft |
| 3 | 🖥️ Hardware | AMD (Vulkan/Mesa/RADV, VA-API, CoreCtrl, LACT, overclock), NVIDIA (driver proprietário, modeset), controles (grupo input) |
| 4 | 🎬 Produção Multimídia | OBS Studio, EasyEffects, streaming, qpwgraph, HandBrake, wf-recorder |
| 5 | 📦 Aplicativos Recomendados | ~45 apps via Flatpak (produtividade, mídia, gráficos, internet, edição de vídeo/áudio, nuvem) |
| 6 | 🏠 Casa e Escritório | CUPS, Samba/LocalSend/Warpinator, KeePassXC, Okular+Tesseract (PDF+OCR) |
| 7 | 🎮 Gaming | Launchers, Wine/Proton/NTSYNC, GameMode/MangoHud/Gamescope, ProtonUp-Qt, vkBasalt, emuladores, anti-cheat awareness |
| 8 | 📱 Waydroid | Android no Linux via COPR, GApps, libndk/libhoudini, Magisk, Widevine, SmartDock |
| 9 | 📊 Diagnóstico | Painel do sistema, top processos, partições, GSmartControl, CoolerControl, journal, **status de otimizações** |
| 10 | 🛠️ Ajustes e Manutenção | Tunings de desempenho, ajustes de áudio, DNF, idioma, dual-boot, limpeza, kernels, GRUB |
| 11 | 🐧 Estado do Fedora | Versão, detecção de Atomic/Silverblue, SELinux (status, AVCs, setroubleshoot, GUI) |
| 12 | 📖 Sobre o FOF | Sobre o projeto + atualizar/desinstalar FOF + changelog dinâmico |

---

## 🎨 Recursos

- **Interface escura/clara** — troca em tempo real, preferência salva
- **Multilíngue** — PT-BR, EN, ES com troca em tempo real
- **Logs em tempo real** via SSE, expandidos por padrão
- **Ícone de desinstalar** ao lado de cada app Flatpak instalado
- **Detecção de Flatpak removido externamente** — se o usuário apagar o app por fora, o botão do FOF volta ao estado inicial
- **Barra de progresso global** no header (N/M sessões concluídas)
- **Toasts + notificações nativas** ao concluir tarefas longas (>30s)
- **Autenticação segura** via pkexec/kdesu com whitelist de comandos read-only
- **Persistência dupla** — servidor local + localStorage
- **Limpeza automática de IDs órfãos** — sessões renomeadas não deixam lixo no progresso
- **Container nativo WebKitGTK** (sem navegador externo)
- **Changelog dinâmico** — lido do `CHANGELOG.md` em runtime
- **Versão centralizada** em `package.json`

---

## 📂 Estrutura

```
Fedora-Only-Fans/
├── index.html                       # Landing page (entrada única)
├── guiado.html                      # Configuração passo a passo
├── style.css                        # CSS compartilhado
├── script.js                        # JS compartilhado (sessões, progresso)
├── i18n.js                          # Módulo de i18n (PT-BR / EN / ES)
├── locales/
│   ├── en.json                      # Traduções EN
│   └── es.json                      # Traduções ES
│   # PT-BR não tem arquivo próprio — o HTML é a fonte
├── primeiros-passos.html            # Sessão 1
├── codecs.html                      # Sessão 2
├── hardware.html                    # Sessão 3
├── producao-multimidia.html         # Sessão 4
├── aplicativos.html                 # Sessão 5
├── casa-escritorio.html             # Sessão 6
├── gaming.html                      # Sessão 7
├── waydroid.html                    # Sessão 8
├── diagnostico.html                 # Sessão 9
├── ajustes-manutencao.html          # Sessão 10
├── estado-fedora.html               # Sessão 11
├── sobre-fof.html                   # Sessão 12
├── template-sessao.html             # Molde para criar novas sessões
├── CHANGELOG.md                     # Histórico de mudanças (lido pelo FOF)
├── server.js                        # Servidor Node.js + SSE + endpoints
├── iniciar_fof.sh                   # Inicializador
├── iniciar_fof_compat.sh            # Modo compatibilidade
├── install.sh                       # Instalador / desinstalador / updater
├── build-container.sh / Makefile    # Build do container nativo
├── src/fof-container.c              # Container WebKitGTK (C + GTK3)
├── package.json                     # Deps Node + versão do FOF
├── icone_app.png                    # Ícone do app
└── LICENSE                          # GPL-3.0
```

---

## 🛠️ Tecnologias

- **HTML5 / CSS3** — interface responsiva, tema claro/escuro
- **JavaScript puro** — requisições à API local, i18n, dashboard
- **Node.js** — servidor backend local, execução segura de processos
- **Server-Sent Events (SSE)** — logs em tempo real
- **Bash** — inicialização, instalação
- **pkexec / kdesu** — autenticação segura
- **WebKitGTK** — container nativo

---

## 🛡️ Segurança

- Autenticação via **pkexec/kdesu** (nunca expõe senhas)
- **Whitelist** de comandos read-only sem autenticação (`rpm -q`, `uname -r`, `flatpak`, `systemctl --user`, `gtk-launch`)
- **Sanitização** de entrada e validação de `idComando`
- **Rate limiting** de 1.5s por `idComando`
- **Log rotation** automática (7 dias em `/tmp/fof-*.log`)

---

## 🎯 Changelog

O histórico completo de mudanças está em [`CHANGELOG.md`](CHANGELOG.md). O próprio FOF exibe o changelog da versão atual, dentro da sessão **Sobre o FOF** — carregado dinamicamente do arquivo.

### v1.0.0-09282026 (Atual) 🚧

- Reestruturação completa das sessões (13 → 12), com IDs semânticos (sem número)
- Sessão **Ajustes e Manutenção** agrupa tunings de desempenho, ajustes de áudio, DNF, idioma, dual-boot, limpeza, kernels e GRUB
- Sessão **Sobre o FOF** agrupa o texto institucional, atualização e desinstalação do FOF
- Removidas: sessão **Restauração** (Btrfs-Assistant) e página **Manutenção** (conteúdo redistribuído)
- Tela inicial redesenhada: relógio ao vivo e card único com texto + botão "Iniciar"
- Busca global (Ctrl+K) removida — apresentava problemas no WebKitGTK
- Changelog dinâmico via `GET /changelog`
- Botão "Ver changelog completo" corrigido (usava `window.open`, bloqueado pelo WebKitGTK)
- `install.sh --update` agora limpa arquivos de sessões antigas antes do `git pull`
- Progresso limpa automaticamente IDs órfãos no boot
- Badge de atualização aponta para `guiado.html?session=sobre-fof`

### v1.0.0-09232026 ✅

- Verificação automática de atualizações via GitHub Releases
- Popup pós-atualização
- Ícone de desinstalar em cada app Flatpak
- Detecção de Flatpak removido externamente
- Painel "Ajustes de Otimizações" no Diagnóstico

### v1.0.0 ✅

- Versão inicial pública

---

## ➕ Como adicionar uma sessão

1. Copie `template-sessao.html` para `<nome>.html` (sem número)
2. Preencha os placeholders
3. Adicione uma entrada no array `SESSOES` em `script.js` (com `id: '<nome>'`)
4. Adicione o ícone (emoji) em `ICONES_SESSOES` em `guiado.html`
5. Adicione as chaves i18n em `locales/en.json` e `locales/es.json` (e também no HTML, como fallback PT-BR)

A ordem de exibição vem da posição da entrada no array `SESSOES`, não do nome do arquivo.

---

## 🌐 Como adicionar um idioma

1. Copie `locales/en.json` para `locales/XX.json`
2. Traduza os valores (mantenha as chaves)
3. Adicione `XX` em `LANGS_DISPONIVEIS` (`i18n.js`) e `LANGS_SUPORTADOS` (`server.js`)
4. Adicione a opção no array `opcoes` de `criarSeletorIdioma()`

**Nota:** o idioma padrão (pt-BR) **não tem arquivo JSON** de propósito. O HTML de cada sessão contém o texto em português como fallback, e o `i18n.js` faz curto-circuito quando o idioma é o padrão — nunca dispara `fetch` para `/locales/pt-BR.json`. Isso evita manter strings duplicadas.

---

## 🏷️ Como lançar uma versão

1. Edite `package.json` → `"version": "1.0.0-<NOVA>"`
2. Edite `i18n.js` → `FALLBACK_VERSION = '1.0.0-<NOVA>'` (única exceção à regra de fonte única — usado como cache-buster antes do `/info` responder)
3. Adicione uma seção nova no topo do `CHANGELOG.md`, com cabeçalho exatamente `## v1.0.0-<NOVA>` (casando com o `package.json`)
4. Crie a tag/release no GitHub com o mesmo nome

Todo o resto (banner do `install.sh`, badge do FOF, `--help` do container) é automático.

---

## 🤝 Contribuir

1. Fork → branch → commit → push → Pull Request

## 🐛 Reportar Bugs

Abra uma issue em [github.com/vitaotek/Fedora-Only-Fans/issues](https://github.com/vitaotek/Fedora-Only-Fans/issues) incluindo:
- Versão do Fedora
- Desktop environment
- Logs (`/tmp/fof-*.log`)
- Passos para reproduzir

## ⚠️ Aviso Legal

Projeto em desenvolvimento (alpha). Uso em produção por conta e risco. **Sempre faça backup** antes de alterações no sistema.

## 📄 Licença

**GPL-3.0** — veja [LICENSE](LICENSE).

## 👤 Autor

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Agradecimentos

[Fedora Project](https://getfedora.org/) · [RPM Fusion](https://rpmfusion.org/) · [Flathub](https://flathub.org/)

**Feito com ❤️ para a comunidade Fedora**
