// ── pipeline.js — 4-stage pipeline for VistaDex.
// DEMO_MODE selects the simulated pipeline vs the real serverless one (/api/screen).
// Both paths return the SAME output contract:
// { claims: [{claim,type,status,reasoning,sources}], graveyard_matches: [{company_name,what_they_tried,cause_of_death,year_closed,similarity}], objections: [{objection,severity}] }

const DEMO_MODE = (() => {
  const param = new URLSearchParams(location.search).get('demo');
  if (param === '1') return true;
  if (param === '0') return false;
  // auto: demo when no API backend is reachable-configured (kept simple: same-origin worker); user can force via ?demo=
  return window.DEMO_MODE_DEFAULT !== undefined ? window.DEMO_MODE_DEFAULT : false;
})();
window.DEMO_MODE = DEMO_MODE;

// ── Simulated pipeline stages ────────────────────────────────────────
// Stage 1: Claim Extraction (Groq llama-3.3-70b-versatile)
async function simulateClaimExtraction(ideaText) {
  await sleep(900 + rand(600));
  // Mock LLM output — in prod, this calls Groq API with EXTRACTION_PROMPT
  const keywords = ideaText.toLowerCase();
  const claims = [];

  if (keywords.includes("mental health") || keywords.includes("therapy") || keywords.includes("journal")) {
    claims.push(
      { claim: "No AI journaling app currently detects depression/anxiety risk and routes to therapists automatically", type: "novelty" },
      { claim: "The mental health app market is worth $5.8B globally, growing at 20% annually", type: "market_size" },
      { claim: "Existing apps (Calm, Headspace) only provide passive content — none proactively detect clinical risk", type: "novelty" },
      { claim: "The AI model trained on 50,000 therapy transcripts constitutes a defensible data moat", type: "defensibility" },
      { claim: "A $30/month price point is viable for active clinical monitoring with therapist routing", type: "other" }
    );
  } else if (keywords.includes("legal") || keywords.includes("contract")) {
    claims.push(
      { claim: "No AI legal tool combines LLM review with human lawyer backstop under $200/month", type: "novelty" },
      { claim: "Legal-tech market is worth $27B globally", type: "market_size" },
      { claim: "Big law firms cannot replicate this due to hourly billing cost structure", type: "defensibility" }
    );
  } else if (keywords.includes("delivery") || keywords.includes("logistics")) {
    claims.push(
      { claim: "Last-mile delivery costs 30% more in suburban areas than urban", type: "market_size" },
      { claim: "No existing software coordinates multi-operator drone fleets in shared airspace", type: "novelty" },
      { claim: "FAA BVLOS approval is achievable for small operators within 12 months", type: "defensibility" }
    );
  } else {
    // Generic extraction for arbitrary text
    const sentences = ideaText.split(/[.!?]+/).filter(s => s.trim().length > 30);
    const claimTypes = ["novelty", "market_size", "defensibility", "other"];
    claims.push(
      { claim: sentences[0]?.trim() || "The core product has no direct competitors in this market", type: "novelty" },
      { claim: sentences[1]?.trim() || "The addressable market exceeds $1B annually", type: "market_size" },
      { claim: sentences[2]?.trim() || "Proprietary data or technology provides a defensible moat", type: "defensibility" },
      { claim: "The business model is viable at the proposed price point", type: "other" }
    );
  }

  return claims;
}

// Stage 2: Live Retrieval + Classification (Tavily + Groq)
async function simulateLiveRetrieval(claims) {
  const results = [];
  for (const claim of claims) {
    await sleep(400 + rand(400));
    // Mock classification — in prod, Tavily fetches, Groq classifies
    const result = classifyClaim(claim);
    results.push(result);
  }
  return results;
}

