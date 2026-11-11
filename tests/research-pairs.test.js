// The paired, within-subjects view of the study track (worker/src/research-join.js): one row per participant
// code with both conditions side by side, and the exact Wilcoxon signed-rank test the console reports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pairedParticipants, wilcoxon } from "../worker/src/research-join.js";

let seq = 0;
const ev = (sid, type, payload) => ({ session_id: sid, seq: ++seq, ts: new Date(1_800_000_000_000 + seq * 1000).toISOString(), type, payload });

// A study-5+ participant: chatbot first, then VistaDex, every measure under its condition's run id.
function participant(sid, code, { idea = "C", b = [40, 60], v = [40, 30], bSurvey = 5, vSurvey = 3, clicks = 2, order = ["baseline", "vistadex"] } = {}) {
  const out = [ev(sid, "participant_registered", { code, role: "student", track: "study", source: null })];
  const parts = {
    baseline: (pos) => [
      ev(sid, "condition_started", { condition: "baseline", idea_key: idea, order_position: pos }),
      ev(sid, "confidence_pre", { condition: "baseline", value: b[0], run_id: "b_000000000001" }),
      ev(sid, "confidence_post", { condition: "baseline", run_id: "b_000000000001", value: b[1] }),
      ev(sid, "condition_survey", { condition: "baseline", trust: bSurvey, usefulness: bSurvey, helpfulness: bSurvey, effort: 3, open_text: "", sources_checked: "0" }),
      ev(sid, "condition_ended", { condition: "baseline", run_id: "b_000000000001", verified_sources: 0 }),
    ],
    vistadex: (pos) => [
      ev(sid, "condition_started", { condition: "vistadex", idea_key: idea, order_position: pos }),
      ev(sid, "run_started", { run_id: "r_00000000000a", sample: `study_${idea}`, role: null, industries: [], markets: [], mode: "live", idea_chars: 300, field_chars: {} }),
      ev(sid, "confidence_pre", { condition: "vistadex", value: v[0], run_id: "r_00000000000a", moved: true }),
      ...Array.from({ length: clicks }, (_, i) => ev(sid, "source_clicked", { run_id: "r_00000000000a", claim_index: i, url: "https://a.example" })),
      ev(sid, "confidence_post", { condition: "vistadex", run_id: "r_00000000000a", value: v[1] }),
      ev(sid, "claim_vote", { claim_index: 0, run_id: "r_00000000000a", status: "contradicted", vote: "agree" }),
      ev(sid, "condition_survey", { condition: "vistadex", trust: vSurvey, usefulness: vSurvey, helpfulness: vSurvey, effort: 4, open_text: "", sources_checked: "3+" }),
      ev(sid, "run_scoped_survey", { run_id: "r_00000000000a", condition: "vistadex", trust: vSurvey, usefulness: vSurvey, helpfulness: vSurvey, effort: 4, open_text: "", sources_checked: "3+" }),
      ev(sid, "condition_ended", { condition: "vistadex", run_id: "r_00000000000a", verified_sources: clicks }),
    ],
  };
  order.forEach((c, i) => out.push(...parts[c](i + 1)));
  return out;
}

test("one row per participant code, both conditions side by side", () => {
  const rows = pairedParticipants([...participant("s1", "P01"), ...participant("s2", "P02", { order: ["vistadex", "baseline"], idea: "A" })]);
  assert.equal(rows.length, 2);
  const p1 = rows.find(r => r.code === "P01");
  assert.equal(p1.complete, true);
  assert.equal(p1.order, "baseline-first");
  assert.equal(p1.orderInferred, false);
  assert.equal(p1.idea, "C");
  assert.deepEqual(
    { pre: p1.baseline.pre, post: p1.baseline.post, delta: p1.baseline.delta, trust: p1.baseline.trust, sources: p1.baseline.sourcesChecked },
    { pre: 40, post: 60, delta: 20, trust: 5, sources: "0" });
  assert.deepEqual(
    { pre: p1.vistadex.pre, post: p1.vistadex.post, delta: p1.vistadex.delta, trust: p1.vistadex.trust, clicks: p1.vistadex.clicks, agree: p1.vistadex.agreePct, sources: p1.vistadex.sourcesChecked },
    { pre: 40, post: 30, delta: -10, trust: 3, clicks: 2, agree: 100, sources: "3+" });
  assert.equal(rows.find(r => r.code === "P02").order, "vistadex-first");
});

test("field-track sessions are not study participants", () => {
  const field = [ev("f1", "participant_registered", { code: "", role: null, track: "field", source: null }),
    ev("f1", "confidence_pre", { condition: "vistadex", value: 50, run_id: "r_1", moved: false })];
  assert.deepEqual(pairedParticipants(field), []);
});

