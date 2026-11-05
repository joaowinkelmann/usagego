import test from "node:test"
import assert from "node:assert/strict"
import { parseGoPricing, summarizeModels } from "./pricing-parse.js"

const HTML = `
<div role="tabpanel" data-plan-panel="go"><div>
<table>
<thead><tr><th>Model</th><th>Input</th><th>Output</th><th>Cached Read</th><th>Cached Write</th><th>Monthly limit</th></tr></thead>
<tbody>
<tr><td>Muse Spark 1.3 Contributor</td><td>$0.10</td><td>$0.20</td><td>$0.002</td><td>-</td><td><strong>$60</strong></td></tr>
<tr><td>MiniMax M3 (≤ 512K tokens)</td><td>$0.30</td><td>$1.20</td><td>$0.06</td><td>-</td><td><strong>$60</strong></td></tr>
<tr><td>Beam Free</td><td>Free</td><td>Free</td><td>Free</td><td>-</td><td><strong>Unlimited</strong></td></tr>
</tbody>
</table>
</div></div>
<div role="tabpanel" data-plan-panel="go-plus"><div>
<table>
<thead><tr><th>Model</th><th>Monthly limit</th></tr></thead>
<tbody>
<tr><td>Muse Spark 1.3 Contributor</td><td><strong>$120</strong></td></tr>
</tbody>
</table>
</div></div>
`

test("parseia só o slot go padrão", () => {
  const { limits, unmatched } = parseGoPricing(HTML, ["muse-spark-1.3-contributor", "minimax-m3"])
  assert.equal(limits["muse-spark-1.3-contributor"], 60)
  assert.equal(limits["minimax-m3"], 60)
  assert.ok(!("beam-free" in limits))
  assert.deepEqual(unmatched, [])
})

test("summarizeModels converte microcents em dólares", () => {
  const out = summarizeModels([
    { model: "muse-spark-1.3-contributor", totalCostMicroCents: "120355911", totalRequests: "1331" },
  ])
  assert.deepEqual(out, { "muse-spark-1.3-contributor": { dollars: 1.2, requests: 1331 } })
})

test("ignora nomes fora da tabela conhecida", () => {
  const { limits, unmatched } = parseGoPricing(HTML, ["minimax-m3"])
  assert.equal(limits["muse-spark-1.3-contributor"], 60)
  assert.deepEqual(unmatched, ["Muse Spark 1.3 Contributor"])
})
