// The objector argues from the draft it is given. Each claim line carries how many independent sources
// support and contradict it, so an objection cannot say "no source was provided" for a claim that four
// independent sources contradict.
import { test } from "node:test";
import assert from "node:assert/strict";
import { raiseObjections } from "../prototype/core/stages/objector.js";
import { createTrace } from "../prototype/core/trace.js";

test("each claim in the objector's draft states its supporting and contradicting source counts", async () => {
  let prompt = "";
  const llm = { available: () => true, complete: async (_r, { messages }) => { prompt = messages[1].content; return { content: '{"objections":[{"objection":"The market figure is contradicted by four sources.","severity":"high"}]}', provider: "fake" }; } };
  const claims = [
    { claim: "The legal-tech market is worth $27 billion", type: "market_size", status: "contradicted", source_urls: [],
      evidence: [
        { url: "https://www.gartner.com/a", stance: "contradicts" }, { url: "https://news.gartner.com/b", stance: "contradicts" },
        { url: "https://mordorintelligence.com/c", stance: "contradicts" }, { url: "https://statista.com/d", stance: "contradicts" },
        { url: "https://legal.io/e", stance: "supports" },
      ] },
    { claim: "No tool does this", type: "novelty", status: "unverified", source_urls: [] },
  ];
  await raiseObjections("idea", claims, [], { llm, trace: createTrace() });
  assert.match(prompt, /1\. \[market_size\] \[contradicted\] \(independent sources: 1 support, 3 contradict\) The legal-tech market/);
  assert.match(prompt, /2\. \[novelty\] \[unverified\] \(independent sources: 0 support, 0 contradict\) No tool does this/);
});
