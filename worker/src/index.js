// ── VistaDex proxy — Cloudflare Worker ──
// Holds the provider keys (Worker secrets) so they never reach the browser.
//   POST   /screen          { idea_text } → POST /screen contract; X-VistaDex-Trace-Id / X-VistaDex-Mode headers
//                           needs the study access code in the X-VistaDex-Access header
//   POST   /events          { session_id, events[], access_code } → stored in D1 (consented study telemetry)
//   DELETE /session/:id     withdraw: deletes the session's events and traces (no access code needed —
//                           withdrawing must always work; the random session id protects it)
//   GET    /export          researchers only (Authorization: Bearer EXPORT_TOKEN); ?table=events|traces&format=json|csv
// Runs the same core pipeline as the browser. With no keys set it serves the
// deterministic mock path. The client IP (CF-Connecting-IP) is read only as the rate-limiter key;
// it is never stored, logged or traced. User-agent headers are not read.
//
// Abuse controls (see docs/DEPLOY.md): a shared access code (ACCESS_CODES secret, enforced when
// ACCESS_REQUIRED="true"), per-IP rate limits (SCREEN_LIMITER, EVENTS_LIMITER bindings) and a
// global daily cap on /screen (SCREEN_DAILY_CAP, counted in D1).

import { runScreen } from "../../prototype/core/pipeline.js";
import { routesFromEnv } from "../../prototype/core/providers/llm.js";
import { retrievalFromEnv } from "../../prototype/core/providers/retrieval.js";
import { GRAVEYARD_DB } from "../../prototype/data/graveyard.js";
import { d1Store } from "./store.js";

const MAX_IDEA_CHARS = 6000;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_EVENTS_PER_BATCH = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default {
  fetch(request, env) {
    return handle(request, env, { store: d1Store(env.DB) });
  },
};

export async function handle(request, env, { store, fetchImpl, now = () => new Date().toISOString() }) {
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin, env);
  if (request.method === "OPTIONS") return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
  // Browsers from other origins are refused; non-browser callers (no Origin) only reach /export.
  const url = new URL(request.url);
  const isExport = url.pathname === "/export";
  if (!isExport && origin && !cors) return json({ error: "origin not allowed" }, 403);

  try {
    if (request.method === "POST" && url.pathname === "/screen") return await screen(request, env, { store, fetchImpl, now, cors });
    if (request.method === "POST" && url.pathname === "/events") return await saveEvents(request, env, { store, now, cors });
    const del = url.pathname.match(/^\/session\/([^/]+)$/);
    if (request.method === "DELETE" && del) return await withdraw(decodeURIComponent(del[1]), { store, now, cors });
    if (request.method === "GET" && isExport) return await exportData(request, url, env, { store });
    return json({ error: "not found" }, 404, cors);
  } catch (err) {
    // Never echo provider responses (they can contain key fragments); log a short message only.
    console.error("vistadex-proxy error:", err?.message?.slice(0, 200));
    return json({ error: "internal error" }, 500, cors);
  }
}

async function screen(request, env, { store, fetchImpl, now, cors }) {
  const denied = checkAccess(env, request.headers.get("X-VistaDex-Access"), cors)
    || await rateLimited(env.SCREEN_LIMITER, request, cors);
  if (denied) return denied;
  const body = await readJSON(request);
  const ideaText = typeof body?.idea_text === "string" ? body.idea_text.trim() : "";
  if (!ideaText) return json({ error: "idea_text is required" }, 400, cors);
  if (ideaText.length > MAX_IDEA_CHARS) return json({ error: `idea_text is longer than ${MAX_IDEA_CHARS} characters` }, 413, cors);

  // Global daily cap, counted after validation so malformed requests don't use it up.
  const cap = Number(env.SCREEN_DAILY_CAP || 0);
  if (cap > 0) {
    const stamp = now();
    const { allowed } = await store.takeDailyScreen(stamp.slice(0, 10), cap);
    if (!allowed) {
      return json({ error: "daily_cap", message: "The study is paused for today. Please try again tomorrow." }, 429,
        { ...cors, "Retry-After": String(secondsUntilUtcMidnight(stamp)) });
    }
  }

  const llmRoutes = routesFromEnv(env, fetchImpl);
  const retrieval = retrievalFromEnv(env, fetchImpl);
  const live = Object.values(llmRoutes).some(chain => chain.length) || retrieval.name !== "mock";
  const { report, trace } = await runScreen(ideaText, { mode: live ? "live" : "mock", llmRoutes, retrieval, graveyard: GRAVEYARD_DB });
  await store.saveTrace(trace.trace_id, trace.mode, trace, now());
  return json(report, 200, {
    ...cors,
    "X-VistaDex-Trace-Id": trace.trace_id,
    "X-VistaDex-Mode": trace.mode, // "live" only when at least one provider key is set
    "Access-Control-Expose-Headers": "X-VistaDex-Trace-Id, X-VistaDex-Mode",
  });
}

