import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStatus, registrableDomain, independentSourceCount } from "../prototype/core/evidence.js";
import { classifyClaims } from "../prototype/core/stages/classify.js";
import { matchGraveyard, MATCH_THRESHOLD } from "../prototype/core/stages/graveyard.js";
import { raiseObjections, filterObjections, deterministicObjections } from "../prototype/core/stages/objector.js";
import { createLLM } from "../prototype/core/providers/llm.js";
import { mockRetrieval } from "../prototype/core/providers/retrieval.js";
import { createTrace } from "../prototype/core/trace.js";
import { GRAVEYARD_DB } from "../prototype/data/graveyard.js";
import { SAMPLE_IDEA } from "../prototype/data/cohort.js";

const T = () => createTrace({ ideaText: "x", mode: "test" });
const sup = url => ({ url, stance: "supports" });
const con = url => ({ url, stance: "contradicts" });

// ── evidence ──
test("registrable domain groups subdomains and handles co.uk / co.in", () => {
  assert.equal(registrableDomain("https://www.techcrunch.com/a"), "techcrunch.com");
  assert.equal(registrableDomain("https://news.bbc.co.uk/x"), "bbc.co.uk");
  assert.equal(registrableDomain("https://economictimes.indiatimes.com/x"), "indiatimes.com");
  assert.equal(registrableDomain("https://yourstory.co.in/x"), "yourstory.co.in");
  assert.equal(registrableDomain("not a url"), null);
  assert.equal(independentSourceCount(["https://a.com/1", "https://blog.a.com/2", "https://b.org"]), 2);
});

test("status rules: ≥2 independent domains needed, mixed → disputed", () => {
  assert.equal(computeStatus([]).status, "unverified");
  assert.equal(computeStatus([sup("https://a.com/1")]).status, "unverified", "single source");
  assert.equal(computeStatus([sup("https://a.com/1"), sup("https://news.a.com/2")]).status, "unverified", "same domain twice is one source");
  assert.equal(computeStatus([sup("https://a.com"), sup("https://b.com")]).status, "confirmed");
  assert.equal(computeStatus([con("https://a.com"), con("https://b.com")]).status, "contradicted");
  assert.equal(computeStatus([sup("https://a.com"), sup("https://b.com"), con("https://c.com")]).status, "disputed");
  assert.equal(computeStatus([sup("https://a.com"), con("https://c.com")]).status, "disputed");
  assert.equal(computeStatus([con("https://a.com")]).status, "unverified");
});

test("a domain that both supports and contradicts is not counted", () => {
  const r = computeStatus([sup("https://a.com/1"), con("https://a.com/2"), sup("https://b.com")]);
  assert.equal(r.status, "unverified");
  assert.deepEqual(r.conflicted, ["a.com"]);
  assert.deepEqual(r.source_urls, ["https://b.com"]);
});

test("malformed judgments are ignored (abstain)", () => {
  assert.equal(computeStatus([{ url: "https://a.com", stance: "probably" }, { url: "x", stance: "supports" }, null]).status, "unverified");
});

// ── Stage 2 ──
const claim = { claim: "No AI legal tool combines LLM review with a human lawyer backstop", type: "novelty" };
const pages = [
  { url: "https://harvey.ai/p", title: "Harvey", text: "Harvey offers LLM contract review with lawyer oversight for firms." },
  { url: "https://robin.ai/p", title: "Robin", text: "Robin AI combines AI review with a team of human lawyers." },
  { url: "https://blog.example.com/p", title: "Blog", text: "Nothing relevant here at all." },
];
const fakeRetrieval = {
  name: "fake",
  search: async () => pages.map(p => ({ url: p.url, title: p.title, snippet: "" })),
  fetchPages: async urls => pages.filter(p => urls.includes(p.url)),
};
const llmReplying = content => createLLM({ classify: [{ name: "fake", model: "f", complete: async () => content }] });

test("key-free Stage 2 abstains: unverified with no source URLs", async () => {
  const [r] = await classifyClaims([claim], { llm: createLLM({}), retrieval: mockRetrieval(), trace: T() });
  assert.equal(r.status, "unverified");
  assert.deepEqual(r.source_urls, []);
});

