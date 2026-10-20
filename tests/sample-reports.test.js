// The sample-report fixture: every piece of research is recorded (URL, word-for-word quote, date checked),
// and every status, lead, TAM, score and band is derived by the pipeline's own code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAVEYARD_CHECKS, SAMPLE_CHECKED, SAMPLE_IDEAS } from "../prototype/data/sample-reports.js";
import { buildSampleReport, NOT_RESEARCHED, sampleLeads, sampleReports } from "../prototype/core/sample-reports.js";
import { validateContract } from "../prototype/core/contract.js";
import { computeStatus } from "../prototype/core/evidence.js";
import { buildIdeaText, validateInput } from "../prototype/core/input.js";
import { namedIn, MIN_QUOTE_CHARS } from "../prototype/core/quotes.js";
import { overlapBand, scoreReport } from "../prototype/core/scoring.js";

const recorded = (x, what) => {
  assert.match(x.url, /^https:\/\//, `${what}: url`);
  assert.ok(String(x.quote).trim().length >= MIN_QUOTE_CHARS, `${what}: quote`);
  assert.equal(x.checked, SAMPLE_CHECKED, `${what}: date checked`);
};

test("15 fixed sample ideas, valid input, 3–5 claims each, varied industries, roles and markets", () => {
  assert.equal(SAMPLE_IDEAS.length, 15);
  assert.equal(new Set(SAMPLE_IDEAS.map(i => i.id)).size, 15);
  for (const i of SAMPLE_IDEAS) {
    assert.deepEqual(validateInput(i.input), [], i.id);
    assert.ok(i.claims.length >= 3 && i.claims.length <= 5, i.id);
  }
  assert.ok(new Set(SAMPLE_IDEAS.flatMap(i => i.input.industries)).size >= 8);
  assert.equal(new Set(SAMPLE_IDEAS.map(i => i.input.role)).size, 3);
  assert.equal(new Set(SAMPLE_IDEAS.flatMap(i => i.input.markets)).size, 3);
});

test("every evidence item, competitor, Big Tech label and graveyard check records url, quote and date", () => {
  for (const i of SAMPLE_IDEAS) {
    for (const c of i.claims) for (const e of c.evidence) { recorded(e, `${i.id} evidence`); assert.ok(["supports", "contradicts"].includes(e.stance)); }
    for (const c of i.competitors || []) { recorded(c, `${i.id} competitor ${c.name}`); assert.ok(namedIn(c.quote, c.name), `${c.name} named in its quote`); }
    for (const l of i.big_tech?.labels || []) recorded(l, `${i.id} big tech ${l.company}`);
    if (i.competitors) assert.ok(i.competitor_search?.pages.length > 0, `${i.id}: pages read recorded`);
  }
  for (const [id, g] of Object.entries(GRAVEYARD_CHECKS)) { recorded(g, `graveyard ${id}`); assert.ok(Number.isInteger(g.year_closed)); }
});

test("every graveyard lead the seed matches has a recorded closure check", () => {
  for (const i of SAMPLE_IDEAS) {
    for (const l of sampleLeads(buildIdeaText(i.input))) assert.ok(!l.unchecked, `${i.id}: ${l.company_name} matched but unchecked`);
  }
});

test("the built reports validate; statuses, scores and bands come from the code", () => {
  for (const { id, report } of sampleReports()) {
    const idea = SAMPLE_IDEAS.find(i => i.id === id);
    assert.deepEqual(validateContract(report), [], id);
    report.claims.forEach((c, k) => {
      const ev = idea.claims[k].evidence;
      assert.equal(c.status, ev.length ? computeStatus(ev).status : "unverified", `${id} claim ${k}`);
      if (!ev.length) assert.equal(c.reasoning, NOT_RESEARCHED);
    });
    const { scores, overlap_band, ...rest } = report;
    assert.deepEqual(scores, scoreReport(rest), id);
    assert.equal(overlap_band, overlapBand(rest), id);
    // TAM only from a confirmed market-size claim's quote
    if (report.market?.tam) assert.ok(report.claims.some(c => c.type === "market_size" && c.status === "confirmed" && c.evidence.some(e => e.quote === report.market.tam.quote)));
    assert.equal(report.sample_fields, undefined, `${id}: no placeholder fields`);
  }
});

test("building is deterministic", () => {
  assert.deepEqual(buildSampleReport(SAMPLE_IDEAS[0]), buildSampleReport(SAMPLE_IDEAS[0]));
});
