// ── StudyUI.tsx — Participant-facing study surfaces (restyled; behaviour as the pilot-1 vanilla UI) ──
// Consent dialog, study bar, withdraw dialogs, trust sliders, end survey. Every
// event is logged through study/controller.ts with the original payloads.

import { useEffect, useId, useRef, useState } from "react";
import { Download, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { studyConfig } from "@/proto";
import * as study from "./controller";
import { useStudyState } from "./useStudy";

const { CONSENT, TRUST_PRE, TRUST_POST, SCALE, SURVEY } = studyConfig;
const POINTS = Array.from({ length: SCALE.max - SCALE.min + 1 }, (_, k) => SCALE.min + k);

// ── Consent ───────────────────────────────────────────────────────────
// A choice is required: no close button, Esc and outside clicks do nothing.
export function ConsentDialog({ open, onDone }: { open: boolean; onDone: () => void }) {
  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl sm:p-0"
      >
        {/* The text scrolls; the two choices stay visible underneath it. */}
        <div tabIndex={0} role="region" aria-label="Study information" className="overflow-y-auto p-6 focus-visible:outline-offset-[-4px] sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-[1.75rem] sm:text-3xl">{CONSENT.title}</DialogTitle>
            <DialogDescription className="sr-only">Study information and consent</DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-4 text-[0.9375rem] leading-relaxed">
            {CONSENT.paragraphs.map((p: string) => <p key={p}>{p}</p>)}
          </div>
        </div>
        <DialogFooter className="m-0 shrink-0 flex-col-reverse gap-3 sm:m-0 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" onClick={() => { study.declineConsent(); onDone(); }}>{CONSENT.decline}</Button>
          <Button size="lg" onClick={() => { study.giveConsent(); onDone(); }}>{CONSENT.agree}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Study bar + withdraw ──────────────────────────────────────────────
export function StudyBar({ onReadInfo }: { onReadInfo: () => void }) {
  const { consent, sessionCode } = useStudyState();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  // Dialogs are opened from state, so put focus back on the bar's first button when they close.
  const returnFocus = (e: Event) => { e.preventDefault(); barRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); };

  async function withdraw() {
    setConfirming(false);
    const res = await study.withdraw();
    setResult(res.server.startsWith("failed")
      ? `Your local data is deleted. The server could not be reached (${res.server}). Please contact ${studyConfig.WITHDRAWAL_CONTACT} with your session code ${res.session_id?.slice(0, 8).toUpperCase()} so we can delete it.`
      : "You have withdrawn. Your data has been deleted.");
  }

  const dialogs = (
    <>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={e => { e.preventDefault(); barRef.current?.querySelector<HTMLButtonElement>("[data-withdraw]")?.focus(); }}>
          <DialogHeader>
            <DialogTitle>Withdraw from the study?</DialogTitle>
            <DialogDescription className="text-[0.9375rem] text-foreground">
              This deletes your data from this browser and asks our server to delete it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" size="lg" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button size="lg" onClick={withdraw}>Withdraw and delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={result !== null} onOpenChange={o => { if (!o) setResult(null); }}>
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={returnFocus}>
          <DialogHeader>
            <DialogTitle>Withdrawn</DialogTitle>
            <DialogDescription className="text-[0.9375rem] text-foreground">{result}</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button size="lg" onClick={() => setResult(null)}>OK</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (consent === null) return dialogs;
  return (
    <>
      <div ref={barRef} className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-card px-4 py-3 shadow-card sm:px-5">
        {consent === "given" ? (
          <>
            <span className="inline-flex items-center gap-2.5 text-sm">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-muted"><FlaskConical aria-hidden className="size-4" /></span>
              Study session <span className="font-mono font-medium">{sessionCode}</span>
              <span className="text-muted-foreground">anonymous</span>
            </span>
            <span className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={study.exportJSON}><Download aria-hidden /> My data (JSON)</Button>
              <Button variant="outline" onClick={study.exportCSV}>CSV</Button>
              <Button variant="outline" data-withdraw onClick={() => setConfirming(true)}>Withdraw &amp; delete my data</Button>
            </span>
          </>
        ) : (
          <>
            <span className="text-sm">Not taking part in the study. Nothing is recorded.</span>
            <Button variant="outline" onClick={onReadInfo}>Read the study information</Button>
          </>
        )}
      </div>
      {dialogs}
    </>
  );
}

// ── Trust slider ──
// Native range input. It reports through the native "change" event (fires on release and on
// each keyboard step), the same event the original UI listened to, not React's per-move onChange.
export function TrustSlider({ id, cfg, onCommit }: {
  id: string; cfg: { prompt: string; low: string; high: string }; onCommit: (value: number) => void;
}) {
  const [touched, setTouched] = useState(false);
  const [value, setValue] = useState((SCALE.min + SCALE.max) / 2);
  const ref = useRef<HTMLInputElement>(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onNativeChange = () => { setTouched(true); setValue(Number(el.value)); commit.current(Number(el.value)); };
    el.addEventListener("change", onNativeChange);
    return () => el.removeEventListener("change", onNativeChange);
  }, []);
  return (
    <div>
      <label htmlFor={id} className="block font-display text-xl font-bold leading-snug">{cfg.prompt}</label>
      <input
        ref={ref}
        id={id}
        type="range"
        min={SCALE.min}
        max={SCALE.max}
        step={1}
        value={value}
        aria-valuetext={touched ? `${value} of ${SCALE.max}` : "not answered yet"}
        onChange={e => { setTouched(true); setValue(Number(e.currentTarget.value)); }}
        className={cn("trust-range mt-5 w-full", !touched && "untouched")}
      />
      {/* Labels sit under the thumb positions: the thumb centre runs from 14px to (width - 14px). */}
      <div aria-hidden className="mt-1 flex justify-between font-mono text-xs text-muted-foreground">
        {POINTS.map(p => <span key={p} className={cn("w-7 text-center", touched && p === value && "font-semibold text-primary")}>{p}</span>)}
      </div>
      <div className="mt-1 flex justify-between gap-4 text-sm text-muted-foreground">
        <span>{cfg.low}</span>
        <span className="font-medium text-foreground">{touched ? `Your answer: ${value}` : "Move the slider"}</span>
        <span className="text-right">{cfg.high}</span>
      </div>
    </div>
  );
}

// Pre-use question: required once before the first run, hidden as soon as a run starts.
export function TrustPre() {
  const { participating, trustPreDone } = useStudyState();
  if (!participating || trustPreDone) return null;
  return (
    <div className="rounded-panel bg-card p-5 shadow-card sm:p-7">
      <TrustSlider id="trustPreInput" cfg={TRUST_PRE} onCommit={v => study.logTrustPre(v)} />
    </div>
  );
}

// ── Post-use trust + survey ───────────────────────────────────────────
export function FinishCard({ runId }: { runId: string }) {
  const { sessionCode } = useStudyState();
  const [trustPost, setTrustPost] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const commentsId = useId();
  const ready = trustPost !== null && SURVEY.likert.every((it: { id: string }) => answers[it.id] !== undefined);

  if (submitted) {
    return (
      <div className="rounded-panel bg-card p-6 shadow-panel sm:p-8">
        <h2 className="font-display text-[1.75rem] font-bold leading-tight">Thank you</h2>
        <p className="mt-3 max-w-[62ch] text-[0.9375rem] leading-relaxed">
          Your answers are saved under session code <span className="font-mono font-medium">{sessionCode}</span>. You can screen another idea, download your data, or withdraw at any time from the bar at the top.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="finish-title" className="space-y-7 rounded-panel bg-card p-6 shadow-panel sm:p-8">
      <h2 id="finish-title" className="font-display text-[1.75rem] font-bold leading-tight">Finished reviewing? Tell us what you think</h2>
      <div className="rounded-card bg-muted p-5 sm:p-6">
        <TrustSlider id="trustPostInput" cfg={TRUST_POST} onCommit={setTrustPost} />
      </div>
      <div className="space-y-4">
        <h3 className="font-display text-xl font-bold">{SURVEY.title}</h3>
        <p className="text-sm text-muted-foreground">1 = strongly disagree, 7 = strongly agree</p>
        {SURVEY.likert.map((item: { id: string; text: string }) => (
          <fieldset key={item.id} className="rounded-card bg-muted p-4 sm:p-5">
            <legend className="sr-only">{item.text}</legend>
            <p aria-hidden className="text-[0.9375rem] font-medium">{item.text}</p>
            <div className="mt-3 grid grid-cols-7 gap-1.5 sm:max-w-md">
              {POINTS.map(v => (
                <label key={v} className="relative">
                  <input
                    type="radio"
                    name={`sv-${item.id}`}
                    value={v}
                    checked={answers[item.id] === v}
                    onChange={() => setAnswers(a => ({ ...a, [item.id]: v }))}
                    className="peer sr-only"
                    aria-label={`${v}${v === SCALE.min ? " (strongly disagree)" : v === SCALE.max ? " (strongly agree)" : ""}`}
                  />
                  <span className="flex h-10 cursor-pointer items-center justify-center rounded-full border border-input bg-card font-mono text-sm transition-colors duration-150 hover:bg-accent peer-checked:border-primary peer-checked:bg-primary peer-checked:hover:bg-primary peer-checked:font-medium peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                    {v}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div>
        <label htmlFor={commentsId} className="text-[0.9375rem] font-medium">{SURVEY.freeText.text}</label>
        <Textarea id={commentsId} value={comments} onChange={e => setComments(e.target.value)} maxLength={2000} className="mt-3 min-h-24" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {ready ? "Ready to submit." : `Answer the slider and all ${SURVEY.likert.length} statements to submit.`}
        </span>
        <Button size="lg" disabled={!ready} onClick={() => {
          if (!ready || trustPost === null) return;
          study.submitSurvey(runId, trustPost, answers, SURVEY.freeText.id, comments.trim());
          setSubmitted(true);
        }}>Submit</Button>
      </div>
    </section>
  );
}
