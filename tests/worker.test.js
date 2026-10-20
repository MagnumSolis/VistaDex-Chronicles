import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../worker/src/index.js";
import { memoryStore } from "../worker/src/store.js";
import { validateContract } from "../prototype/core/contract.js";

const ORIGIN = "http://localhost:5173";
const ENV = { ALLOWED_ORIGINS: `${ORIGIN},https://magnumsolis.github.io`, EXPORT_TOKEN: "test-token" };
const SID = "11111111-2222-4333-8444-555555555555";

const req = (method, path, { body, origin = ORIGIN, headers = {} } = {}) =>
  new Request(`https://proxy.test${path}`, {
    method,
    headers: { ...(origin ? { Origin: origin } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

// Fake upstream APIs (Groq / Mistral / TinyFish), keyed by URL.
function fakeUpstream({ groqStatus = 200 } = {}) {
  const calls = [];
  const reply = content => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: u, model: body?.model, auth: init.headers?.Authorization || init.headers?.["X-API-Key"] });
    if (u.startsWith("https://agent.tinyfish.ai/v1/search")) {
      return new Response(JSON.stringify({ results: [
        { url: "https://www.harvey.ai/product", title: "Harvey", snippet: "" },
        { url: "https://robin.ai/review", title: "Robin", snippet: "" },
      ] }));
    }
    if (u === "https://agent.tinyfish.ai/v1/fetch") {
      return new Response(JSON.stringify({ results: [
        { url: "https://www.harvey.ai/product", text: "Harvey provides AI contract review with lawyer oversight for legal teams." },
        { url: "https://robin.ai/review", text: "Robin AI pairs AI contract review with human lawyers at a fixed monthly price." },
      ], errors: [] }));
    }
    if (u.includes("groq.com") && groqStatus !== 200) return new Response("rate limited", { status: groqStatus });
    const system = body.messages[0].content;
    if (system.startsWith("Split the startup idea")) return reply(JSON.stringify({ claims: [{ claim: "No tool combines AI contract review with human lawyer oversight" }] }));
    if (system.startsWith("Type each claim")) return reply(JSON.stringify({ types: [] }));
    if (system.startsWith("You check one factual claim")) return reply(JSON.stringify({ judgments: [
      { source: 1, stance: "contradicts", quote: "Harvey provides AI contract review with lawyer oversight" },
      { source: 2, stance: "contradicts", quote: "Robin AI pairs AI contract review with human lawyers" },
    ] }));
    if (system.startsWith("You are the Objector")) return reply(JSON.stringify({ objections: [
      { objection: "Harvey and Robin AI already offer this combination.", severity: "high" },
      { objection: "Overall this is a strong idea and should proceed.", severity: "low" },
    ] }));
    return new Response("unexpected", { status: 500 });
  };
  return { fetchImpl, calls };
}

const IDEA = "AI contract review for startups. No tool combines AI contract review with human lawyer oversight.";

test("POST /screen without keys runs the mock path and returns the exact contract", async () => {
  const store = memoryStore();
  const res = await handle(req("POST", "/screen", { body: { idea_text: IDEA } }), ENV, { store });
  assert.equal(res.status, 200);
  const report = await res.json();
  assert.deepEqual(validateContract(report), []);
  assert.deepEqual(Object.keys(report).sort(), ["claims", "graveyard_matches", "idea_text", "objections", "overlap_band", "scores", "search"]);
  assert.ok(report.claims.every(c => c.status === "unverified"));
  const traceId = res.headers.get("X-VistaDex-Trace-Id");
  assert.ok(store._traces.has(traceId));
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(res.headers.get("X-VistaDex-Mode"), "mock");
});

test("POST /screen with keys: Mistral for quality stages, status computed from 2 domains, approval dropped", async () => {
  const { fetchImpl, calls } = fakeUpstream();
  const env = { ...ENV, GROQ_API_KEY: "g", MISTRAL_API_KEY: "m", TINYFISH_API_KEY: "t" };
  const store = memoryStore();
  const res = await handle(req("POST", "/screen", { body: { idea_text: IDEA } }), env, { store, fetchImpl });
  const report = await res.json();
  assert.deepEqual(validateContract(report), []);
  assert.equal(report.claims[0].status, "contradicted");
  assert.equal(res.headers.get("X-VistaDex-Mode"), "live");
  assert.deepEqual(report.claims[0].source_urls, ["https://www.harvey.ai/product", "https://robin.ai/review"]);
  assert.ok(report.objections.some(o => o.objection.startsWith("Harvey and Robin")));
  assert.ok(!report.objections.some(o => /should proceed/.test(o.objection)), "approval filtered");
  const models = calls.filter(c => c.model).map(c => c.model);
  assert.ok(models.includes("mistral-small-latest") && models.includes("mistral-medium-latest"));
  const trace = JSON.parse(store._traces.get(res.headers.get("X-VistaDex-Trace-Id")).trace);
  for (const kind of ["search", "fetch", "judgment", "classified", "graveyard_scores", "objection", "objection_dropped", "llm_call"]) {
    assert.ok(trace.events.some(e => e.kind === kind), `trace has ${kind}`);
  }
});

test("provider fallback: Mistral down → Groq used, recorded in trace", async () => {
  const { fetchImpl } = fakeUpstream();
  const flaky = async (url, init) => (String(url).includes("mistral.ai") ? new Response("down", { status: 503 }) : fetchImpl(url, init));
  const env = { ...ENV, GROQ_API_KEY: "g", MISTRAL_API_KEY: "m", TINYFISH_API_KEY: "t" };
  const store = memoryStore();
  const res = await handle(req("POST", "/screen", { body: { idea_text: IDEA } }), env, { store, fetchImpl: flaky });
  const report = await res.json();
  assert.equal(report.claims[0].status, "contradicted");
  const trace = JSON.parse(store._traces.get(res.headers.get("X-VistaDex-Trace-Id")).trace);
  assert.ok(trace.events.some(e => e.kind === "llm_fallback" && e.provider === "mistral" && e.status === 503));
  assert.ok(trace.events.some(e => e.kind === "llm_call" && e.provider === "groq"));
});

test("responses never contain the API keys", async () => {
  const { fetchImpl } = fakeUpstream({ groqStatus: 401 });
  const env = { ...ENV, GROQ_API_KEY: "gsk_SECRET123", MISTRAL_API_KEY: "mst_SECRET456", TINYFISH_API_KEY: "tf_SECRET789" };
  const res = await handle(req("POST", "/screen", { body: { idea_text: IDEA } }), env, { store: memoryStore(), fetchImpl });
  const text = await res.text();
  assert.ok(!/SECRET/.test(text));
  assert.ok(![...res.headers.values()].some(v => /SECRET/.test(v)));
});

test("CORS: unknown origins are refused, preflight allowed for known ones", async () => {
  const bad = await handle(req("POST", "/screen", { body: { idea_text: IDEA }, origin: "https://evil.example" }), ENV, { store: memoryStore() });
  assert.equal(bad.status, 403);
  const pre = await handle(req("OPTIONS", "/events"), ENV, { store: memoryStore() });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get("Access-Control-Allow-Methods"), /DELETE/);
});

