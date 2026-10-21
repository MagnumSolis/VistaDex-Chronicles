// The network guard (tests/setup/network-guard.js) is active in every node test process. This file
// does not import it before the first test: if that test passes, the guard came from `node --import`
// in the npm test script. Only reserved hosts that cannot exist are used (.invalid, .test).
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

// The expected blocks below are cleared after each test, so they do not fail the run.
afterEach(async () => { (await import("./setup/network-guard.js")).takeBlocked(); }); // dynamic: test 1 must not load the guard itself

test("the guard is loaded by the test runner and blocks a non-localhost fetch", async t => {
  assert.equal(globalThis[Symbol.for("vistadex.networkGuard")], true, "guard not loaded: is `--import ./tests/setup/network-guard.js` in the test script?");
  await assert.rejects(fetch("https://guard-check.invalid/probe"), err => {
    assert.equal(err.name, "NetworkGuardError");
    t.diagnostic(err.message);
    assert.match(err.message, /https:\/\/guard-check\.invalid\/probe/);
    return true;
  });
  await assert.rejects(fetch(new URL("https://example.test/x"), { method: "DELETE" }), { name: "NetworkGuardError" });
});

test("localhost is allowed through the guard", async () => {
  const { assertLocal } = await import("./setup/network-guard.js");
  for (const url of ["http://localhost:8787/screen", "http://127.0.0.1:5173/", "http://[::1]:9/"]) assert.doesNotThrow(() => assertLocal(url, "fetch"));
  assert.throws(() => assertLocal("https://example.test/", "fetch"), { name: "NetworkGuardError" });
});

test("loading the guard twice does not wrap fetch twice", async () => {
  const before = globalThis.fetch;
  await import("./setup/network-guard.js?again");
  assert.equal(globalThis.fetch, before);
});
