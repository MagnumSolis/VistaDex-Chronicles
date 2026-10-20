// ── evidence.js — Claim status and source counts are computed here, in code ──
// The model only labels each retrieved source's stance; it never sets a status
// or a confidence. Independence = distinct registrable domains.
//   confirmed    ≥ MIN_INDEPENDENT domains support, none contradict
//   contradicted ≥ MIN_INDEPENDENT domains contradict, none support
//   disputed     at least one independent domain on each side
//   unverified   everything else (no evidence, a single source, malformed output)

export const MIN_INDEPENDENT = 2;
export const STANCES = ["supports", "contradicts", "irrelevant"];

// Second-level labels under which the registrable domain has three parts.
const MULTI_PART = new Set(["co", "com", "org", "net", "ac", "gov", "edu", "nic", "res"]);

export function registrableDomain(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const parts = host.replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length < 2) return null;
  const take = parts.length >= 3 && parts.at(-1).length === 2 && MULTI_PART.has(parts.at(-2)) ? 3 : 2;
  return parts.slice(-take).join(".");
}

export function independentSourceCount(urls) {
  return new Set(urls.map(registrableDomain).filter(Boolean)).size;
}

// judgments: [{ url, stance }] → { status, supporting, contradicting, conflicted, source_urls }
export function computeStatus(judgments) {
  const byDomain = new Map();
  const urls = [];
  for (const j of judgments || []) {
    if (!j || !STANCES.includes(j.stance) || j.stance === "irrelevant") continue;
    const d = registrableDomain(j.url);
    if (!d) continue;
    if (!byDomain.has(d)) byDomain.set(d, new Set());
    byDomain.get(d).add(j.stance);
    if (!urls.includes(j.url)) urls.push(j.url);
  }
  const supporting = [], contradicting = [], conflicted = [];
  for (const [d, stances] of byDomain) {
    if (stances.size > 1) conflicted.push(d); // one site saying both: not independent evidence either way
    else if (stances.has("supports")) supporting.push(d);
    else contradicting.push(d);
  }
  let status = "unverified";
  if (supporting.length >= MIN_INDEPENDENT && contradicting.length === 0) status = "confirmed";
  else if (contradicting.length >= MIN_INDEPENDENT && supporting.length === 0) status = "contradicted";
  else if (supporting.length >= 1 && contradicting.length >= 1) status = "disputed";
  const counted = new Set([...supporting, ...contradicting]);
  return {
    status,
    supporting,
    contradicting,
    conflicted,
    source_urls: urls.filter(u => counted.has(registrableDomain(u))),
  };
}
