// ── app.js — VistaDex Prototype UI Controller ────────────────────────

import { GRAVEYARD_DB } from "../data/graveyard.js";
import { COHORT_IDEAS, SAMPLE_IDEA } from "../data/cohort.js";
import { esc } from "./escape.js";
import { renderReportBody, renderCountChips, renderEvidenceLine, sourceCount, statusCounts } from "./report.js";
import { screenIdea, liveMode } from "./client.js";
import * as study from "./study.js";

// ── State ─────────────────────────────────────────────────────────────
let currentStatusFilter = "all";
let currentCauseFilter = "all";
let pipelineRunning = false;

// Fixed per-stage animation time so progress is readable (no random jitter).
const STAGE_ANIMATION_MS = 600;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── View Router ───────────────────────────────────────────────────────
function showView(viewName) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`view-${viewName}`).classList.add("active");
  document.getElementById(`nav-${viewName}`)?.classList.add("active");
  study.onViewChanged(viewName);
}

// ── Dashboard ─────────────────────────────────────────────────────────
function renderTable(ideas) {
  const tbody = document.getElementById("tableBody");
  if (!tbody) return;
  tbody.innerHTML = ideas.map(idea => {
    const report = cohortReport(idea);
    const lead = report.graveyard_matches[0];
    const graveyardCell = lead
      ? `<span class="graveyard-match"><strong>${esc(lead.company_name)}</strong><br><span style="font-size:0.75rem;color:var(--text-muted)">verify yourself</span></span>`
      : `<span style="color:var(--text-muted);font-size:0.82rem;">—</span>`;
    const sources = report.claims.reduce((n, c) => n + sourceCount(c.source_urls), 0);
    return `
      <tr data-idea-id="${esc(idea.id)}" style="cursor:pointer;">
        <td>
          <div class="idea-name">${esc(idea.name)}</div>
          <div class="idea-desc">${esc(idea.desc)}</div>
        </td>
        <td class="submitter">${esc(idea.submitter)}</td>
        <td><span class="category-tag">${esc(idea.category)}</span></td>
        <td><div class="count-chips">${renderCountChips(report, { includeGraveyard: false })}</div></td>
        <td>${graveyardCell}</td>
        <td><span class="conf-pct">${report.claims.length} claims · ${sources} sources</span></td>
        <td><button class="btn-ghost btn-view">View →</button></td>
      </tr>`;
  }).join("");
}

function renderStats() {
  const reports = COHORT_IDEAS.map(cohortReport);
  const withStatus = s => reports.filter(r => r.claims.some(c => c.status === s)).length;
  const cards = [
    ["blue", COHORT_IDEAS.length, "Demo ideas"],
    ["red", withStatus("contradicted"), "With a contradicted claim"],
    ["amber", withStatus("disputed"), "With a disputed claim"],
    ["purple", reports.filter(r => r.graveyard_matches.length).length, "With a graveyard lead"],
  ];
  document.getElementById("statGrid").innerHTML = cards.map(([color, value, label]) => `
    <div class="stat-card">
      <div class="stat-icon ${color}"></div>
      <div class="stat-body">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${esc(label)}</div>
      </div>
    </div>`).join("");
  document.getElementById("dashSubtitle").innerHTML =
    `<span class="demo-tag">Demo data</span> ${COHORT_IDEAS.length} hand-written example ideas — not real submissions, statuses not re-checked`;
}

