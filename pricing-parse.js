// Extrai {modelId: limiteMensal} da tabela do plano Go padrão na doc.
// shortcut: parse de HTML; se a doc reestruturar, cai em fallback (tabela embutida).
export function summarizeModels(items) {
  const out = {}
  for (const it of items ?? []) {
    if (!it || typeof it.model !== "string") continue
    out[it.model] = {
      dollars: Math.round(Number(it.totalCostMicroCents ?? 0) / 1e6) / 100,
      requests: Number(it.totalRequests ?? 0),
    }
  }
  return out
}
export function parseGoPricing(html, knownIds = []) {
  const known = new Set(knownIds)
  // SSR marca os painéis: data-plan-panel="go" (padrão), "go-plus", "go-teams".
  // Sem o painel, cai no documento inteiro (pega a 1a tabela = plano padrão).
  let section = html
  const panel = html.indexOf('data-plan-panel="go"')
  if (panel !== -1) {
    const next = html.indexOf('data-plan-panel="', panel + 1)
    section = html.slice(panel, next === -1 ? html.length : next)
  }
  const tables = [...section.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => m[0])
  const table = tables.find((t) => /Monthly limit/i.test(t)) ?? null
  if (!table) return { limits: {}, unmatched: [] }
  const limits = {}
  const unmatched = []
  for (const row of table.matchAll(/<tr[\s\S]*?<\/tr>/g)) {
    const cells = [...row[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, "").trim(),
    )
    if (cells.length < 2) continue
    const monthly = cells[cells.length - 1].match(/\$([\d,]+)/)
    if (!monthly) continue
    const base = cells[0]
      .replace(/\s*\(.*?\)\s*/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
    const alt = base.replace(/\./g, "-")
    let id
    if (known.size === 0 || known.has(base)) id = base
    else if (known.has(alt)) id = alt
    else {
      unmatched.push(cells[0])
      id = base
    }
    if (!(id in limits)) limits[id] = Number(monthly[1].replace(/,/g, ""))
  }
  return { limits, unmatched }
}
