// Study track, VistaDex condition: the assigned idea is filled into Screen an idea, so every
// participant with the same idea screens the same input (the baseline chatbot gets the same
// paragraph). The run says so in run_started.sample ("study_<key>") unless the participant edited it.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { go, loadApp, reportShown } from "./helpers";
import { studyIdea, studyIdeaInput, studyIdeaKeys } from "@/study/participant";
import { FIELD_LIMITS, REQUIRED_FIELDS } from "@proto/core/input.js";

afterEach(() => { cleanup(); localStorage.clear(); });

type Ev = { type: string; payload: Record<string, unknown> };
const participant = (track: "study" | "field", ideaKey = "C") => localStorage.setItem("vistadex_participant", JSON.stringify({
  track, code: track === "study" ? "P03" : "", role: null, ideaKey: track === "study" ? ideaKey : "",
  order: track === "study" ? ["baseline", "vistadex"] : null, registered_at: "2026-11-09T00:00:00Z",
}));
// Baseline first (the usual order): the VistaDex condition comes next, so the gate opens Screen an idea.
const baselineDone = () => localStorage.setItem("vistadex_participant_done_baseline", "true");
const field = (label: RegExp) => (screen.getByLabelText(label) as HTMLTextAreaElement).value;

async function openForm() {
  const app = await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  go("/screen");
  await screen.findByLabelText(/^Idea title/);
  return app;
}

describe("assigned idea in the VistaDex condition", () => {
  it("each assigned idea keeps every sentence of its paragraph verbatim and fits the form", () => {
    for (const k of studyIdeaKeys()) {
      const input = studyIdeaInput(k);
      const joined = [input.title, input.pitch, input.problem, input.solution, input.moat].join(" ");
      for (const sentence of studyIdea(k).split(/(?<=\.)\s+/)) expect(joined, `idea ${k}`).toContain(sentence);
      for (const f of REQUIRED_FIELDS as string[]) expect((input as unknown as Record<string, string>)[f].trim(), `${k}.${f}`).not.toBe("");
      for (const [f, max] of Object.entries(FIELD_LIMITS as Record<string, number>)) expect((input as unknown as Record<string, string>)[f].length, `${k}.${f}`).toBeLessThanOrEqual(max);
    }
  });

  it("a study participant finds the assigned idea filled in, and the run is marked study_<key>", async () => {
    participant("study", "C");
    baselineDone();
    const { tm } = await openForm();
    expect(field(/^Idea title/)).toBe("AI mock-interview platform");
    expect(field(/^Solution/)).toContain("simulates a real interviewer");
    expect(screen.getByText(/Your assigned idea \(Idea C\) is filled in/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    await reportShown();
    const started = (tm.events() as Ev[]).find(e => e.type === "run_started")!;
    expect(started.payload.sample).toBe("study_C");
  }, 30000);

  it("an edited assigned idea is not marked as the assigned sample", async () => {
    participant("study", "A");
    baselineDone();
    const { tm } = await openForm();
    fireEvent.change(screen.getByLabelText(/^Idea title/), { target: { value: "My own title" } });
    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    await reportShown();
    expect((tm.events() as Ev[]).find(e => e.type === "run_started")!.payload.sample).toBe(null);
  }, 30000);

  it("a draft from before registering is replaced by the assigned idea", async () => {
    await openForm(); // not registered yet
    fireEvent.change(screen.getByLabelText(/^Idea title/), { target: { value: "Something I tried first" } });
    participant("study", "B"); // registers in the same page load
    baselineDone();
    go("/reports");
    go("/screen");
    await screen.findByLabelText(/^Idea title/);
    expect(field(/^Idea title/)).toBe("Student skill-swap marketplace");
    expect(screen.getByText(/Your assigned idea \(Idea B\) is filled in/)).toBeTruthy();
  }, 30000);

  it("an edited assigned idea keeps the edit and the note says it was changed", async () => {
    participant("study", "D");
    baselineDone();
    await openForm();
    fireEvent.change(screen.getByLabelText(/^Idea title/), { target: { value: "My own title" } });
    expect(screen.queryByText(/is filled in/)).toBe(null);
    expect(screen.getByText(/You changed your assigned idea \(Idea D\)/)).toBeTruthy();
    go("/reports");
    go("/screen");
    expect(field(/^Idea title/)).toBe("My own title");
  }, 30000);

  it("field-track visitors and finished study participants get an empty form", async () => {
    participant("field");
    await openForm();
    expect(field(/^Idea title/)).toBe("");
    cleanup(); localStorage.clear();
    participant("study", "B");
    baselineDone();
    localStorage.setItem("vistadex_participant_done_vistadex", "true");
    await openForm();
    expect(field(/^Idea title/)).toBe("");
  }, 30000);
});
