import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const track = vi.fn();
vi.mock("@/telemetry", () => ({ track: (...a: unknown[]) => track(...a) }));
import { GraveyardQuiz, questionsFrom } from "@/components/GraveyardQuiz";

const pool = Array.from({ length: 12 }, (_, i) => ({
  name: `Startup${i}`, year: 2010 + i, clue: `This startup tried thing number ${i} for a while.`, cause: `Ran out of money ${i}.`,
}));
const load = async () => pool;

afterEach(() => { cleanup(); track.mockClear(); });
const calls = (type: string) => track.mock.calls.filter(c => c[0] === type).map(c => c[1]);

describe("graveyard quiz", () => {
  it("shows the intro while a run is in progress", () => {
    render(<GraveyardQuiz running={true} load={async () => null} />);
    expect(screen.getByText(/picked at random from our graveyard/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /play/i })).toBeTruthy();
  });
  it("renders nothing when no run is in progress", () => {
    const { container } = render(<GraveyardQuiz running={false} load={async () => null} />);
    expect(container.innerHTML).toBe("");
  });

  it("questions come from the live pool: the answer plus three other names from it", () => {
    const qs = questionsFrom(pool);
    expect(qs).toHaveLength(3);
    for (const q of qs) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      expect(q.options.every(o => pool.some(p => p.name === o))).toBe(true);
    }
  });

  it("a played quiz logs started (live), one answer per question, and finished once with the score", async () => {
    render(<GraveyardQuiz running={true} runId="r_abc" load={load} />);
    await waitFor(() => screen.getByRole("button", { name: /play/i }));
    await new Promise(r => setTimeout(r, 0)); // the live pool replaces the fallback questions
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    for (let i = 0; i < 3; i++) {
      expect(screen.getByText(/This startup tried thing number/)).toBeTruthy();
      fireEvent.click(screen.getAllByRole("button").filter(b => b.getAttribute("data-control") === "quiz_answer")[0]);
      fireEvent.click(screen.getByRole("button", { name: i === 2 ? /see score/i : /next/i }));
    }
    expect(calls("quiz_started")).toEqual([{ run_id: "r_abc", source: "live" }]);
    const answers = calls("quiz_answered");
    expect(answers.map(a => a.question)).toEqual([1, 2, 3]);
    for (const a of answers) { expect(typeof a.correct).toBe("boolean"); expect(typeof a.ms).toBe("number"); expect(Object.keys(a).sort()).toEqual(["correct", "ms", "question", "run_id"]); }
    const fin = calls("quiz_finished");
    expect(fin).toHaveLength(1);
    expect(fin[0]).toMatchObject({ run_id: "r_abc", answered: 3, total: 3, completed: true });
    expect(fin[0].score).toBe(answers.filter(a => a.correct).length);
    expect(screen.getByText(/right$/)).toBeTruthy();
  });

  it("when the report arrives mid-quiz, finished is logged once with completed: false; nothing if never started", async () => {
    const { rerender } = render(<GraveyardQuiz running={true} runId="r_x" load={load} />);
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    fireEvent.click(screen.getAllByRole("button").filter(b => b.getAttribute("data-control") === "quiz_answer")[0]);
    rerender(<GraveyardQuiz running={false} runId="r_x" load={load} />);
    cleanup();
    expect(calls("quiz_finished")).toEqual([expect.objectContaining({ run_id: "r_x", answered: 1, total: 3, completed: false })]);

    track.mockClear();
    const v = render(<GraveyardQuiz running={true} runId="r_y" load={load} />);
    v.rerender(<GraveyardQuiz running={false} runId="r_y" load={load} />);
    cleanup();
    expect(track).not.toHaveBeenCalled();
  });

  it("without the live pool the fixed questions are used and the event says fallback", async () => {
    render(<GraveyardQuiz running={true} runId="r_f" load={async () => null} />);
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(calls("quiz_started")).toEqual([{ run_id: "r_f", source: "fallback" }]);
  });
});
