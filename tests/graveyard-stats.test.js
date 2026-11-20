// GET /graveyard/stats: the live graveyard's size for the Home counter (public, no study data).
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../worker/src/index.js";
import { memoryStore } from "../worker/src/store.js";
import snapshot from "../worker/data/graveyard.json" with { type: "json" };

const ORIGIN = "http://localhost:5173";
const get = (headers = {}) => handle(new Request("https://proxy.test/graveyard/stats", { headers }), { ALLOWED_ORIGINS: ORIGIN }, { store: memoryStore() });

test("returns the confirmed count and export time of the live snapshot, readable by the site", async () => {
  const res = await get({ Origin: ORIGIN });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.confirmed, snapshot.count);
  assert.equal(body.updated_at, snapshot.exported_at);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.match(res.headers.get("Cache-Control"), /max-age=\d+/);
  assert.deepEqual(Object.keys(body).sort(), ["confirmed", "updated_at"], "nothing else (no entries, no study data)");
});

test("a foreign origin is refused like every other public route", async () => {
  assert.equal((await get({ Origin: "https://evil.example" })).status, 403);
});
