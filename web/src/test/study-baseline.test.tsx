// Study track, AI chatbot part: its wording and its ending follow the participant's progress. Done first
// (always, since study-16), it hands over to VistaDex; done second (an earlier order), it leads to the comparison.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { chatbotPartToRatings, go, loadApp } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); });

const participant = (order: ["baseline", "vistadex"] | ["vistadex", "baseline"]) => localStorage.setItem("vistadex_participant", JSON.stringify({
  track: "study", code: "P05", role: null, ideaKey: "E", order, registered_at: "2026-11-11T00:00:00Z",
}));

async function openBaseline() {
  await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  go("/baseline");
  return screen.findByRole("heading", { level: 1 });
}
const rateAndSubmit = async (name: RegExp) => {
  await chatbotPartToRatings();
  fireEvent.click(screen.getByRole("button", { name }));
};

describe("AI chatbot part", () => {
  it("done first: says it comes first and hands over to VistaDex", async () => {
    participant(["baseline", "vistadex"]);
    expect((await openBaseline()).textContent).toBe("Your first task: an AI chatbot");
    expect(screen.getByText(/then screen the same idea with VistaDex/)).toBeTruthy();
    await rateAndSubmit(/Submit and continue to VistaDex/);
    expect(localStorage.getItem("vistadex_participant_done_baseline")).toBe("true");
    await waitFor(() => expect(location.hash).toBe("#/screen"));
  }, 30000);

  it("done after VistaDex (an order from before study-16): says it comes second and leads to the comparison", async () => {
    participant(["vistadex", "baseline"]);
    localStorage.setItem("vistadex_participant_done_vistadex", "true");
    expect((await openBaseline()).textContent).toBe("Your second task: an AI chatbot");
    expect(screen.queryByText(/then screen the same idea/)).toBe(null);
    await rateAndSubmit(/Submit and compare the two/);
    expect(localStorage.getItem("vistadex_participant_done_baseline")).toBe("true");
    await waitFor(() => expect(location.hash).toBe("#/compare"));
    expect(await screen.findByRole("heading", { name: "The AI chatbot or VistaDex?" })).toBeTruthy();
  }, 30000);
});
