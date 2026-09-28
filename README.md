# <img src="icone_app.png" width="55" align="center"> Fedora Only Fans (FOF)

**🌐 Idioma:** Português (BR) | [English](README.en.md) | [Español](README.es.md)

![Versão](https://img.shields.io/badge/Vers%C3%A3o-v1.0.0--09272026-orange?style=flat-square)
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

O FOF tem **dois pontos de entrada**:

- **🧭 Iniciar Configuração** — passo a passo, uma sessão por vez, com navegação Anterior/Próximo e menu fixo no topo. A ordem importa pro resultado final.
- **🛠️ Manutenção** — tarefas avulsas que não dependem de ordem: limpeza, kernels, GRUB, atualizar e desinstalar o FOF.

Cada botão lembra seu próprio estado. Fechar e reabrir o FOF (ou reiniciar o computador) sempre mostra exatamente onde você parou.

---

## ✨ Sessões de Configuração

| # | Sessão | O que faz |
|---|---|---|
| 1 | 👋 Boas-vindas | Apresentação + `dnf upgrade --refresh` completo |
| 2 | ⚙️ Otimização | DNF paralelo, locale PT-BR, dual-boot, **ajustes de desempenho** (`vm.max_map_count`, `swappiness`/`vfs_cache_pressure`, TCP BBR) |
| 3 | 📦 Repositórios | RPM Fusion (free + nonfree), Flathub |
| 4 | 🔤 Codecs e Compatibilidade | Codecs multimídia, reprodução de DVD comercial (tainted), fontes Microsoft |
| 5 | 🖥️ Hardware | AMD (Vulkan/Mesa/RADV, VA-API, CoreCtrl, LACT, overclock), NVIDIA (driver proprietário, modeset), controles (grupo input) |
| 6 | 🎮 Gaming | Launchers, Wine/Proton/NTSYNC, GameMode/MangoHud/Gamescope, ProtonUp-Qt, vkBasalt, emuladores, bufferbloat, anti-cheat awareness, atualização de Flatpaks |
| 7 | 🎬 Produção Multimídia | OBS Studio, EasyEffects, **realtime-setup**, **PipeWire baixa latência**, streaming, qpwgraph, HandBrake, wf-recorder |
| 8 | 📱 Waydroid | Android no Linux via COPR, GApps, libndk/libhoudini, Magisk, Widevine, SmartDock, waydroid-helper |
| 9 | 📦 Aplicativos Recomendados | ~45 apps via Flatpak (produtividade, mídia, gráficos, internet, edição de vídeo/áudio, nuvem) |
| 10 | 🏠 Casa Pronta | CUPS, Samba/LocalSend/Warpinator, KeePassXC, Okular+Tesseract (PDF+OCR) |
| 11 | 📊 Diagnóstico | Painel do sistema, top processos, partições, Baobab, GSmartControl, CoolerControl, journal, **status de otimizações** |
| 12 | 🐧 Fedora | Versão, detecção de Atomic/Silverblue, SELinux (status, AVCs, setroubleshoot, GUI) |

## 🛠️ Manutenção

- **Fedora** — limpeza de cache, gerenciamento de kernels, configuração do GRUB
- **FOF** — atualizar, desinstalar, changelog

---

## 🎨 Recursos

- **Interface escura/clara** — troca em tempo real, preferência salva
- **Multilíngue** — PT-BR, EN, ES com troca em tempo real
- **Logs em tempo real** via SSE, expandidos por padrão
- **Busca global (Ctrl+K)** em qualquer página
- **Ícone de desinstalar** ao lado de cada app Flatpak instalado
- **Detecção de Flatpak removido externamente** — se o usuário apagar o app por fora, o botão do FOF volta ao estado inicial
- **Barra de progresso global** no header (N/M sessões concluídas)
- **Toasts + notificações nativas** ao concluir tarefas longas (>30s)
- **Autenticação segura** via pkexec/kdesu com whitelist de comandos read-only
- **Persistência dupla** — servidor local + localStorage
- **Container nativo WebKitGTK** (sem navegador externo)
- **Versão centralizada** em `package.json`

---

## 📂 Estrutura

```
Fedora-Only-Fans/
├── index.html                       # Landing page (escolha do modo)
├── guiado.html                      # Configuração passo a passo
├── manutencao.html                  # Manutenção (Fedora + FOF)
├── style.css                        # CSS compartilhado
├── script.js                        # JS compartilhado (sessões, progresso, busca)
├── i18n.js                          # Módulo de i18n (PT-BR / EN / ES)
├── locales/
│   ├── pt-BR.json                   # Traduções (padrão)
│   ├── en.json                      # Traduções EN
│   └── es.json                      # Traduções ES
├── 00-boas-vindas.html              # Sessão 1
├── 01-restauracao.html              # Sessão 2
├── 02-otimizacao.html               # Sessão 3
├── 03-repositorios.html             # Sessão 4
├── 04-codecs-compatibilidade.html   # Sessão 5
├── 05-hardware.html                 # Sessão 6
├── 06-gaming.html                   # Sessão 7
├── 07-loja.html                     # Sessão 8
├── 08-waydroid.html                 # Sessão 9
├── 09-softwares-uteis.html          # Sessão 10
├── 10-casa-pronta.html              # Sessão 11
├── 11-diagnostico.html              # Sessão 12
├── 12-fedora.html                   # Sessão 13
├── template-sessao.html             # Molde para criar novas sessões
├── server.js                        # Servidor Node.js + SSE
├── iniciar_fof.sh                   # Inicializador
├── iniciar_fof_compat.sh            # Modo compatibilidade
├── install.sh                       # Instalador / desinstalador
├── build-container.sh / Makefile    # Build do container nativo
├── src/fof-container.c              # Container WebKitGTK (C + GTK3)
├── package.json                     # Deps Node + versão do FOF
├── icone_app.png                    # Ícone do app
└── LICENSE                          # GPL-3.0
```

---

## 🛠️ Tecnologias

- **HTML5 / CSS3** — interface responsiva, tema claro/escuro
- **JavaScript puro** — requisições à API local, i18n, busca global, dashboard
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

### v1.0.0-09272026 (Atual) 🚧

**Reestruturação de sessões**
- ✅ Sessão **04-codecs-compatibilidade** substitui `04-fontes.html` — agrupa codecs + tainted + fontes MS numa narrativa de compatibilidade
- ✅ Sessão **03-repositorios** enxugada (só RPM Fusion + Flathub)

**Novos ajustes de desempenho (todos com par aplicar/reverter)**
- ✅ Sessão 02: `vm.max_map_count`, `vm.swappiness` + `vfs_cache_pressure`, TCP BBR
- ✅ Sessão 07: `realtime-setup` (grupo realtime) e PipeWire em baixa latência

**Gaming**
- ✅ NTSYNC agora carrega módulo imediatamente + persiste via `modules-load.d`
- ✅ Novo botão "Atualizar Apps Flatpak" (sessões 06 e 09)
- ✅ Aviso educativo sobre Gamescope + NVIDIA + Flatpak

**Aplicativos Flatpak**
- ✅ Ícone de lixeira ao lado de cada app Flatpak instalado (sessões 06, 07, 09, 10)
- ✅ **Detecção de Flatpak removido externamente** — botão volta ao estado inicial automaticamente

**Diagnóstico**
- ✅ Novo painel "Ajustes de Otimizações" (KSM, max_map_count, TCP BBR, PipeWire quantum)

**Backend**
- ✅ `systemctl --user` na whitelist + contexto de env generalizado
- ✅ Novo endpoint `/flatpak-installed`
- ✅ `/system-info` estendido com 5 campos novos

### v1.0.0-09232026 ✅

- ✅ Verificação automática de atualizações via GitHub Releases (badge ⬆️ no header)
- ✅ Popup pós-atualização (avisa para reiniciar o FOF)
- ✅ Sessão 00 reformulada em 2 acordeões
- ✅ Sessão Gaming com aviso detalhado sobre NTSYNC
- ✅ Logs de sessão expandidos por padrão; altura uniforme (120–200px)
- ✅ Header com controles inline ao título

### v1.0.0 (Futuro) 🔮

- □ ?

---

## ➕ Como adicionar uma sessão

1. Copie `template-sessao.html` para `NN-nome.html`
2. Preencha os placeholders
3. Adicione uma entrada no array `SESSOES` em `script.js`
4. (Opcional) Adicione o ícone em `ICONES_SESSOES` em `guiado.html`
5. (Opcional) Adicione as traduções nos 3 JSONs de locale

---

## 🌐 Como adicionar um idioma

1. Copie `locales/pt-BR.json` para `locales/XX.json`
2. Traduza os valores (mantenha as chaves)
3. Adicione `XX` em `LANGS_DISPONIVEIS` (`i18n.js`) e `LANGS_SUPORTADOS` (`server.js`)
4. Adicione a opção no array `opcoes` de `criarSeletorIdioma()`

---

## 🏷️ Como lançar uma versão

1. Edite `package.json` → `"version": "1.0.0-<NOVA>"`
2. Edite `i18n.js` → `FALLBACK_VERSION = '1.0.0-<NOVA>'` (única exceção à regra de fonte única)
3. Crie a tag/release no GitHub com o mesmo nome

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
