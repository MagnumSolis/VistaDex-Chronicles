// research-page.js — the research console's HTML, kept out of index.js so the
// embedded <script> does not fight JS template-literal escaping. Served as a
// plain string; the page's own JS talks to /research/data and /research/purge.
export const RESEARCH_PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>VistaDex &middot; Research Console</title>
<meta name="robots" content="noindex">
<style>
  body{font-family:ui-monospace,monospace;background:#0A2622;color:#F5F1E8;margin:0;padding:40px;font-size:13px}
  h1{font-size:18px} h2{font-size:14px;color:#FF9E4A;margin:30px 0 8px}
  table{border-collapse:collapse;width:100%;margin:8px 0}
  td,th{border:1px solid rgba(234,226,210,.13);padding:7px 12px;text-align:left;font-size:12px}
  th{color:#A9B5AC}
  .cards{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
  .card{background:#10312B;border:1px solid rgba(234,226,210,.13);border-radius:12px;padding:16px 20px}
  .card b{font-size:24px;display:block} .card span{color:#A9B5AC;font-size:10px;letter-spacing:.08em}
  a{color:#FF9E4A}
  button{font-family:inherit;font-size:11px;padding:5px 10px;border-radius:7px;border:1px solid rgba(234,226,210,.2);background:#143A33;color:#F5F1E8;cursor:pointer}
  pre{background:#10312B;border:1px solid rgba(234,226,210,.13);border-radius:10px;padding:12px;overflow:auto;max-height:300px;font-size:11px;white-space:pre-wrap}
  .muted{color:#A9B5AC} .warn{color:#FFB000}
  .err{color:#FF5A5A;white-space:pre-wrap}
</style>
</head>
<body>
<h1>VistaDex Research Console</h1>
<div class="cards" id="cards"></div>
<h2>Events by type</h2><table id="types"></table>
<h2>Sessions <span class="muted">(tick + purge removes test/junk sessions: their events and linked traces)</span></h2>
<table id="sessions"></table>
<p><button id="purgeBtn" class="warn">Purge selected sessions</button> <span id="purgeMsg" class="muted"></span></p>
<h2>Latest 50 events</h2><pre id="latest">loading&hellip;</pre>
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
  function showError(msg) {
    var el = $("latest");
    el.className = "err";
    el.textContent = msg;
  }
  function render(d) {
    $("cards").innerHTML =
      '<div class="card"><b>' + d.totals.sessions + '</b><span>SESSIONS</span></div>' +
      '<div class="card"><b>' + d.totals.events + '</b><span>EVENTS</span></div>' +
      '<div class="card"><b>' + d.totals.traces + '</b><span>TRACES</span></div>';
    var types = Object.keys(d.events_by_type).sort(function (a, b) { return d.events_by_type[b] - d.events_by_type[a]; });
    $("types").innerHTML = "<tr><th>Type</th><th>Count</th></tr>" +
      types.map(function (t) { return "<tr><td>" + esc(t) + "</td><td>" + d.events_by_type[t] + "</td></tr>"; }).join("");
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
    var el = $("latest");
    el.className = "";
    el.textContent = d.latest_events.map(function (e) {
      return e.ts.slice(11, 19) + " " + e.type + " " + JSON.stringify(e.payload).slice(0, 80);
    }).join("\\n") || "(no events yet)";
  }
  function load() {
    fetch("/research/data", { cache: "no-store" }).then(function (r) {
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
