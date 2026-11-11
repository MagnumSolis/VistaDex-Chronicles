import { test, before } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../worker/src/index.js";
import { memoryStore } from "../worker/src/store.js";

const ORIGIN = "http://localhost:5173";
const CODE = "K7Q2-MX9P";
const SID = "11111111-2222-4333-8444-555555555555";
const BASE_ENV = { ALLOWED_ORIGINS: ORIGIN, EXPORT_TOKEN: "t" };
const LOCKED = { ...BASE_ENV, ACCESS_REQUIRED: "true", ACCESS_CODES: `${CODE}, OTHER-CODE` };

const req = (method, path, { body, headers = {}, ip = "203.0.113.7" } = {}) =>
  new Request(`https://proxy.test${path}`, {
    method,
    headers: { Origin: ORIGIN, "CF-Connecting-IP": ip, ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const screen = (env, store, headers = {}, opts = {}) =>
  handle(req("POST", "/screen", { body: { idea_text: "The legal-tech market is worth $27B globally." }, headers, ...opts }), env, { store, ...opts.handle });
const ev = seq => ({ session_id: SID, seq, ts: "2026-10-20T10:00:00.000Z", type: "claim_rating", study_version: "v", payload: { run_id: "r1" } });

// ── access code ──
test("/screen: missing or wrong access code → 401, right code → 200", async () => {
  const store = memoryStore();
  const none = await screen(LOCKED, store);
  assert.equal(none.status, 401);
  assert.equal((await none.json()).error, "access_code_required");
  assert.equal(none.headers.get("Access-Control-Allow-Origin"), ORIGIN, "401 is readable by the browser");
  assert.equal((await screen(LOCKED, store, { "X-VistaDex-Access": "WRONG" })).status, 401);
  assert.equal((await screen(LOCKED, store, { "X-VistaDex-Access": CODE })).status, 200);
  assert.equal((await screen(LOCKED, store, { "X-VistaDex-Access": "OTHER-CODE" })).status, 200, "any configured code works");
});

test("/events: access code in the body; it is not stored with the events", async () => {
  const store = memoryStore();
  const post = body => handle(req("POST", "/events", { body }), LOCKED, { store });
  assert.equal((await post({ session_id: SID, events: [ev(1)] })).status, 401);
  assert.equal((await post({ session_id: SID, events: [ev(1)], access_code: "WRONG" })).status, 401);
  const ok = await post({ session_id: SID, events: [ev(1)], access_code: CODE });
  assert.equal(ok.status, 200);
  const rows = await store.exportEvents();
  assert.equal(rows.length, 1);
  assert.ok(!JSON.stringify(rows).includes(CODE), "access code never stored");
});

test("withdraw works without an access code", async () => {
  const store = memoryStore();
  await handle(req("POST", "/events", { body: { session_id: SID, events: [ev(1)], access_code: CODE } }), LOCKED, { store });
  const res = await handle(req("DELETE", `/session/${SID}`), LOCKED, { store });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).deleted.events, 1);
});

test("required but no codes configured → 503 (fails closed)", async () => {
  const res = await screen({ ...BASE_ENV, ACCESS_REQUIRED: "true" }, memoryStore(), { "X-VistaDex-Access": CODE });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "misconfigured");
});

test("not required and no codes → open (local dev)", async () => {
  assert.equal((await screen(BASE_ENV, memoryStore())).status, 200);
});

test("CORS preflight allows the access-code header", async () => {
  const res = await handle(new Request("https://proxy.test/screen", { method: "OPTIONS", headers: { Origin: ORIGIN } }), LOCKED, { store: memoryStore() });
  assert.match(res.headers.get("Access-Control-Allow-Headers"), /X-VistaDex-Access/);
});

// ── rate limits ──
function fakeLimiter(allowPerKey) {
  const seen = new Map();
  return {
    keys: seen,
    async limit({ key }) { const n = (seen.get(key) || 0) + 1; seen.set(key, n); return { success: n <= allowPerKey }; },
  };
}

