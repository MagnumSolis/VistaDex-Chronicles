// worker/index.js — VistaDex API proxy on Cloudflare Workers.
// All LLM/retrieval calls happen here; the frontend never talks to Groq/Tavily.
// Keys arrive only via Worker secrets (`wrangler secret put NAME`).

import { chatWithFallback } from "./providers/llm.js";
import { tavilySearch } from "./providers/search.js";
import { EXTRACTION_PROMPT, CLASSIFY_PROMPT, OBJECTOR_PROMPT } from "./prompts/index.js";
import { matchGraveyard } from "./graveyard.js";

const GRAVEYARD_DB = [
  { id: "atrium", company_name: "Atrium", what_they_tried: "AI-powered legal services platform for startups, automating contract review and legal advice with human lawyer oversight", cause_of_death: "Unit economics — cost of human lawyer oversight made scaling impossible", year_closed: 2020 },
  { id: "sprig", company_name: "Sprig", what_they_tried: "On-demand healthy meal delivery, restaurant-quality food cooked fresh and delivered within 20 minutes in San Francisco", cause_of_death: "Unit economics — cost of food prep, chefs, and last-mile delivery made profitability impossible at scale", year_closed: 2017 },
  { id: "homejoy", company_name: "Homejoy", what_they_tried: "On-demand home cleaning marketplace connecting customers with independent cleaners, Uber-for-cleaning model", cause_of_death: "Regulation — worker misclassification lawsuits; cleaners demanded employee status", year_closed: 2015 },
  { id: "quibi", company_name: "Quibi", what_they_tried: "Short-form mobile video streaming platform with premium Hollywood productions designed for 5-10 minute watch sessions", cause_of_death: "Bad timing & product-market fit — launched during COVID lockdowns", year_closed: 2020 },
  { id: "juicero", company_name: "Juicero", what_they_tried: "WiFi-connected juicer for single-serve proprietary juice packs", cause_of_death: "Competition — packs could be squeezed by hand, eliminating the value proposition", year_closed: 2017 },
  { id: "theranos", company_name: "Theranos", what_they_tried: "Finger-prick blood testing platform claiming hundreds of lab tests from a single drop of blood", cause_of_death: "Fraud — technology didn't work as claimed; SEC and DOJ charges", year_closed: 2018 },
  { id: "vine", company_name: "Vine", what_they_tried: "Short-form looping video social platform — 6-second videos, creator-first", cause_of_death: "Competition — Twitter ownership starved it of resources as Instagram Stories grew", year_closed: 2017 },
  { id: "yik-yak", company_name: "Yik Yak", what_they_tried: "Anonymous hyperlocal social network for college campuses", cause_of_death: "Regulation & competition — cyberbullying pressure; anonymity removal killed the user base", year_closed: 2017 },
  { id: "rdio", company_name: "Rdio", what_they_tried: "Music streaming subscription service with clean design and social features", cause_of_death: "Competition — Spotify's catalogue deals and free tier made paid-only model unviable", year_closed: 2015 },
  { id: "meerkat", company_name: "Meerkat", what_they_tried: "Live-streaming app tied to Twitter", cause_of_death: "Competition — Twitter acquired Periscope and cut off Meerkat's social graph access", year_closed: 2016 },
  { id: "zirtual", company_name: "Zirtual", what_they_tried: "US-based virtual assistant service staffing real human assistants", cause_of_death: "Unit economics — cash burn from W2 employee model", year_closed: 2015 },
  { id: "washio", company_name: "Washio", what_they_tried: "On-demand laundry and dry-cleaning pickup/delivery app", cause_of_death: "Unit economics — last-mile logistics plus contractor wages made every order unprofitable", year_closed: 2016 },
  { id: "springpad", company_name: "Springpad", what_they_tried: "Visual bookmarking and knowledge management app — save anything, auto-enriched", cause_of_death: "Competition — Evernote and Pinterest dominated; failed to reach sustainable scale", year_closed: 2014 },
  { id: "google-plus", company_name: "Google+", what_they_tried: "Google's social networking platform competing with Facebook", cause_of_death: "Competition — Facebook's network effects proved insurmountable", year_closed: 2019 },
  { id: "daqri", company_name: "DAQRI", what_they_tried: "Enterprise augmented reality smart helmet for industrial workers", cause_of_death: "Timing — industrial AR market didn't mature; hardware costs too high", year_closed: 2019 },
  { id: "jawbone", company_name: "Jawbone", what_they_tried: "Wearable fitness trackers and Bluetooth speakers — early wristband health tracking leader", cause_of_death: "Competition — Apple Watch and Fitbit destroyed the market", year_closed: 2017 },
  { id: "circa", company_name: "Circa", what_they_tried: "Mobile-first news summarization app delivering structured, bite-sized news atoms", cause_of_death: "Bad timing — Facebook Instant Articles and Apple News killed independent aggregators", year_closed: 2015 },
  { id: "brightroll", company_name: "BrightRoll", what_they_tried: "Video advertising exchange for programmatic video ad buying", cause_of_death: "Pivot — successful acquisition pivot; bought by Yahoo for $640M", year_closed: 2014 },
  { id: "shyp", company_name: "Shyp", what_they_tried: "On-demand package pickup and shipping service", cause_of_death: "Unit economics — courier labor plus carrier fees; expanded too fast", year_closed: 2018 },
  { id: "timehop", company_name: "Timehop", what_they_tried: "Daily memory resurfacing app — your social media posts from years ago", cause_of_death: "Competition — Facebook, Snapchat, Google Photos shipped native 'memories'", year_closed: 2021 },
];

