// study-19: the two parts are counterbalanced by the code's number (odd: AI chatbot first, even: VistaDex
// first), the same rule the comparison page uses for its option order, so order is a factor in the analysis.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { go, loadApp } from "./helpers";
import { registerStudyParticipant, partOrder } from "@/study/participant";

afterEach(() => { cleanup(); localStorage.clear(); });

describe("part order by participant code", () => {
  it("odd codes do the chatbot first, even codes VistaDex first; codes without a number default to chatbot first", () => {
    expect(partOrder("P51")).toEqual(["baseline", "vistadex"]);
    expect(partOrder("P52")).toEqual(["vistadex", "baseline"]);
    expect(partOrder("TEST04")).toEqual(["vistadex", "baseline"]);
    expect(partOrder("ABC")).toEqual(["baseline", "vistadex"]);
    expect(registerStudyParticipant("P52", null, "A").order).toEqual(["vistadex", "baseline"]);
  });

  it("an even code starts with VistaDex and comes back to the chatbot part after the report", async () => {
    const { tm } = await loadApp();
    go("/study");
    fireEvent.click(await screen.findByRole("button", { name: "I have a participant code" }));
    fireEvent.change(await screen.findByLabelText("Participant code"), { target: { value: "P52" } });
    fireEvent.click(screen.getByRole("button", { name: /^Idea B/ }));
    fireEvent.click(screen.getByRole("button", { name: /Start part 1/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    await waitFor(() => expect(location.hash).toBe("#/screen"));
    expect(await screen.findByText(/the same idea you will give the AI chatbot/)).toBeTruthy();
    const reg = (tm.events() as { type: string; payload: Record<string, unknown> }[]).find(e => e.type === "participant_registered");
    expect(reg!.payload.code).toBe("P52");
  }, 30000);
});

describe("the code is read from what was typed (27 Nov: a participant typed 'Its P50')", () => {
  it("'Its P50' registers as P50, 'p15' as P15; anything else is kept as typed", async () => {
    const { registerStudyParticipant, cleanCode } = await import("@/study/participant");
    expect(cleanCode("Its P50")).toBe("P50");
    expect(cleanCode(" p15 ")).toBe("P15");
    expect(cleanCode("test02")).toBe("TEST02");
    expect(cleanCode("Alice")).toBe("Alice");
    expect(registerStudyParticipant("Its P50", null).code).toBe("P50");
  });
});
