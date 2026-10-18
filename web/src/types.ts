// Shapes of the POST /screen contract (prototype/core/contract.js) as the UI uses them.

export type ClaimType = "novelty" | "market_size" | "defensibility" | "other";
export type ClaimStatus = "confirmed" | "contradicted" | "disputed" | "unverified";
export type Severity = "high" | "medium" | "low";

export interface Claim {
  claim: string;
  type: ClaimType;
  status: ClaimStatus;
  reasoning: string;
  source_urls: string[];
}

export interface GraveyardMatch {
  company_name: string;
  what_they_tried: string;
  cause_of_death: string;
  year_closed: number | null;
  similarity: number;
}

export interface Objection {
  objection: string;
  severity: Severity;
}

export interface Report {
  idea_text: string;
  claims: Claim[];
  graveyard_matches: GraveyardMatch[];
  objections: Objection[];
}

export type RunMode = "mock" | "live" | "proxy-mock";

export interface ScreenResult {
  report: Report;
  trace: unknown;
  traceId: string | null;
  mode: RunMode;
}

export type StageState = "idle" | "running" | "done";
export type ViewName = "dashboard" | "screen" | "graveyard";
