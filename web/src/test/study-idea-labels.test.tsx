// study-23: participants see the four preset ideas as A, B, C, D. The stored keys stay A, B, D, E (C was the
// retired mock-interview idea, and P07's data is under it), so a shown letter never means two ideas in the data.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadApp } from "./helpers";
import { ideaLabel, studyIdeaKeys } from "@/study/participant";

afterEach(() => { cleanup(); localStorage.clear(); });

describe("study idea labels", () => {
  it("keys A, B, D, E are shown as A, B, C, D; other keys show as they are", () => {
    expect(studyIdeaKeys().map(ideaLabel)).toEqual(["A", "B", "C", "D"]);
    expect(ideaLabel("E")).toBe("D");
    expect(ideaLabel("C")).toBe("C");
  });

  it("the study page shows Idea A to D, and each button still sends its stored key", async () => {
    await loadApp({ hash: "#/study" });
    fireEvent.click(await screen.findByRole("button", { name: "I have a participant code" }));
    const picks = [...document.querySelectorAll("[data-control=study_idea_pick]")].slice(0, 4) as HTMLElement[];
    expect(picks.map(b => b.textContent?.match(/^Idea (\w)/)?.[1])).toEqual(["A", "B", "C", "D"]);
    expect(picks.map(b => b.dataset.controlValue)).toEqual(["A", "B", "D", "E"]);
    expect(picks[3].textContent).toContain("Flatmate rent and bill splitter");
  }, 20000);
});
