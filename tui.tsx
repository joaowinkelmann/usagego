import { Plugin } from "@opencode/plugin/tui"
import { GoUsage } from "./rpc.js"
import { GO_LIMITS } from "./pricing.js"
import { resetClock, pacePercent, paceColor, modelLines, paceDaily, shortDate } from "./format.js"

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
      const until = shortDate(s.data.monthly.resetsAt) ?? "?"
      // Média diária estilo console; sem ela, projeção instantânea.
      if (typeof s.data.paceForecast === "number" && typeof s.data.paceAvg === "number") {
        const label = `pace ${s.data.paceForecast}% · +${s.data.paceAvg}%/dia · até ${until}`
        return { label, color: paceColor(s.data.paceForecast) }
      }
      const pace = pacePercent(s.data.monthly.percent, s.data.monthly.resetsAt, "month")
      if (pace == null) return null
      const label = `pace ${pace}% · até ${until}`
      return { label, color: paceColor(pace) }
    }

    await refresh()
    const timer = setInterval(() => void refresh().catch(() => {}), 180_000)
    const stopExec = context.data.on("session.execution.succeeded", () => void refresh().catch(() => {}))

    const modelLine = (width) => {
      const s = state
      if (!s.data) return null
      const model = context.ui.model.current()
      const modelID = model?.id ?? model?.modelID ?? ""
      if (!modelID) return null
      const m = s.data.models[modelID]
      const monthly = s.data.limits[modelID] ?? GO_LIMITS[modelID]?.monthly
      return modelLines(modelID, m, monthly, s.data.daily[modelID], s.data.monthly.resetsAt, width)
    }

    context.ui.slot({
      append: "sidebar.content",
      render: () => {
        const s = state
        // NOTE: fully static tree — same 4 <text> nodes on every render,
        // content-only updates. Any mount/unmount toggle (branch, ternary
        // null, .map, <For>/<Show>) risks the OpenTUI solid reconciler crash
        // "remove expects a renderable child object" (opencode#43693,
        // opentui#432, plus dual-module-identity hazard on `solid-js`
        // imports). No `solid-js` import by design: host owns the runtime.
        const pace = s.data ? paceLine() : null
        const line1 = !s.data
          ? s.reason === "key-file-missing"
            ? "key ausente"
            : "indisponível"
          : `5h (${resetClock(s.data.rolling.resetsAt)}) ${s.data.rolling.percent}% · sem ${s.data.weekly.percent}% · mês ${s.data.monthly.percent}%${s.stale ? " (desatualizado)" : ""}`
        const line2 = pace ? pace.label : ""
        const width = Math.max(line1.length, line2.length)
        const model = s.data ? modelLine(width) : null
        return (
          <box flexDirection="column">
            <text fg={s.data ? paceColor(s.data.monthly.percent) ?? undefined : undefined}>{line1}</text>
            <text fg={pace?.color ?? undefined}>{line2}</text>
            <text fg="#6e7681">{model?.[0] ?? ""}</text>
            <text fg="#6e7681">{model?.[1] ?? ""}</text>
          </box>
        )
      },
    })

    return () => {
      clearInterval(timer)
      stopExec()
    }
  },
})
