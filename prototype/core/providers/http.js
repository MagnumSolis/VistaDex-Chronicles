// ── http.js — Every outgoing provider call goes through here (docs/LAUNCH-PLAN.md P0-3) ──
// A timeout per attempt, one retry with a short backoff on 429 and 5xx (and on network errors), and a
// per-run budget of attempts: Cloudflare Workers allow 50 outgoing calls per request on the free plan.
// When the budget is spent, calls fail at once like an unavailable provider, so every stage falls back the
// way it already does (an LLM stage abstains, a search returns nothing).

export const DEFAULT_TIMEOUT_MS = 25000;
export const DEFAULT_BUDGET = 45; // of the 50 allowed, leaving room for the Worker's own storage calls

export function createBudget(limit = DEFAULT_BUDGET) {
  return { limit, used: 0, get remaining() { return Math.max(0, this.limit - this.used); } };
}

export class BudgetExhausted extends Error {
  constructor() { super("call budget for this run is spent"); this.status = 0; }
}

const RETRY = status => status === 429 || status >= 500;
const realSleep = ms => new Promise(r => setTimeout(r, ms));

// → a fetch-like function. budget: optional, shared by every provider of one run.
export function resilientFetch(fetchImpl, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 1, budget = null, sleep = realSleep } = {}) {
  const base = fetchImpl || ((...a) => fetch(...a));
  return async function call(url, init = {}) {
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (budget) {
        if (budget.used >= budget.limit) throw new BudgetExhausted();
        budget.used++;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await base(url, { ...init, signal: controller.signal });
        if (!RETRY(res.status) || attempt === retries) return res;
        const after = Number(res.headers?.get?.("Retry-After"));
        await sleep(Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 1500 * (attempt + 1), 4000));
      } catch (err) {
        lastErr = controller.signal.aborted ? new Error(`timed out after ${timeoutMs} ms`) : err;
        if (attempt === retries) throw lastErr;
        await sleep(1000);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr || new Error("request failed");
  };
}
