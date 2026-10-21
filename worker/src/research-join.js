// research-join.js — How the Research Console joins per-run measures to runs. One source for the served
// page and the node tests: research-page.js embeds researchJoin's source text (Function.prototype.toString),
// so researchJoin must stay self-contained ES5 — no imports, no names from outside its own body.
export function researchJoin() {
  "use strict";
  // Events that belong to a run even when the run_id is missing (legacy data).
  var PER_RUN_TYPES = { confidence_pre: 1, confidence_post: 1, claim_vote: 1, objection_vote: 1,
    source_clicked: 1, source_clicked_by_claim: 1, claim_dwell: 1, run_scoped_survey: 1, comprehension_check: 1, condition_survey: 1 };

  // Start order within a session: seq (kept across reloads), then ts, then arrival order. seq is not
  // unique in raw events: two tabs of one session count from the same stored value (D1 keeps the first
  // of each (session_id, seq) and drops the rest).
  function before(a, b) {
    if (a.seq != null && b.seq != null && a.seq !== b.seq) return a.seq < b.seq;
    if (a.ts && b.ts && a.ts !== b.ts) return a.ts < b.ts;
    return a.order < b.order;
  }

  // ev: events ordered by session_id, seq (as /research/data returns them). Returns one row per run_started.
  // A per-run event joins the run in its session with its run_id; when that is missing, matches no run,
  // or matches several (legacy "r1" after a reload), it joins the run among those candidates that started
  // last before it (else the earliest), and the match is counted as inferred. A pre-84273db study-panel
  // run_id was the report entry id ("<entry>-r<N>"): it is reduced to "r<N>" first.
  function joinRuns(ev) {
    var runs = [];
    var bySidRuns = {};
    ev.forEach(function (e, i) {
      var q = e.payload || {};
      if (e.type === "run_started") {
        var r = { sid: e.session_id, runId: q.run_id || null, started: e.ts, seq: e.seq, ts: e.ts, order: i,
          label: null, inferred: 0,
          role: q.role || null, industries: (q.industries || []).join(", "),
          pre: null, post: null, votes: 0, agrees: 0, clicks: 0, dwell: 0, survey: null, comp: null };
        runs.push(r);
        (bySidRuns[e.session_id] = bySidRuns[e.session_id] || []).push(r);
      }
    });
    Object.keys(bySidRuns).forEach(function (sid) {
      var list = bySidRuns[sid].slice().sort(function (a, b) { return before(a, b) ? -1 : before(b, a) ? 1 : 0; });
      bySidRuns[sid] = list;
      list.forEach(function (r, k) { r.label = "run " + (k + 1) + " of " + list.length; });
    });
    ev.forEach(function (e, i) {
      var q = e.payload || {};
      if (!PER_RUN_TYPES[e.type]) return;
      var sessRuns = bySidRuns[e.session_id];
      if (!sessRuns) return;
      var id = typeof q.run_id === "string" ? q.run_id : null;
      var withId = function (x) { return sessRuns.filter(function (r) { return r.runId === x; }); };
      var cands = id ? withId(id) : [];
      var entry = id && !cands.length ? /^.+-(r\d+)$/.exec(id) : null;
      if (entry) cands = withId(entry[1]);
      var inferred = cands.length !== 1 || !!entry;
      if (!cands.length) cands = sessRuns;
      var at = { seq: e.seq, ts: e.ts, order: i };
      var r = null;
      cands.forEach(function (c) { if (!before(at, c)) r = c; }); // cands are in start order
      if (!r) r = cands[0];
      if (inferred) r.inferred++;
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
