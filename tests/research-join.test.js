// The Research Console's run join (worker/src/research-join.js), tested directly. The served page embeds
// the same source, so these tests cover what the console shows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { agreePct, joinRuns, latestVotes, researchJoin, voteTotals } from "../worker/src/research-join.js";
import { RESEARCH_PAGE } from "../worker/src/research-page.js";

const SID = "99999999-8888-4777-a666-555555555555";
let seq = 0;
const ev = (type, payload = {}, sid = SID) => ({ session_id: sid, seq: ++seq, ts: new Date(Date.UTC(2026, 9, 21, 10, 0, seq)).toISOString(), type, study_version: "v", payload });

test("research join: per-run measures land on their run (session_id, run_id)", () => {
  seq = 0;
  const runs = joinRuns([
    ev("run_started", { run_id: "r1", role: "founder", industries: ["AI", "Fintech"] }),
    ev("confidence_pre", { run_id: "r1", value: 40 }),
    ev("claim_vote", { run_id: "r1", claim_index: 0, vote: "agree" }),
    ev("source_clicked", { run_id: "r1", url: "u" }),
    ev("claim_dwell", { run_id: "r1", ms: 1200 }),
    ev("run_started", { run_id: "r2", role: "investor" }),
    ev("confidence_post", { run_id: "r1", value: 60 }),
    ev("objection_vote", { run_id: "r2", objection_index: 0, vote: "disagree" }),
    ev("run_scoped_survey", { run_id: "r2", trust: 5, usefulness: 4, effort: 2 }),
    ev("comprehension_check", { run_id: "r2", answer: "not_sure" }),
    ev("source_clicked_by_claim", {}), // no run_id: the run in progress (r2)
  ]);
  assert.equal(runs.length, 2);
  assert.deepEqual(
    { runId: runs[0].runId, role: runs[0].role, industries: runs[0].industries, pre: runs[0].pre, post: runs[0].post, votes: runs[0].votes, agrees: runs[0].agrees, clicks: runs[0].clicks, dwell: runs[0].dwell },
    { runId: "r1", role: "founder", industries: "AI, Fintech", pre: 40, post: 60, votes: 1, agrees: 1, clicks: 1, dwell: 1200 });
  assert.deepEqual(
    { runId: runs[1].runId, votes: runs[1].votes, agrees: runs[1].agrees, clicks: runs[1].clicks, trust: runs[1].survey.trust, comp: runs[1].comp },
    { runId: "r2", votes: 1, agrees: 0, clicks: 1, trust: 5, comp: "not_sure" });
});

// ── matching each event to the run that started before it ──
// Legacy run ids ("r1", "r2"…) restarted on every page load while the session id persisted, so one
// session can hold several "r1" runs. New ids are "r_" + 12 random hex.
const RA = "r_0123456789ab", RB = "r_ba9876543210", RC = "r_00ff00ff00ff";
const pick = r => ({ runId: r.runId, pre: r.pre, post: r.post, votes: r.votes, agrees: r.agrees, trust: r.survey && r.survey.trust, inferred: r.inferred });

test("research join: two legacy r1 runs in one session (a reload) each get their own measures, flagged inferred", () => {
  seq = 0;
  const runs = joinRuns([
    ev("run_started", { run_id: "r1" }),
    ev("confidence_pre", { run_id: "r1", value: 30 }),
    ev("claim_vote", { run_id: "r1", claim_index: 0, vote: "agree" }),
    ev("run_scoped_survey", { run_id: "r1", trust: 2 }),
    // reload: the counter restarts, the session id stays
    ev("run_started", { run_id: "r1" }),
    ev("confidence_pre", { run_id: "r1", value: 80 }),
    ev("claim_vote", { run_id: "r1", claim_index: 0, vote: "disagree" }),
    ev("run_scoped_survey", { run_id: "r1", trust: 6 }),
  ]);
  assert.deepEqual(runs.map(pick), [
    { runId: "r1", pre: 30, post: null, votes: 1, agrees: 1, trust: 2, inferred: 3 },
    { runId: "r1", pre: 80, post: null, votes: 1, agrees: 0, trust: 6, inferred: 3 },
  ]);
});

