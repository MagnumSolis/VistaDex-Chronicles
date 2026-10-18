import { test, before } from "node:test";
import assert from "node:assert/strict";

// Minimal browser stand-ins: telemetry.js only needs storage, crypto and listeners.
before(() => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.addEventListener ??= () => {};
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
  const res = await tm.withdraw();
  assert.equal(res.server, "not-configured");
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
