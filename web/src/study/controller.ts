// ── controller.ts — Study instrumentation, ported 1:1 from the pilot-1 vanilla UI ──
// (prototype/ui/study.js, removed at the switch-over; see git history before it).
// All event types, payload fields and timing rules are identical to the vanilla
// UI (contract: tests/fixtures/event-contract.json). Components call these
// functions; nothing else in the React app calls telemetry.log directly.
// The only difference from study.js: no DOM querying — React supplies indices,
// types and statuses explicitly.

import * as tm from "@proto/ui/telemetry.js";
import { SCALE } from "@proto/ui/study-config.js";
import type { ClaimStatus, ClaimType, RunMode, ScreenResult, ViewName } from "@/types";

type Run = { id: string; visibleMs: number; since: number | null; seen: Set<string> };

let runCount = 0;
let current: Run | null = null;
let activeView: ViewName = "dashboard";
let initialised = false;

// ── change notifications for React (consent / trust / run state) ──
const listeners = new Set<() => void>();
let version = 0;
function changed() {
  version++;
  listeners.forEach(l => l());
}
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const getVersion = () => version;

// ── state queries ──
export const consentStatus = (): "given" | "declined" | null => tm.consentStatus();
export const participating = () => tm.consentStatus() === "given";
export const trustPreDone = () => tm.events().some((e: { type: string }) => e.type === "trust_pre");
export const sessionCode = (): string | null => tm.sessionCode();
export const currentRunId = () => current?.id ?? null;

export function init() {
  if (initialised) return;
  initialised = true;
  document.addEventListener("visibilitychange", () => (document.visibilityState === "visible" ? resumeTimer() : pauseTimer()));
  addEventListener("pagehide", () => endReportTimer("page_hidden"));
}

// ── views ──
// Returns true when the consent dialog should be shown (first visit to Screen an Idea).
export function viewChanged(view: ViewName): boolean {
  if (view === activeView) return false;
  if (activeView === "screen") pauseTimer();
  activeView = view;
  if (view === "screen") resumeTimer();
  tm.log("view_changed", { view });
  return view === "screen" && tm.consentStatus() === null;
}

export function cohortReportOpened(ideaId: string) {
  tm.log("demo_report_opened", { idea_id: ideaId });
}

// ── consent ──
export function giveConsent() { tm.giveConsent(); changed(); }
export function declineConsent() { tm.declineConsent(); changed(); }

// ── trust (pre) ──
export function logTrustPre(value: number) {
  tm.log("trust_pre", { value, scale: [SCALE.min, SCALE.max] });
  changed();
}

// Participants answer the pre-use trust question before their first run.
export function canRun() {
  return !participating() || trustPreDone();
}

// ── runs ──
export function runStarted({ ideaText, mode }: { ideaText: string; mode: "mock" | "live" }) {
  endReportTimer("new_run");
  const id = `r${++runCount}`;
  tm.log("run_started", { run_id: id, mode, idea_chars: ideaText.length });
  changed(); // hides the pre-use slider once a run starts
  return id;
}

export function runFailed(runId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  tm.log("run_failed", { run_id: runId, error: String(message).slice(0, 300) });
}

export function runCompleted(runId: string, { report, trace, traceId, mode }: ScreenResult, durationMs: number) {
  tm.log("run_completed", {
    run_id: runId, trace_id: traceId, mode, duration_ms: durationMs,
    idea_text: report.idea_text, report, trace: trace || null,
  });
  if (!participating()) return;
  current = { id: runId, visibleMs: 0, since: null, seen: new Set() };
  resumeTimer();
  changed();
}

// ── per-claim interactions (only while a consented run is on screen) ──
export function claimRated(claimIndex: number, claimType: ClaimType, status: ClaimStatus, rating: string) {
  if (!current) return;
  tm.log("claim_rating", { run_id: current.id, claim_index: claimIndex, claim_type: claimType, status, rating });
}

export function claimExpanded(claimIndex: number, expanded: boolean) {
  if (!current) return;
  tm.log("claim_expanded", { run_id: current.id, claim_index: claimIndex, expanded });
}

export function sourceClicked(claimIndex: number, url: string) {
  if (!current) return;
  tm.log("source_clicked", { run_id: current.id, claim_index: claimIndex, url });
}

export function notesEdited(chars: number) {
  if (!current) return;
  tm.log("notes_edited", { run_id: current.id, chars });
}

// Called by an IntersectionObserver (threshold 0.5) once per panel per run.
export function panelViewed(name: "objections_viewed" | "graveyard_viewed", runId: string) {
  const run = current;
  if (!run || run.id !== runId || run.seen.has(name)) return;
  run.seen.add(name);
  tm.log(name, { run_id: run.id, ms_after_report: run.visibleMs + (run.since ? performance.now() - run.since : 0) | 0 });
}

// ── post-use trust + survey ──
export function submitSurvey(runId: string, trustPost: number, answers: Record<string, number>, freeTextId: string, comments: string) {
  tm.log("trust_post", { run_id: runId, value: trustPost, scale: [SCALE.min, SCALE.max] });
  tm.log("survey_submitted", { run_id: runId, answers, [freeTextId]: comments });
  endReportTimer("survey_submitted");
  tm.flush();
  changed();
}

// ── withdraw / export ──
export async function withdraw() {
  endReportTimer("withdrawn");
  const res = await tm.withdraw();
  changed();
  return res as { session_id: string | null; server: string };
}
export const exportJSON = () => tm.exportJSON();
export const exportCSV = () => tm.exportCSV();

// ── time on report (counts only while the page and Screen view are visible) ──
function resumeTimer() {
  if (current && !current.since && activeView === "screen" && document.visibilityState === "visible") current.since = performance.now();
}
function pauseTimer() {
  if (current?.since) { current.visibleMs += performance.now() - current.since; current.since = null; }
}
function endReportTimer(reason: "new_run" | "page_hidden" | "withdrawn" | "survey_submitted") {
  if (!current) return;
  pauseTimer();
  tm.log("report_time", { run_id: current.id, visible_ms: Math.round(current.visibleMs), ended_by: reason });
  current = null;
}

export type { RunMode };
