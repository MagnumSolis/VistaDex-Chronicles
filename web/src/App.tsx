import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { liveMode } from "@/proto";
import * as study from "@/study/controller";
import { ScreenIdea } from "@/screens/ScreenIdea";
import { Report } from "@/components/report/Report";
import { cohort, cohortReport } from "@/lib/cohort";
import type { ViewName } from "@/types";

// Dev-only style preview: ?demo=<cohort id> renders that demo report with the new components.
// Stripped from production builds (import.meta.env.DEV is false there).
const demoPreview = import.meta.env.DEV ? new URLSearchParams(location.search).get("demo") : null;

const NAV: { view: ViewName; label: string }[] = [
  { view: "dashboard", label: "Cohort dashboard" },
  { view: "screen", label: "Screen an idea" },
  { view: "graveyard", label: "Graveyard DB" },
];

export function App() {
  const [view, setView] = useState<ViewName>("screen");

  useEffect(() => {
    study.init();
    study.viewChanged("screen");
  }, []);

  const go = (v: ViewName) => {
    setView(v);
    study.viewChanged(v); // returns true when consent should be asked (wired in step 3)
  };

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-2">
            <span className="text-[1.05rem] font-semibold tracking-tight">VistaDex</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">Idea screening · evidence for reviewers</span>
          </div>
          <nav aria-label="Main" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {NAV.map(n => (
              <button
                key={n.view}
                type="button"
                onClick={() => go(n.view)}
                aria-current={view === n.view ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors duration-150",
                  view === n.view ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <span className="ml-auto rounded-sm border px-2 py-0.5 font-mono text-[0.7rem] text-muted-foreground">
            {liveMode() ? "Live providers (proxy)" : "Key-free mock mode"}
          </span>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {demoPreview && (() => {
          const idea = cohort.find(i => i.id === demoPreview);
          return idea ? <Report report={cohortReport(idea)} runId={null} rateable demo /> : null;
        })()}
        {!demoPreview && view === "screen" && <ScreenIdea />}
        {!demoPreview && view !== "screen" && (
          <p className="rounded-lg border border-dashed bg-card p-6 text-sm text-muted-foreground">
            This screen moves to the new design in the next step. Use the current prototype for it in the meantime.
          </p>
        )}
      </main>
    </div>
  );
}
