# usagego

Plugin do OpenCode que mostra tua cota do [OpenCode Go](https://opencode.ai/v2/docs/console/go/) na sidebar do TUI.

Sidebar (4 linhas, sem label):

```
5h (13:00) 0% · sem 12% · mês 6%
pace 47.4% · fecha dia 3
muse-spa... · $0.31/2 15.5%
mês $1.28/$60 (2.1%)
```

- Linha 1: uso 5h (com horário do reset), semanal e mensal — cor única pela escala do % mensal (linha única, sem quebra).
- Linha 2: pace mensal projetado + dia de fechamento da fatura.
- Linhas 3–4: modelo atual (id colapsado, ≤29 cols) com gasto do dia vs teto diário (`$usado/teto %`) e do mês vs limite do plano, em cinza. Teto diário = limite mensal ÷ dias do ciclo (ex. $60/30d = $2/dia p/ spark).
- Escala de cor: azul <50%, verde 50–70%, amarelo ≥70%, vermelho ≥85%.
- `/gousage`: painel com detalhe das 3 janelas (countdown, pace, estimativa em $ do modelo atual), teto diário do modelo atual e data da tabela de preços.

## PC zerado: dependência do react

O `tui.tsx` usa JSX. Na instalação via git em máquina sem nada, o build do TUI pode falhar com erro de `react/jsx-runtime` não resolvido. O `package.json` do plugin já declara `react` como dependência para o bun instalar junto; se o erro persistir, instale manual no dir de config e recarregue:

```bash
cd ~/.config/opencode && bun add react  # ou npm i react
opencode reload
```

## Como instalar

Pré-requisitos: OpenCode atualizado + conta com plano Go ativo.

1. Adiciona o plugin no `opencode.json` global (`~/.config/opencode/opencode.json`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "usagego@git+https://github.com/joaowinkelmann/usagego.git"
  ]
}
```

2. Cria o arquivo da API key (nunca vai para log nem config). Gera em Console › Account › Personal API keys (precisa de `Usage: Read`):

```bash
nano ~/.config/opencode/.go-api-key   # cola só a key
chmod 600 ~/.config/opencode/.go-api-key
```

3. Cria o arquivo com o id do workspace (visível na URL do Console: `/console/<id>/...`):

```bash
nano ~/.config/opencode/.go-org-id    # cola só o id (ex. wrk_...)
chmod 600 ~/.config/opencode/.go-org-id
```

Sem a key, a sidebar mostra `key ausente` e o plugin continua carregando. Sem o org id, as linhas do modelo não aparecem.

## Verificar

- Reinicia o TUI: a sidebar mostra as 4 linhas.
- `/gousage`: abre o detalhe (atualiza antes de abrir).
- Paleta (`ctrl+p`) › "Go: atualizar uso agora": força refresh com toast de confirmação.
- `node --test *.test.js` dentro da pasta do plugin: 17/17.

## Como funciona

- `server.js` polla `GET https://opencode.ai/zen/go/v1/usage` a cada 3 min e expõe o RPC `go-usage`. Gasto por modelo vem de `/console/api/usage/models` (janela do allowance + dia atual via `range=24h&since` da meia-noite local).
- `tui.tsx` renderiza em `sidebar.content`; atualiza a cada 3 min, no fim de cada execução e via `/gousage`.
- `pricing.js` + `parseGoPricing` (em `pricing-parse.js`): a tabela de limites do plano **Go padrão** é refeita da doc toda semana (startup + intervalo de 7 dias) e guardada no storage; o embutido vale como fallback.
- Pace = uso% × (período/decorrido); início do mês = reset − 1 mês, da semana = reset − 7 dias, da janela 5h = reset − 5h.
- Nota: o `/zen` entrega o mensal em inteiro (ex. 4% vs 4.9% real), então o pace pode ficar ~1pp abaixo do Console.

## Premissas auditadas (nada chumbado por conta)

- Dia de fechamento: dinâmico, lido de `monthly.resetsAt` (label `fecha dia N` + janela de gasto). Nenhum literal de dia no código.
- Inícios de ciclo: inferidos do `resetsAt` (mês corrido, semana 7d, janela 5h) — o `/zen` só entrega fim do ciclo. Se teu plano tiver ciclo diferente, o pace e a janela mensal acompanham o erro.
- Limites em $: tabela do plano Go padrão, refeita da doc toda semana. Se tua conta estiver em outro plano/tier, os `$X/$Y` por modelo ficam errados (o % do `/zen` continua certo).
- Tentativa de % preciso via `/usage/summary` descartada: gasto 11-03→hoje ($7.99) / 6% implica allowance $133, mas gasto 11-02→hoje ($21.50) / 12% implica $179 — o % do `/zen` não é gasto/allowance simples, sem endpoint que exponha a fórmula.

## Desenvolvimento

```bash
node --test *.test.js
```

Sem dependências de runtime além do `@opencode/plugin` resolvido pelo host.