function classifyClaim(claim) {
  const text = claim.claim.toLowerCase();
  let status, reasoning, sources;

  // Simulation logic based on claim type and content
  if (claim.type === "market_size") {
    status = "confirmed";
    reasoning = "Multiple independent market research reports (Grand View Research, Statista, IBIS World) corroborate the market size figure within a 15% margin. The growth rate is consistent across sources.";
    sources = ["grandviewresearch.com/industry-report", "statista.com/market-data", "ibisworld.com/forecast"];
  } else if (claim.type === "novelty") {
    if (/\b(no\s+(such|existing|current|direct|tool|one)|nobody|doesn'?t exist|does not exist)\b/i.test(text)) {
      status = Math.random() > 0.4 ? "contradicted" : "disputed";
      reasoning = status === "contradicted"
        ? "Web evidence reveals at least 2–3 existing products with significant market traction and funding that address this exact use case. The novelty claim is not supported."
        : "Evidence is mixed — some products approach this use case but none fully match the stated combination of features and price point. The claim is partially defensible.";
      sources = status === "contradicted"
        ? ["producthunt.com/search-results", "crunchbase.com/funding-rounds", "techcrunch.com/coverage"]
        : ["g2.com/category-comparison", "capterra.com/alternatives"];
    } else {
      status = "unverified";
      reasoning = "Insufficient public evidence to confirm or deny. Live retrieval returned general coverage but no direct competitor with equivalent positioning found in top 5 results.";
      sources = ["tavily-search/query-results"];
    }
  } else if (claim.type === "defensibility") {
    status = Math.random() > 0.5 ? "disputed" : "confirmed";
    reasoning = status === "disputed"
      ? "The moat argument has merit but is weakened by competitor entry. At least one well-funded incumbent has made progress in this direction since 2023."
      : "The structural barrier is real and documented. Independent analysts note this as a genuine friction point for larger players attempting to replicate.";
    sources = ["a16z.com/market-maps", "sequoia.com/investment-thesis", "investor-letters.com/sector-analysis"];
  } else {
    status = Math.random() > 0.5 ? "unverified" : "confirmed";
    reasoning = "Supporting evidence is available but limited. The claim is plausible given market context, though primary data is not publicly accessible.";
    sources = ["industry-report.com/pricing-benchmarks"];
  }

  return {
    ...claim,
    status,
    reasoning,
    sources
  };
}

// Stage 3: Graveyard Matching (MiniLM-L6-v2 + MongoDB Atlas)
async function simulateGraveyardMatching(ideaText) {
  await sleep(700 + rand(500));
  // Mock vector similarity search — in prod, encodes idea + searches Atlas
  const keywords = ideaText.toLowerCase();
  const matches = [];
  const threshold = 0.35;

  // Word-boundary regex rules — raw substring includes on short tokens
  // (e.g. "ar", "no ") caused false matches ("market".includes("ar")).
  const scoringRules = [
    { check: makeMatcher(["legal", "contract", "lawyer", "law firm"]), ids: ["atrium"], sim: () => 85 + rand(10) },
    { check: makeMatcher(["clean(ing)?", "laundry", "dry.?clean", "home service"]), ids: ["homejoy", "washio"], sim: () => 60 + rand(20) },
    { check: makeMatcher(["video", "stream", "short[- ]form", "reel"]), ids: ["vine", "meerkat"], sim: () => 50 + rand(20) },
    { check: makeMatcher(["food", "meal", "restaurant", "grocery"]), ids: ["sprig", "washio"], sim: () => 55 + rand(20) },
    { check: makeMatcher(["music", "audio", "podcast"]), ids: ["rdio"], sim: () => 60 + rand(15) },
    { check: makeMatcher(["\\bar\\b|augmented reality|smart helmet|wearable|fitness track"]), ids: ["daqri", "jawbone"], sim: () => 65 + rand(20) },
    { check: makeMatcher(["drone", "autonom(ous|omy)", "robot"]), ids: ["daqri"], sim: () => 45 + rand(20) },
    { check: makeMatcher(["social (network|media|app)", "community", "anonymous"]), ids: ["yik-yak", "google-plus"], sim: () => 55 + rand(20) },
    { check: makeMatcher(["journal", "note.?tak", "productivity", "knowledge", "bookmark"]), ids: ["springpad"], sim: () => 48 + rand(18) },
    { check: makeMatcher(["blood", "diagnostic", "clinical"]), ids: ["theranos"], sim: () => 42 + rand(20) },
    { check: makeMatcher(["mental health", "therap(y|ist)", "wellness", "mindfulness"]), ids: ["circa", "springpad"], sim: () => 38 + rand(20) },
    { check: makeMatcher(["workflow", "automation", "slack", "teams?"]), ids: ["springpad", "timehop"], sim: () => 40 + rand(20) },
    { check: makeMatcher(["carbon", "climate", "emission"]), ids: ["circa"], sim: () => 35 + rand(20) },
    { check: makeMatcher(["\\bship(ping)?\\b", "package", "courier"]), ids: ["shyp", "washio"], sim: () => 65 + rand(15) },
    { check: makeMatcher(["assistant", "virtual assistant", "secretar(y|ial)"]), ids: ["zirtual"], sim: () => 70 + rand(15) },
  ];

  for (const rule of scoringRules) {
    if (rule.check(keywords)) {
      for (const id of rule.ids) {
        const sim = rule.sim();
        if (sim / 100 > threshold && !matches.find(m => m.id === id)) {
          matches.push({ id, similarity: Math.min(sim, 98) });
        }
      }
    }
  }

  // Sort by similarity, return top 3
  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map(m => {
      const entry = GRAVEYARD_DB.find(g => g.id === m.id);
      return { ...entry, similarity: m.similarity };
    })
    .filter(Boolean);
}

// Stage 4: Objector Pass (Groq — argues AGAINST conclusion)
async function simulateObjectorPass(claims, graveyardMatches) {
  await sleep(600 + rand(500));
  const objections = [];

  // Generate objections based on claim statuses
  const contradicted = claims.filter(c => c.status === "contradicted");
  const confirmed = claims.filter(c => c.status === "confirmed");
  const disputed = claims.filter(c => c.status === "disputed");

  if (contradicted.length > 0) {
    objections.push({
      objection: `${contradicted.length} core claim(s) are directly contradicted by live evidence. The pipeline's Verifier has not verified the claimed competitive gap. Building on a false premise about novelty is the most common reason early-stage ideas fail due diligence.`,
      severity: "high"
    });
  }

  if (graveyardMatches.length > 0) {
    const top = graveyardMatches[0];
    objections.push({
      objection: `The graveyard match to ${top.company_name} (${top.year_closed}, ${top.raised || 'undisclosed'} raised) suggests this exact path has been attempted. The cause of death was: "${top.cause_of_death}". The new proposal does not demonstrate why this outcome would be different.`,
      severity: graveyardMatches[0].similarity > 70 ? "high" : "medium"
    });
  }

  if (confirmed.length > 0 && contradicted.length === 0) {
    objections.push({
      objection: "The verified claims are about market size, not about competitive advantage. Market size is a necessary but not sufficient condition for defensibility. A large market is an invitation for well-resourced competitors.",
      severity: "medium"
    });
  }

  if (disputed.length > 0) {
    objections.push({
      objection: `${disputed.length} claim(s) are in disputed status — the system has not definitively confirmed the competitive moat. A Caution verdict based on disputed claims is not a clean bill of health. The uncertainty is material.`,
      severity: "medium"
    });
  }

  // Always add an evidence-gap objection
  objections.push({
    objection: "Live retrieval is limited to publicly indexed web content. Patent databases, academic literature, stealth-mode startups, and internal corporate roadmaps are not captured. The absence of contradicting evidence is not evidence of absence.",
    severity: "low"
  });

  return objections.slice(0, 4);
}

// ── Real pipeline: delegates to the serverless proxy (keys never touch the frontend) ──
async function runRealPipeline(ideaText) {
  const res = await fetch('/api/screen', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idea: ideaText, session_id: window.TELEMETRY?.getSessionId() || null }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'screen_failed');
  return data.result;
}

