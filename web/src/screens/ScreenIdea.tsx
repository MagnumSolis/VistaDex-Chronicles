import { useCallback, useRef, useState } from "react";
import { Play, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PipelineProgress, type StageView } from "@/components/PipelineProgress";
import { Report } from "@/components/report/Report";
import { SAMPLE_IDEA, liveMode, screenIdea } from "@/proto";
import * as study from "@/study/controller";
import { useStudyState } from "@/study/useStudy";
import type { ScreenResult } from "@/types";

// Fixed per-stage animation time so progress is readable (same as the vanilla UI; no random jitter).
const STAGE_ANIMATION_MS = 600;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const idleStages = (): StageView[] => [0, 1, 2, 3].map(() => ({ state: "idle" }));

export function ScreenIdea({ studySlotTop, studySlotBeforeInput, studySlotAfterReport }: {
  studySlotTop?: React.ReactNode;           // study bar (step 3)
  studySlotBeforeInput?: React.ReactNode;   // pre-use trust question (step 3)
  studySlotAfterReport?: (runId: string) => React.ReactNode; // survey (step 3)
}) {
  const { participating } = useStudyState();
  const [idea, setIdea] = useState("");
  const [stages, setStages] = useState<StageView[]>(idleStages);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ runId: string; data: ScreenResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsTrust, setNeedsTrust] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const onStage = useCallback(async (n: number, state: "running" | "done", note?: string) => {
    setStages(prev => prev.map((s, i) => (i === n - 1 ? { state, note } : s)));
    if (state === "running") await sleep(STAGE_ANIMATION_MS);
  }, []);

  async function run() {
    if (running) return;
    const text = idea.trim();
    if (!text) { setError("Please paste an idea first."); return; }
    if (!study.canRun()) { setNeedsTrust(true); return; }
    setNeedsTrust(false);
    setRunning(true);
    setError(null);
    setResult(null);
    setStages(idleStages());
    const runId = study.runStarted({ ideaText: text, mode: liveMode() ? "live" : "mock" });
    const t0 = performance.now();
    try {
      const data = (await screenIdea(text, { onStage })) as ScreenResult;
      setResult({ runId, data });
      study.runCompleted(runId, data, Math.round(performance.now() - t0));
      requestAnimationFrame(() => reportRef.current?.focus({ preventScroll: true }));
    } catch (err) {
      console.error(err);
      study.runFailed(runId, err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Screen an idea</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Paste the idea text. VistaDex checks each claim against independent sources, looks for similar startups that failed, and lists objections.
          It produces evidence for you to judge — never a verdict.
        </p>
      </header>

      {studySlotTop}
      <div className={needsTrust ? "rounded-lg ring-2 ring-sev-medium ring-offset-2 ring-offset-background" : undefined}>{studySlotBeforeInput}</div>

      <div className="rounded-lg border bg-card p-4 sm:p-5">
        <Label htmlFor="ideaInput" className="text-sm font-semibold">Idea text</Label>
        <p className="mt-1 text-xs text-muted-foreground">Please don&apos;t include names, emails or confidential details.</p>
        <Textarea
          id="ideaInput"
          value={idea}
          onChange={e => setIdea(e.target.value)}
          className="mt-2 min-h-40 text-[0.9375rem] leading-relaxed"
          placeholder="Example: We are building an AI-powered legal contract review tool for early-stage startups. No such tool exists today that combines LLM-based review with a human lawyer backstop at under $200/month. The legal-tech market is worth $27B globally."
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="lg" onClick={() => setIdea(SAMPLE_IDEA)} disabled={running}>Load sample idea</Button>
          <Button size="lg" onClick={run} disabled={running} aria-describedby={needsTrust ? "trust-needed" : undefined}>
            <Play aria-hidden /> {running ? "Running…" : "Run pipeline"}
          </Button>
        </div>
        {needsTrust && participating && (
          <p id="trust-needed" role="alert" className="mt-3 text-sm text-sev-medium">Please answer the question above before your first run.</p>
        )}
      </div>

      <PipelineProgress stages={stages} />

      {error && (
        <div role="alert" className="flex gap-3 rounded-lg border border-st-contradicted-rule bg-card p-4">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold">The screening run failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div ref={reportRef} tabIndex={-1} className="space-y-6 outline-none" aria-live="polite">
          <Report report={result.data.report} mode={result.data.mode} runId={result.runId} rateable={participating} />
          {participating && studySlotAfterReport?.(result.runId)}
        </div>
      )}
    </div>
  );
}
