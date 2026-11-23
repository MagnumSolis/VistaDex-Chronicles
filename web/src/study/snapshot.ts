// ── study/snapshot.ts — the VistaDex report a study participant saw, for the chatbot comparison ──
// Study track only (see studyEvents.ts): what the report said, in the same terms the analysis reads the
// chatbot's answer in. Section by section, the claims with their status and sources, the competitors, the
// graveyard leads, the objections, Big Tech risk, legal, market and the score. Never sent for field visitors.
import { track } from "@/telemetry";
import type { Report } from "@/types";
import { assignedStudyIdea } from "./participant";

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

export function reportSnapshot(report: Report) {
  const claims = report.claims.map(c => ({ claim: c.claim, type: c.type, status: c.status, urls: c.source_urls ?? [] }));
  const competitors = (report.competitors ?? []).map(c => ({ name: c.name, url: c.url }));
  const graveyard = report.graveyard_matches.map(g => ({ company: g.company_name, cause: g.cause_of_death, year: g.year_closed, similarity: g.similarity, urls: g.source_urls ?? [] }));
  const objections = report.objections.map(o => ({ objection: o.objection, severity: o.severity }));
  const bt = report.big_tech_risk;
  const bigTech = bt ? { level: bt.level, companies: bt.companies.map(c => c.name), urls: bt.companies.flatMap(c => c.source_urls) } : null;
  const legal = report.legal ? report.legal.jurisdictions.map(j => ({ jurisdiction: j.jurisdiction, requirements: j.requirements.map(r => r.rule), urls: j.requirements.map(r => r.source.url) })) : null;
  const m = report.market;
  const market = m ? { tam: m.tam?.value ?? null, urls: [m.tam?.citation?.url, ...(m.figures ?? []).map(f => f.citation?.url)].filter((u): u is string => !!u) } : null;
  const urls = [...claims.flatMap(c => c.urls), ...competitors.map(c => c.url), ...graveyard.flatMap(g => g.urls), ...(bigTech?.urls ?? []), ...(legal ?? []).flatMap(l => l.urls), ...(market?.urls ?? [])].filter(Boolean);
  return {
    score: report.scores?.vistadex.value ?? null,
    sample_fields: report.sample_fields ?? [],
    claims, competitors, graveyard, objections, big_tech: bigTech, legal, market,
    sources: new Set(urls).size, domains: new Set(urls.map(host).filter(Boolean)).size,
  };
}

/** After a study participant's VistaDex run of their assigned idea. */
export function logStudyReport(runId: string, report: Report) {
  const a = assignedStudyIdea();
  if (!a) return;
  track("vistadex_report_snapshot", { run_id: runId, idea_key: a.key, report: reportSnapshot(report) });
}
