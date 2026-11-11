// ── contract.js — POST /screen output contract ──
// {
//   idea_text,
//   claims: [{ claim, type, status, reasoning, source_urls, evidence? }],
//   graveyard_matches: [{ company_name, what_they_tried, cause_of_death, year_closed, similarity, source_urls }],
//   objections: [{ objection, severity }],
//   // added in 2026-10 round 2 (all optional, so earlier reports stay valid):
//   input?:          { title, pitch, problem, solution, moat, industries[], role, markets[] }
//   competitors?:    [{ name, url, why_similar, quote }]           — each backed by a fetched page
//   search?:         { competitors?, market?, legal?: { queries[], sources_checked }, graveyard?: { entries_checked, verified_entries } }
//   big_tech_risk?:  { level, companies[], unconfirmed[], summary, companies_checked[], queries[], sources_checked }
//   market?:         { tam?: { value, value_usd, scope, citation, quote, corroborated?, independent_sources? },
//                      figures?: [{ value, value_usd, market, year, citation, quote }], sam?, som? }   (2026-11: live search)
//   legal?:          { jurisdictions: [{ jurisdiction, facts[], requirements: [{ rule, summary, source,
//                      sources?, independent_sources?, corroborated? }], sources_checked? }] }        (2026-11: live search)
//   sample_fields?:  names of the fields above that hold SAMPLE data (mock mode only)
//   overlap_band?:   "clear" | "caution" | "high"
//   generated_at?:   ISO time the evidence was gathered (set by the Worker; a cached report keeps its own time)
//   scores?:         see scoring.js — computed in code
// }

import { normalizeInput } from "./input.js";

export const CLAIM_TYPES = ["novelty", "market_size", "defensibility", "traction", "other"];
export const CLAIM_STATUSES = ["confirmed", "contradicted", "disputed", "unverified"];
export const SEVERITIES = ["high", "medium", "low"];
export const OVERLAP_BANDS = ["clear", "caution", "high"];
// "low" is reserved: the live pipeline never outputs it (TODO(team): define it). "none_found" = searched, nothing matched.
export const BIG_TECH_LEVELS = ["low", "medium", "high", "none_found", "unverified"];
export const SAMPLE_FIELDS = ["competitors", "big_tech_risk", "market", "legal"];

const str = v => String(v ?? "");
const strs = v => (Array.isArray(v) ? v.map(String) : []);
const link = l => (l && typeof l === "object" ? { name: str(l.name), url: str(l.url) } : null);

