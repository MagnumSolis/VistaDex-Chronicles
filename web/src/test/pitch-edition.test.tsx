// Pitch edition, in its own file so no public-edition modules from other tests share the window.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { fillIdea, go, json, loadApp, PROXY_REPORT, stubFetch } from "./helpers";

const run = () => fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("pitch edition", () => {
  it("opens on the Dashboard with the badge, has no Welcome, and sends zero events", async () => {
    // A previous public visit in this browser (same study version) left consent and unsent events behind.
    localStorage.setItem("vistadex.study.v1", JSON.stringify({
      session_id: "11111111-1111-4111-8111-111111111111", consent: "given", consent_at: "t", consent_version: "2026-10-public-3",
      seq: 1, sent: 0, events: [{ session_id: "11111111-1111-4111-8111-111111111111", seq: 1, ts: "t", type: "consent_given", study_version: "2026-10-public-3", payload: {} }],
    }));
    const calls = stubFetch(url => (url.endsWith("/screen") ? json(PROXY_REPORT, 200, { "X-VistaDex-Mode": "live" }) : json({ stored: 1 })));
    const { tm } = await loadApp({ edition: "pitch", proxy: true });
    expect(await screen.findByRole("heading", { name: "Screened ideas" })).toBeTruthy();
    expect(screen.getAllByTestId("edition-badge")[0].textContent).toBe("Pitch edition");
    expect(screen.queryByRole("link", { name: /Feedback/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Replay the walkthrough" })).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /Open report: LegalAI for Startups/ })[0]);
    expect(await screen.findByRole("heading", { name: "LegalAI for Startups" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Show sources/ })[0]);
    go("#/screen");
    await screen.findByLabelText(/^Idea title/);
    fillIdea();
    run();
    await waitFor(() => expect(location.hash).toMatch(/^#\/report\/[a-z0-9]+-r1$/), { timeout: 10000 });
    go("#/welcome");
    await waitFor(() => expect(location.hash).toBe("#/reports")); // no Welcome in pitch
    go("#/feedback");
    await waitFor(() => expect(location.hash).toBe("#/reports")); // no Feedback in pitch
    expect(await screen.findByText("Ideas analysed")).toBeTruthy();
    // demo reports went through the same scoring: every card has a score or says why not
    expect(screen.getAllByText("VistaDex Score").length).toBeGreaterThanOrEqual(8);
    expect(localStorage.getItem("vistadex.reports.v1")).toBeNull(); // pitch keeps session reports in memory only

    window.dispatchEvent(new Event("pagehide"));
    document.dispatchEvent(new Event("visibilitychange"));
    await tm.flush();
    await new Promise(r => setTimeout(r, 50));
    expect(calls.filter(c => c.url.endsWith("/events"))).toEqual([]);
    expect(tm.events().length).toBe(1); // only the old, never-sent event; nothing new was logged
  }, 20000);
});
