import { useCallback, useRef, useState } from "react";
import { Play, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PipelineProgress, type StageView } from "@/components/PipelineProgress";
import { Report } from "@/components/report/Report";
import { SAMPLE_IDEA, liveMode, screenIdea, studyConfig } from "@/proto";
import { FinishCard, StudyBar, TrustPre } from "@/study/StudyUI";
import * as study from "@/study/controller";
import { useStudyState } from "@/study/useStudy";
import type { ScreenResult } from "@/types";

// Fixed per-stage animation time so progress is readable (same as the vanilla UI; no random jitter).
const STAGE_ANIMATION_MS = 600;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const idleStages = (): StageView[] => [0, 1, 2, 3].map(() => ({ state: "idle" }));

export function ScreenIdea({ onReadStudyInfo }: { onReadStudyInfo: () => void }) {
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
    <div className="space-y-6 sm:space-y-8">
      <header className="pt-2">
        <h1 className="font-display text-[2.75rem] font-bold leading-[0.95] tracking-tight sm:text-[3.5rem]">Screen an idea</h1>
        <p className="mt-3 max-w-[62ch] text-[1.0625rem] leading-relaxed text-muted-foreground">
          Paste an idea. VistaDex checks its claims against independent sources, finds similar startups that failed, and lists objections. You make the decision.
        </p>
      </header>

      <StudyBar onReadInfo={onReadStudyInfo} />
      <div className={needsTrust ? "rounded-panel ring-2 ring-primary ring-offset-4 ring-offset-background" : undefined}><TrustPre /></div>

      <div className="rounded-panel bg-card p-5 shadow-panel sm:p-7">
        <Label htmlFor="ideaInput" className="font-display text-xl font-bold">Idea text</Label>
        <p id="ideaHint" className="mt-1 text-sm text-muted-foreground">
          {studyConfig.INPUT_WARNING.base}{participating ? studyConfig.INPUT_WARNING.stored : studyConfig.INPUT_WARNING.notStored}
        </p>
        <Textarea
          id="ideaInput"
          value={idea}
          onChange={e => setIdea(e.target.value)}
          aria-describedby="ideaHint"
          className="mt-4 min-h-44 text-base leading-relaxed md:text-base"
          placeholder="Example: We are building an AI-powered legal contract review tool for early-stage startups. No such tool exists today that combines LLM-based review with a human lawyer backstop at under $200/month. The legal-tech market is worth $27B globally."
        />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="lg" onClick={() => setIdea(SAMPLE_IDEA)} disabled={running}>Load sample idea</Button>
          <Button size="lg" onClick={run} disabled={running} aria-describedby={needsTrust ? "trust-needed" : undefined}>
            <Play aria-hidden className="fill-current" /> {running ? "Running…" : "Run pipeline"}
          </Button>
        </div>
        {needsTrust && participating && (
          <p id="trust-needed" role="alert" className="mt-3 text-sm font-medium text-foreground">Please answer the question above before your first run.</p>
        )}
      </div>

      <PipelineProgress stages={stages} />

      {error && (
        <div role="alert" className="flex gap-3 rounded-card bg-card p-5 shadow-card">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground" />
          <div>
            <p className="text-sm font-semibold">The screening did not run</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div ref={reportRef} tabIndex={-1} className="space-y-10 pt-2 outline-none" aria-live="polite">
          <Report report={result.data.report} mode={result.data.mode} runId={result.runId} rateable={participating} />
          {participating && <FinishCard key={result.runId} runId={result.runId} />}
        </div>
      )}
    </div>
  );
}
