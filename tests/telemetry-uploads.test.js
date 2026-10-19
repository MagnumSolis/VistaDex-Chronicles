import { test, before } from "node:test";
import assert from "node:assert/strict";

// Browser stand-ins; a fake proxy that records uploads.
const uploads = [];
before(async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.addEventListener ??= () => {};
  globalThis.fetch = async (url, init) => { uploads.push({ url, body: JSON.parse(init.body) }); return { ok: true }; };
  const { CONFIG } = await import("../prototype/config.js");
  CONFIG.PROXY_URL = "https://proxy.test";
});

test("uploads are batched: at most MAX_BATCH events per request, the rest in the next request", async () => {
  const tm = await import("../prototype/ui/telemetry.js");
  tm.giveConsent();
  for (let i = 0; i < tm.MAX_BATCH + 50; i++) tm.log("control_pressed", { control: "run_screening", screen: "screen" });
  uploads.length = 0;
  await tm.flush();
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].body.events.length, tm.MAX_BATCH);
  await tm.flush();
  assert.equal(uploads[1].body.events.length, 51); // the rest, including consent_given
  assert.ok(tm.FLUSH_DELAY_MS >= 10000, "no more than ~6 requests a minute while events arrive");
});

test("feedback is sent under a new random id, not the usage session", async () => {
  const tm = await import("../prototype/ui/telemetry.js");
  uploads.length = 0;
  const res = await tm.sendUnlinked("feedback_submitted", { role: "founder", email: "a@b.c" });
  assert.equal(res, "sent");
  const { body } = uploads[0];
  assert.notEqual(body.session_id, tm.sessionId());
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].session_id, body.session_id);
  assert.equal(body.events[0].type, "feedback_submitted");
  assert.ok(!tm.events().some(e => e.type === "feedback_submitted"), "never stored with the usage events");
});

test("disable() stops logging and uploads, including events left unsent", async () => {
  const tm = await import("../prototype/ui/telemetry.js");
  tm.log("control_pressed", { control: "nav_screen", screen: "screen" }); // unsent
  tm.disable();
  uploads.length = 0;
  assert.equal(tm.log("run_started", {}), null);
  await tm.flush();
  await tm.flush({ beacon: true });
  assert.equal(await tm.sendUnlinked("feedback_submitted", {}), "disabled");
  assert.deepEqual(uploads, []);
});
