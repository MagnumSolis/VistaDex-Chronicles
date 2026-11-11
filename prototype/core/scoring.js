// ── scoring.js — Explainable scores, computed in code from the report (never by a model) ──
// Each axis → { value: 0–100 | null, inputs, boundary, note?, reason?, sample }.
//   value null = "Not enough data": the axis is excluded from the VistaDex Score, never guessed.
//   inputs     = the numbers the formula used; boundary = what was searched/checked (the search boundary).
//   sample     = the axis was computed from sample data (mock mode).
// The VistaDex Score is the weighted mean of the axes with a value, re-normalised over them.

import { independentSourceCount } from "./evidence.js";
import {
  WEIGHTS, BIG_TECH_IN_SCORE, BIG_TECH_SAFETY, MIN_SCORE_AXES, MIN_SCORE_WEIGHT_SHARE,
  NOVELTY, DEFENSIBILITY, MARKET, LEGAL, OVERLAP,
} from "./scoring-config.js";

export const AXES = ["novelty", "market", "defensibility", "graveyard", "evidence", "legal", "big_tech"];
const clamp = x => Math.max(0, Math.min(100, Math.round(x)));
const withScheme = u => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
const sources = c => independentSourceCount((c.source_urls || []).map(withScheme));
const isSample = (report, field) => (report.sample_fields || []).includes(field);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function noveltyAxis(report) {
  const claims = report.claims.filter(c => c.type === "novelty");
  const n = s => claims.filter(c => c.status === s).length;
  const confirmed = n("confirmed"), disputed = n("disputed"), contradicted = n("contradicted");
  const search = report.search?.competitors;
  const searched = Boolean(search && search.sources_checked > 0);
  const competitors = searched ? (report.competitors || []).length : 0;
  const boundary = searched
    ? `Competitor search: ${plural(search.queries.length, "query", "queries")}, ${plural(search.sources_checked, "source")} read; ${plural(claims.length, "novelty claim")} checked`
    : `No competitor search ran; ${plural(claims.length, "novelty claim")} checked`;
  const inputs = { competitors_found: competitors, sources_checked: search?.sources_checked ?? 0, novelty_claims: claims.length, confirmed, disputed, contradicted };
  const sample = isSample(report, "competitors");
  if (!searched && confirmed + disputed + contradicted === 0) {
    return { value: null, inputs, boundary, sample, reason: "No competitor search ran and no novelty claim could be checked." };
  }
  let v = NOVELTY.start - NOVELTY.perCompetitor * Math.min(competitors, NOVELTY.maxCompetitorsCounted)
    - NOVELTY.disputed * disputed + NOVELTY.confirmed * confirmed;
  let note;
  if (contradicted) { v = Math.min(v - NOVELTY.contradicted * contradicted, NOVELTY.contradictedCap); note = `${plural(contradicted, "novelty claim")} contradicted: capped at ${NOVELTY.contradictedCap}.`; }
  if (competitors === 0 && confirmed === 0) {
    v = Math.min(v, NOVELTY.noCompetitorsCap);
    note = searched ? `No competitors found in ${plural(search.sources_checked, "source")} searched (capped at ${NOVELTY.noCompetitorsCap}: not finding any is not proof there are none).`
      : `No competitor search ran (capped at ${NOVELTY.noCompetitorsCap}).`;
  }
  return { value: clamp(v), inputs, boundary, note, sample };
}

const MOAT_WORDS = /\b(moat|defensib\w*|barriers?|replicat\w*|cop(y|ied|ying)|switching costs?|network effects?|proprietary|lock-?in|hard to (build|match))\b/i;
export const isMoatObjection = o => MOAT_WORDS.test(o.objection);

