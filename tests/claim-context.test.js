// Claim context mistakes seen in a live report (28 Nov 2026, study Idea E, "Flatmate rent and bill splitter",
// market India):
// - "The app charges ₹99/month for its service" was checked on the web and found "support" in Google Play
//   Pass at Rs 99: a founder's own price is not a fact about the world.
// - "The app splits rent, electricity, and internet bills between flatmates" was "confirmed" by a UK bills
//   service: a description of the founder's own product, searched without the idea or the market.
// Claims about the founder's own product are not web-checked, and every claim is searched and judged with
// the idea and its target markets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractClaims, splitDeterministic, isOwnProductClaim, EXTRACT_PROMPT } from "../prototype/core/stages/extract.js";
import { classifyClaims, claimQuery, JUDGE_PROMPT } from "../prototype/core/stages/classify.js";
import { createLLM } from "../prototype/core/providers/llm.js";
import { createTrace } from "../prototype/core/trace.js";

const IDEA_E = "Flatmate rent and bill splitter. Split rent and utility bills with flatmates automatically, for renters in India. No app handles shared rent and bills for flatmates in India. India's residential rental market is worth $20B. We are building an app that splits rent, electricity and internet bills between flatmates and collects each share automatically over UPI, at ₹99/month. Our moat is partnerships with 30 housing societies in Bengaluru.";

const llmWith = replies => {
  let n = 0;
  const calls = [];
  return { calls, llm: createLLM({ default: [{ name: "fake", model: "f", complete: async req => { calls.push(req); return replies[n++] ?? "{}"; } }] }) };
};

test("claims about the founder's own product, its features or its price, are recognised", () => {
  for (const own of [
    "The app charges ₹99/month for its service",
    "The app splits rent, electricity, and internet bills between flatmates",
    "Our platform collects each share automatically over UPI",
    "We charge $15/month",
  ]) assert.ok(isOwnProductClaim(own), own);
  for (const world of [
    "No app handles shared rent and bills for flatmates in India",
    "India's residential rental market is worth $20B",
    "Our moat is partnerships with 30 housing societies in Bengaluru",
    "The app already has 2,000 paying users",
    "Existing tools only offer static question banks",
  ]) assert.ok(!isOwnProductClaim(world), world);
});

test("the splitter drops own-product claims (with a trace reason) and keeps claims about the world", async () => {
  const { llm } = llmWith([JSON.stringify({ claims: [
    { claim: "No app handles shared rent and bills for flatmates in India" },
    { claim: "India's residential rental market is worth $20B" },
    { claim: "The app splits rent, electricity, and internet bills between flatmates" },
    { claim: "The app charges ₹99/month for its service" },
    { claim: "Our moat is partnerships with 30 housing societies in Bengaluru" },
  ] }), JSON.stringify({ types: [] })]);
  const trace = createTrace({ ideaText: IDEA_E, mode: "test" });
  const claims = (await extractClaims(IDEA_E, { llm, trace })).map(c => c.claim);
  assert.deepEqual(claims, [
    "No app handles shared rent and bills for flatmates in India",
    "India's residential rental market is worth $20B",
    "Our moat is partnerships with 30 housing societies in Bengaluru",
  ]);
  const dropped = trace.finish().events.filter(e => e.kind === "claim_dropped" && /own product/.test(e.reason));
  assert.equal(dropped.length, 2);
});

test("the deterministic splitter drops them too", () => {
  const kept = splitDeterministic("The app charges ₹99/month for its service. India's residential rental market is worth $20B.");
  assert.deepEqual(kept, ["India's residential rental market is worth $20B"]);
});

test("the split prompt asks for self-contained claims about the world, not the product's price or features", () => {
  assert.doesNotMatch(EXTRACT_PROMPT, /pricing/i);
  assert.match(EXTRACT_PROMPT, /self-contained/i);
  assert.match(EXTRACT_PROMPT, /own product/i);
});

test("a claim's search carries the target markets it does not already name", () => {
  const ctx = { idea: "Flatmate rent and bill splitter", markets: ["India"] };
  assert.equal(claimQuery("Shared bill payments are common among renters", ctx), "Shared bill payments are common among renters India");
  assert.equal(claimQuery("No app handles shared rent and bills for flatmates in India", ctx), "No app handles shared rent and bills for flatmates in India");
  assert.equal(claimQuery("Renters split bills", {}), "Renters split bills", "no markets: the claim alone, as before");
  assert.ok(claimQuery("x".repeat(300), ctx).length <= 200);
});

test("the judge sees the idea and its markets, and a source about another country is irrelevant", async () => {
  const queries = [];
  const page = { url: "https://example.co.uk/split", title: "Split the Bills", text: "Best for splitting UK utility bills at the source." };
  const retrieval = { name: "fake", async search(q) { queries.push(q); return [{ url: page.url, title: page.title, snippet: "" }]; }, async fetchPages() { return [page]; } };
  const { llm, calls } = llmWith([JSON.stringify({ judgments: [{ source: 1, stance: "irrelevant", quote: "" }] })]);
  const trace = createTrace({ ideaText: IDEA_E, mode: "test" });
  const context = { idea: "Flatmate rent and bill splitter: Split rent and utility bills with flatmates automatically, for renters in India.", markets: ["India"] };
  await classifyClaims([{ claim: "Flatmates struggle to split utility bills fairly", type: "other" }], { llm, retrieval, trace, context });
  assert.equal(queries[0], "Flatmates struggle to split utility bills fairly India");
  const user = calls[0].messages.find(m => m.role === "user").content;
  assert.match(user, /Idea: Flatmate rent and bill splitter/);
  assert.match(user, /Target markets: India/);
  assert.match(JUDGE_PROMPT, /another country/i);
});
