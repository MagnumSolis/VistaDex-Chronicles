// Guarded even when run directly (node --test tests/telemetry.test.js): no request may leave localhost.
import "./setup/network-guard.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";

// Minimal browser stand-ins: telemetry.js only needs storage, crypto and listeners.
// The proxy is a stub on a reserved host: prototype/config.js points at the production Worker, which
// these tests reached (DELETE /session) until 2026-10-21. Requests are recorded, never sent.
const sent = [];
before(async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.addEventListener ??= () => {};
  const { CONFIG } = await import("../prototype/config.js");
  CONFIG.PROXY_URL = "https://proxy.test";
  globalThis.fetch = async (url, init = {}) => { sent.push({ url: String(url), method: init.method ?? "GET" }); return { ok: true, status: 200 }; };
});

test("nothing is logged before or after declining consent", async () => {
  const tm = await import("../prototype/ui/telemetry.js");
  assert.equal(tm.log("run_started", {}), null);
  tm.declineConsent();
  assert.equal(tm.log("run_started", {}), null);
  assert.equal(tm.events().length, 0);
  assert.equal(tm.sessionId(), null);
});

test("after consent, events carry an anonymous session id and no identity fields", async () => {
  const tm = await import("../prototype/ui/telemetry.js");
  tm.giveConsent();
  tm.log("claim_rating", { run_id: "r1", claim_index: 0, rating: "agree" });
  const ev = tm.events();
  assert.deepEqual(ev.map(e => e.type), ["consent_given", "claim_rating"]);
  assert.match(ev[0].session_id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(Object.keys(ev[1]).sort(), ["payload", "seq", "session_id", "study_version", "ts", "type"]);
  assert.ok(!JSON.stringify(ev).match(/user_?agent|"ip"|email|name"/i));
});

test("withdraw wipes local data and stops logging", async () => {
  const tm = await import("../prototype/ui/telemetry.js");
  const id = tm.sessionId();
  sent.length = 0;
  const res = await tm.withdraw();
  // The (stubbed) server is asked to delete exactly this session, and nothing else is sent.
  assert.equal(res.server, "deleted");
  assert.deepEqual(sent, [{ url: `https://proxy.test/session/${id}`, method: "DELETE" }]);
  assert.equal(tm.events().length, 0);
  assert.equal(tm.log("run_started", {}), null);
});

test("CSV export escapes quotes, commas and newlines", async () => {
  const { toCSV } = await import("../prototype/ui/telemetry.js");
  const csv = toCSV([{ session_id: "s", seq: 1, ts: "t", type: "survey_submitted", study_version: "v", payload: { comments: 'a, "b"\nc' } }]);
  const [header, row] = csv.split(/\n(?=s,)/);
  assert.equal(header, "session_id,seq,ts,type,study_version,payload");
  assert.equal(row, String.raw`s,1,t,survey_submitted,v,"{""comments"":""a, \""b\""\nc""}"`);
});

test("stored consent only counts for the study version it was given under", async () => {
  const { readStored } = await import("../prototype/ui/telemetry.js");
  const { STUDY_VERSION } = await import("../prototype/ui/study-config.js");
  const old = { session_id: "s", consent: "given", consent_at: "t", seq: 1, sent: 0, events: [{ type: "consent_given" }] };
  assert.equal(readStored(JSON.stringify(old)).consent, null, "pilot-1 record without consent_version is discarded");
  assert.equal(readStored(JSON.stringify({ ...old, consent_version: "2026-10-pilot-1" })).consent, null, "older version discarded");
  assert.equal(readStored(JSON.stringify({ ...old, consent: "declined", consent_version: "2026-10-pilot-1" })).consent, null, "an old decline is asked again too");
  const current = readStored(JSON.stringify({ ...old, consent_version: STUDY_VERSION }));
  assert.equal(current.consent, "given");
  assert.equal(current.events.length, 1);
  assert.equal(readStored("not json").consent, null);
  assert.equal(readStored(null).consent, null);
});

test("giving or declining consent records the current study version", async () => {
  const tm = await import("../prototype/ui/telemetry.js");
  const { STUDY_VERSION } = await import("../prototype/ui/study-config.js");
  tm.declineConsent();
  assert.equal(JSON.parse(localStorage.getItem("vistadex.study.v1")).consent_version, STUDY_VERSION);
  tm.giveConsent();
  assert.equal(JSON.parse(localStorage.getItem("vistadex.study.v1")).consent_version, STUDY_VERSION);
  await tm.withdraw();
});
