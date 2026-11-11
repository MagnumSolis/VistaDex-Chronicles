// Provider calls: a timeout, one retry on 429 / 5xx, and a per-run budget of outgoing calls
// (Cloudflare Workers allow 50 subrequests per request on the free plan). docs/LAUNCH-PLAN.md P0-3.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resilientFetch, createBudget } from "../prototype/core/providers/http.js";
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
