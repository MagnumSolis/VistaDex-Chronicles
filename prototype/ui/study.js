// ── study.js — Research instrumentation for the Screen-an-Idea flow ──
// Consent gate, pre/post trust sliders, per-claim agreement, end survey, and
// interaction telemetry. Every log() call is a no-op without consent.

import { esc } from "./escape.js";
import * as tm from "./telemetry.js";
import { CONSENT, TRUST_PRE, TRUST_POST, SCALE, CLAIM_RATING, SURVEY } from "./study-config.js";

let runCount = 0;
let current = null; // { id, visibleMs, since, seen: Set }
let activeView = "dashboard";

const $ = id => document.getElementById(id);
const participating = () => tm.consentStatus() === "given";
const trustPreDone = () => tm.events().some(e => e.type === "trust_pre");

// ── Setup ─────────────────────────────────────────────────────────────
export function initStudy() {
  renderStudyBar();
  renderTrustPre();
  const report = $("reportView");
  report.addEventListener("click", onReportClick);
  report.addEventListener("focusout", e => {
    if (e.target.matches(".notes-box") && current) tm.log("notes_edited", { run_id: current.id, chars: e.target.value.length });
  });
  document.addEventListener("visibilitychange", () => (document.visibilityState === "visible" ? resumeTimer() : pauseTimer()));
  addEventListener("pagehide", () => endReportTimer("page_hidden"));
}

export function onViewChanged(view) {
  if (view === activeView) return;
  if (activeView === "screen") pauseTimer();
  activeView = view;
  if (view === "screen") resumeTimer();
  tm.log("view_changed", { view });
  if (view === "screen" && tm.consentStatus() === null) showConsent();
}

export function onCohortReportOpened(ideaId) {
  tm.log("demo_report_opened", { idea_id: ideaId });
}

// ── Consent ───────────────────────────────────────────────────────────
function showConsent() {
  $("consentBox").innerHTML = `
    <div class="consent">
      <h2 class="consent-title">${esc(CONSENT.title)}</h2>
      ${CONSENT.paragraphs.map(p => `<p>${esc(p)}</p>`).join("")}
      <div class="consent-actions">
        <button class="btn-ghost" id="consentDecline">${esc(CONSENT.decline)}</button>
        <button class="btn-primary" id="consentAgree">${esc(CONSENT.agree)}</button>
      </div>
    </div>`;
  $("consentModal").style.display = "flex";
  $("consentAgree").onclick = () => { tm.giveConsent(); closeConsent(); };
  $("consentDecline").onclick = () => { tm.declineConsent(); closeConsent(); };
}

function closeConsent() {
  $("consentModal").style.display = "none";
  renderStudyBar();
  renderTrustPre();
}

function renderStudyBar() {
  const bar = $("studyBar");
  const status = tm.consentStatus();
  if (status === "given") {
    bar.innerHTML = `
      <span>🧪 Study session <strong class="mono">${esc(tm.sessionCode())}</strong> — anonymous</span>
      <span class="study-actions">
        <button class="link-btn" data-study="export-json">Download my data (JSON)</button>
        <button class="link-btn" data-study="export-csv">CSV</button>
        <button class="link-btn danger" data-study="withdraw">Withdraw &amp; delete my data</button>
      </span>`;
  } else if (status === "declined") {
    bar.innerHTML = `<span>Not taking part in the study — nothing is recorded.</span>
      <span class="study-actions"><button class="link-btn" data-study="reconsider">Read the study information</button></span>`;
  } else {
    bar.innerHTML = "";
  }
  bar.style.display = status ? "flex" : "none";
  bar.onclick = async e => {
    const action = e.target.closest("[data-study]")?.dataset.study;
    if (action === "export-json") tm.exportJSON();
    if (action === "export-csv") tm.exportCSV();
    if (action === "reconsider") showConsent();
    if (action === "withdraw") {
      if (!confirm("Withdraw from the study? This deletes your data from this browser and asks our server to delete it.")) return;
      endReportTimer("withdrawn");
      const res = await tm.withdraw();
      document.querySelectorAll(".rating-row, .finish-card").forEach(n => n.remove());
      renderStudyBar();
      renderTrustPre();
      alert(res.server === "failed (network)" || res.server.startsWith("failed")
        ? `Your local data is deleted. The server could not be reached (${res.server}); please tell the VistaDex team your session code ${res.session_id?.slice(0, 8).toUpperCase()} so they can delete it.`
        : "You have withdrawn. Your data has been deleted.");
    }
  };
}

