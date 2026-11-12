import test from "node:test"
import assert from "node:assert/strict"
import { resetClock, pacePercent, paceColor, periodStart, billingWindow, modelShare, shortId, dayStart, modelLines, daysInCycle, dailyBudget, paceDaily, shortDate, fitId } from "./format.js"

test("resetClock mostra HH:MM local", () => {
  const d = new Date("2026-11-05T18:16:02.000Z")
  const want = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  assert.equal(resetClock("2026-11-05T18:16:02.000Z"), want)
})

test("resetClock inválido retorna —", () => {
  assert.equal(resetClock("xxx"), "—")
})

test("pace projeta o mês (5% em 2/30 dias = 75%)", () => {
  const p = pacePercent(5, "2026-12-03T04:05:42.000Z", "month", Date.parse("2026-11-05T04:05:42.000Z"))
  assert.equal(p, 75)
})

test("pace inválido retorna null", () => {
  assert.equal(pacePercent(5, "xxx", "month"), null)
})

test("paceColor segue os limiares", () => {
  assert.equal(paceColor(90), "#ef4444")
  assert.equal(paceColor(85), "#ef4444")
  assert.equal(paceColor(75), "#eab308")
  assert.equal(paceColor(70), "#eab308")
  assert.equal(paceColor(60), "#22c55e")
  assert.equal(paceColor(50), "#22c55e")
  assert.equal(paceColor(49), "#3b82f6")
  assert.equal(paceColor(0), "#3b82f6")
  assert.equal(paceColor(null), null)
})

test("periodStart volta 1 mês / 7 dias / 5 horas", () => {
  assert.equal(periodStart("2026-12-03T04:05:42.000Z", "month"), "2026-11-03T04:05:42.000Z")
  assert.equal(periodStart("2026-11-09T00:00:00.000Z", "week"), "2026-11-02T00:00:00.000Z")
  assert.equal(periodStart("2026-11-05T18:16:02.000Z", "rolling"), "2026-11-05T13:16:02.000Z")
})

test("billingWindow usa o ciclo do allowance (dia 3)", () => {
  assert.deepEqual(
    billingWindow("2026-12-03T04:05:42.000Z", Date.parse("2026-11-05T14:00:00.000Z")),
    { from: "2026-11-03", to: "2026-11-05" },
  )
})

test("modelShare calcula % do budget do modelo", () => {
  assert.equal(modelShare(1.2, 60), 2)
  assert.equal(modelShare(1.2, undefined), null)
})

test("dayStart é meia-noite local em ISO UTC", () => {
  const iso = dayStart(Date.parse("2026-11-05T14:00:00.000Z"))
  const d = new Date(iso)
  assert.equal(d.getHours(), 0)
  assert.equal(d.getMinutes(), 0)
  assert.equal(iso, d.toISOString())
})

test("modelLines cabe em 2 linhas curtas", () => {
  assert.deepEqual(
    modelLines("muse-spark-1.3-contributor", { dollars: 1.25, requests: 1317 }, 60, { dollars: 0.28, requests: 301 }, "2026-12-03T04:05:42.000Z"),
    ["muse-spa... · $0.28/2 (14%)", "mês $1.25/$60 (2.1%)"],
  )
  assert.deepEqual(
    modelLines("muse-spark-1.3-contributor", { dollars: 1.25, requests: 1317 }, 60, { dollars: 0.28, requests: 301 }, "xxx"),
    ["muse-spa... · dia $0.28", "mês $1.25/$60 (2.1%)"],
  )
  assert.equal(modelLines("hy3", null, 60, null), null)
})

test("modelLines cabe em 29 cols (sidebar estreita)", () => {
  const lines = modelLines("deepseek-v4.1-flash", { dollars: 6.14, requests: 1 }, 100, { dollars: 0.14 }, "2026-12-03T04:05:42.000Z")
  assert.ok(lines[0].length <= 29, lines[0] + " = " + lines[0].length)
})

test("shortDate formata dia/mês curto", () => {
  const d = new Date("2026-12-03T12:00:00.000Z")
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
  const want = `${String(d.getDate()).padStart(2, "0")}/${months[d.getMonth()]}`
  assert.equal(shortDate("2026-12-03T12:00:00.000Z"), want)
  assert.equal(shortDate("xxx"), null)
})

test("paceDaily replica o console (atual/decorrido)", () => {
  const out = paceDaily(14, "2026-12-03T04:05:42.000Z", "month", Date.parse("2026-11-12T10:15:00.000Z"))
  assert.equal(out.avg, 1.5)
  assert.ok(out.forecast >= 44 && out.forecast <= 47, "forecast=" + out.forecast)
})

test("paceDaily null no início do ciclo", () => {
  assert.equal(paceDaily(1, "2026-12-03T04:05:42.000Z", "month", Date.parse("2026-11-03T05:00:00.000Z")), null)
  assert.equal(paceDaily(5, "xxx", "month"), null)
})

test("shortId colapsa ids longos", () => {
  assert.equal(shortId("muse-spark-1.3-contributor"), "muse-spark...")
  assert.equal(shortId("qwen3.8-flash"), "qwen3.8-flash")
  assert.equal(shortId("qwen3.8-max"), "qwen3.8-max")
  assert.equal(shortId("qwen3.8-flash", 8), "qwen3.8...")
  assert.equal(shortId("hy3"), "hy3")
})

test("fitId enche até maxLen exato", () => {
  assert.equal(fitId("hy3", 10), "hy3")
  assert.equal(fitId("muse-spark-1.3-contributor", 27), "muse-spark-1.3-contributor")
  assert.equal(fitId("muse-spark-1.3-contributor", 16), "muse-spark-1...")
  assert.ok(fitId("qwen3.8-flash", 10).length <= 10)
})

test("modelLines com width alinha as duas linhas", () => {
  const lines = modelLines("muse-spark-1.3-contributor", { dollars: 1.25, requests: 1317 }, 60, { dollars: 0.28, requests: 301 }, "2026-12-03T04:05:42.000Z", 33)
  assert.equal(lines[0].length, 33)
  assert.equal(lines[1].length, 33)
  assert.ok(lines[1].endsWith("(2.1%)"))
})

test("daysInCycle conta os dias do ciclo mensal", () => {
  assert.equal(daysInCycle("2026-12-03T04:05:42.000Z"), 30)
  assert.equal(daysInCycle("2026-03-03T00:00:00.000Z"), 28)
  assert.equal(daysInCycle("xxx"), null)
})

test("dailyBudget divide o limite mensal pelos dias do ciclo", () => {
  assert.equal(dailyBudget(60, "2026-12-03T04:05:42.000Z"), 2)
  assert.equal(dailyBudget(60, "xxx"), null)
  assert.equal(dailyBudget(undefined, "2026-12-03T04:05:42.000Z"), null)
})
