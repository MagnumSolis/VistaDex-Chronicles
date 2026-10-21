// ── Walkthrough (public edition) — coach marks on Screen an idea and the Report ──
// Rules:
// - A step shows only on its own route, next to a target that exists there. Elsewhere the tour is paused
//   and a "Resume tour" control takes the visitor back. A card is never left stranded.
// - The Run step is a gate: Next is disabled until the visitor presses Run. While the screening runs the
//   tour is hidden; when the report is ready it resumes at the first report step. A cancelled or failed
//   run brings it back to the Run step on Screen an idea.
// - The highlight and the desktop card are positioned in document coordinates (portal on <body>), so they
//   move with the page on every frame of a scroll. No transition on position.
// - No backdrop: the page stays usable, and every step can be skipped. Replayable from "?".
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { features } from "@/edition";
import { href, navigate, PATHS, type RouteName } from "@/router";
import { latestSessionReport } from "@/lib/reports";
import { reportPath, useRun } from "@/lib/run";
import * as telemetry from "@/telemetry";

export interface Step { id: string; route: "screen" | "report"; target?: string; title: string; body: string; gate?: "run" }
export const STEPS: Step[] = [
  { id: "samples", route: "screen", target: "[data-tour=samples]", title: "Start from a sample", body: "No idea handy? Load one of the samples to see how a report looks, or fill in your own below." },
  { id: "basics", route: "screen", target: "[data-tour=basics]", title: "Name it and pitch it", body: "A short title and the one sentence you would open a pitch with: what it is and who it is for." },
  { id: "details", route: "screen", target: "[data-tour=details]", title: "Problem, solution, moat", body: "Write them the way you would argue them. VistaDex pulls the checkable claims out of these fields, so concrete statements get checked." },
  { id: "context", route: "screen", target: "[data-tour=context]", title: "Industry, role and markets", body: "Optional. Industry and role help compare reports on the Reports page; the markets you pick shape the Legal section." },
  { id: "run", route: "screen", target: "[data-tour=run]", title: "Press Run", body: "The screening takes a few seconds. The tour carries on when the report is ready.", gate: "run" },
  { id: "score", route: "report", target: "[data-tour=score]", title: "A score you can take apart", body: "The VistaDex Score is a weighted mean of the axes that have enough data. Open “How this was calculated” to see every input, weight and what was searched. It describes the evidence, not whether the idea will work." },
  { id: "profile", route: "report", target: "#section-profile", title: "The profile", body: "Each scored axis on one chart, and how the claims came out. An axis without enough data is marked n/a and left out, never counted as zero." },
  { id: "claims", route: "report", target: "#section-claims", title: "Claims and their evidence", body: "Each claim shows its status, why it got it, and the independent sources behind it with their quotes. Unverified is a normal result." },
  { id: "leads", route: "report", target: "#section-graveyard", title: "Leads to check", body: "Products that fetched pages name as already doing something similar, and startups that shut down after trying it. Check whether they are really alike." },
  { id: "objections", route: "report", target: "#section-objections", title: "Objections", body: "The strongest arguments against the idea. Give them the same attention as the claims." },
  { id: "big_tech", route: "report", target: "#section-big_tech", title: "Big Tech risk", body: "Whether a big platform company already offers something similar. A company counts only with 2 independent sources; fewer stays unverified." },
  { id: "legal", route: "report", target: "#section-legal", title: "Legal and market", body: "Registries, rules and market size for your target markets. Where this version can't produce them, the section says so." },
  { id: "finish", route: "report", title: "That's the tour", body: "Replay it any time with the ? button. Your reports are listed on the Reports page; How it works explains every formula." },
];
const GATE = STEPS.findIndex(s => s.gate === "run");
const FIRST_REPORT = STEPS.findIndex(s => s.route === "report");
// The page's sticky offset (html scroll-padding-top, index.css): what the sticky header and chip bar cover.
const stickyOffset = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;

