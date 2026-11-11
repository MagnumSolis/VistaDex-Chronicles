// Live market size and legal sections (prototype/core/stages/market.js, legal.js) and how they score:
// what the model may say vs what code keeps, the two-independent-sources rule, and "absence is not good".
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchMarket, keepFigures, marketFromFigures, formatUsd } from "../prototype/core/stages/market.js";
import { searchLegal, keepRules, REGISTRIES } from "../prototype/core/stages/legal.js";
import { findCompetitors } from "../prototype/core/stages/competitors.js";
import { marketAxis, legalAxis, scoreReport } from "../prototype/core/scoring.js";
import { runScreen } from "../prototype/core/pipeline.js";
import { validateContract, toContract } from "../prototype/core/contract.js";
import { createLLM } from "../prototype/core/providers/llm.js";
import { mockRetrieval } from "../prototype/core/providers/retrieval.js";
import { createTrace } from "../prototype/core/trace.js";

const T = () => createTrace({ ideaText: "x", mode: "test" });
const retrievalOf = pages => ({
  name: "fake", searches: [],
  async search(q) { this.searches.push(q); return pages.map(p => ({ url: p.url, title: p.title, snippet: "" })); },
  async fetchPages(urls) { return pages.filter(p => urls.includes(p.url)); },
});
const readerOf = fn => createLLM({ default: [{ name: "fake", model: "f", complete: async ({ messages }) => fn(messages[0].content, messages) }] });
const input = { title: "ScribeAI", pitch: "AI medical scribe for solo practices", problem: "p", solution: "s", moat: "", industries: ["Healthtech"], role: "founder", markets: ["USA", "India"] };

const MARKET_PAGES = [
  { url: "https://www.grandview.example.com/r", title: "Report", text: "The global AI medical scribe market was valued at USD 2.4 billion in 2024 and keeps growing." },
  { url: "https://news.other.org/a", title: "News", text: "Analysts put the AI scribe market at $3.1 billion this year. Pricing starts at $99 per month." },
  { url: "https://blog.third.io/b", title: "Blog", text: "Some say the AI scribe market could reach $40 billion, but nobody knows." },
];

test("market: figures are kept only when the sentence is on the page and holds the amount", () => {
  const kept = keepFigures([
    { source: 1, figure: "USD 2.4 billion", market: "AI medical scribe", year: 2024, quote: "The global AI medical scribe market was valued at USD 2.4 billion in 2024 and keeps growing." },
    { source: 2, figure: "$3.1 billion", quote: "Analysts put the AI scribe market at $3.1 billion this year." },
    { source: 2, figure: "$99", quote: "Pricing starts at $99 per month." },                   // a price, not a market
    { source: 3, figure: "$40 billion", quote: "The AI scribe market is worth $40 billion." },     // not on the page
    { source: 9, figure: "$1 billion", quote: "x" },                                               // no such page
  ], MARKET_PAGES);
  assert.deepEqual(kept.map(f => [f.value_usd, f.url]), [[2.4e9, MARKET_PAGES[0].url], [3.1e9, MARKET_PAGES[1].url]]);
  assert.equal(kept[0].year, 2024);
});

test("market: the TAM is the median of one figure per independent site; one site is shown but not counted", () => {
  const f = (usd, url) => ({ value: formatUsd(usd), value_usd: usd, market: "m", year: null, url, quote: "q" });
  const two = marketFromFigures([f(2.4e9, "https://a.example.com/1"), f(3.1e9, "https://b.example.org/2"), f(9e9, "https://a.example.com/3")], { queries: ["q"], sources_checked: 3 });
  assert.equal(two.tam.corroborated, true);
  assert.equal(two.tam.independent_sources, 2, "two pages on one site are one source");
  assert.equal(two.tam.value_usd, 2.75e9);
  assert.equal(two.tam.value, "$2.8B");
  const one = marketFromFigures([f(2.4e9, "https://a.example.com/1")], null);
  assert.equal(one.tam.corroborated, false);
  assert.match(one.tam.scope, /one source only/);
  assert.equal(marketAxis({ market: one, claims: [], graveyard_matches: [], objections: [] }).value, null);
  assert.match(marketAxis({ market: one, claims: [], graveyard_matches: [], objections: [] }).reason, /second independent source/);
  assert.equal(marketAxis({ market: two, claims: [], graveyard_matches: [], objections: [] }).value > 0, true);
});

