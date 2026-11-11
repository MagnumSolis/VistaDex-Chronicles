// analysis/study_analysis.mjs: the paper's numbers from a /export file. Synthetic events only; participant
// data never enters the repository.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, mannWhitney, parseExport, renderReport } from "../analysis/study_analysis.mjs";

let seq = 0;
const ev = (sid, type, payload, v = "2026-11-study-6") => ({ session_id: sid, seq: ++seq, ts: new Date(1_800_000_000_000 + seq * 1000).toISOString(), type, study_version: v, payload });

function studyPerson(sid, code, { b, v, order = ["baseline", "vistadex"], clicks = 0, idea = "A", votes = [] }) {
  const out = [ev(sid, "participant_registered", { code, role: null, track: "study", source: null })];
  const parts = {
    baseline: pos => [
      ev(sid, "condition_started", { condition: "baseline", idea_key: idea, order_position: pos }),
      ev(sid, "confidence_pre", { condition: "baseline", value: b[0], run_id: "b_1" }),
      ev(sid, "confidence_post", { condition: "baseline", run_id: "b_1", value: b[1] }),
      ev(sid, "condition_survey", { condition: "baseline", trust: 6, usefulness: 5, helpfulness: 3, effort: 2, open_text: "", sources_checked: "0" }),
      ev(sid, "condition_ended", { condition: "baseline", run_id: "b_1", verified_sources: 0 }),
    ],
    vistadex: pos => [
      ev(sid, "condition_started", { condition: "vistadex", idea_key: idea, order_position: pos }),
      ev(sid, "run_started", { run_id: "r_1", sample: `study_${idea}` }),
      ev(sid, "confidence_pre", { condition: "vistadex", value: v[0], run_id: "r_1", moved: true }),
      ...Array.from({ length: clicks }, () => ev(sid, "source_clicked", { run_id: "r_1", claim_index: 0, url: "https://a.example" })),
      ...votes.map(([i, status, vote]) => ev(sid, "claim_vote", { claim_index: i, run_id: "r_1", status, vote })),
      ev(sid, "confidence_post", { condition: "vistadex", run_id: "r_1", value: v[1] }),
      ev(sid, "condition_survey", { condition: "vistadex", trust: 4, usefulness: 6, helpfulness: 6, effort: 4, open_text: "", sources_checked: clicks ? "3+" : "0" }),
      ev(sid, "condition_ended", { condition: "vistadex", run_id: "r_1", verified_sources: clicks }),
    ],
  };
  order.forEach((c, i) => out.push(...parts[c](i + 1)));
  return out;
}
function fieldRun(sid, runId, pre, post, clicks) {
  return [
    ev(sid, "run_started", { run_id: runId, sample: null }),
    ev(sid, "confidence_pre", { condition: "vistadex", value: pre, run_id: runId, moved: true }),
    ...Array.from({ length: clicks }, () => ev(sid, "source_clicked", { run_id: runId, claim_index: 0, url: "https://a.example" })),
    ev(sid, "confidence_post", { condition: "vistadex", run_id: runId, value: post }),
  ];
}

const DATA = [
  ...studyPerson("s1", "P01", { b: [50, 70], v: [50, 40], clicks: 3, votes: [[0, "contradicted", "agree"], [1, "unverified", "disagree"], [1, "unverified", "agree"]] }),
  ...studyPerson("s2", "P02", { b: [40, 60], v: [40, 35], order: ["vistadex", "baseline"], votes: [[0, "confirmed", "agree"]] }),
  ...studyPerson("s3", "P03", { b: [60, 70], v: [60, 50], clicks: 1 }),
  ...studyPerson("s4", "TEST04", { b: [10, 90], v: [10, 90] }),
  ev("f1", "participant_registered", { code: "", role: null, track: "field", source: null }),
  ...fieldRun("f1", "r_a", 50, 60, 0),
  ...fieldRun("f1", "r_b", 60, 55, 2),
  ev("f2", "comprehension_check", { run_id: "r_x", answer: "honest_uncertainty" }),
];

test("pairs exclude TEST codes by default, include them on request", () => {
  const r = analyze(DATA);
  assert.equal(r.summary.studyParticipants, 3);
  assert.equal(r.summary.completePairs, 3);
  assert.deepEqual(r.summary.order, { "baseline-first": 2, "vistadex-first": 1, unknown: 0 });
  assert.equal(r.summary.excludedTestCodes, 1);
  assert.equal(analyze(DATA, { includeTest: true }).summary.studyParticipants, 4);
});

test("H1: confidence change per condition and paired difference", () => {
  const h1 = analyze(DATA).h1;
  assert.deepEqual(h1.chatbot.deltas, [20, 20, 10]);
  assert.deepEqual(h1.vistadex.deltas, [-10, -5, -10]);
  assert.deepEqual(h1.paired.diffs, [-30, -25, -20]);
  assert.equal(h1.paired.test.p, 0.25); // exact, n = 3, all negative: 2 / 8
});

test("H3: latest vote per item, agreement by claim status", () => {
  const h3 = analyze(DATA).h3;
  assert.deepEqual(h3.byClaimStatus.unverified, { votes: 1, agree: 1, disagree: 0, notSure: 0, agreePct: 100 });
  assert.deepEqual(h3.byClaimStatus.contradicted, { votes: 1, agree: 1, disagree: 0, notSure: 0, agreePct: 100 });
  assert.equal(h3.byClaimStatus.confirmed.votes, 1);
});

test("H4: runs with and without opened sources, and runs per session", () => {
  const h4 = analyze(DATA).h4;
  // study VistaDex runs (P01 3 clicks, P02 0, P03 1) and field runs r_a (0 clicks), r_b (2)
  assert.equal(h4.clickers.n, 3);
  assert.equal(h4.nonClickers.n, 2);
  assert.deepEqual(h4.byRunIndex.map(x => x.runs), [4, 1]);
});

test("Mann-Whitney U with a normal approximation", () => {
  const r = mannWhitney([1, 2, 3], [4, 5, 6]);
  assert.equal(r.u, 0);
  assert.equal(Math.round(r.p * 1000) / 1000, 0.081);
  assert.equal(mannWhitney([], [1]).p, null);
});

test("reads the /export CSV as well as JSON, and the report renders", () => {
  const csv = 'session_id,seq,ts,type,study_version,payload,received_at\ns1,2,2026-11-11T00:00:01Z,confidence_pre,v,"{""condition"":""baseline"",""value"":40,""run_id"":""b_1""}",x\ns1,1,2026-11-11T00:00:00Z,participant_registered,v,"{""code"":""P1"",""track"":""study""}",x';
  const evs = parseExport(csv);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].type, "participant_registered", "sorted by session and seq");
  assert.equal(evs[1].payload.value, 40);
  assert.equal(parseExport(JSON.stringify(DATA)).length, DATA.length);
  const md = renderReport(analyze(DATA));
  assert.match(md, /## H1/);
  assert.ok(!md.includes("—"), "no em dashes in the report");
});
