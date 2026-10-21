// The post-report form: an answer changes only when its own option is pressed. A click on the question
// text or the space around the options must not select (or log) anything.
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadApp, reportShown } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); });

type Ev = { type: string; payload: Record<string, unknown> };

async function openPanel() {
  const { tm } = await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  fireEvent.click(await screen.findByRole("button", { name: "Mental-health journaling app" }));
  fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
  await reportShown();
  return { tm, events: () => tm.events() as Ev[] };
}

const background = (question: HTMLElement) => {
  fireEvent.click(question);
  fireEvent.click(question.parentElement!);
  fireEvent.click(question.closest("section")!);
};

describe("post-report form", () => {
  it("'opened evidence links' keeps the chosen answer after background clicks, and logs it last", async () => {
    const { events } = await openPanel();
    const question = screen.getByText("Did you open any of the evidence links yourself?");
    const group = question.parentElement!;
    fireEvent.click(within(group).getByRole("button", { name: "1-2" }));
    background(question);
    const pressed = events().filter(e => e.type === "control_pressed" && String(e.payload.control).startsWith("study_sources_"));
    expect(pressed.map(e => e.payload.control)).toEqual(["study_sources_1_2"]);
    expect(within(group).getByRole("button", { name: "1-2" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getByRole("button", { name: "0" }).getAttribute("aria-pressed")).toBe("false");
  }, 30000);

  it("the comprehension check selects and logs nothing on background clicks", async () => {
    const { events } = await openPanel();
    const question = screen.getByText(/Quick check: in your own understanding/);
    background(question);
    expect(events().filter(e => e.type === "comprehension_check")).toEqual([]);
    const second = within(question.parentElement!).getByRole("button", { name: /failed or broke/ });
    fireEvent.click(second);
    background(question);
    expect(events().filter(e => e.type === "comprehension_check").map(e => e.payload.answer)).toEqual(["system_failure"]);
    expect(second.getAttribute("aria-pressed")).toBe("true");
  }, 30000);
});
