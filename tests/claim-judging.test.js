// Claim judging mistakes seen in a live report (12 Nov 2026, "MedNote AI", an AI medical scribe):
// "No HIPAA-compliant AI medical scribe exists at under $100/month" was typed "other" and CONFIRMED by
// quotes listing such scribes at $39 and $49 a month.
import { test } from "node:test";
import assert from "node:assert/strict";
import { typeClaim } from "../prototype/core/rules.js";
import { classifyClaims, JUDGE_PROMPT, statesAbsence, isNonExistenceClaim } from "../prototype/core/stages/classify.js";
import { createLLM } from "../prototype/core/providers/llm.js";
import { createTrace } from "../prototype/core/trace.js";

const NONE = "No HIPAA-compliant AI medical scribe exists at under $100/month for solo practice physicians";

test("a 'no X exists' claim is a novelty claim, whatever X is", () => {
  assert.equal(typeClaim(NONE).type, "novelty");
  assert.equal(typeClaim("No affordable tool for solo dentists is available today").type, "novelty");
  assert.equal(typeClaim("The diabetes app market is worth $4.2B").type, "market_size", "market claims are unchanged");
});

test("non-existence claims and absence quotes are recognised", () => {
  assert.ok(isNonExistenceClaim(NONE));
  assert.ok(isNonExistenceClaim("Nobody offers same-day repairs with a warranty"));
  assert.ok(!isNonExistenceClaim("Physicians spend more than 3 hours daily on documentation"));
  assert.ok(statesAbsence("There is no affordable HIPAA-compliant scribe for solo practices."));
  assert.ok(statesAbsence("Solo physicians lack an affordable option."));
  assert.ok(!statesAbsence("Freed | Simple solo practice scribing | From $39/mo | Solo clinicians, small practices"));
});

const PAGES = [
  { url: "https://omnimd.com/blog/best-medical-ai-scribes/", title: "Best AI scribes", text: "Freed | Simple solo practice scribing | From $39/mo | Solo clinicians, small practices" },
  { url: "https://www.twofold.health/pricing", title: "Pricing", text: "Twofold Health | Lowest price, privacy-first | $49 to $69/mo | Solo and small practices" },
  { url: "https://news.example.org/x", title: "News", text: "Several AI scribes now sign a BAA and cost under $100 a month." },
];
const retrieval = { name: "fake", async search() { return PAGES.map(p => ({ url: p.url, title: p.title, snippet: "" })); }, async fetchPages(u) { return PAGES.filter(p => u.includes(p.url)); } };
// A judge that makes the live mistake: calls on-topic product listings "supports".
const wrongJudge = createLLM({ default: [{ name: "fake", model: "f", complete: async () => JSON.stringify({ judgments: PAGES.map((p, i) => ({ source: i + 1, stance: "supports", quote: p.text })) }) }] });

test("a 'support' for a non-existence claim must state an absence, or it does not count", async () => {
  const trace = createTrace({ ideaText: "x", mode: "test" });
  const [r] = await classifyClaims([{ claim: NONE, type: "novelty" }], { llm: wrongJudge, retrieval, trace });
  assert.notEqual(r.status, "confirmed", "product listings never confirm that no such product exists");
  assert.equal(r.status, "unverified");
  assert.ok(trace.finish().events.some(e => e.kind === "judgment_dropped" && e.reason === "support without an absence"));
});

test("the judge prompt spells out negation, thresholds and overreach", () => {
  assert.match(JUDGE_PROMPT, /does not exist[^]*contradicts/i);
  assert.match(JUDGE_PROMPT, /number or a threshold/i);
  assert.match(JUDGE_PROMPT, /general point/i);
});
