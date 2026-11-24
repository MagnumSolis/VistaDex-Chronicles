// The study's chatbot vs VistaDex pairs in the database (study-18): /events keeps one study_comparisons row
// per study participant (the pasted answer, the report snapshot, the full report from the cache, the
// preferences); researchers export it side by side; withdrawal deletes it; it can be rebuilt from events.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { handle } from "../worker/src/index.js";
import { d1Store, memoryStore } from "../worker/src/store.js";
import { comparisonFields } from "../worker/src/comparisons.js";

const ORIGIN = "http://localhost:5173";
const ENV = { ALLOWED_ORIGINS: ORIGIN, EXPORT_TOKEN: "tok" };
const P07 = "11111111-2222-4333-8444-000000000007";
const FIELD = "11111111-2222-4333-8444-0000000000f1";
const TEST1 = "11111111-2222-4333-8444-0000000000a1";
const req = (method, path, { body, headers = {}, origin = ORIGIN } = {}) => new Request(`https://proxy.test${path}`, {
  method, headers: { ...(origin ? { Origin: origin } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
const auth = { Authorization: "Bearer tok" };

const REPORT = { score: 52, sources: 3, domains: 2, sample_fields: [], claims: [{ claim: "The market is $4.2B", type: "market_size", status: "disputed", urls: ["https://a.com/1"] }],
  competitors: [{ name: "Levels", url: "https://levels.com" }], graveyard: [], objections: [{ objection: "Clinics may not pay.", severity: "medium" }], big_tech: null, legal: null, market: null };
let seq = 0;
const ev = (sid, type, payload) => ({ session_id: sid, seq: ++seq, ts: `2026-11-24T10:00:${String(seq).padStart(2, "0")}Z`, type, study_version: "2026-11-study-18", payload });
const post = (store, sid, events) => handle(req("POST", "/events", { body: { session_id: sid, events } }), ENV, { store });

async function participant(store, sid, code, { traceId = "trace-7" } = {}) {
  // As the app sends them: registration, then later batches with the chatbot answer, the report, the preferences.
  await post(store, sid, [ev(sid, "consent_given", { study_version: "x" }), ev(sid, "participant_registered", { code, role: null, track: "study", source: "direct" })]);
  await post(store, sid, [ev(sid, "condition_started", { condition: "baseline", idea_key: "A", order_position: 1 }),
    ev(sid, "chatbot_answer", { run_id: "b_1", tool: "Claude", model: "free plan", web_search: "yes", chars: 40, text: "Levels already does this. The $4.2B figure is unclear." })]);
  await post(store, sid, [ev(sid, "vistadex_report_snapshot", { run_id: "r_1", idea_key: "A", trace_id: traceId, report: REPORT })]);
  await post(store, sid, [ev(sid, "tool_preference", { overall: "vistadex", accuracy: "vistadex", evidence: "vistadex", risks: "same", honesty: "chatbot", decision: "vistadex", options_order: "chatbot_first", why: "sources" })]);
}

test("comparisonFields: the latest of each record wins; a field-track registration makes no row", () => {
  const f = comparisonFields([
    { type: "participant_registered", payload: { code: "p07", track: "study" }, study_version: "v" },
    { type: "chatbot_answer", ts: "t1", payload: { run_id: "b1", tool: "ChatGPT", text: "first" } },
    { type: "chatbot_answer", ts: "t2", payload: { run_id: "b2", tool: "Claude", text: "second" } },
  ]);
  assert.equal(f.code, "P07");
  assert.equal(f.chatbot_text, "second");
  assert.equal(f.chatbot_tool, "Claude");
  assert.equal(comparisonFields([{ type: "participant_registered", payload: { code: "", track: "field" } }]).code, undefined);
});

test("/events builds one row per study participant, with the full report from the cache; none for field visitors", async () => {
  const store = memoryStore();
  await store.putCached("key-a", { title: "A", report: JSON.stringify({ claims: [{ claim: "full" }], idea_text: "x" }), trace_id: "trace-7", created_at: "2026-11-24T09:00:00Z" });
  await participant(store, P07, "p07");
  await post(store, FIELD, [ev(FIELD, "participant_registered", { code: "", role: null, track: "field", source: "linkedin" }),
    ev(FIELD, "run_completed", { run_id: "r", trace_id: null, mode: "live", duration_ms: 1, counts: {} })]);
  const rows = await store.exportComparisons();
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.code, "P07");
  assert.equal(r.idea_key, "A");
  assert.equal(r.chatbot_tool, "Claude");
  assert.match(r.chatbot_text, /Levels already does this/);
  assert.equal(JSON.parse(r.report_snapshot).score, 52);
  assert.equal(JSON.parse(r.report_full).claims[0].claim, "full");
  assert.equal(JSON.parse(r.preference).overall, "vistadex");
  assert.equal(r.study_version, "2026-11-study-18");
});

test("export: CSV and JSON side by side, TEST codes only on request, the full report with full=1", async () => {
  const store = memoryStore();
  await participant(store, P07, "P07");
  await participant(store, TEST1, "TEST01");
  assert.equal((await handle(req("GET", "/export?table=comparisons", { origin: null }), ENV, { store })).status, 401);
  const csv = await (await handle(req("GET", "/export?table=comparisons&format=csv", { origin: null, headers: auth }), ENV, { store })).text();
  const lines = csv.split("\n");
  assert.ok(lines[0].startsWith("code,session_id,idea_key"));
  assert.ok(lines[0].includes("chatbot_text") && lines[0].includes("report_text") && lines[0].includes("pref_overall"));
  assert.match(csv, /\[disputed\] The market is \$4\.2B/, "the report as readable text next to the answer");
  assert.ok(!csv.includes("TEST01"));
  const withTest = await (await handle(req("GET", "/export?table=comparisons&include_test=1", { origin: null, headers: auth }), ENV, { store })).json();
  assert.deepEqual(withTest.map(r => r.code).sort(), ["P07", "TEST01"]);
  assert.equal(withTest[0].report_snapshot, undefined);
  const full = await (await handle(req("GET", "/export?table=comparisons&full=1", { origin: null, headers: auth }), ENV, { store })).json();
  assert.equal(full[0].report_snapshot.claims[0].status, "disputed");
});

test("withdrawal deletes the row; rebuild recreates every row from the events", async () => {
  const store = memoryStore();
  await participant(store, P07, "P07");
  await participant(store, TEST1, "TEST01");
  await store.clearComparisons();
  const res = await handle(req("POST", "/research/comparisons/rebuild", { origin: null, headers: { Cookie: "vdx_research=tok" } }), ENV, { store });
  assert.deepEqual(await res.json(), { ok: true, rows: 2 });
  assert.equal((await handle(req("POST", "/research/comparisons/rebuild", { origin: null }), ENV, { store })).status, 401);
  await handle(req("DELETE", `/session/${P07}`), ENV, { store });
  assert.deepEqual((await store.exportComparisons()).map(r => r.code), ["TEST01"]);
});

test("D1 SQL: partial upserts keep earlier columns, the cache supplies the full report, withdrawal and retention delete", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../worker/schema.sql", import.meta.url), "utf8"));
  const statement = (sql, args = []) => ({
    bind: (...a) => statement(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  const store = d1Store({ prepare: sql => statement(sql), batch: async stmts => { const out = []; for (const s of stmts) out.push(await s.run()); return out; } });
  await store.putCached("key-a", { title: "A", report: '{"claims":[]}', trace_id: "trace-7", created_at: "2026-11-24T09:00:00Z" });
  await participant(store, P07, "P07");
  const [row] = await store.exportComparisons();
  assert.equal(row.code, "P07");
  assert.match(row.chatbot_text, /Levels/);
  assert.equal(row.report_full, '{"claims":[]}');
  assert.equal(JSON.parse(row.preference).why, "sources");
  assert.equal(await store.studyCodeOf(P07), "P07");
  await store.deleteSession(P07, "2026-11-24T11:00:00Z");
  assert.equal((await store.exportComparisons()).length, 0);
  await participant(store, TEST1, "TEST01");
  await store.purgeOlderThan("2999-01-01T00:00:00Z");
  assert.equal((await store.exportComparisons()).length, 0);
});

test("console: the database exports, the rebuild button and the row check are wired", async () => {
  const { RESEARCH_PAGE } = await import("../worker/src/research-page.js");
  assert.match(RESEARCH_PAGE, /href="\/export\?table=comparisons&amp;format=csv"/);
  assert.match(RESEARCH_PAGE, /href="\/export\?table=comparisons&amp;full=1"/);
  assert.match(RESEARCH_PAGE, /id="cmpRebuild"/);
  assert.match(RESEARCH_PAGE, /\/research\/comparisons\/rebuild/);
  assert.match(RESEARCH_PAGE, /checkComparisonTable\(C\)/);
  assert.match(RESEARCH_PAGE, /id="incTest2"/, "pilot runs (TEST codes) can be shown in Chatbot vs VistaDex too");
});
