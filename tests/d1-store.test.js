// Runs the Worker's D1 store against real SQLite (node:sqlite) through a minimal D1-shaped shim,
// so the SQL itself is tested — not only the in-memory stand-in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { d1Store } from "../worker/src/store.js";

function d1(db) {
  const statement = (sql, args = []) => ({
    bind: (...a) => statement(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: sql => statement(sql), batch: async stmts => { const out = []; for (const s of stmts) out.push(await s.run()); return out; } };
}

function freshStore() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../worker/schema.sql", import.meta.url), "utf8"));
  return d1Store(d1(db));
}

test("D1 daily counter: atomic increment up to the cap, per UTC day", async () => {
  const store = freshStore();
  const takes = [];
  for (let i = 0; i < 4; i++) takes.push(await store.takeDailyScreen("2026-10-20", 3));
  assert.deepEqual(takes.map(t => t.allowed), [true, true, true, false]);
  assert.deepEqual(takes.map(t => t.count), [1, 2, 3, 3]);
  assert.equal((await store.takeDailyScreen("2026-10-21", 3)).allowed, true);
});

test("D1 events: idempotent save, withdraw deletes events and linked traces", async () => {
  const store = freshStore();
  const sid = "11111111-2222-4333-8444-555555555555";
  await store.saveTrace("trace-1", "live", { events: [] }, "now");
  const events = [
    { seq: 1, ts: "t", type: "claim_rating", study_version: "v", payload: { run_id: "r1" } },
    { seq: 2, ts: "t", type: "run_completed", study_version: "v", payload: { run_id: "r1", trace_id: "trace-1" } },
  ];
  assert.equal(await store.saveEvents(sid, events, "now"), 2);
  assert.equal(await store.saveEvents(sid, events, "now"), 0, "retry is a no-op");
  assert.equal(await store.isWithdrawn(sid), false);
  assert.deepEqual(await store.deleteSession(sid, "now"), { events: 2, traces: 1 });
  assert.equal(await store.isWithdrawn(sid), true);
  assert.equal((await store.exportEvents()).length, 0);
  assert.equal((await store.exportTraces()).length, 0);
});
