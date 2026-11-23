// A study participant's pasted chatbot answer can make an upload larger than the 64 KB browsers allow for
// keepalive requests and beacons. Such an upload must still go (as a normal request), never block the queue.
// And startOver() (a new participant at the same browser) uploads what is queued, then forgets the session.
import { test, before } from "node:test";
import assert from "node:assert/strict";

const uploads = [];
before(async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.addEventListener ??= () => {};
  // As in browsers: a keepalive request over 64 KB is refused.
  globalThis.fetch = async (url, init) => {
    if (init.keepalive && new Blob([init.body]).size > 65536) throw new TypeError("keepalive body too large");
    uploads.push({ url, keepalive: init.keepalive, body: JSON.parse(init.body) });
    return { ok: true };
  };
  const { CONFIG } = await import("../prototype/config.js");
  CONFIG.PROXY_URL = "https://proxy.test";
});

test("an upload over 64 KB goes as a normal request; small ones keep keepalive", async () => {
  const tm = await import("../prototype/ui/telemetry.js");
  tm.giveConsent();
  await tm.flush();
  assert.equal(uploads.at(-1).keepalive, true);
  tm.log("chatbot_answer", { run_id: "b_1", tool: "Claude", model: "", web_search: null, chars: 30000, text: "é".repeat(30000) });
  await tm.flush();
  const last = uploads.at(-1);
  assert.equal(last.keepalive, false);
  assert.equal(last.body.events[0].type, "chatbot_answer");
  uploads.length = 0;
  await tm.flush();
  assert.equal(uploads.length, 0, "nothing left queued");
});

test("startOver uploads what is queued, then forgets the notice answer and the session", async () => {
  const tm = await import("../prototype/ui/telemetry.js");
  const old = tm.sessionId();
  tm.log("control_pressed", { control: "study_new_participant", screen: "study" });
  uploads.length = 0;
  await tm.startOver();
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].body.session_id, old);
  assert.equal(tm.consentStatus(), null);
  assert.equal(tm.sessionId(), null);
  assert.equal(tm.log("control_pressed", {}), null, "nothing is recorded until the next person answers the notice");
  tm.giveConsent();
  assert.notEqual(tm.sessionId(), old);
});