test("/screen rate limit per IP → 429 with Retry-After; other IPs unaffected", async () => {
  const SCREEN_LIMITER = fakeLimiter(2);
  const env = { ...LOCKED, SCREEN_LIMITER };
  const store = memoryStore();
  const h = { "X-VistaDex-Access": CODE };
  assert.equal((await screen(env, store, h)).status, 200);
  assert.equal((await screen(env, store, h)).status, 200);
  const limited = await screen(env, store, h);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error, "rate_limited");
  assert.equal(limited.headers.get("Retry-After"), "60");
  assert.equal((await screen(env, store, h, { ip: "198.51.100.9" })).status, 200, "different IP has its own budget");
  assert.deepEqual([...SCREEN_LIMITER.keys.keys()], ["203.0.113.7", "198.51.100.9"]);
});

test("/events uses its own limiter", async () => {
  const env = { ...LOCKED, SCREEN_LIMITER: fakeLimiter(0), EVENTS_LIMITER: fakeLimiter(1) };
  const store = memoryStore();
  const post = seq => handle(req("POST", "/events", { body: { session_id: SID, events: [ev(seq)], access_code: CODE } }), env, { store });
  assert.equal((await post(1)).status, 200);
  assert.equal((await post(2)).status, 429);
});

test("wrong access code is refused before the rate limiter counts it", async () => {
  const SCREEN_LIMITER = fakeLimiter(10);
  await screen({ ...LOCKED, SCREEN_LIMITER }, memoryStore(), { "X-VistaDex-Access": "WRONG" });
  assert.equal(SCREEN_LIMITER.keys.size, 0);
});

// ── daily cap ──
test("daily cap → 429 'study is paused for today'; resets the next UTC day", async () => {
  const store = memoryStore();
  let clock = "2026-10-20T09:00:00.000Z";
  const env = { ...LOCKED, SCREEN_DAILY_CAP: "2" };
  // A different idea each time: the same idea would be served from the report cache without using the cap.
  let n = 0;
  const run = () => handle(req("POST", "/screen", { body: { idea_text: "The legal-tech market is worth " + (27 + ++n) + " billion dollars globally." }, headers: { "X-VistaDex-Access": CODE } }), env, { store, now: () => clock });
  assert.equal((await run()).status, 200);
  assert.equal((await run()).status, 200);
  const paused = await run();
  assert.equal(paused.status, 429);
  const body = await paused.json();
  assert.equal(body.error, "daily_cap");
  assert.match(body.message, /paused for today/);
  assert.equal(paused.headers.get("Retry-After"), String(15 * 3600), "seconds until 00:00 UTC");
  clock = "2026-10-21T00:00:01.000Z";
  assert.equal((await run()).status, 200, "new UTC day");
});

test("malformed requests do not use up the daily cap", async () => {
  const store = memoryStore();
  const env = { ...LOCKED, SCREEN_DAILY_CAP: "1" };
  const bad = await handle(req("POST", "/screen", { body: { idea_text: "" }, headers: { "X-VistaDex-Access": CODE } }), env, { store });
  assert.equal(bad.status, 400);
  assert.equal((await screen(env, store, { "X-VistaDex-Access": CODE })).status, 200);
});

test("a screening that fails gives its daily-cap slot back", async () => {
  const store = memoryStore();
  const env = { ...LOCKED, SCREEN_DAILY_CAP: "1" };
  const broken = { saveTrace: async () => { throw new Error("storage down"); } };
  const failing = await handle(req("POST", "/screen", { body: { idea_text: "The legal-tech market is worth $27B globally." }, headers: { "X-VistaDex-Access": CODE } }), env, { store: { ...store, ...broken } });
  assert.equal(failing.status, 500);
  assert.equal((await screen(env, store, { "X-VistaDex-Access": CODE })).status, 200, "the failed run did not use the only slot");
});

test("wrangler.toml limits one visitor to a few screenings a minute", async () => {
  const { readFileSync } = await import("node:fs");
  const toml = readFileSync(new URL("../worker/wrangler.toml", import.meta.url), "utf8");
  const limit = Number(/name = "SCREEN_LIMITER"[^[]*limit = (\d+)/.exec(toml)[1]);
  assert.ok(limit <= 5, `SCREEN_LIMITER allows ${limit} a minute`);
});
