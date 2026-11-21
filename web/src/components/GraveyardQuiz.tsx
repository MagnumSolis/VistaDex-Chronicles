// ── GraveyardQuiz — "guess the failed startup" while a live screening runs ──
// Three questions drawn at random from the live graveyard on every run (GET /graveyard/quiz): the clue is
// what the startup tried, with its name hidden; the options are its name and three other shut-down startups
// from the same draw. If the pool cannot be loaded, three fixed questions are used. Randomness is crypto.
// Logged (public edition, after consent): quiz_started { run_id, source }, quiz_answered { run_id, question,
// correct, ms } per answer, and quiz_finished { run_id, score, answered, total, completed } once, either at
// the end or, with completed: false, when the report arrives first. No company names in telemetry.
import { useEffect, useRef, useState } from "react";
import { track } from "@/telemetry";
import { Button } from "@/components/ui/button";
import { fetchQuizPool, type QuizEntry } from "@/lib/graveyardStats";

interface Q { idea: string; options: string[]; answer: string; year: number; cause: string }
export const QUIZ_LENGTH = 3;

const FALLBACK: Q[] = [
  { idea: "Short-form video app with 6-second looping clips, creator-first (2013 to 2017)", options: ["Vine", "Snapchat", "Periscope", "Musical.ly"], answer: "Vine", year: 2017, cause: "Starved of resources under Twitter as Instagram Stories grew." },
  { idea: "$400 WiFi juicer for proprietary juice packs (2013 to 2017)", options: ["Juicero", "Ninja", "Blendtec", "Tropicana Fresh"], answer: "Juicero", year: 2017, cause: "Bloomberg showed the packs could be squeezed by hand." },
  { idea: "Subscription short-form video with Hollywood-quality 10-minute episodes, $1.75B raised (2020)", options: ["Quibi", "Hulu", "Vessel", "Fullscreen"], answer: "Quibi", year: 2020, cause: "Launched into lockdowns: nobody commuted, nobody watched." },
];

const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
export function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** Three questions from a pool: each entry's name plus three other names from the pool as options. */
export function questionsFrom(pool: QuizEntry[]): Q[] {
  const picked = pool.slice(0, QUIZ_LENGTH);
  return picked.map(e => {
    const others = shuffle(pool.filter(o => o.name !== e.name).map(o => o.name)).slice(0, 3);
    return { idea: e.clue, options: shuffle([e.name, ...others]), answer: e.name, year: e.year, cause: e.cause };
  });
}

export function GraveyardQuiz({ running, runId = null, load = fetchQuizPool }: { running: boolean; runId?: string | null; load?: () => Promise<QuizEntry[] | null> }) {
  const [questions, setQuestions] = useState<Q[]>(() => shuffle(FALLBACK));
  const [source, setSource] = useState<"live" | "fallback">("fallback");
  const [step, setStep] = useState(-1); // -1 = intro, 0..2 = playing, 3 = done
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const answered = useRef(0);
  const shownAt = useRef(0);
  const finished = useRef(false);
  const stepRef = useRef(-1);
  const scoreRef = useRef(0);
  stepRef.current = step;
  scoreRef.current = score;

  useEffect(() => {
    let live = true;
    load().then(pool => { if (live && pool && pool.length > QUIZ_LENGTH) { setQuestions(questionsFrom(pool)); setSource("live"); } });
    return () => { live = false; };
  }, [load]);

  const finish = (completed: boolean) => {
    if (finished.current || stepRef.current < 0) return;
    finished.current = true;
    track("quiz_finished", { run_id: runId, score: scoreRef.current, answered: answered.current, total: QUIZ_LENGTH, completed });
  };
  useEffect(() => {
    if (step === 0) track("quiz_started", { run_id: runId, source });
    if (step >= 0 && step < QUIZ_LENGTH) shownAt.current = performance.now();
    if (step === QUIZ_LENGTH) finish(true);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  // The report arrived before the quiz was done: record how far it got.
  useEffect(() => { if (!running && step >= 0 && step < QUIZ_LENGTH) finish(false); }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  // ...or the screen changed (the report opened, or the visitor left) while the quiz was under way.
  useEffect(() => () => { if (stepRef.current < QUIZ_LENGTH) finish(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!running) return null;
  if (step >= QUIZ_LENGTH) {
    return (
      <div className="mt-4 rounded-inner border-2 border-foreground/10 bg-card p-4 text-center">
        <p className="font-display text-xl">{score}/{QUIZ_LENGTH} right</p>
        <p className="mt-1 text-xs text-muted-foreground">The graveyard is real: your idea is checked against documented shut-down startups like these.</p>
      </div>
    );
  }

  const q = step >= 0 ? questions[step] : null;
  const answer = (opt: string) => {
    if (!q || picked !== null) return;
    const correct = opt === q.answer;
    setPicked(opt);
    if (correct) setScore(s => s + 1);
    answered.current += 1;
    track("quiz_answered", { run_id: runId, question: step + 1, correct, ms: Math.round(performance.now() - shownAt.current) });
  };

  return (
    <div className="mt-4 rounded-inner border-2 border-foreground/10 bg-card p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">While you wait · graveyard quiz</p>
      {step === -1 ? (
        <>
          <p className="mt-2 text-[0.9375rem] leading-relaxed">
            Three startups that shut down, picked at random from our graveyard. Can you name them from what they tried?
          </p>
          <Button size="sm" className="mt-3" data-control="quiz_start" onClick={() => setStep(0)}>Play (30s)</Button>
        </>
      ) : q ? (
        <>
          <p className="mt-2 text-xs font-medium text-muted-foreground">Question {step + 1} of {QUIZ_LENGTH}</p>
          <p className="mt-1 text-[0.9375rem] leading-relaxed">{q.idea}</p>
          <div className="mt-3 grid gap-2">
            {q.options.map(opt => {
              const isAnswer = opt === q.answer;
              const revealed = picked !== null;
              return (
                <button key={opt} type="button" disabled={revealed} data-control="quiz_answer" onClick={() => answer(opt)}
                  className={`rounded-control border-2 px-3 py-2 text-left text-sm transition-colors ${
                    revealed ? (isAnswer ? "border-foreground font-semibold" : opt === picked ? "border-dashed border-foreground/60" : "border-foreground/10 opacity-50") : "border-foreground/15 hover:border-foreground"}`}>
                  {opt}{revealed && isAnswer ? " ✓" : ""}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">{`${q.answer}, shut down ${q.year}. ${q.cause}`}</p>
              <Button size="sm" className="mt-2" data-control={step === QUIZ_LENGTH - 1 ? "quiz_finish" : "quiz_next"}
                onClick={() => { setPicked(null); setStep(s => s + 1); }}>
                {step === QUIZ_LENGTH - 1 ? "See score" : "Next →"}
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