export function defensibilityAxis(report) {
  const claims = report.claims.filter(c => c.type === "defensibility");
  const n = s => claims.filter(c => c.status === s).length;
  const confirmed = n("confirmed"), disputed = n("disputed"), contradicted = n("contradicted");
  const moat = String(report.input?.moat ?? "").trim();
  const moatStated = moat.length >= DEFENSIBILITY.moatMinChars;
  const moatObjections = report.objections.filter(isMoatObjection);
  const inputs = { moat_stated: moatStated, defensibility_claims: claims.length, confirmed, disputed, contradicted, moat_objections: moatObjections.length };
  const boundary = `${plural(claims.length, "defensibility claim")} checked; ${plural(report.objections.length, "objection")} read for moat arguments`;
  if (confirmed + disputed + contradicted === 0 && moatObjections.length === 0) {
    return { value: null, inputs, boundary, sample: false, reason: "No defensibility claim could be checked and no objection addressed the moat. A stated moat alone is not evidence." };
  }
  let v = DEFENSIBILITY.base + (moatStated ? DEFENSIBILITY.moatBonus : 0)
    + DEFENSIBILITY.confirmed * confirmed - DEFENSIBILITY.disputed * disputed - DEFENSIBILITY.contradicted * contradicted;
  for (const o of moatObjections) v -= DEFENSIBILITY.moatObjection[o.severity] ?? 0;
  return { value: clamp(v), inputs, boundary, sample: false };
}

export function graveyardAxis(report) {
  const g = report.search?.graveyard;
  const top = Math.max(0, ...report.graveyard_matches.map(m => m.similarity));
  const inputs = { strongest_similarity: report.graveyard_matches.length ? top : null, matches: report.graveyard_matches.length, entries_checked: g?.entries_checked ?? null, verified_entries: g?.verified_entries ?? null };
  const boundary = g ? `Checked against ${plural(g.entries_checked, "entry", "entries")} (${g.verified_entries === g.entries_checked ? "verified seed" : g.verified_entries ? `${g.verified_entries} verified` : "unverified seed"})` : "Graveyard size not recorded";
  // TODO(team): whether this axis needs a minimum seed size before it counts.
  return { value: clamp(100 * (1 - top)), inputs, boundary, sample: false, note: report.graveyard_matches.length ? undefined : "No match above the matching threshold." };
}

export function marketAxis(report) {
  const tam = report.market?.tam;
  const usd = Number(tam?.value_usd);
  const sample = isSample(report, "market");
  const search = report.search?.market;
  const boundary0 = search ? `Market-size search: ${plural(search.sources_checked, "source")} read; figures kept only when quoted verbatim` : "TAM taken only from a verified source quote";
  if (!tam || !(usd > 0)) {
    return { value: null, inputs: { tam_usd: null, sources_checked: search?.sources_checked ?? 0 }, boundary: boundary0, sample, reason: search ? `No market-size figure was quoted in ${plural(search.sources_checked, "source")} read.` : "No total market size (TAM) was found in a verified source quote." };
  }
  if (tam.corroborated === false) {
    return { value: null, inputs: { tam_usd: usd, independent_sources: 1, citation: tam.citation?.url ?? null }, boundary: boundary0, sample, reason: "Only one source quoted a market size; a second independent source is needed before it counts." };
  }
  const lo = Math.log10(MARKET.tamFloorUsd), hi = Math.log10(MARKET.tamCapUsd);
  return {
    value: clamp((100 * (Math.log10(usd) - lo)) / (hi - lo)),
    inputs: { tam_usd: usd, citation: tam.citation?.url ?? null },
    boundary: tam.independent_sources ? `TAM: median of figures quoted by ${plural(tam.independent_sources, "independent source")}` : `TAM from ${tam.citation?.name ?? "a cited source"}`,
    note: usd >= MARKET.tamCapUsd ? "Capped: $1B or more scores 100." : undefined,
    sample,
  };
}

export function legalAxis(report) {
  const legal = report.legal;
  const sample = isSample(report, "legal");
  const markets = report.input?.markets ?? [];
  const search = report.search?.legal;
  const js = legal?.jurisdictions ?? [];
  // Distinct rules across markets; a rule counts when ≥ 2 independent sources name it.
  const keys = new Map();
  for (const j of js) for (const r of j.requirements || []) {
    const k = String(r.rule).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const n = Number(r.independent_sources ?? (r.sources?.length ?? 1));
    keys.set(k, Math.max(keys.get(k) ?? 0, n));
  }
  const counted = [...keys.values()].filter(n => n >= 2).length;
  const single = [...keys.values()].filter(n => n < 2).length;
  const read = search?.sources_checked ?? js.reduce((s, j) => s + (j.sources_checked ?? 0), 0);
  const inputs = { markets: js.map(j => j.jurisdiction), rules_corroborated: counted, rules_one_source: single, sources_checked: read };
  const boundary = js.length ? `${plural(js.length, "target market")} searched, ${plural(read, "source")} read` : "No legal search ran";
  if (!legal || !js.length) {
    return { value: null, inputs, boundary, sample, reason: markets.length ? "No legal search ran for the target markets." : "No target market was picked, so no legal search ran." };
  }
  if (!sample && read === 0) return { value: null, inputs, boundary, sample, reason: "The legal search found no pages to read." };
  let v = LEGAL.start - LEGAL.perRule * Math.min(counted, LEGAL.maxRulesCounted);
  let note;
  if (counted === 0) {
    v = Math.min(v, LEGAL.noneFoundCap);
    note = `No rule named by 2 independent sources in ${plural(read, "source")} read (capped at ${LEGAL.noneFoundCap}: not finding one is not proof there is none).`;
  }
  return { value: clamp(v), inputs, boundary, note, sample };
}

