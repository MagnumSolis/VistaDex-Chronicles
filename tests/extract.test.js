import { test } from "node:test";
import assert from "node:assert/strict";
import { typeClaim, isFalsifiable } from "../prototype/core/rules.js";
import { extractClaims, splitDeterministic } from "../prototype/core/stages/extract.js";
import { createLLM } from "../prototype/core/providers/llm.js";
import { createTrace } from "../prototype/core/trace.js";
import { SAMPLE_IDEA } from "../prototype/data/cohort.js";

const fake = replies => {
  let n = 0;
  const calls = [];
  return { name: "fake", model: "f", calls, complete: async req => { calls.push(req); return replies[n++]; } };
};

test("rules type the obvious cases confidently", () => {
  const cases = [
    ["The mental health app market is worth $5.8B globally and growing at 20% annually", "market_size"],
    ["No such tool exists today that combines LLM-based review with a human lawyer backstop at under $200/month", "novelty"],
    ["Our competitive moat is the AI classification model trained on 50,000 transcripts", "defensibility"],
    ["Big law firms cannot easily replicate this because of hourly billing", "defensibility"],
    ["A $30/month price point is viable for clinical monitoring", "other"],
  ];
  for (const [text, type] of cases) {
    const t = typeClaim(text);
    assert.equal(t.type, type, text);
    assert.equal(t.confident, true, text);
  }
});

test("rules abstain (not confident) when nothing matches", () => {
  const t = typeClaim("Users love the experience");
  assert.equal(t.confident, false);
  assert.equal(t.type, "other");
});

test("descriptive sentences are dropped, checkable ones kept", () => {
  assert.equal(isFalsifiable("We are building an app that helps people journal"), false);
  assert.equal(isFalsifiable("Nobody offers this in India"), true);
  const kept = splitDeterministic(SAMPLE_IDEA);
  assert.equal(kept.length, 4);
  assert.ok(!kept.some(k => k.startsWith("We are building")));
});

test("key-free extraction of the sample idea is rules-only", async () => {
  const trace = createTrace({ ideaText: SAMPLE_IDEA, mode: "test" });
  const claims = await extractClaims(SAMPLE_IDEA, { llm: createLLM({}), trace });
  assert.deepEqual(claims.map(c => c.type), ["novelty", "market_size", "novelty", "defensibility"]);
  const routers = trace.record.events.filter(e => e.kind === "claim_typed").map(e => e.router);
  assert.ok(routers.every(r => r === "rules"));
});

test("LLM path: ungrounded claims dropped, only uncertain claims sent for typing", async () => {
  const idea = "Users love the clean design of our app. The market is worth $4B. Our moat is proprietary data.";
  const backend = fake([
    JSON.stringify({ claims: [
      { claim: "Users love the clean design of our app" },
      { claim: "The market is worth $4B" },
      { claim: "Our moat is proprietary data" },
      { claim: "Tesla will acquire the company next quarter for sure" },
    ] }),
    JSON.stringify({ types: [{ index: 0, type: "other" }] }),
  ]);
  const trace = createTrace({ ideaText: idea, mode: "test" });
  const claims = await extractClaims(idea, { llm: createLLM({ extract: [backend] }, trace), trace });
  assert.deepEqual(claims.map(c => c.claim), ["Users love the clean design of our app", "The market is worth $4B", "Our moat is proprietary data"]);
  assert.deepEqual(claims.map(c => c.type), ["other", "market_size", "defensibility"]);
  assert.equal(backend.calls.length, 2);
  assert.ok(!backend.calls[1].messages[1].content.includes("$4B"), "confident claims are not sent to the LLM");
  const routers = trace.record.events.filter(e => e.kind === "claim_typed").map(e => e.router);
  assert.deepEqual(routers, ["llm", "rules", "rules"]);
  assert.ok(trace.record.events.some(e => e.kind === "claim_dropped" && e.reason === "not grounded in idea text"));
});

test("LLM returning a bare array falls back to deterministic split", async () => {
  const backend = fake(['[{"claim":"The market is worth $5.8B globally"}]', JSON.stringify({ types: [] })]);
  const trace = createTrace({ ideaText: SAMPLE_IDEA, mode: "test" });
  const claims = await extractClaims(SAMPLE_IDEA, { llm: createLLM({ extract: [backend] }, trace), trace });
  assert.equal(claims.length, 4);
  assert.ok(trace.record.events.some(e => e.kind === "split" && e.router === "llm" && e.error));
});
