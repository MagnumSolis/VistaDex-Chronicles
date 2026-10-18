// ── contract.js — POST /screen output contract ──
// {
//   idea_text,
//   claims: [{ claim, type, status, reasoning, source_urls }],
//   graveyard_matches: [{ company_name, what_they_tried, cause_of_death, year_closed, similarity }],
//   objections: [{ objection, severity }]
// }

export const CLAIM_TYPES = ["novelty", "market_size", "defensibility", "other"];
export const CLAIM_STATUSES = ["confirmed", "contradicted", "disputed", "unverified"];
export const SEVERITIES = ["high", "medium", "low"];

// Coerce a pipeline result into exactly the contract shape. Unknown values fall
// back to the abstaining option ("other" / "unverified" / "low") rather than guessing.
export function toContract({ idea_text, claims = [], graveyard_matches = [], objections = [] }) {
  return {
    idea_text: String(idea_text ?? ""),
    claims: claims.map(c => ({
      claim: String(c.claim ?? ""),
      type: CLAIM_TYPES.includes(c.type) ? c.type : "other",
      status: CLAIM_STATUSES.includes(c.status) ? c.status : "unverified",
      reasoning: String(c.reasoning ?? ""),
      source_urls: Array.isArray(c.source_urls) ? c.source_urls.map(String) : [],
    })),
    graveyard_matches: graveyard_matches.map(g => ({
      company_name: String(g.company_name ?? ""),
      what_they_tried: String(g.what_they_tried ?? ""),
      cause_of_death: String(g.cause_of_death ?? ""),
      year_closed: Number.isInteger(g.year_closed) ? g.year_closed : null,
      similarity: clamp01(Number(g.similarity)),
    })),
    objections: objections.map(o => ({
      objection: String(o.objection ?? ""),
      severity: SEVERITIES.includes(o.severity) ? o.severity : "low",
    })),
  };
}

// Returns a list of human-readable problems; empty means valid.
export function validateContract(r) {
  const errs = [];
  if (!r || typeof r !== "object") return ["report is not an object"];
  if (typeof r.idea_text !== "string") errs.push("idea_text must be a string");
  for (const k of ["claims", "graveyard_matches", "objections"]) if (!Array.isArray(r[k])) errs.push(`${k} must be an array`);
  if (errs.length) return errs;
  r.claims.forEach((c, i) => {
    if (typeof c.claim !== "string" || !c.claim) errs.push(`claims[${i}].claim empty`);
    if (!CLAIM_TYPES.includes(c.type)) errs.push(`claims[${i}].type invalid: ${c.type}`);
    if (!CLAIM_STATUSES.includes(c.status)) errs.push(`claims[${i}].status invalid: ${c.status}`);
    if (typeof c.reasoning !== "string") errs.push(`claims[${i}].reasoning must be a string`);
    if (!Array.isArray(c.source_urls)) errs.push(`claims[${i}].source_urls must be an array`);
  });
  r.graveyard_matches.forEach((g, i) => {
    if (!(g.similarity >= 0 && g.similarity <= 1)) errs.push(`graveyard_matches[${i}].similarity out of 0–1`);
  });
  r.objections.forEach((o, i) => {
    if (!SEVERITIES.includes(o.severity)) errs.push(`objections[${i}].severity invalid: ${o.severity}`);
  });
  return errs;
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.round(Math.min(1, Math.max(0, x)) * 100) / 100;
}
