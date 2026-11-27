// study-22: idea C is retired (its live run took 388 s, past the client's 240 s timeout) and E added.
// A browser that still holds a participant assigned C must not quietly switch them to another idea:
// they are treated as unregistered and register again, so both parts judge one valid idea.
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadApp } from "./helpers";
import {
  RETIRED_IDEA_KEYS, assignedStudyIdea, currentParticipant, randomIdeaKey, registerStudyParticipant,
  studyIdea, studyIdeaInput, studyIdeaKeys,
} from "@/study/participant";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

const storeParticipant = (ideaKey: string) => {
  localStorage.setItem("vistadex_participant", JSON.stringify({
    track: "study", code: "P05", role: null, ideaKey, order: ["baseline", "vistadex"], registered_at: "2026-11-20T00:00:00Z",
  }));
  localStorage.setItem("vistadex_participant_done_baseline", "true");
};

describe("preset study ideas", () => {
  it("are exactly A, B, D, E; C is retired", () => {
    expect(studyIdeaKeys()).toEqual(["A", "B", "D", "E"]);
    expect(RETIRED_IDEA_KEYS).toEqual(["C"]);
  });

  it("randomIdeaKey never returns C, and spreads over every preset idea", () => {
    const seen = new Set<string>();
    const now = vi.spyOn(Date, "now");
    for (let s = 0; s < 400; s++) {
      now.mockReturnValue(1_764_000_000_000 + s * 1000);
      seen.add(randomIdeaKey());
    }
    expect(seen.has("C")).toBe(false);
    expect([...seen].sort()).toEqual(["A", "B", "D", "E"]);
    now.mockReturnValue(1_764_000_123_000);
    expect(registerStudyParticipant("P11", null).ideaKey).not.toBe("C");
  });

  it("every sentence of idea E's paragraph appears verbatim in its inputs", () => {
    const input = studyIdeaInput("E");
    expect(input.title).toBe("Flatmate rent and bill splitter");
    const joined = [input.title, input.pitch, input.problem, input.solution, input.moat].join(" ");
    const sentences = studyIdea("E").split(/(?<=\.)\s+/);
    expect(sentences).toHaveLength(4);
    for (const sentence of sentences) expect(joined).toContain(sentence);
  });
});

describe("a stored participant assigned the retired idea C", () => {
  it("is treated as unregistered and their progress is cleared, not mapped to A", () => {
    storeParticipant("C");
    expect(currentParticipant()).toBeNull();
    expect(assignedStudyIdea()).toBeNull();
    expect(localStorage.getItem("vistadex_participant")).toBeNull();
    expect(localStorage.getItem("vistadex_participant_done_baseline")).toBeNull();
  });

  it("a participant on a current idea is kept as before", () => {
    storeParticipant("E");
    expect(currentParticipant()?.ideaKey).toBe("E");
    expect(assignedStudyIdea()?.input.title).toBe("Flatmate rent and bill splitter");
  });

  it("sees the study gate again (no Continue as, no idea A), and re-registers on one valid idea", async () => {
    storeParticipant("C");
    await loadApp({ hash: "#/study" });
    await screen.findByRole("heading", { name: "Before you start" });
    expect(screen.getByRole("button", { name: "I have a participant code" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Continue as/ })).toBeNull();
    await waitFor(() => expect(localStorage.getItem("vistadex_participant")).toBeNull());
    // Registering again gives a current idea, used for both parts.
    const p = registerStudyParticipant("P05", null, "E");
    expect(p.ideaKey).toBe("E");
    expect(currentParticipant()?.ideaKey).toBe("E");
    expect(studyIdea(p.ideaKey)).toContain("flatmates");
  }, 20000);
});
