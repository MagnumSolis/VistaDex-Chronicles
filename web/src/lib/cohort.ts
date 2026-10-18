import { COHORT_IDEAS, GRAVEYARD_DB } from "@/proto";
import type { Report } from "@/types";

export interface CohortIdea {
  id: string; name: string; desc: string; submitter: string; category: string;
  claims: Report["claims"]; graveyard: { id: string; similarity: number }[]; objections: Report["objections"];
}

export const cohort = COHORT_IDEAS as CohortIdea[];

// Cohort entries are stored in the contract shape, with graveyard leads by id (same mapping as the vanilla UI).
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