// ── Trust sliders ─────────────────────────────────────────────────────
function sliderHTML(id, cfg) {
  return `
    <div class="trust-slider">
      <label class="input-label" for="${id}">${esc(cfg.prompt)}</label>
      <input type="range" id="${id}" class="untouched" min="${SCALE.min}" max="${SCALE.max}" step="1" value="${(SCALE.min + SCALE.max) / 2}" />
      <div class="slider-ends"><span>${SCALE.min} · ${esc(cfg.low)}</span><span class="slider-value" id="${id}-value">move the slider</span><span>${SCALE.max} · ${esc(cfg.high)}</span></div>
    </div>`;
}

function wireSlider(id, onSet) {
  const el = $(id);
  const set = () => {
    el.classList.remove("untouched");
    $(`${id}-value`).textContent = `your answer: ${el.value}`;
  };
  el.addEventListener("input", set);
  el.addEventListener("change", () => { set(); onSet(Number(el.value)); });
}

function renderTrustPre() {
  const box = $("trustPre");
  if (!participating() || trustPreDone()) { box.style.display = "none"; box.innerHTML = ""; return; }
  box.innerHTML = sliderHTML("trustPreInput", TRUST_PRE);
  box.style.display = "block";
  wireSlider("trustPreInput", value => {
    tm.log("trust_pre", { value, scale: [SCALE.min, SCALE.max] });
    box.classList.remove("needs-answer");
  });
}

// Participants answer the pre-use trust question before their first run.
export function canRun() {
  if (!participating() || trustPreDone()) return true;
  const box = $("trustPre");
  box.classList.add("needs-answer");
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  return false;
}

// ── Runs ──────────────────────────────────────────────────────────────
export function runStarted({ ideaText, mode }) {
  endReportTimer("new_run");
  renderTrustPre(); // hides the pre-use slider once answered, so it can't change after a report is seen
  const id = `r${++runCount}`;
  tm.log("run_started", { run_id: id, mode, idea_chars: ideaText.length });
  return id;
}

export function runFailed(runId, err) {
  tm.log("run_failed", { run_id: runId, error: String(err?.message || err).slice(0, 300) });
}

export function runCompleted(runId, { report, trace, traceId, mode }, durationMs) {
  tm.log("run_completed", {
    run_id: runId, trace_id: traceId, mode, duration_ms: durationMs,
    idea_text: report.idea_text, report, trace: trace || null,
  });
  if (!participating()) return;
  current = { id: runId, visibleMs: 0, since: null, seen: new Set() };
  resumeTimer();
  decorateClaims(report);
  observePanels();
  appendFinishCard(runId);
}

// ── Per-claim agreement ───────────────────────────────────────────────
function decorateClaims(report) {
  document.querySelectorAll("#reportView .claim-card").forEach(card => {
    const i = Number(card.dataset.claimIndex);
    const row = document.createElement("div");
    row.className = "rating-row";
    row.innerHTML = `<span class="rating-prompt">${esc(CLAIM_RATING.prompt)}</span>` +
      CLAIM_RATING.options.map(o => `<button class="rating-btn" data-rating="${esc(o.value)}" data-claim="${i}">${esc(o.label)}</button>`).join("");
    row.dataset.type = report.claims[i]?.type || "";
    row.dataset.status = report.claims[i]?.status || "";
    card.appendChild(row);
  });
}

function onReportClick(e) {
  if (!current) return;
  const rating = e.target.closest(".rating-btn");
  if (rating) {
    const row = rating.parentElement;
    row.querySelectorAll(".rating-btn").forEach(b => b.classList.toggle("active", b === rating));
    tm.log("claim_rating", {
      run_id: current.id, claim_index: Number(rating.dataset.claim),
      claim_type: row.dataset.type, status: row.dataset.status, rating: rating.dataset.rating,
    });
    return;
  }
  const toggle = e.target.closest(".evidence-toggle");
  if (toggle) {
    const card = toggle.closest(".claim-card");
    tm.log("claim_expanded", { run_id: current.id, claim_index: Number(card.dataset.claimIndex), expanded: card.classList.contains("expanded") });
    return;
  }
  const link = e.target.closest("a[data-source-url]");
  if (link) {
    tm.log("source_clicked", { run_id: current.id, claim_index: Number(link.closest(".claim-card")?.dataset.claimIndex), url: link.getAttribute("href") });
  }
}

