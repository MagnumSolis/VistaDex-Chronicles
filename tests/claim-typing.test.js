// Claim typing: a model may only call a claim "market_size" when the claim has market language or a
// market-sized number. A price for the product ("under $200 per month") is not the size of a market.
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractClaims } from "../prototype/core/stages/extract.js";
import { createTrace } from "../prototype/core/trace.js";

const PRICE = "The product offers AI contract review with a human lawyer backstop for a price under $200 per month";
const MARKET = "The global legal-tech market is worth $27 billion";
const WEIRD = "Teams switch tools every quarter";

function fakeLLM(types) {
  return {
    available: () => true,
    complete: async (_route, { messages }) => {
      const sys = messages[0].content;
      if (/Type each claim/.test(sys)) {
        const lines = messages[1].content.split("\n");
        return { content: JSON.stringify({ types: lines.map((l, i) => ({ index: i, type: types[l.replace(/^\d+\.\s*/, "")] || "other" })) }) };
      }
      return { content: JSON.stringify({ claims: [{ claim: PRICE }, { claim: MARKET }, { claim: WEIRD }] }) };
    },
  };
}

test("a price is never typed market_size, even if the model says so", async () => {
  const claims = await extractClaims(`${PRICE}. ${MARKET}. ${WEIRD}.`, { llm: fakeLLM({ [PRICE]: "market_size", [WEIRD]: "traction" }), trace: createTrace() });
  const type = text => claims.find(c => c.claim === text)?.type;
  assert.equal(type(PRICE), "other");
  assert.equal(type(MARKET), "market_size", "rules type real market claims");
  assert.equal(type(WEIRD), "traction", "other model types are kept");
});
