// ── http.js — Every outgoing provider call goes through here (docs/LAUNCH-PLAN.md P0-3) ──
// A timeout per attempt, one retry with a short backoff on 429 and 5xx (and on network errors), and a
// per-run budget of attempts: Cloudflare Workers allow 50 outgoing calls per request on the free plan.
// When the budget is spent, calls fail at once like an unavailable provider, so every stage falls back the
// way it already does (an LLM stage abstains, a search returns nothing).
// The per-attempt timeout covers the body too: the body is read inside the attempt and handed back as a
// buffered Response, so a provider that sends headers and then stalls cannot hang the run.
// Optional run deadline (createBudget(limit, { deadlineMs })): past it, calls fail at once with
// BudgetExhausted, each attempt's timeout is capped by the time left, and a retry whose backoff would end
// past the deadline is skipped.

export const DEFAULT_TIMEOUT_MS = 25000;
export const DEFAULT_BUDGET = 45; // of the 50 allowed, leaving room for the Worker's own storage calls

// opts.deadlineMs: optional wall-clock limit for the whole run. Without it the budget is exactly the
// call counter it always was. opts.now: clock, for tests.
export function createBudget(limit = DEFAULT_BUDGET, { deadlineMs, now = Date.now } = {}) {
  const budget = { limit, used: 0, get remaining() { return Math.max(0, this.limit - this.used); } };
  if (Number.isFinite(deadlineMs) && deadlineMs > 0) {
    budget.now = now;
    budget.startedAt = now();
    budget.deadlineAt = budget.startedAt + deadlineMs;
    budget.deadlineHit = null; // { used, limit, elapsed_ms } once the deadline stops a call
    budget.onDeadline = null;  // optional callback, called once with deadlineHit (pipeline.js logs it)
  }
  return budget;
}

export class BudgetExhausted extends Error {
  constructor(message = "call budget for this run is spent") { super(message); this.status = 0; }
}

const RETRY = status => status === 429 || status >= 500;
const NULL_BODY = new Set([101, 204, 205, 304]);
const realSleep = ms => new Promise(r => setTimeout(r, ms));

const hasDeadline = budget => budget != null && Number.isFinite(budget.deadlineAt);
const timeLeft = budget => budget.deadlineAt - budget.now();

function deadlineReached(budget) {
  if (!budget.deadlineHit) {
    budget.deadlineHit = { used: budget.used, limit: budget.limit, elapsed_ms: budget.now() - budget.startedAt };
    try { budget.onDeadline?.(budget.deadlineHit); } catch { /* logging must never break a run */ }
  }
  return new BudgetExhausted(`run deadline reached after ${budget.deadlineHit.elapsed_ms} ms`);
}

// Reads the whole body while the attempt's signal is live; an abort stops the read even if the body
// stream ignores the signal. → a buffered Response with the same status and headers.
async function buffered(res, signal) {
  if (typeof res?.arrayBuffer !== "function") return res;
  let stop;
  const aborted = new Promise((_, reject) => {
    stop = () => reject(new Error("aborted"));
    if (signal.aborted) stop(); else signal.addEventListener("abort", stop, { once: true });
  });
  try {
    const buf = await Promise.race([res.arrayBuffer(), aborted]);
    return new Response(NULL_BODY.has(res.status) ? null : buf, { status: res.status, statusText: res.statusText, headers: res.headers });
  } catch (err) {
    res.body?.cancel?.().catch(() => {});
    throw err;
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

// → a fetch-like function. budget: optional, shared by every provider of one run.
export function resilientFetch(fetchImpl, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 1, budget = null, sleep = realSleep } = {}) {
  const base = fetchImpl || ((...a) => fetch(...a));
  const deadline = hasDeadline(budget);
  // A backoff that would end at or past the deadline is not worth sleeping through.
  const canWait = ms => !deadline || ms < timeLeft(budget);
  return async function call(url, init = {}) {
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (deadline && timeLeft(budget) <= 0) throw deadlineReached(budget);
      if (budget) {
        if (budget.used >= budget.limit) throw new BudgetExhausted();
        budget.used++;
      }
      const ms = deadline ? Math.max(1, Math.min(timeoutMs, timeLeft(budget))) : timeoutMs;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      try {
        const res = await base(url, { ...init, signal: controller.signal });
        const after = Number(res.headers?.get?.("Retry-After"));
        const wait = Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 1500 * (attempt + 1), 4000);
        if (!RETRY(res.status) || attempt === retries || !canWait(wait)) return await buffered(res, controller.signal);
        res.body?.cancel?.().catch(() => {}); // this reply is dropped: free the connection
        clearTimeout(timer);
        await sleep(wait);
      } catch (err) {
        lastErr = controller.signal.aborted ? new Error(`timed out after ${ms} ms`) : err;
        if (controller.signal.aborted && deadline && timeLeft(budget) <= 0) deadlineReached(budget); // record it once
        if (attempt === retries || !canWait(1000)) throw lastErr;
        clearTimeout(timer);
        await sleep(1000);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr || new Error("request failed");
  };
}
