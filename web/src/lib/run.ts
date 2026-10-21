// ── run.ts — One screening at a time: start, live stage progress, cancel, result ──
// Kept outside React so a run carries on while the visitor moves between screens.
import { useSyncExternalStore } from "react";
import { features } from "@/edition";
import { liveMode, screenIdea } from "@/proto";
import { navigate, PATHS } from "@/router";
import { addSessionReport } from "@/lib/reports";
import * as telemetry from "@/telemetry";
import { buildIdeaText } from "@proto/core/input.js";
import type { IdeaInput, ScreenResult, StageState } from "@/types";

export type StageKey = "split" | "check" | "graveyard" | "legal" | "objections";
export const STAGES: { key: StageKey; name: string; desc: string }[] = [
  { key: "split", name: "Splitting claims", desc: "Pulls the checkable claims out of your text." },
  { key: "check", name: "Checking sources", desc: "Looks each claim up in independent web sources and counts them." },
  { key: "graveyard", name: "Searching graveyard", desc: "Compares the idea with startups that shut down." },
  { key: "legal", name: "Legal & market", desc: "Registries, rules and market size for your target markets." },
  { key: "objections", name: "Objections", desc: "Argues against the idea, using what was found." },
];
// Pipeline stage numbers (prototype/core/pipeline.js) → tracker rows. Legal & market is not a pipeline stage.
const PIPELINE: Record<number, StageKey> = { 1: "split", 2: "check", 3: "graveyard", 4: "objections" };

export interface StageView { state: StageState; note?: string }
export type RunErrorCode = "access" | "daily_cap" | "rate_limited" | "misconfigured" | "http" | "contract" | "network" | "pipeline";
export interface RunState {
  status: "idle" | "running" | "done" | "failed" | "cancelled";
  runId: string | null;
  stages: Record<StageKey, StageView>;
  /** true while a live run waits on the server, which does not report stages one by one. */
  server: boolean;
  error: { code: RunErrorCode; message: string } | null;
  ideaChars: number;
  /** performance.now() when the run started: elapsed time and the live estimate count from here, so
   *  leaving the running screen and coming back doesn't restart them. */
  startedAt: number;
}

// Fixed per-stage pause in mock mode so progress is readable (no random jitter).
export const STAGE_ANIMATION_MS = 600;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const idleStages = (): Record<StageKey, StageView> => Object.fromEntries(STAGES.map(s => [s.key, { state: "idle" }])) as Record<StageKey, StageView>;

let state: RunState = { status: "idle", runId: null, stages: idleStages(), server: false, error: null, ideaChars: 0, startedAt: 0 };
let controller: AbortController | null = null;
let activeStage: StageKey | null = null;
const listeners = new Set<() => void>();
const set = (patch: Partial<RunState>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };
const setStage = (key: StageKey, view: StageView) => set({ stages: { ...state.stages, [key]: view } });
export const getRun = () => state;
export function useRun() {
  return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, getRun);
}

export const reportPath = (id: string) => `${PATHS.report}/${encodeURIComponent(id)}`;

export async function startRun({ input, sample, confPre = null }: { input: IdeaInput; sample: string | null; confPre?: { value: number; moved: boolean } | null }) {
  const ideaText = buildIdeaText(input) as string;
  const { markets } = input;
  if (state.status === "running") return;
  const live = liveMode();
  const runId = telemetry.runStarted({ input, ideaChars: ideaText.length, mode: live ? "live" : "mock", sample });
  if (confPre != null) telemetry.logConfidencePreRun(runId, confPre);
  controller = new AbortController();
  const signal = controller.signal;
  const stages = idleStages();
  if (live) for (const s of STAGES) stages[s.key] = { state: s.key === "legal" ? "skipped" : "server" };
  const t0 = performance.now();
  set({ status: "running", runId, stages, server: live, error: null, ideaChars: ideaText.length, startedAt: t0 });
  navigate(PATHS.running);

  const onStage = async (n: number, st: "running" | "done", note?: string) => {
    if (live) return; // the proxy answers all at once; the tracker says so instead of pretending
    const key = PIPELINE[n];
    if (n === 4 && st === "running") setStage("legal", { state: "done", note: "Sample data (mock mode)" });
    activeStage = key;
    setStage(key, { state: st, note });
    if (st === "running") await sleep(STAGE_ANIMATION_MS);
  };

  try {
    const data = (await screenIdea(input, { onStage, signal })) as ScreenResult;
    if (signal.aborted) throw Object.assign(new Error("cancelled"), { code: "cancelled" });
    const report = data.report; // in mock mode the pipeline already carries the sample placeholders (sample_fields)
    const entry = addSessionReport({ runId, createdAt: new Date(), report, mode: data.mode, markets, traceId: data.traceId });
    telemetry.runCompleted(runId, { report, traceId: data.traceId, mode: data.mode }, Math.round(performance.now() - t0));
    const done = idleStages();
    const notes: Record<StageKey, string> = {
      split: `${report.claims.length} claims`, check: `${report.claims.length} claims checked`,
      graveyard: `${report.graveyard_matches.length} lead${report.graveyard_matches.length === 1 ? "" : "s"}`,
      legal: report.legal ? "Sample data (mock mode)" : "Not in this version yet",
      objections: `${report.objections.length} objection${report.objections.length === 1 ? "" : "s"}`,
    };
    for (const s of STAGES) done[s.key] = { state: s.key === "legal" && !report.legal ? "skipped" : "done", note: notes[s.key] };
    set({ status: "done", stages: done, server: false });
    navigate(reportPath(entry.id));
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "cancelled" || signal.aborted) {
      telemetry.runCancelled(runId, activeStage ?? (live ? "server" : "split"));
      set({ status: "cancelled", stages: idleStages(), server: false });
      navigate(PATHS.screen);
      return;
    }
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    const known: RunErrorCode = (["access", "daily_cap", "rate_limited", "misconfigured", "http", "contract", "network"] as const).includes(code as never) ? (code as RunErrorCode) : "pipeline";
    telemetry.runFailed(runId, known, message);
    set({ status: "failed", error: { code: known, message }, server: false });
    navigate(PATHS.screen);
  } finally {
    controller = null;
    activeStage = null;
  }
}

export function cancelRun() {
  controller?.abort();
}

/** Clears a shown error (e.g. when the visitor edits the idea again). */
export function clearRunError() {
  if (state.error) set({ error: null, status: "idle" });
}

/** Friendly wording for refusals and failures, shown on the Screen an idea page. */
export function errorCopy(code: RunErrorCode): { title: string; body: string } {
  switch (code) {
    case "daily_cap": return { title: "VistaDex has reached today's limit", body: "We cap the number of screenings per day to keep this prototype free. Please come back tomorrow. Your idea text is still here." };
    case "rate_limited": return { title: "That was a lot of screenings at once", body: "Please wait a minute, then press Run again. Your idea text is still here." };
    case "access": return { title: "This link is missing its access code", body: "Please open VistaDex from the link you were given; it carries the code." };
    case "misconfigured": return { title: "The screening server is not set up correctly", body: "This is our problem, not yours. Please tell the VistaDex team." };
    case "network": return { title: "We couldn't reach the screening server", body: "Check your connection and try again. Your idea text is still here." };
    default: return { title: "The screening did not finish", body: "Something went wrong while screening your idea. Please try again; if it keeps happening, please tell the VistaDex team." };
  }
}
