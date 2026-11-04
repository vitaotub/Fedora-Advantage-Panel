# Changelog — Fedora Advantage Panel (FAP)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FAP, na sessão **Sobre o FAP**.

> Use apenas `## vX.Y.Z-...` para os cabeçalhos de versão. Dentro de uma
> seção, use `###` para subseções — um `##` no meio encerra a captura.
> **Versões anteriores ficam nas releases do GitHub.** Este arquivo contém
> apenas a seção da versão atual.

---

## v1.4.5-11042026

Correção da detecção de download do DNF5 e adição das ações
recomendadas pós-upgrade do Fedora 44 → 45.

### 🐛 Corrigido

- **`server.js` → `_verificarDownloadConcluido`** — o FAP procurava o
  download do system-upgrade em `/var/lib/dnf/system-upgrade` (DNF4) e
  `/var/lib/dnf5/offline` (caminho errado). O DNF5 (padrão no Fedora 44+)
  armazena a transação offline em `/usr/lib/sysimage/libdnf5/offline`.
  Resultado: o estado `downloaded` nunca era detectado, e o botão
  "Reiniciar agora e atualizar" não aparecia após o download. Agora
  verifica o caminho correto do DNF5 primeiro, com fallback para DNF4.

### ✨ Adicionado

- **Aviso pós-download** — após o download terminar, a área de upgrade
  mostra um aviso: "Após reiniciar e concluir o upgrade, volte a esta
  sessão para os próximos passos (ações recomendadas pós-upgrade)."
- **Ações pós-upgrade** — quando o FAP detecta que o usuário está no
  Fedora 45 **e** fez o upgrade pelo FAP (marcador `upgrade-f45-download`
  executado), a área de upgrade substitui a mensagem estática por 5
  botões de ações recomendadas pela documentação oficial do Fedora:
  - **🧹 Limpeza Pós-Upgrade** (seguro): `remove-retired-packages`,
    `dnf remove --duplicates`, `dnf autoremove`, `dnf clean all`,
    `clean-rpm-gpg-pubkey`.
  - **⚙️ Mesclar Configurações** (seguro): `rpmconf -a`.
  - **🔄 Distro-Sync** (avançado, aviso vermelho): `dnf distro-sync`.
  - **🛡️ Relabel SELinux** (avançado, aviso amarelo): `fixfiles -B onboot`.
  - **🛟 Regenerar Rescue Kernel** (opcional): instala
    `dracut-config-rescue` (a regeneração acontece no próximo kernel
    update, conforme doc oficial).
- **`locales/en.json`** e **`locales/es.json`** — ~15 chaves para os
  textos dos botões de pós-upgrade.

### 🔄 Alterado

- **`package.json`** — versão `1.4.5-11042026`.
- **`CHANGELOG.md`** — seção da v1.4.5.

### 🧪 Não testado

- **`rpmconf -a` em modo não-interativo** — a doc oficial recomenda
  `rpmconf -a` para aceitar as ações padrão. Se o comando travar
  esperando input no FAP (sem TTY), será necessário ajustar para
  `yes | rpmconf -a` ou similar. Testar em hardware real.
- **`fixfiles -B onboot`** — o tempo de relabel varia com o tamanho
  do disco. Testar em hardware real para confirmar que não trava o
  boot.
- **Ações pós-upgrade em Fedora 45 real** — o fluxo completo
  (`upgrade → reboot → Fedora 45 → botões de pós-upgrade`) foi
  validado conceitualmente. Falta testar em hardware real.

### 🧪 Requisito

- **Fedora 44 ou 45.**
