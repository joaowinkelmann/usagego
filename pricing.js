// Limites mensais do plano Go (USD de allowance) por model ID.
// Fonte: https://opencode.ai/v2/docs/console/go/ — plano "go".
// shortcut: tabela vendored; revisar quando a doc mudar ou plano do usuário mudar.
export const PLAN = "go"

export const GO_LIMITS = {
  "glm-5.3-flash": { monthly: 60 },
  "glm-5.3": { monthly: 15 },
  "glm-5.2": { monthly: 60 },
  "kimi-k3.1-pro": { monthly: 15 },
  "kimi-k3": { monthly: 15 },
  "kimi-k2.7-code": { monthly: 60 },
  "longcat-2.0": { monthly: 60 },
  "step-5-preview": { monthly: 15 },
  "mimo-v2.6-flash": { monthly: 60 },
  "mimo-v2.6-pro": { monthly: 15 },
  "mimo-v2.5": { monthly: 60 },
  "mimo-v2.5-pro": { monthly: 15 },
  "minimax-m3.1-flash": { monthly: 20 },
  "minimax-m3": { monthly: 60 },
  "muse-spark-1.3-contributor": { monthly: 60 },
  "muse-spark-1.2-contributor": { monthly: 60 },
  "qwen3.8-max": { monthly: 15 },
  "qwen3.8-flash": { monthly: 30 },
  "qwen3.7-plus": { monthly: 60 },
  "deepseek-v4.1-flash": { monthly: 100 },
  "deepseek-v4-pro": { monthly: 15 },
  "hy4": { monthly: 60 },
  "hy4-preview": { monthly: 30 },
  "hy3": { monthly: 60 },
  "grok-4.7": { monthly: 15 },
  "gpt-6-luna": { monthly: 15 },
  "gpt-5.6-luna": { monthly: 15 },
  "claude-haiku-5.5": { monthly: 15 },
  "gemini-4-argon": { monthly: 30 },
}
