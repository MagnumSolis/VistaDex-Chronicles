// AI chatbot part (study-16): one fixed prompt with the idea, four questions answered while the chatbot
// writes (before reading it), then the answer pasted here and stored for the comparison with VistaDex.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHATBOT_ANSWER, go, loadApp } from "./helpers";
import { OWN_IDEA, chatbotPrompt, registerStudyParticipant, setOwnIdea, studyIdea } from "@/study/participant";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

type Ev = { type: string; payload: Record<string, unknown> };
const mine = { title: "Rent-a-drone", pitch: "Drones for farmers by the hour.", problem: "Small farms cannot afford drones.", solution: "We rent drones with a pilot by the hour.", moat: "" };

async function open(code = "P21") {
  setOwnIdea(mine);
  registerStudyParticipant(code, null, OWN_IDEA);
  const app = await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  go("/baseline");
  return app;
}

describe("AI chatbot part", () => {
  it("Copy prompt copies the fixed prompt with the idea in it", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await open();
    fireEvent.click(await screen.findByRole("button", { name: "Copy prompt" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(chatbotPrompt(OWN_IDEA)));
    expect(chatbotPrompt(OWN_IDEA)).toContain(studyIdea(OWN_IDEA));
    expect(chatbotPrompt(OWN_IDEA)).toMatch(/competitors/);
    expect(await screen.findByText("Copied.")).toBeTruthy();
    expect(screen.getByText(/Don't read the answer yet/)).toBeTruthy();
  }, 30000);

  it("asks four questions before the answer is read, then stores the pasted answer with its tool", async () => {
    const { tm } = await open();
    const evs = () => tm.events() as Ev[];
    fireEvent.click(await screen.findByRole("button", { name: /I've sent it/ }));
    expect(evs().find(e => e.type === "condition_started")!.payload).toEqual({ condition: "baseline", idea_key: OWN_IDEA, order_position: 1 });
    expect(screen.getByText(/How much do you know about this idea's market/)).toBeTruthy();
    expect(screen.queryByLabelText("The chatbot's answer")).toBe(null);
    fireEvent.click(screen.getByRole("button", { name: /Next: read the answer/ }));
    const runId = evs().find(e => e.type === "confidence_pre")!.payload.run_id;
    expect(evs().find(e => e.type === "participant_profile")!.payload).toEqual({ run_id: runId, market_familiarity: 4, ai_trust: 4, ai_use: 4 });

    // Both are needed: the chatbot used, and an answer that is not a fragment.
    fireEvent.click(screen.getByRole("button", { name: /Save the answer/ }));
    expect(screen.getByRole("alert").textContent).toMatch(/Pick the chatbot/);
    fireEvent.click(screen.getByRole("radio", { name: "ChatGPT" }));
    fireEvent.change(screen.getByLabelText("The chatbot's answer"), { target: { value: "Looks good." } });
    fireEvent.click(screen.getByRole("button", { name: /Save the answer/ }));
    expect(screen.getByRole("alert").textContent).toMatch(/whole answer/);
    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    fireEvent.change(screen.getByLabelText(/^Model or plan/), { target: { value: "free plan" } });
    fireEvent.change(screen.getByLabelText("The chatbot's answer"), { target: { value: `  ${CHATBOT_ANSWER}  ` } });
    fireEvent.click(screen.getByRole("button", { name: /Save the answer/ }));
    const a = evs().find(e => e.type === "chatbot_answer")!.payload;
    expect(a).toEqual({ run_id: runId, tool: "ChatGPT", model: "free plan", web_search: "yes", chars: CHATBOT_ANSWER.trim().length, text: CHATBOT_ANSWER.trim() });
    expect(await screen.findByRole("heading", { name: "Rate what you just read" })).toBeTruthy();
  }, 30000);
});
