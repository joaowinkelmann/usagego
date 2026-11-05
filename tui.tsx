import { Plugin } from "@opencode/plugin/tui"
import { GoUsage } from "./rpc.js"
import { GO_LIMITS } from "./pricing.js"
import { bar, countdown, estimateDollars, resetClock, pacePercent, paceColor, modelLines } from "./format.js"

export default Plugin.define({
  id: "go-usage-tui",
  async setup(context) {
    const [state, update] = context.storage.store("usage", {
      initial: { data: null, stale: false, reason: null },
    })

    const refresh = async () => {
      try {
        const rpc = context.client.rpc(GoUsage)
        const data = await rpc.get({})
        await update((draft) => {
          draft.data = data
          draft.stale = false
          draft.reason = null
        })
      } catch (e) {
        await update((draft) => {
          draft.stale = true
          draft.reason = e?.data?.reason ?? e?.message ?? "unknown"
        })
      }
    }

    const paceLine = () => {
      const s = state
      if (!s.data) return null
      const pace = pacePercent(s.data.monthly.percent, s.data.monthly.resetsAt, "month")
      if (pace == null) return null
      const day = new Date(s.data.monthly.resetsAt).getDate()
      const label = `pace ${pace}% · fecha dia ${Number.isNaN(day) ? "?" : day}`
      return { label, color: paceColor(pace) }
    }

    const detail = () => {
      const s = state
      if (!s.data) return "Sem dados. Crie ~/.config/opencode/.go-api-key (chmod 600) e rode /gousage."
      const model = context.ui.model.current()
      const modelID = model?.id ?? model?.modelID ?? ""
      const monthly = s.data.limits[modelID] ?? GO_LIMITS[modelID]?.monthly
      const est =
        monthly === undefined
          ? "modelo fora da tabela"
          : `~$${estimateDollars(s.data.monthly.percent, monthly)} de $${monthly} (${modelID})`
      const row = (name, slot, kind) => {
        const pace = pacePercent(slot.percent, slot.resetsAt, kind)
        return `${name} ${bar(slot.percent)} ${slot.percent}% · reseta em ${countdown(slot.resetsAt)} · pace ${pace ?? "—"}%`
      }
      return [
        row("5h ", s.data.rolling, "rolling"),
        row("sem", s.data.weekly, "week"),
        row("mês", s.data.monthly, "month"),
        `estimativa mensal p/ modelo atual: ${est}`,
        `tabela de preços: ${s.data.pricingAsOf}`,
        s.stale ? "(desatualizado)" : `atualizado em ${s.data.fetchedAt}`,
      ].join("\n")
    }

    await refresh()
    const timer = setInterval(() => void refresh().catch(() => {}), 300_000)
    const stopExec = context.data.on("session.execution.succeeded", () => void refresh().catch(() => {}))

    const modelLine = () => {
      const s = state
      if (!s.data) return null
      const model = context.ui.model.current()
      const modelID = model?.id ?? model?.modelID ?? ""
      if (!modelID) return null
      const m = s.data.models[modelID]
      const monthly = s.data.limits[modelID] ?? GO_LIMITS[modelID]?.monthly
      return modelLines(modelID, m, monthly, s.data.daily[modelID])
    }

    context.ui.slot({
      append: "sidebar.content",
      render: () => {
        const s = state
        if (!s.data) {
          return <text>{s.reason === "key-file-missing" ? "key ausente" : "indisponível"}</text>
        }
        const stale = s.stale ? " (desatualizado)" : ""
        const pace = paceLine()
        const model = modelLine()
        return (
          <box flexDirection="column">
            <text>
              {`5h (${resetClock(s.data.rolling.resetsAt)}) ${s.data.rolling.percent}% · sem ${s.data.weekly.percent}% · mês ${s.data.monthly.percent}%${stale}`}
            </text>
            {pace ? <text fg={pace.color ?? undefined}>{pace.label}</text> : null}
            {model ? model.map((l) => <text>{l}</text>) : null}
          </box>
        )
      },
    })

    context.ui.slot({
      append: "session.panel",
      render: (panel) => (panel.name === "go-usage.detail" ? <text>{detail()}</text> : null),
    })

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "go-usage.detail",
          title: "Uso do OpenCode Go",
          group: "Go",
          palette: true,
          slash: { name: "gousage" },
          run: async () => {
            await refresh()
            const opened = context.ui.panel.open("go-usage.detail")
            if (!opened) await context.ui.dialog.alert({ title: "Uso do OpenCode Go", message: detail() })
          },
        },
      ],
    }))

    return () => {
      clearInterval(timer)
      stopExec()
    }
  },
})
