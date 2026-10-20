// research-page.js — the Research Console (token-gated).
// Design language: Linear/PostHog-style dark analytics — near-black neutral
// surfaces, one restrained accent, sidebar navigation, KPI cards, dense but
// legible tables, skeleton loading states. Data from /research/data?full=1.
export const RESEARCH_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>VistaDex · Research</title>
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0B0C0E;           /* app background — near-black, neutral */
    --panel: #131417;        /* raised panel */
    --panel-2: #17181C;      /* hover panel */
    --panel-3: #1D1E23;      /* table headers, chips */
    --border: #26272E;       /* hairline borders */
    --border-soft: #1E1F25;
    --ink: #EDEDEF;         /* primary text */
    --ink-2: #9E9FA8;        /* secondary text */
    --ink-3: #63656E;        /* tertiary/faint */
    --accent: #7C9CFF;       /* single accent — periwinkle blue */
    --accent-dim: rgba(124,156,255,.14);
    --good: #4ADE80;         /* positive delta */
    --bad: #F87171;          /* negative delta */
    --warn: #FBBF24;
    --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
    --sans: "Inter", system-ui, -apple-system, sans-serif;
    --radius: 10px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { color-scheme: dark; }
  body { font-family: var(--sans); background: var(--bg); color: var(--ink); font-size: 13.5px; line-height: 1.5; -webkit-font-smoothing: antialiased; }

  /* ── layout: sidebar + main ── */
  .app { display: grid; grid-template-columns: 228px 1fr; min-height: 100vh; }
  .side { border-right: 1px solid var(--border-soft); padding: 20px 12px; position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 2px; background: var(--bg); }
  .side .brand { display: flex; align-items: center; gap: 8px; padding: 4px 10px 18px; }
  .side .brand .mark { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg, var(--accent), #B4C7FF); display: grid; place-items: center; color: #0B0C0E; font-weight: 800; font-size: 11px; }
  .side .brand b { font-size: 14px; font-weight: 700; letter-spacing: -.01em; }
  .side .brand span { color: var(--ink-3); font-size: 11px; margin-left: auto; font-family: var(--mono); }
  .nav-l { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); padding: 14px 10px 6px; }
  .nav { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 7px; color: var(--ink-2); font-size: 13px; font-weight: 500; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: var(--sans); transition: all .12s; }
  .nav:hover { color: var(--ink); background: var(--panel); }
  .nav.on { color: var(--ink); background: var(--panel-3); }
  .nav .ico { width: 15px; height: 15px; opacity: .8; }
  .nav .cnt { margin-left: auto; font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); background: var(--panel-3); padding: 1px 7px; border-radius: 99px; }
  .nav.on .cnt { background: var(--accent-dim); color: var(--accent); }
  .side .foot { margin-top: auto; padding: 10px; color: var(--ink-3); font-size: 11px; line-height: 1.6; }
  .side .foot a { color: var(--ink-3); text-decoration: none; } .side .foot a:hover { color: var(--accent); }

  .main { padding: 28px 32px 60px; max-width: 1180px; }
  .view { display: none; } .view.on { display: block; animation: fade .18s ease; }
  @keyframes fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }

  /* ── page header ── */
  .phead { display: flex; align-items: baseline; gap: 12px; margin-bottom: 22px; flex-wrap: wrap; }
  .phead h1 { font-size: 19px; font-weight: 700; letter-spacing: -.015em; }
  .phead .sub { color: var(--ink-3); font-size: 12.5px; }
  .phead .right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .sync { font-family: var(--mono); font-size: 11px; color: var(--ink-3); display: inline-flex; align-items: center; gap: 6px; }
  .sync .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--good); }
  .sync.pulse .dot { animation: pulse 1.2s ease infinite; }
  @keyframes pulse { 50% { opacity: .3; } }

  /* ── KPI cards ── */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .kpi { background: var(--panel); border: 1px solid var(--border-soft); border-radius: var(--radius); padding: 16px 18px; position: relative; overflow: hidden; }
  .kpi:hover { border-color: var(--border); }
  .kpi .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-3); }
  .kpi .val { font-size: 26px; font-weight: 800; letter-spacing: -.03em; margin-top: 6px; font-variant-numeric: tabular-nums; }
  .kpi .note { font-size: 11px; color: var(--ink-3); margin-top: 4px; }
  .kpi.hl .val { color: var(--accent); }

  /* ── tables ── */
  .tbl-wrap { background: var(--panel); border: 1px solid var(--border-soft); border-radius: var(--radius); overflow-x: auto; }
  .tbl-wrap:hover { border-color: var(--border); }
  table { border-collapse: collapse; width: 100%; }
  th { text-align: left; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-3); padding: 10px 14px; border-bottom: 1px solid var(--border-soft); white-space: nowrap; }
  td { padding: 11px 14px; font-size: 12.5px; border-bottom: 1px solid var(--border-soft); vertical-align: middle; white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .1s; }
  tbody tr:hover { background: var(--panel-2); }
  .num { font-family: var(--mono); font-size: 11.5px; font-variant-numeric: tabular-nums; }
  .empty { padding: 28px !important; text-align: center; color: var(--ink-3); font-style: italic; }

  .pill { display: inline-flex; align-items: center; gap: 5px; border-radius: 99px; padding: 2px 9px; font-size: 10.5px; font-family: var(--mono); font-weight: 500; }
  .pill::before { content: ""; width: 5px; height: 5px; border-radius: 50%; }
  .pill.study { color: var(--accent); background: var(--accent-dim); } .pill.study::before { background: var(--accent); }
  .pill.field { color: var(--good); background: rgba(74,222,128,.1); } .pill.field::before { background: var(--good); }

  .delta { font-family: var(--mono); font-size: 10.5px; padding: 1px 6px; border-radius: 5px; margin-left: 6px; }
  .delta.up { color: var(--good); background: rgba(74,222,128,.1); }
  .delta.down { color: var(--bad); background: rgba(248,113,113,.1); }
  .delta.zero { color: var(--ink-3); background: var(--panel-3); }

  .bar { display: inline-block; height: 4px; border-radius: 2px; background: var(--accent); vertical-align: middle; margin-right: 6px; }
  .bar.g { background: var(--good); }

  /* funnel */
  .funnel { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
  .fstep { display: grid; grid-template-columns: 200px 1fr auto; gap: 14px; align-items: center; }
  .fstep .fl { font-size: 12.5px; color: var(--ink-2); }
  .fstep .fb { height: 22px; border-radius: 5px; background: linear-gradient(90deg, var(--accent), rgba(124,156,255,.4)); position: relative; min-width: 2px; transition: width .4s ease; }
  .fstep .fb span { position: absolute; left: 8px; top: 3px; font-size: 10.5px; font-weight: 600; color: #0B0C0E; }
  .fstep .fv { font-family: var(--mono); font-size: 11.5px; color: var(--ink-2); }

  /* feed */
  .feed { font-family: var(--mono); font-size: 11.5px; line-height: 2; max-height: 420px; overflow: auto; padding: 4px 0; }
  .feed .fr { display: flex; gap: 14px; padding: 2px 16px; }
  .feed .fr:hover { background: var(--panel-2); }
  .feed .t { color: var(--ink-3); }
  .feed .k { color: var(--accent); min-width: 150px; }
  .feed .p { color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }

  /* buttons */
  .btn { display: inline-flex; align-items: center; gap: 7px; font-family: var(--sans); font-size: 12.5px; font-weight: 600; padding: 7px 14px; border-radius: 7px; border: 1px solid var(--border); background: var(--panel); color: var(--ink); cursor: pointer; transition: all .12s; }
  .btn:hover { background: var(--panel-3); border-color: var(--ink-3); }
  .btn.acc { background: var(--accent); border-color: var(--accent); color: #0B0C0E; }
  .btn.acc:hover { filter: brightness(1.1); }
  .btn.danger { color: var(--bad); border-color: rgba(248,113,113,.3); }
  .btn.danger:hover { background: rgba(248,113,113,.08); }
  .msg { font-family: var(--mono); font-size: 11px; }
  .msg.ok { color: var(--good); } .msg.err { color: var(--bad); }

  /* export cards */
  .exports { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .exp { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--panel); border: 1px solid var(--border-soft); border-radius: var(--radius); text-decoration: none; color: var(--ink); transition: all .12s; }
  .exp:hover { border-color: var(--accent); background: var(--panel-2); }
  .exp .ic { width: 34px; height: 34px; border-radius: 8px; background: var(--accent-dim); display: grid; place-items: center; color: var(--accent); font-size: 15px; flex-shrink: 0; }
  .exp b { font-size: 12.5px; display: block; }
  .exp span { font-size: 11px; color: var(--ink-3); }

  /* skeleton loading */
  .skel { position: relative; overflow: hidden; background: var(--panel); border-radius: var(--radius); }
  .skel::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.04), transparent); animation: shimmer 1.4s infinite; }
  @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }

  .err-box { background: rgba(248,113,113,.06); border: 1px solid rgba(248,113,113,.25); border-radius: var(--radius); padding: 16px; color: var(--bad); font-family: var(--mono); font-size: 11.5px; white-space: pre-wrap; }

  /* feedback analytics */
  .fb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; margin: 16px 0; }
  .fb-card { background: var(--panel); border: 1px solid var(--border-soft); border-radius: var(--radius); padding: 18px; }
  .fb-card h3 { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 12px; }
  .fb-card h3 .n { font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); margin-left: 8px; font-weight: 400; }
  .fb-opt { display: grid; grid-template-columns: 130px 1fr 40px; gap: 10px; align-items: center; margin: 7px 0; font-size: 12.5px; }
  .fb-opt .lbl { color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fb-bar { height: 18px; border-radius: 4px; background: linear-gradient(90deg, var(--accent), rgba(124,156,255,.5)); min-width: 2px; position: relative; }
  .fb-bar span { position: absolute; left: 6px; top: 2px; font-size: 10px; font-weight: 600; color: #0B0C0E; }
  .fb-likert { display: flex; gap: 4px; align-items: flex-end; height: 90px; margin-top: 6px; }
  .fb-likert .col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .fb-likert .col .v { font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); }
  .fb-likert .col .b { width: 100%; border-radius: 4px 4px 0 0; background: var(--accent-dim); border-top: 2px solid var(--accent); min-height: 2px; }
  .fb-likert .col .c { font-family: var(--mono); font-size: 10.5px; color: var(--ink-2); }
  .fb-avg { font-family: var(--mono); font-size: 11px; color: var(--accent); margin-top: 8px; }
  .fb-quote { background: var(--panel); border: 1px solid var(--border-soft); border-left: 3px solid var(--accent); border-radius: 8px; padding: 12px 14px; margin: 8px 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.6; }
  .fb-quote .who { font-family: var(--mono); font-size: 10px; color: var(--ink-3); margin-top: 6px; }
  details.raw { margin-top: 14px; }
  details.raw summary { cursor: pointer; color: var(--ink-3); font-size: 12px; padding: 4px 0; }
  details.raw summary:hover { color: var(--ink-2); }

  input[type="checkbox"] { accent-color: var(--accent); width: 14px; height: 14px; cursor: pointer; }

  @media (max-width: 800px) { .app { grid-template-columns: 1fr; } .side { display: none; } }
</style>
</head>
<body>
<div class="app">
  <aside class="side">
    <div class="brand"><span class="mark">V</span><b>Research</b><span>console</span></div>
    <div class="nav-l">Study</div>
    <button class="nav on" data-view="overview"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>Overview</button>
    <button class="nav" data-view="participants"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a7 7 0 0 1 14 0v1"/><circle cx="17" cy="9" r="3"/><path d="M22 21v-1a6 6 0 0 0-6-6"/></svg>Participants <span class="cnt" id="cnt-p">–</span></button>
    <button class="nav" data-view="funnel"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h18l-6 9v7l-6-2v-5z"/></svg>Funnel</button>
    <div class="nav-l">Data</div>
    <button class="nav" data-view="events"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>Events <span class="cnt" id="cnt-e">–</span></button>
    <button class="nav" data-view="feedback"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Feedback <span class="cnt" id="cnt-f">–</span></button>
    <button class="nav" data-view="sessions"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>Sessions <span class="cnt" id="cnt-s">–</span></button>
    <button class="nav" data-view="export"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>Export</button>
    <div class="foot">
      <div id="last-sync">—</div>
      <div style="margin-top:6px">Auto-refresh 30s · <a href="/research" onclick="location.reload()">re-login</a></div>
    </div>
  </aside>

  <main class="main">

    <section class="view on" id="v-overview">
      <div class="phead"><h1>Overview</h1><span class="sub">the study at a glance</span>
        <div class="right"><span class="sync pulse" id="sync-1"><span class="dot"></span>live</span><button class="btn" id="refreshBtn">↻ Refresh</button></div>
      </div>
      <div class="kpis" id="kpis"></div>
      <div class="tbl-wrap"><table id="recent-participants"></table></div>
    </section>

    <section class="view" id="v-participants">
      <div class="phead"><h1>Participants</h1><span class="sub">one row per visitor (browser session); multiple runs land in the same row — see Runs</span>
        <div class="right">
          <select id="roleFilter" class="btn" style="padding:6px 10px"><option value="">all roles</option></select>
          <select id="trackFilter" class="btn" style="padding:6px 10px"><option value="">all tracks</option><option value="study">study</option><option value="field">field</option></select>
          <button class="btn acc" id="csvBtn">↓ metrics.csv</button>
        </div></div>
      <div class="tbl-wrap"><table id="participants"></table></div>
      <div style="margin-top:14px; display:flex; gap:10px; align-items:center;">
        <button class="btn danger" id="purgeBtn">Delete ticked sessions</button>
        <span class="msg" id="purgeMsg"></span>
      </div>
    </section>

    <section class="view" id="v-funnel">
      <div class="phead"><h1>Study funnel</h1><span class="sub">recruited-track progress toward a complete paired dataset</span></div>
      <div class="panel" style="background:var(--panel); border:1px solid var(--border-soft); border-radius:var(--radius); padding:20px;"><div class="funnel" id="funnel"></div></div>
    </section>

    <section class="view" id="v-events">
      <div class="phead"><h1>Events</h1><span class="sub">every metric collected, and what it measures for the paper</span></div>
      <div class="tbl-wrap"><table id="types"></table></div>
      <h1 style="font-size:14px; margin:26px 0 10px;">Live feed <span class="sub" style="font-size:12px;color:var(--ink-3)">latest 50</span></h1>
      <div class="tbl-wrap"><div class="feed" id="feed">loading…</div></div>
    </section>

    <section class="view" id="v-feedback">
      <div class="phead"><h1>Feedback</h1><span class="sub">what visitors told you — form answers, ratings and confidence, summarised</span></div>
      <div id="feedback-content"><div class="tbl-wrap" style="padding:28px;text-align:center;color:var(--ink-3);font-style:italic">No feedback yet.</div></div>
    </section>

    <section class="view" id="v-sessions">
      <div class="phead"><h1>Sessions</h1><span class="sub">all recorded sessions, including pre-study test data</span></div>
      <div class="tbl-wrap"><table id="sessions"></table></div>
      <details class="raw"><summary>Debug: raw JSON of the latest 50 events</summary><pre class="feed" id="raw" style="max-height:260px"></pre></details>
    </section>

    <section class="view" id="v-export">
      <div class="phead"><h1>Export</h1><span class="sub">for Excel / R / Python — CSV; JSON for scripts</span></div>
      <div class="exports">
        <a class="exp" href="/export?table=events&format=csv"><span class="ic">↓</span><div><b>events.csv</b><span>one row per telemetry event</span></div></a>
        <a class="exp" href="/export?table=traces&format=csv"><span class="ic">↓</span><div><b>traces.csv</b><span>one row per pipeline run (full trace)</span></div></a>
        <a class="exp" href="/export?table=events"><span class="ic">{ }</span><div><b>events.json</b><span>parsed payloads, for scripts</span></div></a>
        <a class="exp" href="/export?table=traces"><span class="ic">{ }</span><div><b>traces.json</b><span>full pipeline detail per run</span></div></a>
      </div>
      <p style="margin-top:18px; color:var(--ink-3); font-size:12px;">curl users: add <span class="num" style="color:var(--accent)">Authorization: Bearer &lt;EXPORT_TOKEN&gt;</span>.</p>
    </section>

  </main>
</div>
<script>
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var MEANINGS = {
    participant_registered: "identity — code, role, track",
    welcome_choice: "walkthrough vs skip",
    view_changed: "navigation",
    screen_time: "engagement per screen",
    control_pressed: "every button press",
    field_edited: "input activity (lengths only)",
    run_started: "screening begins (idea length, role)",
    run_completed: "screening done (counts, duration, trace id)",
    run_failed: "errors",
    run_cancelled: "abandonment",
    claim_expanded: "claim inspection",
    source_clicked: "verification behaviour (H2)",
    claim_vote: "agreeableness (H3)",
    objection_vote: "agreeableness (H3)",
    confidence_pre: "prior confidence (H1)",
    confidence_post: "post confidence (H1 calibration)",
    condition_survey: "trust / usefulness / effort likerts",
    condition_started: "condition order (A/B)",
    condition_ended: "condition completion",
    graveyard_viewed: "graveyard interest",
    objections_viewed: "objection reading",
    section_time: "per-section attention",
    report_time: "report attention",
    feedback_submitted: "open feedback (unlinked id)",
    walkthrough_started: "onboarding",
    walkthrough_step_time: "step attention",
    walkthrough_ended: "onboarding completion",
    consent_given: "consent"
  };

  // nav switching
  document.querySelectorAll(".nav[data-view]").forEach(function (n) {
    n.onclick = function () {
      document.querySelectorAll(".nav").forEach(function (m) { m.classList.remove("on"); });
      document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("on"); });
      n.classList.add("on");
      $("v-" + n.dataset.view).classList.add("on");
    };
  });

  function computePeople(events) {
    var by = {};
    events.forEach(function (e) {
      (by[e.session_id] = by[e.session_id] || []).push(e);
    });
    var people = [];
    Object.keys(by).forEach(function (sid) {
      var evs = by[sid];
      var reg = evs.find(function (e) { return e.type === "participant_registered"; });
      // Sessions without an explicit registration still count if they ran a
      // screening (pre-fix field visits): derive identity from run_started.
      var ran = evs.some(function (e) { return e.type === "run_started"; });
      if (!reg && !ran) return;
      var pl = (reg && reg.payload) || {};
      var p = { sid: sid, code: pl.code || "", role: pl.role || null, roleFrom: reg ? "registered" : null, track: pl.track || (reg ? "field" : "field"), source: pl.source || null,
        confPre: null, confPost: null, survey: null, votes: 0, agrees: 0, clicks: 0,
        runs: 0, n: evs.length, last: evs[evs.length - 1].ts, industries: null, markets: null };
      evs.forEach(function (e) {
        var q = e.payload || {};
        if (e.type === "confidence_pre") p.confPre = q.value;
        else if (e.type === "confidence_post") p.confPost = q.value;
        else if (e.type === "condition_survey") p.survey = q;
        else if (e.type === "claim_vote" || e.type === "objection_vote") { p.votes++; if (q.vote === "agree") p.agrees++; }
        else if (e.type === "source_clicked") p.clicks++;
        else if (e.type === "run_started") {
          p.runs++;
          // role from the screening form ("I am a…" chip) — a field visitor's
          // founder/investor/accelerator identity
          if (q.role && !p.role) { p.role = q.role; p.roleFrom = "screening form"; }
          if (q.industries && q.industries.length) p.industries = q.industries.join(", ");
          if (q.markets && q.markets.length) p.markets = q.markets.join(", ");
        }
      });
      if (!p.role) p.role = "—";
      people.push(p);
    });
    people.sort(function (a, b) { return b.last.localeCompare(a.last); });
    return people;
  }

  function personRow(p) {
    var track = '<span class="pill ' + esc(p.track) + '">' + esc(p.track) + "</span>";
    var conf = p.confPre == null ? '<span style="color:var(--ink-3)">—</span>'
      : p.confPre + " → " + (p.confPost == null ? "?" : p.confPost);
    var cal = null;
    if (p.confPre != null && p.confPost != null) {
      cal = p.confPost - p.confPre;
      conf += ' <span class="delta ' + (cal > 0 ? "up" : cal < 0 ? "down" : "zero") + '">' + (cal > 0 ? "+" : "") + cal + "</span>";
    }
    var ag = p.votes ? '<span class="bar" style="width:' + Math.max(2, 30 * p.agrees / p.votes) + 'px"></span>' + Math.round(100 * p.agrees / p.votes) + "% <span style='color:var(--ink-3)'>of " + p.votes + "</span>" : '<span style="color:var(--ink-3)">—</span>';
    var sv = p.survey ? '<span class="num">T' + p.survey.trust + " · U" + p.survey.usefulness + " · E" + p.survey.effort + "</span>" : '<span style="color:var(--ink-3)">—</span>';
    var from = p.roleFrom ? '<span style="color:var(--ink-3);font-size:11px">' + esc(p.roleFrom) + "</span>" : '<span style="color:var(--ink-3)">—</span>';
    var src = p.source ? '<span class="num" style="color:var(--accent)">' + esc(p.source) + "</span>" : '<span style="color:var(--ink-3)">—</span>';
    return "<tr><td>" + track + "</td><td class='num'>" + esc(p.code || "·") + "</td><td>" + esc(p.role) + "</td><td>" + from + "</td><td>" + src + "</td>" +
      "<td>" + conf + "</td><td>" + ag + "</td><td>" + (p.clicks || '<span style="color:var(--ink-3)">—</span>') + "</td>" +
      "<td>" + sv + "</td><td class='num' style='color:var(--ink-3)'>" + esc(p.industries || "—") + "</td>" +
      "<td class='num'>" + p.runs + "</td><td class='num'>" + p.n + "</td>" +
      "<td><input type='checkbox' class='sel' value='" + esc(p.sid) + "'></td></tr>";
  }
  var HEAD = "<tr><th>Track</th><th>Code</th><th>Role</th><th>Where from</th><th>Channel</th><th>Confidence pre→post</th><th>Agreeableness</th><th>Sources</th><th>Survey</th><th>Industries</th><th>Runs</th><th>Events</th><th>Del</th></tr>";
  function metricsCSV(people) {
    var cols = ["session_id","track","code","role","role_source","channel","industries","markets","conf_pre","conf_post","conf_delta","votes","agree_rate_pct","source_clicks","trust","usefulness","effort","runs","events"];
    var rows = [cols.join(",")];
    people.forEach(function (p) {
      var delta = p.confPre != null && p.confPost != null ? p.confPost - p.confPre : "";
      rows.push([
        p.sid, p.track, p.code || "", p.role === "—" ? "" : p.role, p.roleFrom || "",
        p.source || "", p.industries || "", p.markets || "",
        p.confPre == null ? "" : p.confPre, p.confPost == null ? "" : p.confPost, delta,
        p.votes, p.votes ? Math.round(100 * p.agrees / p.votes) : "",
        p.clicks,
        p.survey ? p.survey.trust : "", p.survey ? p.survey.usefulness : "", p.survey ? p.survey.effort : "",
        p.runs, p.n
      ].map(function (v) {
        v = String(v);
        var needsQuote = v.indexOf(',') >= 0 || v.indexOf('"') >= 0 || v.indexOf(String.fromCharCode(10)) >= 0;
        return needsQuote ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(","));
    });
    return rows.join(String.fromCharCode(10));
  }

  function optCard(title, counts) {
    var entries = Object.keys(counts).map(function (k) { return [k, counts[k]]; })
      .filter(function (x) { return x[1] > 0; })
      .sort(function (a, b) { return b[1] - a[1]; });
    var total = entries.reduce(function (a, x) { return a + x[1]; }, 0);
    if (!total) return "";
    var max = entries[0][1];
    return '<div class="fb-card"><h3>' + esc(title) + '<span class="n">' + total + ' answers</span></h3>' +
      entries.map(function (x) {
        return '<div class="fb-opt"><span class="lbl">' + esc(x[0]) + '</span>' +
          '<div class="fb-bar" style="width:' + Math.max(3, 100 * x[1] / max) + '%"><span>' + x[1] + '</span></div>' +
          '<span class="num" style="color:var(--ink-3)">' + Math.round(100 * x[1] / total) + '%</span></div>';
      }).join("") + "</div>";
  }
  function likertCard(title, values, min, max, unit) {
    var vals = values.filter(function (v) { return typeof v === "number" && !isNaN(v); });
    if (!vals.length) return "";
    var avg = vals.reduce(function (a, v) { return a + v; }, 0) / vals.length;
    var hist = {};
    vals.forEach(function (v) { hist[v] = (hist[v] || 0) + 1; });
    var maxCount = Math.max.apply(null, Object.keys(hist).map(function (k) { return hist[k]; }));
    var cols = "";
    for (var i = min; i <= max; i++) {
      var c = hist[i] || 0;
      cols += '<div class="col"><span class="v">' + (c || "") + '</span>' +
        '<div class="b" style="height:' + Math.max(2, 70 * c / maxCount) + 'px"></div>' +
        '<span class="c">' + i + (unit || "") + "</span></div>";
    }
    return '<div class="fb-card"><h3>' + esc(title) + '<span class="n">' + vals.length + ' ratings</span></h3>' +
      '<div class="fb-likert">' + cols + "</div>" +
      '<div class="fb-avg">mean ' + (Math.round(avg * 10) / 10) + (unit || "") + "</div></div>";
  }

  function renderFeedback(ev) {
    var box = $("feedback-content");
    var fbForms = ev.filter(function (e) { return e.type === "feedback_submitted"; });
    var surveys = ev.filter(function (e) { return e.type === "condition_survey"; });
    var confPre = ev.filter(function (e) { return e.type === "confidence_pre"; });
    var confPost = ev.filter(function (e) { return e.type === "confidence_post"; });
    $("cnt-f").textContent = fbForms.length + surveys.length;
    if (!fbForms.length && !surveys.length) {
      box.innerHTML = '<div class="tbl-wrap" style="padding:28px;text-align:center;color:var(--ink-3);font-style:italic">No feedback yet — the feedback form (Feedback in the site header) and the per-report study panel (confidence, ratings) show up here.</div>';
      return;
    }

    var html = "";

    // Confidence sliders (H1) — pre vs post side by side
    if (confPre.length || confPost.length) {
      html += '<h2 style="font-size:15px;margin:20px 0 4px">Confidence in the idea <span class="sub" style="font-size:12px;color:var(--ink-3)">(sliders, 0-100% — the calibration measure)</span></h2>';
      html += '<div class="fb-grid">';
      html += likertCard("Before the report (confidence_pre)", confPre.map(function (e) { return e.payload && e.payload.value; }), 0, 100);
      html += likertCard("After the report (confidence_post)", confPost.map(function (e) { return e.payload && e.payload.value; }), 0, 100);
      html += "</div>";
    }

    // Study-panel likerts
    if (surveys.length) {
      html += '<h2 style="font-size:15px;margin:20px 0 4px">Report ratings <span class="sub" style="font-size:12px;color:var(--ink-3)">(1-7 likerts from the study panel under each report)</span></h2>';
      html += '<div class="fb-grid">';
      html += likertCard("I trust this report\u2019s assessment", surveys.map(function (e) { return e.payload && e.payload.trust; }), 1, 7);
      html += likertCard("The report was useful for judging the idea", surveys.map(function (e) { return e.payload && e.payload.usefulness; }), 1, 7);
      html += likertCard("Helped me see what to verify next", surveys.map(function (e) { return e.payload && e.payload.helpfulness; }), 1, 7);
      html += likertCard("Getting a good read took effort", surveys.map(function (e) { return e.payload && e.payload.effort; }), 1, 7);
      html += "</div>";
    }

    // Feedback form answers
    if (fbForms.length) {
      html += '<h2 style="font-size:15px;margin:20px 0 4px">Feedback form <span class="sub" style="font-size:12px;color:var(--ink-3)">(sent unlinked — not tied to a usage session)</span></h2>';
      var defs = [["role", "What best describes you?"], ["useful", "Was the report useful?"], ["section", "Which section mattered most?"], ["would_use", "Would you use this?"]];
      html += '<div class="fb-grid">';
      for (var i = 0; i < defs.length; i++) {
        var counts = {};
        fbForms.forEach(function (e) {
          var v = e.payload && e.payload[defs[i][0]];
          if (v) counts[v] = (counts[v] || 0) + 1;
        });
        html += optCard(defs[i][1], counts);
      }
      html += "</div>";
      // open text
      var quotes = fbForms.filter(function (e) { return e.payload && e.payload.wrong && String(e.payload.wrong).trim().length > 0; });
      if (quotes.length) {
        html += '<h2 style="font-size:15px;margin:20px 0 4px">What was wrong or missing? <span class="sub" style="font-size:12px;color:var(--ink-3)">(open answers)</span></h2>';
        html += quotes.map(function (e) {
          return '<div class="fb-quote">\u201c' + esc(String(e.payload.wrong).slice(0, 600)) + '\u201d<div class="who">feedback form · ' + esc(String(e.ts).slice(0, 10)) + "</div></div>";
        }).join("");
      }
    }

    box.innerHTML = html;
  }

  function render(d) {
    var ev = d.all_events || [];
    var people = computePeople(ev);
    $("cnt-p").textContent = people.length;
    $("cnt-e").textContent = d.totals.events;
    $("cnt-s").textContent = d.totals.sessions;
    $("last-sync").textContent = "updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    var study = people.filter(function (p) { return p.track === "study"; });
    var complete = study.filter(function (p) { return p.survey && p.confPost != null && p.confPre != null; });
    var voted = people.filter(function (p) { return p.votes > 0; });
    var avgTrust = people.filter(function (p) { return p.survey }).reduce(function (a, p, i, arr) { return a + p.survey.trust / arr.length; }, 0);

    $("kpis").innerHTML =
      '<div class="kpi"><div class="label">Sessions</div><div class="val">' + d.totals.sessions + '</div><div class="note">consented visitors</div></div>' +
      '<div class="kpi"><div class="label">Events</div><div class="val">' + d.totals.events + '</div><div class="note">telemetry records</div></div>' +
      '<div class="kpi"><div class="label">Pipeline traces</div><div class="val">' + d.totals.traces + '</div><div class="note">screens run (any mode)</div></div>' +
      '<div class="kpi hl"><div class="label">Participants</div><div class="val">' + people.length + '</div><div class="note">' + study.length + " study · " + (people.length - study.length) + " field</div></div>" +
      '<div class="kpi"><div class="label">Paired-complete</div><div class="val">' + complete.length + "</div><div class='note'>study track, both surveys in</div></div>" +
      '<div class="kpi"><div class="label">Votes cast</div><div class="val">' + people.reduce(function (a, p) { return a + p.votes; }, 0) + '</div><div class="note">' + voted.length + " participants voted</div></div>";

    $("recent-participants").innerHTML = HEAD + (people.length
      ? people.slice(0, 6).map(personRow).join("")
      : '<tr><td colspan="12" class="empty">No participants yet — they appear when someone accepts the Welcome notice.</td></tr>');

    var roles = []; people.forEach(function (p) { if (p.role && p.role !== "—" && roles.indexOf(p.role) < 0) roles.push(p.role); });
    var curRole = $("roleFilter").value;
    $("roleFilter").innerHTML = '<option value="">all roles</option>' + roles.map(function (r) { return "<option" + (r === curRole ? " selected" : "") + ">" + esc(r) + "</option>"; }).join("");
    var curTrack = $("trackFilter").value;
    var shown = people.filter(function (p) {
      return (!curRole || p.role === curRole) && (!curTrack || p.track === curTrack);
    });
    $("participants").innerHTML = HEAD + (shown.length
      ? shown.map(personRow).join("")
      : '<tr><td colspan="12" class="empty">No participants match the filters.</td></tr>');
    window.__people = people; // for CSV export

    // funnel
    var f = [
      ["Registered (study track)", study.length],
      ["Baseline condition surveyed", study.filter(function (p) { return p.survey || p.confPost != null; }).length],
      ["Both conditions complete (paired)", complete.length],
      ["Field-track participants", people.length - study.length],
    ];
    var max = Math.max(1, f[0][1]);
    $("funnel").innerHTML = f.map(function (s) {
      return '<div class="fstep"><span class="fl">' + esc(s[0]) + '</span>' +
        '<div class="fb" style="width:' + Math.max(2, 100 * s[1] / max) + '%"><span>' + s[1] + "</span></div>" +
        '<span class="fv">' + s[1] + "</span></div>";
    }).join("");

    // event types
    var types = Object.keys(d.events_by_type).sort(function (a, b) { return d.events_by_type[b] - d.events_by_type[a]; });
    var maxT = Math.max(1, d.events_by_type[types[0]] || 1);
    $("types").innerHTML = "<tr><th>Event type</th><th>Count</th><th></th><th>What it measures</th></tr>" + types.map(function (t) {
      var n = d.events_by_type[t];
      return "<tr><td class='num' style='color:var(--ink)'>" + esc(t) + "</td><td class='num'>" + n + "</td>" +
        "<td style='min-width:120px'><span class='bar' style='width:" + Math.max(2, 110 * n / maxT) + "px'></span></td>" +
        "<td style='color:var(--ink-2)'>" + esc(MEANINGS[t] || "auto-collected") + "</td></tr>";
    }).join("");

    // feedback view
    renderFeedback(ev);

    // feed
    $("feed").innerHTML = d.latest_events.map(function (e) {
      return '<div class="fr"><span class="t">' + esc(String(e.ts).slice(11, 19)) + '</span><span class="k">' + esc(e.type) + "</span><span class='p'>" + esc(JSON.stringify(e.payload || {}).slice(0, 100)) + "</span></div>";
    }).join("") || '<div class="fr"><span class="p">no events yet</span></div>';
    $("raw").textContent = JSON.stringify(d.latest_events, null, 1);

    // sessions
    $("sessions").innerHTML = "<tr><th></th><th>Session</th><th>Events</th><th>First seen</th><th>Last seen</th><th>Top types</th></tr>" +
      d.sessions.map(function (s) {
        var top = Object.keys(s.types).sort(function (a, b) { return s.types[b] - s.types[a]; }).slice(0, 3)
          .map(function (t) { return t + "·" + s.types[t]; }).join("  ");
        return "<tr><td><input type='checkbox' class='sel' value='" + esc(s.session_id) + "'></td>" +
          "<td class='num'>" + esc(s.session_id.slice(0, 8)) + "…</td><td class='num'>" + s.events + "</td>" +
          "<td class='num' style='color:var(--ink-2)'>" + esc(String(s.first).slice(0, 16).replace("T", " ")) + "</td>" +
          "<td class='num' style='color:var(--ink-2)'>" + esc(String(s.last).slice(0, 16).replace("T", " ")) + "</td>" +
          "<td class='num' style='color:var(--ink-3)'>" + esc(top) + "</td></tr>";
      }).join("");
  }

  function load() {
    fetch("/research/data?full=1", { cache: "no-store" }).then(function (r) {
      if (r.status === 401) { $("kpis").innerHTML = '<div class="err-box" style="grid-column:1/-1">Session expired — <a href="/research?t=YOUR_TOKEN" style="color:var(--accent)">log in again</a>.</div>'; return null; }
      if (r.status !== 200) {
        return r.text().then(function (b) {
          $("kpis").innerHTML = '<div class="err-box" style="grid-column:1/-1">Data fetch failed: HTTP ' + r.status + " — " + esc(b.slice(0, 250)) + "</div>";
          return null;
        });
      }
      return r.json();
    }).then(function (d) { if (d) render(d); })
      .catch(function (e) { $("kpis").innerHTML = '<div class="err-box" style="grid-column:1/-1">Network error: ' + esc(e.message) + "</div>"; });
  }

  $("refreshBtn").onclick = load;
  $("roleFilter").onchange = $("trackFilter").onchange = function () { load(); };
  $("csvBtn").onclick = function () {
    var people = window.__people || [];
    var curRole = $("roleFilter").value, curTrack = $("trackFilter").value;
    var filtered = people.filter(function (p) { return (!curRole || p.role === curRole) && (!curTrack || p.track === curTrack); });
    var blob = new Blob([metricsCSV(filtered)], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vistadex-participant-metrics.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $("purgeBtn").onclick = function () {
    var ids = Array.prototype.slice.call(document.querySelectorAll(".sel:checked")).map(function (c) { return c.value; });
    if (!ids.length) { $("purgeMsg").textContent = "tick sessions first"; $("purgeMsg").className = "msg"; return; }
    if (!window.confirm("Permanently delete " + ids.length + " session(s) and their linked traces?")) return;
    $("purgeMsg").textContent = "deleting…"; $("purgeMsg").className = "msg";
    fetch("/research/purge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_ids: ids }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) { $("purgeMsg").textContent = "✓ deleted " + d.purged + " session(s)"; $("purgeMsg").className = "msg ok"; }
        else { $("purgeMsg").textContent = "failed: " + JSON.stringify(d); $("purgeMsg").className = "msg err"; }
        load();
      });
  };
  load();
  window.setInterval(load, 30000);
})();
</script>
</body>
</html>`;
