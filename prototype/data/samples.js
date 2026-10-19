// ── samples.js — CLEARLY FAKE data for the in-browser MOCK mode only ──
// The key-free mock path has no web search, so competitors, Big Tech risk, market size and legal
// output cannot be produced. To let the report sections (and the scores built on them) be designed
// and tested, the browser's mock path passes these placeholders to runScreen as `samples`. Every value
// says SAMPLE, every link points at the reserved example.org domain, and the report lists these fields
// in `sample_fields` so the UI marks them "Sample data". The Worker never passes samples: live and
// server-mock reports show "Not available in this version yet" instead.
import { BIG_TECH_COMPANIES } from "../core/scoring-config.js";

const legalFact = (j, kind, n) => ({
  kind,
  title: `SAMPLE ${kind} record ${n} (not real)`,
  detail: `Placeholder showing where a ${kind} found in a ${j} registry would appear, with its reference number and a link to the record.`,
  reference: `SAMPLE-${j.toUpperCase()}-000${n}`,
  registry: { name: `Example ${j} registry (placeholder)`, url: `https://example.org/sample-registry/${j.toLowerCase()}/${kind}` },
});
const legalRule = (j, n) => ({
  rule: `SAMPLE rule ${n} for ${j} (not a real rule)`,
  summary: "Placeholder showing how a requirement that may apply would be named and summarised, with its source. VistaDex never says whether something is allowed.",
  source: { name: `Example ${j} official source (placeholder)`, url: `https://example.org/sample-rules/${j.toLowerCase()}/${n}` },
});

export const MOCK_SAMPLES = Object.freeze({
  competitors: {
    list: [{
      name: "Sample Competitor A (not real)",
      url: "https://example.org/sample-competitor-a",
      why_similar: "SAMPLE: placeholder showing how a product named on a fetched page would appear, with why it looks similar.",
      quote: "SAMPLE quote: Sample Competitor A (not real) offers a similar product.",
    }],
    search: { queries: ["SAMPLE competitor query"], sources_checked: 5 },
  },
  big_tech_risk: {
    level: "unverified",
    companies: [],
    unconfirmed: [{ name: "SAMPLE Big Tech Co (not real)", source_urls: ["https://example.org/sample-big-tech"] }],
    summary: "SAMPLE: one source mentions a placeholder company; fewer than 2 independent sources, so the risk stays unverified.",
    companies_checked: [...BIG_TECH_COMPANIES],
    queries: ["SAMPLE Big Tech query"],
    sources_checked: 5,
  },
  market: {
    tam: {
      value: "$500M (SAMPLE)", value_usd: 5e8,
      scope: "Placeholder for the total addressable market, quoted from a cited source.",
      citation: { name: "Example market report (placeholder)", url: "https://example.org/sample-market-report" },
      quote: "SAMPLE quote: the market is estimated at $500 million.",
    },
    sam: { value: "$0.0B (SAMPLE estimate)", scope: "Placeholder for the serviceable addressable market.", assumptions: ["SAMPLE assumption: share of the TAM in the selected markets.", "SAMPLE assumption: share of buyers the product can reach."] },
    som: { value: "$0.0M (SAMPLE estimate)", scope: "Placeholder for the serviceable obtainable market.", assumptions: ["SAMPLE assumption: share of the SAM won in the first years."] },
  },
  legal: {
    jurisdictions: ["EU", "USA", "India"].map(j => ({ jurisdiction: j, facts: [legalFact(j, "patent", 1), legalFact(j, "trademark", 2)], requirements: [legalRule(j, 1), legalRule(j, 2)] })),
  },
});
