// study-19: appropriate reliance (BITS F364 L20-21; Kim et al. FAccT 2024). The analysis pools every study
// version (the earlier participants stay in, tagged with the version they saw), reads what each judgement was
// based on, sets each claim vote against a team-written answer key (over- and under-reliance), and counts the
// "This looks wrong" flags from the public report.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeStudy, relianceMatrix, DEFAULT_ANSWER_KEY } from "../worker/src/research-join.js";

let seq = 0;
const e = (sid, type, payload, v = "2026-11-study-19") => ({ session_id: sid, seq: ++seq, ts: String(seq).padStart(4, "0"), type, study_version: v, payload });
const REPORT = { score: 50, sources: 2, domains: 2, sample_fields: [], competitors: [], graveyard: [], objections: [], big_tech: null, legal: null, market: null,
  claims: [
    { claim: "No such tool exists.", status: "contradicted", urls: [] },
    { claim: "The diabetes app market is worth $4.2B and growing 15% annually.", status: "unverified", urls: [] },
    { claim: "Our moat is a nutrition model trained on 200,000 anonymized diabetic meal logs.", status: "confirmed", urls: [] },
  ] };
function person(sid, code, v, { basis, votes } = {}) {
  const survey = (condition) => ({ condition, trust: 5, usefulness: 5, helpfulness: 5, effort: 3, open_text: "", sources_checked: "1-2", ...(basis ? { basis } : {}) });
  return [
    e(sid, "participant_registered", { code, track: "study", role: null, source: "direct" }, v),
    e(sid, "condition_started", { condition: "baseline", idea_key: "A", order_position: 1 }, v),
    e(sid, "confidence_pre", { condition: "baseline", value: 50, run_id: "b_1" }, v),
    e(sid, "confidence_post", { condition: "baseline", value: 40, run_id: "b_1" }, v),
    e(sid, "condition_survey", survey("baseline"), v),
    e(sid, "condition_started", { condition: "vistadex", idea_key: "A", order_position: 2 }, v),
    e(sid, "confidence_pre", { condition: "vistadex", value: 40, run_id: "r_1" }, v),
    e(sid, "run_started", { run_id: "r_1", sample: "study_A" }, v),
    e(sid, "vistadex_report_snapshot", { run_id: "r_1", idea_key: "A", trace_id: null, report: REPORT }, v),
    ...(votes || []).map((vote, i) => e(sid, "claim_vote", { run_id: "r_1", claim_index: i, status: REPORT.claims[i].status, vote }, v)),
    e(sid, "confidence_post", { condition: "vistadex", value: 30, run_id: "r_1" }, v),
    e(sid, "condition_survey", survey("vistadex"), v),
  ];
}
const KEY = { A: [
  { match: ["no such tool"], truth: "false", source: "https://example.org/levels" },
  { match: ["diabetes app market"], truth: "unknown", source: "" },
  { match: ["moat", "meal logs"], truth: "unknown", source: "" },
] };

test("earlier study versions stay in the analysis, tagged with the version each participant saw", () => {
  const A = analyzeStudy([...person("s1", "P07", "2026-11-study-18"), ...person("s2", "P50", "2026-11-study-19")]);
  assert.deepEqual(A.pairs.map(p => [p.code, p.version, p.complete]), [["P07", "2026-11-study-18", true], ["P50", "2026-11-study-19", true]]);
});

test("what a judgement was based on: read per part; null when that version did not ask", () => {
  const A = analyzeStudy([...person("s1", "P07", "2026-11-study-18"), ...person("s2", "P50", "2026-11-study-19", { basis: ["answer", "own_search"] })]);
  assert.equal(A.pairs[0].vistadex.basis, null);
  assert.deepEqual(A.pairs[1].baseline.basis, ["answer", "own_search"]);
  assert.equal(A.basis.vistadex.asked, 1);
  assert.equal(A.basis.vistadex.counts.own_search, 1);
});

test("reliance matrix: each claim vote against the answer key (accept or override, VistaDex right or wrong)", () => {
  // Claim 1 contradicted, key false: VistaDex right. Claim 2 unverified, key unknown: right. Claim 3 confirmed, key unknown: wrong.
  const ev = [...person("s2", "P50", "2026-11-study-19", { votes: ["agree", "disagree", "agree"] })];
  const m = relianceMatrix(ev, KEY);
  assert.deepEqual({ ap: m.appropriateReliance, under: m.underReliance, over: m.overReliance, override: m.appropriateOverride }, { ap: 1, under: 1, over: 1, override: 0 });
  assert.equal(m.keyed, 3);
  assert.equal(m.byParticipant[0].code, "P50");
});

test("the default answer key has no truths until the team fills it in, and says so", () => {
  const ev = [...person("s2", "P50", "2026-11-study-19", { votes: ["agree", "agree", "agree"] })];
  const m = relianceMatrix(ev, DEFAULT_ANSWER_KEY);
  assert.equal(m.keyed, 0);
  assert.equal(m.unkeyed, 3);
  assert.equal(m.keyReady, false);
  assert.ok(Object.keys(DEFAULT_ANSWER_KEY).includes("A"));
});

test("'This looks wrong' flags from the public report are counted by kind and status", () => {
  const ev = [
    e("f1", "report_flag", { run_id: "r_9", kind: "claim", index: 0, status: "confirmed", severity: null }),
    e("f1", "report_flag", { run_id: "r_9", kind: "objection", index: 1, status: null, severity: "high" }),
    e("f2", "report_flag", { run_id: "r_8", kind: "claim", index: 2, status: "confirmed", severity: null }),
  ];
  const A = analyzeStudy(ev);
  assert.deepEqual(A.flags, { total: 3, claim: 2, objection: 1, runs: 2, byStatus: { confirmed: 2 } });
});
