# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Idioma:** Português (BR) | [English](README.en.md) | [Español](README.es.md)

![Versão](https://img.shields.io/badge/Vers%C3%A3o-v1.0.0--10012026.b-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44+-294172?style=flat-square&logo=fedora)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-GPL--3.0-green?style=flat-square)
![Idiomas](https://img.shields.io/badge/Idiomas-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Deixando o seu Fedora pronto para o "play" — visual, rápido e sem terminal.

---

## 🚀 Instalação

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
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

O **Fedora Advantage Panel (FAP)** é um painel de automação visual para o Fedora Linux. Transforma uma instalação limpa em um sistema completo — codecs, drivers, repositórios, ferramentas — através de cliques, sem abrir o terminal.

O FAP tem **um único ponto de entrada**: o botão **"Iniciar"**, que leva você pelas 14 sessões passo a passo, na ordem lógica. Cada sessão agrupa tarefas relacionadas, e o progresso é salvo automaticamente.

Cada botão lembra seu próprio estado. Fechar e reabrir o FAP (ou reiniciar o computador) sempre mostra exatamente onde você parou.

---

## ✨ Sessões de Configuração

| # | Sessão | O que faz |
|---|---|---|
| 1 | 🚀 Primeiros Passos | Atualização completa do sistema + RPM Fusion + Flathub + remoção opcional do repositório Fedora Flatpak |
| 2 | 🔤 Codecs e Compatibilidade | Codecs multimídia, reprodução de DVD comercial (tainted), fontes Microsoft |
| 3 | 🖥️ Hardware | AMD (Vulkan/Mesa/RADV, VA-API, CoreCtrl, LACT, overclock), NVIDIA (detecção de geração + driver proprietário + modeset), Intel (Intel Media Driver) |
| 4 | 🔌 Dispositivos e Periféricos | Detecção automática de hardware, firmwares adicionais, COPRs de comunidade (Razer/OpenRazer, xpadneo, Broadcom), controles (grupo input, regras udev) |
| 5 | 🎬 Produção Multimídia | OBS Studio, câmera virtual, EasyEffects |
| 6 | 📦 Aplicativos Recomendados | ~45 apps via Flatpak (produtividade, mídia, gráficos, internet, edição de vídeo/áudio, nuvem) |
| 7 | 🏠 Casa e Escritório | CUPS, Samba/LocalSend/Warpinator, KeePassXC, Okular+Tesseract (PDF+OCR) |
| 8 | 🎮 Gaming | Launchers, Wine/Proton/NTSYNC, GameMode/MangoHud/Gamescope, ProtonUp-Qt, vkBasalt, emuladores, anti-cheat awareness |
| 9 | 📱 Waydroid | Android no Linux via COPR, GApps, libndk/libhoudini, Magisk, Widevine, SmartDock |
| 10 | 🖥️ Virtualização | QEMU/KVM + virt-manager, VirtualBox (com akmod-VirtualBox) e GNOME Boxes |
| 11 | 📊 Diagnóstico | Painel do sistema, top processos, partições, GSmartControl, CoolerControl, journal, status de otimizações |
| 12 | 🛠️ Ajustes e Manutenção | Tunings de desempenho, ajustes de áudio, DNF, idioma, dual-boot, limpeza, kernels, GRUB |
| 13 | 🐧 Estado do Fedora | Versão, detecção de Atomic/Silverblue, SELinux (status, AVCs, setroubleshoot, GUI) |
| 14 | 📖 Sobre o FAP | Sobre o projeto + atualizar/desinstalar FAP + changelog dinâmico |

---

## 🎨 Recursos

- **Interface escura/clara** — troca em tempo real, preferência salva
- **Multilíngue** — PT-BR, EN, ES com troca em tempo real
- **Logs em tempo real** via SSE, expandidos por padrão
- **Estrutura visual consistente** — todas as sessões começam com um card informativo da sessão, e os acórdeãos de conteúdo ficam colapsados por padrão
- **Esquema de cores semântico** — azul para ação, verde para abrir app, vermelho para reverter, vermelho tracejado para ações irreversíveis
- **Ícone de desinstalar** ao lado de cada app Flatpak instalado
- **Detecção de Flatpak removido externamente** — se o usuário apagar o app por fora, o botão do FAP volta ao estado inicial
- **Detecção automática de hardware** — endpoint `/hardware-scan` cruza IDs PCI/USB com `hardware_map.json` e sugere drivers
- **Detecção de geração de GPU NVIDIA** — escolhe automaticamente a série correta (`akmod-nvidia`, `580xx`, `470xx` ou `390xx`)
- **Suporte a múltiplos desktops** — funciona em GNOME, KDE, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie e tiling WMs. O terminal de inicialização segue o desktop detectado
- **Pares install/revert consistentes** — o botão de reverter começa desabilitado e só fica clicável após o install correspondente
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
Fedora-Advantage-Panel/
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
├── dispositivos-perifericos.html    # Sessão 4
├── producao-multimidia.html         # Sessão 5
├── aplicativos.html                 # Sessão 6
├── casa-escritorio.html             # Sessão 7
├── gaming.html                      # Sessão 8
├── waydroid.html                    # Sessão 9
├── virtualizacao.html               # Sessão 10
├── diagnostico.html                 # Sessão 11
├── ajustes-manutencao.html          # Sessão 12
├── estado-fedora.html               # Sessão 13
├── sobre-fof.html                   # Sessão 14 (arquivo mantém o nome por compatibilidade)
├── template-sessao.html             # Molde para criar novas sessões
├── CHANGELOG.md                     # Histórico de mudanças (lido pelo FAP)
├── server.js                        # Servidor Node.js + SSE + endpoints
├── hardware-service.js              # Detecção de hardware (lspci/lsusb + rpm)
├── hardware_map.json                # Mapa de vendors PCI/USB → pacotes
├── iniciar_fof.sh                   # Inicializador
├── iniciar_fof_compat.sh            # Modo compatibilidade
├── install.sh                       # Instalador / desinstalador / updater
├── build-container.sh / Makefile    # Build do container nativo
├── src/fof-container.c              # Container WebKitGTK (C + GTK3)
├── package.json                     # Deps Node + versão do FAP
├── icone_app.png                    # Ícone do app
└── LICENSE                          # GPL-3.0
```

**Nota:** os nomes dos arquivos (`fof-container`, `iniciar_fof.sh`, `sobre-fof.html`, etc.) mantêm o identificador técnico `fof` para preservar instalações existentes. O comando do terminal continua sendo `fof`. Um script de migração para identificadores `fap` fica planejado para uma release futura.

---

## 🖥️ Desktops suportados

O FAP é desktop-agnóstico — foi construído para rodar em qualquer
ambiente Linux que use a stack XDG padrão. Não depende de KDE,
GNOME ou qualquer DE específico.

| Desktop | Status | Observação |
|---|---|---|
| **KDE Plasma** | ✅ Testado | Autenticação via `kdesu`/`kdialog`; terminal nativo `konsole` |
| **GNOME** | ✅ Testado | Autenticação via `pkexec`+`zenity`; terminal `ptyxis`/`gnome-terminal` |
| **XFCE** | ✅ Funciona | Autenticação via `pkexec`+`zenity`; terminal `xfce4-terminal` |
| **Cinnamon** | ✅ Funciona | Autenticação via `pkexec`+`zenity` |
| **MATE** | ✅ Funciona | Autenticação via `pkexec`+`zenity` |
| **LXQt** | ✅ Funciona | Autenticação via `pkexec`+`kdialog` |
| **LXDE** | ✅ Funciona | Autenticação via `pkexec`+`zenity` |
| **Budgie** | ✅ Funciona | Autenticação via `pkexec`+`zenity` |
| **Sway / Hyprland / i3** | ✅ Funciona | Requer `$TERMINAL` setado ou um terminal gráfico instalado |

### O que é automático

- **Terminal de inicialização** — o `iniciar_fof.sh` detecta seu desktop via `XDG_CURRENT_DESKTOP` e prefere o terminal nativo dele.
- **Autenticação** — o `install.sh` instala `zenity` automaticamente se você não tiver `kdialog` nem `zenity` (necessário para autenticação gráfica em DEs não-KDE).
- **Atalho no menu** — criado em `~/.local/share/applications/`.
- **Ícone** — instalado em `hicolor/256x256/apps/` com o nome `fof-container`, casando com o `StartupWMClass` do `.desktop`.

### O que NÃO é automático

- **Fixar na barra de tarefas.** O FAP **não** fixa atalhos na barra automaticamente. Fixe manualmente pelo menu do seu desktop:
  - **KDE:** botão direito no ícone do FAP no menu → *Fixar no painel*
  - **GNOME:** abrir o FAP uma vez, depois *botão direito no ícone no dock → Add to Favorites*
  - **XFCE/Cinnamon/MATE:** arrastar o ícone do menu para a barra

### Requisitos mínimos

- Fedora 43, 44 ou 45 (testado em 44)
- Kernel com WebKitGTK 4.1 (todo Fedora 40+ tem)
- `nodejs` >= 18 (o `iniciar_fof.sh` instala se faltar)
- `zenity` **ou** `kdialog` (para autenticação gráfica)

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
- **Rejeição de encadeamento de shell** em comandos sem auth (`;`, `` ` ``, `|`, `$(`, `&&`, `&` isolado, quebras de linha, `<(`/`>(`)
- **Sanitização** de entrada e validação de `idComando`
- **Rate limiting** de 1.5s por `idComando`
- **Log rotation** automática (7 dias em `/tmp/fof-*.log`)

---

## 🎯 Changelog

O histórico completo das versões está nas [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases). O FAP também exibe o changelog da versão atual dentro da sessão **Sobre o FAP**, carregado dinamicamente do arquivo `CHANGELOG.md`.

### v1.0.0-10012026.b (Atual) 🚧

Renomeação do projeto para **Fedora Advantage Panel (FAP)**, com novo logo.

- **Novo nome de exibição**: "Fedora Only Fans" → "Fedora Advantage Panel". Todos os textos visíveis nos três idiomas foram atualizados.
- **Novo logo**: substitui o anterior em toda a aplicação (app, atalho do menu, container nativo).
- **Repositório renomeado no GitHub** para `vitaotub/Fedora-Advantage-Panel`.
- **URLs internas atualizadas** — `GITHUB_REPO`, `REPO_URL`, links de issues/documentação/changelog.
- **Nenhuma mudança de comportamento**: comando `fof`, pasta de instalação e identificadores técnicos internos permanecem os mesmos para preservar instalações existentes.

### v1.0.0-10012026.a

Atualização focada em padronização visual, correções de bugs e segurança.

- **Esquema de cores semântico em todos os botões** — azul para ação principal, verde para "abrir aplicativo", vermelho para remover/reverter, vermelho com borda tracejada para ações irreversíveis. Elimina a confusão anterior entre "botão desabilitado" (cinza) e "botão de reverter" (também cinza).
- **Badge de atualização compacto** — mostra só o ícone (seta de download), sobreposto ao cartão de versão, sem quebrar layout.
- **Toast de notificação sobreposto** — não empurra mais o conteúdo da página.
- **Correções no `server.js`** — deep-link `guiado.html?session=X` não retorna mais 404; `POST /executar` não derruba mais o servidor; `Ctrl+C` mata a árvore de processos (`dnf` não fica órfão); buffer SSE limpo entre execuções; scripts temporários com modo `0o700`; regex de encadeamento endurecida.
- **Race condition da tela preta** em `guiado.html` corrigida com token de geração.
- **Notas dos cartões de hardware agora traduzidas** em EN e ES.
- **Novo endpoint `/kernel-atual`** — remoção de kernel não depende mais de parsing de log compartilhado.
- **Logs internos lidos por delta** — menos I/O em comandos longos.

---

## ➕ Como adicionar uma sessão

1. Copie `template-sessao.html` para `<nome>.html` (sem número)
2. Preencha os placeholders
3. Adicione uma entrada no array `SESSOES` em `script.js` (com `id: '<nome>'`)
4. Adicione o ícone (emoji) em `ICONES_SESSOES` em `guiado.html`
5. Adicione as chaves i18n em `locales/en.json` e `locales/es.json` (e também no HTML, como fallback PT-BR)

A ordem de exibição vem da posição da entrada no array `SESSOES`, não do nome do arquivo.

**Sobre `flatpakId` e `sempreClicavel`:** comandos que instalam Flatpak devem ter `flatpakId: 'org.exemplo.App'` no registro de `script.js`. Comandos cujo estado real é consultável via `rpm -q` (drivers de hardware) devem usar `sempreClicavel: true` e verificar o estado via endpoint.

---

## 🌐 Como adicionar um idioma

1. Copie `locales/en.json` para `locales/XX.json`
2. Traduza os valores (mantenha as chaves)
3. Adicione `XX` em `LANGS_DISPONIVEIS` (`i18n.js`) e `LANGS_SUPORTADOS` (`server.js`)
4. Adicione a opção no array `opcoes` de `criarSeletorIdioma()`

**Nota:** o idioma padrão (pt-BR) **não tem arquivo JSON** de propósito — o HTML de cada sessão contém o texto em português como fallback.

---

## 🏷️ Como lançar uma versão

1. Edite `package.json` → `"version": "1.0.0-<NOVA>"`
2. Substitua o `CHANGELOG.md` pela seção da versão nova (o histórico completo fica nas releases do GitHub)
3. Atualize o badge de versão nos três READMEs (`README.md`, `README.en.md`, `README.es.md`)
4. Crie a tag/release no GitHub com o mesmo nome

---

## 🤝 Contribuir

1. Fork → branch → commit → push → Pull Request

## 🐛 Reportar Bugs

Abra uma issue em [github.com/vitaotub/Fedora-Advantage-Panel/issues](https://github.com/vitaotub/Fedora-Advantage-Panel/issues) incluindo:
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
