// The pre-run confidence slider (public edition): every run logs exactly one confidence_pre. An untouched
// slider logs its starting value 50 with moved: false, so "left it at 50" and "chose 50" stay apart.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadApp, reportShown } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); });

type Ev = { type: string; payload: Record<string, unknown> };

async function runWith(move: (thumb: HTMLElement) => void) {
  const { tm } = await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  fireEvent.click(await screen.findByRole("button", { name: "Mental-health journaling app" }));
  move(screen.getByRole("slider", { name: "Prior confidence in the idea" }));
  fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
  await reportShown();
  const events = tm.events() as Ev[];
  const runId = events.find(e => e.type === "run_started")!.payload.run_id;
  return { pre: events.filter(e => e.type === "confidence_pre"), runId };
}

describe("pre-run confidence slider", () => {
  it("untouched: one confidence_pre with value 50 and moved: false", async () => {
    const { pre, runId } = await runWith(() => {});
    expect(pre.map(e => e.payload)).toEqual([{ condition: "vistadex", value: 50, run_id: runId, moved: false }]);
  }, 30000);

  it("moved to 70: one confidence_pre with value 70 and moved: true", async () => {
    const { pre, runId } = await runWith(thumb => { for (let i = 0; i < 4; i++) fireEvent.keyDown(thumb, { key: "ArrowRight" }); });
    expect(pre.map(e => e.payload)).toEqual([{ condition: "vistadex", value: 70, run_id: runId, moved: true }]);
  }, 30000);
});
