// ── Walkthrough (public edition) — coach marks across Screen an idea → Running → Report ──
// Never blocks the tool: no backdrop, the page stays usable, every step can be skipped, and steps that
// wait for something (pressing Run, the screening finishing) move on by themselves. Replayable from "?".
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { features } from "@/edition";
import { href, navigate, PATHS, type RouteName } from "@/router";
import * as telemetry from "@/telemetry";

interface Step { id: string; route: RouteName | null; target?: string; title: string; body: string; waits?: string }
export const STEPS: Step[] = [
  { id: "idea", route: "screen", target: "[data-tour=idea]", title: "Paste an idea", body: "Write it the way you would pitch it: what you are building, for whom, and why nobody has done it. VistaDex looks for the claims in it." },
  { id: "samples", route: "screen", target: "[data-tour=samples]", title: "Or load a sample", body: "No idea handy? Load one of the samples to see how a report looks." },
  { id: "markets", route: "screen", target: "[data-tour=markets]", title: "Pick target markets", body: "Optional. The report's Legal section covers the markets you pick here." },
  { id: "run", route: "screen", target: "[data-tour=run]", title: "Press Run", body: "The screening takes a few seconds. The tour carries on when it starts.", waits: "Waiting for you to press Run" },
  { id: "tracker", route: "running", target: "[data-tour=tracker]", title: "Five steps, in order", body: "Your idea is split into claims, each claim is checked against independent sources, then the graveyard is searched and objections are written. You can cancel at any time.", waits: "The report opens by itself when it's ready" },
  { id: "summary", route: "report", target: "#section-summary", title: "Counts, not a score", body: "How many claims ended up in each status. There is no overall score or verdict: the report gives evidence and you decide." },
  { id: "claims", route: "report", target: "#section-claims", title: "Claims and their evidence", body: "Each claim shows its status, why it got it, and how many independent sources back it. Open the sources and read them yourself. Unverified is a normal result." },
  { id: "leads", route: "report", target: "#section-graveyard", title: "Leads to check", body: "Startups that shut down after trying something similar, and why. Matching is by shared words, so check whether they are really alike." },
  { id: "objections", route: "report", target: "#section-objections", title: "Objections", body: "The strongest arguments against the idea. Give them the same attention as the claims." },
  { id: "legal", route: "report", target: "#section-legal", title: "Legal and market", body: "Registries, rules and market size for your target markets. Not produced in this version yet; the sections say so." },
  { id: "finish", route: null, title: "That's the tour", body: "Replay it any time with the ? button. How it works explains the evidence rule and the limits of this prototype." },
];

// ── state ──
let active = false;
let index = 0;
const listeners = new Set<() => void>();
let snapshot = { active, index };
const emit = () => { snapshot = { active, index }; listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useWalkthrough = () => useSyncExternalStore(subscribe, () => snapshot);

function show(i: number) {
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
function next() { if (index < STEPS.length - 1) show(index + 1); }
function back() { if (index > 0) { telemetry.walkthroughStepEnded("back"); index -= 1; telemetry.walkthroughStep(STEPS[index].id); emit(); } }
function end(how: "skip" | "done") { telemetry.walkthroughEnded(how, STEPS[index].id); active = false; emit(); }

export function Walkthrough({ route }: { route: RouteName }) {
  const { active: on, index: i } = useWalkthrough();
  const step = STEPS[i];
  const cardRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Steps that wait move on when the visitor reaches the screen the next steps are about.
  useEffect(() => {
    if (!on || !step.waits || step.route === route) return;
    const later = STEPS.findIndex((s, k) => k > i && s.route === route);
    if (later !== -1) show(later);
  }, [on, route, i, step]);

  const here = on && (step.route === null || step.route === route);
  const target = here && step.target ? document.querySelector<HTMLElement>(step.target) : null;

  // Bring the target into view, then follow it while the page scrolls or resizes.
  useEffect(() => {
    if (!here || !step.target) { setRect(null); return; }
    const el = document.querySelector<HTMLElement>(step.target);
    if (!el) { setRect(null); return; }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Phones: the card docks at the bottom, so put the target at the top, above it.
    const narrow = !matchMedia("(min-width: 768px)").matches;
    el.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: narrow ? "start" : "center" });
    let frame = 0;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setRect(el.getBoundingClientRect())); };
    update();
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); removeEventListener("scroll", update); removeEventListener("resize", update); };
  }, [here, step, route, target]);

  useLayoutEffect(() => { if (on) cardRef.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true }); }, [on, i]);

  if (!on) return null;
  const wide = matchMedia("(min-width: 768px)").matches; // same breakpoint as the CSS (md)
  // Beside the target when the card fits below or above it; otherwise docked in a corner, never on top of it.
  const CARD_H = 260;
  const style: CSSProperties = {};
  const fitsBelow = rect ? rect.bottom + 16 + CARD_H < window.innerHeight : false;
  const fitsAbove = rect ? rect.top - 16 - CARD_H > 16 : false;
  const placed = wide && rect && (fitsBelow || fitsAbove);
  if (placed) {
    style.top = fitsBelow ? rect.bottom + 16 : rect.top - 16 - CARD_H;
    style.left = Math.min(Math.max(16, rect.left), window.innerWidth - 16 - 352);
  }

  return (
    <>
      {rect && (
        <div aria-hidden className="pointer-events-none fixed z-[45] rounded-card outline outline-[3px] outline-offset-4 outline-lime motion-safe:transition-all motion-safe:duration-200"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
      )}
      <div ref={cardRef} role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-body"
        className={placed
          ? "on-page fixed z-50 w-[22rem] rounded-card bg-charcoal p-5 text-on-charcoal print:hidden"
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
        {!here && step.route && (
          <p className="mt-2 text-sm text-on-charcoal-muted">This step is about the {step.route === "screen" ? "Screen an idea" : step.route === "running" ? "progress" : "report"} screen.</p>
        )}
        {step.waits && here && <p className="mt-3 font-mono text-xs uppercase tracking-[0.08em] text-lime" aria-live="polite">{step.waits}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {i > 0 && step.id !== "finish" && (
            <Button variant="outline-page" onClick={back} data-control="walkthrough_back"><ArrowLeft aria-hidden /> Back</Button>
          )}
          {step.id === "finish" ? (
            <>
              <Button variant="lime" onClick={() => end("done")} data-control="walkthrough_done">Done</Button>
              <a href={href(PATHS.how)} onClick={() => end("done")} data-control="walkthrough_how_it_works" className="px-2 text-sm font-medium text-lime underline underline-offset-4">How it works</a>
            </>
          ) : (
            // Always offered, even on steps that wait, so the tour never blocks anything.
            <Button variant={step.waits && here ? "outline-page" : "lime"} onClick={next} data-control="walkthrough_next">Next <ArrowRight aria-hidden /></Button>
          )}
        </div>
      </div>
    </>
  );
}

/** Test helper. */
export function _resetWalkthrough() { active = false; index = 0; emit(); }
