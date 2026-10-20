// ── GraveyardQuiz — a small "guess the failed startup" game shown while a
// live screening runs. Thematic (the graveyard IS stage 3), 3 questions,
// no external calls, ends before the report lands. Engagement is logged
// (quiz_started / quiz_finished with score) — a nice attentional-capture
// side-signal for the study. Renders nothing once the run is done.
import { useEffect, useState } from "react";
import { track } from "@/telemetry";
import { Button } from "@/components/ui/button";

interface Q { idea: string; options: string[]; answer: number; year: number; cause: string; }

const QUESTIONS: Q[] = [
  {
    idea: "Short-form video app — 6-second looping clips, creator-first (2013–2017)",
    options: ["Vine", "Snapchat", "Periscope", "Musical.ly"],
    answer: 0, year: 2017,
    cause: "Starved of resources under Twitter as Instagram Stories grew",
  },
  {
    idea: "$400 WiFi juicer for proprietary juice packs (2013–2017)",
    options: ["Juicero", "Ninja", "Blendtec", "Tropicana Fresh"],
    answer: 0, year: 2017,
    cause: "Bloomberg showed the packs could be squeezed by hand",
  },
  {
    idea: "Subscription short-form video — $175M raised, Hollywood-quality 10-minute episodes (2020)",
    options: ["Quibi", "Hulu", "Vessel", "Fullscreen"],
    answer: 0, year: 2020,
    cause: "Launched into lockdowns; nobody commuted, nobody watched",
  },
];

function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function GraveyardQuiz({ running }: { running: boolean }) {
  const [order] = useState(() => shuffle(QUESTIONS.map((_, i) => i)));
  const [step, setStep] = useState(-1); // -1 = intro, 0..2 = playing, 3 = done
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (step === 0) track("quiz_started", {});
    if (step === QUESTIONS.length) track("quiz_finished", { score });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!running) return null;
  if (step >= QUESTIONS.length) {
    if (step === QUESTIONS.length) {
      return (
        <div className="mt-4 rounded-inner border-2 border-foreground/10 bg-card p-4 text-center">
          <p className="font-display text-xl">{score}/{QUESTIONS.length} right</p>
          <p className="mt-1 text-xs text-muted-foreground">The graveyard is real — stage 3 just checked your idea against {`900+`} documented failures like these.</p>
        </div>
      );
    }
    return null;
  }

  const playing = step >= 0;
  const q = playing ? QUESTIONS[order[step]] : null;
  const opts = q ? q.options : [];

  return (
    <div className="mt-4 rounded-inner border-2 border-foreground/10 bg-card p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">While you wait · graveyard quiz</p>
      {step === -1 ? (
        <>
          <p className="mt-2 text-[0.9375rem] leading-relaxed">
            Three startups bit the dust. Can you name them? Everything on this list really shut down.
          </p>
          <Button size="sm" className="mt-3" data-control="quiz_start" onClick={() => setStep(0)}>Play (30s)</Button>
        </>
      ) : q ? (
        <>
          <p className="mt-2 text-xs font-medium text-muted-foreground">Question {step + 1} of {QUESTIONS.length}</p>
          <p className="mt-1 text-[0.9375rem] leading-relaxed">{q.idea}</p>
          <div className="mt-3 grid gap-2">
            {opts.map((opt, i) => {
              const isAnswer = opt === q.options[q.answer];
              const revealed = picked !== null;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={revealed}
                  data-control="quiz_answer"
                  onClick={() => { setPicked(i); if (isAnswer) setScore(s => s + 1); }}
                  className={`rounded-control border-2 px-3 py-2 text-left text-sm transition-colors ${
                    revealed
                      ? isAnswer
                        ? "border-green-700 bg-green-50 font-semibold"
                        : i === picked ? "border-red-400 bg-red-50" : "border-foreground/10 opacity-50"
                      : "border-foreground/15 hover:border-foreground"
                  }`}
                >
                  {opt}{revealed && isAnswer ? " ✓" : ""}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">
                {q ? `${q.options[q.answer]} — shut down ${q.year}. ${q.cause}.` : ""}
              </p>
              <Button
                size="sm"
                className="mt-2"
                data-control={step === QUESTIONS.length - 1 ? "quiz_finish" : "quiz_next"}
                onClick={() => { setPicked(null); setStep(s => s + 1); }}
              >
                {step === QUESTIONS.length - 1 ? "See score" : "Next →"}
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
