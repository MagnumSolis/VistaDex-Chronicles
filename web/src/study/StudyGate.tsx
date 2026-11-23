// ── study/StudyGate.tsx — participant registration (the two tracks).
// Shown before the main app for study links; the plain public link skips
// straight to Welcome. Field visitors (LinkedIn) choose "just try the demo".
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui-vd";
import { ROLES, OWN_IDEA, registerStudyParticipant, registerFieldParticipant, setOwnIdea, studyIdeaKeys, studyIdeaInput, currentParticipant, conditionDone, type StudyInput } from "./participant";
import { startNewParticipant } from "./fresh";
import { takeTarget } from "@/lib/gate";
import { navigate } from "@/router";
import { FIELD_LIMITS, REQUIRED_FIELDS } from "@proto/core/input.js";

// The participant's own idea: the same fields as Screen an idea, so both parts get exactly this text.
const OWN_FIELDS: { id: keyof StudyInput; label: string; rows: number }[] = [
  { id: "title", label: "Idea title", rows: 1 },
  { id: "pitch", label: "One-line pitch", rows: 2 },
  { id: "problem", label: "Problem", rows: 3 },
  { id: "solution", label: "Solution", rows: 3 },
  { id: "moat", label: "What makes yours different / moat (optional)", rows: 2 },
];
const emptyOwn = (): StudyInput => ({ title: "", pitch: "", problem: "", solution: "", moat: "" });
import { logParticipantRegistered } from "./studyEvents";

