// Provider calls: a timeout, one retry on 429 / 5xx, and a per-run budget of outgoing calls
// (Cloudflare Workers allow 50 subrequests per request on the free plan). docs/LAUNCH-PLAN.md P0-3.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resilientFetch, createBudget, BudgetExhausted } from "../prototype/core/providers/http.js";
import { routesFromEnv, createLLM } from "../prototype/core/providers/llm.js";
import { tinyfishRetrieval } from "../prototype/core/providers/retrieval.js";
import { runScreen } from "../prototype/core/pipeline.js";
import { validateContract } from "../prototype/core/contract.js";

const noSleep = async () => {};
const ok = body => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

test("a 429 is retried once, then succeeds; every attempt counts against the budget", async () => {
  let n = 0;
  const budget = createBudget(10);
  const f = resilientFetch(async () => (++n === 1 ? new Response("slow down", { status: 429 }) : ok({ fine: true })), { budget, sleep: noSleep });
  const res = await f("https://x.example");
  assert.equal(res.status, 200);
  assert.equal(n, 2);
  assert.equal(budget.used, 2);
});

test("a call that hangs is aborted after the timeout and counts as a failure, not a hung run", async () => {
  const f = resilientFetch((url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))), { timeoutMs: 20, retries: 0, sleep: noSleep });
  await assert.rejects(f("https://x.example"), /timed out after 20 ms/);
});

test("when the budget is spent, calls fail at once without reaching the network", async () => {
  let n = 0;
  const budget = createBudget(1);
  const f = resilientFetch(async () => { n++; return ok({}); }, { budget, sleep: noSleep });
  await f("https://x.example");
  await assert.rejects(f("https://x.example"), /call budget/);
  assert.equal(n, 1);
});

test("LLM and TinyFish backends use the shared helper: a 503 then a good reply gives the reply", async () => {
  let calls = 0;
  const fetchImpl = async () => (++calls === 1 ? new Response("busy", { status: 503 }) : ok({ choices: [{ message: { content: "{\"x\": []}" } }] }));
  const llm = createLLM(routesFromEnv({ MISTRAL_API_KEY: "k" }, fetchImpl, { sleep: noSleep }));
  const { content } = await llm.complete("classify", { messages: [{ role: "user", content: "hi" }] });
  assert.equal(content, "{\"x\": []}");
  let t = 0;
  const tf = tinyfishRetrieval({ apiKey: "k", fetchImpl: async () => (++t === 1 ? new Response("", { status: 429 }) : ok({ results: [{ url: "https://a.example", title: "A" }] })), sleep: noSleep });
  assert.deepEqual((await tf.search("q")).map(r => r.url), ["https://a.example"]);
});

test("pipeline: with a small budget, legal searches beyond it are skipped and said so; the report stays valid", async () => {
  const pages = [{ url: "https://a.example.com/p", title: "A", text: "Something about the topic for every query." }];
  const retrieval = { name: "fake", async search() { return pages.map(p => ({ url: p.url, title: p.title, snippet: "" })); }, async fetchPages() { return pages; } };
  const llm = { default: [{ name: "fake", model: "f", complete: async () => "{}" }] };
  const input = { title: "T", pitch: "An AI scribe for clinics", problem: "p", solution: "s", moat: "", industries: [], role: null, markets: ["EU", "USA", "India"] };
  const budget = createBudget(12); budget.used = 4; // 8 left: not enough for every optional search
  const { report, trace } = await runScreen(input, { llmRoutes: llm, retrieval, graveyard: [], mode: "live", budget });
  assert.deepEqual(validateContract(report), []);
  assert.ok(report.legal.not_searched.length > 0, "some markets were not searched this run");
  assert.ok(trace.events.some(e => e.kind === "budget"));
});

// ── Slow bodies and the run deadline ──

// Headers at once, then a body that never ends and ignores the abort signal (the worst case).
const stalledBody = () => new Response(new ReadableStream({ start() {} }), { status: 200, headers: { "Content-Type": "application/json" } });

test("headers arrive fast but the body never does: the attempt times out, is retried once, then fails as timed out", async () => {
  let n = 0;
  const budget = createBudget(10);
  const f = resilientFetch(async () => { n++; return stalledBody(); }, { timeoutMs: 30, budget, sleep: noSleep });
  const started = Date.now();
  await assert.rejects(f("https://x.example"), /timed out after 30 ms/);
  assert.equal(n, 2, "one retry");
  assert.equal(budget.used, 2);
  assert.ok(Date.now() - started < 1000, "did not wait for the body");
});

test("a body that arrives in time: the buffered Response reads the same as the original", async () => {
  const body = { choices: [{ message: { content: "ok" } }], n: 3 };
  const f = resilientFetch(async () => ok(body), { timeoutMs: 1000, sleep: noSleep });
  const res = await f("https://x.example");
  assert.equal(res.status, 200);
  assert.equal(res.ok, true);
  assert.equal(res.headers.get("Content-Type"), "application/json");
  assert.deepEqual(await res.json(), body);
});