test("Stage 2 with evidence: status computed from verified quotes, URLs from code", async () => {
  const llm = llmReplying(JSON.stringify({ judgments: [
    { source: 1, stance: "contradicts", quote: "Harvey offers LLM contract review with lawyer oversight" },
    { source: 2, stance: "contradicts", quote: "Robin AI combines AI review with a team of human lawyers" },
    { source: 3, stance: "supports", quote: "this quote is not in the page text" },
  ] }));
  const trace = T();
  const [r] = await classifyClaims([claim], { llm, retrieval: fakeRetrieval, trace });
  assert.equal(r.status, "contradicted");
  assert.deepEqual(r.source_urls, ["https://harvey.ai/p", "https://robin.ai/p"]);
  assert.match(r.reasoning, /0 independent sources support this claim; 2 contradict/);
  assert.ok(trace.record.events.some(e => e.kind === "judgment" && e.quote_verified === false));
});

test("Stage 2: retrieved evidence but no classifier → unverified", async () => {
  const [r] = await classifyClaims([claim], { llm: createLLM({}), retrieval: fakeRetrieval, trace: T() });
  assert.equal(r.status, "unverified");
});

test("Stage 2: bare-array model output → unverified", async () => {
  const [r] = await classifyClaims([claim], { llm: llmReplying('[{"source":1,"stance":"contradicts"}]'), retrieval: fakeRetrieval, trace: T() });
  assert.equal(r.status, "unverified");
});

test("Stage 2: retrieval failure is traced and abstains", async () => {
  const broken = { name: "broken", search: async () => { throw new Error("429"); }, fetchPages: async () => [] };
  const trace = T();
  const [r] = await classifyClaims([claim], { llm: llmReplying("{}"), retrieval: broken, trace });
  assert.equal(r.status, "unverified");
  assert.ok(trace.record.events.some(e => e.kind === "search_error"));
});

// ── Stage 3 ──
test("graveyard: obvious look-alikes match, unrelated ideas do not", () => {
  const top = t => matchGraveyard(t, GRAVEYARD_DB).map(m => m.company_name);
  assert.equal(top("AI legal contract review for startups with human lawyer oversight")[0], "Atrium");
  assert.equal(top("On-demand laundry pickup and same-day delivery app")[0], "Washio");
  assert.equal(top("Anonymous campus social network for posts from people nearby")[0], "Yik Yak");
  const camera = top("A marketplace for renting cameras between hobbyist photographers. Nobody does this well today.");
  assert.ok(!camera.includes("Jawbone") && !camera.includes("DAQRI"), "the old 'ar' substring bug is gone");
});

test("graveyard: similarity is 0–1, above threshold, at most 3", () => {
  const m = matchGraveyard("short-form video streaming for mobile creators with reels", GRAVEYARD_DB);
  assert.ok(m.length <= 3);
  for (const x of m) assert.ok(x.similarity >= MATCH_THRESHOLD && x.similarity <= 1);
});

// ── Stage 4 ──
test("objector filter drops approvals, verdicts and bad severities", () => {
  const kept = filterObjections([
    { objection: "This looks good and I recommend funding it.", severity: "low" },
    { objection: "There are no major concerns here.", severity: "low" },
    { objection: "Harvey already serves this segment.", severity: "high" },
    { objection: "Unit economics are unproven.", severity: "critical" },
  ]);
  assert.deepEqual(kept, [{ objection: "Harvey already serves this segment.", severity: "high" }]);
});

test("objector falls back to deterministic objections when the LLM only approves", async () => {
  const llm = createLLM({ objector: [{ name: "fake", model: "f", complete: async () => JSON.stringify({ objections: [{ objection: "Great idea, should proceed.", severity: "low" }] }) }] });
  const claims = [{ claim: "c", type: "novelty", status: "unverified" }];
  const out = await raiseObjections("idea", claims, [], { llm, trace: T() });
  assert.ok(out.length >= 2);
  assert.ok(out.every(o => !/great idea|should proceed/i.test(o.objection)));
});

test("deterministic objections never contain verdict words and are sorted by severity", () => {
  const claims = [
    { claim: "No one does X", type: "novelty", status: "contradicted" },
    { claim: "Market is $5B", type: "market_size", status: "unverified" },
  ];
  const matches = [{ company_name: "Atrium", year_closed: 2020, cause_of_death: "Unit economics", similarity: 0.4 }];
  const out = deterministicObjections(claims, matches);
  for (const o of out) assert.doesNotMatch(o.objection, /\b(verdict|clear|caution|high risk|approve)\b/i);
  assert.ok(out.some(o => o.severity === "high"));
});

test("sample idea end-to-end key-free has no fabricated sources", async () => {
  const { runScreen } = await import("../prototype/core/pipeline.js");
  const { report } = await runScreen(SAMPLE_IDEA, { graveyard: GRAVEYARD_DB });
  assert.ok(report.claims.every(c => c.status === "unverified" && c.source_urls.length === 0));
});
