// Data retention and runs from visitors who are not recorded (docs/LAUNCH-PLAN.md P0-6).
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { handle, minimalTrace } from "../worker/src/index.js";
import { memoryStore } from "../worker/src/store.js";

const ORIGIN = "http://localhost:5173";
const env = { ALLOWED_ORIGINS: ORIGIN, EXPORT_TOKEN: "t" };
const screen = (store, headers = {}) => handle(new Request("https://proxy.test/screen", {
  method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers },
  body: JSON.stringify({ idea_text: "No tool like this exists today. The legal-tech market is worth $27B globally." }),
}), env, { store });

test("a run marked 'not recorded' keeps only a minimal trace: no claim text, no URLs, no searches", async () => {
  const store = memoryStore();
  const res = await screen(store, { "X-VistaDex-Record": "no" });
  assert.equal(res.status, 200);
  const [row] = await store.exportTraces();
  const kept = JSON.parse(row.trace);
  const text = JSON.stringify(kept);
  assert.ok(!/legal-tech|No tool like this/i.test(text), "no idea or claim text");
  assert.equal(kept.recorded, false);
  assert.ok(kept.events.every(e => !("claim" in e) && !("quote" in e) && (!("results" in e) || typeof e.results === "number")), "no claims or quotes; search results only as a count");
  assert.ok(!/https?:\/\//.test(text), "no URLs");
});

test("a recorded run keeps the full trace", async () => {
  const store = memoryStore();
  await screen(store);
  const [row] = await store.exportTraces();
  assert.match(row.trace, /legal-tech/);
});

test("minimalTrace keeps kinds, times, counts and errors only", () => {
  const t = minimalTrace({ trace_id: "x", mode: "live", idea_chars: 99, started_at: "a", finished_at: "b", events: [
    { t: "1", kind: "claim_typed", claim: "secret", type: "novelty", rule_hits: ["x"] },
    { t: "2", kind: "search", claim_index: 0, provider: "tinyfish", results: ["https://a.example"] },
    { t: "3", kind: "llm_fallback", stage: "classify", provider: "mistral", status: 429, error: "mistral: HTTP 429 slow" },
  ] });
  assert.deepEqual(t.events, [
    { t: "1", kind: "claim_typed", type: "novelty" },
    { t: "2", kind: "search", claim_index: 0, provider: "tinyfish", results: 1 },
    { t: "3", kind: "llm_fallback", stage: "classify", provider: "mistral", status: 429 },
  ]);
});

test("the daily cleanup deletes events, sessions and traces older than the retention period", async () => {
  const store = memoryStore();
  await store.saveEvents("11111111-2222-4333-8444-555555555555", [{ seq: 1, ts: "2025-01-01T00:00:00Z", type: "x", payload: {} }], "2025-01-01T00:00:00.000Z");
  await store.saveEvents("22222222-2222-4333-8444-555555555555", [{ seq: 1, ts: "2026-11-01T00:00:00Z", type: "x", payload: {} }], "2026-11-01T00:00:00.000Z");
  await store.saveTrace("old", "live", { events: [] }, "2025-01-01T00:00:00.000Z");
  await store.saveTrace("new", "live", { events: [] }, "2026-11-01T00:00:00.000Z");
  const out = await store.purgeOlderThan("2025-11-12T00:00:00.000Z");
  assert.deepEqual(out, { events: 1, traces: 1 });
  assert.deepEqual((await store.exportTraces()).map(t => t.trace_id), ["new"]);
  assert.equal((await store.exportEvents()).length, 1);
  assert.equal(typeof worker.scheduled, "function", "the Worker has a scheduled handler");
});
