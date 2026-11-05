export function bar(percent) {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)))
  return "▓".repeat(filled) + "░".repeat(10 - filled)
}

export function countdown(resetsAt, now = Date.now()) {
  const t = Date.parse(resetsAt)
  if (Number.isNaN(t)) return "—"
  let ms = t - now
  if (ms < 0) ms = 0
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d${h % 24}h`
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h${m}m`
  return `${m}m`
}

export function estimateDollars(percent, monthly) {
  return Math.round((percent / 100) * monthly * 10) / 10
}

export function resetClock(resetsAt) {
  const t = Date.parse(resetsAt)
  if (Number.isNaN(t)) return "—"
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function periodStart(resetsAt, kind) {
  const t = Date.parse(resetsAt)
  if (Number.isNaN(t)) return null
  const d = new Date(t)
  if (kind === "month") d.setMonth(d.getMonth() - 1)
  else if (kind === "week") d.setDate(d.getDate() - 7)
  else if (kind === "rolling") d.setHours(d.getHours() - 5)
  else return null
  return d.toISOString()
}

export function pacePercent(percent, resetsAt, kind, now = Date.now()) {
  const startIso = periodStart(resetsAt, kind)
  const end = Date.parse(resetsAt)
  if (!startIso || Number.isNaN(end)) return null
  const total = end - Date.parse(startIso)
  const elapsed = now - Date.parse(startIso)
  if (total <= 0 || elapsed <= 0) return null
  return Math.round(percent * (total / elapsed) * 10) / 10
}

export function paceColor(p) {
  if (p == null || Number.isNaN(p)) return null
  if (p >= 85) return "#ef4444"
  if (p > 70) return "#eab308"
  if (p < 50) return "#22c55e"
  return null
}

export function billingWindow(monthlyResetsAt, now = Date.now()) {
  const startIso = periodStart(monthlyResetsAt, "month")
  if (!startIso) return null
  return {
    from: startIso.slice(0, 10),
    to: new Date(now).toISOString().slice(0, 10),
  }
}

export function modelShare(dollars, monthly) {
  if (monthly === undefined || monthly === null || monthly === 0) return null
  return Math.round((dollars / monthly) * 1000) / 10
}

export function shortId(modelID, keep = 10) {
  if (!modelID || modelID.length <= keep + 4) return modelID ?? ""
  return modelID.slice(0, keep) + "..."
}

export function dayStart(now = Date.now()) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function modelLines(modelID, m, monthly, day) {
  if (!modelID || !m || monthly === undefined) return null
  const share = modelShare(m.dollars, monthly)
  const today = day && typeof day.dollars === "number" ? day.dollars : 0
  return [`${shortId(modelID)} · dia $${today}`, `mês $${m.dollars}/$${monthly} (${share}%)`]
}
