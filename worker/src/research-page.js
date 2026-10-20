// research-page.js — the Research Console (token-gated). Kept as its own module
// so the embedded <script> does not fight template-literal escaping.
// UI: study-first layout — summary cards, per-participant table with computed
// measures, event coverage with meanings, funnel, live feed, purge, exports.
// All numbers are computed from /research/data?full=1 (payloads pre-parsed).
export const RESEARCH_PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>VistaDex · Research Console</title>
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #0B3B2C; --bg-deep: #092E22; --surface: #144A38; --surface-2: #0F3D2D;
    --line: rgba(234,226,210,.14); --line-soft: rgba(234,226,210,.08);
    --cream: #EEF2E2; --ink: #EEF2E2; --muted: #B5CCBC; --faint: #7FA391;
    --lime: #CBEF6A; --amber: #FFD166; --red: #FF8787; --green: #7DE8B8;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    --sans: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--sans); background: var(--bg); color: var(--ink); font-size: 14px; line-height: 1.5; padding: 0 0 60px; }
  .top { position: sticky; top: 0; z-index: 10; background: rgba(11,59,44,.92); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line-soft); }
  .top-inner { max-width: 1180px; margin: 0 auto; padding: 14px 24px; display: flex; align-items: center; gap: 12px; }
  .logo { font-family: var(--mono); font-weight: 700; font-size: 14px; letter-spacing: .02em; }
  .logo i { font-style: normal; color: var(--lime); }
  .top-note { color: var(--faint); font-size: 12px; margin-left: auto; font-family: var(--mono); }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 28px 24px; }
  h2 { font-size: 16px; font-weight: 700; margin: 34px 0 4px; display: flex; align-items: baseline; gap: 10px; }
  h2:first-of-type { margin-top: 0; }
  h2 .sub { font-size: 12px; font-weight: 400; color: var(--muted); }
  h2 .num { font-family: var(--mono); font-size: 11px; color: var(--lime); }

  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 18px 0; }
  .card { background: var(--surface); border: 1px solid var(--line-soft); border-radius: 14px; padding: 16px 18px; }
  .card b { font-size: 26px; font-weight: 800; display: block; letter-spacing: -.02em; }
  .card span { color: var(--muted); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; font-family: var(--mono); }
  .card small { display: block; color: var(--faint); font-size: 11px; margin-top: 2px; }

  table { border-collapse: separate; border-spacing: 0; width: 100%; margin: 12px 0; background: var(--surface-2); border: 1px solid var(--line-soft); border-radius: 12px; overflow: hidden; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-family: var(--mono); padding: 10px 14px; background: var(--surface); border-bottom: 1px solid var(--line-soft); }
  td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid var(--line-soft); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(203,239,106,.04); }
  td.mono, .mono { font-family: var(--mono); font-size: 12px; }
  td.empty { color: var(--faint); text-align: center; padding: 24px; font-style: italic; }

  .pill { display: inline-block; border-radius: 99px; padding: 2px 10px; font-size: 11px; font-family: var(--mono); border: 1px solid; }
  .pill.study { color: var(--lime); border-color: rgba(203,239,106,.4); background: rgba(203,239,106,.08); }
  .pill.field { color: var(--green); border-color: rgba(125,232,184,.4); background: rgba(125,232,184,.08); }
  .good { color: var(--green); } .bad { color: var(--red); } .warn { color: var(--amber); }

  .delta { font-family: var(--mono); font-size: 12px; }
  .delta.up { color: var(--green); } .delta.down { color: var(--red); }

  pre.feed { background: var(--surface-2); border: 1px solid var(--line-soft); border-radius: 12px; padding: 14px 16px; max-height: 320px; overflow: auto; font-family: var(--mono); font-size: 11.5px; line-height: 1.7; color: var(--muted); white-space: pre-wrap; }
  pre.feed .t { color: var(--faint); } pre.feed .k { color: var(--lime); }

  .actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 14px 0; }
  button { font-family: var(--sans); font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; transition: all .15s; }
  button:hover { border-color: var(--muted); }
  button.danger { color: var(--amber); border-color: rgba(255,209,102,.35); }
  button.danger:hover { background: rgba(255,209,102,.1); }
  button.primary { background: var(--lime); color: #0B2E22; border: none; }
  .msg { font-size: 12px; color: var(--muted); font-family: var(--mono); }
  .msg.ok { color: var(--green); } .msg.err { color: var(--red); }

  a { color: var(--lime); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .dl-row { display: flex; gap: 18px; flex-wrap: wrap; margin: 10px 0; font-size: 13px; }
  .dl-row a { display: inline-flex; align-items: center; gap: 6px; background: var(--surface); border: 1px solid var(--line-soft); padding: 8px 14px; border-radius: 9px; }
  .dl-row a:hover { border-color: var(--muted); text-decoration: none; }
  details { margin: 8px 0; }
  summary { cursor: pointer; color: var(--muted); font-size: 12px; }
  details[open] summary { color: var(--ink); margin-bottom: 8px; }

  .err-box { background: rgba(255,135,135,.08); border: 1px solid rgba(255,135,135,.3); border-radius: 12px; padding: 14px 16px; color: var(--red); font-family: var(--mono); font-size: 12px; white-space: pre-wrap; }
</style>
</head>
<body>
<div class="top"><div class="top-inner">
  <span class="logo">Vista<i>Dex</i> · Research Console</span>
  <span class="top-note" id="meta"></span>
</div></div>
<div class="wrap">

  <div class="cards" id="cards"></div>

  <h2><span class="num">01</span> Participants <span class="sub">per person: condition order, confidence shift, votes, verification, survey — joined from their events</span></h2>
  <table id="participants"></table>

  <h2><span class="num">02</span> Study funnel <span class="sub">study-track progress</span></h2>
  <table id="funnel"></table>

  <h2><span class="num">03</span> Event coverage <span class="sub">every metric collected so far, and what it measures</span></h2>
  <table id="types"></table>

  <h2><span class="num">04</span> Live feed <span class="sub">latest 50 events · auto-refresh 30s</span></h2>
  <pre class="feed" id="feed">loading…</pre>

  <h2><span class="num">05</span> Data management</h2>
  <div class="actions">
    <button id="refreshBtn">↻ Refresh now</button>
    <button class="danger" id="purgeBtn">🗑 Purge ticked sessions</button>
    <span class="msg" id="purgeMsg"></span>
  </div>
  <p class="msg" style="margin-bottom:10px">Tick sessions in the Participants table (or below) to remove test/junk data — deletes their events and linked traces.</p>
  <details>
    <summary>All sessions (including pre-study test sessions without registration)</summary>
    <table id="sessions"></table>
  </details>

  <h2><span class="num">06</span> Export <span class="sub">for Excel / R / Python — use the CSV links; JSON for scripts</span></h2>
  <div class="dl-row">
    <a href="/export?table=events&format=csv" download>⬇ events.csv</a>
    <a href="/export?table=events">events.json</a>
    <a href="/export?table=traces&format=csv" download>⬇ traces.csv</a>
    <a href="/export?table=traces">traces.json</a>
  </div>
  <p class="msg">One row per event (session_id, seq, ts, type, study_version, payload, received_at). The same data powers this page; curl users: add "Authorization: Bearer &lt;token&gt;".</p>

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
  function showError(msg) {
    $("cards").innerHTML = '<div class="err-box" style="grid-column:1/-1">' + esc(msg) + "</div>";
  }

  var MEANINGS = {
    participant_registered: "identity: code, role, track",
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

  function fmtTs(t) { return String(t || "").slice(11, 19); }

  function participantRows(events) {
    var sessions = {};
    events.forEach(function (e) {
      var s = sessions[e.session_id] = sessions[e.session_id] || { ev: [] };
      s.ev.push(e);
    });
    var people = [];
    Object.keys(sessions).forEach(function (sid) {
      var s = sessions[sid];
      var reg = s.ev.find(function (e) { return e.type === "participant_registered"; });
      if (!reg) return;
      var pl = reg.payload || {};
      var p = {
        code: pl.code || "", role: pl.role || "—", track: pl.track || "field", sid: sid,
        confPre: null, confPost: null, survey: null,
        claimVotes: [], objVotes: [], sourceClicks: 0,
        firstTs: s.ev[0].ts, lastTs: s.ev[s.ev.length - 1].ts, n: s.ev.length
      };
      s.ev.forEach(function (e) {
        var q = e.payload || {};
        if (e.type === "confidence_pre") p.confPre = q.value;
        else if (e.type === "confidence_post") p.confPost = q.value;
        else if (e.type === "condition_survey") p.survey = q;
        else if (e.type === "claim_vote") p.claimVotes.push(q);
        else if (e.type === "objection_vote") p.objVotes.push(q);
        else if (e.type === "source_clicked") p.sourceClicks++;
      });
      people.push(p);
    });
    return people;
  }

  function render(d) {
    var ev = d.all_events || [];
    $("meta").textContent = d.totals.sessions + " sessions · " + d.totals.events + " events · " + d.totals.traces + " traces · updated " + new Date().toLocaleTimeString();
    $("cards").innerHTML =
      '<div class="card"><b>' + d.totals.sessions + '</b><span>sessions</span></div>' +
      '<div class="card"><b>' + d.totals.events + '</b><span>events</span></div>' +
      '<div class="card"><b>' + d.totals.traces + '</b><span>pipeline traces</span></div>' +
      '<div class="card"><b>' + (d.totals.events - d.latest_events.length > 0 ? "live" : "…") + '</b><span>console</span></div>';

    var people = participantRows(ev);
    var rows = people.map(function (p) {
      var track = '<span class="pill ' + esc(p.track) + '">' + esc(p.track) + "</span>";
      var conf = p.confPre == null ? "—" : (p.confPre + " → " + (p.confPost == null ? "?" : p.confPost) + "%");
      var cal = p.confPre != null && p.confPost != null ? (p.confPost - p.confPre) : null;
      var delta = cal != null
        ? ' <span class="delta ' + (cal > 0 ? "up" : cal < 0 ? "down" : "") + '">(' + (cal > 0 ? "+" : "") + cal + ")</span>"
        : "";
      var votes = p.claimVotes.length + p.objVotes.length;
      var agrees = p.claimVotes.filter(function (v) { return v.vote === "agree"; }).length
                 + p.objVotes.filter(function (v) { return v.vote === "agree"; }).length;
      var agreeRate = votes ? Math.round(100 * agrees / votes) + "%" : "—";
      var survey = p.survey
        ? "<span class='mono'>T" + p.survey.trust + " · U" + p.survey.usefulness + " · E" + p.survey.effort + "</span>"
        : "—";
      return "<tr><td>" + track + "</td><td class='mono'>" + esc(p.code || "(none)") + "</td><td>" + esc(p.role) + "</td>" +
        "<td>" + conf + delta + "</td>" +
        "<td>" + (votes ? votes + " votes · " + agreeRate + " agree" : "—") + "</td>" +
        "<td>" + (p.sourceClicks || "—") + (p.sourceClicks ? " links" : "") + "</td>" +
        "<td>" + survey + "</td>" +
        "<td class='mono'>" + p.n + "</td>" +
        "<td><input type='checkbox' class='sel' value='" + esc(p.sid) + "' aria-label='tick to purge'></td></tr>";
    });
    $("participants").innerHTML =
      "<tr><th>Track</th><th>Code</th><th>Role</th><th>Confidence pre → post</th><th>Agreeableness</th><th>Verification</th><th>Survey</th><th>Events</th><th>Purge</th></tr>" +
      (rows.length ? rows.join("") : "<tr><td colspan='9' class='empty'>No participants yet — they appear here when someone accepts the Welcome notice (or registers via #/study).</td></tr>");

    // funnel
    var study = people.filter(function (p) { return p.track === "study"; });
    var studyComplete = study.filter(function (p) { return p.survey && p.confPost != null && p.confPre != null; });
    $("funnel").innerHTML = "<tr><th>Stage</th><th>People</th><th>Of study track</th></tr>" +
      "<tr><td>Registered (study track)</td><td class='mono'>" + study.length + "</td><td class='mono'>100%</td></tr>" +
      "<tr><td>Completed both condition surveys</td><td class='mono'>" + studyComplete.length + "</td><td class='mono'>" + (study.length ? Math.round(100 * studyComplete.length / study.length) : 0) + "%</td></tr>" +
      "<tr><td>Field-track participants (public link)</td><td class='mono'>" + people.filter(function (p) { return p.track !== "study"; }).length + "</td><td class='mono'>—</td></tr>";

    // types
    var types = Object.keys(d.events_by_type).sort(function (a, b) { return d.events_by_type[b] - d.events_by_type[a]; });
    $("types").innerHTML = "<tr><th>Event type</th><th>Count</th><th>What it measures</th></tr>" +
      types.map(function (t) {
        return "<tr><td class='mono'>" + esc(t) + "</td><td class='mono'>" + d.events_by_type[t] + "</td><td>" + esc(MEANINGS[t] || "auto-collected") + "</td></tr>";
      }).join("");

    // feed
    $("feed").innerHTML = d.latest_events.map(function (e) {
      var q = e.payload || {};
      return '<span class="t">' + fmtTs(e.ts) + "</span>  <span class='k'>" + esc(e.type) + "</span>  " + esc(JSON.stringify(q).slice(0, 90));
    }).join("\\n") || "(no events yet)";

    // all sessions
    $("sessions").innerHTML = "<tr><th></th><th>Session</th><th>Events</th><th>First seen</th><th>Last seen</th><th>Top types</th></tr>" +
      d.sessions.map(function (s) {
        var top = Object.keys(s.types).sort(function (a, b) { return s.types[b] - s.types[a]; }).slice(0, 3)
          .map(function (t) { return t + ":" + s.types[t]; }).join(", ");
        return "<tr><td><input type='checkbox' class='sel' value='" + esc(s.session_id) + "'></td>" +
          "<td class='mono'>" + esc(s.session_id.slice(0, 8)) + "…</td>" +
          "<td class='mono'>" + s.events + "</td>" +
          "<td class='mono'>" + esc(String(s.first).slice(0, 16).replace("T", " ")) + "</td>" +
          "<td class='mono'>" + esc(String(s.last).slice(0, 16).replace("T", " ")) + "</td>" +
          "<td class='mono'>" + esc(top) + "</td></tr>";
      }).join("");
  }

  function load() {
    fetch("/research/data?full=1", { cache: "no-store" }).then(function (r) {
      if (r.status === 401) { showError("Not logged in. Open /research?t=YOUR_TOKEN to log in."); return null; }
      if (r.status !== 200) {
        return r.text().then(function (body) { showError("Data fetch failed: HTTP " + r.status + "\\n" + body.slice(0, 250)); return null; });
      }
      return r.json();
    }).then(function (d) { if (d) render(d); })
      .catch(function (e) { showError("Network error: " + e.message); });
  }

  $("purgeBtn").onclick = function () {
    var ids = Array.prototype.slice.call(document.querySelectorAll(".sel:checked")).map(function (c) { return c.value; });
    if (!ids.length) { $("purgeMsg").textContent = "tick sessions first"; $("purgeMsg").className = "msg"; return; }
    if (!window.confirm("Permanently delete " + ids.length + " session(s) and their traces?")) return;
    $("purgeMsg").textContent = "purging…"; $("purgeMsg").className = "msg";
    fetch("/research/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_ids: ids })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.ok) { $("purgeMsg").textContent = "✓ purged " + d.purged + " session(s)"; $("purgeMsg").className = "msg ok"; }
      else { $("purgeMsg").textContent = "failed: " + JSON.stringify(d); $("purgeMsg").className = "msg err"; }
      load();
    }).catch(function (e) { $("purgeMsg").textContent = "network error: " + e.message; $("purgeMsg").className = "msg err"; });
  };
  $("refreshBtn").onclick = load;
  load();
  window.setInterval(load, 30000);
})();
</script>
</body>
</html>`;
