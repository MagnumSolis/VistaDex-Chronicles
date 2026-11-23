// A study machine is shared: the next participant often uses the same browser (or another tab of the same
// private window, which shares storage). A new participant code must start from scratch: a new usage
// session, the Welcome notice again (their own answer), no finished parts and no reports of the person before.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { go, loadApp } from "./helpers";
import { registerStudyParticipant, markConditionDone } from "@/study/participant";

afterEach(() => { cleanup(); localStorage.clear(); });

type Ev = { type: string; session_id: string; payload: Record<string, unknown> };

async function previousParticipantFinished() {
  const app = await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  registerStudyParticipant("P01", null, "A");
  markConditionDone("baseline");
  markConditionDone("vistadex");
  localStorage.setItem("vistadex.reports.v1", JSON.stringify([{ id: "old", kind: "session", title: "Old report", createdAt: null }]));
  return { ...app, oldSession: String(app.tm.sessionId()) };
}

describe("a new participant in a browser someone used before", () => {
  it("the study page says who used it last and starts a new participant from scratch", async () => {
    const { tm, oldSession } = await previousParticipantFinished();
    go("/study");
    expect(await screen.findByText(/last used by participant/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start a new participant" }));
    fireEvent.change(await screen.findByLabelText("Participant code"), { target: { value: "P05" } });
    fireEvent.click(screen.getByRole("button", { name: /^Idea B/ }));
    fireEvent.click(screen.getByRole("button", { name: /Start part 1/ }));
    // Their own answer to the notice, then their own session.
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    await waitFor(() => expect(location.hash).toBe("#/baseline"));
    expect(tm.sessionId()).not.toBe(oldSession);
    expect(localStorage.getItem("vistadex_participant_done_baseline")).toBe(null);
    expect(localStorage.getItem("vistadex_participant_done_vistadex")).toBe(null);
    expect(localStorage.getItem("vistadex.reports.v1")).toBe(null);
    const events = tm.events() as Ev[];
    expect(events.every(e => e.session_id === tm.sessionId())).toBe(true);
    expect(events.find(e => e.type === "participant_registered")!.payload.code).toBe("P05");
  }, 30000);

  it("typing a different code also starts fresh, without pressing Start a new participant", async () => {
    const { tm, oldSession } = await previousParticipantFinished();
    go("/study");
    fireEvent.change(await screen.findByLabelText("Participant code"), { target: { value: "P03" } });
    fireEvent.click(screen.getByRole("button", { name: /Start part 1/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    await waitFor(() => expect(location.hash).toBe("#/baseline"));
    expect(tm.sessionId()).not.toBe(oldSession);
  }, 30000);

  it("the same participant can carry on where they stopped", async () => {
    const { tm, oldSession } = await previousParticipantFinished();
    localStorage.removeItem("vistadex_participant_done_vistadex");
    go("/study");
    fireEvent.click(await screen.findByRole("button", { name: "Continue as P01" }));
    await waitFor(() => expect(location.hash).toBe("#/screen"));
    expect(tm.sessionId()).toBe(oldSession);
  }, 30000);
});
