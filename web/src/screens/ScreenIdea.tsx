// ── Screen an idea — the input ──
import { useId, useState } from "react";
import { ArrowRight, Check, LoaderCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageTitle, Panel, Problem } from "@/components/ui-vd";
import { cn } from "@/lib/utils";
import { liveMode, studyConfig } from "@/proto";
import { href, PATHS } from "@/router";
import { SAMPLES } from "@/lib/samples";
import { latestSessionReport, useSessionReports } from "@/lib/reports";
import { clearRunError, errorCopy, reportPath, startRun, useRun } from "@/lib/run";
import { JURISDICTIONS, type Jurisdiction } from "@/types";

export const MAX_IDEA_CHARS = 6000; // same limit as the Worker (worker/src/index.js)
const MARKET_LABEL: Record<Jurisdiction, string> = { EU: "European Union", USA: "United States", India: "India" };

// The draft survives moving between screens (module memory only; never stored or logged).
const draft: { text: string; markets: Jurisdiction[]; sample: string | null } = { text: "", markets: [], sample: null };
export function clearDraft() { draft.text = ""; draft.markets = []; draft.sample = null; }

export function ScreenIdea() {
  const run = useRun();
  useSessionReports();
  const last = latestSessionReport();
  const [idea, setIdeaState] = useState(draft.text);
  const [markets, setMarketsState] = useState<Jurisdiction[]>(draft.markets);
  const [empty, setEmpty] = useState(false);
  const hintId = useId();
  const counterId = useId();
  const running = run.status === "running";

  const setIdea = (text: string, sample: string | null = null) => {
    draft.text = text; draft.sample = sample; setIdeaState(text); setEmpty(false); clearRunError();
  };
  const toggleMarket = (m: Jurisdiction) => {
    const next = markets.includes(m) ? markets.filter(x => x !== m) : JURISDICTIONS.filter(x => x === m || markets.includes(x));
    draft.markets = next; setMarketsState(next);
  };

  function submit() {
    const text = idea.trim();
    if (!text) { setEmpty(true); document.getElementById("ideaInput")?.focus(); return; }
    void startRun({ ideaText: text, markets, sample: draft.sample && SAMPLES.find(s => s.id === draft.sample)?.text === idea ? draft.sample : null });
  }

  const copy = run.error ? errorCopy(run.error.code) : null;
  return (
    <div>
      <PageTitle eyebrow="Screen an idea" title="What's the idea?">
        Paste a startup idea the way you would pitch it. VistaDex checks its claims, looks for startups that tried it before, and argues against it. It never gives a score.
      </PageTitle>

      <div className="space-y-4">
        {running && (
          <p className="on-light flex flex-wrap items-center gap-3 rounded-card bg-background p-4 text-foreground">
            <LoaderCircle aria-hidden className="size-5 motion-safe:animate-spin" /> A screening is running.
            <a href={href(PATHS.running)} data-control="open_last_report" data-control-value="running" className="font-medium text-link underline underline-offset-4">See its progress</a>
          </p>
        )}
        {copy && (
          <div className="on-light">
            <Problem title={copy.title}>
              <p>{copy.body}</p>
              {run.error?.code === "pipeline" || run.error?.code === "contract" || run.error?.code === "http"
                ? <p className="mt-2 font-mono text-xs text-muted-foreground">{run.error.message}</p> : null}
            </Problem>
          </div>
        )}
        {!running && last && (
          <a href={href(reportPath(last.id))} data-control="open_last_report" data-control-value="report"
            className="on-page inline-flex items-center gap-2 text-[0.9375rem] font-medium text-lime underline underline-offset-4">
            Back to your last report <ArrowRight aria-hidden className="size-4" />
          </a>
        )}

        <Panel tab="Your idea" as="section" aria-labelledby="idea-tab" tabId="idea-tab">
          <div data-tour="idea">
            <label htmlFor="ideaInput" className="text-[0.9375rem] font-semibold">Idea text</label>
            <p id={hintId} className="mt-1 text-sm text-muted-foreground">
              {studyConfig.INPUT_WARNING.base}. {liveMode() ? "It is sent to our server to make the report." : "In this version it never leaves your browser."} It is not stored in usage records.
            </p>
            <Textarea
              id="ideaInput"
              data-control="idea_text"
              value={idea}
              maxLength={MAX_IDEA_CHARS}
              onChange={e => setIdea(e.target.value)}
              aria-describedby={`${hintId} ${counterId}${empty ? " idea-empty" : ""}`}
              aria-invalid={empty || undefined}
              className="mt-3 min-h-48 bg-card text-base leading-relaxed md:text-[1.0625rem]"
              placeholder="Example: We are building … No such tool exists today that … The market is worth …"
            />
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
              <span id="idea-empty" role={empty ? "alert" : undefined} className="font-medium">{empty ? "Paste or type an idea first." : ""}</span>
              <span id={counterId} className="font-mono text-muted-foreground">{idea.length.toLocaleString("en")} / {MAX_IDEA_CHARS.toLocaleString("en")} characters</span>
            </div>
          </div>

          <div data-tour="samples" className="mt-6">
            <p className="text-[0.9375rem] font-semibold">No idea handy? Load sample idea:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SAMPLES.map(s => (
                <Button key={s.id} variant="outline" onClick={() => setIdea(s.text, s.id)} disabled={running}
                  data-control="sample_load" data-control-value={s.id} aria-pressed={draft.sample === s.id && idea === s.text}
                  className="aria-pressed:border-primary aria-pressed:bg-accent">
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          <fieldset data-tour="markets" className="mt-6">
            <legend className="text-[0.9375rem] font-semibold">Target markets <span className="font-normal text-muted-foreground">(optional)</span></legend>
            <p className="mt-1 text-sm text-muted-foreground">Pick where you would launch. The report's Legal section covers these.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {JURISDICTIONS.map(m => {
                const on = markets.includes(m);
                return (
                  <button key={m} type="button" aria-pressed={on} onClick={() => toggleMarket(m)} disabled={running}
                    data-control="market_toggle" data-control-value={m}
                    className={cn("inline-flex h-10 items-center gap-2 rounded-control border px-3.5 text-sm font-medium transition-colors duration-150 disabled:opacity-50",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:bg-accent")}>
                    {on ? <Check aria-hidden className="size-4" /> : <span aria-hidden className="size-4 rounded-sm border border-input" />}
                    {m}<span className="sr-only"> ({MARKET_LABEL[m]})</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-8 flex flex-wrap items-center gap-4 border-t pt-6">
            <Button size="lg" onClick={submit} disabled={running} data-control="run_screening" data-tour="run" className="h-12 px-7 text-base">
              {running ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : <Play aria-hidden className="fill-current" />}
              {running ? "Running…" : "Run"}
            </Button>
            <p className="text-sm text-muted-foreground">Takes a few seconds{liveMode() ? " to a minute" : ""}. You can cancel while it runs.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
