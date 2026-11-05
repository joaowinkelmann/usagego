import { Plugin } from "@opencode/plugin"
import { readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { GoUsage } from "./rpc.js"
import { GO_LIMITS } from "./pricing.js"
import { parseGoPricing, summarizeModels } from "./pricing-parse.js"
import { billingWindow, dayStart } from "./format.js"

const ENDPOINT = "https://opencode.ai/zen/go/v1/usage"
const MODELS_URL = "https://opencode.ai/console/api/usage/models"
const DOCS_URL = "https://opencode.ai/v2/docs/console/go/"
const POLL_MS = 120_000
const WEEK_MS = 7 * 24 * 3_600_000
const KEY_FILE = path.join(os.homedir(), ".config", "opencode", ".go-api-key")
const ORG_FILE = path.join(os.homedir(), ".config", "opencode", ".go-org-id")
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

const monthlyFallback = () =>
  Object.fromEntries(Object.entries(GO_LIMITS).map(([id, v]) => [id, v.monthly]))

function slotOf(raw) {
  if (!raw || typeof raw !== "object") return null
  const { percent, resetsAt, status } = raw
  if (typeof percent !== "number" || typeof resetsAt !== "string" || typeof status !== "string") return null
  return { percent, resetsAt, status }
}

export default Plugin.define({
  id: "go-usage",
  async setup(ctx) {
    const readKey = () => {
      try {
        const key = readFileSync(KEY_FILE, "utf8").trim()
        return key || null
      } catch {
        return null
      }
    }

    const fetchUsage = async (signal) => {
      const key = readKey()
      if (!key) return { error: "key-file-missing" }
      let res
      try {
        res = await fetch(ENDPOINT, {
          headers: { Authorization: "Bearer " + key, "User-Agent": UA, Accept: "application/json" },
          signal,
        })
      } catch (e) {
        return { error: e && e.name === "AbortError" ? "aborted" : "fetch-failed" }
      }
      if (!res.ok) return { error: "http-" + res.status }
      let body
      try {
        body = await res.json()
      } catch {
        return { error: "bad-json" }
      }
      const u = body && typeof body === "object" ? body.usage : null
      const rolling = slotOf(u?.rolling)
      const weekly = slotOf(u?.weekly)
      const monthly = slotOf(u?.monthly)
      if (!rolling || !weekly || !monthly) return { error: "bad-shape" }
      return { ok: { fetchedAt: new Date().toISOString(), rolling, weekly, monthly } }
    }

    const fetchModels = async (window, signal) => {
      const readTrimmed = (file) => {
        try {
          const v = readFileSync(file, "utf8").trim()
          return v || null
        } catch {
          return null
        }
      }
      const key = readTrimmed(KEY_FILE)
      if (!key) return { error: "key-file-missing" }
      const org = readTrimmed(ORG_FILE)
      if (!org) return { error: "org-file-missing" }
      const out = {}
      for (let page = 1; page <= 5; page++) {
        const q = window.since
          ? `range=24h&since=${encodeURIComponent(window.since)}`
          : `range=30d&from=${window.from}&to=${window.to}`
        const url = `${MODELS_URL}?${q}&page=${page}&pageSize=100&costOrder=desc`
        let res
        try {
          res = await fetch(url, {
            headers: {
              Authorization: "Bearer " + key,
              "x-org-id": org,
              "User-Agent": UA,
              Accept: "application/json",
            },
            signal,
          })
        } catch (e) {
          return { error: e && e.name === "AbortError" ? "aborted" : "models-fetch-failed" }
        }
        if (!res.ok) return { error: "models-http-" + res.status }
        let body
        try {
          body = await res.json()
        } catch {
          return { error: "models-bad-json" }
        }
        const items = Array.isArray(body?.items) ? body.items : []
        Object.assign(out, summarizeModels(items))
        if (items.length < 100) break
      }
      return { ok: out }
    }

    const withPricing = async (usage) => {
      const stored = await ctx.storage.get("pricing")
      const ok = stored && typeof stored === "object" && stored.limits && typeof stored.limits === "object"
      const models = await ctx.storage.get("models")
      const daily = await ctx.storage.get("modelsDaily")
      const map = (v) => (v && typeof v === "object" ? v : {})
      return {
        ...usage,
        pricingAsOf: ok ? stored.asOf : "built-in",
        limits: ok ? stored.limits : monthlyFallback(),
        models: map(models),
        daily: map(daily),
      }
    }

    const registration = await ctx.rpc.register(GoUsage, {
      get: async (_input, context) => {
        const cached = await ctx.storage.get("usage")
        if (
          cached &&
          typeof cached === "object" &&
          typeof cached.fetchedAt === "string" &&
          Date.now() - Date.parse(cached.fetchedAt) < POLL_MS * 2
        ) {
          return withPricing(cached)
        }
        const fresh = await fetchUsage(context.signal)
        if (fresh.error) return context.error("unavailable", fresh.error, { reason: fresh.error })
        await ctx.storage.set("usage", fresh.ok)
        return withPricing(fresh.ok)
      },
    })

    const refreshPricing = async (signal) => {
      const res = await fetch(DOCS_URL, { headers: { "User-Agent": UA, Accept: "text/html" }, signal })
      if (!res.ok) throw new Error("docs-http-" + res.status)
      const html = await res.text()
      const { limits, unmatched } = parseGoPricing(html, Object.keys(GO_LIMITS))
      if (Object.keys(limits).length === 0) throw new Error("docs-parse-empty")
      if (unmatched.length > 0) console.warn("[go-usage] modelos novos na doc: " + unmatched.join(", "))
      await ctx.storage.set("pricing", { asOf: new Date().toISOString().slice(0, 10), limits })
    }

    const controller = new AbortController()
    const poll = async () => {
      const fresh = await fetchUsage(controller.signal)
      if (fresh.error) {
        if (fresh.error !== "key-file-missing" && fresh.error !== "aborted") {
          console.warn("[go-usage] " + fresh.error)
        }
        return
      }
      await ctx.storage.set("usage", fresh.ok)
      const window = billingWindow(fresh.ok.monthly.resetsAt)
      if (window) {
        const [models, day] = await Promise.all([
          fetchModels(window, controller.signal),
          fetchModels({ since: dayStart() }, controller.signal),
        ])
        if (models.ok) await ctx.storage.set("models", models.ok)
        else if (models.error !== "aborted") console.warn("[go-usage] " + models.error)
        if (day.ok) await ctx.storage.set("modelsDaily", day.ok)
        else if (day.error !== "aborted") console.warn("[go-usage] " + day.error)
      }
      const payload = await withPricing(fresh.ok)
      await registration.events.emit("updated", payload)
    }
    const usageTimer = setInterval(() => void poll().catch(() => {}), POLL_MS)
    const pricingTimer = setInterval(
      () => void refreshPricing(controller.signal).catch((e) => console.warn("[go-usage] pricing: " + e.message)),
      WEEK_MS,
    )
    void (async () => {
      try {
        const stored = await ctx.storage.get("pricing")
        if (!stored || Date.now() - Date.parse(stored.asOf) > WEEK_MS) await refreshPricing(controller.signal)
      } catch (e) {
        console.warn("[go-usage] pricing: " + e.message)
      }
    })()
    void poll().catch(() => {})

    return () => {
      clearInterval(usageTimer)
      clearInterval(pricingTimer)
      controller.abort()
    }
  },
})
