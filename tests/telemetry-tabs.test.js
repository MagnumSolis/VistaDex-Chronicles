// Two tabs of one browser share one telemetry session (one localStorage record). D1 keeps only the
// first event per (session_id, seq), so two tabs must never send the same seq, and neither tab may
// overwrite the other's stored state (unsent events, a withdrawal).
// Each tab is a separate instance of telemetry.js (a different module URL) over one shared storage.
import "./setup/network-guard.js";
import { test, before } from "node:test";
import assert from "node:assert/strict";

const KEY = "vistadex.study.v1";
const store = new Map();
const uploaded = []; // every event the stub proxy received
before(async () => {
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.addEventListener ??= () => {};
  const { CONFIG } = await import("../prototype/config.js");
  CONFIG.PROXY_URL = "https://proxy.test";
  globalThis.fetch = async (url, init = {}) => {
    if (init.method === "POST") uploaded.push(...JSON.parse(init.body).events);
    return { ok: true, status: 200 };
  };
});
const openTab = name => import(`../prototype/ui/telemetry.js?tab=${name}`);
const stored = () => JSON.parse(localStorage.getItem(KEY));

test("two tabs in one session never send the same seq, and D1 keeps every event", async () => {
  const a = await openTab("a1");
  a.giveConsent();
  a.log("control_pressed", { control: "a1" });
  a.log("control_pressed", { control: "a2" });
  const b = await openTab("b1"); // opened after consent: same session
  b.log("control_pressed", { control: "b1" });
  a.log("control_pressed", { control: "a3" });
  b.log("control_pressed", { control: "b2" });
  a.log("control_pressed", { control: "a4" });

  const all = [...a.events(), ...b.events()];
  assert.equal(new Set(all.map(e => e.session_id)).size, 1, "one session");
  // Tab B adopted A's unsent events at load (re-sending them is harmless), so the same event can
  // appear twice; what must never happen is one seq for two different events.
  const bySeq = new Map();
  for (const e of all) {
    const prev = bySeq.get(e.seq);
    assert.ok(!prev || JSON.stringify(prev) === JSON.stringify(e), `seq ${e.seq} used for two different events`);
    bySeq.set(e.seq, e);
  }
  assert.equal(bySeq.size, 7, "seven distinct events");
  for (const e of all) assert.ok(Number.isSafeInteger(e.seq) && e.seq > 0, "seq is a positive safe integer (Worker check)");
  for (const tab of [a, b]) {
    const seqs = tab.events().map(e => e.seq);
    assert.deepEqual(seqs, [...seqs].sort((x, y) => x - y), "seq increases within a tab");
  }

  // What D1 keeps: the first event per (session_id, seq).
  await a.flush(); await b.flush();
  const kept = new Map();
  for (const e of uploaded) if (!kept.has(`${e.session_id}:${e.seq}`)) kept.set(`${e.session_id}:${e.seq}`, e);
  assert.deepEqual([...kept.values()].map(e => e.payload.control ?? e.type).sort(), ["a1", "a2", "a3", "a4", "b1", "b2", "consent_given"]);
});

test("neither tab overwrites the other's unsent events in storage", async () => {
  const a = await openTab("a2");
  a.giveConsent();
  const b = await openTab("b2");
  a.log("control_pressed", { control: "a" });
  b.log("control_pressed", { control: "b" });
  a.log("control_pressed", { control: "a" });
  const queued = stored().events.map(e => e.payload.control ?? e.type).sort();
  assert.deepEqual(queued, ["a", "a", "b", "consent_given"], "a reload of either tab can still send all of them");
});

test("a withdrawal in one tab is not undone by the other tab", async () => {
  const a = await openTab("a3");
  a.giveConsent();
  const b = await openTab("b3");
  b.log("control_pressed", { control: "b" });
  await a.withdraw();
  assert.equal(b.log("control_pressed", { control: "after" }), null, "the other tab stops recording");
  assert.equal(stored().consent, "declined");
  assert.equal(stored().session_id, null);
  uploaded.length = 0;
  await b.flush();
  assert.equal(uploaded.length, 0, "nothing of the withdrawn session is uploaded");
});

test("a tab that has not answered the notice does not start recording because another tab did", async () => {
  store.clear();
  const a = await openTab("a4");
  const b = await openTab("b4");
  a.giveConsent();
  assert.equal(b.log("control_pressed", { control: "b" }), null);
  assert.equal(stored().events.length, 1, "only tab A's consent_given is queued");
});