// Coerce a pipeline result into exactly the contract shape. Unknown values fall
// back to the abstaining option ("other" / "unverified" / "low") rather than guessing.
export function toContract(r) {
  const { idea_text, claims = [], graveyard_matches = [], objections = [] } = r;
  const out = {
    idea_text: String(idea_text ?? ""),
    claims: claims.map(c => ({
      claim: String(c.claim ?? ""),
      type: CLAIM_TYPES.includes(c.type) ? c.type : "other",
      status: CLAIM_STATUSES.includes(c.status) ? c.status : "unverified",
      reasoning: String(c.reasoning ?? ""),
      source_urls: Array.isArray(c.source_urls) ? c.source_urls.map(String) : [],
      ...(Array.isArray(c.evidence) && c.evidence.length ? { evidence: c.evidence.map(e => ({ url: str(e.url), stance: e.stance === "contradicts" ? "contradicts" : "supports", quote: str(e.quote) })) } : {}),
    })),
    graveyard_matches: graveyard_matches.map(g => ({
      company_name: String(g.company_name ?? ""),
      what_they_tried: String(g.what_they_tried ?? ""),
      cause_of_death: String(g.cause_of_death ?? ""),
      year_closed: Number.isInteger(g.year_closed) ? g.year_closed : null,
      similarity: clamp01(Number(g.similarity)),
      source_urls: Array.isArray(g.source_urls) ? g.source_urls.map(String) : [],
    })),
    objections: objections.map(o => ({
      objection: String(o.objection ?? ""),
      severity: SEVERITIES.includes(o.severity) ? o.severity : "low",
    })),
  };
  if (r.input) out.input = normalizeInput(r.input);
  if (Array.isArray(r.competitors)) out.competitors = r.competitors.map(c => ({ name: str(c.name), url: str(c.url), why_similar: str(c.why_similar), quote: str(c.quote) }));
  if (r.search) {
    out.search = {};
    if (r.search.competitors) out.search.competitors = { queries: strs(r.search.competitors.queries), sources_checked: Number(r.search.competitors.sources_checked) || 0 };
    for (const k of ["market", "legal"]) if (r.search[k]) out.search[k] = { queries: strs(r.search[k].queries), sources_checked: Number(r.search[k].sources_checked) || 0 };
    if (r.search.graveyard) out.search.graveyard = { entries_checked: Number(r.search.graveyard.entries_checked) || 0, verified_entries: Number(r.search.graveyard.verified_entries) || 0 };
  }
  if (r.big_tech_risk) {
    const b = r.big_tech_risk;
    out.big_tech_risk = {
      level: BIG_TECH_LEVELS.includes(b.level) ? b.level : "unverified",
      companies: (b.companies || []).map(c => ({ name: str(c.name), relation: c.relation === "direct" ? "direct" : "adjacent", reason: str(c.reason), source_urls: strs(c.source_urls), quote: str(c.quote) })),
      unconfirmed: (b.unconfirmed || []).map(c => ({ name: str(c.name), source_urls: strs(c.source_urls) })),
      summary: str(b.summary),
      companies_checked: strs(b.companies_checked),
      queries: strs(b.queries),
      sources_checked: Number(b.sources_checked) || 0,
    };
  }
  if (r.market) {
    const m = r.market;
    out.market = {};
    if (m.tam) {
      out.market.tam = { value: str(m.tam.value), value_usd: Number(m.tam.value_usd) || null, scope: str(m.tam.scope), citation: link(m.tam.citation), quote: str(m.tam.quote) };
      if (typeof m.tam.corroborated === "boolean") out.market.tam.corroborated = m.tam.corroborated;
      if (m.tam.independent_sources != null) out.market.tam.independent_sources = Number(m.tam.independent_sources) || 0;
    }
    if (Array.isArray(m.figures)) out.market.figures = m.figures.map(f => ({ value: str(f.value), value_usd: Number(f.value_usd) || null, market: str(f.market), year: Number(f.year) || null, citation: link(f.citation), quote: str(f.quote) }));
    for (const k of ["sam", "som"]) if (m[k]) out.market[k] = { value: str(m[k].value), scope: str(m[k].scope), assumptions: strs(m[k].assumptions) };
  }
  if (r.legal) {
    out.legal = { jurisdictions: (r.legal.jurisdictions || []).map(j => ({
      jurisdiction: str(j.jurisdiction),
      facts: (j.facts || []).map(f => ({ kind: str(f.kind), title: str(f.title), detail: str(f.detail), ...(f.reference ? { reference: str(f.reference) } : {}), registry: link(f.registry) })),
      requirements: (j.requirements || []).map(q => ({
        rule: str(q.rule), summary: str(q.summary), source: link(q.source),
        ...(Array.isArray(q.sources) ? { sources: q.sources.map(x => ({ ...link(x), quote: str(x.quote) })) } : {}),
        ...(q.independent_sources != null ? { independent_sources: Number(q.independent_sources) || 0, corroborated: Boolean(q.corroborated) } : {}),
      })),
      ...(j.sources_checked != null ? { sources_checked: Number(j.sources_checked) || 0 } : {}),
    })), ...(Array.isArray(r.legal.not_searched) && r.legal.not_searched.length ? { not_searched: strs(r.legal.not_searched) } : {}) };
  }
  if (Array.isArray(r.sample_fields)) out.sample_fields = r.sample_fields.filter(f => SAMPLE_FIELDS.includes(f));
  return out;
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
  if (r.competitors !== undefined) {
    if (!Array.isArray(r.competitors)) errs.push("competitors must be an array");
    else r.competitors.forEach((c, i) => { if (!c.name || !/^https?:\/\//.test(c.url ?? "")) errs.push(`competitors[${i}] needs a name and a source url`); });
  }
  if (r.big_tech_risk !== undefined && !BIG_TECH_LEVELS.includes(r.big_tech_risk?.level)) errs.push(`big_tech_risk.level invalid: ${r.big_tech_risk?.level}`);
  if (r.overlap_band !== undefined && !OVERLAP_BANDS.includes(r.overlap_band)) errs.push(`overlap_band invalid: ${r.overlap_band}`);
  if (r.scores !== undefined) {
    const v = r.scores?.vistadex?.value;
    if (!(v === null || (Number.isInteger(v) && v >= 0 && v <= 100))) errs.push("scores.vistadex.value must be 0–100 or null");
    for (const [axis, a] of Object.entries(r.scores?.axes ?? {})) {
      if (!(a.value === null || (Number.isInteger(a.value) && a.value >= 0 && a.value <= 100))) errs.push(`scores.axes.${axis}.value must be 0–100 or null`);
    }
  }
  return errs;
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.round(Math.min(1, Math.max(0, x)) * 100) / 100;
}
