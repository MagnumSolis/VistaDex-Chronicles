// App flows: Welcome gate and telemetry, running a screening, refusals, cancel, report states, editions.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByText(/at least two independent sources/)).toBeTruthy();
    expect(screen.getByText(/word overlap/)).toBeTruthy();
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
    expect(screen.getAllByText(/Sample data, not real/).length).toBe(2);
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
    go("#/graveyard");
    await screen.findByRole("heading", { name: "Startups that shut down" });
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

  it("public reports have no history or shareable URL: #/report/<id> goes to #/report; nothing before a run", async () => {
    await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    go("#/report/idea-01");
    await waitFor(() => expect(location.hash).toBe("#/report"));
    expect(await screen.findByText("You haven't screened an idea in this tab yet.")).toBeTruthy();
    go("#/dashboard");
    await waitFor(() => expect(location.hash).toBe("#/screen")); // no dashboard in the public edition
  });
});

describe("link fragments", () => {
  it("a #code= opened in a tab already showing the app is captured before the router redirects", async () => {
    await loadApp();
    await screen.findByRole("button", { name: "Skip to the tool" });
    go("#code=K7Q2-MX9P");
    await waitFor(() => expect(location.hash).toBe("#/welcome"));
    expect(sessionStorage.getItem("vistadex.access")).toBe("K7Q2-MX9P");
    expect(location.href).not.toContain("K7Q2");
  });
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

describe("live runs never get legal or market data", () => {
  it("shows the neutral not-available state and says the server runs the stages together", async () => {
    stubFetch(url => (url.endsWith("/screen") ? json(PROXY_REPORT, 200, { "X-VistaDex-Mode": "live" }) : json({ stored: 1 })));
    await loadApp({ proxy: true });
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    fillIdea();
    run();
    await reportShown();
    expect(screen.getAllByText("Not available in this version yet").length).toBe(2);
    expect(screen.queryByText(/Sample data, not real/)).toBeNull();
  });
});
