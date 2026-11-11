import { test } from "node:test";
import assert from "node:assert/strict";
import { noveltyAxis, defensibilityAxis, graveyardAxis, marketAxis, evidenceAxis, bigTechAxis, overlapBand, scoreReport } from "../prototype/core/scoring.js";
import { finalizeReport, applySamples } from "../prototype/core/finalize.js";
import { validateContract } from "../prototype/core/contract.js";
import { runScreen } from "../prototype/core/pipeline.js";
import { MOCK_SAMPLES } from "../prototype/data/samples.js";
import { GRAVEYARD_DB } from "../prototype/data/graveyard.js";

const claim = (type, status, n = 0) => ({ claim: `${type} ${status}`, type, status, reasoning: "", source_urls: Array.from({ length: n }, (_, i) => `https://s${i}.example/x`) });
const base = (over = {}) => ({ idea_text: "x", claims: [], graveyard_matches: [], objections: [], ...over });
const searched = (sources = 5) => ({ competitors: { queries: ["q"], sources_checked: sources }, graveyard: { entries_checked: 18, verified_entries: 0 } });

test("novelty: competitors pull it down, confirmed claims nudge it up", () => {
  const r = base({ search: searched(), competitors: [{ name: "A" }, { name: "B" }], claims: [claim("novelty", "confirmed", 2)] });
  assert.equal(noveltyAxis(r).value, 100 - 24 + 5);
  const many = base({ search: searched(), competitors: Array.from({ length: 9 }, (_, i) => ({ name: `C${i}` })) });
  assert.equal(noveltyAxis(many).value, 100 - 60, "counts at most 5 competitors");
});

test("novelty: a contradicted novelty claim pulls it down hard and caps it at 40", () => {
  const r = base({ search: searched(), competitors: [{ name: "A" }], claims: [claim("novelty", "contradicted", 2)] });
  assert.equal(noveltyAxis(r).value, 40);
  const two = base({ search: searched(), competitors: [{ name: "A" }, { name: "B" }, { name: "C" }], claims: [claim("novelty", "contradicted", 2), claim("novelty", "contradicted", 2)] });
  assert.equal(noveltyAxis(two).value, 100 - 36 - 60);
});

test("novelty: finding no competitors is capped at 70 and says how many sources were searched", () => {
  const a = noveltyAxis(base({ search: searched(7), competitors: [] }));
  assert.equal(a.value, 70);
  assert.match(a.note, /No competitors found in 7 sources searched/);
  assert.match(a.boundary, /7 sources read/);
  // a confirmed novelty claim lifts the cap
  assert.equal(noveltyAxis(base({ search: searched(), competitors: [], claims: [claim("novelty", "confirmed", 2)] })).value, 100);
});

test("novelty: no search and no checked novelty claim → Not enough data", () => {
  const a = noveltyAxis(base({ claims: [claim("novelty", "unverified")] }));
  assert.equal(a.value, null);
  assert.ok(a.reason);
});

test("defensibility: a stated moat is at most +10; claims and moat objections move it", () => {
  const moat = { title: "t", pitch: "p", problem: "p", solution: "s", moat: "Exclusive data partnerships with three hospital groups", industries: [], role: null, markets: [] };
  const r = base({ input: moat, claims: [claim("defensibility", "confirmed", 2)] });
  assert.equal(defensibilityAxis(r).value, 50 + 10 + 15);
  const noMoat = base({ claims: [claim("defensibility", "confirmed", 2)] });
  assert.equal(defensibilityAxis(noMoat).value, 50 + 15);
  const hit = base({ input: moat, claims: [claim("defensibility", "contradicted", 2)], objections: [{ objection: "Incumbents could easily copy this; there is no real moat.", severity: "high" }] });
  assert.equal(defensibilityAxis(hit).value, 50 + 10 - 25 - 15);
});

test("defensibility: a stated moat alone is not evidence → Not enough data", () => {
  const r = base({ input: { moat: "Our proprietary model trained on unique data that nobody else has" } });
  assert.equal(defensibilityAxis(r).value, null);
});

test("graveyard distance = 100 × (1 − strongest similarity); no matches → 100; shows the seed checked", () => {
  const r = base({ search: searched(), graveyard_matches: [{ similarity: 0.37 }, { similarity: 0.2 }] });
  assert.equal(graveyardAxis(r).value, 63);
  const none = graveyardAxis(base({ search: searched() }));
  assert.equal(none.value, 100);
  assert.equal(none.boundary, "Checked against 18 entries (unverified seed)");
});

test("market: log scale, $10M → 0, $1B → 100, capped above; no TAM → Not enough data", () => {
  const tam = usd => base({ market: { tam: { value_usd: usd, citation: { name: "c", url: "https://c.example" } } } });
  assert.equal(marketAxis(tam(1e7)).value, 0);
  assert.equal(marketAxis(tam(1e8)).value, 50);
  assert.equal(marketAxis(tam(1e9)).value, 100);
  assert.equal(marketAxis(tam(2.7e10)).value, 100);
  assert.match(marketAxis(tam(2.7e10)).note, /Capped/);
  assert.equal(marketAxis(tam(5e6)).value, 0);
  assert.equal(marketAxis(base()).value, null);
});

