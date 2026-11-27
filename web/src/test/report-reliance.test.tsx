// study-19: every report says what it can and cannot tell you before people rely on it (Amershi et al. G1/G2),
// open claims carry plain first-person uncertainty (Kim et al. 2024), and anyone can contest a claim or an
// objection in place ("This looks wrong", Amershi G9/G15).
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fillIdea, loadApp, reportShown } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

type Ev = { type: string; payload: Record<string, unknown> };

async function report() {
  const app = await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  fillIdea();
  fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
  await reportShown();
  return app;
}

describe("a report sets expectations and admits uncertainty", () => {
  it("says what was checked and that it can be wrong, with a link to the limitations", async () => {
    await report();
    const note = screen.getByRole("complementary", { name: "Before you rely on this" });
    expect(within(note).getByText(/we can be wrong/)).toBeTruthy();
    expect(within(note).getByText(/not that the claim is false/)).toBeTruthy();
    expect(within(note).getByRole("button", { name: "What VistaDex can and cannot do" })).toBeTruthy();
  }, 30000);

  it("an unverified claim says plainly that we are not sure", async () => {
    await report();
    const unverified = screen.getAllByRole("article").filter(a => /Unverified$/.test(a.getAttribute("aria-label") || ""));
    expect(unverified.length).toBeGreaterThan(0);
    expect(within(unverified[0]).getByText(/^We're not sure: we could not find two independent sources/)).toBeTruthy();
  }, 30000);
});

describe("This looks wrong", () => {
  it("contests a claim or an objection in place, logged with its status or severity, once each", async () => {
    const { tm } = await report();
    const claims = screen.getAllByRole("button", { name: /^This looks wrong: claim 1$/ });
    fireEvent.click(claims[0]);
    expect(screen.getByText("Noted: you think claim 1 looks wrong. Thank you.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^This looks wrong: objection 1$/ }));
    const flags = (tm.events() as Ev[]).filter(e => e.type === "report_flag");
    expect(flags).toHaveLength(2);
    expect(flags[0].payload).toMatchObject({ kind: "claim", index: 0, severity: null });
    expect(typeof flags[0].payload.status).toBe("string");
    expect(flags[1].payload).toMatchObject({ kind: "objection", index: 0, status: null });
    expect(screen.queryByRole("button", { name: /^This looks wrong: claim 1$/ })).toBe(null);
  }, 30000);
});
