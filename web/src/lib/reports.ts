// ── reports.ts — The reports the Reports page lists ──
// Public edition: the reports THIS browser has run, saved in localStorage (every access in try/catch;
// blocked storage falls back to memory for the tab). "Clear my reports" deletes them. Never uploaded.
// Pitch edition: this session's runs (memory only) + the demo cohort.
// Both: the "Sample reports" toggle adds up to 15 fixed, researched sample reports (prototype/data/sample-reports.js),
// built in the browser and never saved; the toggle is memory only, so it is Off on every page load.
// The Worker does not store reports. TODO(team): persistent server storage.
import { useSyncExternalStore } from "react";
import { features } from "@/edition";
import { demoReport, cohort } from "@/lib/cohort";
import { sampleReports } from "@proto/core/sample-reports.js";
import type { Jurisdiction, Report, RunMode } from "@/types";

export interface ReportEntry {
  id: string;             // stable id ("k1x2…-r3") or cohort id ("idea-01")
  runId: string | null;   // telemetry run id while this page session follows the run; null otherwise
  title: string;
  kind: "session" | "demo" | "sample";
  createdAt: Date | null; // demo and sample data have no run date
  report: Report;
  mode: RunMode | "demo" | "sample";
  markets: Jurisdiction[];
  category: string | null;
  traceId: string | null;
  checkedOn?: string;     // sample reports: the date their sources were checked (YYYY-MM-DD)
  leadChecks?: Record<string, LeadCheck>; // sample reports: the page each graveyard lead's closure was checked on
}
export interface LeadCheck { url: string; quote: string; checked: string }

const KEY = "vistadex.reports.v1";
export const MAX_STORED = 50;
const listeners = new Set<() => void>();
let session: ReportEntry[] = load();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function load(): ReportEntry[] {
  if (features.reportStore !== "browser") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(e => e && e.id && e.report).map(e => ({ ...e, runId: null, kind: "session", createdAt: e.createdAt ? new Date(e.createdAt) : null }));
  } catch { return []; }
}
function save() {
  if (features.reportStore !== "browser") return;
  let list = session.slice(0, MAX_STORED);
  // Full storage: drop the oldest until it fits (or give up and keep them for this tab only).
  while (list.length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.map(({ runId: _r, ...e }) => ({ ...e, createdAt: e.createdAt?.toISOString() ?? null }))));
      return;
    } catch { list = list.slice(0, -1); }
  }
}

export function titleFor(ideaText: string) {
  const first = ideaText.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  const t = first.replace(/^(we are|we're|i am|i'm)\s+(building|creating|making)\s+/i, "").trim();
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return cap.length > 72 ? `${cap.slice(0, 70).trimEnd()}…` : cap || "Untitled idea";
}

let seq = 0;
export function addSessionReport(e: { runId: string; createdAt: Date; report: Report; mode: RunMode; markets: Jurisdiction[]; traceId: string | null }) {
  const id = `${Date.now().toString(36)}${(seq++).toString(36)}-${e.runId}`;
  const entry: ReportEntry = { ...e, id, kind: "session", title: e.report.input?.title || titleFor(e.report.idea_text), category: null };
  session = [entry, ...session];
  save();
  emit();
  return entry;
}

export function clearStoredReports() {
  session = [];
  try { localStorage.removeItem(KEY); } catch { /* blocked: nothing stored anyway */ }
  emit();
}

export const makeDemoEntries = (): ReportEntry[] =>
  cohort.map(i => ({ id: i.id, runId: null, title: i.name, kind: "demo", createdAt: null, report: demoReport(i), mode: "demo", markets: [], category: i.category, traceId: null }));
export const demoEntries: ReportEntry[] = features.reportStore === "session-and-demo" ? makeDemoEntries() : [];

export const checkedLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const SAMPLE_COUNTS = [0, 5, 10, 15] as const;
export type SampleCount = (typeof SAMPLE_COUNTS)[number];
let samples: ReportEntry[] | null = null;
/** The 15 sample reports, built on first use with the pipeline's own code. */
export function sampleEntries(): ReportEntry[] {
  samples ??= (sampleReports() as { id: string; checked: string; report: Report; leadChecks: Record<string, LeadCheck> }[]).map(s => ({
    id: `sample-${s.id}`, runId: null, title: s.report.input?.title ?? s.id, kind: "sample", createdAt: null, report: s.report, mode: "sample",
    markets: s.report.input?.markets ?? [], category: null, traceId: null, checkedOn: s.checked, leadChecks: s.leadChecks,
  }));
  return samples;
}
let sampleCount: SampleCount = 0;
export const getSampleCount = () => sampleCount;
export function setSampleCount(n: SampleCount) { sampleCount = n; emit(); }
export const useSampleCount = () => useSyncExternalStore(subscribe, getSampleCount);

export const latestSessionReport = () => session[0] ?? null;
export const allEntries = () => [...session, ...demoEntries];
/** What the Reports page lists: the stored/demo entries plus the samples the toggle asks for. */
export const listedEntries = () => [...allEntries(), ...(sampleCount ? sampleEntries().slice(0, sampleCount) : [])];
export const findEntry = (id: string) => allEntries().find(e => e.id === id) ?? (id.startsWith("sample-") ? sampleEntries().find(e => e.id === id) : undefined) ?? null;

export function useSessionReports() {
  return useSyncExternalStore(subscribe, () => session);
}

/** Test helper. */
export function _resetSessionReports() { session = []; sampleCount = 0; emit(); }
