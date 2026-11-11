// App flows: Welcome gate and telemetry, running a screening, refusals, cancel, report states, editions.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { fillIdea, go, json, loadApp, PROXY_REPORT, reportShown, stubFetch } from "./helpers";

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLTextAreaElement;
const run = () => fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
const types = (tm: { events: () => { type: string }[] }) => tm.events().map(e => e.type);

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("public edition: Welcome notice comes before any telemetry", () => {
  it("first visit lands on Welcome, even from a deep link, and nothing is recorded yet", async () => {
    const calls = stubFetch(() => json({}));
    const { tm } = await loadApp({ hash: "#/graveyard" });
    expect(await screen.findByRole("heading", { name: /See the evidence behind a startup idea/ })).toBeTruthy();
    expect(location.hash).toBe("#/welcome");
    go("#/screen");
    await waitFor(() => expect(location.hash).toBe("#/welcome"));
    expect(tm.events()).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("How it works can be read before answering the notice, and is not recorded", async () => {
    const { tm } = await loadApp();
    await screen.findByRole("button", { name: "Skip to the tool" });
    go("#/how-it-works");
    expect(await screen.findByRole("heading", { name: "Evidence first. You decide." })).toBeTruthy();
    expect(screen.getAllByText(/at least two independent sources/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/word overlap/).length).toBeGreaterThan(0);
    expect(screen.getByText("The VistaDex Score")).toBeTruthy();
    expect(tm.events()).toEqual([]);
  });

  it("Skip to the tool → sample → Run → report; idea text and report content never reach telemetry", async () => {
    const { tm } = await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    fireEvent.click(await screen.findByRole("button", { name: "AI contract review for startups" }));
    const pitch = field(/^One-line pitch/).value;
    fireEvent.click(screen.getByRole("button", { name: /^EU/ }));
    run();
    expect(await screen.findByRole("heading", { name: "Screening your idea" })).toBeTruthy();
    await reportShown();
    const t = types(tm);
    for (const type of ["consent_given", "welcome_choice", "view_changed", "control_pressed", "run_started", "run_completed"]) expect(t).toContain(type);
    const completed = tm.events().find((e: { type: string }) => e.type === "run_completed");
    expect(Object.keys(completed.payload).sort()).toEqual(["counts", "duration_ms", "mode", "run_id", "trace_id"]);
    const all = JSON.stringify(tm.events());
    expect(all).not.toContain(pitch.slice(0, 40));
    expect(all).not.toContain("contract review tool"); // no claim text either
    const started = tm.events().find((e: { type: string }) => e.type === "run_started");
    expect(started.payload).toMatchObject({ markets: ["EU"], sample: null, role: "founder", industries: ["AI/ML", "SaaS/B2B"] });
    expect(started.payload.field_chars.pitch).toBe(pitch.length);
    // mock mode: legal and market show clearly labelled sample data, only for the picked market
    // mock mode: competitors, Big Tech, legal and market are clearly labelled sample data
    expect(screen.getAllByText(/Sample data, not real/).length).toBe(4);
    // the score is shown with its breakdown one tap away, and says it includes sample data
    expect(screen.getByText("VistaDex Score")).toBeTruthy();
    expect(screen.getByText("Includes sample data")).toBeTruthy();
    const how = screen.getByRole("button", { name: /How this was calculated/ });
    expect(how.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(how);
    expect(how.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByText(/Weights: Novelty 25, Market 20/).length).toBe(1);
    expect(screen.getByText(/Checked against 18 entries \(unverified seed\)/)).toBeTruthy();
    // charts have text equivalents
    expect(screen.getByRole("img", { name: /n\/a = not enough data/ })).toBeTruthy();
    expect(screen.getByRole("table", { name: /Each axis out of 100/ })).toBeTruthy();
    expect(screen.getByRole("table", { name: /Claim outcomes/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Products already doing something similar/ })).toBeTruthy();
    expect(screen.getByText(/Unverified risk/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /European Union/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /United States/ })).toBeNull();
  }, 20000);

  it("Use without recording: the tool works and nothing is ever recorded or sent", async () => {
    const { tm } = await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Use without recording" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mental-health journaling app" }));
    run();
    await reportShown();
    expect(tm.events()).toEqual([]);
    expect(tm.consentStatus()).toBe("declined");
  }, 20000);

  it("required fields are checked inline; the draft survives leaving and coming back", async () => {
    await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    run();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Fill in these fields/);
    for (const l of ["Idea title", "One-line pitch", "Problem", "Solution"]) expect(alert.textContent).toContain(l);
    expect(field(/^Idea title/).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Idea title is required.")).toBeTruthy();
    fillIdea();
    expect(screen.queryByText("Idea title is required.")).toBeNull();
    go("#/how-it-works");
    await screen.findByRole("heading", { name: "Evidence first. You decide." });
    go("#/screen");
    expect((await screen.findByLabelText(/^Solution/) as HTMLTextAreaElement).value).toBe("No such thing exists.");
  });

  it("Cancel stops the run, keeps the text and logs run_cancelled", async () => {
    const { tm } = await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    fireEvent.click(await screen.findByRole("button", { name: "AI contract review for startups" }));
    run();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(location.hash).toBe("#/screen"), { timeout: 5000 });
    expect(field(/^One-line pitch/).value).toMatch(/legal contract review/);
    await waitFor(() => expect(types(tm)).toContain("run_cancelled"));
    expect(types(tm)).not.toContain("run_completed");
  }, 15000);

  it("public Reports lists the reports this browser ran, keeps them across reloads, and clears them", async () => {
    await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    go("#/reports");
    expect(await screen.findByText("No reports yet")).toBeTruthy();
    go("#/screen");
    fireEvent.click(await screen.findByRole("button", { name: "AI contract review for startups" }));
    run();
    await reportShown();
    const stored = JSON.parse(localStorage.getItem("vistadex.reports.v1") || "[]");
    expect(stored.length).toBe(1);
    expect(stored[0].report.input.title).toBe("LegalAI for Startups");

    // a fresh page in the same browser still has it
    cleanup();
    await loadApp({ hash: "#/reports" });
    expect(await screen.findByRole("heading", { name: "LegalAI for Startups" })).toBeTruthy();
    expect(screen.getByText("Ideas analysed")).toBeTruthy();
    expect(screen.getByText(/Counts only: a pattern needs at least 5 reports/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Open report: LegalAI/ }));
    await waitFor(() => expect(location.hash).toMatch(/^#\/report\//));
    expect(await screen.findByRole("heading", { name: "Your report" })).toBeTruthy();
    go("#/reports");
    fireEvent.click(await screen.findByRole("button", { name: /Clear my reports/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Clear my reports" }));
    expect(await screen.findByText("No reports yet")).toBeTruthy();
    expect(localStorage.getItem("vistadex.reports.v1")).toBeNull();
    go("#/report/nope");
    expect(await screen.findByText("That report isn't here.")).toBeTruthy();
    go("#/dashboard");
    await waitFor(() => expect(location.hash).toBe("#/dashboard"));
    expect(await screen.findByText("No reports yet")).toBeTruthy(); // old Dashboard links open Reports
  }, 20000);

  it("Reports still works when storage is blocked (kept for the tab only)", async () => {
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Use without recording" }));
    get.mockImplementation(() => { throw new Error("blocked"); });
    set.mockImplementation(() => { throw new Error("blocked"); });
    fireEvent.click(await screen.findByRole("button", { name: "Mental-health journaling app" }));
    run();
    await reportShown();
    go("#/reports");
    expect(await screen.findByRole("heading", { name: "Mental-health journaling app" })).toBeTruthy();
    get.mockRestore(); set.mockRestore();
  }, 20000);
});

describe("feedback", () => {
  it("is stored under its own random id, never with the usage events", async () => {
    const calls = stubFetch(() => json({ stored: 1 }));
    const { tm } = await loadApp({ proxy: true });
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    go("#/feedback");
    fireEvent.click(await screen.findByRole("button", { name: "Send feedback" }));
    expect(await screen.findByText("Answer at least one question first.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Investor"));
    fireEvent.click(screen.getByLabelText("Objections"));
    fireEvent.change(screen.getByLabelText("What was wrong or missing?"), { target: { value: "Needs EU sources" } });
    fireEvent.change(screen.getByLabelText(/Email, if we may follow up/), { target: { value: "vc@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(await screen.findByText("Your answers are saved. We read every one.")).toBeTruthy();
    const sent = calls.map(c => JSON.parse(c.body)).find(b => b.events?.[0]?.type === "feedback_submitted");
    expect(sent.session_id).not.toBe(tm.sessionId());
    expect(sent.events[0].payload).toEqual({ role: "investor", useful: null, section: "objections", would_use: null, wrong: "Needs EU sources", email: "vc@example.com" });
    const usage = JSON.stringify(tm.events());
    expect(usage).not.toContain("vc@example.com");
    expect(usage).not.toContain("Needs EU sources");
  });

  it("in mock mode says honestly that nothing was sent", async () => {
    await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    go("#/feedback");
    fireEvent.click(await screen.findByLabelText("Founder"));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(await screen.findByText(/no server connected \(mock mode\)/)).toBeTruthy();
  });
});

describe("refusals and failures show friendly messages on Screen an idea", () => {
  const refuse = async (status: number, body: unknown) => {
    stubFetch(url => (url.endsWith("/screen") ? json(body, status) : json({ stored: 1 })));
    const { tm } = await loadApp({ proxy: true });
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    fillIdea();
    run();
    return tm;
  };
  it("daily cap", async () => {
    const tm = await refuse(429, { error: "daily_cap" });
    expect(await screen.findByText("VistaDex has reached today's limit")).toBeTruthy();
    expect(field(/^Problem/).value).toMatch(/building a thing/);
    const failed = tm.events().find((e: { type: string }) => e.type === "run_failed");
    expect(failed.payload.code).toBe("daily_cap");
  });
  it("rate limit", async () => {
    await refuse(429, { error: "rate_limited" });
    expect(await screen.findByText("That was a lot of screenings at once")).toBeTruthy();
  });
  it("pipeline failure", async () => {
    await refuse(500, { error: "internal error" });
    expect(await screen.findByText("The screening did not finish")).toBeTruthy();
  });
});

describe("a live report the server sent without market, legal or Big Tech data", () => {
  it("shows the neutral not-available state, and asks for a target market for legal", async () => {
    stubFetch(url => (url.endsWith("/screen") ? json(PROXY_REPORT, 200, { "X-VistaDex-Mode": "live" }) : json({ stored: 1 })));
    await loadApp({ proxy: true });
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    fillIdea();
    run();
    await reportShown();
    expect(screen.getAllByText("Not available in this version yet").length).toBe(2); // Big Tech, market
    expect(screen.getByText("No target market was picked for this screening")).toBeTruthy(); // legal
    expect(screen.getByText(/Competitor search: not available in this version yet/)).toBeTruthy();
    expect(screen.queryByText(/Sample data, not real/)).toBeNull();
  });
});