test("input limits", async () => {
  const store = memoryStore();
  assert.equal((await handle(req("POST", "/screen", { body: { idea_text: "" } }), ENV, { store })).status, 400);
  assert.equal((await handle(req("POST", "/screen", { body: { idea_text: "x".repeat(7000) } }), ENV, { store })).status, 413);
  assert.equal((await handle(req("POST", "/screen", { body: "not json" }), ENV, { store })).status, 400);
});

const ev = (seq, type = "claim_rating") => ({ session_id: SID, seq, ts: "2026-10-20T10:00:00.000Z", type, study_version: "v", payload: { run_id: "r1" } });

test("POST /events stores idempotently; withdraw deletes events + linked traces and blocks late uploads", async () => {
  const store = memoryStore();
  await store.saveTrace("trace-1", "live", { events: [] }, "now");
  const completed = { ...ev(2, "run_completed"), payload: { run_id: "r1", trace_id: "trace-1" } };
  const body = JSON.stringify({ session_id: SID, events: [ev(1), completed] });
  let res = await handle(req("POST", "/events", { body, headers: { "Content-Type": "text/plain" } }), ENV, { store });
  assert.deepEqual(await res.json(), { stored: 2, received: 2 });
  res = await handle(req("POST", "/events", { body }), ENV, { store });
  assert.deepEqual(await res.json(), { stored: 0, received: 2 }, "retry is a no-op");

  res = await handle(req("DELETE", `/session/${SID}`), ENV, { store });
  assert.deepEqual(await res.json(), { withdrawn: true, deleted: { events: 2, traces: 1 } });
  assert.equal(store._events.size, 0);
  assert.equal(store._traces.size, 0);
  res = await handle(req("POST", "/events", { body }), ENV, { store });
  assert.equal(res.status, 410);
});