test("evidence quality = share of claims with a status and ≥ 2 independent sources", () => {
  const r = base({ claims: [claim("other", "confirmed", 2), claim("other", "disputed", 2), claim("other", "unverified", 3), claim("other", "confirmed", 1)] });
  assert.equal(evidenceAxis(r).value, 50);
  assert.equal(evidenceAxis(base()).value, null);
});

test("Big Tech: only low/medium/high have a safety value; unverified and none_found do not", () => {
  const level = l => bigTechAxis(base({ big_tech_risk: { level: l, companies_checked: [], sources_checked: 4 } })).value;
  assert.equal(level("high"), 0);
  assert.equal(level("medium"), 50);
  assert.equal(level("unverified"), null);
  assert.equal(level("none_found"), null);
});

test("VistaDex Score: weighted mean re-normalised over available axes; Big Tech not counted; exclusions listed", () => {
  const r = base({
    search: searched(), competitors: [{ name: "A" }],          // novelty 88
    claims: [claim("defensibility", "confirmed", 2)],            // defensibility 65, evidence 100
    graveyard_matches: [{ similarity: 0.4 }],                    // graveyard 60
    big_tech_risk: { level: "high", companies_checked: [], sources_checked: 3 },
  });
  const { vistadex, axes } = scoreReport(r);
  assert.deepEqual([axes.novelty.value, axes.defensibility.value, axes.graveyard.value, axes.evidence.value, axes.market.value], [88, 65, 60, 100, null]);
  // weights 25, 20, 15, 10 → (25·88 + 20·65 + 15·60 + 10·100) / 70
  assert.equal(vistadex.value, Math.round((25 * 88 + 20 * 65 + 15 * 60 + 10 * 100) / 70));
  assert.deepEqual(vistadex.excluded.map(e => e.axis).sort(), ["big_tech", "legal", "market"]);
  assert.equal(vistadex.used.reduce((s, u) => s + u.share, 0).toFixed(2), "1.00");
});

test("VistaDex Score needs at least 3 axes and half the weight", () => {
  const r = base({ search: { graveyard: { entries_checked: 18, verified_entries: 0 } }, claims: [claim("other", "unverified")] });
  const { vistadex } = scoreReport(r); // only graveyard + evidence
  assert.equal(vistadex.value, null);
  assert.match(vistadex.reason, /Not enough data/);
});

test("overlap band: clear < 0.3 ≤ caution < 0.5 ≤ high; 3+ competitors is high", () => {
  const band = (sim, comps = 0) => overlapBand(base({ graveyard_matches: sim === null ? [] : [{ similarity: sim }], competitors: Array.from({ length: comps }, () => ({})) }));
  assert.equal(band(null), "clear");
  assert.equal(band(0.29), "clear");
  assert.equal(band(0.3), "caution");
  assert.equal(band(0.49), "caution");
  assert.equal(band(0.5), "high");
  assert.equal(band(0.1, 3), "high");
});

test("finalizeReport adds overlap band and scores and stays a valid contract", () => {
  const r = finalizeReport(applySamples(base({ claims: [claim("novelty", "unverified")] }), MOCK_SAMPLES));
  assert.deepEqual(validateContract(r), []);
  assert.deepEqual(r.sample_fields, ["competitors", "big_tech_risk", "market", "legal"]);
  assert.equal(r.scores.axes.novelty.sample, true);
  assert.equal(r.scores.axes.market.sample, true);
});

test("mock pipeline with samples marks the sample-based axes; without samples, never invents them", async () => {
  const input = { title: "LegalAI", pitch: "AI contract review for startups", problem: "Contracts are slow to review.", solution: "No such tool exists today that combines LLM review with a lawyer backstop under $200/month.", moat: "", industries: ["AI/ML"], role: "founder", markets: ["EU"] };
  const withSamples = (await runScreen(input, { graveyard: GRAVEYARD_DB, samples: MOCK_SAMPLES })).report;
  assert.deepEqual(validateContract(withSamples), []);
  assert.equal(withSamples.input.title, "LegalAI");
  assert.equal(withSamples.search.graveyard.entries_checked, GRAVEYARD_DB.length);
  assert.ok(withSamples.scores.vistadex.sample);
  const plain = (await runScreen(input, { graveyard: GRAVEYARD_DB })).report;
  for (const k of ["competitors", "big_tech_risk", "market", "legal", "sample_fields"]) assert.equal(plain[k], undefined, k);
  assert.equal(plain.scores.axes.market.value, null);
  assert.equal(plain.scores.axes.novelty.value, null);
});