// Same-origin only: the frontend is served by this same Worker. Cross-origin
// callers get no CORS headers. (Flip to a specific origin if the UI ever
// moves to a different host.)
const CORS = {
  "access-control-allow-origin": "https://vistadex.vistadex-team.workers.dev",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "vary": "origin",
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });

// ── Basic per-session rate limiting (in-memory; per-isolate) ──
const rateBuckets = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;
function rateLimited(sessionId) {
  const now = Date.now();
  const b = rateBuckets.get(sessionId) || { count: 0, start: now };
  if (now - b.start > RATE_WINDOW_MS) { b.count = 0; b.start = now; }
  b.count++;
  rateBuckets.set(sessionId, b);
  return b.count > RATE_LIMIT;
}

function safeJsonParse(text, fallback) {
  try {
    const cleaned = text.replace(/^```(json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

// ── Stage 1: claim extraction — {"claims": [...]} per json_object contract ──
async function stageExtractClaims(env, ideaText) {
  let provider = "unknown", content = "";
  let parsed = { claims: [] };
  // One retry on empty/malformed extraction before the screen fails — extraction
  // is the one stage with no downstream salvage if it returns nothing.
  for (let attempt = 0; attempt < 2 && (!Array.isArray(parsed.claims) || parsed.claims.length === 0); attempt++) {
    const r = await chatWithFallback(env, {
      system: EXTRACTION_PROMPT,
      user: `Idea:\n"""\n${ideaText.slice(0, 4000)}\n"""`,
      json: true,
    });
    provider = r.provider;
    content = r.content;
    parsed = safeJsonParse(content, { claims: [] });
  }
  const claims = (Array.isArray(parsed.claims) ? parsed.claims : [])
    .filter(c => c && typeof c.claim === "string" && c.claim.trim().length > 0)
    .slice(0, 8)
    .map(c => ({
      claim: c.claim.trim(),
      type: ["novelty", "market_size", "defensibility", "other"].includes(c.type) ? c.type : "other",
    }));
  return { provider, claims };
}

// ── Stage 2: Tavily retrieval per claim + LLM classification against snippets ──
// Claims verify in PARALLEL (Promise.all); each claim isolates its own errors:
// any failure degrades that claim to "unverified" — abstain, never crash the screen.
const BLOCKED_CITATIONS = ["linkedin.com", "facebook.com", "x.com", "twitter.com", "instagram.com", "threads.net", "tiktok.com", "reddit.com"];
const isAllowedCitation = u => {
  try {
    const h = new URL(u).hostname.replace(/^www\./, "");
    return !BLOCKED_CITATIONS.some(d => h === d || h.endsWith("." + d));
  } catch { return false; }
};

async function verifyOneClaim(env, claim) {
  let evidence = [];
  try {
    evidence = await tavilySearch(env, { query: claim.claim.slice(0, 300), maxResults: 5 });
  } catch {
    evidence = []; // search failure → unverified, not an error
  }
  const numbered = evidence
    .map((e, i) => `[${i}] ${e.title} (${e.url}):\n${String(e.snippet || "").slice(0, 400)}`)
    .join("\n\n");
  try {
    const { provider, content } = await chatWithFallback(env, {
      system: CLASSIFY_PROMPT,
      user: `Claim: "${claim.claim}"\n\nEvidence snippets:\n${numbered || "(no evidence retrieved)"}`,
      json: true,
    });
    const parsed = safeJsonParse(content, { status: "unverified", reasoning: "", source_indices: [] });
    const status = ["confirmed", "contradicted", "disputed", "unverified"].includes(parsed.status) ? parsed.status : "unverified";
    // Cite ONLY real retrieved URLs, by index — never model-invented ones.
    // ToS-restricted platforms excluded from citations per AGENTS.md rule 1.
    const sources = (parsed.source_indices || [])
      .map(i => evidence[Number(i)]?.url)
      .filter(u => u && isAllowedCitation(u))
      .slice(0, 5);
    return { ...claim, status, reasoning: parsed.reasoning || "", sources, provider, evidence_count: evidence.length };
  } catch (e) {
    // Per-claim isolation: one bad classification never kills the screen.
    return { ...claim, status: "unverified", reasoning: "Verification failed for this claim (" + String(e && e.message || e).slice(0, 120) + "). Treated as unverified per the honesty contract.", sources: [], provider: "none", evidence_count: evidence.length };
  }
}

async function stageVerifyClaims(env, claims) {
  return Promise.all(claims.map(c => verifyOneClaim(env, c)));
}

// ── Stage 3: graveyard matching (stopgap cosine over local DB; Atlas later) ──
function stageGraveyard(ideaText) {
  return matchGraveyard(ideaText, GRAVEYARD_DB, { topK: 3, minSimilarity: 0.18 });
}

// ── Stage 4: Objector pass — may only argue AGAINST the conclusion ──
async function stageObjector(env, ideaText, claims, graveyardMatches) {
  const claimSummary = claims.map(c => `- [${c.status}] (${c.type}) ${c.claim.slice(0, 200)}`).join("\n");
  const graveyardSummary = graveyardMatches.length
    ? graveyardMatches.map(g => `- ${g.company_name} (${g.year_closed}, ${g.similarity}% similar): ${String(g.what_they_tried || "").slice(0, 200)}`).join("\n")
    : "(no graveyard matches)";
  const { provider, content } = await chatWithFallback(env, {
    system: OBJECTOR_PROMPT,
    user: `Idea:\n"""\n${ideaText.slice(0, 3000)}\n"""\n\nScreening conclusion the system reached:\n${claimSummary.slice(0, 2400)}\n\nGraveyard matches:\n${graveyardSummary.slice(0, 1200)}`,
    json: true,
  }, { preferObjector: true });
  const parsed = safeJsonParse(content, { objections: [] });
  const objections = (Array.isArray(parsed.objections) ? parsed.objections : [])
    .filter(o => o && typeof o.objection === "string" && o.objection.trim())
    .slice(0, 4)
    .map(o => ({
      objection: o.objection.trim(),
      severity: ["high", "medium", "low"].includes(o.severity) ? o.severity : "medium",
    }));
  return { provider, objections };
}

// Fix #4: contract validation — the response the UI consumes is enforced here,
// not trusted from the LLM chain. Invalid shapes are normalized, never propagated.
function validateScreenResult(result) {
  const claims = (Array.isArray(result?.claims) ? result.claims : []).map(c => ({
    claim: String(c.claim || "").slice(0, 1000),
    type: ["novelty", "market_size", "defensibility", "other"].includes(c.type) ? c.type : "other",
    status: ["confirmed", "contradicted", "disputed", "unverified"].includes(c.status) ? c.status : "unverified",
    reasoning: String(c.reasoning || "").slice(0, 2000),
    sources: (Array.isArray(c.sources) ? c.sources : []).filter(u => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 6),
  }));
  const graveyard_matches = (Array.isArray(result?.graveyard_matches) ? result.graveyard_matches : []).map(g => ({
    company_name: String(g.company_name || "").slice(0, 200),
    what_they_tried: String(g.what_they_tried || "").slice(0, 1000),
    cause_of_death: String(g.cause_of_death || g.failure_reason || "").slice(0, 1000),
    year_closed: Number(g.year_closed) || null,
    similarity: Math.max(0, Math.min(100, Number(g.similarity) || 0)),
  }));
  const objections = (Array.isArray(result?.objections) ? result.objections : []).map(o => ({
    objection: String(o.objection || "").slice(0, 1500),
    severity: ["high", "medium", "low"].includes(o.severity) ? o.severity : "medium",
  }));
  return { claims, graveyard_matches, objections };
}

async function handleScreen(env, ideaText, sessionId) {
  const trace = [];
  const t0 = Date.now();
  const mark = (stage, extra) => trace.push({ stage, ts: Date.now() - t0, ...extra });

  const s1 = await stageExtractClaims(env, ideaText);
  mark("extract", { provider: s1.provider, claims: s1.claims.length });
  if (s1.claims.length === 0) {
    return json({ ok: false, error: "no_claims_extracted", trace }, 200);
  }

  const claims = await stageVerifyClaims(env, s1.claims);
  mark("verify", { claims: claims.map(c => ({ status: c.status, evidence: c.evidence_count })) });

  const graveyardMatches = stageGraveyard(ideaText);
  mark("graveyard", { matches: graveyardMatches.map(m => ({ company: m.company_name, similarity: m.similarity })) });

  const s4 = await stageObjector(env, ideaText, claims, graveyardMatches);
  mark("objector", { provider: s4.provider, objections: s4.objections.length });

  return json({
    ok: true,
    // Unified output contract — identical shape to DEMO_MODE results, validated.
    result: validateScreenResult({ claims, graveyard_matches: graveyardMatches, objections: s4.objections }),
    trace,
  });
}

// ── Events ingestion: POST /api/events → Cloudflare D1 (EVENTS binding) ──
// Telemetry rules (Project Hub 19 Oct): every button press + time spent,
// 12-month retention, withdraw without auth, export token-protected.
async function handleEvents(env, payload) {
  try {
    await env.EVENTS.prepare(
      "INSERT INTO events (session_id, ts, event, payload, received_ts) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      String(payload.session_id).slice(0, 64),
      String(payload.ts).slice(0, 40),
      String(payload.event).slice(0, 64),
      JSON.stringify(payload.payload || {}),
      Date.now()
    ).run();
  } catch (e) {
    // Never fail the UX on telemetry errors — the client queues locally anyway.
  }
  return json({ ok: true });
}

// Also record pipeline runs (mode, counts, duration) for the analytics dashboard.
async function handleRunRecord(env, payload) {
  try {
    // Simple non-cryptographic idea hash — never store idea text.
    const ideaHash = String(payload.idea_hash || "");
    await env.EVENTS.prepare(
      "INSERT INTO runs (session_id, mode, idea_hash, claims_count, graveyard_count, objections_count, duration_ms, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      String(payload.session_id).slice(0, 64),
      String(payload.mode || "demo").slice(0, 16),
      ideaHash.slice(0, 64),
      Number(payload.claims_count) || 0,
      Number(payload.graveyard_count) || 0,
      Number(payload.objections_count) || 0,
      Number(payload.duration_ms) || 0,
      Date.now()
    ).run();
  } catch {}
  return json({ ok: true });
}

// ── Session withdraw: POST /api/session/withdraw (no access code needed) ──
async function handleWithdraw(env, sessionId) {
  try {
    // Soft-delete first (audit trail for research ethics), then hard delete.
    await env.EVENTS.prepare(
      "INSERT INTO withdrawn_sessions (session_id, withdrawn_ts) VALUES (?, ?)"
    ).bind(sessionId, Date.now()).run();
    await env.EVENTS.prepare("DELETE FROM events WHERE session_id = ?").bind(sessionId).run();
    await env.EVENTS.prepare("DELETE FROM runs WHERE session_id = ?").bind(sessionId).run();
  } catch {}
  return json({ ok: true, withdrawn: true });
}

// ── Graveyard browse: GET /api/graveyard (public, confirmed entries only) ──
// Serves from the exported snapshot (worker/data/graveyard.json) built by
// `backend npm run db:export` — Mongo stays the system of record; the edge
// serves the committed JSON so no database access is needed at runtime.
import graveyardData from "./data/graveyard.json" with { type: "json" };

async function handleGraveyard(env, url) {
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const cause = url.searchParams.get("cause") || "";
  const sector = url.searchParams.get("sector") || "";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Number(url.searchParams.get("limit")) || 50);

  let entries = graveyardData.count > 0 ? graveyardData.entries : GRAVEYARD_DB;
  if (q) entries = entries.filter(e =>
    e.company_name?.toLowerCase().includes(q) ||
    e.what_they_tried?.toLowerCase().includes(q));
  if (cause) entries = entries.filter(e => e.cause_category === cause);
  if (sector) entries = entries.filter(e => e.sector === sector);

  const total = entries.length;
  entries = entries.slice((page - 1) * limit, (page - 1) * limit + limit);
  return json({ ok: true, entries, total, page, limit, exported_at: graveyardData.exported_at || null });
}


// ── Export: GET /api/export?format=csv|json (researcher token protected) ──
function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
async function handleExport(env, request, url) {
  const auth = request.headers.get("authorization") || "";
  const cookieToken = (request.headers.get("cookie") || "").match(/vdx_admin=([^;]+)/)?.[1];
  const token = env.RESEARCHER_EXPORT_TOKEN;
  if (!token || (auth !== `Bearer ${token}` && cookieToken !== token)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const format = url.searchParams.get("format") || "json";
  const cutoff = Date.now() - 365 * 24 * 3600 * 1000; // 12-month retention window
  try {
    // Enforce retention on every export: delete rows older than the window.
    await env.EVENTS.prepare("DELETE FROM events WHERE received_ts < ?").bind(cutoff).run();
    await env.EVENTS.prepare("DELETE FROM runs WHERE created_ts < ?").bind(cutoff).run();
    const events = await env.EVENTS.prepare(
      "SELECT session_id, ts, event, payload, received_ts FROM events WHERE received_ts >= ? ORDER BY received_ts DESC"
    ).bind(cutoff).all();
    const runs = await env.EVENTS.prepare(
      "SELECT session_id, mode, idea_hash, claims_count, graveyard_count, objections_count, duration_ms, created_ts FROM runs WHERE created_ts >= ? ORDER BY created_ts DESC"
    ).bind(cutoff).all();
    if (format === "csv") {
      const rows = [["session_id", "ts", "event", "payload", "received_ts"].join(",")];
      for (const e of events.results || []) rows.push([csvEscape(e.session_id), csvEscape(e.ts), csvEscape(e.event), csvEscape(e.payload), e.received_ts].join(","));
      rows.push("");
      rows.push(["session_id", "mode", "idea_hash", "claims_count", "graveyard_count", "objections_count", "duration_ms", "created_ts"].join(","));
      for (const r of runs.results || []) rows.push([csvEscape(r.session_id), csvEscape(r.mode), csvEscape(r.idea_hash), r.claims_count, r.graveyard_count, r.objections_count, r.duration_ms, r.created_ts].join(","));
      return new Response(rows.join("\n"), { headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="vistadex_telemetry.csv"' } });
    }
    return json({ ok: true, events: events.results, runs: runs.results, exported_ts: Date.now() });
  } catch (e) {
    return json({ ok: false, error: "export_failed", detail: String(e) }, 500);
  }
}

// ── Admin analytics dashboard: GET /admin (token + login page) ──
async function handleAdmin(env, request, url) {
  const token = env.RESEARCHER_EXPORT_TOKEN;
  if (!token) return new Response("admin not configured", { status: 404 });
  const cookieToken = (request.headers.get("cookie") || "").match(/vdx_admin=([^;]+)/)?.[1];
  const authed = cookieToken === token || url.searchParams.get("t") === token;

  if (!authed) {
    // Login page (Basic-auth-style form, token-checked, non-obvious URL)
    return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>VistaDex · Research Console</title><meta name="robots" content="noindex">
<style>body{font-family:ui-monospace,monospace;background:#0A2622;color:#F5F1E8;display:grid;place-items:center;min-height:100vh;margin:0}.box{background:#10312B;border:1px solid rgba(234,226,210,.13);border-radius:14px;padding:34px;width:min(380px,90vw)}h1{font-size:15px;margin:0 0 6px}p{color:#A9B5AC;font-size:12.5px;margin:0 0 18px}input{width:100%;box-sizing:border-box;padding:11px;border-radius:9px;border:1px solid rgba(234,226,210,.2);background:#06201B;color:#F5F1E8;font-family:inherit;margin-bottom:14px}button{width:100%;padding:11px;border:none;border-radius:9px;background:linear-gradient(135deg,#FF6B1A,#FF9E4A);color:#1D0A00;font-weight:700;cursor:pointer}</style></head>
<body><form class="box" method="GET" action="/admin"><h1>VistaDex Research Console</h1><p>Restricted — team access only.</p><input type="password" name="t" placeholder="Access token" autofocus><button type="submit">Enter</button></form></body></html>`,
      { status: 200, headers: { "content-type": "text/html" } });
  }

  // Authed: analytics overview
  const cutoff = Date.now() - 365 * 24 * 3600 * 1000;
  const [sessions, total, byEvent, runs] = await Promise.all([
    env.EVENTS.prepare("SELECT COUNT(DISTINCT session_id) AS n FROM events WHERE received_ts >= ?").bind(cutoff).first(),
    env.EVENTS.prepare("SELECT COUNT(*) AS n FROM events WHERE received_ts >= ?").bind(cutoff).first(),
    env.EVENTS.prepare("SELECT event, COUNT(*) AS n FROM events WHERE received_ts >= ? GROUP BY event ORDER BY n DESC LIMIT 50").bind(cutoff).all(),
    env.EVENTS.prepare("SELECT mode, COUNT(*) AS n, AVG(duration_ms) AS avg_ms, AVG(claims_count) AS avg_claims FROM runs WHERE created_ts >= ? GROUP BY mode").bind(cutoff).all(),
  ]);

  const rows = (byEvent.results || []).map(r => `<tr><td>${r.event}</td><td>${r.n}</td></tr>`).join("");
  const runRows = (runs.results || []).map(r => `<tr><td>${r.mode}</td><td>${r.n}</td><td>${Math.round(r.avg_ms || 0)}ms</td><td>${(r.avg_claims || 0).toFixed(1)}</td></tr>`).join("");
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>VistaDex · Research Console</title>
<style>body{font-family:ui-monospace,monospace;background:#0A2622;color:#F5F1E8;margin:0;padding:40px}h1{font-size:18px}table{border-collapse:collapse;margin:18px 0 34px;width:100%;max-width:700px}td,th{border:1px solid rgba(234,226,210,.13);padding:8px 14px;font-size:13px;text-align:left}th{color:#A9B5AC;font-weight:600}.cards{display:flex;gap:14px;flex-wrap:wrap;margin:20px 0}.card{background:#10312B;border:1px solid rgba(234,226,210,.13);border-radius:12px;padding:18px 22px}.card b{font-size:26px;display:block}.card span{color:#A9B5AC;font-size:11px;letter-spacing:.08em}a{color:#FF9E4A}</style></head>
<body><h1>VistaDex Research Console</h1>
<div class="cards">
<div class="card"><b>${sessions?.n || 0}</b><span>SESSIONS (12MO)</span></div>
<div class="card"><b>${total?.n || 0}</b><span>EVENTS (12MO)</span></div>
</div>
<h2>Events by type</h2><table><tr><th>Event</th><th>Count</th></tr>${rows}</table>
<h2>Pipeline runs by mode</h2><table><tr><th>Mode</th><th>Runs</th><th>Avg duration</th><th>Avg claims</th></tr>${runRows}</table>
<p><a href="/api/export?format=csv">⬇ Download telemetry (CSV)</a> · <a href="/api/export?format=json">Download JSON</a></p>
</body></html>`,
    { status: 200, headers: { "content-type": "text/html", ...(authed && url.searchParams.get("t") === token ? { "set-cookie": `vdx_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400` } : {}) } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === "/api/screen" && request.method === "POST") {
      const { idea, session_id } = await request.json().catch(() => ({}));
      const ideaText = String(idea || "").trim();
      if (!ideaText || ideaText.length > 5000) return json({ ok: false, error: "invalid_idea" }, 400);
      if (!env.GROQ_API_KEY && !env.MISTRAL_API_KEY) return json({ ok: false, error: "no_llm_configured" }, 503);
      if (rateLimited(session_id || "anon")) return json({ ok: false, error: "rate_limited" }, 429);
      try {
        return await handleScreen(env, ideaText, session_id);
      } catch (e) {
        return json({ ok: false, error: "screen_failed", detail: String(e?.message || e) }, 500);
      }
    }

    if (url.pathname === "/api/events" && request.method === "POST") {
      const payload = await request.json().catch(() => null);
      if (!payload || typeof payload.session_id !== "string" || typeof payload.event !== "string") {
        return json({ ok: false, error: "invalid_event" }, 400);
      }
      return handleEvents(env, payload);
    }

    if (url.pathname === "/api/runs" && request.method === "POST") {
      const payload = await request.json().catch(() => null);
      if (!payload || typeof payload.session_id !== "string") {
        return json({ ok: false, error: "invalid_run" }, 400);
      }
      return handleRunRecord(env, payload);
    }

    if (url.pathname === "/admin" && request.method === "GET") {
      try {
        return await handleAdmin(env, request, url);
      } catch (e) {
        return json({ ok: false, error: "admin_failed", detail: String(e) }, 500);
      }
    }

    if (url.pathname === "/api/graveyard" && request.method === "GET") {
      try {
        return await handleGraveyard(env, url);
      } catch {
        return json({ ok: false, error: "graveyard_failed" }, 500);
      }
    }

    if (url.pathname === "/api/session/withdraw" && request.method === "POST") {
      const { session_id } = await request.json().catch(() => ({}));
      if (!session_id) return json({ ok: false, error: "invalid_session" }, 400);
      return handleWithdraw(env, session_id);
    }

    if (url.pathname === "/api/export" && request.method === "GET") {
      return handleExport(env, request, url);
    }

    if (url.pathname === "/api/health") return json({ ok: true, ts: Date.now() });

    return new Response("Not found", { status: 404 });
  },
};
