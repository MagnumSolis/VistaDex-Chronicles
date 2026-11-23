// A study participant must start with their next part whatever they press on the Welcome notice. "Start
// with walkthrough" opens the tour on Screen an idea; for a participant whose chatbot part is still to do,
// that ran VistaDex first (Screen an idea is pre-filled with their idea). Reaching Screen an idea any other
// way (the nav, a link) before the chatbot part leads back to it too.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { go, loadApp } from "./helpers";
import { registerStudyParticipant } from "@/study/participant";

afterEach(() => { cleanup(); localStorage.clear(); });

describe("study participant, chatbot part not done", () => {
  it("Start with walkthrough leads to the chatbot part, not Screen an idea", async () => {
    registerStudyParticipant("P02", null, "A");
    await loadApp({ hash: "#/welcome" });
    fireEvent.click(await screen.findByRole("button", { name: "Start with walkthrough" }));
    await waitFor(() => expect(location.hash).toBe("#/baseline"));
    expect(await screen.findByRole("button", { name: "Copy prompt" })).toBeTruthy();
  }, 30000);

  it("opening Screen an idea leads back to the chatbot part", async () => {
    registerStudyParticipant("P04", null, "B");
    await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    go("/screen");
    await waitFor(() => expect(location.hash).toBe("#/baseline"));
  }, 30000);

  it("field visitors still get the walkthrough on Screen an idea", async () => {
    await loadApp({ hash: "#/welcome" });
    fireEvent.click(await screen.findByRole("button", { name: "Start with walkthrough" }));
    await waitFor(() => expect(location.hash).toBe("#/screen"));
  }, 30000);
});
