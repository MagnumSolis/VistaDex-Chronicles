// ── sample-reports.js — Builds the sample reports from the researched fixture (prototype/data/sample-reports.js) ──
// Every derived field comes from the pipeline's own code, never from the fixture: claim types (typeClaim),
// statuses and reasoning (computeStatus + the classifier's explanation), graveyard leads (matchGraveyard on
// the seed, kept only with a recorded closure check), Big Tech risk (the 2-domain rule), TAM (only from
// a confirmed market-size claim's quotes), objections (deterministicObjections), then the contract shape,
// overlap band and scores (finalizeReport).
import { computeStatus } from "./evidence.js";
import { finalizeReport } from "./finalize.js";
import { buildIdeaText, normalizeInput } from "./input.js";
import { typeClaim } from "./rules.js";
import { bigTechFromLabels } from "./stages/bigtech.js";
import { explain } from "./stages/classify.js";
import { matchGraveyard } from "./stages/graveyard.js";
import { tamFromEvidence } from "./stages/market.js";
import { deterministicObjections } from "./stages/objector.js";
import { GRAVEYARD_DB } from "../data/graveyard.js";
import { GRAVEYARD_CHECKS, SAMPLE_CHECKED, SAMPLE_IDEAS } from "../data/sample-reports.js";

export const NOT_RESEARCHED = "Not researched for this sample report: no source was checked, so it is not marked true or false.";

function sampleClaim({ claim, evidence }) {
  const type = typeClaim(claim).type;
  if (!evidence.length) return { claim, type, status: "unverified", reasoning: NOT_RESEARCHED, source_urls: [] };
  const result = computeStatus(evidence);
  const kept = evidence.filter(e => result.source_urls.includes(e.url));
  return {
    claim, type, status: result.status, reasoning: explain(result, evidence), source_urls: result.source_urls,
    // One quote per counted source (the first), as the classifier does.
    evidence: result.source_urls.map(url => kept.find(e => e.url === url)).map(e => ({ url: e.url, stance: e.stance, quote: e.quote })),
  };
}

// Leads the seed matches, each with its checked page: the quote stands in for the seed's (unverified) cause.
export function sampleLeads(ideaText) {
  return matchGraveyard(ideaText, GRAVEYARD_DB).map(m => {
    const id = GRAVEYARD_DB.find(g => g.company_name === m.company_name)?.id;
    const check = GRAVEYARD_CHECKS[id];
    return check ? { ...m, cause_of_death: check.quote, year_closed: check.year_closed, source: check } : { ...m, unchecked: true };
  });
}

export function buildSampleReport(idea) {
  const input = normalizeInput(idea.input);
  const idea_text = buildIdeaText(input);
  const claims = idea.claims.map(sampleClaim);
  const leads = sampleLeads(idea_text).filter(l => !l.unchecked).map(({ source: _s, ...l }) => l);
  const competitors = (idea.competitors || []).map(({ checked: _c, ...c }) => c);
  const tam = tamFromEvidence(claims);
  const seed = GRAVEYARD_DB;
  const raw = {
    idea_text, input, claims, graveyard_matches: leads,
    objections: deterministicObjections(claims, leads, competitors),
    search: { graveyard: { entries_checked: seed.length, verified_entries: seed.filter(g => g.source_verified === true).length } },
  };
  if (idea.competitor_search) {
    raw.competitors = competitors;
    raw.search.competitors = { queries: idea.competitor_search.queries, sources_checked: idea.competitor_search.pages.length };
  }
  if (idea.big_tech) {
    const urls = new Set(idea.big_tech.labels.map(l => l.url));
    raw.big_tech_risk = bigTechFromLabels(idea.big_tech.labels, { companies_checked: idea.big_tech.companies_checked, queries: idea.big_tech.companies_checked, sources_checked: urls.size });
  }
  if (tam) raw.market = tam;
  return finalizeReport(raw);
}

// → [{ id, checked, report, leadChecks: { [company_name]: { url, quote, checked } } }]
export const sampleReports = () => SAMPLE_IDEAS.map(idea => {
  const report = buildSampleReport(idea);
  const leadChecks = Object.fromEntries(sampleLeads(report.idea_text).filter(l => l.source).map(l => [l.company_name, l.source]));
  return { id: idea.id, checked: SAMPLE_CHECKED, report, leadChecks };
});
