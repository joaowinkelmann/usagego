import test from "node:test"
import assert from "node:assert/strict"
import { bar, countdown, estimateDollars, resetClock, pacePercent, paceColor, periodStart, billingWindow, modelShare, shortId, dayStart, modelLines, daysInCycle, dailyBudget } from "./format.js"

test("bar usa 10 blocos", () => {
  assert.equal(bar(50), "▓▓▓▓▓░░░░░")
})

test("countdown inválido retorna —", () => {
  assert.equal(countdown("xxx"), "—")
})

test("estimate 8% de $60 = 4.8", () => {
  assert.equal(estimateDollars(8, 60), 4.8)
})

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
    ["muse-spark... · dia $0.28/$2 (14%)", "mês $1.25/$60 (2.1%)"],
  )
  assert.deepEqual(
    modelLines("muse-spark-1.3-contributor", { dollars: 1.25, requests: 1317 }, 60, { dollars: 0.28, requests: 301 }, "xxx"),
    ["muse-spark... · dia $0.28", "mês $1.25/$60 (2.1%)"],
  )
  assert.equal(modelLines("hy3", null, 60, null), null)
})

test("shortId colapsa ids longos", () => {
  assert.equal(shortId("muse-spark-1.3-contributor"), "muse-spark...")
  assert.equal(shortId("qwen3.8-flash"), "qwen3.8-flash")
  assert.equal(shortId("hy3"), "hy3")
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
