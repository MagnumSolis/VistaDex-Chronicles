// research-page.js — the Research Console (token-gated).
// Design language: the VistaDex tokens (web/src/index.css): a deep-green sidebar frame, cream reading
// panel, paper cards and tables, lime for the current view, ink numbers (deltas are never coloured
// good/bad). System fonts only: no font CDN (CLAUDE.md). Data from /research/data?full=1.
// The run join is embedded from research-join.js (one source for the page and the node tests).
import { researchJoin } from "./research-join.js";

export const RESEARCH_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>VistaDex · Research</title>
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --page: #0B3B2C;         /* sidebar frame (brand page colour) */
    --page-raised: #144A38;
    --on-page: #EEF2E2; --on-page-muted: #B5CCBC;
    --lime: #CBEF6A; --on-lime: #0B2E22;
    --bg: #EEF2E2;           /* reading panel (cream) */
    --panel: #F9FBF4;        /* paper cards and tables */
    --panel-2: #F1F5E8;      /* row hover */
    --panel-3: #E3EAD3;      /* table headers, chips (muted) */
    --border: #C9D3BB;       /* hairlines between rows */
    --border-soft: #DCE3D0;
    --ink: #0B2E22;          /* all text and numbers */
    --ink-2: #45584C;        /* helper text */
    --ink-3: #4F6255;        /* faint labels (AA on paper and cream) */
    --accent: #0B3B2C;       /* emphasis: deep green ink */
    --accent-dim: #E3EAD3;
    --link: #1F5A36;
    --mono: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
    --sans: "Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --serif: "Fraunces", Georgia, "Times New Roman", serif;
    --radius: 14px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { color-scheme: light; }
  body { font-family: var(--sans); background: var(--bg); color: var(--ink); font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  :focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  .side :focus-visible { outline-color: var(--lime); }
  a { color: var(--link); }

  /* ── layout: sidebar + main ── */
  .app { display: grid; grid-template-columns: 228px 1fr; min-height: 100vh; }
  .side { padding: 20px 12px; position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 2px; background: var(--page); color: var(--on-page); }
  .side .brand { display: flex; align-items: center; gap: 8px; padding: 4px 10px 18px; }
  .side .brand .mark { width: 26px; height: 26px; border-radius: 7px; background: var(--lime); display: grid; place-items: center; color: var(--on-lime); font-family: var(--serif); font-size: 16px; }
  .side .brand b { font-family: var(--serif); font-size: 18px; font-weight: 400; }
  .side .brand span { color: var(--on-page-muted); font-size: 11px; margin-left: auto; font-family: var(--mono); }
  .nav-l { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .1em; color: var(--on-page-muted); padding: 14px 10px 6px; }
  .nav { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 6px; color: var(--on-page); font-size: 13.5px; font-weight: 500; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: var(--sans); transition: background-color .12s, color .12s; }
  .nav:hover { background: var(--page-raised); }
  .nav.on { color: var(--on-lime); background: var(--lime); }
  .nav .ico { width: 15px; height: 15px; }
  .nav .cnt { margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--on-page); background: var(--page-raised); padding: 1px 7px; border-radius: 6px; }
  .nav.on .cnt { background: var(--on-lime); color: var(--lime); }
  .side .foot { margin-top: auto; padding: 10px; color: var(--on-page-muted); font-size: 11.5px; line-height: 1.6; }
  .side .foot a { color: var(--on-page); } .side .foot a:hover { color: var(--lime); }

  .main { padding: 28px 32px 60px; max-width: 1180px; }
  .view { display: none; } .view.on { display: block; }


  /* ── page header ── */
  .phead { display: flex; align-items: baseline; gap: 12px; margin-bottom: 22px; flex-wrap: wrap; }
  .phead h1 { font-family: var(--serif); font-size: 28px; font-weight: 400; line-height: 1.1; }
  .phead .sub { color: var(--ink-3); font-size: 12.5px; }
  .phead .right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .sync { font-family: var(--mono); font-size: 11px; color: var(--ink-3); display: inline-flex; align-items: center; gap: 6px; }
  .sync .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
  .sync.pulse .dot { animation: pulse 1.2s ease infinite; }
  @keyframes pulse { 50% { opacity: .3; } }

  /* ── KPI cards ── */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .kpi { background: var(--panel); border-radius: var(--radius); padding: 16px 18px; position: relative; overflow: hidden; }
  .kpi .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-3); }
  .kpi .val { font-family: var(--serif); font-size: 32px; font-weight: 400; line-height: 1.1; margin-top: 6px; font-variant-numeric: tabular-nums; }
  .kpi .note { font-size: 11px; color: var(--ink-3); margin-top: 4px; }
  .kpi.hl { background: var(--lime); } .kpi.hl .label, .kpi.hl .note { color: var(--on-lime); }

  /* ── tables ── */
  .tbl-wrap { background: var(--panel); border-radius: var(--radius); overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; }
  th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-2); background: var(--panel-3); padding: 10px 14px; white-space: nowrap; }
  td { padding: 11px 14px; font-size: 12.5px; border-bottom: 1px solid var(--border-soft); vertical-align: middle; white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .1s; }
  tbody tr:hover { background: var(--panel-2); }
  .num { font-family: var(--mono); font-size: 11.5px; font-variant-numeric: tabular-nums; }
  .empty { padding: 28px !important; text-align: center; color: var(--ink-3); font-style: italic; }

  .pill { display: inline-flex; align-items: center; gap: 5px; border-radius: 99px; padding: 2px 9px; font-size: 10.5px; font-family: var(--mono); font-weight: 500; }
  .pill::before { content: ""; width: 5px; height: 5px; border-radius: 50%; }
  .pill.study { color: var(--on-lime); background: var(--lime); } .pill.study::before { background: var(--on-lime); }
  .pill.field { color: var(--ink); background: var(--panel-3); } .pill.field::before { background: var(--ink-2); }

  .delta { font-family: var(--mono); font-size: 10.5px; padding: 1px 6px; border-radius: 5px; margin-left: 6px; }
  /* deltas are ink on muted with an arrow: a change, never a good or bad colour */
  .delta { color: var(--ink); background: var(--panel-3); }
  .delta.up::before { content: "\u25B2 "; font-size: 8px; } .delta.down::before { content: "\u25BC "; font-size: 8px; }

  .bar { display: inline-block; height: 4px; border-radius: 2px; background: var(--accent); vertical-align: middle; margin-right: 6px; }


  /* funnel */
  .funnel { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
  .fstep { display: grid; grid-template-columns: 200px 1fr auto; gap: 14px; align-items: center; }
  .fstep .fl { font-size: 12.5px; color: var(--ink-2); }
  .fstep .fb { height: 22px; border-radius: 5px; background: var(--accent); position: relative; min-width: 2px; }
  .fstep .fb span { position: absolute; left: 8px; top: 3px; font-size: 11px; font-weight: 600; color: var(--lime); }
  .fstep .fv { font-family: var(--mono); font-size: 11.5px; color: var(--ink-2); }

  /* feed */
  .feed { font-family: var(--mono); font-size: 11.5px; line-height: 2; max-height: 420px; overflow: auto; padding: 4px 0; }
  .feed .fr { display: flex; gap: 14px; padding: 2px 16px; }
  .feed .fr:hover { background: var(--panel-2); }
  .feed .t { color: var(--ink-3); }
  .feed .k { color: var(--ink); font-weight: 600; min-width: 150px; }
  .feed .p { color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }

  /* buttons */
  .btn { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; font-family: var(--sans); font-size: 13px; font-weight: 600; padding: 7px 14px; border-radius: 6px; border: 1.5px solid #6E7F6F; background: var(--panel); color: var(--ink); cursor: pointer; transition: background-color .12s; }
  .btn:hover { background: var(--panel-3); }
  .btn.acc { background: var(--accent); border-color: var(--accent); color: var(--lime); }
  .btn.acc:hover { background: #144A38; }
  .btn.danger { color: var(--ink); border-color: var(--ink); border-style: dashed; }
  .btn.danger:hover { background: var(--panel-3); }
  .msg { font-family: var(--mono); font-size: 11.5px; color: var(--ink-2); }
  .msg.ok, .msg.err { color: var(--ink); font-weight: 600; }

  /* export cards */
  .exports { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .exp { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--panel); border-radius: var(--radius); text-decoration: none; color: var(--ink); transition: background-color .12s; }
  .exp:hover { background: var(--panel-3); }
  .exp .ic { width: 34px; height: 34px; border-radius: 8px; background: var(--accent-dim); display: grid; place-items: center; color: var(--accent); font-size: 15px; flex-shrink: 0; }
  .exp b { font-size: 12.5px; display: block; }
  .exp span { font-size: 11px; color: var(--ink-3); }

  /* skeleton loading */
  .skel { position: relative; overflow: hidden; background: var(--panel); border-radius: var(--radius); }
  .skel::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(11,46,34,.05), transparent); animation: shimmer 1.4s infinite; }
  @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }

  .err-box { background: var(--panel); border: 2px solid var(--ink); border-radius: var(--radius); padding: 16px; color: var(--ink); font-family: var(--mono); font-size: 12px; white-space: pre-wrap; }

  /* feedback analytics */
  .fb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; margin: 16px 0; }
  .fb-card { background: var(--panel); border-radius: var(--radius); padding: 18px; }
  .fb-card h3 { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 12px; }
  .fb-card h3 .n { font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); margin-left: 8px; font-weight: 400; }
  .fb-opt { display: grid; grid-template-columns: 130px 1fr 40px; gap: 10px; align-items: center; margin: 7px 0; font-size: 12.5px; }
  .fb-opt .lbl { color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fb-bar { height: 18px; border-radius: 4px; background: var(--accent); min-width: 2px; position: relative; }
  .fb-bar span { position: absolute; left: 6px; top: 2px; font-size: 10.5px; font-weight: 600; color: var(--lime); }
  .fb-likert { display: flex; gap: 4px; align-items: flex-end; height: 90px; margin-top: 6px; }
  .fb-likert .col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .fb-likert .col .v { font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); }
  .fb-likert .col .b { width: 100%; border-radius: 4px 4px 0 0; background: var(--accent-dim); border-top: 2px solid var(--accent); min-height: 2px; }
  .fb-likert .col .c { font-family: var(--mono); font-size: 10.5px; color: var(--ink-2); }
  .fb-avg { font-family: var(--mono); font-size: 11px; color: var(--accent); margin-top: 8px; }
  .fb-quote { background: var(--panel); border-left: 3px solid var(--accent); border-radius: 8px; padding: 12px 14px; margin: 8px 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.6; }
  .fb-quote .who { font-family: var(--mono); font-size: 10px; color: var(--ink-3); margin-top: 6px; }
  details.raw { margin-top: 14px; }
  details.raw summary { cursor: pointer; color: var(--ink-3); font-size: 12px; padding: 4px 0; }
  details.raw summary:hover { color: var(--ink-2); }

  input[type="checkbox"] { accent-color: var(--accent); width: 14px; height: 14px; cursor: pointer; }

  /* full session ids: monospace, copy-on-click, never truncated */
  .sid { font-family: var(--mono); font-size: 10.5px; color: var(--ink-2); background: none; border: 1px solid transparent; border-radius: 5px; padding: 2px 6px; cursor: copy; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sid:hover { color: var(--accent); border-color: var(--border); background: var(--panel-2); }
  .sid.copied { color: var(--ink); border-color: var(--ink); }

  /* Narrow screens: the sidebar becomes a scrolling bar of views across the top. */
  @media (max-width: 800px) {
    .app { grid-template-columns: 1fr; }
    .side { position: sticky; z-index: 5; height: auto; flex-direction: row; align-items: center; overflow-x: auto; gap: 6px; padding: 10px 12px; }
    .side .brand { padding: 0 8px 0 0; } .side .brand span, .nav-l, .side .foot { display: none; }
    .nav { width: auto; white-space: nowrap; flex-shrink: 0; }
    .main { padding: 20px 16px 48px; }
    .fstep { grid-template-columns: 1fr; gap: 4px; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
</style>
</head>
<body>
<div class="app">
  <aside class="side">
    <div class="brand"><span class="mark">V</span><b>Research</b><span>console</span></div>
    <div class="nav-l">Study</div>
    <button class="nav on" data-view="overview"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>Overview</button>
    <button class="nav" data-view="participants"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a7 7 0 0 1 14 0v1"/><circle cx="17" cy="9" r="3"/><path d="M22 21v-1a6 6 0 0 0-6-6"/></svg>Participants <span class="cnt" id="cnt-p">–</span></button>
    <button class="nav" data-view="pairs"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h7M4 12h7M4 18h7M14 6h6M14 12h6M14 18h6"/></svg>Paired study <span class="cnt" id="cnt-pairs">–</span></button>
    <button class="nav" data-view="funnel"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h18l-6 9v7l-6-2v-5z"/></svg>Funnel</button>
    <div class="nav-l">Data</div>
    <button class="nav" data-view="events"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>Events <span class="cnt" id="cnt-e">–</span></button>
    <button class="nav" data-view="feedback"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Feedback <span class="cnt" id="cnt-f">–</span></button>
    <button class="nav" data-view="research"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m0 6v4a2 2 0 0 0 2 2h4m6-18h4a2 2 0 0 1 2 2v4m0 6v4a2 2 0 0 1-2 2h-4"/></svg>Research <span class="cnt" id="cnt-r">–</span></button>
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
      <div class="phead"><h1>Participants</h1><span class="sub">one row per visitor (browser session), VistaDex measures only; the study track's chatbot vs VistaDex comparison is in Paired study</span>
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

    <section class="view" id="v-pairs">
      <div class="phead"><h1>Paired study</h1><span class="sub">study track, within subjects: each participant's AI chatbot and VistaDex conditions side by side</span>
        <div class="right"><button class="btn acc" id="pairsCsvBtn">↓ paired.csv</button></div></div>
      <div id="pairs-content"><div class="skel" style="height:200px"></div></div>
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

    <section class="view" id="v-research">
      <div class="phead"><h1>Research analysis</h1><span class="sub">per-run measures · H4 learning stratification · qualitative store</span></div>
      <div id="research-content" style="margin-bottom:28px"><div class="skel" style="height:200px"></div></div>
      <h2 style="font-size:14px;margin:26px 0 4px;font-weight:700">Qualitative store <span class="sub" id="qualitative-meta" style="font-size:12px;color:var(--ink-3);font-weight:400">every survey, feedback and comprehension answer, verbatim</span></h2>
      <div id="qualitative-content"><div class="skel" style="height:120px"></div></div>
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
    claim_dwell: "per-claim attention (H4)",
    source_clicked_by_claim: "verification behaviour, per claim (H2/H4)",
    run_scoped_survey: "per-run survey copy (H4)",
    comprehension_check: "did they read unverified correctly",
    walkthrough_started: "onboarding",
    walkthrough_step_time: "step attention",
    walkthrough_ended: "onboarding completion",
    consent_given: "consent"
  };

  // nav switching
  window.copySid = function (btn) {
    var sid = btn.dataset.sid || "";
    var title = btn.title; // run cells keep the raw run id in the title
    var done = function () { btn.classList.add("copied"); btn.title = "copied"; setTimeout(function () { btn.classList.remove("copied"); btn.title = title; }, 1200); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(sid).then(done, done); }
    else { var ta = document.createElement("textarea"); ta.value = sid; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta); done(); }
  };
  // copy session ids (delegated: works for rows rendered later)
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest(".sid") : null;
    if (b) copySid(b);
  });
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
    // Agreement: each item's latest vote (research-join.js), summed over the session's runs.
    var votesBySid = {};
    JOIN.latestVotes(events, JOIN.joinRuns(events)).forEach(function (v) { (votesBySid[v.sid] = votesBySid[v.sid] || []).push(v); });
    Object.keys(by).forEach(function (sid) {
      var evs = by[sid];
      var reg = evs.find(function (e) { return e.type === "participant_registered"; });
      // Sessions without an explicit registration still count if they ran a
      // screening (pre-fix field visits): derive identity from run_started.
      var ran = evs.some(function (e) { return e.type === "run_started"; });
      if (!reg && !ran) return;
      var pl = (reg && reg.payload) || {};
      var p = { sid: sid, code: pl.code || "", role: pl.role || null, roleFrom: reg ? "registered" : null, track: pl.track || (reg ? "field" : "field"), source: pl.source || null,
        confPre: null, confPreMoved: null, confPost: null, survey: null, clicks: 0,
        runs: 0, n: evs.length, last: evs[evs.length - 1].ts, industries: null, markets: null };
      var t = JOIN.voteTotals(votesBySid[sid] || []);
      p.votes = t.votes; p.agrees = t.agrees; p.disagrees = t.disagrees; p.notSure = t.notSure;
      evs.forEach(function (e) {
        var q = e.payload || {};
        // The AI chatbot condition (study track) is compared in Paired study; here a row shows VistaDex only.
        if (q.condition === "baseline") return;
        if (e.type === "confidence_pre") { p.confPre = q.value; p.confPreMoved = typeof q.moved === "boolean" ? q.moved : null; }
        else if (e.type === "confidence_post") p.confPost = q.value;
        else if (e.type === "condition_survey") p.survey = q;
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
    var ag = p.votes ? '<span class="bar" style="width:' + Math.max(2, 30 * p.agrees / p.votes) + 'px"></span>' + JOIN.agreePct(p) + "% <span style='color:var(--ink-3)' title='items voted (latest vote each): agree / disagree / not sure = " + p.agrees + " / " + p.disagrees + " / " + p.notSure + "'>of " + p.votes + "</span>" : '<span style="color:var(--ink-3)">—</span>';
    var sv = p.survey ? '<span class="num">T' + p.survey.trust + " · U" + p.survey.usefulness + " · E" + p.survey.effort + "</span>" : '<span style="color:var(--ink-3)">—</span>';
    var from = p.roleFrom ? '<span style="color:var(--ink-3);font-size:11px">' + esc(p.roleFrom) + "</span>" : '<span style="color:var(--ink-3)">—</span>';
    var src = p.source ? '<span class="num" style="color:var(--accent)">' + esc(p.source) + "</span>" : '<span style="color:var(--ink-3)">—</span>';
    return "<tr>" + "<td>" + track + "</td>" + sidCell(p.sid) + "<td class='num'>" + esc(p.code || "·") + "</td><td>" + esc(p.role) + "</td><td>" + from + "</td><td>" + src + "</td>" +
      "<td>" + conf + "</td><td>" + ag + "</td><td>" + (p.clicks || '<span style="color:var(--ink-3)">—</span>') + "</td>" +
      "<td>" + sv + "</td><td class='num' style='color:var(--ink-3)'>" + esc(p.industries || "—") + "</td>" +
      "<td class='num'>" + p.runs + "</td><td class='num'>" + p.n + "</td>" +
      "<td><input type='checkbox' class='sel' value='" + esc(p.sid) + "'></td></tr>";
  }
  // Full session id, copy-to-clipboard on click — researchers must be able to
  // tell participants apart (the 8-char truncation made that impossible).
  function sidCell(sid) {
    return '<td><button class="sid num" title="click to copy" data-sid="' + esc(sid) + '">' + esc(sid) + '</button></td>';
  }
  var HEAD = "<tr><th>Track</th><th>Session ID</th><th>Code</th><th>Role</th><th>Where from</th><th>Channel</th><th>Confidence pre→post</th><th>Agreeableness</th><th>Sources</th><th>Survey</th><th>Industries</th><th>Runs</th><th>Events</th><th>Del</th></tr>";
  function metricsCSV(people) {
    var cols = ["session_id","track","code","role","role_source","channel","industries","markets","conf_pre","conf_pre_moved","conf_post","conf_delta","votes","agree_rate_pct","votes_agree","votes_disagree","votes_not_sure","source_clicks","trust","usefulness","helpfulness","effort","open_text","runs","events"];
    var rows = [cols.join(",")];
    people.forEach(function (p) {
      var delta = p.confPre != null && p.confPost != null ? p.confPost - p.confPre : "";
      rows.push([
        p.sid, p.track, p.code || "", p.role === "—" ? "" : p.role, p.roleFrom || "",
        p.source || "", p.industries || "", p.markets || "",
        p.confPre == null ? "" : p.confPre, p.confPreMoved == null ? "" : p.confPreMoved, p.confPost == null ? "" : p.confPost, delta,
        p.votes, p.votes ? JOIN.agreePct(p) : "", p.agrees, p.disagrees, p.notSure,
        p.clicks,
        p.survey ? p.survey.trust : "", p.survey ? p.survey.usefulness : "", p.survey ? p.survey.helpfulness : "", p.survey ? p.survey.effort : "",
        p.survey && p.survey.open_text ? String(p.survey.open_text) : "",
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

  // Run join: worker/src/research-join.js, embedded verbatim. In the deployed Worker that source comes from
  // wrangler's bundle, where esbuild (keepNames) inserts __name(fn, "fn") calls, so __name must exist here.
  var __name = function (fn) { return fn; };
  var JOIN = (${researchJoin.toString()})();

  function renderResearch(ev) {
    var box = $("research-content");
    var runs = JOIN.joinRuns(ev);
    $("cnt-r").textContent = runs.length;

    // H4 stratification: clickers vs non-clickers
    var clickers = runs.filter(function (r) { return r.clicks > 0; });
    var nonClickers = runs.filter(function (r) { return r.clicks === 0; });
    function cal(r) { return r.pre != null && r.post != null ? r.post - r.pre : null; }
    function meanCal(arr) {
      var vals = arr.map(cal).filter(function (v) { return v != null; });
      return vals.length ? Math.round(10 * vals.reduce(function (a, v) { return a + v; }, 0) / vals.length) / 10 : null;
    }

    var html = "";
    // stratification cards
    html += '<div class="kpis">' +
      '<div class="kpi"><div class="label">Runs recorded</div><div class="val">' + runs.length + '</div><div class="note">screenings with telemetry</div></div>' +
      '<div class="kpi hl"><div class="label">Verified (clicked sources)</div><div class="val">' + clickers.length + '</div><div class="note">mean confidence delta ' + (meanCal(clickers) == null ? "—" : (meanCal(clickers) > 0 ? "+" : "") + meanCal(clickers)) + '</div></div>' +
      '<div class="kpi"><div class="label">Explanation-only</div><div class="val">' + nonClickers.length + '</div><div class="note">mean confidence delta ' + (meanCal(nonClickers) == null ? "—" : (meanCal(nonClickers) > 0 ? "+" : "") + meanCal(nonClickers)) + '</div></div>' +
      '</div>';
    html += '<p class="msg" style="margin:6px 0 14px">H4 (Berger et al.): if verification produces learning, clickers should show different calibration deltas than explanation-only users. Both groups computed per run; pair with Track-A for the causal version.</p>';

    // per-run table. Legacy run ids ("r1"…) restarted on every page load, so their measures are matched to
    // the run that started before them and flagged; new ids ("r_" + 12 hex) join exactly.
    var inferredRuns = runs.filter(function (r) { return r.inferred > 0; });
    var inferredN = inferredRuns.reduce(function (a, r) { return a + r.inferred; }, 0);
    html += '<p class="msg" style="margin:0 0 8px">' + (inferredN
      ? inferredN + " measure" + (inferredN === 1 ? "" : "s") + " on " + inferredRuns.length + " run" + (inferredRuns.length === 1 ? "" : "s") + " matched by start order (legacy run ids that repeat after a reload, or missing / unmatched ids). Exact for new r_ ids."
      : "Every measure matched its run exactly.") + "</p>";
    html += '<div class="tbl-wrap"><table><tr><th>Session</th><th>Run (' + inferredN + ' inferred)</th><th>Role</th><th>Conf Δ</th><th>Votes</th><th>Agree %</th><th>Sources</th><th>Survey</th><th>Comprehension</th></tr>';
    if (runs.length) {
      runs.forEach(function (r) {
        var c = cal(r);
        var delta = c != null ? '<span class="delta ' + (c > 0 ? "up" : c < 0 ? "down" : "zero") + '">' + (c > 0 ? "+" : "") + c + "</span>" : "—";
        // an untouched slider still counts in the delta, marked so it can be told apart from a chosen 50
        if (r.pre != null && r.preMoved === false) delta += ' <span style="color:var(--ink-3);font-size:11px">pre ' + esc(r.pre) + " · untouched</span>";
        var ag = r.votes ? JOIN.agreePct(r) + "%" : "—";
        var sv = r.survey ? '<span class="num">T' + r.survey.trust + "\u00b7U" + r.survey.usefulness + "\u00b7E" + r.survey.effort + "</span>" : "\u2014";
        var comp = r.comp ? esc(r.comp) : "—";
        // "run N of M" in the session; the raw run id shows on hover and copies on click
        var runCell = '<button class="sid num" data-sid="' + esc(r.runId || "") + '" title="' + esc((r.runId || "no run id") + " — click to copy") + '">' + esc(r.label) + "</button>" +
          (r.inferred ? '<div style="color:var(--ink-3);font-size:11px">matched by start order</div>' : "");
        html += "<tr>" + sidCell(r.sid) + "<td>" + runCell + "</td><td>" + esc(r.role || "—") + "</td><td>" + delta + "</td><td class='num'>" + r.votes + "</td><td class='num'>" + ag + "</td><td class='num'>" + r.clicks + "</td><td>" + sv + "</td><td class='num'>" + comp + "</td></tr>";
      });
    } else {
      html += '<tr><td colspan="9" class="empty">No runs with telemetry yet.</td></tr>';
    }
    html += "</table></div>";
    box.innerHTML = html;
  }

  // The qualitative store view: every survey + feedback answer, verbatim, right
  // here. Rendered from the same D1 events the console already loads — no
  // external service required. When MongoDB Atlas is configured the archive
  // is noted (durable sync via backend research:sync) but never a blocker.
  var lastEvents = [];
  function renderQualitative(ev) {
    var box = $("qualitative-content");
    var types = { condition_survey: 1, run_scoped_survey: 1, feedback_submitted: 1, comprehension_check: 1, participant_registered: 1 };
    var docs = ev.filter(function (e) { return types[e.type]; }).slice().reverse(); // newest first
    if (!docs.length) {
      box.innerHTML = '<div class="tbl-wrap" style="padding:20px;color:var(--ink-3)">No qualitative answers yet — they appear the moment a visitor submits a survey or feedback.</div>';
      return;
    }
    var html = docs.map(function (e) {
      var q = e.payload || {};
      var title, body = [];
      if (e.type === "feedback_submitted") {
        title = "Feedback form";
        if (q.role) body.push("Who: " + q.role);
        if (q.useful) body.push("Useful: " + q.useful);
        if (q.section) body.push("Mattered most: " + q.section);
        if (q.would_use) body.push("Would use: " + q.would_use);
        if (q.wrong) body.push("\u201c" + q.wrong + "\u201d");
      } else if (e.type === "comprehension_check") {
        title = "Comprehension check";
        body.push("What does unverified mean: " + String(q.answer).replace(/_/g, " "));
      } else if (e.type === "participant_registered") {
        title = "Registration";
        body.push("Track " + (q.track || "?") + (q.role ? " \u00b7 role " + q.role : "") + (q.code ? " \u00b7 code " + q.code : "") + (q.source ? " \u00b7 via " + q.source : ""));
      } else {
        title = "Report survey (" + (q.condition || "?") + ")";
        body.push("Trust " + q.trust + "/7 \u00b7 usefulness " + q.usefulness + "/7 \u00b7 helped next steps " + q.helpfulness + "/7 \u00b7 effort " + q.effort + "/7");
        if (q.open_text && String(q.open_text).trim()) body.push("\u201c" + String(q.open_text).trim() + "\u201d");
      }
      return '<div class="fb-quote"><div>' + body.map(function (b) { return esc(b); }).join("</div><div style='margin-top:4px'>") + "</div>" +
        '<div class="who">' + esc(title) + " \u00b7 " + esc(String(e.ts || "").slice(0, 16).replace("T", " ")) + " \u00b7 " + esc(e.session_id) + " \u00b7 D1</div></div>";
    }).join("");
    box.innerHTML = html;
  }

  function loadQualitative() {
    fetch("/research/qualitative", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      var box = $("qualitative-meta");
      if (!box) return;
      box.textContent = d.configured
        ? "MongoDB Atlas archive connected (research_data.qualitative) \u00b7 showing live D1 data below"
        : "D1 (live) \u00b7 optional MongoDB Atlas archive: backend 'npm run research:sync' with MONGODB_URI";
    }).catch(function () { /* cosmetic note only */ });
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
      // Real 0-100 slider values, binned by 10 with the bin labelled as a %.
      function confCard(title, list) {
        var vals = list.map(function (e) { return e.payload && e.payload.value; })
          .filter(function (v) { return typeof v === "number" && !isNaN(v); });
        if (!vals.length) return "";
        var hist = {};
        vals.forEach(function (v) { var b = Math.min(9, Math.floor(v / 10)); hist[b] = (hist[b] || 0) + 1; });
        var maxCount = Math.max.apply(null, Object.keys(hist).map(function (k) { return hist[k]; }));
        var cols = "";
        for (var b = 0; b <= 9; b++) {
          var c = hist[b] || 0;
          cols += '<div class="col"><span class="v">' + (c || "") + '</div>' +
            '<div class="b" style="height:' + Math.max(2, 70 * c / maxCount) + 'px"></div>' +
            '<span class="c">' + (b * 10) + "+</span></div>";
        }
        var mean = Math.round(10 * vals.reduce(function (a, v) { return a + v; }, 0) / vals.length) / 10;
        return '<div class="fb-card"><h3>' + esc(title) + '<span class="n">' + vals.length + ' ratings</span></h3>' +
          '<div class="fb-likert">' + cols + "</div>" +
          '<div class="fb-avg">mean ' + mean + "%</div></div>";
      }
      html += confCard("Before the report", confPre);
      html += confCard("After the report", confPost);
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
      // open answers - feedback form AND study panel (verbatim)
      var formQuotes = fbForms.filter(function (e) { return e.payload && e.payload.wrong && String(e.payload.wrong).trim().length > 0; });
      var panelQuotes = surveys.filter(function (e) { return e.payload && e.payload.open_text && String(e.payload.open_text).trim().length > 0; });
      var allQuotes = formQuotes.map(function (e) { return { t: e.payload.wrong, w: "feedback form", d: e.ts }; })
        .concat(panelQuotes.map(function (e) { return { t: e.payload.open_text, w: "report survey (" + (e.payload.condition || "?") + ")", d: e.ts }; }));
      allQuotes.sort(function (a, b) { return String(b.d).localeCompare(String(a.d)); });
      if (allQuotes.length) {
        html += '<div style="margin:20px 0 4px"><p style="font-size:15px;font-weight:700">Open answers</p><p style="font-size:12px;color:var(--ink-3)">verbatim, newest first \u00b7 from the feedback form and the report survey</p></div>';
        html += allQuotes.map(function (q) {
          return '<div class="fb-quote">' + esc(String(q.t).slice(0, 800)) + '<div class="who">' + esc(q.w) + " \u00b7 " + esc(String(q.d).slice(0, 16).replace("T", " ")) + "</div></div>";
        }).join("");
      }
    }

    // Every response, one row each — the actual answers, not just aggregates.
    var responses = [];
    fbForms.forEach(function (e) {
      var q = e.payload || {};
      responses.push({ ts: e.ts, sid: e.session_id, kind: "Feedback form",
        main: [q.role ? "who: " + q.role : null, q.useful ? "useful: " + q.useful : null, q.section ? "section: " + q.section : null, q.would_use ? "would use: " + q.would_use : null].filter(Boolean).join(" \u00b7 "),
        open: q.wrong || "" });
    });
    surveys.forEach(function (e) {
      var q = e.payload || {};
      responses.push({ ts: e.ts, sid: e.session_id, kind: "Report survey (" + (q.condition || "?") + ")",
        main: "trust " + (q.trust == null ? "\u2014" : q.trust) + "/7 \u00b7 usefulness " + (q.usefulness == null ? "\u2014" : q.usefulness) + "/7 \u00b7 next steps " + (q.helpfulness == null ? "\u2014" : q.helpfulness) + "/7 \u00b7 effort " + (q.effort == null ? "\u2014" : q.effort) + "/7",
        open: q.open_text || "" });
    });
    responses.sort(function (a, b) { return String(b.ts).localeCompare(String(a.ts)); });
    if (responses.length) {
      html += '<div style="margin:26px 0 4px"><p style="font-size:15px;font-weight:700">Every response (' + responses.length + ')</p><p style="font-size:12px;color:var(--ink-3)">one row per submission, newest first \u00b7 click a session id to copy it</p></div>';
      html += '<div class="tbl-wrap"><table><tr><th>When</th><th>Source</th><th>Session ID</th><th>Answers</th><th>Open answer</th></tr>';
      responses.forEach(function (r) {
        html += '<tr><td class="num" style="color:var(--ink-2)">' + esc(String(r.ts).slice(0, 16).replace("T", " ")) + "</td>" +
          '<td>' + esc(r.kind) + "</td>" + sidCell(r.sid) +
          '<td style="white-space:normal;max-width:340px">' + esc(r.main || "\u2014") + "</td>" +
          '<td style="white-space:normal;max-width:340px">' + (r.open && String(r.open).trim() ? "\u201c" + esc(String(r.open).slice(0, 400)) + "\u201d" : '<span style="color:var(--ink-3)">\u2014</span>') + "</td></tr>";
      });
      html += "</table></div>";
    }

    box.innerHTML = html;
  }

  // ── Paired study (study track, within subjects): research-join.js pairedParticipants + wilcoxon ──
  var SRC_ORD = { "0": 0, "1-2": 1, "3+": 2 };
  var PAIR_MEASURES = [
    ["Confidence change (after minus before)", function (c) { return c.delta; }],
    ["Confidence after", function (c) { return c.post; }],
    ["Trust in the assessment (1 to 7)", function (c) { return c.trust; }],
    ["Useful for judging the idea (1 to 7)", function (c) { return c.usefulness; }],
    ["Helped see what to verify (1 to 7)", function (c) { return c.helpfulness; }],
    ["Effort (1 to 7)", function (c) { return c.effort; }],
    ["Sources checked, self-report (0 / 1-2 / 3+ as 0 / 1 / 2)", function (c) { return c.sourcesChecked == null ? null : SRC_ORD[c.sourcesChecked]; }],
  ];
  function dash() { return '<span style="color:var(--ink-3)">—</span>'; }
  function mean(vals) { return vals.length ? Math.round(10 * vals.reduce(function (a, v) { return a + v; }, 0) / vals.length) / 10 : null; }
  function fmtP(w) {
    if (w.p == null) return dash();
    return (w.p < 0.001 ? "&lt; 0.001" : w.p.toFixed(3)) + ' <span style="color:var(--ink-3);font-size:11px">' + esc(w.method) + "</span>";
  }
  function prePost(c) {
    if (c.pre == null && c.post == null) return dash();
    var d = c.delta;
    return esc(c.pre == null ? "?" : c.pre) + " → " + esc(c.post == null ? "?" : c.post) +
      (d == null ? "" : ' <span class="delta ' + (d > 0 ? "up" : d < 0 ? "down" : "zero") + '">' + (d > 0 ? "+" : "") + d + "</span>") +
      (c.preMoved === false ? ' <span style="color:var(--ink-3);font-size:11px">before untouched</span>' : "");
  }
  function both(r, f) {
    var b = f(r.baseline), v = f(r.vistadex);
    return (b == null ? "—" : esc(b)) + " / " + (v == null ? "—" : esc(v));
  }
  var ORDER_LABEL = { "baseline-first": "chatbot first", "vistadex-first": "VistaDex first" };
  function renderPairs(ev) {
    var rows = JOIN.pairedParticipants(ev).sort(function (a, b) { return a.code.localeCompare(b.code, undefined, { numeric: true }); });
    window.__pairs = rows;
    var complete = rows.filter(function (r) { return r.complete; });
    $("cnt-pairs").textContent = complete.length + "/" + rows.length;
    var count = function (f) { return rows.filter(f).length; };
    var ideas = {};
    rows.forEach(function (r) { var k = r.idea || "?"; ideas[k] = (ideas[k] || 0) + 1; });
    var html = '<div class="kpis">' +
      '<div class="kpi hl"><div class="label">Complete pairs</div><div class="val">' + complete.length + '</div><div class="note">confidence before and after in both conditions</div></div>' +
      '<div class="kpi"><div class="label">Participants</div><div class="val">' + rows.length + '</div><div class="note">study-track codes registered</div></div>' +
      '<div class="kpi"><div class="label">Order</div><div class="val">' + count(function (r) { return r.order === "baseline-first"; }) + " / " + count(function (r) { return r.order === "vistadex-first"; }) + '</div><div class="note">chatbot first / VistaDex first · ' + count(function (r) { return r.orderInferred; }) + " from the code number</div></div>" +
      '<div class="kpi"><div class="label">Ideas</div><div class="val" style="font-size:18px">' + Object.keys(ideas).sort().map(function (k) { return esc(k) + " " + ideas[k]; }).join(" · ") + '</div><div class="note">participants per assigned idea</div></div>' +
      "</div>";
    html += '<div class="tbl-wrap"><table><tr><th>Measure</th><th>Pairs</th><th>Chatbot mean</th><th>VistaDex mean</th><th>Median difference</th><th>W+ / W−</th><th>p (two-sided)</th></tr>';
    PAIR_MEASURES.forEach(function (m) {
      var pairs = rows.filter(function (r) { return m[1](r.baseline) != null && m[1](r.vistadex) != null; });
      var w = JOIN.wilcoxon(pairs.map(function (r) { return m[1](r.vistadex) - m[1](r.baseline); }));
      html += "<tr><td>" + esc(m[0]) + "</td><td class='num'>" + pairs.length + (w.zeros ? ' <span style="color:var(--ink-3);font-size:11px">' + w.zeros + (w.zeros === 1 ? " tie" : " ties") + " at 0</span>" : "") + "</td>" +
        "<td class='num'>" + (mean(pairs.map(function (r) { return m[1](r.baseline); })) == null ? dash() : mean(pairs.map(function (r) { return m[1](r.baseline); }))) + "</td>" +
        "<td class='num'>" + (mean(pairs.map(function (r) { return m[1](r.vistadex); })) == null ? dash() : mean(pairs.map(function (r) { return m[1](r.vistadex); }))) + "</td>" +
        "<td class='num'>" + (w.median == null ? dash() : (w.median > 0 ? "+" : "") + w.median) + "</td>" +
        "<td class='num'>" + (w.n ? w.wPlus + " / " + w.wMinus : dash()) + "</td><td class='num'>" + fmtP(w) + "</td></tr>";
    });
    html += "</table></div>";
    html += '<p class="msg" style="margin:8px 0 18px">Differences are VistaDex minus AI chatbot, per participant, over the participants who answered the measure in both conditions. Wilcoxon signed-rank test: zero differences dropped, ties ranked by average, exact p up to 25 pairs. With a small sample, report the median differences and pairs alongside p.</p>';
    html += '<div class="tbl-wrap"><table><tr><th>Code</th><th>Idea</th><th>Order</th><th>Chatbot: before → after</th><th>VistaDex: before → after</th><th>Trust C / V</th><th>Useful C / V</th><th>Verify C / V</th><th>Effort C / V</th><th>Sources checked C / V</th><th>Links opened</th><th>Agree %</th><th>Complete</th></tr>';
    html += rows.length ? rows.map(function (r) {
      return "<tr><td class='num'>" + esc(r.code) + "</td><td class='num'>" + esc(r.idea || "?") + "</td>" +
        "<td>" + esc(ORDER_LABEL[r.order] || "?") + (r.orderInferred ? ' <span style="color:var(--ink-3);font-size:11px">from code</span>' : "") + "</td>" +
        "<td>" + prePost(r.baseline) + "</td><td>" + prePost(r.vistadex) + "</td>" +
        "<td class='num'>" + both(r, function (c) { return c.trust; }) + "</td><td class='num'>" + both(r, function (c) { return c.usefulness; }) + "</td>" +
        "<td class='num'>" + both(r, function (c) { return c.helpfulness; }) + "</td><td class='num'>" + both(r, function (c) { return c.effort; }) + "</td>" +
        "<td class='num'>" + both(r, function (c) { return c.sourcesChecked; }) + "</td>" +
        "<td class='num'>" + (r.vistadex.clicks == null ? dash() : r.vistadex.clicks) + "</td>" +
        "<td class='num'>" + (r.vistadex.agreePct == null ? dash() : r.vistadex.agreePct + "% of " + r.vistadex.votes) + "</td>" +
        "<td>" + (r.complete ? "yes" : "not yet") + "</td></tr>";
    }).join("") : '<tr><td colspan="13" class="empty">No study-track participants yet: they appear when someone registers a participant code on #/study.</td></tr>';
    html += "</table></div>";
    $("pairs-content").innerHTML = html;
    return rows;
  }
  function csvCell(v) {
    v = v == null ? "" : String(v);
    var needsQuote = v.indexOf(",") >= 0 || v.indexOf('"') >= 0 || v.indexOf(String.fromCharCode(10)) >= 0;
    return needsQuote ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function pairedCSV(rows) {
    var per = ["run_id", "pre", "pre_moved", "post", "delta", "trust", "usefulness", "helpfulness", "effort", "sources_checked", "open_text"];
    var cols = ["code", "sessions", "idea", "order", "order_inferred", "complete"];
    ["chatbot", "vistadex"].forEach(function (c) { per.forEach(function (k) { cols.push(c + "_" + k); }); });
    cols.push("vistadex_links_opened", "vistadex_items_voted", "vistadex_agree_pct");
    var out = [cols.join(",")];
    rows.forEach(function (r) {
      var line = [r.code, r.sessions.join(";"), r.idea, r.order, r.orderInferred, r.complete];
      [r.baseline, r.vistadex].forEach(function (c) {
        line.push(c.runId, c.pre, c.preMoved, c.post, c.delta, c.trust, c.usefulness, c.helpfulness, c.effort, c.sourcesChecked, c.openText);
      });
      line.push(r.vistadex.clicks, r.vistadex.votes, r.vistadex.agreePct);
      out.push(line.map(csvCell).join(","));
    });
    return out.join(String.fromCharCode(10));
  }

  function render(d) {
    var ev = d.all_events || [];
    var people = computePeople(ev);
    $("cnt-p").textContent = people.length;
    $("cnt-e").textContent = d.totals.events;
    $("cnt-s").textContent = d.totals.sessions;
    $("last-sync").textContent = "updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    var study = people.filter(function (p) { return p.track === "study"; });
    var pairs = renderPairs(ev);
    var complete = pairs.filter(function (r) { return r.complete; });
    var voted = people.filter(function (p) { return p.votes > 0; });

    $("kpis").innerHTML =
      '<div class="kpi"><div class="label">Sessions</div><div class="val">' + d.totals.sessions + '</div><div class="note">consented visitors</div></div>' +
      '<div class="kpi"><div class="label">Events</div><div class="val">' + d.totals.events + '</div><div class="note">telemetry records</div></div>' +
      '<div class="kpi"><div class="label">Pipeline traces</div><div class="val">' + d.totals.traces + '</div><div class="note">screens run (any mode)</div></div>' +
      '<div class="kpi hl"><div class="label">Participants</div><div class="val">' + people.length + '</div><div class="note">' + study.length + " study · " + (people.length - study.length) + " field</div></div>" +
      '<div class="kpi"><div class="label">Paired-complete</div><div class="val">' + complete.length + "</div><div class='note'>of " + pairs.length + " study participants: both conditions before and after</div></div>" +
      '<div class="kpi"><div class="label">Items voted</div><div class="val">' + people.reduce(function (a, p) { return a + p.votes; }, 0) + '</div><div class="note">latest vote per item · ' + voted.length + " participants voted</div></div>";

    $("recent-participants").innerHTML = HEAD + (people.length
      ? people.slice(0, 6).map(personRow).join("")
      : '<tr><td colspan="14" class="empty">No participants yet — they appear when someone accepts the Welcome notice.</td></tr>');

    var roles = []; people.forEach(function (p) { if (p.role && p.role !== "—" && roles.indexOf(p.role) < 0) roles.push(p.role); });
    var curRole = $("roleFilter").value;
    $("roleFilter").innerHTML = '<option value="">all roles</option>' + roles.map(function (r) { return "<option" + (r === curRole ? " selected" : "") + ">" + esc(r) + "</option>"; }).join("");
    var curTrack = $("trackFilter").value;
    var shown = people.filter(function (p) {
      return (!curRole || p.role === curRole) && (!curTrack || p.track === curTrack);
    });
    $("participants").innerHTML = HEAD + (shown.length
      ? shown.map(personRow).join("")
      : '<tr><td colspan="14" class="empty">No participants match the filters.</td></tr>');
    window.__people = people; // for CSV export

    // funnel
    var f = [
      ["Registered (study track)", pairs.length],
      ["AI chatbot part done", pairs.filter(function (r) { return r.baseline.post != null; }).length],
      ["VistaDex part done", pairs.filter(function (r) { return r.vistadex.post != null; }).length],
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

    // research view (per-run + H4)
    renderResearch(ev);
    lastEvents = ev;
    renderQualitative(ev);
    loadQualitative();

    // feedback view
    renderFeedback(ev);

    // feed
    $("feed").innerHTML = d.latest_events.map(function (e) {
      return '<div class="fr"><span class="t">' + esc(String(e.ts).slice(11, 19)) + '</span><span class="k">' + esc(e.type) + "</span><span class='p'>" + esc(JSON.stringify(e.payload || {}).slice(0, 100)) + "</span></div>";
    }).join("") || '<div class="fr"><span class="p">no events yet</span></div>';
    $("raw").textContent = JSON.stringify(d.latest_events, null, 1);

    // sessions
    $("sessions").innerHTML = "<tr><th></th><th>Session ID</th><th>Events</th><th>First seen</th><th>Last seen</th><th>Top types</th></tr>" +
      d.sessions.map(function (s) {
        var top = Object.keys(s.types).sort(function (a, b) { return s.types[b] - s.types[a]; }).slice(0, 3)
          .map(function (t) { return t + "\u00b7" + s.types[t]; }).join("  ");
        return "<tr><td><input type='checkbox' class='sel' value='" + esc(s.session_id) + "'></td>" +
          sidCell(s.session_id) + "<td class='num'>" + s.events + "</td>" +
          "<td class='num' style='color:var(--ink-2)'>" + esc(String(s.first).slice(0, 16).replace("T", " ")) + "</td>" +
          "<td class='num' style='color:var(--ink-2)'>" + esc(String(s.last).slice(0, 16).replace("T", " ")) + "</td>" +
          "<td class='num' style='color:var(--ink-3)'>" + esc(top) + "</td></tr>";
      }).join("");
  }

  function load() {
    fetch("/research/data?full=1", { cache: "no-store" }).then(function (r) {
      if (r.status === 401) { $("kpis").innerHTML = '<div class="err-box" style="grid-column:1/-1">Session expired: <a href="/research" style="color:var(--accent)">log in again</a>.</div>'; return null; }
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
  $("pairsCsvBtn").onclick = function () {
    var blob = new Blob([pairedCSV(window.__pairs || [])], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vistadex-paired-study.csv";
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
