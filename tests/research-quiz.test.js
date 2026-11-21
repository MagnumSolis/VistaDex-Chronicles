// Waiting-screen quiz in the research analysis (study-13): per-run quiz fields, a quiz summary, and the
// graveyard section compared for runs where the quiz was played vs not. Synthetic events only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeStudy, exportTables } from "../worker/src/research-join.js";

let seq = 0;
const ev = (sid, type, payload = {}) => ({ session_id: sid, seq: ++seq, ts: new Date(Date.UTC(2026, 10, 20, 10, 0, 0, seq * 1000)).toISOString(), type, study_version: "2026-11-study-13", payload });

function visit(sid, { quiz = null, graveyardMs = 0, graveyardLinks = 0, mode = "live" } = {}) {
  const run = `r_${sid.padEnd(12, "0").slice(0, 12)}`;
  const q = [];
  if (quiz) {
    q.push(ev(sid, "quiz_started", { run_id: run, source: quiz.source || "live" }));
    quiz.answers.forEach(([correct, ms], i) => q.push(ev(sid, "quiz_answered", { run_id: run, question: i + 1, correct, ms })));
    q.push(ev(sid, "quiz_finished", { run_id: run, score: quiz.answers.filter(a => a[0]).length, answered: quiz.answers.length, total: 3, completed: quiz.answers.length === 3 }));
  }
  return [
    ev(sid, "participant_registered", { code: "", role: "founder", track: "field", source: "linkedin" }),
    ev(sid, "run_started", { run_id: run, role: "founder", industries: [], markets: [], mode, sample: null, idea_chars: 300, field_chars: {} }),
    ...q,
    ev(sid, "run_completed", { run_id: run, counts: {}, duration_ms: 80000, mode, trace_id: "t" }),
    ...Array.from({ length: graveyardLinks }, () => ev(sid, "control_pressed", { control: "lead_source_link", screen: "report" })),
    ev(sid, "section_time", { run_id: run, section: "graveyard", visible_ms: graveyardMs }),
  ];
}

const events = () => {
  seq = 0;
  return [
    ...visit("q1", { quiz: { answers: [[true, 4000], [false, 6000], [true, 5000]] }, graveyardMs: 40000, graveyardLinks: 2 }),
    ...visit("q2", { quiz: { answers: [[true, 3000]] }, graveyardMs: 30000, graveyardLinks: 1 }), // report came first
    ...visit("q3", { quiz: { source: "fallback", answers: [[false, 8000], [true, 7000], [true, 2000]] }, graveyardMs: 20000 }),
    ...visit("n1", { graveyardMs: 5000 }),
    ...visit("n2", { graveyardMs: 0 }),
    ...visit("m1", { mode: "mock", graveyardMs: 1000 }), // a sample run: too fast for the quiz, not counted
  ];
};

test("each run carries its quiz: started, source, answered, score, completed and answer times", () => {
  const r = analyzeStudy(events());
  const q1 = r.runs.find(x => x.sid === "q1").quiz;
  assert.deepEqual({ ...q1, ms: undefined }, { source: "live", answered: 3, score: 2, completed: true, ms: undefined });
  assert.deepEqual(q1.ms, [4000, 6000, 5000]);
  assert.equal(r.runs.find(x => x.sid === "q2").quiz.completed, false);
  assert.equal(r.runs.find(x => x.sid === "n1").quiz, null);
});

test("quiz summary: start rate among live runs, completion, scores, answer times, fallback count", () => {
  const s = analyzeStudy(events()).quiz;
  assert.equal(s.liveRuns, 5);
  assert.equal(s.started, 3);
  assert.equal(s.startPct, 60);
  assert.equal(s.completed, 2);
  assert.equal(s.abandoned, 1);
  assert.equal(s.fallback, 1);
  assert.equal(s.meanScore, 2, "mean score of completed quizzes");
  assert.equal(s.medianAnswerSec, 5, "median of every answer time");
  assert.equal(s.correctPct, 71, "5 of 7 answers right");
});

test("graveyard attention: quizzers vs non-quizzers, with a Mann-Whitney test and a finding", () => {
  const r = analyzeStudy(events());
  const g = r.quiz.graveyard;
  assert.equal(g.quizzers.n, 3);
  assert.equal(g.others.n, 2, "only finished live runs; the mock run is left out");
  assert.equal(g.quizzers.medianSec, 30);
  assert.equal(g.others.medianSec, 2.5);
  assert.equal(g.quizzers.linksPct, 67);
  assert.equal(g.others.linksPct, 0);
  assert.ok(g.test.p != null);
  const f = r.findings.find(x => x.id === "quiz");
  assert.ok(f && /3 of 5 live runs/.test(f.text) && /not a cause/.test(f.text), f && f.text);
});

test("runs.csv has the quiz columns", () => {
  const evs = events();
  const csv = exportTables(analyzeStudy(evs), evs)["runs.csv"].split("\n");
  const head = csv[0].split(",");
  for (const c of ["quiz_started", "quiz_source", "quiz_answered", "quiz_score", "quiz_completed", "quiz_median_answer_seconds"]) assert.ok(head.includes(c), c);
  const row = csv.find(l => l.startsWith("q1,")).split(",");
  assert.equal(row[head.indexOf("quiz_score")], "2");
  assert.equal(row[head.indexOf("quiz_median_answer_seconds")], "5");
});
