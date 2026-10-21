// research-join.js — How the Research Console joins per-run measures to runs. One source for the served
// page and the node tests: research-page.js embeds researchJoin's source text (Function.prototype.toString),
// so researchJoin must stay self-contained ES5 — no imports, no names from outside its own body.
export function researchJoin() {
  "use strict";
  // Events that belong to a run even when the run_id is missing (legacy data).
  var PER_RUN_TYPES = { confidence_pre: 1, confidence_post: 1, claim_vote: 1, objection_vote: 1,
    source_clicked: 1, source_clicked_by_claim: 1, claim_dwell: 1, run_scoped_survey: 1, comprehension_check: 1, condition_survey: 1 };

  // ev: events ordered by session_id, seq (as /research/data returns them). Returns one row per run_started.
  function joinRuns(ev) {
    // collect runs: a run = one run_started..run_completed pair per session
    var runs = [];
    var bySidRuns = {};
    ev.forEach(function (e) {
      var q = e.payload || {};
      if (e.type === "run_started") {
        var r = { sid: e.session_id, runId: q.run_id || null, started: e.ts,
          role: q.role || null, industries: (q.industries || []).join(", "),
          pre: null, post: null, votes: 0, agrees: 0, clicks: 0, dwell: 0, survey: null, comp: null };
        runs.push(r);
        (bySidRuns[e.session_id] = bySidRuns[e.session_id] || []).push(r);
      }
    });
    // Join per-run measures. run ids ("r1"…) are per-browser counters, so the
    // composite key (session_id, run_id) is unique. Legacy events without a
    // run_id fall back to the session's latest run.
    var byRun = {};
    runs.forEach(function (r) { if (r.runId) byRun[r.sid + "\u0000" + r.runId] = r; });
    ev.forEach(function (e) {
      var q = e.payload || {};
      var r = q.run_id ? byRun[e.session_id + "\u0000" + q.run_id] : null;
      var sessRuns = bySidRuns[e.session_id];
      if (!r && PER_RUN_TYPES[e.type] && sessRuns && sessRuns.length) r = sessRuns[sessRuns.length - 1];
      if (!r) return;
      if (e.type === "confidence_pre") r.pre = q.value;
      else if (e.type === "confidence_post") r.post = q.value;
      else if (e.type === "claim_vote" || e.type === "objection_vote") { r.votes++; if (q.vote === "agree") r.agrees++; }
      else if (e.type === "source_clicked_by_claim" || e.type === "source_clicked") r.clicks++;
      else if (e.type === "claim_dwell") r.dwell += q.ms || 0;
      else if (e.type === "run_scoped_survey") r.survey = q;
      else if (e.type === "comprehension_check") r.comp = q.answer;
      // Legacy sessions logged the survey as condition_survey (no run-scoped copy yet).
      else if (e.type === "condition_survey" && !r.survey) r.survey = q;
    });
    return runs;
  }

  return { PER_RUN_TYPES: PER_RUN_TYPES, joinRuns: joinRuns };
}

const join = researchJoin();
export const PER_RUN_TYPES = join.PER_RUN_TYPES;
export const joinRuns = join.joinRuns;