export function StudyGate({ onDone }: { onDone: () => void }) {
  // The person who used this browser last (study track). The form starts empty: a new participant types
  // their own code, and the one before can carry on with "Continue as".
  const [previous, setPrevious] = useState(() => { const p = currentParticipant(); return p?.track === "study" && p.code ? p : null; });
  const [mode, setMode] = useState<"choose" | "study" | "field">(previous ? "study" : "choose");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [ideaKey, setIdeaKey] = useState<string>(studyIdeaKeys()[0]);
  const [own, setOwn] = useState<StudyInput>(emptyOwn);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const progress = (p: NonNullable<typeof previous>) => {
    const done = (["baseline", "vistadex"] as const).filter(c => conditionDone(p, c)).length;
    return done === 2 ? "finished both parts" : done === 1 ? "finished one part" : "not finished a part yet";
  };
  const fresh = async () => { setBusy(true); await startNewParticipant(); setPrevious(null); setBusy(false); };
  const resume = () => navigate(takeTarget());

  const startStudy = async () => {
    const clean = code.trim();
    if (clean.length < 2) { setErr("Pick a participant code (e.g. P07, anything you'll remember)."); return; }
    if (ideaKey === OWN_IDEA && (REQUIRED_FIELDS as string[]).some(f => !own[f as keyof StudyInput].trim())) {
      setErr("Fill in the idea's title, one-line pitch, problem and solution (the moat is optional).");
      return;
    }
    // Anyone but the person before (another code) starts from scratch: their own notice answer and session.
    const before = currentParticipant();
    if (before && !(before.track === "study" && before.code === clean.slice(0, 12) && before.ideaKey === ideaKey)) {
      setBusy(true);
      await startNewParticipant();
      setBusy(false);
    }
    if (ideaKey === OWN_IDEA) setOwnIdea(own);
    const p = registerStudyParticipant(clean, role, ideaKey);
    logParticipantRegistered(p);
    onDone();
  };

  const startField = () => {
    const p = registerFieldParticipant(role);
    logParticipantRegistered(p);
    onDone();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 md:space-y-5">
      <Panel tab="Join the study" as="section">
        <h1 className="font-display text-3xl md:text-4xl">Before you start</h1>
        <p className="mt-3 text-foreground/75">
          This is also a research study on how people judge startup ideas with AI tools.
          You pick how you take part:
        </p>
        {previous && (
          <div className="mt-5 rounded-card bg-card p-4">
            <p className="text-sm leading-relaxed">
              This browser was last used by participant <b className="font-mono">{previous.code}</b> ({progress(previous)}).
              A new participant starts fresh: their own answer to the notice, their own session and no reports from before.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button data-control="study_new_participant" onClick={fresh} disabled={busy}>Start a new participant</Button>
              <Button variant="outline" data-control="study_resume" onClick={resume} disabled={busy}>Continue as {previous.code}</Button>
            </div>
          </div>
        )}
        {mode === "choose" && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-card border-2 border-foreground/10 bg-card p-4">
              <h2 className="font-semibold">A. Compare two tools (~20 min)</h2>
              <p className="mt-2 text-sm text-foreground/75">
                You'll judge the same idea twice: first with an AI chatbot you normally use
                (ChatGPT, Claude, Gemini...), then with VistaDex, and say which helped you more.
                You paste the chatbot's answer here; it is stored with your answers so the two can be compared.
                For recruited participants (you have a participant code).
              </p>
              <Button className="mt-4" data-control="study_track_study" onClick={() => setMode("study")}>I have a participant code</Button>
            </div>
            <div className="rounded-card border-2 border-foreground/10 bg-card p-4">
              <h2 className="font-semibold">B. Just try the demo</h2>
              <p className="mt-2 text-sm text-foreground/75">
                Screen your own idea with VistaDex and rate the report. ~10 minutes.
                No code needed.
              </p>
              <Button className="mt-4" variant="outline" data-control="study_track_field" onClick={() => setMode("field")}>Continue without a code</Button>
            </div>
          </div>
        )}

        {mode === "study" && (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Participant code</span>
              <input
                className="mt-1 w-full rounded-control border-2 border-foreground/10 bg-card px-3 py-2 outline-none focus:border-foreground"
                value={code}
                data-control="study_code_field"
                onChange={e => { setCode(e.target.value); setErr(""); }}
                placeholder="e.g. P07"
                maxLength={12}
              />
            </label>
            <div>
              <span className="text-sm font-medium">I am a…</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {ROLES.map(r => (
                  <button
                    key={r}
                    type="button"
                    data-control="study_role_chip" data-control-value={r}
                    onClick={() => setRole(role === r ? null : r)} aria-pressed={role === r}
                    className={`min-h-11 rounded-control border-2 px-3.5 py-2 text-sm font-medium capitalize transition-colors ${role === r ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-sm font-medium">The idea you'll judge (the same for both tools)</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {studyIdeaKeys().map(k => (
                  <button
                    key={k}
                    type="button"
                    data-control="study_idea_pick" data-control-value={k}
                    onClick={() => setIdeaKey(k)} aria-pressed={ideaKey === k}
                    className={`min-h-11 rounded-control border-2 p-3 text-left text-sm leading-relaxed transition-colors ${ideaKey === k ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent"}`}
                  >
                    <b className="font-mono">Idea {k}</b>: {studyIdeaInput(k).title}
                  </button>
                ))}
                <button
                  type="button"
                  data-control="study_idea_pick" data-control-value={OWN_IDEA}
                  onClick={() => { setIdeaKey(OWN_IDEA); setErr(""); }} aria-pressed={ideaKey === OWN_IDEA}
                  className={`min-h-11 rounded-control border-2 p-3 text-left text-sm leading-relaxed transition-colors sm:col-span-2 ${ideaKey === OWN_IDEA ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent"}`}
                >
                  <b>My own idea</b>: type an idea you are actually considering
                </button>
              </div>
            </div>
            {ideaKey === OWN_IDEA && (
              <div className="space-y-3 rounded-card bg-card p-4">
                <p className="text-sm text-foreground/75">
                  Write it once here; the same text goes into the chatbot prompt and into VistaDex. Because you take part in the comparison, the chatbot's answer you paste and your VistaDex report (both mention the idea) are stored with your study answers.
                </p>
                {OWN_FIELDS.map(f => (
                  <label key={f.id} className="block">
                    <span className="text-sm font-medium">{f.label}</span>
                    <textarea
                      rows={f.rows}
                      data-control={`idea_${f.id}`}
                      maxLength={(FIELD_LIMITS as Record<string, number>)[f.id]}
                      value={own[f.id]}
                      onChange={e => { const v = e.target.value; setOwn(o => ({ ...o, [f.id]: v })); setErr(""); }}
                      className="mt-1 w-full rounded-control border-2 border-input bg-background px-3 py-2 text-[0.9375rem] outline-none focus:border-foreground"
                    />
                  </label>
                ))}
              </div>
            )}
            {err && <p role="alert" className="text-sm font-medium text-foreground">{err}</p>}
            <Button data-control="study_start" onClick={startStudy} disabled={busy}>Start part 1 →</Button>
          </div>
        )}

        {mode === "field" && (
          <div className="mt-5 space-y-4">
            <div>
              <span className="text-sm font-medium">I am a… (optional)</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {ROLES.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(role === r ? null : r)} aria-pressed={role === r}
                    className={`min-h-11 rounded-control border-2 px-3.5 py-2 text-sm font-medium capitalize transition-colors ${role === r ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <Button data-control="study_continue_field" onClick={startField}>Continue →</Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
