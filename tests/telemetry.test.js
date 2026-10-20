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
  // With PROXY_URL configured the server is called (and a live proxy deletes the
  // session); with it empty the client reports "not-configured". Either way the
  // local store must be wiped and logging must stop.
  assert.ok(res.server === "not-configured" || res.server === "deleted", `unexpected server state: ${res.server}`);
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
