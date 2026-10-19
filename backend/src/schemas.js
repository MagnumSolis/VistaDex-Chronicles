// backend/src/schemas.js — graveyard document schema + validation invariants.
// Graveyard integrity (AGENTS.md rule 7): a death is "confirmed" only with
// >=2 independent sources. Judgment-call fields stay separated from hard facts.

export const GRAVEYARD_COLLECTION = "graveyard";
export const STAGING_COLLECTION = "graveyard_staging";
export const SOURCES_COLLECTION = "graveyard_sources";

export const CAUSE_CATEGORIES = [
  "unit-economics", "timing", "competition", "regulation",
  "team", "product-failure", "market-need", "fraud", "pivot", "other",
];

export function newGraveyardEntry({ company_name, what_they_tried, cause_of_death, cause_category, year_closed, raised, sector, product_type, country, source_urls, source }) {
  return {
    company_name: String(company_name || "").trim(),
    what_they_tried: String(what_they_tried || "").trim(),
    cause_of_death: String(cause_of_death || "").trim(),
    cause_category: CAUSE_CATEGORIES.includes(cause_category) ? cause_category : "other",
    year_closed: Number(year_closed) || null,
    raised: raised || null,
    sector: sector || null,
    product_type: product_type || null,
    country: country || null,
    // Death confirmation bookkeeping (>=2 independent sources = confirmed)
    source_urls: Array.isArray(source_urls) ? source_urls.filter(Boolean) : [],
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
  if (!entry.cause_of_death || entry.cause_of_death.length < 5) errors.push("cause_of_death too short");
  const y = entry.year_closed;
  if (!y || y < 1990 || y > new Date().getFullYear() + 1) errors.push(`year_closed out of range: ${y}`);
  if (!Array.isArray(entry.source_urls) || entry.source_urls.length === 0) errors.push("no source_urls");
  if (entry.death_status === "confirmed" && (entry.source_urls || []).length < 2) {
    errors.push("confirmed requires >=2 source_urls");
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
