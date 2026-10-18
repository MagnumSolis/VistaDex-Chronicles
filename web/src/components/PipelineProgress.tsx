import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StageState } from "@/types";

export const STAGES = [
  { name: "Extract claims", desc: "Splits the idea into checkable claims" },
  { name: "Check sources", desc: "Status from independent web sources" },
  { name: "Match graveyard", desc: "Similar startups that failed" },
  { name: "Raise objections", desc: "Argues only against the draft" },
];

export interface StageView { state: StageState; note?: string }

const STATE_LABEL: Record<StageState, string> = { idle: "Waiting", running: "Working…", done: "Done" };

// The four stages are a real sequence, so they are numbered. Completion shows in the step
// indicators themselves (accent-filled when done); the running spinner is the one animated element.
export function PipelineProgress({ stages }: { stages: StageView[] }) {
  return (
    <section aria-label="Pipeline progress" className="rounded-panel bg-card p-3 shadow-card sm:p-4">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((s, i) => {
          const st = stages[i] ?? { state: "idle" as StageState };
          return (
            <li
              key={s.name}
              aria-current={st.state === "running" ? "step" : undefined}
              className={cn(
                "flex items-center gap-3.5 rounded-inner px-4 py-3.5 transition-colors duration-200",
                st.state === "running" ? "bg-accent" : "bg-transparent",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "relative flex size-11 shrink-0 items-center justify-center rounded-full font-mono text-[0.95rem] font-medium",
                  st.state === "done" && "bg-primary text-primary-foreground",
                  st.state === "running" && "border-2 border-primary bg-card text-primary",
                  st.state === "idle" && "border-2 border-border-strong text-muted-foreground",
                )}
              >
                {st.state === "running" ? <LoaderCircle className="size-6 animate-spin" strokeWidth={2.25} /> : i + 1}
              </span>
              <div className="min-w-0">
                <div className="font-display text-lg font-bold leading-tight">{s.name}</div>
                <div className={cn("text-[0.8125rem] leading-snug", st.state === "running" ? "text-accent-foreground" : "text-muted-foreground")}>
                  {st.state === "done" ? (st.note || "Done") : st.state === "running" ? STATE_LABEL.running : s.desc}
                </div>
              </div>
              <span className="sr-only">{st.state === "idle" ? "not started" : st.state === "running" ? "in progress" : "done"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