test("a 503 retried once and still 503: the final reply's body is buffered and readable", async () => {
  let n = 0;
  const f = resilientFetch(async () => { n++; return new Response("busy", { status: 503 }); }, { sleep: noSleep });
  const res = await f("https://x.example");
  assert.equal(n, 2);
  assert.equal(res.status, 503);
  assert.equal(await res.text(), "busy");
});

test("deadline: past it, the next call throws BudgetExhausted without calling fetch, and is reported once", async () => {
  let clock = 1000, n = 0;
  const budget = createBudget(10, { deadlineMs: 500, now: () => clock });
  const hits = [];
  budget.onDeadline = info => hits.push(info);
  const f = resilientFetch(async () => { n++; return ok({}); }, { budget, sleep: noSleep });
  await f("https://x.example");
  clock = 1500;
  await assert.rejects(f("https://x.example"), err => err instanceof BudgetExhausted && /deadline/.test(err.message));
  await assert.rejects(f("https://x.example"), BudgetExhausted);
  assert.equal(n, 1, "fetch not called past the deadline");
  assert.equal(budget.used, 1, "refused calls do not count against the budget");
  assert.deepEqual(hits, [{ used: 1, limit: 10, elapsed_ms: 500 }]);
});

test("deadline: each attempt's timeout is capped by the time left, and a backoff past the deadline skips the retry", async () => {
  const budget = createBudget(10, { deadlineMs: 60 });
  let n = 0;
  const slept = [];
  const hang = (url, init) => { n++; return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))); };
  const f = resilientFetch(hang, { timeoutMs: 25000, budget, sleep: async ms => { slept.push(ms); } });
  const started = Date.now();
  await assert.rejects(f("https://x.example"), err => {
    const ms = Number(/timed out after (\d+) ms/.exec(err.message)?.[1]);
    assert.ok(ms > 0 && ms <= 60, `attempt timeout ${ms} ms, capped by the 60 ms left`);
    return true;
  });
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 1000, `capped near 60 ms, took ${elapsed} ms`);
  assert.equal(n, 1, "the 1 s retry backoff would pass the deadline: no retry");
  assert.deepEqual(slept, []);
  assert.ok(budget.deadlineHit, "the deadline is recorded");
});

test("deadline: a 429 whose backoff would pass the deadline is returned as is, not retried", async () => {
  let clock = 0, n = 0;
  const budget = createBudget(10, { deadlineMs: 1000, now: () => clock });
  const f = resilientFetch(async () => { n++; return new Response("slow down", { status: 429 }); }, { budget, sleep: async () => { throw new Error("must not sleep"); } });
  const res = await f("https://x.example");
  assert.equal(res.status, 429);
  assert.equal(n, 1);
});

test("no deadline: the budget and the calls behave exactly as before", async () => {
  const budget = createBudget(10);
  assert.deepEqual(Object.keys(budget).sort(), ["limit", "remaining", "used"]);
  assert.equal(createBudget().limit, 45);
  let n = 0;
  const seen = [];
  const f = resilientFetch(async () => (++n === 1 ? new Response("busy", { status: 503 }) : ok({ fine: true })), { budget, sleep: async ms => { seen.push(ms); } });
  const res = await f("https://x.example");
  assert.deepEqual(await res.json(), { fine: true });
  assert.deepEqual(seen, [1500], "same backoff as before");
  assert.equal(budget.used, 2);
  // A hanging call still times out at the full per-attempt timeout.
  const hang = resilientFetch((url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))), { timeoutMs: 20, retries: 0, budget });
  await assert.rejects(hang("https://x.example"), /timed out after 20 ms/);
});

test("pipeline: providers that stall, with a 300 ms deadline, still give a valid report long before the stall would end", async () => {
  const budget = createBudget(45, { deadlineMs: 300 });
  // Every provider sends headers at once and then never finishes its body.
  const fetchImpl = async () => stalledBody();
  const llmRoutes = routesFromEnv({ MISTRAL_API_KEY: "k", GROQ_API_KEY: "g" }, fetchImpl, { budget });
  const retrieval = tinyfishRetrieval({ apiKey: "k", fetchImpl, budget });
  const input = { title: "T", pitch: "An AI scribe for clinics", problem: "Doctors spend hours on notes", solution: "Automatic notes", moat: "", industries: [], role: null, markets: ["EU", "India"] };
  const started = Date.now();
  const { report, trace } = await runScreen(input, { llmRoutes, retrieval, graveyard: [], mode: "live", budget });
  const elapsed = Date.now() - started;
  assert.deepEqual(validateContract(report), []);
  assert.ok(elapsed < 5000, `ended at the deadline, took ${elapsed} ms (a single provider timeout is 15–25 s)`);
  const deadline = trace.events.filter(e => e.kind === "deadline");
  assert.equal(deadline.length, 1, "one deadline trace event");
  assert.equal(deadline[0].limit, 45);
  assert.ok(deadline[0].elapsed_ms >= 300);
});
