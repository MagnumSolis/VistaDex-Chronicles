// The study's last step: which helped more, the AI chatbot's answer or the VistaDex report. Shown once both
// parts are done; the tools' options swap places by the code's number; "Next participant" starts fresh.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { go, loadApp, reportShown } from "./helpers";
import { markConditionDone, registerStudyParticipant } from "@/study/participant";

afterEach(() => { cleanup(); localStorage.clear(); });
type Ev = { type: string; session_id: string; payload: Record<string, unknown> };

async function bothDone(code: string) {
  const app = await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  registerStudyParticipant(code, null, "A");
  markConditionDone("baseline");
  markConditionDone("vistadex");
  go("/compare");
  await screen.findByRole("heading", { name: "The AI chatbot or VistaDex?" });
  return app;
}
const options = (q: RegExp) => within(screen.getByRole("group", { name: q })).getAllByRole("radio").map(r => r.closest("label")!.textContent);

describe("comparison page", () => {
  it("records the six answers, the reason and the order the options were shown in", async () => {
    const { tm } = await bothDone("P07");
    expect(options(/^Overall/)).toEqual(["The AI chatbot", "VistaDex", "About the same"]);
    fireEvent.click(screen.getByRole("button", { name: "Submit and finish" }));
    expect(screen.getByRole("alert").textContent).toMatch(/first question/);
    fireEvent.click(within(screen.getByRole("group", { name: /^Overall/ })).getByRole("radio", { name: "VistaDex" }));
    fireEvent.click(within(screen.getByRole("group", { name: /more honest/ })).getByRole("radio", { name: "The AI chatbot" }));
    fireEvent.change(screen.getByLabelText(/^Why\?/), { target: { value: "The sources." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit and finish" }));
    expect((tm.events() as Ev[]).find(e => e.type === "tool_preference")!.payload).toEqual({
      overall: "vistadex", accuracy: null, evidence: null, risks: null, honesty: "chatbot", decision: null, options_order: "chatbot_first", why: "The sources.",
    });
    expect(await screen.findByRole("heading", { name: "You've finished both parts" })).toBeTruthy();
  }, 30000);

  it("an even code sees VistaDex first", async () => {
    await bothDone("P08");
    expect(options(/^Overall/)).toEqual(["VistaDex", "The AI chatbot", "About the same"]);
  }, 30000);

  it("Next participant starts a fresh participant on the study page, with the notice again", async () => {
    const { tm } = await bothDone("P09");
    const old = tm.sessionId();
    fireEvent.click(within(screen.getByRole("group", { name: /^Overall/ })).getByRole("radio", { name: "About the same" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit and finish" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next participant" }));
    await waitFor(() => expect(location.hash).toBe("#/study"));
    expect(tm.consentStatus()).toBe(null);
    expect(tm.sessionId()).not.toBe(old);
    expect(localStorage.getItem("vistadex_participant")).toBe(null);
  }, 30000);

  it("before both parts are done it points back to the study page", async () => {
    await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    registerStudyParticipant("P10", null, "A");
    go("/compare");
    expect(await screen.findByRole("heading", { name: "Finish both parts first" })).toBeTruthy();
  }, 30000);
});

describe("VistaDex report snapshot", () => {
  it("a study participant's run sends what the report said; a field visitor's run sends nothing of it", async () => {
    registerStudyParticipant("P11", null, "B");
    markConditionDone("baseline");
    const { tm } = await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    go("/screen");
    fireEvent.click(await screen.findByRole("button", { name: /^Run$/ }));
    await reportShown();
    const snap = (tm.events() as Ev[]).find(e => e.type === "vistadex_report_snapshot")!.payload;
    expect(snap.idea_key).toBe("B");
    expect(snap.run_id).toBe((tm.events() as Ev[]).find(e => e.type === "run_started")!.payload.run_id);
    const report = snap.report as { claims: { claim: string; status: string }[]; objections: unknown[]; sources: number };
    expect(report.claims.length).toBeGreaterThan(0);
    expect(typeof report.claims[0].status).toBe("string");
    expect(report.objections.length).toBeGreaterThan(0);
    expect(typeof report.sources).toBe("number");
  }, 30000);

  it("field track: no snapshot", async () => {
    const { tm } = await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    go("/screen");
    fireEvent.click(await screen.findByRole("button", { name: "Mental-health journaling app" }));
    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    await reportShown();
    expect((tm.events() as Ev[]).some(e => e.type === "vistadex_report_snapshot")).toBe(false);
  }, 30000);
});
