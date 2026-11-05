# opencode-go-usage

Plugin do OpenCode que mostra tua cota do [OpenCode Go](https://opencode.ai/v2/docs/console/go/) na sidebar do TUI.

Sidebar (2 linhas, sem label):

```
5h (15:16) 1% · sem 9% · mês 4%
pace 52.4% · fecha dia 3
```

- Linha 1: uso 5h (com horário do reset), semanal e mensal.
- Linha 2: pace mensal projetado (verde <50%, amarelo >70%, vermelho ≥85%) + dia de fechamento da fatura.
- `/gousage`: painel com detalhe das 3 janelas (countdown, pace, estimativa em $ do modelo atual) e data da tabela de preços.

## Instalação (outra instância)

No `opencode.json(c)` global:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "opencode-go-usage@git+https://github.com/jwinkelmann/opencode-go-usage.git"
  ]
}
```

## API key

O plugin lê a tua personal API key do Console de um arquivo fora do config (nunca vai para log nem config):

```bash
# Account › Personal API keys no Console (precisa de Usage: Read)
nano ~/.config/opencode/.go-api-key   # cola só a key
chmod 600 ~/.config/opencode/.go-api-key
```

Sem a key, a sidebar mostra `key ausente` e o plugin continua carregando.

## Como funciona

- `server.js` polla `GET https://opencode.ai/zen/go/v1/usage` a cada 5 min e expõe o RPC `go-usage`.
- `tui.tsx` renderiza em `sidebar.content`, atualiza no fim de cada execução e abre o detalhe via `/gousage`.
- `pricing.js` + `parseGoPricing` (em `pricing-parse.js`): a tabela de limites do plano **Go padrão** é refeita da doc toda semana (startup + intervalo de 7 dias) e guardada no storage; o embutido vale como fallback.
- Pace = uso% × (período/decorrido); início do mês = reset − 1 mês, da semana = reset − 7 dias, da janela 5h = reset − 5h.

## Desenvolvimento

```bash
node --test *.test.js
```

Sem dependências de runtime além do `@opencode/plugin` resolvido pelo host.