test("market: a dedicated search runs on the title and industry; no search in the key-free mock path", async () => {
  const r = retrievalOf(MARKET_PAGES);
  const llm = readerOf(sys => sys.includes("market-size figures") ? JSON.stringify({ figures: [
    { source: 1, figure: "USD 2.4 billion", quote: "The global AI medical scribe market was valued at USD 2.4 billion in 2024 and keeps growing." },
    { source: 2, figure: "$3.1 billion", quote: "Analysts put the AI scribe market at $3.1 billion this year." }] }) : "{}");
  const m = await searchMarket({ ideaText: "x", input, claims: [] }, { llm, retrieval: r, trace: T() });
  assert.deepEqual(r.searches, ["ScribeAI Healthtech market size"]);
  assert.equal(m.tam.value_usd, 2.75e9);
  assert.deepEqual(m.search, { queries: ["ScribeAI Healthtech market size"], sources_checked: 3 });
  const mock = await searchMarket({ ideaText: "x", input, claims: [] }, { llm, retrieval: mockRetrieval(), trace: T() });
  assert.equal(mock, null, "nothing searched, nothing claimed");
});

const LEGAL_PAGES = [
  { url: "https://www.hhs.gov/hipaa", title: "HHS", text: "Covered entities must follow the HIPAA Privacy Rule when they handle patient records." },
  { url: "https://law.firm.example.com/x", title: "Firm", text: "Any AI scribe that stores notes falls under the HIPAA Privacy Rule in the United States." },
  { url: "https://blog.solo.io/y", title: "Blog", text: "Some vendors mention SOC 2 audits for trust." },
];

test("legal: a rule counts only when named in a verbatim sentence; two sites corroborate it", () => {
  const rules = keepRules([
    { source: 1, rule: "HIPAA Privacy Rule", summary: "Patient records", quote: "Covered entities must follow the HIPAA Privacy Rule when they handle patient records." },
    { source: 2, rule: "HIPAA Privacy Rule", summary: "x", quote: "Any AI scribe that stores notes falls under the HIPAA Privacy Rule in the United States." },
    { source: 3, rule: "SOC 2", summary: "audits", quote: "Some vendors mention SOC 2 audits for trust." },
    { source: 3, rule: "GDPR", summary: "x", quote: "Some vendors mention SOC 2 audits for trust." },         // not named in its quote
    { source: 1, rule: "FDA clearance", summary: "x", quote: "AI scribes need FDA clearance." },              // not on the page
  ], LEGAL_PAGES);
  assert.deepEqual(rules.map(r => [r.rule, r.independent_sources, r.corroborated]), [["HIPAA Privacy Rule", 2, true], ["SOC 2", 1, false]]);
  assert.equal(rules[0].sources.length, 2);
});

