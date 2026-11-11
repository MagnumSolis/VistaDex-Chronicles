// Report cache and frozen reports (docs/LAUNCH-PLAN.md P0-7): the same input gets the same report.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle, cacheKey } from "../worker/src/index.js";
import { memoryStore } from "../worker/src/store.js";

const ORIGIN = "http://localhost:5173";
const env = { ALLOWED_ORIGINS: ORIGIN, EXPORT_TOKEN: "tok", SCREEN_DAILY_CAP: "1" };
const input = { title: "LegalAI", pitch: "AI contract review for startups", problem: "Contracts are slow to review.", solution: "An AI reviews them with a lawyer backstop.", moat: "", industries: [], role: null, markets: [] };
const screen = (store, body = input, now = "2026-11-12T10:00:00.000Z") => handle(new Request("https://proxy.test/screen", {
  method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify(body),
}), env, { store, now: () => now });
const console_ = (store, path, body) => handle(new Request(`https://proxy.test${path}`, {
  method: body ? "POST" : "GET", headers: { Cookie: "vdx_research=tok", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined,
}), env, { store });

test("the same input within 24 hours gets the stored report, without using the daily cap", async () => {
  const store = memoryStore();
  const a = await screen(store);
  assert.equal(a.headers.get("X-VistaDex-Cache"), "miss");
  const b = await screen(store, { ...input, title: "  LegalAI " }); // same input after normalising
  assert.equal(b.status, 200, "a cache hit is served although the cap (1) is used up");
  assert.equal(b.headers.get("X-VistaDex-Cache"), "hit");
  assert.deepEqual(await b.json(), await a.json());
  const later = await screen(store, input, "2026-11-13T11:00:00.000Z");
  assert.equal(later.headers.get("X-VistaDex-Cache"), "miss", "after 24 hours it runs again");
});

test("a different input is a different key; the report says when its evidence was gathered", async () => {
  assert.notEqual(await cacheKey(input), await cacheKey({ ...input, pitch: "Something else" }));
  assert.equal(await cacheKey(input), await cacheKey({ ...input, title: "LegalAI  " }));
  const store = memoryStore();
  const r = await (await screen(store)).json();
  assert.equal(r.generated_at, "2026-11-12T10:00:00.000Z");
});

test("the console lists cached reports and freezes one; a frozen report never expires", async () => {
  const store = memoryStore();
  await screen(store);
  const list = await (await console_(store, "/research/cache")).json();
  assert.equal(list.entries.length, 1);
  assert.equal(list.entries[0].title, "LegalAI");
  assert.equal((await console_(store, "/research/cache/freeze", { key: list.entries[0].key, frozen: true })).status, 200);
  const months = await screen(store, input, "2027-02-01T00:00:00.000Z");
  assert.equal(months.status, 200);
  assert.equal(months.headers.get("X-VistaDex-Cache"), "frozen");
  assert.equal((await handle(new Request("https://proxy.test/research/cache"), env, { store })).status, 401, "console only");
});

test("a run that is not recorded is never cached (the cached report holds the idea text)", async () => {
  const store = memoryStore();
  await handle(new Request("https://proxy.test/screen", { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json", "X-VistaDex-Record": "no" }, body: JSON.stringify(input) }), env, { store, now: () => "2026-11-12T10:00:00.000Z" });
  assert.equal((await store.listCached(10)).length, 0);
});
