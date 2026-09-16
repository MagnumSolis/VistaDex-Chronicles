// ── pipeline.js — Simulated 4-stage pipeline for VistaDex prototype ──
// Mirrors the real Groq + Tavily + MongoDB pipeline from the architecture doc.
// In production, each function here calls the real API endpoints.

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
    if (text.includes("no ") || text.includes("nobody") || text.includes("doesn't exist") || text.includes("no existing")) {
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

  const scoringRules = [
    { check: k => k.includes("legal") || k.includes("contract") || k.includes("lawyer"), ids: ["atrium"], sim: () => 85 + rand(10) },
    { check: k => k.includes("clean") || k.includes("laundry") || k.includes("home service"), ids: ["homejoy", "washio"], sim: () => 60 + rand(20) },
    { check: k => k.includes("video") || k.includes("stream") || k.includes("short") || k.includes("reel"), ids: ["vine", "meerkat"], sim: () => 50 + rand(20) },
    { check: k => k.includes("food") || k.includes("meal") || k.includes("delivery") || k.includes("restaurant"), ids: ["sprig", "washio"], sim: () => 55 + rand(20) },
    { check: k => k.includes("music") || k.includes("audio") || k.includes("podcast"), ids: ["rdio"], sim: () => 60 + rand(15) },
    { check: k => k.includes("ar") || k.includes("augmented") || k.includes("hardware") || k.includes("wearable"), ids: ["daqri", "jawbone"], sim: () => 65 + rand(20) },
    { check: k => k.includes("drone") || k.includes("autonomo") || k.includes("robot"), ids: ["daqri"], sim: () => 45 + rand(20) },
    { check: k => k.includes("social") || k.includes("community") || k.includes("network") || k.includes("anon"), ids: ["yik-yak", "google-plus"], sim: () => 55 + rand(20) },
    { check: k => k.includes("journal") || k.includes("note") || k.includes("productivity") || k.includes("knowledge"), ids: ["springpad"], sim: () => 48 + rand(18) },
    { check: k => k.includes("blood") || k.includes("health") || k.includes("diagnostic") || k.includes("clinical"), ids: ["theranos"], sim: () => 42 + rand(20) },
    { check: k => k.includes("mental") || k.includes("therapy") || k.includes("wellness") || k.includes("mindfulness"), ids: ["circa", "springpad"], sim: () => 38 + rand(20) },
    { check: k => k.includes("workflow") || k.includes("automation") || k.includes("slack") || k.includes("enterprise"), ids: ["springpad", "timehop"], sim: () => 40 + rand(20) },
    { check: k => k.includes("carbon") || k.includes("climate") || k.includes("emission") || k.includes("blockchain"), ids: ["circa"], sim: () => 35 + rand(20) },
    { check: k => k.includes("ship") || k.includes("package") || k.includes("courier"), ids: ["shyp", "washio"], sim: () => 65 + rand(15) },
    { check: k => k.includes("assist") || k.includes("virtual") || k.includes("secretary"), ids: ["zirtual"], sim: () => 70 + rand(15) },
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

// ── Main pipeline runner ──────────────────────────────────────────────
async function runPipelineOn(ideaText) {
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

  return { claims: classifiedClaims, graveyard: graveyardMatches, objections };
}

// ── Helpers ───────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(n) { return Math.floor(Math.random() * n); }

function setStage(n, state, statusText) {
  const el = document.getElementById(`stage${n}`);
  const statusEl = document.getElementById(`s${n}-status`);
  if (!el) return;
  el.className = `stage-track ${state}`;
  if (state === "running") statusEl.textContent = "running…";
  else if (state === "done") statusEl.textContent = statusText || "done";
  else statusEl.textContent = "idle";
}
