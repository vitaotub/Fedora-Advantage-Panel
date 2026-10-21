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

## v1.2.1-10212026

Correção de bug crítico na remoção de apps pré-existentes. Quem tinha o
VLC, FreeCAD ou qualquer outro app instalado **antes** do FAP conseguia
abrir o app pelo botão "Abrir X", mas o clique na lixeira mostrava o
alerta "não está instalado" e a remoção era bloqueada indevidamente.

Nenhum comportamento além da remoção foi alterado — todos os outros
fluxos (instalação, abertura, fila de Flatpaks, bloqueios, autenticação)
continuam idênticos.

### 🐛 Correções

- **Lixeira bloqueada para apps pré-existentes.** `_executarRemocaoApp`
  decidia "instalado vs não instalado" consultando
  `appJaInstaladoNoSistema`, que depende do cache cliente do
  `SystemState`. Quando o cache estava vazio (`_dados = null`) — porque
  um `SystemState.carregar()` estava em andamento, um `invalidar()`
  recente tinha acontecido (remoção anterior, refresh), ou a fetch
  falhou —, a função retornava `false` e a remoção era bloqueada com o
  alerta enganoso. Isso acontecia mesmo com o botão exibindo "Abrir X",
  porque o estado visual e a decisão de remoção consultavam o cache em
  momentos diferentes.

  Correção em duas partes:
  1. **Aguarda o cache carregar antes de decidir.** `_executarRemocaoApp`
     faz `await SystemState.carregar()` no início. Se o cache estiver
     vazio, espera a fetch do `/system-state` terminar antes de checar
     `appJaInstaladoNoSistema`.
  2. **Rede de segurança via `data-estado`.** Se a consulta ainda
     retornar `false` por race condition (cache invalidado no meio,
     rede), a função confia no atributo `data-estado` do botão
     (`"instalado-abrir"` ou `"instalado-sem-abrir"`). Esses atributos
     só são aplicados por `aplicarEstadoInstalavel` quando o app foi
     detectado como instalado. Nesse caso, a remoção é tentada e o
     `flatpak uninstall` / `dnf remove` mostra o erro real no log —
     mais honesto que o alerta "não instalado".

---

## v1.2.0-10202026

Disponível nas [releases do GitHub](https://github.com/vitaotub/Fedora-Advantage-Panel/releases).
