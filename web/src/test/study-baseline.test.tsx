// Study track, AI chatbot part: its wording and its ending follow the participant's progress. Done first,
// it hands over to VistaDex; done second (after VistaDex), it finishes the study.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { go, loadApp } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); });

const participant = (order: ["baseline", "vistadex"] | ["vistadex", "baseline"]) => localStorage.setItem("vistadex_participant", JSON.stringify({
  track: "study", code: "P05", role: null, ideaKey: "C", order, registered_at: "2026-11-11T00:00:00Z",
}));

async function openBaseline() {
  await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  go("/baseline");
  return screen.findByRole("heading", { level: 1 });
}
const rateAndSubmit = (name: RegExp) => {
  fireEvent.click(screen.getByRole("button", { name: /I've read the AI's answer/ }));
  fireEvent.click(screen.getByRole("button", { name }));
};

describe("AI chatbot part", () => {
  it("done first: says it comes first and hands over to VistaDex", async () => {
    participant(["baseline", "vistadex"]);
    expect((await openBaseline()).textContent).toBe("Your first task: an AI chatbot");
    expect(screen.getByText(/also your idea for VistaDex later/)).toBeTruthy();
    rateAndSubmit(/Submit and continue to VistaDex/);
    expect(localStorage.getItem("vistadex_participant_done_baseline")).toBe("true");
    await waitFor(() => expect(location.hash).toBe("#/screen"));
  }, 30000);

  it("done after VistaDex: says it comes second and finishes the study", async () => {
    participant(["vistadex", "baseline"]);
    localStorage.setItem("vistadex_participant_done_vistadex", "true");
    expect((await openBaseline()).textContent).toBe("Your second task: an AI chatbot");
    expect(screen.getByText(/the same idea you screened with VistaDex/)).toBeTruthy();
    expect(screen.queryByText(/VistaDex later/)).toBe(null);
    rateAndSubmit(/^Submit and finish$/);
    expect(localStorage.getItem("vistadex_participant_done_baseline")).toBe("true");
    expect(await screen.findByRole("heading", { name: "You've finished both parts" })).toBeTruthy();
    expect(location.hash).toBe("#/baseline");
  }, 30000);
});
