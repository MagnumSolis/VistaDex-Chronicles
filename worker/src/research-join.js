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

  // The run with exactly this event's run_id in its session, else null.
  function exactRun(bySidRuns, e) {
    var id = (e.payload || {}).run_id;
    var hits = id ? (bySidRuns[e.session_id] || []).filter(function (r) { return r.runId === id; }) : [];
    return hits.length === 1 ? hits[0] : null;
  }

  // Evidence links in the report other than a claim's sources (those log source_clicked, and their
  // control_pressed "source_link" is not counted again), by the part of the report they sit in.
  var EVIDENCE_CONTROLS = { lead_source_link: "graveyard", competitor_link: "competitors", big_tech_source_link: "big_tech",
    legal_registry_link: "legal", legal_rule_source_link: "legal", market_citation_link: "market" };

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
      var v = { sid: e.session_id, run: run, type: e.type, index: index, vote: q.vote, status: q.status || null, severity: q.severity || null, seq: e.seq, ts: e.ts, order: i };
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
          pre: null, preMoved: null, post: null, votes: 0, agrees: 0, disagrees: 0, notSure: 0, clicks: 0, dwell: 0, survey: null, comp: null,
          mode: q.mode || null, sample: q.sample || null, completed: false, links: 0, linksBy: {}, sectionMs: {}, reportMs: 0 });
      }
    });
    var bySidRuns = runsBySession(runs.slice());
    // Sessions that send run_scoped_survey (the survey with its run id) also send a run-less
    // condition_survey copy; that copy is only a fallback for older sessions without the scoped one.
    var scopedSid = {};
    ev.forEach(function (e) { if (e.type === "run_scoped_survey") scopedSid[e.session_id] = 1; });
    ev.forEach(function (e, i) {
      var q = e.payload || {};
      // Report attention and completion carry the run id: they join only that run, never by start order
      // (a sample or demo report read later has its own id and must not land on the participant's run).
      if (e.type === "run_completed" || e.type === "section_time" || e.type === "report_time") {
        var x = exactRun(bySidRuns, e);
        if (!x) return;
        if (e.type === "run_completed") x.completed = true;
        else if (e.type === "report_time") x.reportMs += q.visible_ms || 0;
        else x.sectionMs[q.section] = (x.sectionMs[q.section] || 0) + (q.visible_ms || 0);
        return;
      }
      // Evidence links outside the claims log control_pressed without a run id: they join the run that
      // started last before the press (not counted as an inferred measure: they never had an id).
      if (e.type === "control_pressed" && EVIDENCE_CONTROLS[q.control]) {
        var lm = resolveRun(bySidRuns, e, i);
        if (!lm) return;
        lm.run.links++;
        lm.run.linksBy[EVIDENCE_CONTROLS[q.control]] = (lm.run.linksBy[EVIDENCE_CONTROLS[q.control]] || 0) + 1;
        return;
      }
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


  // ── Study analysis: one source for the console's Insights view, its CSV exports and
  // analysis/study_analysis.mjs, so the console and the paper report give the same numbers. ──
  function median(xs) {
    if (!xs.length) return null;
    var s = xs.slice().sort(function (a, b) { return a - b; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function mean1(xs) { return xs.length ? Math.round(10 * xs.reduce(function (a, b) { return a + b; }, 0) / xs.length) / 10 : null; }
  function pct(k, n) { return n ? Math.round(100 * k / n) : null; }
  function groupBy(xs, key) {
    var m = {};
    xs.forEach(function (x) { var k = key(x); (m[k] = m[k] || []).push(x); });
    return m;
  }

  // Mann-Whitney U (two independent groups): U of group a, two-sided p by the normal approximation with
  // tie and continuity corrections. Report it with the group sizes; with very small groups p is rough.
  function mannWhitney(a, b) {
    var n1 = a.length, n2 = b.length;
    if (!n1 || !n2) return { n1: n1, n2: n2, u: null, p: null, medianA: median(a), medianB: median(b) };
    var all = a.map(function (v) { return { v: v, g: 0 }; }).concat(b.map(function (v) { return { v: v, g: 1 }; }))
      .sort(function (x, y) { return x.v - y.v; });
    var i = 0, ties = 0;
    while (i < all.length) {
      var j = i;
      while (j + 1 < all.length && all[j + 1].v === all[i].v) j++;
      var t = j - i + 1;
      if (t > 1) ties += t * t * t - t;
      for (var k = i; k <= j; k++) all[k].rank = (i + j + 2) / 2;
      i = j + 1;
    }
    var r1 = all.filter(function (x) { return x.g === 0; }).reduce(function (s, x) { return s + x.rank; }, 0);
    var u = r1 - n1 * (n1 + 1) / 2, n = n1 + n2;
    var sd = Math.sqrt((n1 * n2 / 12) * (n + 1 - ties / (n * (n - 1))));
    var z = sd ? Math.max(0, Math.abs(u - n1 * n2 / 2) - 0.5) / sd : 0;
    return { n1: n1, n2: n2, u: u, p: sd ? Math.min(1, 2 * (1 - phi(z))) : 1, medianA: median(a), medianB: median(b) };
  }

  var SRC_ORD = { "0": 0, "1-2": 1, "3+": 2 };
  var MEASURES = [
    ["confidence_change", "Confidence change (after minus before)", function (c) { return c.delta; }],
    ["confidence_after", "Confidence after", function (c) { return c.post; }],
    ["trust", "Trust in the assessment (1 to 7)", function (c) { return c.trust; }],
    ["usefulness", "Useful for judging the idea (1 to 7)", function (c) { return c.usefulness; }],
    ["helpfulness", "Helped see what to verify (1 to 7)", function (c) { return c.helpfulness; }],
    ["effort", "Effort (1 to 7)", function (c) { return c.effort; }],
    ["sources_checked", "Sources checked, self-report (0 / 1-2 / 3+ as 0 / 1 / 2)", function (c) { return c.sourcesChecked == null ? null : SRC_ORD[c.sourcesChecked]; }]
  ];
  var SECTIONS = ["summary", "profile", "claims", "graveyard", "objections", "big_tech", "legal", "market", "score_breakdown", "rate"];
  var STATUSES = ["contradicted", "disputed", "unverified", "confirmed"];
  // The smallest groups a finding is stated for. An exact two-sided Wilcoxon p can reach 0.05 only from
  // 6 pairs (2 / 64 = 0.031), so below that a paired test cannot show anything.
  var MIN_PAIRS = 6, MIN_GROUP = 5, MIN_VOTES = 10;

  function tally(votes) {
    var t = { votes: votes.length, agree: 0, disagree: 0, notSure: 0, agreePct: null };
    votes.forEach(function (v) {
      if (v.vote === "agree") t.agree++;
      else if (v.vote === "disagree") t.disagree++;
      else if (v.vote === "not_sure") t.notSure++;
    });
    t.agreePct = pct(t.agree, t.votes);
    return t;
  }
  function pairedTest(pairs, f) {
    var both = pairs.filter(function (p) { return f(p.baseline) != null && f(p.vistadex) != null; });
    var diffs = both.map(function (p) { return f(p.vistadex) - f(p.baseline); });
    return { n: both.length, chatbotMean: mean1(both.map(function (p) { return f(p.baseline); })),
      vistadexMean: mean1(both.map(function (p) { return f(p.vistadex); })), diffs: diffs, test: wilcoxon(diffs) };
  }
  function byKey(votes, k) {
    var g = groupBy(votes, function (v) { return v[k] || "unknown"; }), out = {};
    Object.keys(g).forEach(function (s) { out[s] = tally(g[s]); });
    return out;
  }

  // events: as /export or /research/data return them. opts.includeTest keeps codes starting with "TEST".
  function analyzeStudy(events, opts) {
    var includeTest = !!(opts && opts.includeTest);
    var testSids = {}, testCodes = {};
    events.forEach(function (e) {
      var code = normCode((e.payload || {}).code);
      if (e.type === "participant_registered" && /^TEST/.test(code)) { testSids[e.session_id] = 1; testCodes[code] = 1; }
    });
    var ev = includeTest ? events : events.filter(function (e) { return !testSids[e.session_id]; });
    var sessions = groupBy(ev, function (e) { return e.session_id; });
    var sids = Object.keys(sessions);
    var versions = {};
    sids.forEach(function (sid) { var v = sessions[sid][0].study_version || "unknown"; versions[v] = (versions[v] || 0) + 1; });

    var pairs = pairedParticipants(ev).sort(function (a, b) { return a.code.localeCompare(b.code, undefined, { numeric: true }); });
    var complete = pairs.filter(function (p) { return p.complete; });
    var studySids = {};
    pairs.forEach(function (p) { p.sessions.forEach(function (s) { studySids[s] = 1; }); });
    var count = function (f) { return pairs.filter(f).length; };
    var ideas = {};
    pairs.forEach(function (p) { var k = p.idea || "unknown"; ideas[k] = (ideas[k] || 0) + 1; });

    // Who a session is: its registration (role, track, channel); a run's role is the screening form's.
    var reg = {};
    ev.forEach(function (e) { if (e.type === "participant_registered") reg[e.session_id] = e.payload || {}; });
    var runs = joinRuns(ev);
    runs.forEach(function (r) {
      var g = reg[r.sid] || {};
      r.role = r.role || g.role || "unknown";
      r.channel = g.source || "unknown";
      r.track = studySids[r.sid] ? "study" : "field";
      r.evidence = r.clicks + r.links;
      r.delta = r.pre != null && r.post != null ? r.post - r.pre : null;
    });
    var finished = runs.filter(function (r) { return r.completed; });
    var withConf = runs.filter(function (r) { return r.delta != null; });

    var summary = {
      sessions: sids.length, studyVersions: versions,
      studyParticipants: pairs.length, completePairs: complete.length,
      excludedTestCodes: includeTest ? 0 : Object.keys(testCodes).length,
      order: { "baseline-first": count(function (p) { return p.order === "baseline-first"; }), "vistadex-first": count(function (p) { return p.order === "vistadex-first"; }), unknown: count(function (p) { return !p.order; }) },
      orderFromCode: count(function (p) { return p.orderInferred; }), ideas: ideas,
      fieldSessionsWithRuns: sids.filter(function (sid) { return !studySids[sid] && sessions[sid].some(function (e) { return e.type === "run_started"; }); }).length,
      runs: runs.length, finishedRuns: finished.length
    };

    // H1: confidence change within each condition, and VistaDex minus chatbot.
    function within(c) {
      var ps = complete.filter(function (p) { return p[c].delta != null; });
      var deltas = ps.map(function (p) { return p[c].delta; });
      return { n: ps.length, deltas: deltas, meanDelta: mean1(deltas), test: wilcoxon(deltas) };
    }
    var h1 = { chatbot: within("baseline"), vistadex: within("vistadex"), paired: pairedTest(complete, function (c) { return c.delta; }) };
    var measures = MEASURES.map(function (m) { var t = pairedTest(pairs, m[2]); t.id = m[0]; t.label = m[1]; return t; });
    // Order effect: is the paired difference in confidence change different by order?
    function diffBy(o) { return complete.filter(function (p) { return p.order === o; }).map(function (p) { return p.vistadex.delta - p.baseline.delta; }); }
    var orderEffect = mannWhitney(diffBy("baseline-first"), diffBy("vistadex-first"));

    // H2: verification. Paired self-report, the study's claim links, and every finished run's evidence.
    var opened = pairs.map(function (p) { return p.vistadex.clicks; }).filter(function (c) { return c != null; });
    var kinds = { claims: 0 };
    finished.forEach(function (r) { kinds.claims += r.clicks; Object.keys(r.linksBy).forEach(function (k) { kinds[k] = (kinds[k] || 0) + r.linksBy[k]; }); });
    var h2 = {
      selfReport: measures.filter(function (m) { return m.id === "sources_checked"; })[0],
      linksOpened: { n: opened.length, none: opened.filter(function (c) { return c === 0; }).length, median: median(opened), mean: mean1(opened) },
      runs: { n: finished.length, opened: finished.filter(function (r) { return r.evidence > 0; }).length, links: kinds }
    };

    // H3: agreement with the report's verdicts (latest vote per item), by claim status and objection severity.
    var votes = latestVotes(ev, runs);
    var claimVotes = votes.filter(function (v) { return v.type === "claim_vote"; });
    var h3 = {
      byClaimStatus: byKey(claimVotes, "status"),
      byObjectionSeverity: byKey(votes.filter(function (v) { return v.type === "objection_vote"; }), "severity"),
      studyOnly: byKey(claimVotes.filter(function (v) { return studySids[v.sid]; }), "status")
    };

    // H4: runs where evidence was opened vs runs where it was not, and change across a session's runs.
    var openers = withConf.filter(function (r) { return r.evidence > 0; }), others = withConf.filter(function (r) { return r.evidence === 0; });
    function d(r) { return r.delta; }
    function ad(r) { return Math.abs(r.delta); }
    var runIndex = {};
    var bySession = groupBy(withConf, function (r) { return r.sid; });
    Object.keys(bySession).forEach(function (sid) {
      bySession[sid].sort(function (a, b) { return before(a, b) ? -1 : 1; }).forEach(function (r, k) { (runIndex[k + 1] = runIndex[k + 1] || []).push(r); });
    });
    var h4 = {
      clickers: { n: openers.length, meanDelta: mean1(openers.map(d)), meanAbsDelta: mean1(openers.map(ad)) },
      nonClickers: { n: others.length, meanDelta: mean1(others.map(d)), meanAbsDelta: mean1(others.map(ad)) },
      test: mannWhitney(openers.map(d), others.map(d)),
      byRunIndex: Object.keys(runIndex).map(Number).sort(function (a, b) { return a - b; }).map(function (k) {
        return { run: k, runs: runIndex[k].length, meanDelta: mean1(runIndex[k].map(d)), meanAbsDelta: mean1(runIndex[k].map(ad)) };
      })
    };

    // Confidence direction over every VistaDex run with both answers.
    var direction = { n: withConf.length, lower: withConf.filter(function (r) { return r.delta < 0; }).length,
      same: withConf.filter(function (r) { return r.delta === 0; }).length, higher: withConf.filter(function (r) { return r.delta > 0; }).length,
      meanDelta: mean1(withConf.map(d)), meanAbsDelta: mean1(withConf.map(ad)), test: wilcoxon(withConf.map(d)) };

    // Comprehension check: what an "unverified" claim means (latest answer per run).
    var comp = {}, compKeys = [];
    ev.forEach(function (e) {
      if (e.type !== "comprehension_check") return;
      var k = e.session_id + "\u0000" + (e.payload || {}).run_id;
      if (!(k in comp)) compKeys.push(k);
      comp[k] = (e.payload || {}).answer;
    });
    var comprehension = {};
    compKeys.forEach(function (k) { comprehension[comp[k]] = (comprehension[comp[k]] || 0) + 1; });

    // Attention: how many finished runs showed each section, and for how long (by the panel-viewed rule).
    var attention = SECTIONS.map(function (s) {
      var seen = finished.filter(function (r) { return (r.sectionMs[s] || 0) > 0; });
      return { section: s, runs: seen.length, reachPct: pct(seen.length, finished.length), medianSec: seen.length ? Math.round(median(seen.map(function (r) { return r.sectionMs[s]; })) / 100) / 10 : null };
    });
    var reportSec = finished.filter(function (r) { return r.reportMs > 0; }).map(function (r) { return r.reportMs / 1000; });

    // Segments: the same measures by who the person is and where they came from.
    function segment(key) {
      var g = groupBy(finished, function (r) { return r[key] || "unknown"; });
      return Object.keys(g).sort().map(function (k) {
        var rs = g[k], conf = rs.filter(function (r) { return r.delta != null; });
        var sv = rs.filter(function (r) { return r.survey && typeof r.survey.trust === "number"; });
        var t = { votes: 0, agrees: 0 };
        rs.forEach(function (r) { t.votes += r.votes; t.agrees += r.agrees; });
        return { group: k, runs: rs.length, meanDelta: mean1(conf.map(d)), confN: conf.length,
          evidencePct: pct(rs.filter(function (r) { return r.evidence > 0; }).length, rs.length),
          trust: mean1(sv.map(function (r) { return r.survey.trust; })), usefulness: mean1(sv.map(function (r) { return r.survey.usefulness; })), surveyN: sv.length,
          agreePct: pct(t.agrees, t.votes), votes: t.votes };
      });
    }
    var segments = { role: segment("role"), channel: segment("channel"), track: segment("track") };

    // Funnels. Field: every session that ran a screening, step by step. Study: toward a complete pair.
    var fieldRuns = runs.filter(function (r) { return r.track === "field"; });
    function sessionsWith(list, f) { var s = {}; list.forEach(function (r) { if (f(r)) s[r.sid] = 1; }); return Object.keys(s).length; }
    var funnel = {
      field: [
        ["Started a screening", sessionsWith(fieldRuns, function () { return true; })],
        ["Got a report", sessionsWith(fieldRuns, function (r) { return r.completed; })],
        ["Answered confidence before", sessionsWith(fieldRuns, function (r) { return r.pre != null; })],
        ["Opened any evidence link", sessionsWith(fieldRuns, function (r) { return r.evidence > 0; })],
        ["Voted on a claim or objection", sessionsWith(fieldRuns, function (r) { return r.votes > 0; })],
        ["Answered confidence after", sessionsWith(fieldRuns, function (r) { return r.post != null; })],
        ["Rated the report", sessionsWith(fieldRuns, function (r) { return !!r.survey; })]
      ],
      study: [
        ["Registered a code", pairs.length],
        ["AI chatbot part done", count(function (p) { return p.baseline.post != null; })],
        ["VistaDex part done", count(function (p) { return p.vistadex.post != null; })],
        ["Both parts complete (a pair)", complete.length]
      ]
    };

    // Data quality: what to report or exclude before trusting the numbers.
    var quality = {
      untouchedBefore: runs.filter(function (r) { return r.preMoved === false; }).length,
      beforeAnswers: runs.filter(function (r) { return r.pre != null; }).length,
      inferredRuns: runs.filter(function (r) { return r.inferred > 0; }).length,
      sampleRuns: runs.filter(function (r) { return r.mode === "mock" || r.mode === "sample"; }).length,
      studyWithoutCode: sids.filter(function (sid) { return (reg[sid] || {}).track === "study" && !normCode(reg[sid].code); }).length,
      excludedTestCodes: summary.excludedTestCodes
    };

    var result = { summary: summary, pairs: pairs, h1: h1, measures: measures, orderEffect: orderEffect, h2: h2, h3: h3, h4: h4,
      direction: direction, comprehension: comprehension, attention: attention,
      reportMedianMin: reportSec.length ? Math.round(median(reportSec) / 6) / 10 : null,
      segments: segments, funnel: funnel, quality: quality, runs: runs, votes: votes };
    result.findings = findings(result);
    return result;
  }

  function fmtNum(v) { return v == null ? "n/a" : (v > 0 ? "+" : "") + v; }
  function fmtPv(t) { return t.p == null ? "n/a" : (t.p < 0.001 ? "< 0.001" : t.p.toFixed(3)); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  // Plain statements of what the data shows, each with its n and whether it is enough to state.
  // No verdict words: the researcher interprets. Order: the paper's questions first.
  function findings(r) {
    var out = [];
    function add(id, title, n, min, unit, text) { out.push({ id: id, title: title, n: n, min: min, unit: unit, enough: n >= min, text: text }); }
    var p = r.h1.paired;
    add("h1_paired", "H1 · Confidence: VistaDex vs the AI chatbot", p.n, MIN_PAIRS, "complete pairs",
      "With the AI chatbot, confidence in the idea changed by " + fmtNum(r.h1.chatbot.meanDelta) + " points on average; with VistaDex by " +
      fmtNum(r.h1.vistadex.meanDelta) + ". Per participant, VistaDex minus chatbot: median " + fmtNum(p.test.median) + ", Wilcoxon p = " + fmtPv(p.test) + ".");
    var dir = r.direction;
    add("direction", "Confidence before and after a VistaDex report", dir.n, MIN_GROUP, "runs",
      "Across " + plural(dir.n, "run", "runs") + " with both answers, confidence went down in " + dir.lower + ", stayed the same in " + dir.same +
      " and went up in " + dir.higher + " (mean change " + fmtNum(dir.meanDelta) + ", mean size of change " + (dir.meanAbsDelta == null ? "n/a" : dir.meanAbsDelta) + " points).");
    var h2 = r.h2.runs, ks = Object.keys(h2.links).filter(function (k) { return h2.links[k] > 0; });
    add("h2_evidence", "H2 · Do people open the evidence?", h2.n, MIN_GROUP, "finished runs",
      "Evidence was opened in " + h2.opened + " of " + plural(h2.n, "finished run", "finished runs") + " (" + (pct(h2.opened, h2.n) == null ? "n/a" : pct(h2.opened, h2.n) + "%") + ")." +
      (ks.length ? " Links opened: " + ks.map(function (k) { return k.replace("_", " ") + " " + h2.links[k]; }).join(", ") + "." : " No evidence link has been opened yet."));
    var st = r.h3.byClaimStatus, totalVotes = 0;
    Object.keys(st).forEach(function (k) { totalVotes += st[k].votes; });
    add("h3_agreement", "H3 · Agreement with the report's verdict, by claim status", totalVotes, MIN_VOTES, "claim votes",
      STATUSES.filter(function (k) { return st[k]; }).map(function (k) { return k + " " + st[k].agreePct + "% agree (" + plural(st[k].votes, "vote", "votes") + ")"; }).join("; ") +
      (totalVotes ? ". Agreeing with every status alike, contradicted as much as confirmed, would suggest the verdicts are taken on trust; telling them apart suggests they are read." : "No claim votes yet."));
    var h4 = r.h4;
    add("h4_opening", "H4 · Confidence change with and without opening evidence", Math.min(h4.clickers.n, h4.nonClickers.n), MIN_GROUP, "runs in the smaller group",
      "Runs where evidence was opened: mean change " + fmtNum(h4.clickers.meanDelta) + " (" + plural(h4.clickers.n, "run", "runs") + "); runs without: " + fmtNum(h4.nonClickers.meanDelta) +
      " (" + plural(h4.nonClickers.n, "run", "runs") + "). Mann-Whitney p = " + fmtPv(h4.test) + ". This compares people who chose to open links, so it shows an association, not a cause.");
    var c = r.comprehension, cn = 0;
    Object.keys(c).forEach(function (k) { cn += c[k]; });
    add("comprehension", "Do people read \"unverified\" correctly?", cn, MIN_GROUP, "answers",
      (c.honest_uncertainty || 0) + " of " + plural(cn, "answer", "answers") + " (" + (pct(c.honest_uncertainty || 0, cn) == null ? "n/a" : pct(c.honest_uncertainty || 0, cn) + "%") +
      ") read \"unverified\" as \"not enough independent sources either way\"; " + (c.system_failure || 0) + " read it as a system failure, " + (c.not_sure || 0) + " were not sure.");
    var att = r.attention.filter(function (a) { return a.runs > 0; }).sort(function (a, b) { return b.reachPct - a.reachPct; });
    add("attention", "What people read in the report", r.summary.finishedRuns, MIN_GROUP, "finished runs",
      (att.length ? "Share of finished runs that showed each section: " + att.map(function (a) { return a.section.replace("_", " ") + " " + a.reachPct + "%"; }).join(", ") + "." : "No section reading time yet.") +
      (r.reportMedianMin != null ? " Median time on the report: " + r.reportMedianMin + " min." : ""));
    var roles = r.segments.role.filter(function (s) { return s.group !== "unknown"; });
    add("roles", "By role", roles.reduce(function (a, s) { return Math.min(a, s.runs); }, roles.length ? Infinity : 0), MIN_GROUP, "runs in the smallest role",
      roles.length ? roles.map(function (s) { return s.group + ": " + plural(s.runs, "run", "runs") + ", confidence change " + fmtNum(s.meanDelta) + ", evidence opened in " + (s.evidencePct == null ? "n/a" : s.evidencePct + "%") + ", trust " + (s.trust == null ? "n/a" : s.trust); }).join("; ") + "." : "No roles recorded yet.");
    var q = r.quality;
    add("quality", "Data quality", q.beforeAnswers, 1, "before answers",
      q.untouchedBefore + " of " + plural(q.beforeAnswers, "\"before\" answer was", "\"before\" answers were") + " left at the slider's start (50): report them, or rerun H1 without them. " +
      plural(q.inferredRuns, "run has", "runs have") + " measures matched by start order (older ids). " + plural(q.excludedTestCodes, "TEST code is", "TEST codes are") + " left out.");
    return out;
  }

  // ── Tables for export (the console's CSV downloads and the analysis script's --out) ──
  function csvCell(v) {
    var s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(head, rows) { return [head.join(",")].concat(rows.map(function (r) { return r.map(csvCell).join(","); })).join("\n"); }
  function exportTables(result, events) {
    var t = {};
    var per = ["runId", "pre", "preMoved", "post", "delta", "trust", "usefulness", "helpfulness", "effort", "sourcesChecked", "openText"];
    var ph = ["code", "sessions", "idea", "order", "order_inferred", "complete"];
    ["chatbot", "vistadex"].forEach(function (c) { per.forEach(function (k) { ph.push(c + "_" + k); }); });
    t["paired.csv"] = toCSV(ph.concat(["vistadex_links_opened", "vistadex_items_voted", "vistadex_agree_pct"]), result.pairs.map(function (p) {
      var row = [p.code, p.sessions.join(";"), p.idea, p.order, p.orderInferred, p.complete];
      [p.baseline, p.vistadex].forEach(function (c) { per.forEach(function (k) { row.push(c[k]); }); });
      return row.concat([p.vistadex.clicks, p.vistadex.votes, p.vistadex.agreePct]);
    }));
    var kinds = ["graveyard", "competitors", "big_tech", "legal", "market"];
    t["runs.csv"] = toCSV(["session_id", "run_id", "label", "track", "role", "channel", "industries", "mode", "sample", "completed", "pre", "pre_moved", "post", "delta",
      "claim_links_opened", "other_links_opened"].concat(kinds.map(function (k) { return k + "_links"; })).concat(["evidence_opened", "votes", "agrees", "disagrees", "not_sure", "agree_pct",
      "trust", "usefulness", "helpfulness", "effort", "sources_checked_self_report", "comprehension", "report_seconds", "claim_reading_seconds", "matched_by_start_order"]),
      result.runs.map(function (r) {
        var s = r.survey || {};
        return [r.sid, r.runId, r.label, r.track, r.role, r.channel, r.industries, r.mode, r.sample, r.completed, r.pre, r.preMoved, r.post, r.delta, r.clicks, r.links]
          .concat(kinds.map(function (k) { return r.linksBy[k] || 0; }))
          .concat([r.evidence, r.votes, r.agrees, r.disagrees, r.notSure, agreePct(r), s.trust, s.usefulness, s.helpfulness, s.effort, s.sources_checked, r.comp,
            Math.round(r.reportMs / 100) / 10, Math.round(r.dwell / 100) / 10, r.inferred]);
      }));
    t["attention.csv"] = toCSV(["session_id", "run_id", "track", "role"].concat(SECTIONS.map(function (s) { return s + "_seconds"; })), result.runs.filter(function (r) { return r.completed; }).map(function (r) {
      return [r.sid, r.runId, r.track, r.role].concat(SECTIONS.map(function (s) { return Math.round((r.sectionMs[s] || 0) / 100) / 10; }));
    }));
    t["votes.csv"] = toCSV(["session_id", "run_id", "item", "index", "claim_status", "objection_severity", "vote", "role", "track"], result.votes.map(function (v) {
      return [v.sid, v.run ? v.run.runId : null, v.type === "claim_vote" ? "claim" : "objection", v.index, v.status, v.severity, v.vote, v.run ? v.run.role : null, v.run ? v.run.track : null];
    }));
    var q = [];
    events.forEach(function (e) {
      var p = e.payload || {};
      if ((e.type === "run_scoped_survey" || e.type === "condition_survey") && p.open_text && String(p.open_text).trim()) q.push([e.ts, e.session_id, "report survey (" + (p.condition || "?") + ")", p.run_id, String(p.open_text).trim()]);
      if (e.type === "feedback_submitted" && p.wrong && String(p.wrong).trim()) q.push([e.ts, e.session_id, "feedback form (" + [p.role, p.useful, p.section, p.would_use].filter(Boolean).join(", ") + ")", null, String(p.wrong).trim()]);
    });
    t["open-answers.csv"] = toCSV(["ts", "session_id", "source", "run_id", "text"], q);
    t["segments.csv"] = toCSV(["by", "group", "finished_runs", "runs_with_confidence", "mean_confidence_change", "evidence_opened_pct", "survey_answers", "mean_trust", "mean_usefulness", "votes", "agree_pct"],
      ["role", "channel", "track"].reduce(function (rows, by) {
        return rows.concat(result.segments[by].map(function (s) { return [by, s.group, s.runs, s.confN, s.meanDelta, s.evidencePct, s.surveyN, s.trust, s.usefulness, s.votes, s.agreePct]; }));
      }, []));
    return t;
  }

  return { PER_RUN_TYPES: PER_RUN_TYPES, joinRuns: joinRuns, latestVotes: latestVotes, voteTotals: voteTotals, agreePct: agreePct,
    pairedParticipants: pairedParticipants, wilcoxon: wilcoxon, mannWhitney: mannWhitney, analyzeStudy: analyzeStudy,
    exportTables: exportTables, toCSV: toCSV, EVIDENCE_CONTROLS: EVIDENCE_CONTROLS, SECTIONS: SECTIONS };
}

const join = researchJoin();
export const PER_RUN_TYPES = join.PER_RUN_TYPES;
export const joinRuns = join.joinRuns;
export const latestVotes = join.latestVotes;
export const voteTotals = join.voteTotals;
export const agreePct = join.agreePct;
export const pairedParticipants = join.pairedParticipants;
export const wilcoxon = join.wilcoxon;
export const mannWhitney = join.mannWhitney;
export const analyzeStudy = join.analyzeStudy;
export const exportTables = join.exportTables;