test("research join: an event without a run_id goes to the run that started before it, not the session's latest", () => {
  seq = 0;
  const runs = joinRuns([
    ev("run_started", { run_id: RA }),
    ev("claim_vote", { claim_index: 0, vote: "agree" }), // legacy: no run_id
    ev("run_started", { run_id: RB }),
  ]);
  assert.deepEqual(runs.map(r => [r.runId, r.votes, r.inferred]), [[RA, 1, 1], [RB, 0, 0]]);
});

test("research join: a run_id that matches no run in its session is treated like a missing one", () => {
  seq = 0;
  const runs = joinRuns([
    ev("run_started", { run_id: RA }),
    ev("run_started", { run_id: RB }),
    ev("confidence_post", { run_id: "r_ffffffffffff", value: 55 }), // its run_started never arrived
    ev("run_started", { run_id: RC }),
  ]);
  assert.deepEqual(runs.map(r => [r.runId, r.post, r.inferred]), [[RA, null, 0], [RB, 55, 1], [RC, null, 0]]);
});

test("research join: a pre-84273db report entry id (<entry>-r<N>) is reduced to r<N> before matching", () => {
  seq = 0;
  const runs = joinRuns([
    ev("run_started", { run_id: "r1" }),
    ev("run_started", { run_id: "r2" }),
    ev("claim_vote", { run_id: "mgk2x1a0-r1", claim_index: 0, vote: "agree" }), // the study panel sent entry.id
    ev("objection_vote", { run_id: "mgk2x1a1-r2", objection_index: 0, vote: "agree" }),
  ]);
  assert.deepEqual(runs.map(r => [r.runId, r.votes, r.inferred]), [["r1", 1, 1], ["r2", 1, 1]]);
});

test("research join: two sessions both using r1 do not collide", () => {
  seq = 0;
  const other = "11111111-2222-4333-8444-555555555555";
  const runs = joinRuns([
    ev("run_started", { run_id: "r1" }),
    ev("confidence_pre", { run_id: "r1", value: 10 }),
    ev("run_started", { run_id: "r1" }, other),
    ev("confidence_pre", { run_id: "r1", value: 90 }, other),
  ]);
  assert.deepEqual(runs.map(r => [r.sid, r.pre, r.inferred]), [[SID, 10, 0], [other, 90, 0]]);
});

test("research join: r_ ids join directly, even to an earlier run, and are not inferred", () => {
  seq = 0;
  const runs = joinRuns([
    ev("run_started", { run_id: RA }),
    ev("run_started", { run_id: RB }),
    ev("claim_vote", { run_id: RA, claim_index: 0, vote: "agree" }), // a reopened earlier report
    ev("claim_vote", { run_id: RB, claim_index: 0, vote: "disagree" }),
  ]);
  assert.deepEqual(runs.map(r => [r.runId, r.votes, r.agrees, r.inferred]), [[RA, 1, 1, 0], [RB, 1, 0, 0]]);
});

test("research join: runs are labelled 'run N of M' per session by start order (seq, then ts)", () => {
  const e = (s, ts, sid = SID) => ({ session_id: sid, seq: s, ts: `2026-10-21T10:00:${ts}Z`, type: "run_started", study_version: "v", payload: { run_id: "r1" } });
  const other = "11111111-2222-4333-8444-555555555555";
  // two tabs sent the same seq 7 (D1 drops one of them; raw exports may hold both): ts breaks the tie
  const runs = joinRuns([e(2, "02"), e(7, "09"), e(7, "08"), e(1, "01", other)]);
  assert.deepEqual(runs.map(r => r.label), ["run 1 of 3", "run 3 of 3", "run 2 of 3", "run 1 of 1"]);
});

test("research join (known limit, accepted): after a reload, a reopened old report's legacy r1 vote lands on the newest r1, flagged inferred", () => {
  seq = 0;
  const runs = joinRuns([
    ev("run_started", { run_id: "r1" }), // page load 1: the report the visitor later reopens
    ev("run_started", { run_id: "r1" }), // page load 2: a new run
    ev("claim_vote", { run_id: "r1", claim_index: 0, vote: "agree" }), // voted on the reopened OLD report
  ]);
  // Indistinguishable in legacy data: it joins the newest r1. New r_ ids do not have this problem.
  assert.deepEqual(runs.map(r => [r.votes, r.inferred]), [[0, 0], [1, 1]]);
});

