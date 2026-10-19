// ── sample-legal-market.ts — CLEARLY FAKE legal and market data, MOCK mode only ──
// The pipeline does not produce legal or market output yet. In the in-browser mock mode the report
// shows these placeholders so the sections can be designed and tested; every value says it is a
// sample and every link points at the reserved example.org domain. Live runs never get this data:
// they show "Not available in this version yet".
import type { Jurisdiction, Legal, LegalJurisdiction, Market } from "@/types";

const fact = (j: Jurisdiction, kind: LegalJurisdiction["facts"][number]["kind"], n: number) => ({
  kind,
  title: `SAMPLE ${kind} record ${n} (not real)`,
  detail: `Placeholder showing where a ${kind} found in a ${j} registry would appear, with its reference number and a link to the record.`,
  reference: `SAMPLE-${j.toUpperCase()}-000${n}`,
  registry: { name: `Example ${j} registry (placeholder)`, url: `https://example.org/sample-registry/${j.toLowerCase()}/${kind}` },
});

const requirement = (j: Jurisdiction, n: number) => ({
  rule: `SAMPLE rule ${n} for ${j} (not a real rule)`,
  summary: "Placeholder showing how a requirement that may apply would be named and summarised, with its source. VistaDex never says whether something is allowed.",
  source: { name: `Example ${j} official source (placeholder)`, url: `https://example.org/sample-rules/${j.toLowerCase()}/${n}` },
});

export const SAMPLE_LEGAL: Legal = {
  sample: true,
  jurisdictions: (["EU", "USA", "India"] as Jurisdiction[]).map(j => ({
    jurisdiction: j,
    facts: [fact(j, "patent", 1), fact(j, "trademark", 2)],
    requirements: [requirement(j, 1), requirement(j, 2)],
  })),
};

export const SAMPLE_MARKET: Market = {
  sample: true,
  tam: {
    value: "$0.0B (SAMPLE)",
    scope: "Placeholder for the total addressable market, quoted from a cited report.",
    citation: { name: "Example market report (placeholder)", url: "https://example.org/sample-market-report" },
  },
  sam: {
    value: "$0.0B (SAMPLE estimate)",
    scope: "Placeholder for the serviceable addressable market.",
    assumptions: ["SAMPLE assumption: share of the TAM in the selected markets.", "SAMPLE assumption: share of buyers the product can reach."],
  },
  som: {
    value: "$0.0M (SAMPLE estimate)",
    scope: "Placeholder for the serviceable obtainable market.",
    assumptions: ["SAMPLE assumption: share of the SAM won in the first years."],
  },
};