async function saveEvents(request, env, { store, now, cors }) {
  const body = await readJSON(request);
  // The code comes in the body (beacons cannot set headers); it is not stored with the events.
  const denied = checkAccess(env, body?.access_code, cors) || await rateLimited(env.EVENTS_LIMITER, request, cors);
  if (denied) return denied;
  const id = body?.session_id;
  if (typeof id !== "string" || !UUID.test(id)) return json({ error: "invalid session_id" }, 400, cors);
  if (await store.isWithdrawn(id)) return json({ error: "session withdrawn" }, 410, cors);
  const list = Array.isArray(body.events) ? body.events : [];
  if (!list.length || list.length > MAX_EVENTS_PER_BATCH) return json({ error: `send 1–${MAX_EVENTS_PER_BATCH} events` }, 400, cors);
  for (const e of list) {
    const ok = e && e.session_id === id && Number.isInteger(e.seq) && e.seq > 0
      && typeof e.ts === "string" && typeof e.type === "string" && /^[a-z_]{1,64}$/.test(e.type);
    if (!ok) return json({ error: "malformed event" }, 400, cors);
  }
  const stored = await store.saveEvents(id, list.map(e => ({ seq: e.seq, ts: e.ts, type: e.type, study_version: e.study_version, payload: e.payload })), now());
  return json({ stored, received: list.length }, 200, cors);
}

async function withdraw(id, { store, now, cors }) {
  if (!UUID.test(id)) return json({ error: "invalid session_id" }, 400, cors);
  const deleted = await store.deleteSession(id, now());
  return json({ withdrawn: true, deleted }, 200, cors);
}

async function exportData(request, url, env, { store }) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.EXPORT_TOKEN || !timingSafeEqual(auth, `Bearer ${env.EXPORT_TOKEN}`)) return json({ error: "unauthorized" }, 401);
  const table = url.searchParams.get("table") === "traces" ? "traces" : "events";
  const rows = table === "traces" ? await store.exportTraces() : await store.exportEvents();
  if (url.searchParams.get("format") === "csv") {
    return new Response(toCSV(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vistadex-${table}.csv"` } });
  }
  return json(rows.map(r => ({ ...r, ...(r.payload ? { payload: parse(r.payload) } : {}), ...(r.trace ? { trace: parse(r.trace) } : {}) })), 200);
}

// ── access code, rate limits, daily cap ──
// Enforced when ACCESS_REQUIRED is "true" (set in wrangler.toml) or when codes are configured.
// Required but no codes configured → 503, so a forgotten secret fails closed, not open.
function checkAccess(env, code, cors) {
  const codes = String(env.ACCESS_CODES || "").split(",").map(c => c.trim()).filter(Boolean);
  const required = String(env.ACCESS_REQUIRED || "").toLowerCase() === "true" || codes.length > 0;
  if (!required) return null;
  if (!codes.length) return json({ error: "misconfigured", message: "Access codes are required but none are configured." }, 503, cors);
  if (typeof code === "string" && codes.some(c => timingSafeEqual(code.trim(), c))) return null;
  return json({ error: "access_code_required", message: "This study link is missing its access code." }, 401, cors);
}

// Workers Rate Limiting API binding ({ limit({ key }) → { success } }). Absent binding = no limit
// (local dev, tests). The IP is only the limiter key and is never stored or logged.
async function rateLimited(limiter, request, cors) {
  if (!limiter?.limit) return null;
  const key = request.headers.get("CF-Connecting-IP") || "unknown";
  const { success } = await limiter.limit({ key });
  return success ? null : json({ error: "rate_limited", message: "Too many requests. Please wait a minute and try again." }, 429, { ...cors, "Retry-After": "60" });
}

function secondsUntilUtcMidnight(isoNow) {
  const t = new Date(isoNow);
  const midnight = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1);
  return Math.max(1, Math.ceil((midnight - t.getTime()) / 1000));
}

// ── helpers ──
function corsHeaders(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-VistaDex-Access",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function readJSON(request) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...(headers || {}) } });
}

function parse(s) {
  try { return JSON.parse(s); } catch { return s; }
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function toCSV(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = v => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))].join("\n");
}
