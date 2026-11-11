// backend/src/schemas.js — graveyard document schema + validation invariants.
// Schema per Project Hub "Graveyard Data" (decided 19 Oct, Lakshit):
//   every entry records the decided fields; a field that can't be found stays
//   blank (null), and "searched, not found" is recorded distinctly from
//   "never searched" via the search_status map.
// Graveyard integrity (AGENTS.md rule 7): a death is "confirmed" only with
// >=2 independent sources. Judgment-call fields stay separated from hard facts.

export const GRAVEYARD_COLLECTION = "graveyard";
export const STAGING_COLLECTION = "graveyard_staging";
export const SOURCES_COLLECTION = "graveyard_sources";

export const CAUSE_CATEGORIES = [
  "unit-economics", "timing", "competition", "regulation",
  "team", "product-failure", "market-need", "fraud", "pivot", "other",
];

// Per-field search status: "never_searched" | "searched_not_found" | "found"
export function blankSearchStatus(fields) {
  const m = {};
  for (const f of fields) m[f] = "never_searched";
  return m;
}

export const TRACKED_FIELDS = [
  "failure_reason", "funding_rounds", "closure_date",
  "registry_record", "what_they_tried", "year_closed",
];

// searched_fields: fields the ingest looked for; a looked-for field that came back
// empty is recorded as "searched_not_found", the rest stay "never_searched".
export function newGraveyardEntry({ company_name, what_they_tried, cause_of_death, failure_reason, cause_category, year_closed, closure_date, raised, funding_rounds, sector, product_type, country, registry_record, source_urls, source, searched_fields = [] }) {
  const search_status = blankSearchStatus(TRACKED_FIELDS);
  for (const f of searched_fields) if (f in search_status) search_status[f] = "searched_not_found";
  if (failure_reason || cause_of_death) search_status.failure_reason = "found";
  if (funding_rounds?.length || raised) search_status.funding_rounds = "found";
  if (closure_date || year_closed) { search_status.closure_date = "found"; search_status.year_closed = "found"; }
  if (registry_record) search_status.registry_record = "found";
  if (what_they_tried) search_status.what_they_tried = "found";

  return {
    company_name: String(company_name || "").trim(),
    what_they_tried: String(what_they_tried || "").trim(),
    // Decided field name is failure_reason; cause_of_death kept as ingest alias
    failure_reason: String(failure_reason || cause_of_death || "").trim(),
    cause_category: CAUSE_CATEGORIES.includes(cause_category) ? cause_category : "other",
    year_closed: Number(year_closed) || null,
    closure_date: closure_date || null, // ISO date if known (day > month > year)
    raised: raised || null,
    // Each round: { date, amount, lead_investor, valuation? }
    funding_rounds: Array.isArray(funding_rounds) ? funding_rounds : [],
    sector: sector || null,
    product_type: product_type || null,
    country: country || null,
    registry_record: registry_record || null, // official registry entry (OpenCorporates, Delaware, Companies House)
    // Hard facts vs judgment calls stay separated
    search_status,
    // Death confirmation bookkeeping (>=2 independent sources = confirmed)
    source_urls: Array.isArray(source_urls) ? source_urls.filter(Boolean) : [],
    source_verified: false, // true only after the human verification pass
    sources_seen: source ? 1 : 0,
    death_status: "candidate", // candidate -> confirmed (>=2 independent sources)
    primary_source: source || null, // e.g. "loot-drop.io"
    ingested_at: new Date(),
    updated_at: new Date(),
  };
}

// Invariant checks (JAW pattern 3): a failing invariant blocks publish.
export function validateEntry(entry) {
  const errors = [];
  if (!entry.company_name) errors.push("missing company_name");
  if (!entry.what_they_tried || entry.what_they_tried.length < 10) errors.push("what_they_tried too short");
  // A cause of death is optional (blank stays blank, never invented), but a stated one must say something.
  if (entry.failure_reason && entry.failure_reason.length < 5) errors.push("failure_reason too short");
  const y = entry.year_closed;
  if (!y || y < 1990 || y > new Date().getFullYear() + 1) errors.push(`year_closed out of range: ${y}`);
  if (!Array.isArray(entry.source_urls) || entry.source_urls.length === 0) errors.push("no source_urls");
  if (entry.death_status === "confirmed" && (entry.source_urls || []).length < 2) {
    errors.push("confirmed requires >=2 source_urls");
  }
  for (const r of entry.funding_rounds || []) {
    if (r.date && Number.isNaN(Date.parse(r.date))) errors.push(`funding round bad date: ${r.date}`);
  }
  return { ok: errors.length === 0, errors };
}

// Cross-source confirmation: a URL counts as independent if its registrable
// domain differs from every already-confirmed source's domain.
const SECOND_LEVEL_SUFFIXES = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "co.in", "co.jp", "com.au", "co.nz", "com.br", "com.mx", "co.za"]);

export function registrableDomain(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length > 2) {
      const lastTwo = parts.slice(-2).join(".");
      return SECOND_LEVEL_SUFFIXES.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
    }
    return host;
  } catch { return null; }
}

export function isIndependentSource(url, existingUrls) {
  const d = registrableDomain(url);
  if (!d) return false;
  return !existingUrls.some(u => registrableDomain(u) === d);
}

// ── Signal extraction (LLM output is untrusted) ────────────────────────────
// One startup an LLM read off a signal page. Every field must be supported by the
// page itself: the evidence quote is copied from it and names the company, a year
// appears on it, and most words of a stated cause appear on it. Anything else is
// rejected, never repaired.
const GENERIC_NAMES = /^(?:the |a |an )?(?:startup|company|firm|business|platform|app|service|it|they)s?$/i;
const norm = s => String(s || "").toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[#*_>|`]+/g, " ").replace(/\s+/g, " ").trim();

export function companyKey(name) {
  return norm(name).replace(/[\s,]+(?:inc\.?|llc|ltd\.?|limited|corp\.?|corporation|gmbh|plc)$/, "").replace(/[^\p{L}\p{N}]+/gu, "");
}

export function validateExtraction(item, pageText) {
  const errors = [];
  const page = norm(pageText);
  const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const value = {
    company_name: str(item?.company_name, 120),
    what_they_tried: str(item?.what_they_tried, 600),
    cause_of_death: str(item?.cause_of_death, 600),
    year_closed: item?.year_closed == null || item?.year_closed === "" ? null : Number(item.year_closed),
    evidence_quote: str(item?.evidence_quote, 600),
  };
  const n = value.company_name;
  if (n.length < 2 || n.length > 80 || /[\n\r]/.test(n) || GENERIC_NAMES.test(n)) errors.push("bad company_name");
  if (value.what_they_tried.length < 10) errors.push("what_they_tried too short");
  if (value.year_closed !== null) {
    const y = value.year_closed;
    if (!Number.isInteger(y) || y < 1990 || y > new Date().getFullYear() + 1) errors.push(`year_closed out of range: ${item.year_closed}`);
    else if (!page.includes(String(y))) errors.push("year_closed not on the page");
  }
  const q = norm(value.evidence_quote);
  if (q.length < 15 || !page.includes(q)) errors.push("evidence_quote not copied from the page");
  else if (!q.includes(norm(n))) errors.push("evidence_quote does not name the company");
  if (value.cause_of_death) {
    const words = norm(value.cause_of_death).match(/[\p{L}\p{N}]{4,}/gu) || [];
    const onPage = words.filter(w => page.includes(w)).length;
    if (!words.length || onPage / words.length < 0.6) errors.push("cause_of_death not supported by the page");
  }
  return { ok: errors.length === 0, errors, value };
}
