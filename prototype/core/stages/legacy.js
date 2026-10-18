// ── legacy.js — TEMPORARY port of the original simulated stages from master ──
// Kept only so the app keeps working while stages are replaced one by one.
// Still contains Math.random(); deleted once Stages 1–4 are rewritten.

export function legacyClassify(claim) {
  const text = claim.claim.toLowerCase();
  let status = "unverified";
  if (claim.type === "market_size") status = "confirmed";
  else if (claim.type === "novelty" && /\bno\b|nobody|no existing/.test(text)) status = Math.random() > 0.4 ? "contradicted" : "disputed";
  else if (claim.type === "defensibility") status = Math.random() > 0.5 ? "disputed" : "confirmed";
  return { ...claim, status, reasoning: "Simulated classification (legacy stub).", source_urls: [] };
}

export function legacyGraveyard(ideaText, graveyard) {
  const k = ideaText.toLowerCase();
  const rules = [
    { re: /legal|contract|lawyer/, ids: ["atrium"] },
    { re: /journal|note|knowledge/, ids: ["springpad"] },
    { re: /mental|therapy|wellness/, ids: ["circa"] },
  ];
  const out = [];
  for (const r of rules) if (r.re.test(k)) for (const id of r.ids) {
    const e = graveyard.find(g => g.id === id);
    if (e && !out.find(o => o.id === id)) out.push({ ...e, similarity: (40 + Math.floor(Math.random() * 40)) / 100 });
  }
  return out.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}

export function legacyObjector(claims, matches) {
  const objections = [];
  if (matches[0]) objections.push({ objection: `Resembles ${matches[0].company_name}: "${matches[0].cause_of_death}".`, severity: "medium" });
  objections.push({ objection: "Live retrieval is limited to publicly indexed web content.", severity: "low" });
  return objections;
}
