// ── study/ComparePage.tsx — the study's last step: the AI chatbot's answer or the VistaDex report ──
// Shown once both parts are finished. Six forced choices (chatbot / VistaDex / about the same) and an
// optional reason. The two tools' options swap places by the code's number (odd: chatbot first), so a
// preference for the first option cannot pass for a preference for one tool; the order is recorded.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui-vd";
import { navigate, PATHS } from "@/router";
import { flushNow } from "@/telemetry";
import { Choice } from "./ReportStudyPanel";
import { currentParticipant, studyComplete } from "./participant";
import { startNewParticipant } from "./fresh";
import { logToolPreference, type Pick, type Preference } from "./studyEvents";

const PICK_CONTROL = { chatbot: "compare_pick_chatbot", vistadex: "compare_pick_vistadex", same: "compare_pick_same" } as const;
type Key = "overall" | "accuracy" | "evidence" | "risks" | "honesty" | "decision";
export const PREFERENCE_QUESTIONS: [Key, string][] = [
  ["overall", "Overall, which helped you more to judge this idea?"],
  ["accuracy", "Which made it clearer which claims about the idea are true or false?"],
  ["evidence", "Which gave you evidence you could check yourself?"],
  ["risks", "Which told you more about competitors, failed startups and risks?"],
  ["honesty", "Which was more honest about what it didn't know?"],
  ["decision", "Which would you rather rely on for a real decision about an idea?"],
];

export function ComparePage() {
  const p = currentParticipant();
  const num = parseInt((p?.code ?? "").replace(/\D/g, ""), 10);
  const optionsOrder: Preference["optionsOrder"] = Number.isFinite(num) && num % 2 === 0 ? "vistadex_first" : "chatbot_first";
  const tools: [Exclude<Pick, null>, string][] = optionsOrder === "chatbot_first"
    ? [["chatbot", "The AI chatbot"], ["vistadex", "VistaDex"], ["same", "About the same"]]
    : [["vistadex", "VistaDex"], ["chatbot", "The AI chatbot"], ["same", "About the same"]];
  const [picks, setPicks] = useState<Record<Key, Pick>>({ overall: null, accuracy: null, evidence: null, risks: null, honesty: null, decision: null });
  const [why, setWhy] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!p || p.track !== "study" || !studyComplete(p)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Panel tab="Compare" as="section">
          <h1 className="font-display text-3xl">Finish both parts first</h1>
          <p className="mt-3 text-[0.9375rem]">The comparison comes after the AI chatbot part and the VistaDex part.</p>
          <Button className="mt-5" data-control="compare_back" onClick={() => navigate(PATHS.study)}>Go to the study page</Button>
        </Panel>
      </div>
    );
  }

  const submit = () => {
    if (!picks.overall) { setErr("Answer the first question (overall)."); return; }
    logToolPreference({ ...picks, optionsOrder, why });
    flushNow().catch(() => {});
    setDone(true);
  };
  const next = async () => { setBusy(true); await startNewParticipant(); navigate(PATHS.study); };

  if (done) {
    return (
      <div className="mx-auto max-w-2xl">
        <Panel tab="Done" as="section">
          <h1 className="font-display text-3xl">You've finished both parts</h1>
          <p className="mt-4 text-[0.9375rem] leading-relaxed">Thank you. Your answers for both tools are recorded, and there is nothing more to do.</p>
          <div className="mt-5 rounded-card bg-card p-4 text-sm leading-relaxed">
            <p><b>For the person running the study:</b> before the next participant, press the button below. It starts a fresh participant in this browser.</p>
            <Button className="mt-3" variant="outline" data-control="study_next_participant" onClick={next} disabled={busy}>Next participant</Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Panel tab="Last step: compare" as="section">
        <h1 className="font-display text-3xl">The AI chatbot or VistaDex?</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-foreground/80">You judged the same idea with both. Think of the chatbot's answer and the VistaDex report as a whole.</p>
        <div className="mt-5 space-y-4">
          {PREFERENCE_QUESTIONS.map(([k, q]) => (
            <fieldset key={k} className="rounded-card bg-card p-4">
              <legend className="text-sm font-medium">{q}</legend>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-3 sm:gap-2">
                {tools.map(([v, label]) => (
                  <Choice key={v} name={`compare_${k}`} checked={picks[k] === v} onSelect={() => { setPicks(s => ({ ...s, [k]: v })); setErr(""); }} control={PICK_CONTROL[v]}>{label}</Choice>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <label className="mt-5 block">
          <span className="text-sm font-medium">Why? What made one better, or what did each miss? (optional)</span>
          <textarea className="mt-1 min-h-24 w-full rounded-control border-2 border-input bg-card px-3 py-2 outline-none focus:border-foreground"
            value={why} onChange={e => setWhy(e.target.value)} maxLength={2000} data-control="compare_why_field" />
        </label>
        {err && <p role="alert" className="mt-3 text-sm font-medium text-foreground">{err}</p>}
        <Button className="mt-5" data-control="compare_submit" onClick={submit}>Submit and finish</Button>
      </Panel>
    </div>
  );
}