// ── agreement: each item's latest vote; not_sure counts as a vote, not as agreement ──
test("research agreement: only each item's latest vote counts; not_sure stays in the denominator; runs stay separate", () => {
  seq = 0;
  const votes = run => [
    ev("claim_vote", { run_id: run, claim_index: 0, vote: "agree" }),
    ev("claim_vote", { run_id: run, claim_index: 0, vote: "disagree" }), // changed their mind
    ev("claim_vote", { run_id: run, claim_index: 0, vote: "disagree" }), // pressed the same answer again
    ev("claim_vote", { run_id: run, claim_index: 1, vote: "not_sure" }),
    ev("objection_vote", { run_id: run, objection_index: 0, vote: "agree" }),
  ];
  const events = [ev("run_started", { run_id: RA }), ...votes(RA), ev("run_started", { run_id: RB }), ...votes(RB)];
  const runs = joinRuns(events);
  for (const r of runs) {
    assert.deepEqual({ votes: r.votes, agrees: r.agrees, disagrees: r.disagrees, notSure: r.notSure, pct: agreePct(r) },
      { votes: 3, agrees: 1, disagrees: 1, notSure: 1, pct: 33 }, r.runId);
  }
  const latest = latestVotes(events, runs);
  assert.equal(latest.length, 6);
  const t = voteTotals(latest.filter(v => v.sid === SID));
  assert.deepEqual(t, { votes: 6, agrees: 2, disagrees: 2, notSure: 2 }); // the session (People row): both runs
  assert.equal(agreePct(t), 33);
});

test("research agreement: claim 0 and objection 0 are different items", () => {
  seq = 0;
  const events = [
    ev("run_started", { run_id: RA }),
    ev("claim_vote", { run_id: RA, claim_index: 0, vote: "disagree" }),
    ev("objection_vote", { run_id: RA, objection_index: 0, vote: "agree" }),
  ];
  const latest = latestVotes(events, joinRuns(events));
  assert.deepEqual(latest.map(v => [v.type, v.index, v.vote]), [["claim_vote", 0, "disagree"], ["objection_vote", 0, "agree"]]);
  assert.equal(agreePct(voteTotals(latest)), 50);
});

test("research agreement: legacy votes use the run resolved by start order; votes in a session with no run still count", () => {
  seq = 0;
  const lone = "22222222-3333-4444-8555-666666666666";
  const events = [
    ev("run_started", { run_id: "r1" }),
    ev("claim_vote", { run_id: "r1", claim_index: 0, vote: "agree" }),
    ev("run_started", { run_id: "r1" }), // reload
    ev("claim_vote", { run_id: "r1", claim_index: 0, vote: "disagree" }), // same item index, different run
    ev("claim_vote", { claim_index: 2, vote: "agree" }, lone), // e.g. an old report reopened after a consent reset
    ev("claim_vote", { claim_index: 2, vote: "not_sure" }, lone),
  ];
  const runs = joinRuns(events);
  assert.deepEqual(runs.map(r => [r.votes, r.agrees]), [[1, 1], [1, 0]]);
  const latest = latestVotes(events, runs);
  assert.deepEqual(voteTotals(latest.filter(v => v.sid === lone)), { votes: 1, agrees: 0, disagrees: 0, notSure: 1 });
});

test("research console page counts agreement only through the shared helper", () => {
  const rest = RESEARCH_PAGE.replace(researchJoin.toString(), "");
  assert.ok(!/vote === "agree"|agrees\+\+|votes\+\+/.test(rest), "no vote counting outside research-join.js");
  for (const col of ["votes_agree", "votes_disagree", "votes_not_sure"]) assert.ok(rest.includes(`"${col}"`), `CSV column ${col}`);
});

test("research console page embeds the shared join and its inline script parses", () => {
  assert.ok(RESEARCH_PAGE.includes(researchJoin.toString()), "page carries research-join.js's source verbatim");
  const scripts = [...RESEARCH_PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 1);
  for (const s of scripts) assert.doesNotThrow(() => new Function(s));
});
