import { Rpc } from "@opencode/plugin/rpc"

const Slot = {
  type: "object",
  properties: {
    percent: { type: "number" },
    resetsAt: { type: "string" },
    status: { type: "string" },
  },
  required: ["percent", "resetsAt", "status"],
  additionalProperties: false,
}

const UsagePayload = {
  type: "object",
  properties: {
    fetchedAt: { type: "string" },
    rolling: Slot,
    weekly: Slot,
    monthly: Slot,
    pricingAsOf: { type: "string" },
    limits: { type: "object", additionalProperties: { type: "number" } },
  },
  required: ["fetchedAt", "rolling", "weekly", "monthly", "pricingAsOf", "limits"],
  additionalProperties: false,
}

export const GoUsage = Rpc.define({
  id: "go-usage",
  methods: {
    get: {
      input: { type: "object", additionalProperties: false },
      output: UsagePayload,
      errors: {
        unavailable: {
          type: "object",
          properties: { reason: { type: "string" } },
          required: ["reason"],
          additionalProperties: false,
        },
      },
    },
  },
  events: {
    updated: { schema: UsagePayload },
  },
})
