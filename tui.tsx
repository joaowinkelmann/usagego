import { Plugin } from "@opencode/plugin/tui"
import { For } from "solid-js"
import { GoUsage } from "./rpc.js"
import { GO_LIMITS } from "./pricing.js"
import { resetClock, pacePercent, paceColor, modelLines } from "./format.js"

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

    await refresh()
    const timer = setInterval(() => void refresh().catch(() => {}), 180_000)
    const stopExec = context.data.on("session.execution.succeeded", () => void refresh().catch(() => {}))

    const modelLine = () => {
      const s = state
      if (!s.data) return null
      const model = context.ui.model.current()
      const modelID = model?.id ?? model?.modelID ?? ""
      if (!modelID) return null
      const m = s.data.models[modelID]
      const monthly = s.data.limits[modelID] ?? GO_LIMITS[modelID]?.monthly
      return modelLines(modelID, m, monthly, s.data.daily[modelID], s.data.monthly.resetsAt)
    }

    context.ui.slot({
      append: "sidebar.content",
      render: () => {
        const s = state
        // NOTE: keep a stable <box> root and avoid raw `cond ? <el/> : null`
        // / `.map()` children: those toggle paths hit a known OpenTUI solid
        // reconciler crash ("remove expects a renderable child object",
        // cf. opencode#43693 / opentui#432). <For> + an always-mounted
        // pace <text> keep node identity stable across refreshes.
        if (!s.data) {
          return (
            <box flexDirection="column">
              <text>{s.reason === "key-file-missing" ? "key ausente" : "indisponível"}</text>
            </box>
          )
        }
        const stale = s.stale ? " (desatualizado)" : ""
        const pace = paceLine()
        const model = modelLine()
        return (
          <box flexDirection="column">
            <text fg={paceColor(s.data.monthly.percent) ?? undefined}>
              {`5h (${resetClock(s.data.rolling.resetsAt)}) ${s.data.rolling.percent}% · sem ${s.data.weekly.percent}% · mês ${s.data.monthly.percent}%${stale}`}
            </text>
            <text fg={pace?.color ?? undefined}>{pace ? pace.label : ""}</text>
            <For each={model ?? []}>{(line) => <text fg="#6e7681">{line}</text>}</For>
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