export function evidenceAxis(report) {
  const total = report.claims.length;
  const backed = report.claims.filter(c => c.status !== "unverified" && sources(c) >= 2).length;
  const inputs = { claims: total, backed_by_two_sources: backed };
  const boundary = `${plural(total, "claim")} checked against independent sources`;
  if (!total) return { value: null, inputs, boundary, sample: false, reason: "No checkable claims were found." };
  return { value: clamp((100 * backed) / total), inputs, boundary, sample: false };
}

export function bigTechAxis(report) {
  const risk = report.big_tech_risk;
  const sample = isSample(report, "big_tech_risk");
  const boundary = risk ? `${plural(risk.companies_checked?.length ?? 0, "company", "companies")} checked, ${plural(risk.sources_checked ?? 0, "source")} read` : "No Big Tech search ran";
  const value = risk && risk.level in BIG_TECH_SAFETY ? BIG_TECH_SAFETY[risk.level] : null;
  const reason = !risk ? "No Big Tech search ran."
    : risk.level === "unverified" ? "Fewer than 2 independent sources for any company."
      : risk.level === "none_found" ? "Searched; no company matched. Not finding one is not proof of safety." : undefined;
  return { value, inputs: { level: risk?.level ?? null }, boundary, sample, reason };
}

export function overlapBand(report) {
  const top = Math.max(0, ...report.graveyard_matches.map(m => m.similarity));
  const competitors = (report.competitors || []).length;
  if (top >= OVERLAP.high || competitors >= OVERLAP.highCompetitors) return "high";
  if (top >= OVERLAP.caution) return "caution";
  return "clear";
}

// → { vistadex: { value, reason?, used: [{axis, weight, share, value}], excluded: [{axis, reason}] }, axes: {…} }
export function scoreReport(report) {
  const axes = {
    novelty: noveltyAxis(report), market: marketAxis(report), defensibility: defensibilityAxis(report),
    graveyard: graveyardAxis(report), evidence: evidenceAxis(report), legal: legalAxis(report), big_tech: bigTechAxis(report),
  };
  const counted = AXES.filter(a => a !== "big_tech" || BIG_TECH_IN_SCORE);
  const excluded = [];
  if (!BIG_TECH_IN_SCORE) excluded.push({ axis: "big_tech", reason: "Not counted in this version: what a low Big Tech risk needs as evidence is still being defined." });
  const available = counted.filter(a => {
    if (axes[a].value === null) { excluded.push({ axis: a, reason: axes[a].reason ?? "Not enough data." }); return false; }
    return true;
  });
  const totalWeight = counted.reduce((s, a) => s + WEIGHTS[a], 0);
  const usedWeight = available.reduce((s, a) => s + WEIGHTS[a], 0);
  const used = available.map(a => ({ axis: a, weight: WEIGHTS[a], share: Math.round((1000 * WEIGHTS[a]) / (usedWeight || 1)) / 1000, value: axes[a].value }));
  let value = null, reason;
  if (available.length < MIN_SCORE_AXES || usedWeight < MIN_SCORE_WEIGHT_SHARE * totalWeight) {
    reason = `Not enough data: ${plural(available.length, "axis", "axes")} (${usedWeight} of ${totalWeight} weight) have data; a score needs at least ${MIN_SCORE_AXES} axes and ${Math.round(MIN_SCORE_WEIGHT_SHARE * 100)}% of the weight.`;
  } else {
    value = Math.round(available.reduce((s, a) => s + WEIGHTS[a] * axes[a].value, 0) / usedWeight);
  }
  const sample = available.some(a => axes[a].sample);
  return { vistadex: { value, reason, used, excluded, sample }, axes };
}
