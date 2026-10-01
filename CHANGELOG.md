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

## v1.0.0-10012026

### 🖥️ Nova sessão: Virtualização

Nova sessão **Virtualização** (posição 10), entre Waydroid e Diagnóstico. Reúne as três principais ferramentas de virtualização para Fedora:

- **QEMU/KVM + virt-manager** — stack nativa, mais performática. Instala QEMU, libvirt e virt-manager, habilita o serviço do sistema e adiciona o usuário ao grupo `libvirt`.
- **VirtualBox** — interface familiar para quem vem do Windows. Instala `VirtualBox` e o módulo de kernel `akmod-VirtualBox`, que recompila automaticamente a cada kernel novo (requer RPM Fusion).
- **GNOME Boxes** — interface simplificada para iniciantes. Usa QEMU/KVM por baixo.

Cada ferramenta tem três botões:

- **Instalar** — executa a instalação.
- **Remover** — começa desabilitado, habilita após o install. Remove o software e suas dependências, mas **não toca nas VMs do usuário** (dados em `/var/lib/libvirt/images` e na pasta do VirtualBox permanecem intactos).
- **Abrir** — aparece apenas após o install. Abre via `gtk-launch`, como se o usuário clicasse no atalho do menu do Fedora.

### 🟩 NVIDIA — detecção de geração e painel informativo

A seção NVIDIA foi reformulada com foco em segurança e transparência:

- **Detecção de geração de GPU** — o FOF lê o modelo via `lspci` e escolhe automaticamente a série correta: `akmod-nvidia-390xx` (Fermi), `akmod-nvidia-470xx` (Kepler), `akmod-nvidia-580xx` (Maxwell/Pascal) ou `akmod-nvidia` (Turing+). Instalar a série errada resultava em tela preta após reboot — a detecção evita esse problema.
- **Painel de detecção** — novo painel informativo mostra o modelo da GPU, o driver recomendado e a série. Se nenhuma GPU NVIDIA for detectada, o painel exibe um aviso e o botão de instalar fica desabilitado.
- **Botões install/revert/open** — par consistente como nas outras sessões. O botão **Reverter pro nouveau** começa desabilitado e só habilita após o install. O botão **Abrir nvidia-settings** aparece apenas quando o driver está instalado.
- **Modesetting também protegido** — os botões de ativar/desativar `nvidia-drm.modeset=1` ficam desabilitados quando não há GPU NVIDIA detectada (o parâmetro é exclusivo de GPU NVIDIA física).
- **Abort claro quando não há GPU** — se o usuário clicar em Instalar mesmo assim, o comando shell aborta com mensagem clara antes de tocar no `dnf`.

### 🐛 Corrigido

- **Painel de detecção NVIDIA não traduzia.** Os textos do painel estavam hardcoded em pt-BR, sem passar por `tOr`. Agora usam as chaves i18n corretas (EN/ES).
- **Botão de instalar driver NVIDIA aceitava instalação em máquinas sem GPU NVIDIA.** A versão anterior caía num `else` que instalava `akmod-nvidia` mesmo quando nenhuma GPU era detectada. Corrigido com abort explícito.
- **Extras CUDA só são instalados na série principal.** As séries legadas (390xx, 470xx, 580xx) não têm pacotes `xorg-x11-drv-nvidia-XXX-cuda` no RPM Fusion. O driver base dessas séries já cobre NVENC/NVDEC.

### 📝 Documentação

- READMEs atualizados para refletir as **14 sessões** (antes 13).
- Nova seção **Virtualização** na tabela de sessões.
- `iniciar_fof.sh --help` menciona 14 sessões.
- `install.sh` verifica `virtualizacao.html` na instalação e no `--update`.
- Log de boot do servidor menciona 14 sessões dinâmicas.
- Placeholders "1 de 13" / "1/13" em `guiado.html` atualizados para "14".

---

### Como adicionar uma versão nova

Ao lançar uma versão nova:

1. Atualize o campo `version` no `package.json` (ex.: `"1.0.0-10022026"`).
2. Atualize `FALLBACK_VERSION` no `i18n.js`.
3. Substitua o conteúdo deste arquivo pela seção da nova versão, mantendo apenas ela. O histórico das versões anteriores fica disponível nas releases do GitHub.
4. Use `###` (três hashes) para subseções dentro de uma versão. Um `##` no meio da seção encerra a captura do parser e o resto é descartado.
5. Crie a tag/release no GitHub com o mesmo nome.

Se o cabeçalho não bater exatamente com o `version` do `package.json`, o FOF não encontrará a seção correspondente e mostrará apenas o link para o changelog completo no GitHub.
