# Changelog — Fedora Only Fans (FOF)

Todas as mudanças notáveis deste projeto estão documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e o FOF usa versionamento baseado em data: `v1.0.0-MMDDAAAA`.

Este arquivo é lido em runtime pelo endpoint `GET /changelog` do `server.js`,
que exibe a seção da versão atual dentro do FOF, na sessão **Sobre o FOF**.

> **Regra importante para quem for editar:** use apenas `## vX.Y.Z-...` para os
> cabeçalhos de versão. Dentro de uma seção, use `###` (três hashes) para
> subseções — um `##` no meio de uma versão encerra a captura do parser e o
> resto é descartado silenciosamente.
>
> **Sobre versões antigas:** este arquivo guarda apenas a seção da versão
> atual. O histórico completo fica disponível nas
> [releases do GitHub](https://github.com/vitaotek/Fedora-Only-Fans/releases).

---

## v1.0.0-09302026

### 🎨 Padronização visual das sessões

Todas as 13 sessões agora seguem a mesma estrutura visual:

- Cada sessão começa com um **card principal** (retângulo azul com ícone ℹ️) contendo a descrição da sessão — sempre visível, sem seta de colapsar.
- Todos os acórdeãos de conteúdo são exibidos **colapsados por padrão**, deixando ao usuário a decisão de expandir o que precisa.
- Avisos que impactam a sessão inteira (ex.: Waydroid requer GPU AMD/Intel, painel do Diagnóstico é somente leitura) agora aparecem **fora** dos acórdeãos, em evidência, logo abaixo do título.
- Avisos específicos a um elemento continuam dentro do respectivo acórdeão, próximos ao botão correspondente.

### 🚀 Primeiros Passos reorganizada

- Os três blocos relacionados a repositórios (RPM Fusion, Flathub e remoção do repositório Fedora Flatpak) foram unificados em **um único acórdeão** chamado **📦 Repositórios do Fedora**.
- O bloco de atualização do sistema permanece em acórdeão próprio.

### 🎬 Produção Multimídia reorganizada

- Os dois blocos (OBS Studio e EasyEffects) foram unificados em **um único acórdeão** temático chamado **🎬 Gravação, transmissão e áudio**.

### 🐛 Corrigido

- **Sessão Casa e Escritório não tinha o wrapper `.sessao-container`.** Sem ele, o layout aparecia sem o card visual e o bloqueio de sessão durante execuções não funcionava. Corrigido.
- **Sessão Aplicativos Recomendados tinha 6 `</div>` extras.** Um em cada bloco, o que fazia o primeiro bloco (Produtividade e Escritório) aparecer dentro do card principal da sessão. Corrigido.
- **Log de boot do servidor dizia "12 sessões dinâmicas".** Corrigido para 13.
- **Placeholders "1 de 12" / "1/12" em `guiado.html`.** Corrigidos para "1 de 13" / "1/13".

### 📱 Waydroid — remoção completa e ciclo de vida independente

- **Botão de remoção movido para o fim da sessão**, renomeado para **"Desfazer Alterações e Remover Completamente"**, dentro de um acórdeão dedicado.
- **Remoção agora é completa:** remove o pacote, o container Android, a pasta de extras (`~/.local/share/fof-waydroid`), o venv Python, atalhos `.desktop` gerados pelo Waydroid e arquivos de dados em `/var/lib`.
- **Correção de arquivos imutáveis:** antes de remover a pasta de extras, um `chattr -R -i` limpa atributos imutáveis que o `pip` ocasionalmente deixa em arquivos do venv — que faziam o `rm -rf` falhar silenciosamente.
- **O Waydroid não fecha mais quando o FOF é fechado.** O comando de abertura agora usa `setsid -f`, que cria uma sessão independente para o Waydroid. Fechar a janela do FOF não dispara mais SIGHUP no Waydroid — mesmo comportamento de abrir pelo menu do Fedora.
- **O botão de remoção agora reflete o estado real do sistema:** fica **desabilitado** ("✅ Nada a remover") quando não há pacote instalado nem resquícios no filesystem. O estado é consultado via novo campo `clean` do endpoint `/waydroid-status`.
- **Detecção de "não instalado" agora é multilíngue.** Antes, o servidor só reconhecia a mensagem em inglês (`command not found`). Em Fedora com locale PT-BR, o bash responde `comando não encontrado`, o que fazia o servidor acreditar que o Waydroid ainda estava instalado. Corrigido — a detecção agora aceita ambas as mensagens e também o código de erro do processo.

### 🧹 Outras correções

- **`python3-pyqt6` removido do `install.sh`.** O pacote é dependência do instalador da Suíte Affinity, não do container nativo. Agora é instalado sob demanda pelo próprio botão "Abrir Instalador da Affinity", que verifica e instala antes de baixar o instalador.
- **Removido `validar.sh`** (e todas as referências a ele no `Makefile` e nos READMEs). O alvo `make check` continua funcionando como alias de `make check-basico`.

### 📝 Documentação

- READMEs (PT, EN, ES) atualizados para refletir a versão atual e a estrutura de 13 sessões.
- Cada README agora contém apenas a seção da versão atual — o histórico completo fica nas releases do GitHub.

---

### Como adicionar uma versão nova

Ao lançar uma versão nova:

1. Atualize o campo `version` no `package.json` (ex.: `"1.0.0-10012026"`).
2. Atualize `FALLBACK_VERSION` no `i18n.js`.
3. Substitua o conteúdo deste arquivo pela seção da nova versão, mantendo apenas ela. O histórico das versões anteriores fica disponível nas releases do GitHub.
4. Use `###` (três hashes) para subseções dentro de uma versão. Um `##` no meio da seção encerra a captura do parser e o resto é descartado.
5. Crie a tag/release no GitHub com o mesmo nome.

Se o cabeçalho não bater exatamente com o `version` do `package.json`, o FOF não encontrará a seção correspondente e mostrará apenas o link para o changelog completo no GitHub.
