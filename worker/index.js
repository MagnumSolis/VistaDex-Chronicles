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

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
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
  const { provider, content } = await chatWithFallback(env, {
    system: EXTRACTION_PROMPT,
    user: `Idea:\n"""\n${ideaText}\n"""`,
    json: true,
  });
  const parsed = safeJsonParse(content, { claims: [] });
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
async function stageVerifyClaims(env, claims) {
  const results = [];
  for (const claim of claims) {
    const evidence = await tavilySearch(env, { query: claim.claim.slice(0, 300), maxResults: 5 })
      .catch(() => []);
    const numbered = evidence.map((e, i) => `[${i}] ${e.title} (${e.url}):\n${e.snippet}`).join("\n\n");
    const { provider, content } = await chatWithFallback(env, {
      system: CLASSIFY_PROMPT,
      user: `Claim: "${claim.claim}"\n\nEvidence snippets:\n${numbered || "(no evidence retrieved)"}`,
      json: true,
    });
    const parsed = safeJsonParse(content, { status: "unverified", reasoning: "", source_indices: [] });
    const status = ["confirmed", "contradicted", "disputed", "unverified"].includes(parsed.status) ? parsed.status : "unverified";
    // Cite ONLY real retrieved URLs, by index — never model-invented ones.
    const sources = (parsed.source_indices || [])
      .map(i => evidence[Number(i)]?.url)
      .filter(Boolean)
      .slice(0, 5);
    results.push({ ...claim, status, reasoning: parsed.reasoning || "", sources, provider, evidence_count: evidence.length });
  }
  return results;
}

// ── Stage 3: graveyard matching (stopgap cosine over local DB; Atlas later) ──
function stageGraveyard(ideaText) {
  return matchGraveyard(ideaText, GRAVEYARD_DB, { topK: 3, minSimilarity: 0.18 });
}

// ── Stage 4: Objector pass — may only argue AGAINST the conclusion ──
async function stageObjector(env, ideaText, claims, graveyardMatches) {
  const claimSummary = claims.map(c => `- [${c.status}] (${c.type}) ${c.claim}`).join("\n");
  const graveyardSummary = graveyardMatches.length
    ? graveyardMatches.map(g => `- ${g.company_name} (${g.year_closed}, ${g.similarity}% similar): ${g.what_they_tried}`).join("\n")
    : "(no graveyard matches)";
  const { provider, content } = await chatWithFallback(env, {
    system: OBJECTOR_PROMPT,
    user: `Idea:\n"""\n${ideaText}\n"""\n\nScreening conclusion the system reached:\n${claimSummary}\n\nGraveyard matches:\n${graveyardSummary}`,
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
    // Unified output contract — identical shape to DEMO_MODE results.
    result: { claims, graveyard_matches: graveyardMatches, objections: s4.objections },
    trace,
  });
}

// ── Events ingestion: POST /api/events → forward to sink (Mongo/Atlas or D1) ──
async function handleEvents(env, payload) {
  const body = { ...payload, received_ts: Date.now() };
  if (env.EVENTS_SINK_URL) {
    try {
      await fetch(env.EVENTS_SINK_URL, {
        method: "POST",
        headers: { "content-type": "application/json", ...(env.EVENTS_SINK_TOKEN ? { authorization: `Bearer ${env.EVENTS_SINK_TOKEN}` } : {}) },
        body: JSON.stringify(body),
      });
    } catch {
      // Never fail the UX on telemetry errors — the client queues locally anyway.
    }
  }
  return json({ ok: true });
}

// ── Graveyard browse: GET /api/graveyard (public, confirmed+verified only) ──
async function handleGraveyard(env, url) {
  if (env.MONGODB_DATA_API_URL && env.MONGODB_DATA_API_KEY) {
    const q = url.searchParams.get("q") || "";
    const cause = url.searchParams.get("cause") || "";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(50, Number(url.searchParams.get("limit")) || 50);
    const filter = { death_status: "confirmed", source_verified: true };
    if (q) filter.company_name = { $regex: q, $options: "i" };
    if (cause) filter.cause_category = cause;
    const res = await fetch(env.MONGODB_DATA_API_URL + "/action/find", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": env.MONGODB_DATA_API_KEY,
      },
      body: JSON.stringify({
        database: env.MONGODB_DB || "vistadex",
        collection: "graveyard",
        filter,
        sort: { year_closed: -1 },
        limit,
        skip: (page - 1) * limit,
      }),
    });
    if (!res.ok) return json({ ok: false, error: "graveyard_query_failed" }, 502);
    const data = await res.json();
    return json({ ok: true, entries: data.documents || [], page, limit });
  }
  // No Mongo configured: serve the local seed (key-free path stays green)
  return json({ ok: true, entries: GRAVEYARD_DB, page: 1, note: "local_seed" });
}

// ── Session withdraw: POST /api/session/withdraw (no access code needed) ──
async function handleWithdraw(env, sessionId) {
  if (env.EVENTS_SINK_URL) {
    try {
      await fetch(env.EVENTS_SINK_URL.replace(/\/+$/, "") + "/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch {}
  }
  return json({ ok: true, withdrawn: true });
}

// ── Export: GET /api/export (researcher token protected) ──
async function handleExport(env, request) {
  const auth = request.headers.get("authorization") || "";
  if (!env.RESEARCHER_EXPORT_TOKEN || auth !== `Bearer ${env.RESEARCHER_EXPORT_TOKEN}`) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (env.MONGODB_DATA_API_URL && env.MONGODB_DATA_API_KEY) {
    const res = await fetch(env.MONGODB_DATA_API_URL + "/action/find", {
      method: "POST",
      headers: { "content-type": "application/json", "api-key": env.MONGODB_DATA_API_KEY },
      body: JSON.stringify({
        database: env.MONGODB_DB || "vistadex",
        collection: "events",
        filter: {},
        limit: 10000,
      }),
    });
    if (!res.ok) return json({ ok: false, error: "export_failed" }, 502);
    const data = await res.json();
    return json({ ok: true, events: data.documents || [] });
  }
  return json({ ok: false, error: "no_sink_configured" }, 503);
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
      return handleExport(env, request);
    }

    if (url.pathname === "/api/health") return json({ ok: true, ts: Date.now() });

    return new Response("Not found", { status: 404 });
  },
};
