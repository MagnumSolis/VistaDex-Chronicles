import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StageState } from "@/types";

export const STAGES = [
  { name: "Claim extraction", desc: "Splits the idea into checkable claims. Rules type them; an LLM only when rules are unsure." },
  { name: "Retrieval & status", desc: "Searches and fetches web sources. Status is computed from independent sources." },
  { name: "Graveyard matching", desc: "Word-overlap similarity against the local set of failed startups." },
  { name: "Objector", desc: "A separate pass that only argues against the draft. It never approves." },
];

export interface StageView { state: StageState; note?: string }

export function PipelineProgress({ stages }: { stages: StageView[] }) {
  return (
    <ol className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4" aria-label="Pipeline progress">
      {STAGES.map((s, i) => {
        const st = stages[i] ?? { state: "idle" };
        return (
          <li key={s.name} className={cn("flex gap-3 bg-card p-3.5 transition-colors duration-200", st.state === "running" && "bg-accent")}
              aria-current={st.state === "running" ? "step" : undefined}>
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center" aria-hidden>
              {st.state === "running" ? (
                <LoaderCircle className="size-4 animate-spin text-primary" />
              ) : (
                <span className={cn("size-2.5 rounded-full border", st.state === "done" ? "border-foreground bg-foreground" : "border-border-strong bg-transparent")} />
              )}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium">
                <span className="font-mono text-xs text-muted-foreground">{i + 1}</span> {s.name}
              </div>
              <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {st.state === "idle" && s.desc}
                {st.state === "running" && "Working…"}
                {st.state === "done" && (st.note || "Done")}
              </div>
            </div>
            <span className="sr-only">{st.state === "idle" ? "not started" : st.state === "running" ? "in progress" : "done"}</span>
          </li>
        );
      })}
    </ol>
  );
}
