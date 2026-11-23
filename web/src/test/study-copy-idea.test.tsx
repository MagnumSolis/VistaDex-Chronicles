// AI chatbot part: one tap copies the idea paragraph (the preset idea or the participant's own), so nobody
// retypes it in ChatGPT or Claude. Only the idea is copied, no prompt: participants ask in their own words.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { go, loadApp } from "./helpers";
import { OWN_IDEA, registerStudyParticipant, setOwnIdea, studyIdea } from "@/study/participant";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

it("Copy idea puts exactly the idea paragraph on the clipboard and says so", async () => {
  const writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  setOwnIdea({ title: "Rent-a-drone", pitch: "Drones for farmers by the hour.", problem: "Small farms cannot afford drones.", solution: "We rent drones with a pilot by the hour.", moat: "" });
  registerStudyParticipant("P21", null, OWN_IDEA);
  await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  go("/baseline");
  fireEvent.click(await screen.findByRole("button", { name: /Next: ask the chatbot/ }));
  const copy = screen.getByRole("button", { name: /Copy idea/ });
  expect(copy.getAttribute("data-control")).toBe("baseline_copy_idea");
  fireEvent.click(copy);
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(studyIdea(OWN_IDEA)));
  expect(await screen.findByText(/Copied: paste it into your chatbot/)).toBeTruthy();
}, 30000);
