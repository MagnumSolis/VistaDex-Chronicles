// ── telemetry/index.ts — The only module in the React app that talks to prototype/ui/telemetry.js ──
// Public edition: after the Welcome notice, every interactive control and the time spent per screen,
// per report section and per walkthrough step are logged (contract: tests/fixtures/event-contract.json).
// Pitch edition (features.telemetry false): telemetry.js is disabled at startup — nothing is logged and
// nothing is uploaded, including anything an earlier public visit left unsent in this browser.
// No idea text or report content is logged; runs are described by lengths and counts only.

import * as tm from "@proto/ui/telemetry.js";
import { currentParticipant, registerFieldParticipant } from "@/study/participant";
import { visitSource } from "@/lib/source";
import { features } from "@/edition";
import type { ClaimStatus, ClaimType, IdeaInput, Report, RunMode } from "@/types";
import { isControl, type ControlId } from "./controls";

if (!features.telemetry) tm.disable();

// ── change notifications for React (notice / recording state) ──
const listeners = new Set<() => void>();
let version = 0;
const changed = () => { version++; listeners.forEach(l => l()); };
export function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export const getVersion = () => version;

export function track(type: string, payload: Record<string, unknown> = {}) {
  if (!features.telemetry) return null;
  return tm.log(type, payload);
}

/** Pre-run prior confidence for a VistaDex/field run, logged with the real run id (H1 calibration). */
// The pre-run slider. An untouched slider logs its starting 50 with moved: false.
export function logConfidencePreRun(runId: string, { value, moved }: { value: number; moved: boolean }) {
  track("confidence_pre", { condition: "vistadex", value, run_id: runId, moved });
}

// ── Welcome notice ──
export const noticeAnswered = () => !features.welcome || tm.consentStatus() !== null;
export const recording = () => features.telemetry && tm.consentStatus() === "given";
export const sessionCode = (): string | null => (recording() ? tm.sessionCode() : null);

/** The visitor went past the notice: recording starts now (never before).
 * Every consenting visitor is automatically enrolled in the study (field
 * track) — there is no separate sign-up step. The Welcome notice is the
 * consent, exactly like a cookie banner. */
export function acceptNotice(choice: "walkthrough" | "skip") {
  if (!features.telemetry) return;
  tm.giveConsent();
  track("welcome_choice", { choice });
  const p = currentParticipant() ?? registerFieldParticipant(null);
  track("participant_registered", { code: p.code, role: p.role, track: p.track, source: visitSource() });
  changed();
}
/** "Use without recording": remembered locally, nothing is ever logged or sent. */
export function declineRecording() {
  tm.declineConsent();
  changed();
}
/** Deletes this browser's events and asks the server to delete the session (and its linked traces). */
export async function deleteSession() {
  endReport("withdrawn");
  const res = (await tm.withdraw()) as { session_id: string | null; server: string };
  changed();
  return res;
}
export const sendFeedback = (answers: Record<string, unknown>) => tm.sendUnlinked("feedback_submitted", answers) as Promise<string>;

// ── every button press / interactive control ──
// Controls carry data-control="<id>" (ids in ./controls.ts, listed in the contract) and optionally
// data-control-value="<enum value>". One capturing listener logs them; text fields log their length
// (never their content) when the visitor leaves them.
let currentScreen = "";
let installed = false;
export function installControlTracking() {
  if (installed || !features.telemetry) return;
  installed = true;
  document.addEventListener("click", e => {
    const el = (e.target as Element | null)?.closest?.("[data-control]") as HTMLElement | null;
    if (!el) return;
    const control = el.dataset.control!;
    if (!isControl(control)) { console.warn(`telemetry: unregistered control "${control}"`); return; }
    // Text fields report field_edited (length only) when left, not a press; selects report their change.
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && ["text", "search", "email"].includes(el.type))) return;
    const value = el.dataset.controlValue;
    track("control_pressed", { control, screen: currentScreen, ...(value !== undefined ? { value } : {}) });
  }, true);
  document.addEventListener("change", e => {
    const el = e.target as HTMLElement | null;
    if (!(el instanceof HTMLSelectElement)) return;
    const control = el.dataset.control;
    if (!control || !isControl(control)) return;
    track("control_pressed", { control, screen: currentScreen, value: el.value });
  }, true);
  document.addEventListener("focusout", e => {
    const el = e.target as HTMLElement | null;
    if (!(el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && ["text", "search", "email"].includes(el.type)))) return;
    const control = el.dataset.control;
    if (!control || !isControl(control)) return;
    track("field_edited", { control, screen: currentScreen, chars: el.value.length });
  }, true);
}