function observePanels() {
  if (!("IntersectionObserver" in window)) return;
  const run = current;
  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting || run !== current) continue;
      const name = en.target.classList.contains("objector-panel") ? "objections_viewed" : "graveyard_viewed";
      if (run.seen.has(name)) continue;
      run.seen.add(name);
      tm.log(name, { run_id: run.id, ms_after_report: run.visibleMs + (run.since ? performance.now() - run.since : 0) | 0 });
      io.unobserve(en.target);
    }
  }, { threshold: 0.5 });
  document.querySelectorAll("#reportView .objector-panel, #reportView .graveyard-panel").forEach(p => io.observe(p));
}

// ── Time on report (counts only while the page and Screen view are visible) ──
function resumeTimer() {
  if (current && !current.since && activeView === "screen" && document.visibilityState === "visible") current.since = performance.now();
}
function pauseTimer() {
  if (current?.since) { current.visibleMs += performance.now() - current.since; current.since = null; }
}
function endReportTimer(reason) {
  if (!current) return;
  pauseTimer();
  tm.log("report_time", { run_id: current.id, visible_ms: Math.round(current.visibleMs), ended_by: reason });
  current = null;
}

// ── Post-use trust + survey ───────────────────────────────────────────
function appendFinishCard(runId) {
  const scaleRow = item => `
    <fieldset class="likert">
      <legend>${esc(item.text)}</legend>
      <div class="likert-options">
        <span class="likert-end">Strongly disagree</span>
        ${Array.from({ length: SCALE.max - SCALE.min + 1 }, (_, k) => SCALE.min + k)
          .map(v => `<label><input type="radio" name="sv-${esc(item.id)}" value="${v}" /><span>${v}</span></label>`).join("")}
        <span class="likert-end">Strongly agree</span>
      </div>
    </fieldset>`;
  const card = document.createElement("div");
  card.className = "card finish-card";
  card.innerHTML = `
    <div class="section-title">Finished reviewing? Tell us what you think</div>
    ${sliderHTML("trustPostInput", TRUST_POST)}
    <div class="section-title" style="margin-top:8px;">${esc(SURVEY.title)}</div>
    ${SURVEY.likert.map(scaleRow).join("")}
    <label class="input-label" for="surveyComments">${esc(SURVEY.freeText.text)}</label>
    <textarea id="surveyComments" class="notes-box" maxlength="2000"></textarea>
    <div class="finish-actions">
      <span class="finish-hint" id="finishHint">Answer the slider and all ${SURVEY.likert.length} statements to submit.</span>
      <button class="btn-primary" id="finishSubmit" disabled>Submit</button>
    </div>`;
  $("reportView").appendChild(card);

  let trustPost = null;
  const ready = () => trustPost !== null && SURVEY.likert.every(it => card.querySelector(`input[name="sv-${it.id}"]:checked`));
  const refresh = () => { $("finishSubmit").disabled = !ready(); };
  wireSlider("trustPostInput", v => { trustPost = v; refresh(); });
  card.addEventListener("change", refresh);
  $("finishSubmit").onclick = () => {
    if (!ready()) return;
    const answers = Object.fromEntries(SURVEY.likert.map(it => [it.id, Number(card.querySelector(`input[name="sv-${it.id}"]:checked`).value)]));
    tm.log("trust_post", { run_id: runId, value: trustPost, scale: [SCALE.min, SCALE.max] });
    tm.log("survey_submitted", { run_id: runId, answers, [SURVEY.freeText.id]: $("surveyComments").value.trim() });
    endReportTimer("survey_submitted");
    tm.flush();
    card.innerHTML = `
      <div class="section-title">Thank you!</div>
      <div class="claim-reasoning">Your answers are saved under session code <strong class="mono">${esc(tm.sessionCode())}</strong>. You can screen another idea, download your data, or withdraw at any time from the bar at the top.</div>`;
  };
}
