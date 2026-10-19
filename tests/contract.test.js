import { test } from "node:test";
import assert from "node:assert/strict";
import { toContract, validateContract } from "../prototype/core/contract.js";
import { runScreen } from "../prototype/core/pipeline.js";
import { GRAVEYARD_DB } from "../prototype/data/graveyard.js";
import { SAMPLE_IDEA } from "../prototype/data/cohort.js";

test("toContract abstains on unknown values", () => {
  const r = toContract({
    idea_text: "x",
    claims: [{ claim: "c", type: "weird", status: "probably", reasoning: 1 }],
    graveyard_matches: [{ company_name: "A", similarity: 87 }],
    objections: [{ objection: "o", severity: "critical" }],
  });
  assert.equal(r.claims[0].type, "other");
  assert.equal(r.claims[0].status, "unverified");
  assert.deepEqual(r.claims[0].source_urls, []);
  assert.equal(r.graveyard_matches[0].similarity, 1);
  assert.equal(r.objections[0].severity, "low");
  assert.deepEqual(validateContract(r), []);
});

test("validateContract flags broken reports", () => {
  assert.ok(validateContract({}).length > 0);
  assert.ok(validateContract({ idea_text: "", claims: [{ claim: "a", type: "novelty", status: "maybe", reasoning: "", source_urls: [] }], graveyard_matches: [], objections: [] }).length > 0);
});

test("pipeline output matches the contract exactly", async () => {
  const { report, trace } = await runScreen(SAMPLE_IDEA, { graveyard: GRAVEYARD_DB });
  assert.deepEqual(validateContract(report), []);
  assert.deepEqual(Object.keys(report).sort(), ["claims", "graveyard_matches", "idea_text", "objections", "overlap_band", "scores", "search"]);
  assert.equal(report.idea_text, SAMPLE_IDEA);
  assert.ok(trace.trace_id);
  assert.ok(trace.events.length > 0);
});
