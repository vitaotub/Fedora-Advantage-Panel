# <img src="icone_app.png" width="55" align="center"> Fedora Advantage Panel (FAP)

**🌐 Idioma:** Português (BR) | [English](README.en.md) | [Español](README.es.md)

![Versão](https://img.shields.io/badge/Vers%C3%A3o-v1.4.2--10312026-orange?style=flat-square)
![Fedora](https://img.shields.io/badge/Fedora-44%20%7C%2045-294172?style=flat-square&logo=fedora)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-GPL--3.0-green?style=flat-square)
![Idiomas](https://img.shields.io/badge/Idiomas-PT--BR%20%7C%20EN%20%7C%20ES-3c67e3?style=flat-square)

> Deixando o seu Fedora pronto para o "play" — visual, rápido e sem terminal.

## 📖 O que é

O **Fedora Advantage Panel (FAP)** é um painel de automação visual para o Fedora Linux. Ele transforma uma instalação limpa em um sistema completo — codecs, drivers, repositórios, ferramentas — através de cliques, sem abrir o terminal.

Um único botão, **Iniciar Configuração**, leva você por **13 sessões guiadas** passo a passo. Cada botão lembra o próprio estado: feche o FAP, reabra, e ele mostra exatamente onde você parou.

## 🎯 Para quem é

- **Quem está migrando do Windows 10 ou 11 para o Fedora** e quer uma transição fácil, prática e sem mexer no terminal.
- **Quem está começando no Fedora** e quer deixá-lo pronto para uso diário.
- **Quem vem de Ubuntu/Mint** e quer a mesma fluidez de configuração inicial.
- **Quem joga no Linux** e quer Steam, Heroic, Lutris, Proton, MangoHud e afins.
- **Quem já usa Fedora há tempo** e quer automatizar o pós-instalação.
- **Quem cuida do PC de outra pessoa** (família, amigos) sem terminal.

## 🚀 Instalação

```bash
bash <(curl -s https://raw.githubusercontent.com/vitaotub/Fedora-Advantage-Panel/main/install.sh)
```

> **💡 Não sabe como rodar esse comando?** É mais simples do que parece:
>
> 1. **Copie o comando inteiro** — selecione todo o texto acima com o mouse, ou clique no ícone de copiar que aparece no canto direito do bloco de código.
> 2. **Abra o terminal** — procure por **"Terminal"** no menu de aplicativos do seu Fedora. Na maioria dos desktops (GNOME, KDE, XFCE, Cinnamon, MATE), o atalho `Ctrl+Alt+T` também funciona.
> 3. **Cole o comando** — no terminal, pressione `Ctrl+Shift+V` ou clique com o botão direito do mouse e escolha **"Colar"**.
> 4. **Pressione `Enter`** — o instalador vai pedir sua senha de administrador (a mesma que você usa para fazer login no computador). Isso é normal — é o instalador pedindo permissão para instalar os pacotes do sistema.
>
> Ao final, abra o FAP digitando `fap` no terminal ou procurando por **"Fedora Advantage Panel"** no menu de aplicativos.

**Comandos após instalar:**

```bash
fap              # inicia o FAP
fap-compat       # modo compatibilidade (GPUs antigas, VMs)
fap --update     # atualiza (ou clique no badge dentro do FAP)
fap --uninstall  # desinstala
```

Atualizações são feitas **em cima da instalação existente** — não precisa desinstalar entre versões. Progresso, tema e idioma são preservados.

## 🖥️ Requisitos

- **Fedora 44 ou 45** (desenvolvido e testado nos dois).
- **GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, LXDE, Budgie, Sway, Hyprland, i3** e outros tiling WMs.
- **PT-BR, EN e ES.**

## 📄 Licença

**GPL-3.0** — veja [LICENSE](LICENSE).

## 👤 Autor

**VitãoTub** — [vitaotub.com](https://www.vitaotub.com) · [github.com/vitaotub](https://github.com/vitaotub)

## 🙏 Agradecimentos

[![Fedora Project](https://img.shields.io/badge/Fedora-Project-294172?style=flat-square&logo=fedora&logoColor=white)](https://getfedora.org/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://www.deepseek.com/)

**Feito com ❤️ para a comunidade Fedora**
