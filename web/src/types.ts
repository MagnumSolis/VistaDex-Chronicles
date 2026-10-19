// Shapes of the POST /screen contract (prototype/core/contract.js) as the UI uses them, plus OPTIONAL
// fields the pipeline does not produce yet (legal, market, per-source evidence). The UI shows a neutral
// "not available in this version yet" state when they are absent; only the in-browser MOCK mode fills
// them, with clearly labelled sample data (src/fixtures/sample-legal-market.ts).

export type ClaimType = "novelty" | "market_size" | "defensibility" | "other";
export type ClaimStatus = "confirmed" | "contradicted" | "disputed" | "unverified";
export type Severity = "high" | "medium" | "low";

/** One verified quote per source. Not produced yet: the pipeline folds up to two quotes into `reasoning`.
 *  TODO(team): emit this from prototype/core/stages/classify.js (a core change). */
export interface Evidence { url: string; stance: "supports" | "contradicts"; quote: string }

export interface Claim {
  claim: string;
  type: ClaimType;
  status: ClaimStatus;
  reasoning: string;
  source_urls: string[];
  evidence?: Evidence[];
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

// ── Legal (not produced by the pipeline yet) ──
export type Jurisdiction = "EU" | "USA" | "India";
export const JURISDICTIONS: Jurisdiction[] = ["EU", "USA", "India"];
export interface Link { name: string; url: string }
/** (a) Something a person can look up: a patent, trademark, approval or licence, with the registry. */
export interface LegalFact { kind: "patent" | "trademark" | "approval" | "licence"; title: string; detail: string; reference?: string; registry: Link }
/** (b) A rule that may apply, naming the rule and where it comes from. Never "allowed / not allowed". */
export interface LegalRequirement { rule: string; summary: string; source: Link }
export interface LegalJurisdiction { jurisdiction: Jurisdiction; facts: LegalFact[]; requirements: LegalRequirement[] }
export interface Legal { jurisdictions: LegalJurisdiction[]; sample?: boolean }

// ── Market (not produced by the pipeline yet) ──
export interface MarketFigure { value: string; scope: string }
export interface Market {
  tam: MarketFigure & { citation: Link };
  sam: MarketFigure & { assumptions: string[] };
  som: MarketFigure & { assumptions: string[] };
  sample?: boolean;
}

export interface Report {
  idea_text: string;
  claims: Claim[];
  graveyard_matches: GraveyardMatch[];
  objections: Objection[];
  legal?: Legal;
  market?: Market;
}

export type RunMode = "mock" | "live" | "proxy-mock";

export interface ScreenResult {
  report: Report;
  trace: unknown;
  traceId: string | null;
  mode: RunMode;
}

export type StageState = "idle" | "running" | "done" | "skipped" | "server";
