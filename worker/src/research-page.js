// research-page.js — the research console's HTML. Kept as its own module so the
// embedded <script> does not fight template-literal escaping. Served as a
// plain string; the page's own JS talks to /research/data and /research/purge.
//
// Study-aware layout: participants → conditions → measures, with the research
// metrics computed client-side from the raw events (calibration deltas,
// agreeableness ratios, verification behaviour) — so researchers read
// numbers, not raw logs.
export const RESEARCH_PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>VistaDex &middot; Research Console</title>
<meta name="robots" content="noindex">
<style>
  body{font-family:ui-monospace,monospace;background:#0A2622;color:#F5F1E8;margin:0;padding:40px;font-size:13px}
  h1{font-size:18px} h2{font-size:14px;color:#FF9E4A;margin:30px 0 8px} h3{font-size:12px;color:#C9B8FF;margin:18px 0 6px}
  table{border-collapse:collapse;width:100%;margin:8px 0}
  td,th{border:1px solid rgba(234,226,210,.13);padding:7px 12px;text-align:left;font-size:12px}
  th{color:#A9B5AC}
  .cards{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
  .card{background:#10312B;border:1px solid rgba(234,226,210,.13);border-radius:12px;padding:16px 20px}
  .card b{font-size:24px;display:block} .card span{color:#A9B5AC;font-size:10px;letter-spacing:.08em}
  .card small{color:#A9B5AC;font-size:10px;display:block;margin-top:2px}
  a{color:#FF9E4A}
  button{font-family:inherit;font-size:11px;padding:5px 10px;border-radius:7px;border:1px solid rgba(234,226,210,.2);background:#143A33;color:#F5F1E8;cursor:pointer}
  pre{background:#10312B;border:1px solid rgba(234,226,210,.13);border-radius:10px;padding:12px;overflow:auto;max-height:300px;font-size:11px;white-space:pre-wrap}
  .muted{color:#A9B5AC} .warn{color:#FFB000} .good{color:#35C77E}
  .err{color:#FF5A5A;white-space:pre-wrap}
  .pill{display:inline-block;border-radius:99px;padding:1px 8px;font-size:10px;border:1px solid rgba(234,226,210,.2)}
  .pill.study{color:#C9B8FF;border-color:#C9B8FF55} .pill.field{color:#B7EFD4;border-color:#B7EFD455}
  details{margin:6px 0} summary{cursor:pointer;color:#F5F1E8}
</style>
</head>
<body>
<h1>VistaDex Research Console</h1>
<div class="cards" id="cards"></div>

<h2>Study metrics (both conditions joined by participant)</h2>
<p class="muted">H1 calibration: confidence shift per condition (pre &rarr; post; a smaller overconfident shift = better calibration). H3 agreeableness: agreement rate with claims/objections. Verification: evidence links opened.</p>
<table id="participants"></table>

<h2>Event-type coverage <span class="muted">(grows automatically as new telemetry lands)</span></h2>
<table id="types"></table>

<h2>Condition funnel</h2>
<p class="muted">study participants: registered &rarr; baseline done &rarr; vistadex done &rarr; both surveys in</p>
<table id="funnel"></table>

<h2>Latest open-text answers (condition surveys)</h2>
<pre id="quotes">none yet</pre>

<h2>Sessions <span class="muted">(tick + purge removes test/junk sessions: their events and linked traces)</span></h2>
<table id="sessions"></table>
<p><button id="purgeBtn" class="warn">Purge selected sessions</button> <span id="purgeMsg" class="muted"></span></p>

<h2>Download</h2>
<p>
  <a href="/export?table=events&format=csv">&#11015; events.csv</a> &middot;
  <a href="/export?table=events">events.json</a> &middot;
  <a href="/export?table=traces&format=csv">&#11015; traces.csv</a> &middot;
  <a href="/export?table=traces">traces.json</a>
  <br><span class="muted">Downloads also work with curl: Authorization: Bearer &lt;EXPORT_TOKEN&gt;.</span>
</p>
<p><button id="refreshBtn">Refresh</button> <span class="muted">auto-refreshes every 30s</span></p>

<script>
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function showError(msg) { var el = $("quotes"); el.className = "err"; el.textContent = msg; }

  // ── research metrics, computed from raw events ──
  function participantRows(events) {
    // group by session, then stitch participant identity from participant_registered
    var sessions = {};
    events.forEach(function (e) {
      var s = sessions[e.session_id] = sessions[e.session_id] || { ev: [] };
      s.ev.push(e);
    });
    var people = [];
    Object.keys(sessions).forEach(function (sid) {
      var s = sessions[sid];
      var reg = s.ev.find(function (e) { return e.type === "participant_registered"; });
      if (!reg) return; // pre-study test sessions: not participants
      var p = {
        code: reg.payload.code || "(field)",
        role: reg.payload.role || "-",
        track: reg.payload.track || "field",
        sid: sid,
        confPre: null, confPost: null, survey: null,
        claimVotes: [], objVotes: [], sourceClicks: 0,
        firstTs: s.ev[0].ts, lastTs: s.ev[s.ev.length - 1].ts, n: s.ev.length,
      };
      s.ev.forEach(function (e) {
        if (e.type === "confidence_pre") p.confPre = e.payload.value;
        else if (e.type === "confidence_post") p.confPost = e.payload.value;
        else if (e.type === "condition_survey") p.survey = e.payload;
        else if (e.type === "claim_vote") p.claimVotes.push(e.payload);
        else if (e.type === "objection_vote") p.objVotes.push(e.payload);
        else if (e.type === "source_clicked") p.sourceClicks++;
      });
      people.push(p);
    });
    // pair study participants by code across their two condition sessions
    var byCode = {};
    people.forEach(function (p) { (byCode[p.code] = byCode[p.code] || []).push(p); });
    return { people: people, byCode: byCode };
  }

  function render(d) {
    $("cards").innerHTML =
      '<div class="card"><b>' + d.totals.sessions + '</b><span>SESSIONS</span></div>' +
      '<div class="card"><b>' + d.totals.events + '</b><span>EVENTS</span></div>' +
      '<div class="card"><b>' + d.totals.traces + '</b><span>TRACES</span></div>';

    var types = Object.keys(d.events_by_type).sort(function (a, b) { return d.events_by_type[b] - d.events_by_type[a]; });
    $("types").innerHTML = "<tr><th>Type</th><th>Count</th><th>What it measures</th></tr>" +
      types.map(function (t) {
        var meaning = {
          participant_registered: "identity: code, role, track",
          welcome_choice: "walkthrough vs skip",
          view_changed: "navigation",
          screen_time: "engagement per screen",
          control_pressed: "every button press",
          field_edited: "input activity (lengths only)",
          run_started: "screening begins (idea length, role)",
          run_completed: "screening done (counts, duration, trace id)",
          run_failed: "errors",
          claim_expanded: "claim inspection",
          source_clicked: "verification behaviour (H2)",
          claim_vote: "agreeableness (H3)",
          objection_vote: "agreeableness (H3)",
          confidence_pre: "prior confidence (H1)",
          confidence_post: "post confidence (H1 calibration)",
          condition_survey: "trust/usefulness/effort likerts",
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
          consent_given: "consent",
          run_cancelled: "abandonment"
        }[t] || "auto-collected";
        return "<tr><td>" + esc(t) + "</td><td>" + d.events_by_type[t] + "</td><td class='muted'>" + esc(meaning) + "</td></tr>";
      }).join("");

    // study metrics table
    var m = participantRows(d.all_events || d.latest_events);
    var rows = m.people.map(function (p) {
      var track = "<span class='pill " + p.track + "'>" + p.track + "</span>";
      var conf = p.confPre == null ? "-" : (p.confPre + " &rarr; " + (p.confPost == null ? "?" : p.confPost));
      var cal = (p.confPre != null && p.confPost != null) ? (p.confPost - p.confPre) : null;
      var agreeRate = p.claimVotes.length
        ? Math.round(100 * p.claimVotes.filter(function (v) { return v.vote === "agree"; }).length / p.claimVotes.length) + "%"
        : "-";
      var survey = p.survey
        ? "T" + p.survey.trust + "/U" + p.survey.usefulness + "/E" + p.survey.effort
        : "-";
      return "<tr><td>" + track + "</td><td>" + esc(p.code) + "</td><td>" + esc(p.role) + "</td>" +
        "<td>" + conf + (cal != null ? " <span class='muted'>(&Delta;" + (cal > 0 ? "+" : "") + cal + ")</span>" : "") + "</td>" +
        "<td>" + p.claimVotes.length + " votes · " + agreeRate + " agree</td>" +
        "<td>" + p.sourceClicks + " links</td>" +
        "<td>" + survey + "</td>" +
        "<td>" + p.n + " ev</td>" +
        "<td><input type='checkbox' class='sel' value='" + esc(p.sid) + "'></td></tr>";
    });
    $("participants").innerHTML = "<tr><th>Track</th><th>Code</th><th>Role</th><th>Confidence pre &rarr; post</th><th>Agreeableness</th><th>Verification</th><th>Survey</th><th>Events</th><th title='tick to include when purging'>Purge</th></tr>" +
      (rows.length ? rows.join("") : "<tr><td colspan='9' class='muted'>No participants registered yet (participant_registered events appear here).</td></tr>");

    // condition funnel (study track)
    var studyPeople = m.people.filter(function (p) { return p.track === "study"; });
    var baselineDone = studyPeople.filter(function (p) { return p.survey && p.confPost != null && p.code !== "(field)" && p.confPre != null; }).length;
    $("funnel").innerHTML = "<tr><th>Stage</th><th>Count</th></tr>" +
      "<tr><td>Registered (study track)</td><td>" + studyPeople.length + "</td></tr>" +
      "<tr><td class='muted'>Baseline condition completed (survey in)</td><td>" + baselineDone + "</td></tr>" +
      "<tr><td class='muted'>VistaDex condition completed (survey in)</td><td class='muted'>(see confidence_post + condition_survey rows per participant)</td></tr>";

    // quotes: field/study open text is in feedback_submitted (unlinked) — show latest events feed instead
    $("quotes").textContent = d.latest_events.map(function (e) {
      return e.ts.slice(11, 19) + " " + e.type + " " + JSON.stringify(e.payload).slice(0, 100);
    }).join("\\n") || "(no events yet)";

    // sessions table (all, incl. pre-study test sessions)
    $("sessions").innerHTML = "<tr><th></th><th>Session</th><th>Events</th><th>First seen</th><th>Last seen</th><th>Top types</th></tr>" +
      d.sessions.map(function (s) {
        var top = Object.keys(s.types).sort(function (a, b) { return s.types[b] - s.types[a]; }).slice(0, 3)
          .map(function (t) { return t + ":" + s.types[t]; }).join(" ");
        return "<tr><td><input type='checkbox' class='sel' value='" + esc(s.session_id) + "'></td>" +
          "<td>" + esc(s.session_id.slice(0, 13)) + "&hellip;</td>" +
          "<td>" + s.events + "</td>" +
          "<td>" + esc(s.first.slice(0, 19)) + "</td>" +
          "<td>" + esc(s.last.slice(0, 19)) + "</td>" +
          "<td>" + esc(top) + "</td></tr>";
      }).join("");
  }

  function load() {
    fetch("/research/data?full=1", { cache: "no-store" }).then(function (r) {
      if (r.status === 401) { showError("401 — not logged in. Open /research?t=YOUR_TOKEN to log in."); return null; }
      if (r.status !== 200) {
        return r.text().then(function (body) { showError("Data fetch failed: HTTP " + r.status + "\\n" + body.slice(0, 200)); return null; });
      }
      return r.json();
    }).then(function (d) { if (d) render(d); })
      .catch(function (e) { showError("Network error: " + e.message); });
  }

  $("purgeBtn").onclick = function () {
    var ids = Array.prototype.slice.call(document.querySelectorAll(".sel:checked")).map(function (c) { return c.value; });
    if (!ids.length) { $("purgeMsg").textContent = "select sessions first"; return; }
    if (!window.confirm("Delete " + ids.length + " session(s) and their traces? This cannot be undone.")) return;
    fetch("/research/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_ids: ids })
    }).then(function (r) { return r.json(); }).then(function (d) {
      $("purgeMsg").textContent = d.ok ? "purged " + d.purged + " session(s)" : "failed: " + JSON.stringify(d);
      load();
    }).catch(function (e) { $("purgeMsg").textContent = "network error: " + e.message; });
  };
  $("refreshBtn").onclick = load;
  load();
  window.setInterval(load, 30000);
})();
</script>
</body>
</html>`;
