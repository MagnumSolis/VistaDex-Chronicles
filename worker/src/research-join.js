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
      // study-19: what the judgement was based on (multi-select); null when that study version did not ask.
      basis: survey && Object.prototype.toString.call(sq.basis) === "[object Array]" ? sq.basis : null,
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
      // The study version this participant saw (their registration's). Earlier versions stay in the
      // analysis; measures added later are null for them, never filled in.
      var regs = evs.filter(function (e) { return e.type === "participant_registered" && e.study_version; });
      var version = regs.length ? regs[regs.length - 1].study_version : (evs[0] && evs[0].study_version) || null;
      return { code: code, sessions: people[code].sessions, idea: idea || null, order: order, orderInferred: inferred, version: version,
        complete: b.pre != null && b.post != null && v.pre != null && v.post != null, baseline: b, vistadex: v,
        last: evs.length ? evs[evs.length - 1].ts : null };
    });
  }

  // ── Appropriate reliance (study-19; BITS F364 L20-21) ──
  // A claim vote is a participant accepting (agree) or overriding (disagree) VistaDex's status. Whether that was
  // appropriate depends on whether VistaDex was right, which needs ground truth: the team's answer key for the
  // fixed study ideas. Each entry matches a report claim by words that must all appear in the claim text, and
  // gives the truth found by the team with a source: "true", "false", "disputed" or "unknown" (no reliable
  // evidence either way, so "unverified" is the right status). truth null = not decided yet, never guessed.
  // TODO(team): fill in truth and source for each claim of ideas A, B, D, E (C retired) before the analysis is reported.
  var DEFAULT_ANSWER_KEY = {
    A: [{ match: ["no such tool"], truth: null, source: "" }, { match: ["diabetes app market"], truth: null, source: "" }, { match: ["meal logs"], truth: null, source: "" }],
    B: [{ match: ["no platform"], truth: null, source: "" }, { match: ["ed-tech market"], truth: null, source: "" }, { match: ["university clubs"], truth: null, source: "" }],
    C: [{ match: ["static question banks"], truth: null, source: "" }, { match: ["job-readiness market"], truth: null, source: "" }, { match: ["500 hired candidates"], truth: null, source: "" }],
    D: [{ match: ["homejoy"], truth: null, source: "" }, { match: ["home-services market"], truth: null, source: "" }, { match: ["repair records"], truth: null, source: "" }],
    E: [{ match: ["no app"], truth: null, source: "" }, { match: ["rental market"], truth: null, source: "" }, { match: ["housing societies"], truth: null, source: "" }]
  };
  var RIGHT_STATUS = { "true": "confirmed", "false": "contradicted", disputed: "disputed", unknown: "unverified" };
  function keyEntry(key, idea, claimText) {
    var low = String(claimText || "").toLowerCase();
    var list = (key && key[idea]) || [];
    for (var i = 0; i < list.length; i++) {
      var words = list[i].match || [];
      if (words.length && words.every(function (w) { return low.indexOf(String(w).toLowerCase()) >= 0; })) return list[i];
    }
    return null;
  }
  function relianceMatrix(ev, key) {
    var snaps = {}, codeBySid = {};
    ev.forEach(function (e) {
      var q = e.payload || {};
      if (e.type === "participant_registered" && q.track === "study" && normCode(q.code)) codeBySid[e.session_id] = normCode(q.code);
      if (e.type === "vistadex_report_snapshot" && q.run_id && q.report) snaps[e.session_id + "\u0000" + q.run_id] = q;
    });
    var latest = {}, order = [];
    ev.forEach(function (e) {
      if (e.type !== "claim_vote") return;
      var q = e.payload || {}, k = e.session_id + "\u0000" + q.run_id + "\u0000" + q.claim_index;
      if (!latest[k]) order.push(k);
      latest[k] = { sid: e.session_id, run: q.run_id, index: q.claim_index, vote: q.vote, status: q.status };
    });
    var m = { appropriateReliance: 0, overReliance: 0, underReliance: 0, appropriateOverride: 0, notSure: 0, keyed: 0, unkeyed: 0, votes: order.length, keyReady: false, byParticipant: [] };
    var per = {};
    Object.keys(key || {}).forEach(function (idea) { (key[idea] || []).forEach(function (x) { if (x.truth) m.keyReady = true; }); });
    order.forEach(function (k) {
      var v = latest[k], snap = snaps[v.sid + "\u0000" + v.run];
      var claim = snap && snap.report.claims ? snap.report.claims[v.index] : null;
      var entry = claim ? keyEntry(key, snap.idea_key, claim.claim) : null;
      if (!entry || !entry.truth || !RIGHT_STATUS[entry.truth]) { m.unkeyed++; return; }
      m.keyed++;
      var code = codeBySid[v.sid] || v.sid;
      var p = per[code] || (per[code] = { code: code, appropriateReliance: 0, overReliance: 0, underReliance: 0, appropriateOverride: 0, notSure: 0 });
      var right = (claim.status || v.status) === RIGHT_STATUS[entry.truth];
      var cell = v.vote === "agree" ? (right ? "appropriateReliance" : "overReliance") : v.vote === "disagree" ? (right ? "underReliance" : "appropriateOverride") : "notSure";
      m[cell]++; p[cell]++;
    });
    m.byParticipant = Object.keys(per).sort().map(function (c) { return per[c]; });
    var decided = m.keyed - m.notSure;
    m.appropriatePct = decided ? Math.round(100 * (m.appropriateReliance + m.appropriateOverride) / decided) : null;
    return m;
  }

  var BASIS = ["answer", "sources", "own_knowledge", "own_search", "other"];
  function basisCounts(pairs, c) {
    var counts = {}, asked = 0;
    BASIS.forEach(function (b) { counts[b] = 0; });
    pairs.forEach(function (p) { var b = p[c] && p[c].basis; if (!b) return; asked++; b.forEach(function (x) { if (counts[x] != null) counts[x]++; }); });
    return { asked: asked, counts: counts };
  }
  // "This looks wrong" in the public report (study-19): which claims and objections people contest.
  function flagCounts(ev) {
    var f = { total: 0, claim: 0, objection: 0, runs: 0, byStatus: {} }, runs = {};
    ev.forEach(function (e) {
      if (e.type !== "report_flag") return;
      var q = e.payload || {};
      f.total++;
      if (q.kind === "objection") f.objection++; else f.claim++;
      if (q.kind === "claim" && q.status) f.byStatus[q.status] = (f.byStatus[q.status] || 0) + 1;
      runs[e.session_id + "\u0000" + q.run_id] = 1;
    });
    f.runs = Object.keys(runs).length;
    return f;
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
    // Waiting-screen quiz (study-13): quiz events carry the run id of the run they waited for.
    var runByKey = {};
    runs.forEach(function (r) { r.quiz = null; if (r.runId) runByKey[r.sid + "\u0000" + r.runId] = r; });
    ev.forEach(function (e) {
      if (!/^quiz_/.test(e.type)) return;
      var q = e.payload || {}, r = runByKey[e.session_id + "\u0000" + q.run_id];
      if (!r) return;
      if (e.type === "quiz_started") r.quiz = { source: q.source || null, answered: 0, score: 0, completed: false, ms: [] };
      if (!r.quiz) return;
      if (e.type === "quiz_answered") { r.quiz.answered++; if (q.correct === true) r.quiz.score++; if (typeof q.ms === "number") r.quiz.ms.push(q.ms); }
      if (e.type === "quiz_finished") r.quiz.completed = q.completed === true;
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

    // Quiz: does anyone use the wait, and do quiz players read the graveyard section more? Only live runs:
    // sample runs finish too fast for the quiz to be shown.
    var liveRuns = runs.filter(function (r) { return r.mode === "live"; });
    var quizRuns = liveRuns.filter(function (r) { return r.quiz; });
    var done = quizRuns.filter(function (r) { return r.quiz.completed; });
    var answerMs = [], answers = 0, right = 0;
    quizRuns.forEach(function (r) { answerMs = answerMs.concat(r.quiz.ms); answers += r.quiz.answered; right += r.quiz.score; });
    var liveFinished = liveRuns.filter(function (r) { return r.completed; });
    function gy(list) {
      var secs = list.map(function (r) { return (r.sectionMs.graveyard || 0) / 1000; });
      return { n: list.length, medianSec: list.length ? Math.round(median(secs) * 10) / 10 : null, secs: secs,
        linksPct: pct(list.filter(function (r) { return (r.linksBy.graveyard || 0) > 0; }).length, list.length) };
    }
    var gq = gy(liveFinished.filter(function (r) { return r.quiz; })), go = gy(liveFinished.filter(function (r) { return !r.quiz; }));
    var quiz = { liveRuns: liveRuns.length, started: quizRuns.length, startPct: pct(quizRuns.length, liveRuns.length),
      completed: done.length, abandoned: quizRuns.length - done.length,
      fallback: quizRuns.filter(function (r) { return r.quiz.source === "fallback"; }).length,
      meanScore: mean1(done.map(function (r) { return r.quiz.score; })),
      correctPct: pct(right, answers), answers: answers,
      medianAnswerSec: answerMs.length ? Math.round(median(answerMs) / 100) / 10 : null,
      graveyard: { quizzers: gq, others: go, test: mannWhitney(gq.secs, go.secs) } };

    var result = { summary: summary, quiz: quiz, pairs: pairs, h1: h1, measures: measures, orderEffect: orderEffect, h2: h2, h3: h3, h4: h4,
      direction: direction, comprehension: comprehension, attention: attention,
      reportMedianMin: reportSec.length ? Math.round(median(reportSec) / 6) / 10 : null,
      segments: segments, funnel: funnel, quality: quality, runs: runs, votes: votes, comparison: chatbotComparison(ev),
      basis: { baseline: basisCounts(pairs, "baseline"), vistadex: basisCounts(pairs, "vistadex") },
      reliance: relianceMatrix(ev, (opts && opts.answerKey) || DEFAULT_ANSWER_KEY), flags: flagCounts(ev) };
    result.findings = findings(result);
    return result;
  }

  // ── Chatbot vs VistaDex (study-16): the pasted chatbot answer next to the participant's VistaDex report ──
  // Everything here is counted in code from the two texts, so the same input always gives the same numbers.
  // These are features for the paper's comparison, not judgements of quality: the coding sheet
  // (chatbot-answers.csv) is for human raters. Links: chatbots often drop their citation links when an
  // answer is copied, so "links" counts only URLs that survived the paste, and "domains" (distinct websites)
  // also counts websites named without a link (levels.com), which a paste keeps as plain words.
  var URL_RE = /https?:\/\/[^\s<>()"'\]]+/gi;
  // A bare domain: not inside a URL or an e-mail address, ending in a common top-level domain (so figures,
  // abbreviations like e.g. or U.S., and file names like report.pdf do not count).
  var BARE_DOMAIN_RE = /(^|[^@\w.\/-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|org|net|io|ai|co|app|dev|gov|edu|in|uk|us|eu|de|fr|xyz|info|biz|health))(?![\w-])/gi;
  var FIGURE_RE = /(?:[$€£₹]\s?\d[\d,.]*(?:\s?(?:k|m|bn|b|billion|million|thousand|trillion)\b)?|\b\d[\d,.]*\s?(?:%|percent\b|billion\b|million\b|bn\b))/gi;
  var HEDGE_RE = /\b(may|might|could|unclear|uncertain|not sure|cannot be verified|can't verify|could not verify|couldn't verify|unable to verify|not verifiable|unverified|no reliable|limited data|as of my|i don't have access|i do not have access|estimated?|approximately|roughly)\b/gi;
  var VERDICT_RE = /\b(good idea|great idea|bad idea|promising|strong potential|high potential|worth pursuing|not worth pursuing|not viable|highly viable|go for it|i would invest|i would not invest)\b|\b\d{1,2}(?:\.\d)?\s?\/\s?10\b/gi;
  // Does the text take up each of VistaDex's sections? (a word list per section, case-insensitive)
  var SECTION_WORDS = {
    claims: ["claim", "true", "false", "accurate", "inaccurate", "verify", "verified", "evidence"],
    competitors: ["competitor", "competition", "alternative", "rival", "similar product", "existing product", "incumbent"],
    graveyard: ["shut down", "shutdown", "failed", "defunct", "closed down", "went out of business", "folded", "post-mortem", "postmortem"],
    big_tech: ["google", "amazon", "microsoft", "apple", "meta", "big tech"],
    objections: ["risk", "challenge", "concern", "objection", "weakness", "downside"],
    legal: ["regulat", "legal", "licen", "compliance", "gdpr", "hipaa", "fda", "liability"]
  };
  var STOP = { about: 1, after: 1, their: 1, there: 1, these: 1, those: 1, which: 1, while: 1, would: 1, could: 1, should: 1, other: 1, every: 1, being: 1, where: 1, people: 1, today: 1, building: 1 };
  function matches(text, re) { var m = String(text || "").match(re); return m ? m.length : 0; }
  function host(u) { var m = /^https?:\/\/([^\/?#]+)/i.exec(u); return m ? m[1].toLowerCase().replace(/^www\./, "") : ""; }
  function uniq(xs) { var seen = {}, out = []; xs.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
  function normFig(f) { return String(f).toLowerCase().replace(/[\s,]/g, "").replace(/percent$/, "%").replace(/billion$/, "b").replace(/bn$/, "b").replace(/million$/, "m"); }
  function textFeatures(text) {
    var t = String(text || ""), low = t.toLowerCase();
    var urls = uniq((t.match(URL_RE) || []).map(function (u) { return u.replace(/[.,;:]+$/, ""); }));
    var sites = urls.map(host), m;
    BARE_DOMAIN_RE.lastIndex = 0;
    while ((m = BARE_DOMAIN_RE.exec(t))) sites.push(m[2].toLowerCase().replace(/^www\./, ""));
    var sections = {};
    Object.keys(SECTION_WORDS).forEach(function (k) { sections[k] = SECTION_WORDS[k].some(function (w) { return low.indexOf(w) >= 0; }); });
    return { chars: t.length, words: (t.match(/\S+/g) || []).length, links: urls.length, domains: uniq(sites).length,
      figures: matches(t, FIGURE_RE), hedges: matches(t, HEDGE_RE), verdicts: matches(t, VERDICT_RE),
      sections: sections, sectionsCovered: Object.keys(sections).filter(function (k) { return sections[k]; }).length };
  }
  // A name from the report that the chatbot's text also names (case-insensitive, whole name).
  function named(low, name) { var n = String(name || "").toLowerCase().replace(/^\s+|\s+$/g, ""); return n.length >= 3 && low.indexOf(n) >= 0; }
  // A report claim the chatbot's text takes up: one of the claim's figures appears, or most of its content words.
  function claimMentioned(low, claim) {
    var c = String(claim || ""), figs = (c.match(FIGURE_RE) || []).map(normFig);
    var lowFigs = (low.match(FIGURE_RE) || []).map(normFig);
    if (figs.some(function (f) { return lowFigs.indexOf(f) >= 0; })) return true;
    var words = uniq((c.toLowerCase().match(/[a-z]{5,}/g) || []).filter(function (w) { return !STOP[w]; }));
    if (!words.length) return false;
    var hit = words.filter(function (w) { return low.indexOf(w) >= 0; }).length;
    return hit / words.length >= 0.6;
  }
  function reportFeatures(r) {
    var by = { confirmed: 0, contradicted: 0, disputed: 0, unverified: 0 };
    (r.claims || []).forEach(function (c) { if (by[c.status] != null) by[c.status]++; });
    return { claims: (r.claims || []).length, confirmed: by.confirmed, contradicted: by.contradicted, disputed: by.disputed, unverified: by.unverified,
      sources: r.sources == null ? null : r.sources, domains: r.domains == null ? null : r.domains,
      competitors: (r.competitors || []).length, graveyard: (r.graveyard || []).length, objections: (r.objections || []).length,
      bigTech: r.big_tech ? r.big_tech.level : null, legal: r.legal ? r.legal.length : 0, score: r.score == null ? null : r.score,
      sampleFields: (r.sample_fields || []).join(";") };
  }
  // The report as plain text, for the coding sheet (raters read both answers side by side).
  function reportText(r) {
    var L = [];
    L.push("VistaDex Score: " + (r.score == null ? "not enough data" : r.score) + ((r.sample_fields || []).length ? " (sample data in: " + r.sample_fields.join(", ") + ")" : ""));
    L.push("Claims:");
    (r.claims || []).forEach(function (c) { L.push("- [" + c.status + "] " + c.claim + " (" + (c.urls || []).length + " sources)"); });
    L.push("Competitors: " + ((r.competitors || []).map(function (c) { return c.name; }).join(", ") || "none found"));
    L.push("Leads to check (startups that shut down):");
    (r.graveyard || []).forEach(function (g) { L.push("- " + g.company + " (" + (g.cause || "cause unknown") + (g.year ? ", " + g.year : "") + ")"); });
    if (r.big_tech) L.push("Big Tech risk: " + r.big_tech.level + ((r.big_tech.companies || []).length ? " (" + r.big_tech.companies.join(", ") + ")" : ""));
    L.push("Objections:");
    (r.objections || []).forEach(function (o) { L.push("- [" + o.severity + "] " + o.objection); });
    (r.legal || []).forEach(function (j) { L.push("Legal, " + j.jurisdiction + ": " + ((j.requirements || []).join("; ") || "nothing found")); });
    if (r.market && r.market.tam) L.push("Market (TAM): " + r.market.tam);
    return L.join("\n");
  }
  // Two-sided exact sign test: how often one tool was picked over the other ("same" left out).
  function signTest(a, b) {
    var n = a + b;
    if (!n) return { n: 0, p: null };
    var k = Math.min(a, b), tail = 0, c = 1;
    for (var i = 0; i <= n; i++) { if (i > 0) c = c * (n - i + 1) / i; if (i <= k) tail += c; }
    return { n: n, p: Math.min(1, 2 * tail / Math.pow(2, n)) };
  }
  var PREF_KEYS = ["overall", "accuracy", "evidence", "risks", "honesty", "decision"];
  function chatbotComparison(ev) {
    var codeBySid = {};
    ev.forEach(function (e) { var q = e.payload || {}; if (e.type === "participant_registered" && q.track === "study" && normCode(q.code)) codeBySid[e.session_id] = normCode(q.code); });
    var people = {}, codes = [];
    ev.forEach(function (e) {
      var code = codeBySid[e.session_id];
      if (!code) return;
      if (!people[code]) { people[code] = { answer: null, snapshot: null, pref: null, profile: null, idea: null }; codes.push(code); }
      var p = people[code], q = e.payload || {};
      // The latest of each counts (a participant who pasted twice: the second paste).
      if (e.type === "chatbot_answer") p.answer = q;
      if (e.type === "vistadex_report_snapshot") { p.snapshot = q; p.idea = q.idea_key || p.idea; }
      if (e.type === "tool_preference") p.pref = q;
      if (e.type === "participant_profile") p.profile = q;
      if (e.type === "condition_started" && !p.idea) p.idea = q.idea_key || null;
    });
    var rows = codes.sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); }).map(function (code) {
      var p = people[code], a = p.answer, r = p.snapshot ? p.snapshot.report || {} : null;
      var cf = a ? textFeatures(a.text) : null, low = a ? String(a.text || "").toLowerCase() : "";
      var overlap = null;
      if (a && r) {
        var names = function (xs, f) { var list = (xs || []).map(f); return { of: list.length, named: list.filter(function (n) { return named(low, n); }).length }; };
        overlap = {
          competitors: names(r.competitors, function (c) { return c.name; }),
          graveyard: names(r.graveyard, function (g) { return g.company; }),
          bigTech: names(r.big_tech ? r.big_tech.companies : [], function (n) { return n; }),
          claims: { of: (r.claims || []).length, named: (r.claims || []).filter(function (c) { return claimMentioned(low, c.claim); }).length }
        };
      }
      return { code: code, idea: p.idea, tool: a ? a.tool : null, model: a ? a.model || null : null, webSearch: a ? a.web_search : null,
        chatbotText: a ? String(a.text || "") : null, chatbot: cf, vistadex: r ? reportFeatures(r) : null, reportText: r ? reportText(r) : null,
        overlap: overlap, preference: p.pref, profile: p.profile, both: !!(a && r) };
    });
    var both = rows.filter(function (x) { return x.both; });
    function paired(fc, fv) {
      var ps = both.filter(function (x) { return fc(x) != null && fv(x) != null; });
      var t = wilcoxon(ps.map(function (x) { return fv(x) - fc(x); }));
      return { n: ps.length, chatbotMedian: ps.length ? median(ps.map(fc)) : null, vistadexMedian: ps.length ? median(ps.map(fv)) : null, test: t };
    }
    var features = [
      ["sources", "Distinct sources (links in the chatbot answer / sources in the report)", function (x) { return x.chatbot.links; }, function (x) { return x.vistadex.sources; }],
      ["domains", "Distinct websites", function (x) { return x.chatbot.domains; }, function (x) { return x.vistadex.domains; }]
    ].map(function (f) { var t = paired(f[2], f[3]); t.id = f[0]; t.label = f[1]; return t; });
    // What the report found that the chatbot also named: the mean share per participant, over those whose
    // report found any (a report with no competitors says nothing about the chatbot's coverage).
    var coverage = {};
    ["claims", "competitors", "graveyard", "bigTech"].forEach(function (k) {
      var ps = both.filter(function (x) { return x.overlap[k].of > 0; });
      coverage[k] = { n: ps.length, meanPct: ps.length ? Math.round(100 * ps.reduce(function (a, x) { return a + x.overlap[k].named / x.overlap[k].of; }, 0) / ps.length) : null };
    });
    var prefs = {};
    var answered = rows.filter(function (x) { return x.preference; });
    PREF_KEYS.forEach(function (k) {
      var c = { chatbot: 0, vistadex: 0, same: 0, unanswered: 0 };
      answered.forEach(function (x) { var v = x.preference[k]; if (c[v] != null) c[v]++; else c.unanswered++; });
      c.test = signTest(c.vistadex, c.chatbot);
      prefs[k] = c;
    });
    var tools = {};
    rows.forEach(function (x) { if (x.tool) tools[x.tool] = (tools[x.tool] || 0) + 1; });
    return { rows: rows, n: { participants: rows.length, answers: rows.filter(function (x) { return x.tool; }).length, both: both.length, preferences: answered.length },
      tools: tools, features: features, coverage: coverage, preferences: prefs,
      chatbotVerdictPct: both.length ? Math.round(100 * both.filter(function (x) { return x.chatbot.verdicts > 0; }).length / both.length) : null };
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
    var cmp = r.comparison;
    if (cmp) {
      var po = cmp.preferences.overall;
      add("preference", "Which helped more: the AI chatbot or VistaDex", cmp.n.preferences, MIN_PAIRS, "participants",
        "Asked which helped them more to judge the idea, " + po.vistadex + " chose VistaDex, " + po.chatbot + " the AI chatbot and " + po.same +
        " said about the same (sign test over those who chose one, p = " + fmtPv(po.test) + ").");
      var fs = cmp.features[0];
      add("sources", "Sources: the pasted chatbot answer vs the VistaDex report", fs.n, MIN_PAIRS, "pairs of answers",
        "Median distinct sources: " + (fs.chatbotMedian == null ? "n/a" : fs.chatbotMedian) + " links in the chatbot answer as pasted, " +
        (fs.vistadexMedian == null ? "n/a" : fs.vistadexMedian) + " in the VistaDex report (Wilcoxon p = " + fmtPv(fs.test) + "). Links a chatbot showed but that did not survive copying are not counted.");
    }
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
    var qz = r.quiz, gq = qz.graveyard;
    add("quiz", "The waiting-screen quiz and the graveyard section", Math.min(gq.quizzers.n, gq.others.n), MIN_GROUP, "finished live runs in the smaller group",
      "The quiz was started in " + qz.started + " of " + plural(qz.liveRuns, "live run", "live runs") + " (" + (qz.startPct == null ? "n/a" : qz.startPct + "%") + "); " +
      qz.completed + " finished all three questions, " + qz.abandoned + " stopped when the report arrived or the visitor left. " +
      (qz.answers ? qz.correctPct + "% of " + plural(qz.answers, "answer was", "answers were") + " right, median " + qz.medianAnswerSec + " s per answer. " : "") +
      "Time on the graveyard section (median): " + (gq.quizzers.medianSec == null ? "n/a" : gq.quizzers.medianSec + " s") + " after playing (" + plural(gq.quizzers.n, "run", "runs") + "), " +
      (gq.others.medianSec == null ? "n/a" : gq.others.medianSec + " s") + " without (" + plural(gq.others.n, "run", "runs") + "); Mann-Whitney p = " + fmtPv(gq.test) +
      ". A graveyard link was opened in " + (gq.quizzers.linksPct == null ? "n/a" : gq.quizzers.linksPct + "%") + " vs " + (gq.others.linksPct == null ? "n/a" : gq.others.linksPct + "%") +
      ". Visitors choose to play, so this shows an association, not a cause.");
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
    // study_version and basis (study-19) at the end: earlier versions have no basis (empty, not "none").
    t["paired.csv"] = toCSV(ph.concat(["vistadex_links_opened", "vistadex_items_voted", "vistadex_agree_pct", "study_version", "chatbot_basis", "vistadex_basis"]), result.pairs.map(function (p) {
      var row = [p.code, p.sessions.join(";"), p.idea, p.order, p.orderInferred, p.complete];
      [p.baseline, p.vistadex].forEach(function (c) { per.forEach(function (k) { row.push(c[k]); }); });
      return row.concat([p.vistadex.clicks, p.vistadex.votes, p.vistadex.agreePct, p.version,
        p.baseline.basis ? p.baseline.basis.join(";") : null, p.vistadex.basis ? p.vistadex.basis.join(";") : null]);
    }));
    if (result.reliance) {
      t["reliance.csv"] = toCSV(["code", "appropriate_reliance", "over_reliance", "under_reliance", "appropriate_override", "not_sure"], result.reliance.byParticipant.map(function (r) {
        return [r.code, r.appropriateReliance, r.overReliance, r.underReliance, r.appropriateOverride, r.notSure];
      }));
    }
    var kinds = ["graveyard", "competitors", "big_tech", "legal", "market"];
    t["runs.csv"] = toCSV(["session_id", "run_id", "label", "track", "role", "channel", "industries", "mode", "sample", "completed", "pre", "pre_moved", "post", "delta",
      "claim_links_opened", "other_links_opened"].concat(kinds.map(function (k) { return k + "_links"; })).concat(["evidence_opened", "votes", "agrees", "disagrees", "not_sure", "agree_pct",
      "trust", "usefulness", "helpfulness", "effort", "sources_checked_self_report", "comprehension", "report_seconds", "claim_reading_seconds", "matched_by_start_order",
      "quiz_started", "quiz_source", "quiz_answered", "quiz_score", "quiz_completed", "quiz_median_answer_seconds"]),
      result.runs.map(function (r) {
        var s = r.survey || {};
        return [r.sid, r.runId, r.label, r.track, r.role, r.channel, r.industries, r.mode, r.sample, r.completed, r.pre, r.preMoved, r.post, r.delta, r.clicks, r.links]
          .concat(kinds.map(function (k) { return r.linksBy[k] || 0; }))
          .concat([r.evidence, r.votes, r.agrees, r.disagrees, r.notSure, agreePct(r), s.trust, s.usefulness, s.helpfulness, s.effort, s.sources_checked, r.comp,
            Math.round(r.reportMs / 100) / 10, Math.round(r.dwell / 100) / 10, r.inferred,
            !!r.quiz, r.quiz ? r.quiz.source : null, r.quiz ? r.quiz.answered : null, r.quiz ? r.quiz.score : null, r.quiz ? r.quiz.completed : null,
            r.quiz && r.quiz.ms.length ? Math.round(median(r.quiz.ms) / 100) / 10 : null]);
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
    var cmp = result.comparison || chatbotComparison(events);
    var sec = Object.keys(SECTION_WORDS);
    t["comparison.csv"] = toCSV(["code", "idea", "tool", "model", "web_search", "both",
      "chatbot_words", "chatbot_links", "chatbot_domains", "chatbot_figures", "chatbot_hedges", "chatbot_verdict_phrases", "chatbot_sections_covered"]
      .concat(sec.map(function (k) { return "chatbot_mentions_" + k; }))
      .concat(["report_claims", "report_confirmed", "report_contradicted", "report_disputed", "report_unverified", "report_sources", "report_domains",
        "report_competitors", "report_graveyard_leads", "report_objections", "report_big_tech", "report_big_tech_companies", "report_legal_markets", "report_score", "report_sample_fields",
        "claims_chatbot_mentioned", "competitors_chatbot_named", "graveyard_chatbot_named", "big_tech_chatbot_named",
        "pref_overall", "pref_accuracy", "pref_evidence", "pref_risks", "pref_honesty", "pref_decision", "pref_options_order", "pref_why",
        "market_familiarity", "ai_trust", "ai_use"]),
      cmp.rows.map(function (x) {
        var c = x.chatbot || { sections: {} }, v = x.vistadex || {}, o = x.overlap, pf = x.preference || {}, pr = x.profile || {};
        var k = function (part) { return o ? o[part].named : null; };
        return [x.code, x.idea, x.tool, x.model, x.webSearch, x.both, c.words, c.links, c.domains, c.figures, c.hedges, c.verdicts, c.sectionsCovered]
          .concat(sec.map(function (s2) { return x.chatbot ? c.sections[s2] : null; }))
          .concat([v.claims, v.confirmed, v.contradicted, v.disputed, v.unverified, v.sources, v.domains, v.competitors, v.graveyard, v.objections, v.bigTech, o ? o.bigTech.of : null, v.legal, v.score, v.sampleFields,
            k("claims"), k("competitors"), k("graveyard"), k("bigTech"),
            pf.overall, pf.accuracy, pf.evidence, pf.risks, pf.honesty, pf.decision, pf.options_order, pf.why,
            pr.market_familiarity, pr.ai_trust, pr.ai_use]);
      }));
    // For human coding: both answers in full, with empty columns per rater (codebook: docs/STUDY-PROTOCOL.md).
    var DIMS = ["claim_accuracy", "evidence", "risk_coverage", "calibration", "actionability"];
    var codingHead = ["code", "idea", "tool", "chatbot_answer", "vistadex_report"];
    ["chatbot", "vistadex"].forEach(function (side) { DIMS.forEach(function (d) { codingHead.push(side + "_" + d + "_1to5"); }); });
    t["chatbot-answers.csv"] = toCSV(codingHead.concat(["rater", "notes"]), cmp.rows.filter(function (x) { return x.chatbotText != null || x.reportText != null; }).map(function (x) {
      var row = [x.code, x.idea, x.tool, x.chatbotText, x.reportText];
      DIMS.forEach(function () { row.push(null, null); });
      return row.concat([null, null]);
    }));
    return t;
  }

  return { PER_RUN_TYPES: PER_RUN_TYPES, joinRuns: joinRuns, latestVotes: latestVotes, voteTotals: voteTotals, agreePct: agreePct,
    pairedParticipants: pairedParticipants, wilcoxon: wilcoxon, mannWhitney: mannWhitney, analyzeStudy: analyzeStudy,
    chatbotComparison: chatbotComparison, textFeatures: textFeatures, signTest: signTest, reportText: reportText,
    exportTables: exportTables, toCSV: toCSV, EVIDENCE_CONTROLS: EVIDENCE_CONTROLS, SECTIONS: SECTIONS,
    relianceMatrix: relianceMatrix, DEFAULT_ANSWER_KEY: DEFAULT_ANSWER_KEY, BASIS: BASIS };
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
export const chatbotComparison = join.chatbotComparison;
export const textFeatures = join.textFeatures;
export const signTest = join.signTest;
export const relianceMatrix = join.relianceMatrix;
export const DEFAULT_ANSWER_KEY = join.DEFAULT_ANSWER_KEY;
export const BASIS = join.BASIS;