// Normalize any pipeline result to the unified contract.
function normalizeResult(result) {
  const claims = (result.claims || []).map(c => ({
    claim: c.claim || '',
    type: c.type || 'other',
    status: ['confirmed','contradicted','disputed','unverified'].includes(c.status) ? c.status : 'unverified',
    reasoning: c.reasoning || '',
    sources: Array.isArray(c.sources) ? c.sources : [],
  }));
  const graveyard_matches = (result.graveyard_matches || result.graveyard || []).map(g => {
    const entry = g.company_name ? g : (GRAVEYARD_DB.find(e => e.id === g.id) || {});
    return {
      company_name: entry.company_name || '',
      what_they_tried: entry.what_they_tried || '',
      cause_of_death: entry.cause_of_death || '',
      year_closed: entry.year_closed || null,
      similarity: typeof g.similarity === 'number' ? g.similarity : 0,
    };
  });
  const objections = (result.objections || []).map(o => ({
    objection: o.objection || '',
    severity: ['high','medium','low'].includes(o.severity) ? o.severity : 'medium',
  }));
  return { claims, graveyard_matches, objections };
}

// ── Main pipeline runner ────────────────────────────────────────────
// Entry point: DEMO_MODE routes between simulated and real pipeline; both normalize to the contract.
async function runPipelineOn(ideaText) {
  if (!DEMO_MODE) {
    setStage(1, "running"); setStage(2, "running");
    try {
      const result = await runRealPipeline(ideaText);
      setStage(1, "done", `${result.claims.length} claims extracted`);
      setStage(2, "done", `${result.claims.length} claims classified`);
      setStage(3, "done", `${(result.graveyard_matches || []).length} matches found`);
      setStage(4, "done", `${(result.objections || []).length} objections raised`);
      return result;
    } catch (e) {
      // Key-free smoke path: if the backend has no LLM keys configured,
      // transparently fall back to the DEMO pipeline so the app is always usable.
      if (e.message === 'no_llm_configured') {
        window.DEMO_MODE = true;
        return runDemoPipeline(ideaText);
      }
      [1,2,3,4].forEach(i => setStage(i, "idle"));
      throw e;
    }
  }
  return runDemoPipeline(ideaText);
}