function filterTable() {
  const q = document.getElementById("dashSearch")?.value.toLowerCase() || "";
  const filtered = sortedCohort().filter(idea => {
    const report = cohortReport(idea);
    const matchStatus = currentStatusFilter === "all"
      || (currentStatusFilter === "graveyard" ? report.graveyard_matches.length > 0 : report.claims.some(c => c.status === currentStatusFilter));
    const matchSearch = !q || [idea.name, idea.submitter, idea.category, idea.desc].some(s => s.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });
  renderTable(filtered);
}

function filterStatus(btn, status) {
  currentStatusFilter = status;
  document.querySelectorAll("#view-dashboard .filter-pills .pill").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  filterTable();
}

// Ideas with the most contradicted + disputed claims first; ties by name.
function sortedCohort() {
  const weight = idea => { const n = statusCounts(idea.claims); return n.contradicted + n.disputed; };
  return [...COHORT_IDEAS].sort((a, b) => weight(b) - weight(a) || a.name.localeCompare(b.name));
}

// Cohort entries are stored in the contract shape, with graveyard leads by id.
function cohortReport(idea) {
  return {
    idea_text: idea.desc,
    claims: idea.claims,
    graveyard_matches: (idea.graveyard || [])
      .map(g => ({ ...GRAVEYARD_DB.find(e => e.id === g.id), similarity: g.similarity }))
      .filter(m => m.company_name),
    objections: idea.objections,
  };
}

// ── Idea Modal ────────────────────────────────────────────────────────
function openIdeaModal(ideaId) {
  const idea = COHORT_IDEAS.find(i => i.id === ideaId);
  if (!idea) return;
  const report = cohortReport(idea);
  study.onCohortReportOpened(ideaId);
  document.getElementById("modalContent").innerHTML = `
    <div class="report-header">
      <div class="report-meta">
        <span class="demo-tag">Demo data</span>
        <span class="category-tag">${esc(idea.category)}</span>
        <span style="color:var(--text-muted);font-size:0.82rem;">Submitted by ${esc(idea.submitter)} (fictional)</span>
      </div>
      <div class="report-title">${esc(idea.name)}</div>
      <div style="color:var(--text-secondary);font-size:0.875rem;">${esc(idea.desc)}</div>
      <div class="count-chips" style="margin-top:10px;">${renderCountChips(report)}</div>
      <div class="report-footer-line">${renderEvidenceLine(report)} · demo statuses were hand-written and not re-checked</div>
    </div>
    <div class="report-body">${renderReportBody(report, { notesPlaceholder: "Add your own notes — these feed the accuracy feedback loop…" })}</div>`;
  document.getElementById("reportModal").style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeModal(e) {
  if (e.target.id === "reportModal") closeModalDirect();
}
function closeModalDirect() {
  document.getElementById("reportModal").style.display = "none";
  document.body.style.overflow = "";
}

// ── Screen a New Idea ─────────────────────────────────────────────────
function loadSample() {
  document.getElementById("ideaInput").value = SAMPLE_IDEA;
}

function setStage(n, state, statusText) {
  const el = document.getElementById(`stage${n}`);
  const statusEl = document.getElementById(`s${n}-status`);
  if (!el) return;
  el.className = `stage-track ${state}`;
  statusEl.textContent = state === "running" ? "running…" : state === "done" ? (statusText || "done") : "idle";
}

async function animateStage(n, state, text) {
  setStage(n, state, text);
  if (state === "running") await sleep(STAGE_ANIMATION_MS);
}

const RUN_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Pipeline`;
const SPIN_ICON = `<svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Running…`;

async function runPipeline() {
  if (pipelineRunning) return;
  const ideaText = document.getElementById("ideaInput").value.trim();
  if (!ideaText) {
    alert("Please paste an idea first.");
    return;
  }
  if (!study.canRun()) return;
  pipelineRunning = true;
  const runBtn = document.getElementById("runBtn");
  runBtn.disabled = true;
  runBtn.innerHTML = SPIN_ICON;
  for (let i = 1; i <= 4; i++) setStage(i, "idle");
  document.getElementById("resultsPanel").style.display = "none";
  document.getElementById("reportView").innerHTML = "";

  const runId = study.runStarted({ ideaText, mode: liveMode() ? "live" : "mock" });
  const t0 = performance.now();
  try {
    const result = await screenIdea(ideaText, { onStage: animateStage });
    renderLiveReport(result);
    study.runCompleted(runId, result, Math.round(performance.now() - t0));
  } catch (err) {
    console.error(err);
    study.runFailed(runId, err);
    renderError(err);
  } finally {
    pipelineRunning = false;
    runBtn.disabled = false;
    runBtn.innerHTML = RUN_ICON;
  }
}

function renderError(err) {
  document.getElementById("reportView").innerHTML = `
    <div class="card" style="border-color:var(--red);">
      <div class="section-title">The screening run failed</div>
      <div class="claim-reasoning">${esc(err.message)}</div>
    </div>`;
  document.getElementById("resultsPanel").style.display = "block";
}

function renderLiveReport({ report, mode }) {
  document.getElementById("reportView").innerHTML = `
    <div class="report-header" style="animation:modal-in 0.3s ease;">
      <div class="report-meta">
        <span style="color:var(--text-muted);font-size:0.82rem;">${mode === "live" ? "Live pipeline run" : "Key-free mock run — no live evidence, so claims stay unverified"}</span>
      </div>
      <div class="report-title">Screening Report</div>
      <div style="color:var(--text-secondary);font-size:0.845rem;margin-top:4px;line-height:1.5;">${esc(report.idea_text.slice(0, 120))}…</div>
      <div class="count-chips" style="margin-top:10px;">${renderCountChips(report)}</div>
      <div class="report-footer-line">${renderEvidenceLine(report)} · you make the decision</div>
    </div>
    <div class="report-body" style="animation:modal-in 0.35s 0.05s both ease;">${renderReportBody(report)}</div>`;
  document.getElementById("resultsPanel").style.display = "block";
}

// ── Graveyard DB View ─────────────────────────────────────────────────
function renderGraveyard(entries) {
  const grid = document.getElementById("graveyardGrid");
  if (!grid) return;
  grid.innerHTML = entries.map(entry => `
    <div class="gyard-entry">
      <div class="gyard-top">
        <div class="gyard-name">${esc(entry.company_name)}</div>
        <div class="gyard-year">${esc(entry.year_closed)}</div>
      </div>
      <div class="gyard-tried">${esc(entry.what_they_tried)}</div>
      <div class="gyard-footer">
        <span class="cause-badge cause-${esc(entry.cause_category)}">${causeCategoryLabel(entry.cause_category)}</span>
        <span class="gyard-sources">${esc(entry.raised || "n/a raised")}</span>
      </div>
    </div>`).join("");
}

function causeCategoryLabel(cat) {
  const map = {
    "unit-economics": "💸 Unit Economics",
    "timing":         "⏱ Bad Timing",
    "competition":    "⚔️ Competition",
    "regulation":     "⚖️ Regulation",
    "team":           "👥 Team",
    "pivot":          "🔄 Pivot / Acquired",
  };
  return map[cat] || esc(cat);
}

function filterGraveyard() {
  const q = document.getElementById("graveyardSearch")?.value.toLowerCase() || "";
  const filtered = GRAVEYARD_DB.filter(e => {
    const matchCause = currentCauseFilter === "all" || e.cause_category === currentCauseFilter;
    const matchSearch = !q || [e.company_name, e.what_they_tried, e.cause_of_death].some(s => s.toLowerCase().includes(q));
    return matchCause && matchSearch;
  });
  renderGraveyard(filtered);
}

function filterCause(btn, cause) {
  currentCauseFilter = cause;
  document.querySelectorAll("#view-graveyard .filter-pills .pill").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  filterGraveyard();
}

// ── Init ──────────────────────────────────────────────────────────────
// Inline onclick handlers in index.html call these.
Object.assign(window, { showView, filterTable, filterStatus, openIdeaModal, closeModal, closeModalDirect, loadSample, runPipeline, filterGraveyard, filterCause });

document.addEventListener("keydown", e => { if (e.key === "Escape") closeModalDirect(); });
study.initStudy();
document.getElementById("tableBody").addEventListener("click", e => {
  const row = e.target.closest("tr[data-idea-id]");
  if (row) openIdeaModal(row.dataset.ideaId);
});
document.getElementById("modeBadge").textContent = liveMode() ? "Live providers (proxy)" : "Key-free mock mode";
renderStats();
renderTable(sortedCohort());
document.getElementById("graveyardCount").textContent = `${GRAVEYARD_DB.length} seed entries`;
renderGraveyard(GRAVEYARD_DB);
