// ── Feedback (public edition) — a short form, stored through the existing /events endpoint ──
// Sent as one feedback_submitted event under a new random id that is NOT the visitor's usage session,
// so an optional email is never joined to usage records. TODO(team): final question wording
// (prototype/ui/study-config.js FEEDBACK).
import { useId, useState, type FormEvent } from "react";
import { Check, LoaderCircle, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageTitle, Panel, Problem } from "@/components/ui-vd";
import { cn } from "@/lib/utils";
import { studyConfig } from "@/proto";
import { navigate, PATHS } from "@/router";
import { clearDraft } from "@/screens/ScreenIdea";
import * as telemetry from "@/telemetry";

const { FEEDBACK } = studyConfig;
type Choice = "role" | "useful" | "section" | "wouldUse";
const CONTROL: Record<Choice, string> = { role: "feedback_role", useful: "feedback_useful", section: "feedback_section", wouldUse: "feedback_would_use" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Feedback() {
  const [answers, setAnswers] = useState<Record<Choice, string | null>>({ role: null, useful: null, section: null, wouldUse: null });
  const [wrong, setWrong] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"editing" | "sending" | "sent" | "not-configured" | "failed">("editing");
  const [problem, setProblem] = useState<string | null>(null);
  const wrongId = useId();
  const emailId = useId();
  const emailHint = useId();

  const empty = Object.values(answers).every(v => v === null) && !wrong.trim() && !email.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (empty) { setProblem("Answer at least one question first."); return; }
    if (email.trim() && !EMAIL.test(email.trim())) { setProblem("That email address doesn't look right. Fix it or leave it empty."); document.getElementById(emailId)?.focus(); return; }
    setProblem(null);
    setState("sending");
    const res = await telemetry.sendFeedback({
      role: answers.role, useful: answers.useful, section: answers.section, would_use: answers.wouldUse,
      wrong: wrong.trim().slice(0, 2000), email: email.trim() || null,
    });
    setState(res === "sent" ? "sent" : res === "not-configured" ? "not-configured" : "failed");
  }

  if (state === "sent" || state === "not-configured") {
    return (
      <div>
        <PageTitle eyebrow="Feedback" title="Thank you" />
        <Panel className="max-w-2xl">
          <p className="flex items-start gap-3 text-[1.0625rem] leading-relaxed">
            <Check aria-hidden className="mt-1 size-5 shrink-0" />
            {state === "sent"
              ? "Your answers are saved. We read every one."
              : "This copy of VistaDex has no server connected (mock mode), so your answers were not sent anywhere."}
          </p>
          <Button size="lg" className="mt-6" onClick={() => { clearDraft(); navigate(PATHS.screen); }} data-control="feedback_screen_another">
            <RotateCcw aria-hidden /> Screen another idea
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageTitle eyebrow="Feedback" title="What did you think?">
        Five quick questions, all optional. Your answers are stored separately from your usage records.
      </PageTitle>
      <form onSubmit={submit} noValidate className="max-w-3xl space-y-4">
        <Panel>
          <div className="space-y-7">
            <ChoiceGroup name="role" q={FEEDBACK.role} value={answers.role} onChange={v => setAnswers(a => ({ ...a, role: v }))} control={CONTROL.role} />
            <ChoiceGroup name="useful" q={FEEDBACK.useful} value={answers.useful} onChange={v => setAnswers(a => ({ ...a, useful: v }))} control={CONTROL.useful} />
            <ChoiceGroup name="section" q={FEEDBACK.section} value={answers.section} onChange={v => setAnswers(a => ({ ...a, section: v }))} control={CONTROL.section} />
            <div>
              <label htmlFor={wrongId} className="font-semibold">{FEEDBACK.wrong.question}</label>
              <p className="mt-0.5 text-sm text-muted-foreground">{FEEDBACK.wrong.hint}</p>
              <Textarea id={wrongId} data-control="feedback_wrong" value={wrong} onChange={e => setWrong(e.target.value)} maxLength={2000} className="mt-2 min-h-28 bg-card" />
            </div>
            <ChoiceGroup name="wouldUse" q={FEEDBACK.wouldUse} value={answers.wouldUse} onChange={v => setAnswers(a => ({ ...a, wouldUse: v }))} control={CONTROL.wouldUse} />
            <div>
              <label htmlFor={emailId} className="font-semibold">{FEEDBACK.email.question}</label>
              <p id={emailHint} className="mt-0.5 text-sm text-muted-foreground">{FEEDBACK.email.hint}</p>
              <input id={emailId} type="email" autoComplete="email" data-control="feedback_email" value={email} onChange={e => setEmail(e.target.value)}
                aria-describedby={emailHint} className="mt-2 h-11 w-full max-w-md rounded-control border border-input bg-card px-3 text-[0.9375rem]" />
            </div>
          </div>
        </Panel>
        {problem && <div className="on-light"><Problem title={problem} /></div>}
        {state === "failed" && <div className="on-light"><Problem title="Your answers could not be sent">Check your connection and press Send again; nothing you typed is lost.</Problem></div>}
        <Button type="submit" size="lg" variant="lime" disabled={state === "sending"} data-control="feedback_submit">
          {state === "sending" ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : <Send aria-hidden />} Send feedback
        </Button>
      </form>
    </div>
  );
}

function ChoiceGroup({ name, q, value, onChange, control }: {
  name: string; q: { question: string; options: string[][] }; value: string | null; onChange: (v: string) => void; control: string;
}) {
  return (
    <fieldset>
      <legend className="font-semibold">{q.question}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {q.options.map(([v, label]) => (
          <label key={v} className={cn("relative inline-flex h-10 cursor-pointer items-center gap-2 rounded-control border px-3.5 text-sm font-medium transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
            value === v ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent")}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} data-control={control} data-control-value={v} className="sr-only" />
            {value === v && <Check aria-hidden className="size-4" />}
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
