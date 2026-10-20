// ── finalize.js — Contract shape + the fields computed in code (overlap band, scores) ──
// Used by the pipeline after its stages, and for the demo cohort, so every report gets the same
// derived fields from the same code.
import { toContract } from "./contract.js";
import { overlapBand, scoreReport } from "./scoring.js";

export function finalizeReport(raw) {
  const report = toContract(raw);
  report.overlap_band = overlapBand(report);
  report.scores = scoreReport(report);
  return report;
}

// Fields taken from mock-mode samples (prototype/data/samples.js); the browser mock path only.
export function applySamples(raw, samples) {
  if (!samples) return raw;
  return {
    ...raw,
    competitors: samples.competitors.list,
    search: { ...raw.search, competitors: samples.competitors.search },
    big_tech_risk: samples.big_tech_risk,
    market: samples.market,
    legal: samples.legal,
    sample_fields: ["competitors", "big_tech_risk", "market", "legal"],
  };
}