// ── time per screen (counts only while the tab is visible) ──
let screenSince: number | null = null;
let screenMs = 0;
const visible = () => document.visibilityState === "visible";
function pauseScreen() { if (screenSince !== null) { screenMs += performance.now() - screenSince; screenSince = null; } }
function resumeScreen() { if (screenSince === null && visible()) screenSince = performance.now(); }
function endScreen(ended_by: "navigate" | "page_hidden") {
  pauseScreen();
  if (currentScreen) track("screen_time", { screen: currentScreen, visible_ms: Math.round(screenMs), ended_by });
  screenMs = 0;
}
export function screenChanged(screen: string) {
  if (screen === currentScreen) return;
  endScreen("navigate");
  currentScreen = screen;
  track("view_changed", { view: screen });
  resumeScreen();
  if (screen === "report") resumeReport(); else pauseReport();
}
export const getScreen = () => currentScreen;

// ── runs ──
// Field lengths and selections only — never the text.
export function runStarted({ input, ideaChars, mode, sample }: { input: IdeaInput; ideaChars: number; mode: "mock" | "live"; sample: string | null }) {
  endReport("new_run");
  // Random, so (session_id, run_id) stays unique across reloads and tabs: the session id persists in
  // localStorage, and the old r1, r2… counter restarted on every page load. 12 hex of a v4 UUID are all random.
  const id = `r_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const field_chars = { title: input.title.length, pitch: input.pitch.length, problem: input.problem.length, solution: input.solution.length, moat: input.moat.length };
  track("run_started", { run_id: id, mode, idea_chars: ideaChars, field_chars, industries: input.industries, role: input.role, markets: input.markets, sample });
  return id;
}
export function runFailed(runId: string, code: string, message: string) {
  track("run_failed", { run_id: runId, code, error: message.slice(0, 300) });
}
export function runCancelled(runId: string, stage: string) {
  track("run_cancelled", { run_id: runId, stage });
}
// Counts only — the idea text and the report content are not logged (the claims paraphrase the idea).
export function reportCounts(report: Report) {
  const by = <K extends string>(keys: readonly K[], pick: (c: Report["claims"][number]) => string) =>
    Object.fromEntries(keys.map(k => [k, report.claims.filter(c => pick(c) === k).length])) as Record<K, number>;
  return {
    claims: report.claims.length,
    statuses: by(["confirmed", "contradicted", "disputed", "unverified"] as const, c => c.status),
    types: by(["novelty", "market_size", "defensibility", "traction", "other"] as const, c => c.type),
    graveyard_matches: report.graveyard_matches.length,
    objections: report.objections.length,
    legal: Boolean(report.legal),
    market: Boolean(report.market),
  };
}
export function runCompleted(runId: string, { report, traceId, mode }: { report: Report; traceId: string | null; mode: RunMode }, durationMs: number) {
  // trace_id stays: withdrawing deletes the server-side trace linked through it.
  track("run_completed", { run_id: runId, trace_id: traceId, mode, duration_ms: durationMs, counts: reportCounts(report) });
  report_ = { id: runId, since: null, visibleMs: 0, seen: new Set() };
  if (currentScreen === "report") resumeReport();
}

// ── the report on screen: total visible time, first view of panels, time per section ──
type ReportRun = { id: string; since: number | null; visibleMs: number; seen: Set<string> };
let report_: ReportRun | null = null;
const sectionMs = new Map<string, number>();
function resumeReport() { if (report_ && report_.since === null && visible() && currentScreen === "report") report_.since = performance.now(); }
function pauseReport() { if (report_?.since != null) { report_.visibleMs += performance.now() - report_.since; report_.since = null; } }
const msAfterReport = () => (report_ ? Math.round(report_.visibleMs + (report_.since != null ? performance.now() - report_.since : 0)) : 0);
function endReport(ended_by: "new_run" | "page_hidden" | "withdrawn") {
  if (!report_) return;
  pauseReport();
  sectionClocks.forEach((_, key) => stopSection(key));
  for (const [key, ms] of sectionMs) {
    const [runId, section] = key.split(":");
    if (ms > 0) track("section_time", { run_id: runId, section, visible_ms: Math.round(ms) });
  }
  sectionMs.clear();
  track("report_time", { run_id: report_.id, visible_ms: Math.round(report_.visibleMs), ended_by });
  report_ = null;
}
export const currentRunId = () => report_?.id ?? null;

const sectionClocks = new Map<string, number>();
/** A report section entered / left the "viewed" state (rule: viewRule.ts). */
export function sectionInView(runId: string, section: string, inView: boolean) {
  if (!report_ || report_.id !== runId) return;
  const key = `${runId}:${section}`;
  if (inView) {
    if (!report_.seen.has(section)) {
      report_.seen.add(section);
      // The two panel events kept from the original contract.
      if (section === "graveyard" || section === "objections") track(`${section}_viewed`, { run_id: runId, ms_after_report: msAfterReport() });
    }
    if (!sectionClocks.has(key) && visible()) sectionClocks.set(key, performance.now());
  } else stopSection(key);
}
function stopSection(key: string) {
  const since = sectionClocks.get(key);
  if (since === undefined) return;
  sectionClocks.delete(key);
  sectionMs.set(key, (sectionMs.get(key) ?? 0) + performance.now() - since);
}

// ── claims ──
export function claimExpanded(runId: string | null, claimIndex: number, expanded: boolean) {
  if (runId && runId === report_?.id) track("claim_expanded", { run_id: runId, claim_index: claimIndex, expanded });
}
const clicksByRun = new Map<string, number>();
export function sourceClicked(runId: string | null, claimIndex: number, url: string) {
  if (runId && runId === report_?.id) {
    track("source_clicked", { run_id: runId, claim_index: claimIndex, url });
    clicksByRun.set(runId, (clicksByRun.get(runId) ?? 0) + 1);
  }
}
/** Evidence links opened in a run's report in this page load (condition_ended.verified_sources). */
export const sourceClicksIn = (runId: string) => clicksByRun.get(runId) ?? 0;

// ── walkthrough ──
let stepClock: { step: string; since: number | null; ms: number } | null = null;
export function walkthroughStarted(from: "welcome" | "help" | "how_it_works") { track("walkthrough_started", { from }); }
export function walkthroughStep(step: string) {
  walkthroughStepEnded("next");
  stepClock = { step, since: visible() ? performance.now() : null, ms: 0 };
}
export function walkthroughStepEnded(ended_by: "next" | "back" | "skip" | "done" | "page_hidden") {
  if (!stepClock) return;
  const ms = stepClock.ms + (stepClock.since != null ? performance.now() - stepClock.since : 0);
  track("walkthrough_step_time", { step: stepClock.step, visible_ms: Math.round(ms), ended_by });
  stepClock = null;
}
export function walkthroughEnded(how: "skip" | "done", atStep: string) {
  walkthroughStepEnded(how);
  track("walkthrough_ended", { how, at_step: atStep });
}

// ── page visibility ──
let lifecycle = false;
export function installLifecycle() {
  if (lifecycle || !features.telemetry) return;
  lifecycle = true;
  document.addEventListener("visibilitychange", () => {
    if (visible()) {
      resumeScreen(); resumeReport();
      if (stepClock && stepClock.since == null) stepClock.since = performance.now();
    } else {
      pauseScreen(); pauseReport();
      sectionClocks.forEach((_, key) => stopSection(key));
      if (stepClock?.since != null) { stepClock.ms += performance.now() - stepClock.since; stepClock.since = null; }
    }
  });
  addEventListener("pagehide", () => {
    walkthroughStepEnded("page_hidden");
    endReport("page_hidden");
    endScreen("page_hidden");
    tm.flush({ beacon: true });
  });
}

export type { ClaimStatus, ClaimType, ControlId };

/** Upload queued telemetry now (used when critical study answers are submitted). */
export const flushNow = () => tm.flush();
