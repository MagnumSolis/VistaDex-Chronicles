import { test, before } from "node:test";
import assert from "node:assert/strict";

before(() => {
  const store = new Map();
  globalThis.sessionStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
});

const fakeLocation = (pathname, search, hash) => ({ pathname, search, hash });
const fakeHistory = () => ({ state: null, calls: [], replaceState(state, _t, url) { this.calls.push(url); } });

test("reads #code= from the fragment, stores it for the tab, scrubs the address bar", async () => {
  const { captureAccessCode, getAccessCode } = await import("../prototype/ui/access.js");
  const hist = fakeHistory();
  const code = captureAccessCode(fakeLocation("/VistaDex-Chronicles/", "", "#code=K7Q2-MX9P"), hist);
  assert.equal(code, "K7Q2-MX9P");
  assert.equal(getAccessCode(), "K7Q2-MX9P");
  assert.deepEqual(hist.calls, ["/VistaDex-Chronicles/"], "code removed from the URL");
});

test("keeps other fragment parts and query; without a code the stored one is kept", async () => {
  const { captureAccessCode, getAccessCode } = await import("../prototype/ui/access.js");
  const hist = fakeHistory();
  captureAccessCode(fakeLocation("/app/", "?demo=1", "#code=NEW-CODE&x=1"), hist);
  assert.deepEqual(hist.calls, ["/app/?demo=1#x=1"]);
  captureAccessCode(fakeLocation("/app/", "", ""), fakeHistory());
  assert.equal(getAccessCode(), "NEW-CODE");
});

test("refusal messages are plain language", async () => {
  const { refusalMessage } = await import("../prototype/ui/access.js");
  assert.match(refusalMessage(401, {}), /missing its access code/);
  assert.match(refusalMessage(429, { error: "daily_cap" }), /paused for today/);
  assert.match(refusalMessage(429, { error: "rate_limited" }), /wait a minute/);
  assert.equal(refusalMessage(500, {}), null);
});