test("one participant across two sessions (two sittings) is one row", () => {
  const all = participant("s1", "p03 ", { order: ["baseline", "vistadex"] });
  const firstHalf = all.filter(e => !e.payload.condition || e.payload.condition === "baseline").filter(e => e.type !== "run_started" && e.type !== "source_clicked" && e.type !== "claim_vote");
  const second = participant("s9", "P03").filter(e => e.type === "participant_registered" || e.payload.condition === "vistadex" || ["run_started", "source_clicked", "claim_vote"].includes(e.type));
  const rows = pairedParticipants([...firstHalf, ...second]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, "P03");
  assert.equal(rows[0].complete, true);
  assert.deepEqual(rows[0].sessions.sort(), ["s1", "s9"]);
});

test("legacy chatbot data (a new run id per event, no condition_started) still pairs, order from the code", () => {
  const sid = "old";
  const rows = pairedParticipants([
    ev(sid, "participant_registered", { code: "P05", role: null, track: "study" }),
    ev(sid, "confidence_pre", { condition: "baseline", value: 30, run_id: "baseline-1731300000000" }),
    ev(sid, "confidence_post", { condition: "baseline", run_id: "baseline-1731300099999", value: 70 }),
    ev(sid, "condition_survey", { condition: "baseline", trust: 6, usefulness: 6, helpfulness: 6, effort: 2, open_text: "" }),
    ev(sid, "run_started", { run_id: "r_00000000000b", sample: null }),
    ev(sid, "confidence_pre", { condition: "vistadex", value: 50, run_id: "r_00000000000b", moved: false }),
    ev(sid, "confidence_post", { condition: "vistadex", run_id: "r_00000000000b", value: 40 }),
  ]);
  const p = rows[0];
  assert.equal(p.baseline.delta, 40);
  assert.equal(p.vistadex.delta, -10);
  assert.equal(p.vistadex.preMoved, false);
  assert.equal(p.order, "baseline-first", "odd code number: chatbot first");
  assert.equal(p.orderInferred, true);
  assert.equal(p.idea, null);
  assert.equal(p.complete, true);
});

test("the VistaDex condition is the run named in condition_ended, not a later field run", () => {
  const evs = participant("s1", "P07", { v: [20, 80] });
  evs.push(ev("s1", "run_started", { run_id: "r_00000000000z", sample: null }));
  evs.push(ev("s1", "confidence_pre", { condition: "vistadex", value: 99, run_id: "r_00000000000z", moved: true }));
  evs.push(ev("s1", "confidence_post", { condition: "vistadex", run_id: "r_00000000000z", value: 1 }));
  const p = pairedParticipants(evs)[0];
  assert.equal(p.vistadex.runId, "r_00000000000a");
  assert.equal(p.vistadex.delta, 60);
});

test("a participant who did only one condition is listed but not complete", () => {
  const evs = participant("s1", "P11").filter(e => e.payload.condition !== "vistadex" && !["run_started", "source_clicked", "claim_vote"].includes(e.type));
  const p = pairedParticipants(evs)[0];
  assert.equal(p.complete, false);
  assert.equal(p.vistadex.pre, null);
});

test("wilcoxon: exact two-sided p for small n", () => {
  // all 5 differences positive: W- = 0, P = 2 / 2^5
  const r = wilcoxon([1, 2, 3, 4, 5]);
  assert.equal(r.n, 5);
  assert.equal(r.wPlus, 15);
  assert.equal(r.wMinus, 0);
  assert.equal(r.p, 0.0625);
  assert.equal(r.method, "exact");
  assert.equal(r.median, 3);
});

test("wilcoxon: zeros dropped, ties get average ranks, symmetric data gives p = 1", () => {
  const r = wilcoxon([0, 2, -2, 5, -5, 0]);
  assert.equal(r.n, 4);
  assert.equal(r.zeros, 2);
  assert.equal(r.wPlus, 5); // ranks 1.5 + 3.5
  assert.equal(r.wMinus, 5);
  assert.equal(r.p, 1);
});

test("wilcoxon: known exact value (n = 8)", () => {
  // ranks of |d|: 1..8; W- = 1 + 2 = 3 → P(W ≤ 3) = 5/256 one-sided → 10/256 two-sided
  const r = wilcoxon([-1, -2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.wMinus, 3);
  assert.equal(Math.round(r.p * 1e6) / 1e6, Math.round((10 / 256) * 1e6) / 1e6);
});

test("wilcoxon: normal approximation above n = 25, nothing to test below n = 1", () => {
  const r = wilcoxon(Array.from({ length: 30 }, (_, i) => i + 1));
  assert.equal(r.method, "normal");
  assert.ok(r.p < 0.0001);
  assert.equal(wilcoxon([0, 0]).p, null);
  assert.equal(wilcoxon([]).n, 0);
});

test("joinRuns: the AI chatbot condition's measures never land on a VistaDex run", async () => {
  const { joinRuns } = await import("../worker/src/research-join.js");
  const runs = joinRuns(participant("s1", "P21", { b: [10, 90], v: [40, 30] })).filter(r => r.sid === "s1");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].pre, 40);
  assert.equal(runs[0].post, 30);
  assert.equal(runs[0].survey.trust, 3, "the VistaDex survey, not the chatbot's");
  assert.equal(runs[0].inferred, 0);
});
