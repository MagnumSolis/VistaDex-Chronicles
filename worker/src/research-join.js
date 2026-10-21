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
  // session_id → that session's runs in start order (labels "run N of M" set on the way).
  function runsBySession(runs) {
    var by = {};
    runs.forEach(function (r) { (by[r.sid] = by[r.sid] || []).push(r); });
    Object.keys(by).forEach(function (sid) {
      var list = by[sid].sort(function (a, b) { return before(a, b) ? -1 : before(b, a) ? 1 : 0; });
      list.forEach(function (r, k) { r.label = "run " + (k + 1) + " of " + list.length; });
    });
    return by;
  }

  // The run event i (ev[i]) belongs to, or null when its session has no runs.
  function resolveRun(bySidRuns, e, i) {
    var sessRuns = bySidRuns[e.session_id];
    if (!sessRuns) return null;
    var q = e.payload || {};
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
    return { run: r || cands[0], inferred: inferred };
  }

  // Every vote press is logged (a change, or the same answer again), so agreement uses only the latest
  // vote per item: (session, run, claim_vote|objection_vote, claim_index|objection_index). runs: joinRuns(ev).
  // Votes in a session without any run_started (e.g. an old report reopened after a consent reset) keep run null.
  function latestVotes(ev, runs) {
    var bySidRuns = runsBySession(runs.slice());
    var latest = {}, keys = [];
    ev.forEach(function (e, i) {
      if (e.type !== "claim_vote" && e.type !== "objection_vote") return;
      var q = e.payload || {};
      var m = resolveRun(bySidRuns, e, i);
      var run = m ? m.run : null;
      var index = e.type === "claim_vote" ? q.claim_index : q.objection_index;
      var v = { sid: e.session_id, run: run, type: e.type, index: index, vote: q.vote, seq: e.seq, ts: e.ts, order: i };
      var k = [e.session_id, run ? run.order : "-", e.type, index].join("\u0000");
      if (!latest[k]) keys.push(k);
      if (!latest[k] || !before(v, latest[k])) latest[k] = v;
    });
    return keys.map(function (k) { return latest[k]; });
  }

  // Agree rate = agree ÷ all votes; not_sure (and any other answer) is a vote but not agreement.
  function voteTotals(votes) {
    var t = { votes: 0, agrees: 0, disagrees: 0, notSure: 0 };
    votes.forEach(function (v) {
      t.votes++;
      if (v.vote === "agree") t.agrees++;
      else if (v.vote === "disagree") t.disagrees++;
      else if (v.vote === "not_sure") t.notSure++;
    });
    return t;
  }
  function agreePct(t) { return t.votes ? Math.round(100 * t.agrees / t.votes) : null; }

  function joinRuns(ev) {
    var runs = [];
    ev.forEach(function (e, i) {
      var q = e.payload || {};
      if (e.type === "run_started") {
        runs.push({ sid: e.session_id, runId: q.run_id || null, started: e.ts, seq: e.seq, ts: e.ts, order: i,
          label: null, inferred: 0,
          role: q.role || null, industries: (q.industries || []).join(", "),
          pre: null, post: null, votes: 0, agrees: 0, disagrees: 0, notSure: 0, clicks: 0, dwell: 0, survey: null, comp: null });
      }
    });
    var bySidRuns = runsBySession(runs.slice());
    ev.forEach(function (e, i) {
      var q = e.payload || {};
      if (!PER_RUN_TYPES[e.type]) return;
      var m = resolveRun(bySidRuns, e, i);
      if (!m) return;
      var r = m.run;
      if (m.inferred) r.inferred++;
      if (e.type === "confidence_pre") r.pre = q.value;
      else if (e.type === "confidence_post") r.post = q.value;
      else if (e.type === "source_clicked_by_claim" || e.type === "source_clicked") r.clicks++;
      else if (e.type === "claim_dwell") r.dwell += q.ms || 0;
      else if (e.type === "run_scoped_survey") r.survey = q;
      else if (e.type === "comprehension_check") r.comp = q.answer;
      // Legacy sessions logged the survey as condition_survey (no run-scoped copy yet).
      else if (e.type === "condition_survey" && !r.survey) r.survey = q;
    });
    latestVotes(ev, runs).forEach(function (v) {
      if (!v.run) return;
      var t = voteTotals([v]);
      v.run.votes += t.votes; v.run.agrees += t.agrees; v.run.disagrees += t.disagrees; v.run.notSure += t.notSure;
    });
    return runs;
  }

  return { PER_RUN_TYPES: PER_RUN_TYPES, joinRuns: joinRuns, latestVotes: latestVotes, voteTotals: voteTotals, agreePct: agreePct };
}

const join = researchJoin();
export const PER_RUN_TYPES = join.PER_RUN_TYPES;
export const joinRuns = join.joinRuns;
export const latestVotes = join.latestVotes;
export const voteTotals = join.voteTotals;
export const agreePct = join.agreePct;
