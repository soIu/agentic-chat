/**
 * Current Agent Resolution
 *
 * Resolves which LangGraph assistant/graph to target for the "public" deployment.
 * The backend (nginx / server.py) exposes `/getCurrentAgent`, returning the
 * designated agent id as a JSON array, e.g. `["agent"]`.
 *
 * Why this exists (fixes the intermittent "assistantId not found" bug):
 * - Previously every single message send re-fetched `/getCurrentAgent` inline.
 *   Any transient hiccup on that endpoint (cold start, brief 5xx, a body that
 *   parsed but didn't contain a valid id) silently produced `agentType =
 *   undefined`, which LangGraph then rejected with "assistantId not found".
 *   A page refresh "fixed" it purely because it was a new roll of the dice.
 * - Here we validate the response shape, retry a couple of times on failure,
 *   and cache the first successful resolution for the lifetime of the page so
 *   we only pay the "flaky endpoint" tax once instead of on every message.
 */

const DEFAULT_AGENT = "agent"
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 400

let cachedAgentType: string | null = null
let inFlight: Promise<string> | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Extract a non-empty agent id from the `/getCurrentAgent` response body.
 * Accepts the documented `["agent"]` shape, but tolerates a bare string too.
 */
function extractAgentType(body: unknown): string | null {
  if (typeof body === "string" && body.trim()) return body.trim()
  if (Array.isArray(body) && typeof body[0] === "string" && body[0].trim()) {
    return body[0].trim()
  }
  return null
}

async function fetchOnce(): Promise<string | null> {
  const response = await fetch("/getCurrentAgent")
  if (!response.ok) return null
  const body = await response.json().catch(() => null)
  return extractAgentType(body)
}

async function resolveAgentType(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await delay(RETRY_DELAY_MS * attempt)
    }

    try {
      const agentType = await fetchOnce()
      if (agentType) {
        return agentType
      }
      console.warn(`[Agent] /getCurrentAgent returned an unusable response (attempt ${attempt + 1}/${MAX_ATTEMPTS})`)
    } catch (error) {
      console.warn(`[Agent] /getCurrentAgent request failed (attempt ${attempt + 1}/${MAX_ATTEMPTS}):`, error)
    }
  }

  console.error(`[Agent] Could not resolve current agent after ${MAX_ATTEMPTS} attempts; falling back to "${DEFAULT_AGENT}"`)
  return DEFAULT_AGENT
}

/**
 * Get the designated agent/graph id to run against.
 * Resolved once (with retries) and cached for the rest of the session,
 * unless resolution fell back to the default — in that case we retry on the
 * next call instead of permanently caching a guess.
 */
export async function getCurrentAgentType(): Promise<string> {
  if (cachedAgentType) return cachedAgentType

  if (!inFlight) {
    inFlight = resolveAgentType().finally(() => {
      inFlight = null
    })
  }

  const agentType = await inFlight
  if (agentType !== DEFAULT_AGENT) {
    cachedAgentType = agentType
  }
  return agentType
}