async function runDemoPipeline(ideaText) {
  // Stage 1
  setStage(1, "running");
  const rawClaims = await simulateClaimExtraction(ideaText);
  setStage(1, "done", `${rawClaims.length} claims extracted`);

  // Stage 2
  setStage(2, "running");
  const classifiedClaims = await simulateLiveRetrieval(rawClaims);
  setStage(2, "done", `${classifiedClaims.length} claims classified`);

  // Stage 3
  setStage(3, "running");
  const graveyardMatches = await simulateGraveyardMatching(ideaText);
  setStage(3, "done", `${graveyardMatches.length} matches found`);

  // Stage 4
  setStage(4, "running");
  const objections = await simulateObjectorPass(classifiedClaims, graveyardMatches);
  setStage(4, "done", `${objections.length} objections raised`);

  return normalizeResult({ claims: classifiedClaims, graveyard: graveyardMatches, objections });
}

// ── Helpers ───────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(n) { return Math.floor(Math.random() * n); } // DEMO_MODE simulation only — never use in production paths

function makeMatcher(patterns) {
  const re = new RegExp(`\\b(${patterns.join("|")})\\b`, "i");
  return text => re.test(text);
}

function setStage(n, state, statusText) {
  const el = document.getElementById(`stage${n}`);
  const statusEl = document.getElementById(`s${n}-status`);
  if (!el) return;
  el.className = `stage-track ${state}`;
  if (state === "running") statusEl.textContent = "running…";
  else if (state === "done") statusEl.textContent = statusText || "done";
  else statusEl.textContent = "idle";
}