test("legal: one search per target market, official registries listed, nothing when no market or no search", async () => {
  const r = retrievalOf(LEGAL_PAGES);
  const llm = readerOf(sys => sys.includes("laws, regulations, licences") ? JSON.stringify({ rules: [
    { source: 1, rule: "HIPAA Privacy Rule", summary: "Patient records", quote: "Covered entities must follow the HIPAA Privacy Rule when they handle patient records." },
    { source: 2, rule: "HIPAA Privacy Rule", summary: "x", quote: "Any AI scribe that stores notes falls under the HIPAA Privacy Rule in the United States." }] }) : "{}");
  const legal = await searchLegal({ ideaText: "x", input }, { llm, retrieval: r, trace: T() });
  assert.deepEqual(legal.jurisdictions.map(j => j.jurisdiction), ["USA", "India"]);
  assert.equal(r.searches.length, 2);
  assert.match(r.searches[0], /ScribeAI Healthtech regulations licensing requirements United States/);
  assert.deepEqual(legal.jurisdictions[0].facts.map(f => f.registry.url), [REGISTRIES.USA.trademark.url, REGISTRIES.USA.patent.url]);
  for (const j of legal.jurisdictions) for (const f of j.facts) assert.match(f.registry.url, /^https:\/\//);
  assert.equal(await searchLegal({ ideaText: "x", input: { ...input, markets: [] } }, { llm, retrieval: r, trace: T() }), null);
  assert.equal(await searchLegal({ ideaText: "x", input }, { llm, retrieval: mockRetrieval(), trace: T() }), null);
});

test("legal axis: corroborated rules lower it; none found is capped at 70; no search is not enough data", () => {
  const req = (rule, n) => ({ rule, summary: "", source: { name: "a", url: "https://a.example" }, independent_sources: n, corroborated: n >= 2 });
  const rep = (requirements, markets = ["USA"]) => ({ input: { markets }, legal: { jurisdictions: markets.map(m => ({ jurisdiction: m, facts: [], requirements, sources_checked: 4 })) }, search: { legal: { queries: ["q"], sources_checked: 4 * markets.length } }, claims: [], graveyard_matches: [], objections: [] });
  assert.equal(legalAxis(rep([req("HIPAA", 2), req("SOC 2", 1)])).value, 85);
  assert.equal(legalAxis(rep([req("A", 2), req("B", 3), req("C", 2), req("D", 2), req("E", 2), req("F", 2)])).value, 25, "at most 5 rules counted");
  assert.equal(legalAxis(rep([req("A", 2)], ["USA", "India"])).inputs.rules_corroborated, 1, "the same rule in two markets counts once");
  const none = legalAxis(rep([req("SOC 2", 1)]));
  assert.equal(none.value, 70);
  assert.match(none.note, /not proof/);
  assert.equal(legalAxis({ input: { markets: [] }, claims: [], graveyard_matches: [], objections: [] }).value, null);
});

test("competitors: one retry when the reply is not the expected object", async () => {
  let calls = 0;
  const llm = readerOf(sys => {
    if (!sys.includes("NAMES as already offering")) return "{}";
    calls++;
    return calls === 1 ? JSON.stringify([{ name: "Harvey" }]) : JSON.stringify({ competitors: [{ source: 1, name: "Harvey", why_similar: "x", quote: "Harvey offers LLM contract review with lawyer oversight for law firms." }] });
  });
  const out = await findCompetitors({ ideaText: "x", input }, { llm, retrieval: retrievalOf([{ url: "https://harvey.ai/p", title: "H", text: "Harvey offers LLM contract review with lawyer oversight for law firms." }]), trace: T() });
  assert.equal(calls, 2);
  assert.deepEqual(out.list.map(c => c.name), ["Harvey"]);
});

test("pipeline: market and legal in a valid contract, and both count in the VistaDex Score", async () => {
  const pages = [...MARKET_PAGES, ...LEGAL_PAGES];
  const llm = { default: [{ name: "fake", model: "f", complete: async ({ messages }) => {
    const sys = messages[0].content;
    if (sys.includes("market-size figures")) return JSON.stringify({ figures: [
      { source: 1, figure: "USD 2.4 billion", quote: "The global AI medical scribe market was valued at USD 2.4 billion in 2024 and keeps growing." },
      { source: 2, figure: "$3.1 billion", quote: "Analysts put the AI scribe market at $3.1 billion this year." }] });
    if (sys.includes("laws, regulations, licences")) return JSON.stringify({ rules: [
      { source: 4, rule: "HIPAA Privacy Rule", summary: "Patient records", quote: "Covered entities must follow the HIPAA Privacy Rule when they handle patient records." },
      { source: 5, rule: "HIPAA Privacy Rule", summary: "x", quote: "Any AI scribe that stores notes falls under the HIPAA Privacy Rule in the United States." }] });
    if (sys.includes("NAMES as already offering")) return JSON.stringify({ competitors: [] });
    if (sys.includes("offering or announcing")) return JSON.stringify({ labels: [] });
    return "{}";
  } }] };
  const { report } = await runScreen(input, { llmRoutes: llm, retrieval: retrievalOf(pages), graveyard: [], mode: "live" });
  assert.deepEqual(validateContract(report), []);
  assert.equal(report.market.tam.corroborated, true);
  assert.equal(report.search.market.sources_checked > 0, true);
  assert.deepEqual(report.legal.jurisdictions.map(j => j.jurisdiction), ["USA", "India"]);
  assert.equal(report.scores.axes.legal.inputs.rules_corroborated, 1);
  assert.ok(report.scores.vistadex.used.some(u => u.axis === "legal"));
  assert.ok(report.scores.vistadex.used.some(u => u.axis === "market"));
  assert.equal(report.sample_fields, undefined, "a live report carries no sample data");
  assert.deepEqual(toContract(report).legal, report.legal, "the contract keeps the legal section as is");
});

test("score weights: counted axes add up to 100 with legal in", () => {
  const { vistadex } = scoreReport({ idea_text: "x", claims: [], graveyard_matches: [], objections: [] });
  assert.ok(vistadex.excluded.some(e => e.axis === "legal"));
});

test("competitors: a reply cut off by the length limit keeps its complete entries; the list is capped and given room", async () => {
  const quote = "Harvey offers LLM contract review with lawyer oversight for law firms.";
  let request = null;
  const llm = createLLM({ default: [{ name: "fake", model: "f", complete: async req => {
    if (!req.messages[0].content.includes("NAMES as already offering")) return "{}";
    request = req;
    // Truncated mid-entry, as a model does when it hits max_tokens.
    return `{"competitors": [{"source": 1, "name": "Harvey", "why_similar": "x", "quote": "${quote}"}, {"source": 1, "name": "Robin AI", "why_sim`;
  } }] });
  const out = await findCompetitors({ ideaText: "x", input }, { llm, retrieval: retrievalOf([{ url: "https://harvey.ai/p", title: "H", text: quote }]), trace: T() });
  assert.deepEqual(out.list.map(c => c.name), ["Harvey"], "the complete entry is kept; the cut-off one is dropped");
  assert.ok(request.maxTokens >= 3000, "the call asks for room for the list");
  assert.match(request.messages[0].content, /at most 8/, "the prompt caps the list");
});
