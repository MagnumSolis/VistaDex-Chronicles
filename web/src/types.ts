// Shapes of the POST /screen contract (prototype/core/contract.js) as the UI uses them. Every field added
// in round 2 is optional: the UI shows "Not available in this version yet" when one is absent. Fields
// listed in sample_fields hold SAMPLE placeholders (in-browser mock mode only, prototype/data/samples.js).

export type ClaimType = "novelty" | "market_size" | "defensibility" | "traction" | "other";
export type ClaimStatus = "confirmed" | "contradicted" | "disputed" | "unverified";
export type Severity = "high" | "medium" | "low";

/** One verified quote per source (the quote appears word for word on the fetched page). */
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
  /** Live graveyard: pages that name the company and state its shutdown (checked automatically). */
  source_urls?: string[];
}

export interface Objection {
  objection: string;
  severity: Severity;
}

// ── Legal: registries to search and rules that fetched pages name, per target market (live since study-9) ──
export type Jurisdiction = "EU" | "USA" | "India";
export const JURISDICTIONS: Jurisdiction[] = ["EU", "USA", "India"];
export interface Link { name: string; url: string }
/** (a) Something a person can look up: a patent, trademark, approval or licence, with the registry. */
export interface LegalFact { kind: "patent" | "trademark" | "approval" | "licence"; title: string; detail: string; reference?: string; registry: Link }
/** (b) A rule that may apply, naming the rule and where it comes from. Never "allowed / not allowed". */
export interface LegalRequirement { rule: string; summary: string; source: Link; sources?: (Link & { quote: string })[]; independent_sources?: number; corroborated?: boolean }
export interface LegalJurisdiction { jurisdiction: Jurisdiction; facts: LegalFact[]; requirements: LegalRequirement[]; sources_checked?: number }
export interface Legal { jurisdictions: LegalJurisdiction[]; not_searched?: Jurisdiction[] }

// ── Market: TAM from figures quoted by independent sources (median); SAM/SOM need the founder's assumptions ──
export interface MarketQuote { value: string; value_usd: number | null; market: string; year: number | null; citation: Link | null; quote: string }
export interface MarketFigure { value: string; scope: string }
export interface Market {
  tam?: MarketFigure & { value_usd: number | null; citation: Link | null; quote: string; corroborated?: boolean; independent_sources?: number };
  figures?: MarketQuote[];
  sam?: MarketFigure & { assumptions: string[] };
  som?: MarketFigure & { assumptions: string[] };
}

// ── Round 2 ──
export type Role = "founder" | "investor" | "accelerator" | "student" | "other";
export interface IdeaInput { title: string; pitch: string; problem: string; solution: string; moat: string; industries: string[]; role: Role | null; markets: Jurisdiction[] }
export interface Competitor { name: string; url: string; why_similar: string; quote: string }
export type BigTechLevel = "low" | "medium" | "high" | "none_found" | "unverified";
export interface BigTechRisk {
  level: BigTechLevel;
  companies: { name: string; relation: "direct" | "adjacent"; reason: string; source_urls: string[]; quote: string }[];
  unconfirmed: { name: string; source_urls: string[] }[];
  summary: string; companies_checked: string[]; queries: string[]; sources_checked: number;
}
export type OverlapBand = "clear" | "caution" | "high";
export type AxisId = "novelty" | "market" | "defensibility" | "graveyard" | "evidence" | "legal" | "big_tech";
export interface Axis { value: number | null; inputs: Record<string, unknown>; boundary: string; note?: string; reason?: string; sample: boolean }
export interface Scores {
  vistadex: { value: number | null; reason?: string; sample: boolean; used: { axis: AxisId; weight: number; share: number; value: number }[]; excluded: { axis: AxisId; reason: string }[] };
  axes: Record<AxisId, Axis>;
}
export type SampleField = "competitors" | "big_tech_risk" | "market" | "legal";

export interface Report {
  idea_text: string;
  claims: Claim[];
  graveyard_matches: GraveyardMatch[];
  objections: Objection[];
  legal?: Legal;
  market?: Market;
  input?: IdeaInput;
  competitors?: Competitor[];
  search?: { competitors?: SearchBoundary; market?: SearchBoundary; legal?: SearchBoundary; graveyard?: { entries_checked: number; verified_entries: number } };
  big_tech_risk?: BigTechRisk;
  overlap_band?: OverlapBand;
  scores?: Scores;
  sample_fields?: SampleField[];
  /** When the server gathered the evidence (a cached or frozen report keeps its own time). */
  generated_at?: string;
}

export interface SearchBoundary { queries: string[]; sources_checked: number }

export type RunMode = "mock" | "live" | "proxy-mock";

export interface ScreenResult {
  report: Report;
  trace: unknown;
  traceId: string | null;
  mode: RunMode;
}

export type StageState = "idle" | "running" | "done" | "skipped" | "server";
