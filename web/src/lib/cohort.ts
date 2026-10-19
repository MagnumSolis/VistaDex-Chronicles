import { COHORT_IDEAS, GRAVEYARD_DB } from "@/proto";
import { applySamples, finalizeReport } from "@proto/core/finalize.js";
import { MOCK_SAMPLES } from "@proto/data/samples.js";
import type { Report } from "@/types";

export interface CohortIdea {
  id: string; name: string; desc: string; submitter: string; category: string;
  claims: Report["claims"]; graveyard: { id: string; similarity: number }[]; objections: Report["objections"];
}

export const cohort = COHORT_IDEAS as CohortIdea[];

// Demo categories → the form's industry list. TODO(team): confirm this mapping.
export const CATEGORY_INDUSTRY: Record<string, string> = {
  LegalTech: "SaaS/B2B", ClimaTech: "Climate/Energy", "Creator Tools": "Media/Creator", HealthTech: "Healthtech",
  "Web3 / GreenTech": "Climate/Energy", EdTech: "Edtech", "Logistics / Drone": "Mobility", "Enterprise SaaS": "SaaS/B2B",
};

// The cohort's hand-written claims, leads and objections (contract shape, leads by graveyard id), as before.
export function cohortReport(idea: CohortIdea): Report {
  return {
    idea_text: idea.desc,
    claims: idea.claims,
    graveyard_matches: (idea.graveyard || [])
      .map(g => ({ ...(GRAVEYARD_DB as any[]).find(e => e.id === g.id), similarity: g.similarity }))
      .filter(m => m.company_name),
    objections: idea.objections,
  };
}

// The full demo report: the cohort data run through the same finalize step as every screening (input,
// overlap band, scores) with the mock-mode samples for what demo data does not have (marked sample_fields).
export function demoReport(idea: CohortIdea): Report {
  const seed = GRAVEYARD_DB as { source_verified?: boolean }[];
  return finalizeReport(applySamples({
    ...cohortReport(idea),
    input: { title: idea.name, pitch: idea.desc, problem: "", solution: "", moat: "", industries: [CATEGORY_INDUSTRY[idea.category] ?? "Other"], role: null, markets: [] },
    search: { graveyard: { entries_checked: seed.length, verified_entries: seed.filter(g => g.source_verified === true).length } },
  }, MOCK_SAMPLES)) as Report;
}
