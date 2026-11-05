import { Plugin } from "@opencode/plugin"
import { readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { GoUsage } from "./rpc.js"
import { GO_LIMITS } from "./pricing.js"
import { parseGoPricing } from "./pricing-parse.js"

const ENDPOINT = "https://opencode.ai/zen/go/v1/usage"
const DOCS_URL = "https://opencode.ai/v2/docs/console/go/"
const POLL_MS = 300_000
const WEEK_MS = 7 * 24 * 3_600_000
const KEY_FILE = path.join(os.homedir(), ".config", "opencode", ".go-api-key")
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

    const withPricing = async (usage) => {
      const stored = await ctx.storage.get("pricing")
      const ok = stored && typeof stored === "object" && stored.limits && typeof stored.limits === "object"
      return {
        ...usage,
        pricingAsOf: ok ? stored.asOf : "built-in",
        limits: ok ? stored.limits : monthlyFallback(),
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
