import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { liveMode } from "@/proto";
import * as study from "@/study/controller";
import { ScreenIdea } from "@/screens/ScreenIdea";
import { Dashboard } from "@/screens/Dashboard";
import { Graveyard } from "@/screens/Graveyard";
import { Report } from "@/components/report/Report";
import { cohort, cohortReport } from "@/lib/cohort";
import { Swatch } from "@/dev/Swatch";
import { ConsentDialog } from "@/study/StudyUI";
import type { ViewName } from "@/types";

// Dev-only style preview: ?demo=<cohort id> renders that demo report with the new components.
// Stripped from production builds (import.meta.env.DEV is false there).
const devParams = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
const demoPreview = devParams?.get("demo") ?? null;
const swatchPreview = devParams?.has("swatch") ?? false;

const NAV: { view: ViewName; label: string; short: string }[] = [
  { view: "dashboard", label: "Cohort dashboard", short: "Dashboard" },
  { view: "screen", label: "Screen an idea", short: "Screen" },
  { view: "graveyard", label: "Graveyard DB", short: "Graveyard" },
];

export function App() {
  const [view, setView] = useState<ViewName>("dashboard");
  const [consentOpen, setConsentOpen] = useState(false);
  const resumeAfterConsent = useRef<(() => void) | null>(null);

  useEffect(() => { study.init(); }, []);

  const go = (v: ViewName) => {
    setView(v);
    if (study.viewChanged(v)) setConsentOpen(true);
  };

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 bg-background/85 px-3 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 rounded-panel bg-card p-2 shadow-card sm:flex-nowrap sm:rounded-full">
          <div className="flex items-center gap-2.5 pl-1 pr-3">
            <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-foreground font-display text-lg font-bold text-card">V</span>
            <span className="font-display text-xl font-bold tracking-tight">VistaDex</span>
          </div>
          <span className="ml-auto rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground sm:order-last">
            {liveMode() ? "Live providers" : "Mock mode"}
          </span>
          <nav aria-label="Main" className="flex w-full gap-1 overflow-x-auto sm:w-auto">
            {NAV.map(n => (
              <button
                key={n.view}
                type="button"
                onClick={() => go(n.view)}
                aria-current={view === n.view ? "page" : undefined}
                className={cn(
                  "h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-150",
                  view === n.view ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="sm:hidden">{n.short}</span>
                <span className="hidden sm:inline">{n.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        {swatchPreview && <Swatch />}
        {demoPreview && (() => {
          const idea = cohort.find(i => i.id === demoPreview);
          return idea ? <Report report={cohortReport(idea)} runId={null} rateable demo /> : null;
        })()}
        {/* All views stay mounted (hidden when inactive), as in the original UI, so a report,
            its ratings and the survey survive switching views. */}
        {!demoPreview && !swatchPreview && (
          <>
            <div hidden={view !== "dashboard"}><Dashboard /></div>
            <div hidden={view !== "screen"}><ScreenIdea onReadStudyInfo={() => setConsentOpen(true)} onNeedConsent={resume => { resumeAfterConsent.current = resume; setConsentOpen(true); }} /></div>
            <div hidden={view !== "graveyard"}><Graveyard /></div>
          </>
        )}
      </main>
      <ConsentDialog open={consentOpen} onDone={() => {
        setConsentOpen(false);
        const resume = resumeAfterConsent.current;
        resumeAfterConsent.current = null;
        resume?.(); // the run the participant asked for (decline: runs; agree: asks the pre-use question first)
      }} />
    </div>
  );
}
