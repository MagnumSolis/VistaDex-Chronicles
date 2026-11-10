// Study track: submitting the ratings under a VistaDex report finishes the VistaDex condition. A participant
// who started with VistaDex goes on to the AI chatbot part; one who did the chatbot first is done.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { go, loadApp, reportShown } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); });

const participant = (order: ["baseline", "vistadex"] | ["vistadex", "baseline"]) => localStorage.setItem("vistadex_participant", JSON.stringify({
  track: "study", code: "P04", role: null, ideaKey: "B", order, registered_at: "2026-11-11T00:00:00Z",
}));
const done = (c: string) => localStorage.getItem(`vistadex_participant_done_${c}`);

async function runAndRate() {
  await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  go("/screen");
  fireEvent.click(await screen.findByRole("button", { name: /^Run$/ }));
  await reportShown();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
}

describe("finishing the VistaDex condition", () => {
  it("VistaDex first: the ratings finish the condition and lead on to the AI chatbot part", async () => {
    participant(["vistadex", "baseline"]);
    await runAndRate();
    expect(done("vistadex")).toBe("true");
    await waitFor(() => expect(location.hash).toBe("#/baseline"));
    expect(await screen.findByRole("heading", { name: /an AI chatbot/ })).toBeTruthy();
  }, 30000);

  it("chatbot first: the ratings finish the study and the report stays", async () => {
    participant(["baseline", "vistadex"]);
    localStorage.setItem("vistadex_participant_done_baseline", "true");
    await runAndRate();
    expect(done("vistadex")).toBe("true");
    expect(location.hash).toMatch(/^#\/report/);
    expect(screen.getByText(/your answers are recorded/)).toBeTruthy();
  }, 30000);

  it("field-track ratings do not touch study progress", async () => {
    localStorage.setItem("vistadex_participant", JSON.stringify({ track: "field", code: "", role: null, ideaKey: "", order: null, registered_at: "2026-11-11T00:00:00Z" }));
    await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    go("/screen");
    fireEvent.click(await screen.findByRole("button", { name: "Mental-health journaling app" }));
    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    await reportShown();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(done("vistadex")).toBe(null);
    expect(location.hash).toMatch(/^#\/report/);
  }, 30000);
});