test("POST /events rejects malformed batches", async () => {
  const store = memoryStore();
  const bad = [
    { session_id: "not-a-uuid", events: [ev(1)] },
    { session_id: SID, events: [] },
    { session_id: SID, events: [{ ...ev(1), session_id: "22222222-2222-4333-8444-555555555555" }] },
    { session_id: SID, events: [{ ...ev(1), type: "DROP TABLE" }] },
  ];
  for (const b of bad) assert.equal((await handle(req("POST", "/events", { body: b }), ENV, { store })).status, 400);
});

test("GET /export requires the token and returns JSON or CSV", async () => {
  const store = memoryStore();
  await handle(req("POST", "/events", { body: { session_id: SID, events: [ev(1), ev(2)] } }), ENV, { store });
  assert.equal((await handle(req("GET", "/export", { origin: null }), ENV, { store })).status, 401);
  assert.equal((await handle(req("GET", "/export", { origin: null, headers: { Authorization: "Bearer wrong" } }), ENV, { store })).status, 401);
  const auth = { Authorization: "Bearer test-token" };
  const rows = await (await handle(req("GET", "/export", { origin: null, headers: auth }), ENV, { store })).json();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].payload, { run_id: "r1" });
  const csv = await (await handle(req("GET", "/export?format=csv", { origin: null, headers: auth }), ENV, { store })).text();
  assert.match(csv.split("\n")[0], /^session_id,seq,ts,type,study_version,payload,received_at$/);
  assert.equal(csv.split("\n").length, 3);
});

test("export is disabled when no EXPORT_TOKEN is configured", async () => {
  const res = await handle(req("GET", "/export", { origin: null, headers: { Authorization: "Bearer " } }), { ...ENV, EXPORT_TOKEN: "" }, { store: memoryStore() });
  assert.equal(res.status, 401);
});

test("POST /screen accepts the structured input and keeps it on the report", async () => {
  const body = { title: "LegalAI", pitch: "AI contract review for startups", problem: "Contract review is slow and expensive.", solution: "No tool combines AI contract review with human lawyer oversight.", moat: "", industries: ["AI/ML", "Nope"], role: "founder", markets: ["EU"] };
  const res = await handle(req("POST", "/screen", { body }), ENV, { store: memoryStore() });
  assert.equal(res.status, 200);
  const report = await res.json();
  assert.deepEqual(validateContract(report), []);
  assert.equal(report.input.title, "LegalAI");
  assert.deepEqual(report.input.industries, ["AI/ML"]);
  assert.match(report.idea_text, /^LegalAI\. AI contract review for startups\. /);
  assert.equal(report.sample_fields, undefined, "the server never adds sample data");
});

test("POST /screen structured input: required fields and per-field limits", async () => {
  const missing = await handle(req("POST", "/screen", { body: { title: "T", pitch: "", problem: "p", solution: "" } }), ENV, { store: memoryStore() });
  assert.equal(missing.status, 400);
  assert.deepEqual((await missing.json()).fields, ["pitch", "solution"]);
  const long = await handle(req("POST", "/screen", { body: { title: "T", pitch: "x".repeat(281), problem: "p", solution: "s" } }), ENV, { store: memoryStore() });
  assert.equal(long.status, 413);
  assert.deepEqual((await long.json()).fields, ["pitch"]);
});
