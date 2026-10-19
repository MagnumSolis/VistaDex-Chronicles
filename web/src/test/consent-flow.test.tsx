// Regression tests for "the idea text survives the consent dialog and the requested run happens".
// Each test loads a fresh module graph, so telemetry starts with no consent recorded.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const loadApp = async () => {
  const { App } = await import("@/App");
  const { SAMPLE_IDEA } = await import("@/proto");
  const study = await import("@/study/controller");
  return { App, SAMPLE_IDEA, study };
};
const ideaBox = () => screen.getByLabelText("Idea text") as HTMLTextAreaElement;
// Navigation is by hash route; the app re-renders on hashchange.
const go = (path: string) => act(() => { location.hash = path; window.dispatchEvent(new HashChangeEvent("hashchange")); });
const reportShown = () => waitFor(() => expect(screen.getByText("Screening report")).toBeTruthy(), { timeout: 8000 });

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); history.replaceState(null, "", "/"); vi.resetModules(); });
afterEach(() => cleanup());

describe("consent dialog keeps the idea and the run", () => {
  it("decline on entering the screen → load sample → run works", async () => {
    const { App, SAMPLE_IDEA } = await loadApp();
    render(<App />);
    go("#/screen");
    fireEvent.click(await screen.findByRole("button", { name: "Use without taking part" }));
    fireEvent.click(screen.getByRole("button", { name: "Load sample idea" }));
    fireEvent.click(screen.getByRole("button", { name: /Run pipeline/ }));
    await reportShown();
    expect(ideaBox().value).toBe(SAMPLE_IDEA);
    expect(screen.queryByText("Please paste an idea first.")).toBeNull();
  }, 15000);

  it("agree on entering the screen → load sample → answer the pre-use question → run works", async () => {
    const { App, SAMPLE_IDEA } = await loadApp();
    render(<App />);
    go("#/screen");
    fireEvent.click(await screen.findByRole("button", { name: "I agree — take part" }));
    fireEvent.click(screen.getByRole("button", { name: "Load sample idea" }));
    fireEvent.click(screen.getByRole("button", { name: /Run pipeline/ }));
    expect(await screen.findByText(/answer the question above/)).toBeTruthy(); // pre-use question required first
    expect(document.activeElement?.id).toBe("trustPreInput"); // brought into view and focused, not a silent no-op
    expect(ideaBox().value).toBe(SAMPLE_IDEA);
    fireEvent.change(document.getElementById("trustPreInput")!, { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /Run pipeline/ }));
    await reportShown();
    expect(ideaBox().value).toBe(SAMPLE_IDEA);
  }, 15000);

  it("idea loaded, then 'Read the study information' → either choice keeps the text", async () => {
    for (const choice of ["Use without taking part", "I agree — take part"]) {
      localStorage.clear(); vi.resetModules(); cleanup();
      const { App, SAMPLE_IDEA } = await loadApp();
      render(<App />);
      go("#/screen");
      fireEvent.click(await screen.findByRole("button", { name: "Use without taking part" }));
      fireEvent.click(screen.getByRole("button", { name: "Load sample idea" }));
      fireEvent.click(screen.getByRole("button", { name: "Read the study information" }));
      fireEvent.click(await screen.findByRole("button", { name: choice }));
      expect(ideaBox().value, choice).toBe(SAMPLE_IDEA);
    }
  }, 15000);
});

describe("consent from an earlier study version is asked again", () => {
  it("a pilot-1 consent in storage does not suppress the dialog", async () => {
    localStorage.setItem("vistadex.study.v1", JSON.stringify({ session_id: "s", consent: "given", consent_at: "t", seq: 1, sent: 0, events: [] }));
    const { App } = await loadApp();
    render(<App />);
    go("#/screen");
    expect(await screen.findByRole("button", { name: "I agree — take part" })).toBeTruthy();
  }, 15000);
});

describe("run requested while consent is unanswered (defensive guard)", () => {
  const renderScreen = async () => {
    const { ScreenIdea } = await import("@/screens/ScreenIdea");
    const { SAMPLE_IDEA } = await import("@/proto");
    const study = await import("@/study/controller");
    let resume: (() => void) | null = null;
    const onNeedConsent = vi.fn((r: () => void) => { resume = r; });
    render(<ScreenIdea onReadStudyInfo={() => {}} onNeedConsent={onNeedConsent} />);
    fireEvent.click(screen.getByRole("button", { name: "Load sample idea" }));
    fireEvent.click(screen.getByRole("button", { name: /Run pipeline/ }));
    return { SAMPLE_IDEA, study, onNeedConsent, resume: () => resume!() };
  };

  it("asks for consent, keeps the text, then runs after 'Use without taking part'", async () => {
    const { SAMPLE_IDEA, study, onNeedConsent, resume } = await renderScreen();
    expect(onNeedConsent).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Screening report")).toBeNull();
    expect(ideaBox().value).toBe(SAMPLE_IDEA);
    study.declineConsent();
    resume();
    await reportShown();
    expect(ideaBox().value).toBe(SAMPLE_IDEA);
  }, 15000);

  it("after 'I agree' it keeps the text and asks the pre-use question before running", async () => {
    const { SAMPLE_IDEA, study, resume } = await renderScreen();
    study.giveConsent();
    resume();
    expect(await screen.findByText(/answer the question above/)).toBeTruthy();
    expect(screen.queryByText("Screening report")).toBeNull();
    expect(ideaBox().value).toBe(SAMPLE_IDEA);
  }, 15000);
});
