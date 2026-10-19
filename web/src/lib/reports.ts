// ── reports.ts — Reports available to the UI: this session's runs (memory only) + the demo cohort ──
// Public edition: only the latest run is reachable (no history, no shareable report URLs); reports
// live in memory and are gone after a reload. Pitch edition: every session run plus the demo cohort.
// The Worker does not persist reports (it stores traces only). TODO(team): persistent report storage.
import { useSyncExternalStore } from "react";
import { cohort, cohortReport } from "@/lib/cohort";
import type { Jurisdiction, Report, RunMode } from "@/types";

export interface ReportEntry {
  id: string;            // run id ("r3") or cohort id ("idea-01")
  title: string;
  kind: "session" | "demo";
  createdAt: Date | null; // demo data has no date
  report: Report;
  mode: RunMode | "demo";
  markets: Jurisdiction[];
  category: string | null;
  traceId: string | null;
}

let session: ReportEntry[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function titleFor(ideaText: string) {
  const first = ideaText.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  const t = first.replace(/^(we are|we're|i am|i'm)\s+(building|creating|making)\s+/i, "").trim();
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return cap.length > 72 ? `${cap.slice(0, 70).trimEnd()}…` : cap || "Untitled idea";
}

export function addSessionReport(e: Omit<ReportEntry, "kind" | "title" | "category">) {
  session = [{ ...e, kind: "session", title: titleFor(e.report.idea_text), category: null }, ...session];
  emit();
}

export const demoEntries: ReportEntry[] = cohort.map(i => ({
  id: i.id, title: i.name, kind: "demo", createdAt: null, report: cohortReport(i),
  mode: "demo", markets: [], category: i.category, traceId: null,
}));

export const latestSessionReport = () => session[0] ?? null;
export const allEntries = () => [...session, ...demoEntries];
export const findEntry = (id: string) => allEntries().find(e => e.id === id) ?? null;

export function useSessionReports() {
  return useSyncExternalStore(subscribe, () => session);
}

/** Test helper. */
export function _resetSessionReports() { session = []; emit(); }
