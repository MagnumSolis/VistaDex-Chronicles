// ── Running — live progress of the current screening ──
// Mock mode: the real pipeline stages report as they run (the pipeline cannot stream individual
// claims, so only stage progress and counts are shown). Live mode: the server runs every stage and
// answers once, so the tracker says that instead of animating stages it cannot see.
import { Check, LoaderCircle, Minus, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageTitle, Panel } from "@/components/ui-vd";
import { cn } from "@/lib/utils";
import { navigate, PATHS } from "@/router";
import { cancelRun, STAGES, useRun, type StageView } from "@/lib/run";

const STATE_TEXT: Record<StageView["state"], string> = {
  idle: "Waiting", running: "Working…", done: "Done", skipped: "Not in this version yet", server: "On the server",
};

export function Running() {
  const run = useRun();

  if (run.status !== "running") {
    return (
      <div>
        <PageTitle eyebrow="Screen an idea" title="Nothing is running" />
        <div className="on-light max-w-xl text-foreground">
          <EmptyState icon={LoaderCircle} title="There is no screening in progress."
            action={<Button size="lg" onClick={() => navigate(PATHS.screen)} data-control="running_go_screen">Screen an idea</Button>}>
            Paste an idea on the Screen an idea page and press Run; its progress shows here.
          </EmptyState>
        </div>
      </div>
    );
  }

  const done = STAGES.filter(s => run.stages[s.key].state === "done" || run.stages[s.key].state === "skipped").length;
  return (
    <div>
      <PageTitle eyebrow="Screen an idea" title="Screening your idea">
        VistaDex is working through five steps. Nothing here is a verdict; the report shows the evidence and you decide.
      </PageTitle>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-5">
        <Panel tone="charcoal" tab="Progress" tabId="progress-tab" as="section" aria-labelledby="progress-tab" data-tour="tracker">
          <p className="sr-only" aria-live="polite">{done} of {STAGES.length} steps finished.</p>
          {run.server && (
            <p className="mb-4 flex items-start gap-2.5 rounded-inner bg-charcoal-raised p-3.5 text-sm leading-relaxed text-on-charcoal">
              <Server aria-hidden className="mt-0.5 size-4 shrink-0" />
              The server runs these steps together and answers once, so they finish together. This can take up to a minute.
            </p>
          )}
          <ol className="space-y-1.5">
            {STAGES.map((s, i) => {
              const st = run.stages[s.key];
              return (
                <li key={s.key} aria-current={st.state === "running" ? "step" : undefined}
                  className={cn("flex items-start gap-3.5 rounded-inner p-3", st.state === "running" && "bg-charcoal-raised")}>
                  <span aria-hidden className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control font-mono text-sm",
                    st.state === "done" ? "bg-lime text-on-lime" : "border border-on-charcoal-muted text-on-charcoal")}>
                    {st.state === "done" ? <Check className="size-4" strokeWidth={2.5} />
                      : st.state === "running" || st.state === "server" ? <LoaderCircle className="size-4 motion-safe:animate-spin" />
                        : st.state === "skipped" ? <Minus className="size-4" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-on-charcoal">{s.name}</p>
                    <p className="text-sm leading-relaxed text-on-charcoal-muted">
                      <span className="font-mono text-xs uppercase tracking-[0.08em] text-lime">{st.state === "done" && st.note ? st.note : STATE_TEXT[st.state]}</span>
                      <span className="block">{s.desc}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel as="aside" className="self-start">
          <p className="font-display text-2xl leading-snug">While you wait</p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed">
            A claim only gets a status when at least two independent websites back it up or contradict it. Otherwise it is <span className="font-semibold">unverified</span>, which is a normal result.
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">Cancelling keeps your idea text so you can edit and run again.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" variant="outline" onClick={cancelRun} data-control="run_cancel">Cancel</Button>
            <Button size="lg" variant="ghost" onClick={() => navigate(PATHS.screen)} data-control="running_back_to_edit">Back to the idea</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
