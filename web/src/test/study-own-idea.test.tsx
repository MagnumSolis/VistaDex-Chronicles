// Study track with the participant's own idea: typed once on the study page, the same text goes to the
// AI chatbot prompt and into Screen an idea. Usage events only say idea_key "own" (the idea reaches the
// server only in the comparison records), and the run is never marked as a study sample.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { go, loadApp, reportShown } from "./helpers";
import { OWN_IDEA, assignedStudyIdea, ownIdeaInput, registerStudyParticipant, setOwnIdea, studyIdea } from "@/study/participant";

afterEach(() => { cleanup(); localStorage.clear(); });

type Ev = { type: string; payload: Record<string, unknown> };
const mine = { title: "Rent-a-drone", pitch: "Drones for farmers by the hour.", problem: "Small farms cannot afford drones.", solution: "We rent drones with a pilot by the hour.", moat: "" };

describe("own idea in the study", () => {
  it("is stored in the browser and used for both parts: one paragraph for the chatbot, the fields for VistaDex", () => {
    setOwnIdea(mine);
    registerStudyParticipant("P11", null, OWN_IDEA);
    expect(ownIdeaInput()).toEqual(mine);
    const paragraph = studyIdea(OWN_IDEA);
    for (const s of [mine.title, mine.pitch, mine.problem, mine.solution]) expect(paragraph).toContain(s);
    const a = assignedStudyIdea()!;
    expect(a.key).toBe(OWN_IDEA);
    expect(a.sample).toBe(null);
    expect(a.input).toEqual(mine);
  });

  it("the study page asks for the idea when 'My own idea' is picked, and checks the required fields", async () => {
    await loadApp({ hash: "#/study" });
    go("/study");
    fireEvent.click(await screen.findByRole("button", { name: "I have a participant code" }));
    fireEvent.change(screen.getByLabelText("Participant code"), { target: { value: "P12" } });
    const own = screen.getByRole("button", { name: /^My own idea/ });
    fireEvent.click(own);
    expect(own.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Start part 1/ }));
    expect(screen.getByRole("alert").textContent).toMatch(/title, one-line pitch, problem and solution/i);
    fireEvent.change(screen.getByLabelText(/^Idea title/), { target: { value: mine.title } });
    fireEvent.change(screen.getByLabelText(/^One-line pitch/), { target: { value: mine.pitch } });
    fireEvent.change(screen.getByLabelText(/^Problem/), { target: { value: mine.problem } });
    fireEvent.change(screen.getByLabelText(/^Solution/), { target: { value: mine.solution } });
    fireEvent.click(screen.getByRole("button", { name: /Start part 1/ }));
    expect(ownIdeaInput()).toEqual(mine);
    expect(JSON.parse(localStorage.getItem("vistadex_participant")!).ideaKey).toBe(OWN_IDEA);
  }, 20000);

  it("Screen an idea is filled with the own idea; the run says idea_key own and no sample, and no idea text is logged", async () => {
    setOwnIdea(mine);
    registerStudyParticipant("P13", null, OWN_IDEA); // odd code: chatbot first
    localStorage.setItem("vistadex_participant_done_baseline", "true");
    const { tm } = await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    go("/screen");
    expect((await screen.findByLabelText(/^Idea title/) as HTMLInputElement).value).toBe(mine.title);
    expect(screen.getByText(/Your own idea is filled in/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    await reportShown();
    const events = tm.events() as Ev[];
    expect(events.find(e => e.type === "run_started")!.payload.sample).toBe(null);
    expect(events.find(e => e.type === "condition_started")!.payload.idea_key).toBe(OWN_IDEA);
    // The idea appears only in the comparison record of the report; every usage event stays content-free.
    expect(events.find(e => e.type === "vistadex_report_snapshot")!.payload.idea_key).toBe(OWN_IDEA);
    expect(JSON.stringify(events.filter(e => e.type !== "vistadex_report_snapshot"))).not.toContain("drone");
  }, 30000);
});

describe("a new participant in a browser that already took part", () => {
  const earlier = () => {
    localStorage.setItem("vistadex_participant", JSON.stringify({ track: "study", code: "P01", role: null, ideaKey: "A", order: ["baseline", "vistadex"], registered_at: "2026-11-22T00:00:00Z" }));
    localStorage.setItem("vistadex_participant_done_baseline", "true");
    localStorage.setItem("vistadex_participant_done_vistadex", "true");
  };

  it("a different code starts both parts fresh, so the own idea is filled in again", () => {
    earlier();
    setOwnIdea(mine);
    registerStudyParticipant("P04", null, OWN_IDEA);
    expect(localStorage.getItem("vistadex_participant_done_vistadex")).toBe(null);
    expect(localStorage.getItem("vistadex_participant_done_baseline")).toBe(null);
    expect(assignedStudyIdea()!.input).toEqual(mine);
  });

  it("the same code and idea resumes: finished parts stay finished", () => {
    earlier();
    localStorage.removeItem("vistadex_participant_done_vistadex");
    registerStudyParticipant("P01", null, "A");
    expect(localStorage.getItem("vistadex_participant_done_baseline")).toBe("true");
  });

  it("Screen an idea refills when the assigned idea changes, even within one page load", async () => {
    setOwnIdea(mine);
    registerStudyParticipant("P14", null, OWN_IDEA);
    await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    go("/screen");
    expect((await screen.findByLabelText(/^Idea title/) as HTMLInputElement).value).toBe(mine.title);
    cleanup();
    setOwnIdea({ ...mine, title: "Second idea" });
    registerStudyParticipant("P16", null, OWN_IDEA);
    await loadApp();
    go("/screen");
    expect((await screen.findByLabelText(/^Idea title/) as HTMLInputElement).value).toBe("Second idea");
  }, 30000);
});
