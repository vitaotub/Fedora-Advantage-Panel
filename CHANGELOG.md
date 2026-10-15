# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> Use apenas `## vX.Y.Z-...` para os cabeçalhos de versão. Dentro de uma
> seção, use `###` para subseções — um `##` no meio encerra a captura.
> Versões anteriores ficam nas releases do GitHub.

---

## v1.0.0-10152026

### 🎯 Melhorias

- **Shotcut, Avidemux e RustDesk migrados de Flatpak para RPM.** Os três apps passam a usar pacotes nativos:
  - **Shotcut** e **Avidemux** → instalados via `dnf` (Shotcut do repositório oficial do Fedora, Avidemux do RPM Fusion). Ambos passam a ser atualizados automaticamente junto com o resto do sistema, sem depender do Flathub.
  - **RustDesk** → RPM baixado direto do GitHub Releases do projeto. A URL é resolvida em runtime via API do GitHub (`releases/latest`), sempre pegando a versão mais recente publicada. Mesmo padrão já usado pelos apps da Suíte ArtCraft.
- **Câmera virtual do OBS: fallback morto removido.** O comando de instalação do `akmod-v4l2loopback` tinha um `|| sudo dnf install v4l2loopback` como plano B. O pacote bare `v4l2loopback` não existe no Fedora nem no RPM Fusion — o fallback era ramo morto. Removido. Se o `akmod-v4l2loopback` falhar (rede fora, RPM Fusion inativo), o erro real aparece no log em vez de ser mascarado por uma segunda tentativa inútil.

### 🗑️ Remoções

- **LibreOffice, Zen Browser e Signal removidos da sessão Aplicativos Recomendados.** Os três apps saíram do catálogo por decisão de escopo. Quem precisar deles pode instalar pelo **GNOME Software**, **Discover** ou pelo **Flathub** diretamente. Chaves i18n correspondentes em `locales/en.json` e `locales/es.json` foram removidas para não deixar strings órfãs.
