// Competitors, Big Tech risk and TAM: what the model may say vs what code keeps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findCompetitors, competitorQueries } from "../prototype/core/stages/competitors.js";
import { assessBigTech } from "../prototype/core/stages/bigtech.js";
import { tamFromEvidence } from "../prototype/core/stages/market.js";
import { moneyAmounts } from "../prototype/core/quotes.js";
import { runScreen } from "../prototype/core/pipeline.js";
import { validateContract } from "../prototype/core/contract.js";
import { createLLM } from "../prototype/core/providers/llm.js";
import { mockRetrieval } from "../prototype/core/providers/retrieval.js";
import { createTrace } from "../prototype/core/trace.js";
import { GRAVEYARD_DB } from "../prototype/data/graveyard.js";

const T = () => createTrace({ ideaText: "x", mode: "test" });
const retrievalOf = pages => ({
  name: "fake",
  searches: [],
  async search(q) { this.searches.push(q); return pages.map(p => ({ url: p.url, title: p.title, snippet: "" })); },
  async fetchPages(urls) { return pages.filter(p => urls.includes(p.url)); },
});
// One fake reader for every stage: answers by what the system prompt asks for.
const reader = replies => createLLM({
  default: [{ name: "fake", model: "f", complete: async ({ messages }) => {
    const sys = messages[0].content;
    if (sys.includes("NAMES as already offering")) return JSON.stringify({ competitors: replies.competitors ?? [] });
    if (sys.includes("offering or announcing")) return JSON.stringify({ labels: replies.labels ?? [] });
    if (sys.includes("check one factual claim")) return JSON.stringify({ judgments: replies.judgments ?? [] });
    return "{}";
  } }],
});
const input = { title: "LegalAI", pitch: "AI contract review with a lawyer backstop for startups", problem: "p", solution: "s", moat: "", industries: [], role: "founder", markets: [] };

const PAGES = [
  { url: "https://harvey.ai/p", title: "Harvey", text: "Harvey offers LLM contract review with lawyer oversight for law firms." },
  { url: "https://news.example.com/a", title: "News", text: "Robin AI combines AI review with a team of human lawyers. Microsoft launched Copilot for contracts in Word." },
  { url: "https://blog.other.org/b", title: "Blog", text: "Microsoft announced contract review in Copilot for Microsoft 365 customers." },
];

test("competitors: a dedicated title + pitch search runs for every idea", async () => {
  const r = retrievalOf(PAGES);
  const out = await findCompetitors({ ideaText: "x", input }, { llm: reader({}), retrieval: r, trace: T() });
  assert.deepEqual(out.search.queries, competitorQueries("x", input));
  assert.match(r.searches[0], /LegalAI — AI contract review/);
  assert.equal(out.search.sources_checked, 3);
  assert.deepEqual(out.list, []); // searched, nothing named → an honest empty list
});

test("competitors: kept only with a verbatim quote that names them; URL from code; deduplicated", async () => {
  const llm = reader({ competitors: [
    { source: 1, name: "Harvey", why_similar: "LLM contract review with lawyers", quote: "Harvey offers LLM contract review with lawyer oversight", url: "https://evil.example" },
    { source: 2, name: "Robin AI", why_similar: "AI + lawyers", quote: "Robin AI combines AI review with a team of human lawyers" },
    { source: 2, name: "Robin AI", why_similar: "dupe", quote: "Robin AI combines AI review with a team of human lawyers" },
    { source: 3, name: "Ironclad", why_similar: "not on the page", quote: "Ironclad is the leader in contract review" },
    { source: 1, name: "Spellbook", why_similar: "quote does not name it", quote: "Harvey offers LLM contract review with lawyer oversight" },
    { source: 2, name: "LegalAI", why_similar: "the idea itself", quote: "Robin AI combines AI review with a team of human lawyers" },
  ] });
  const out = await findCompetitors({ ideaText: "x", input }, { llm, retrieval: retrievalOf(PAGES), trace: T() });
  assert.deepEqual(out.list.map(c => [c.name, c.url]), [["Harvey", "https://harvey.ai/p"], ["Robin AI", "https://news.example.com/a"]]);
});

test("competitors and Big Tech: no search → null (never a fake 'nothing found')", async () => {
  assert.equal(await findCompetitors({ ideaText: "x", input }, { llm: reader({}), retrieval: mockRetrieval(), trace: T() }), null);
  assert.equal(await findCompetitors({ ideaText: "x", input }, { llm: createLLM({}), retrieval: retrievalOf(PAGES), trace: T() }), null);
  assert.equal(await assessBigTech({ ideaText: "x", input }, { llm: reader({}), retrieval: mockRetrieval(), trace: T() }), null);
});

