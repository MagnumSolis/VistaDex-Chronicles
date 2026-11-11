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
          pre: null, preMoved: null, post: null, votes: 0, agrees: 0, disagrees: 0, notSure: 0, clicks: 0, dwell: 0, survey: null, comp: null });
      }
    });
    var bySidRuns = runsBySession(runs.slice());
    // Sessions that send run_scoped_survey (the survey with its run id) also send a run-less
    // condition_survey copy; that copy is only a fallback for older sessions without the scoped one.
    var scopedSid = {};
    ev.forEach(function (e) { if (e.type === "run_scoped_survey") scopedSid[e.session_id] = 1; });
    ev.forEach(function (e, i) {
      var q = e.payload || {};
      if (!PER_RUN_TYPES[e.type]) return;
      if (e.type === "condition_survey" && scopedSid[e.session_id]) return;
      // The study track's AI chatbot condition has no VistaDex run: its measures are compared in
      // pairedParticipants and must not be matched to a run by start order.
      if (q.condition === "baseline") return;
      var m = resolveRun(bySidRuns, e, i);
      if (!m) return;
      var r = m.run;
      if (m.inferred) r.inferred++;
      // moved: false = the slider was left at its starting 50 (still counted); null = logged before the flag existed
      if (e.type === "confidence_pre") { r.pre = q.value; r.preMoved = typeof q.moved === "boolean" ? q.moved : null; }
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

  // ── Study track, within subjects: one row per participant code, both conditions side by side ──
  // A participant is a study-track participant_registered code (trimmed, upper case); every session that
  // registered that code belongs to them (two sittings in two sessions are one participant). Per condition,
  // its run is the one named in condition_ended; else (older data) the assigned-idea run (run_started.sample
  // "study_<key>") or the chatbot part's "b_" run; else the condition's latest measures, flagged runInferred.
  function normCode(c) { return String(c == null ? "" : c).replace(/^\s+|\s+$/g, "").toUpperCase(); }
  function lastOf(list) { return list.length ? list[list.length - 1] : null; }
  function conditionRow(evs, c) {
    function ofType(t, cond) { return evs.filter(function (e) { return e.type === t && (!cond || (e.payload || {}).condition === c); }); }
    var ended = lastOf(ofType("condition_ended", true));
    var runId = ended ? ended.payload.run_id : null;
    if (!runId && c === "vistadex") {
      var assigned = evs.filter(function (e) { return e.type === "run_started" && /^study_/.test((e.payload || {}).sample || ""); });
      if (assigned.length) runId = assigned[0].payload.run_id;
    }
    if (!runId && c === "baseline") {
      var b = lastOf(ofType("confidence_pre", true).filter(function (e) { return /^b_/.test(e.payload.run_id || ""); }));
      if (b) runId = b.payload.run_id;
    }
    function measure(t) {
      var list = ofType(t, true);
      var exact = runId ? list.filter(function (e) { return e.payload.run_id === runId; }) : [];
      return lastOf(exact.length ? exact : list);
    }
    var pre = measure("confidence_pre"), post = measure("confidence_post");
    var scoped = runId ? lastOf(evs.filter(function (e) { return e.type === "run_scoped_survey" && e.payload.run_id === runId; })) : null;
    var survey = scoped || lastOf(ofType("condition_survey", true));
    var sq = survey ? survey.payload : {};
    var row = {
      started: ofType("condition_started", true).length > 0, ended: !!ended, runId: runId, runInferred: !runId,
      pre: pre ? pre.payload.value : null, preMoved: pre && typeof pre.payload.moved === "boolean" ? pre.payload.moved : null,
      post: post ? post.payload.value : null, delta: null,
      trust: survey ? sq.trust : null, usefulness: survey ? sq.usefulness : null, helpfulness: survey ? sq.helpfulness : null,
      effort: survey ? sq.effort : null, sourcesChecked: survey && sq.sources_checked != null ? sq.sources_checked : null,
      openText: survey && sq.open_text ? sq.open_text : "", clicks: null, votes: 0, agreePct: null,
    };
    if (row.pre != null && row.post != null) row.delta = row.post - row.pre;
    if (c === "vistadex") {
      if (ended && typeof ended.payload.verified_sources === "number") row.clicks = ended.payload.verified_sources;
      else if (runId) row.clicks = evs.filter(function (e) { return (e.type === "source_clicked" || e.type === "source_clicked_by_claim") && e.payload.run_id === runId; }).length;
      if (runId) {
        var latest = {}, keys = [];
        evs.forEach(function (e) {
          if ((e.type !== "claim_vote" && e.type !== "objection_vote") || e.payload.run_id !== runId) return;
          var k = e.type + ":" + (e.type === "claim_vote" ? e.payload.claim_index : e.payload.objection_index);
          if (!latest[k]) keys.push(k);
          latest[k] = e.payload;
        });
        var t = voteTotals(keys.map(function (k) { return latest[k]; }));
        row.votes = t.votes; row.agreePct = agreePct(t);
      }
    }
    return row;
  }
  function pairedParticipants(ev) {
    var codeBySid = {};
    ev.forEach(function (e) {
      var q = e.payload || {};
      if (e.type === "participant_registered" && q.track === "study" && normCode(q.code)) codeBySid[e.session_id] = normCode(q.code);
    });
    var people = {}, codes = [];
    ev.forEach(function (e) {
      var code = codeBySid[e.session_id];
      if (!code) return;
      if (!people[code]) { people[code] = { sessions: [], evs: [] }; codes.push(code); }
      if (people[code].sessions.indexOf(e.session_id) < 0) people[code].sessions.push(e.session_id);
      people[code].evs.push(e);
    });
    return codes.map(function (code) {
      var evs = people[code].evs;
      var starts = evs.filter(function (e) { return e.type === "condition_started"; });
      var first = starts.filter(function (e) { return e.payload.order_position === 1; })[0];
      var order = first ? first.payload.condition + "-first" : null, inferred = false;
      if (!order) {
        var num = parseInt(code.replace(/\D/g, ""), 10);
        if (num > 0) { order = num % 2 === 1 ? "baseline-first" : "vistadex-first"; inferred = true; }
      }
      var idea = starts.length ? starts[0].payload.idea_key : null;
      if (!idea) {
        var s = evs.filter(function (e) { return e.type === "run_started" && /^study_/.test((e.payload || {}).sample || ""); })[0];
        if (s) idea = s.payload.sample.slice(6);
      }
      var b = conditionRow(evs, "baseline"), v = conditionRow(evs, "vistadex");
      return { code: code, sessions: people[code].sessions, idea: idea || null, order: order, orderInferred: inferred,
        complete: b.pre != null && b.post != null && v.pre != null && v.post != null, baseline: b, vistadex: v,
        last: evs.length ? evs[evs.length - 1].ts : null };
    });
  }

  // Wilcoxon signed-rank test on paired differences. Zeros are dropped; ties get average ranks; two-sided p
  // is exact (full distribution of W+ over all sign patterns, ties included) up to n = 25, else the normal
  // approximation with tie and continuity corrections. median: of all differences, zeros included.
  function wilcoxon(diffs) {
    var all = diffs.filter(function (d) { return typeof d === "number" && !isNaN(d); });
    var sorted = all.slice().sort(function (a, b) { return a - b; });
    var median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null;
    var nz = all.filter(function (d) { return d !== 0; });
    var n = nz.length, res = { n: n, zeros: all.length - n, wPlus: 0, wMinus: 0, p: null, method: null, median: median };
    if (!n) return res;
    var byAbs = nz.map(function (d) { return { d: d, a: Math.abs(d) }; }).sort(function (x, y) { return x.a - y.a; });
    var ranks2 = [], ties = 0, i = 0; // ranks doubled, so tied (half) ranks stay integers
    while (i < n) {
      var j = i;
      while (j + 1 < n && byAbs[j + 1].a === byAbs[i].a) j++;
      var t = j - i + 1;
      if (t > 1) ties += t * t * t - t;
      for (var k = i; k <= j; k++) ranks2[k] = i + j + 2;
      i = j + 1;
    }
    var w2 = 0, total2 = 0;
    byAbs.forEach(function (x, k) { total2 += ranks2[k]; if (x.d > 0) w2 += ranks2[k]; });
    res.wPlus = w2 / 2; res.wMinus = (total2 - w2) / 2;
    if (n <= 25) {
      var counts = [1];
      for (var m = 1; m <= total2; m++) counts.push(0);
      ranks2.forEach(function (r) { for (var s = total2; s >= r; s--) counts[s] += counts[s - r]; });
      var all2 = Math.pow(2, n), lo = 0, hi = 0;
      for (var s2 = 0; s2 <= total2; s2++) { if (s2 <= w2) lo += counts[s2]; if (s2 >= w2) hi += counts[s2]; }
      res.p = Math.min(1, 2 * Math.min(lo, hi) / all2);
      res.method = "exact";
    } else {
      var mean = n * (n + 1) / 4, sd = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - ties / 48);
      var z = sd ? Math.max(0, Math.abs(res.wPlus - mean) - 0.5) / sd : 0;
      res.p = Math.min(1, 2 * (1 - phi(z)));
      res.method = "normal";
    }
    return res;
  }
  // Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7).
  function phi(z) {
    var x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
    var erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
  }

  return { PER_RUN_TYPES: PER_RUN_TYPES, joinRuns: joinRuns, latestVotes: latestVotes, voteTotals: voteTotals, agreePct: agreePct,
    pairedParticipants: pairedParticipants, wilcoxon: wilcoxon };
}

const join = researchJoin();
export const PER_RUN_TYPES = join.PER_RUN_TYPES;
export const joinRuns = join.joinRuns;
export const latestVotes = join.latestVotes;
export const voteTotals = join.voteTotals;
export const agreePct = join.agreePct;
export const pairedParticipants = join.pairedParticipants;
export const wilcoxon = join.wilcoxon;