// ── state ──
let active = false;
let index = 0;
const listeners = new Set<() => void>();
let snapshot = { active, index };
const emit = () => { snapshot = { active, index }; listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useWalkthrough = () => useSyncExternalStore(subscribe, () => snapshot);

function show(i: number, endedBy: "next" | "back" = "next") {
  if (endedBy === "back") telemetry.walkthroughStepEnded("back");
  index = i;
  telemetry.walkthroughStep(STEPS[i].id);
  emit();
}
export function startWalkthrough(from: "welcome" | "help" | "how_it_works") {
  if (!features.walkthrough) return;
  if (active) telemetry.walkthroughEnded("skip", STEPS[index].id);
  active = true;
  telemetry.walkthroughStarted(from);
  show(0);
  navigate(PATHS.screen);
}
function next() { if (index < STEPS.length - 1 && !STEPS[index].gate) show(index + 1); }
function back() { if (index > 0) show(index - 1, "back"); }
function end(how: "skip" | "done") { telemetry.walkthroughEnded(how, STEPS[index].id); active = false; emit(); }

// Where "Resume tour" goes for the current step.
function stepPath(step: Step) {
  if (step.route === "screen") return PATHS.screen;
  const last = latestSessionReport();
  return last ? reportPath(last.id) : PATHS.report;
}

/** Follows the run: gate → hidden while running → first report step; cancel/failure → back to the gate. */
function useRunGate(on: boolean) {
  const run = useRun();
  const previous = useRef(run.status);
  useEffect(() => {
    const was = previous.current;
    previous.current = run.status;
    if (!on || was === run.status) return;
    if (run.status === "running" && index < GATE) show(GATE); // Run pressed before reaching the gate step
    if (was === "running" && run.status === "done" && index <= GATE) show(FIRST_REPORT);
    if (was === "running" && (run.status === "cancelled" || run.status === "failed") && index >= GATE) show(GATE);
  }, [on, run.status]);
  return run.status === "running";
}

export function Walkthrough({ route }: { route: RouteName }) {
  const { active: on, index: i } = useWalkthrough();
  const step = STEPS[i];
  const running = useRunGate(on);
  const cardRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [missing, setMissing] = useState(false);
  const [inView, setInView] = useState(false); // the target was on screen already, so the page didn't scroll

  const here = on && !running && step.route === route;

  // Measure the target in DOCUMENT coordinates (they don't change while the page scrolls), scroll it
  // into view on every step change, and re-measure when the layout changes.
  useLayoutEffect(() => {
    setBox(null);
    setMissing(false);
    if (!here || !step.target) return;
    const el = document.querySelector<HTMLElement>(step.target);
    if (!el) { setMissing(true); return; }
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height });
    };
    measure();
    // Scroll only when the target isn't already fully on screen below the sticky header; then put it at the
    // top (block "start" honours the page's scroll-padding), so the page title is never left half under it.
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = el.getBoundingClientRect();
    const fits = r.top >= stickyOffset() && r.bottom <= window.innerHeight;
    setInView(fits);
    if (!fits) el.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(document.body);
    addEventListener("resize", measure);
    return () => { ro.disconnect(); removeEventListener("resize", measure); };
  }, [here, step, route]);

  // A step whose target isn't on this page is skipped forward rather than shown without one.
  useEffect(() => { if (here && missing && i < STEPS.length - 1 && !step.gate) show(i + 1); }, [here, missing, i, step]);

  useEffect(() => { if (here) cardRef.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true }); }, [here, i]);

  if (!on || running) return null;

  if (!here) {
    // Paused: the visitor left the step's page.
    return createPortal(
      <div className="on-page fixed bottom-24 right-4 z-50 md:bottom-6 md:right-6 print:hidden">
        <Button variant="lime" onClick={() => navigate(stepPath(step))} data-control="walkthrough_resume">
          <Play aria-hidden className="fill-current" /> Resume tour
        </Button>
      </div>,
      document.body,
    );
  }

  const wide = matchMedia("(min-width: 768px)").matches; // same breakpoint as the CSS (md)
  // Desktop: beside the target (below, else above) in document coordinates; if it fits neither, docked.
  const CARD_H = Math.max(260, cardRef.current?.offsetHeight ?? 0); // the last rendered card, if taller
  const vh = window.innerHeight;
  // Target and card fit on screen together (below the sticky header) — and, when the page didn't scroll
  // because the target was already in view, the card below or above it is on screen too; else it docks.
  const fitsBeside = (top: number) => !inView || (top >= window.scrollY + stickyOffset() && top + CARD_H <= window.scrollY + vh);
  const belowTop = box ? box.top + box.height + 16 : 0;
  const below = box !== null && fitsBeside(belowTop) && belowTop + CARD_H <= document.documentElement.scrollHeight;
  const placed = wide && box && box.height + 16 + CARD_H < vh - stickyOffset() && (below || fitsBeside(box.top - 16 - CARD_H));
  const style: CSSProperties = {};
  if (placed && box) {
    style.top = below ? belowTop : Math.max(16, box.top - 16 - CARD_H);
    style.left = Math.min(Math.max(16, box.left), document.documentElement.clientWidth - 16 - 352);
  }
  const gated = Boolean(step.gate);

  return createPortal(
    <>
      {box && (
        <div aria-hidden data-testid="tour-highlight" className="pointer-events-none absolute z-[45] rounded-card outline outline-[3px] outline-offset-4 outline-lime print:hidden"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />
      )}
      <div ref={cardRef} role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-body" data-testid="tour-card"
        className={placed
          ? "on-page absolute z-50 w-[22rem] rounded-card bg-charcoal p-5 text-on-charcoal print:hidden"
          : "on-page fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-card bg-charcoal p-5 text-on-charcoal md:bottom-6 md:left-auto md:right-6 md:mx-0 md:w-[22rem] print:hidden"}
        style={style}>
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow text-lime">Walkthrough · {i + 1} of {STEPS.length}</p>
          <button type="button" onClick={() => end("skip")} data-control="walkthrough_skip" className="-mr-1 -mt-1 inline-flex items-center gap-1 rounded-control px-1.5 py-1 text-sm text-on-charcoal-muted hover:text-on-charcoal">
            Skip tour <X aria-hidden className="size-4" />
          </button>
        </div>
        <h2 id="tour-title" tabIndex={-1} className="mt-2 font-display text-[1.5rem] leading-tight outline-none">{step.title}</h2>
        <p id="tour-body" className="mt-2 text-[0.9375rem] leading-relaxed text-on-charcoal">{step.body}</p>
        {gated && <p id="tour-gate" className="mt-3 font-mono text-xs uppercase tracking-[0.08em] text-lime">Press Run to continue</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {i > 0 && step.id !== "finish" && i !== FIRST_REPORT && (
            <Button variant="outline-page" onClick={back} data-control="walkthrough_back"><ArrowLeft aria-hidden /> Back</Button>
          )}
          {step.id === "finish" ? (
            <>
              <Button variant="lime" onClick={() => end("done")} data-control="walkthrough_done">Done</Button>
              <a href={href(PATHS.how)} onClick={() => end("done")} data-control="walkthrough_how_it_works" className="px-2 text-sm font-medium text-lime underline underline-offset-4">How it works</a>
            </>
          ) : (
            <Button variant="lime" onClick={next} disabled={gated} aria-describedby={gated ? "tour-gate" : undefined} data-control="walkthrough_next">
              Next <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Test helper. */
export function _resetWalkthrough() { active = false; index = 0; emit(); }
