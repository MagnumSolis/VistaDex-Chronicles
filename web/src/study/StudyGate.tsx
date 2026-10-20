// ── study/StudyGate.tsx — participant registration (the two tracks).
// Shown before the main app for study links; the plain public link skips
// straight to Welcome. Field visitors (LinkedIn) choose "just try the demo".
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui-vd";
import { ROLES, registerStudyParticipant, registerFieldParticipant, studyIdeaKeys, currentParticipant } from "./participant";
import { logParticipantRegistered } from "./studyEvents";

export function StudyGate({ onDone }: { onDone: () => void }) {
  const existing = currentParticipant();
  const [mode, setMode] = useState<"choose" | "study" | "field">(existing?.track === "study" ? "study" : "choose");
  const [code, setCode] = useState(existing?.code ?? "");
  const [role, setRole] = useState<string | null>(existing?.role ?? null);
  const [ideaKey, setIdeaKey] = useState<string>(studyIdeaKeys()[0]);
  const [err, setErr] = useState("");

  const startStudy = () => {
    if (code.trim().length < 2) { setErr("Pick a participant code (e.g. P07 — anything you'll remember)."); return; }
    const p = registerStudyParticipant(code, role, ideaKey);
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
        <p className="mt-3 text-on-page-muted">
          This is also a research study on how people judge startup ideas with AI tools.
          You pick how you take part:
        </p>
        {mode === "choose" && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-card border-2 border-foreground/10 bg-card p-4">
              <h2 className="font-semibold">A. Compare two tools (~20 min)</h2>
              <p className="mt-2 text-sm text-on-page-muted">
                You'll screen the same idea twice — once with an AI chatbot of your choice
                (ChatGPT, Claude, Gemini…) and once with VistaDex — and rate both.
                For recruited participants (you may have a participant code).
              </p>
              <Button className="mt-4" data-control="study_track_study" onClick={() => setMode("study")}>I have a participant code</Button>
            </div>
            <div className="rounded-card border-2 border-foreground/10 bg-card p-4">
              <h2 className="font-semibold">B. Just try the demo</h2>
              <p className="mt-2 text-sm text-on-page-muted">
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
                    onClick={() => setRole(role === r ? null : r)}
                    className={`rounded-full border-2 px-3 py-1.5 text-sm capitalize ${role === r ? "border-foreground bg-foreground text-on-foreground" : "border-foreground/15 bg-card"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-sm font-medium">Your assigned idea (for both tools)</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {studyIdeaKeys().map(k => (
                  <button
                    key={k}
                    type="button"
                    data-control="study_idea_pick" data-control-value={k}
                    onClick={() => setIdeaKey(k)}
                    className={`rounded-control border-2 p-3 text-left text-xs leading-relaxed ${ideaKey === k ? "border-foreground bg-foreground/5" : "border-foreground/10 bg-card"}`}
                  >
                    <b className="font-mono">Idea {k}</b> — {["AI meal-planning for diabetics", "Student skill-swap marketplace", "AI mock-interview platform", "Same-day repair marketplace"][studyIdeaKeys().indexOf(k)]}
                  </button>
                ))}
              </div>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <Button data-control="study_start" onClick={startStudy}>Start part 1 →</Button>
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
                    onClick={() => setRole(role === r ? null : r)}
                    className={`rounded-full border-2 px-3 py-1.5 text-sm capitalize ${role === r ? "border-foreground bg-foreground text-on-foreground" : "border-foreground/15 bg-card"}`}
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