test("Big Tech: ≥ 2 independent domains → counted; direct → high", async () => {
  const llm = reader({ labels: [
    { source: 2, company: "Microsoft", relation: "direct", reason: "Copilot reviews contracts", quote: "Microsoft launched Copilot for contracts in Word" },
    { source: 3, company: "Microsoft", relation: "direct", reason: "Copilot", quote: "Microsoft announced contract review in Copilot for Microsoft 365 customers" },
  ] });
  const out = await assessBigTech({ ideaText: "x", input }, { llm, retrieval: retrievalOf(PAGES), trace: T() });
  assert.equal(out.level, "high");
  assert.deepEqual(out.companies.map(c => [c.name, c.relation, c.source_urls.length]), [["Microsoft", "direct", 2]]);
  assert.equal(out.queries.length, 2);
  assert.equal(out.companies_checked.length, 11);
});

test("Big Tech: one source → unverified; nothing mentioned → none_found; bad quotes dropped", async () => {
  const one = await assessBigTech({ ideaText: "x", input }, { llm: reader({ labels: [{ source: 2, company: "Microsoft", relation: "direct", quote: "Microsoft launched Copilot for contracts in Word" }] }), retrieval: retrievalOf(PAGES), trace: T() });
  assert.equal(one.level, "unverified");
  assert.deepEqual(one.unconfirmed.map(c => c.name), ["Microsoft"]);
  const none = await assessBigTech({ ideaText: "x", input }, { llm: reader({ labels: [] }), retrieval: retrievalOf(PAGES), trace: T() });
  assert.equal(none.level, "none_found");
  assert.match(none.summary, /not proof/);
  const bad = await assessBigTech({ ideaText: "x", input }, { llm: reader({ labels: [
    { source: 1, company: "Google", relation: "direct", quote: "Harvey offers LLM contract review with lawyer oversight" },   // quote doesn't name Google
    { source: 2, company: "Apple", relation: "direct", quote: "Apple is building legal AI for everyone" },                     // not on the page
  ] }), retrieval: retrievalOf(PAGES), trace: T() });
  assert.equal(bad.level, "none_found");
  assert.ok(!["low"].includes(one.level) && !["low"].includes(none.level), "never outputs low");
});

test("money amounts are read from quotes", () => {
  assert.deepEqual(moneyAmounts("The market is worth $27B, up from US$ 1.2 trillion? no: USD 500 million").map(m => m.usd), [27e9, 1.2e12, 5e8]);
  assert.deepEqual(moneyAmounts("about 27 billion dollars").map(m => m.usd), [27e9]);
  assert.deepEqual(moneyAmounts("no amounts here, 40%"), []);
});

test("TAM comes only from verified quotes: the median of figures from independent sources", () => {
  const confirmed = { claim: "The legal-tech market is worth $27B globally", type: "market_size", status: "confirmed",
    evidence: [{ url: "https://a.example/r", stance: "supports", quote: "Analysts value the global legal tech market at $25.6 billion." }, { url: "https://b.example/r", stance: "supports", quote: "Legal tech spending reached USD 28 billion in 2024." }] };
  const tam = tamFromEvidence([confirmed]);
  assert.equal(tam.tam.value_usd, 26.8e9, "median of 25.6 and 28 billion");
  assert.equal(tam.tam.corroborated, true);
  assert.equal(tam.tam.independent_sources, 2);
  assert.equal(tam.tam.citation.url, "https://b.example/r", "cited to the figure closest to the median");
  assert.match(tam.tam.quote, /USD 28 billion/);
  assert.deepEqual(tam.figures.map(f => f.value_usd), [25.6e9, 28e9]);
  // The founder's own figure ($27B in the claim text) is never used.
  assert.equal(tamFromEvidence([{ ...confirmed, evidence: [{ url: "https://a.example", stance: "supports", quote: "The legal tech market keeps growing quickly." }] }]), null);
  assert.equal(tamFromEvidence([{ ...confirmed, status: "disputed" }]), null);
});

test("pipeline with live-style stubs: competitors, Big Tech and scores in a valid contract", async () => {
  const backend = { name: "fake", model: "f", complete: async ({ messages }) => {
    const sys = messages[0].content;
    if (sys.includes("NAMES as already offering")) return JSON.stringify({ competitors: [{ source: 1, name: "Harvey", why_similar: "LLM contract review", quote: "Harvey offers LLM contract review with lawyer oversight" }] });
    if (sys.includes("offering or announcing")) return JSON.stringify({ labels: [] });
    return "{}";
  } };
  const { report } = await runScreen(input, { llmRoutes: { default: [backend] }, retrieval: retrievalOf(PAGES), graveyard: GRAVEYARD_DB, mode: "live" });
  assert.deepEqual(validateContract(report), []);
  assert.deepEqual(report.competitors.map(c => c.name), ["Harvey"]);
  assert.equal(report.big_tech_risk.level, "none_found");
  assert.equal(report.search.competitors.sources_checked > 0, true);
  assert.equal(report.scores.axes.novelty.inputs.competitors_found, 1);
  assert.equal(report.sample_fields, undefined);
  assert.ok(report.objections.some(o => /name 1 product/.test(o.objection)));
});
