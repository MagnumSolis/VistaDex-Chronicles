import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIdeaText, FIELD_LIMITS, MAX_IDEA_CHARS, normalizeInput, validateInput } from "../prototype/core/input.js";
import { typeClaim } from "../prototype/core/rules.js";
import { splitDeterministic } from "../prototype/core/stages/extract.js";

test("per-field limits add up to the 6,000-character limit or less", () => {
  assert.ok(Object.values(FIELD_LIMITS).reduce((a, b) => a + b, 0) <= MAX_IDEA_CHARS);
});

test("buildIdeaText joins title, pitch, problem, solution and moat as sentences", () => {
  const text = buildIdeaText({ title: "LegalAI", pitch: "AI contract review", problem: "Reviews are slow!", solution: "No such tool exists today.", moat: "" });
  assert.equal(text, "LegalAI. AI contract review. Reviews are slow! No such tool exists today.");
});

test("normalizeInput trims, cuts to the limits and drops unknown list values", () => {
  const n = normalizeInput({ title: "  a  b ", pitch: "x".repeat(400), industries: ["Fintech", "Space", "Fintech"], role: "ceo", markets: ["EU", "Mars"] });
  assert.equal(n.title, "a b");
  assert.equal(n.pitch.length, FIELD_LIMITS.pitch);
  assert.deepEqual(n.industries, ["Fintech"]);
  assert.equal(n.role, null);
  assert.deepEqual(n.markets, ["EU"]);
});

test("validateInput requires title, pitch, problem and solution", () => {
  assert.deepEqual(validateInput({ title: "t", pitch: "", problem: "p", solution: "" }).map(e => e.field), ["pitch", "solution"]);
  assert.deepEqual(validateInput({ title: "t", pitch: "p", problem: "p", solution: "s" }), []);
});

test("traction claims are typed as traction", () => {
  for (const t of ["We have 1,200 paying users and $40k MRR", "Three hospitals have signed LOIs for a paid pilot", "We reached $1M ARR"]) {
    const r = typeClaim(t);
    assert.equal(r.type, "traction", t);
    assert.equal(r.confident, true, t);
  }
  assert.equal(typeClaim("The legal-tech market is worth $27B globally").type, "market_size");
  assert.ok(splitDeterministic("We already have 1,200 paying users across 40 clinics.").length === 1);
});
