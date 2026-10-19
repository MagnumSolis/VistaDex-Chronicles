// Walkthrough: the Run gate, pausing while running, resuming on the report, cancel/failure back to
// the Run step, Resume tour after leaving, and position locked to the target in document coordinates.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { go, json, loadApp, reportShown, stubFetch } from "./helpers";

const card = () => screen.queryByTestId("tour-card");
const title = () => card()?.querySelector("h2")?.textContent;
const next = () => fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
const types = (tm: { events: () => { type: string }[] }) => tm.events().map(e => e.type);

async function startTour(opts: Parameters<typeof loadApp>[0] = {}) {
  const app = await loadApp(opts);
  fireEvent.click(await screen.findByRole("button", { name: "Start with walkthrough" }));
  await waitFor(() => expect(title()).toBe("Paste an idea"));
  return app;
}
async function toRunStep() {
  next(); next(); next();
  await waitFor(() => expect(title()).toBe("Press Run"));
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("walkthrough gating", () => {
  it("Next is disabled on the Run step; Run hides the tour while running and resumes on the report", async () => {
    const { tm } = await startTour();
    next();
    expect(title()).toBe("Or load a sample");
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(title()).toBe("Paste an idea");
    fireEvent.click(screen.getByRole("button", { name: "Mental-health journaling app" })); // page stays usable
    await toRunStep();
    const nextBtn = screen.getByRole("button", { name: /^Next/ }) as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
    expect(card()!.textContent).toContain("Press Run to continue");
    fireEvent.click(nextBtn);
    expect(title()).toBe("Press Run");

    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    await screen.findByRole("heading", { name: "Screening your idea" });
    expect(card()).toBeNull();                                  // hidden while running
    expect(screen.queryByRole("button", { name: /Resume tour/ })).toBeNull();
    await reportShown();
    await waitFor(() => expect(title()).toBe("Counts, not a score")); // first report step
    fireEvent.click(screen.getByRole("button", { name: /Skip tour/ }));
    expect(card()).toBeNull();
    const ended = tm.events().find((e: { type: string }) => e.type === "walkthrough_ended");
    expect(ended.payload).toEqual({ how: "skip", at_step: "summary" });
    expect(types(tm)).toContain("walkthrough_step_time");
  }, 20000);

  it("a cancelled run returns to the Run step on Screen an idea", async () => {
    await startTour();
    fireEvent.click(screen.getByRole("button", { name: "AI contract review for startups" }));
    await toRunStep();
    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(location.hash).toBe("#/screen"));
    await waitFor(() => expect(title()).toBe("Press Run"));
  }, 15000);

  it("a failed run returns to the Run step", async () => {
    stubFetch(url => (url.endsWith("/screen") ? json({ error: "internal error" }, 500) : json({ stored: 1 })));
    await startTour({ proxy: true });
    fireEvent.change(screen.getByLabelText("Idea text"), { target: { value: "We are building a thing. No such thing exists." } });
    // Run pressed before reaching the gate step: the tour moves to the gate, then back to it after failing.
    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    expect(await screen.findByText("The screening did not finish")).toBeTruthy();
    await waitFor(() => expect(title()).toBe("Press Run"));
  });

  it("leaving the step's page pauses the tour behind a Resume tour control", async () => {
    await startTour();
    next();
    go("#/how-it-works");
    await screen.findByRole("heading", { name: "Evidence first. You decide." });
    expect(card()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Resume tour/ }));
    await waitFor(() => expect(location.hash).toBe("#/screen"));
    await waitFor(() => expect(title()).toBe("Or load a sample"));
  });

  it("replays from the ? button", async () => {
    await startTour();
    fireEvent.click(screen.getByRole("button", { name: /Skip tour/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Replay the walkthrough" })[0]);
    await waitFor(() => expect(title()).toBe("Paste an idea"));
  });
});

describe("walkthrough position", () => {
  it("highlight and card stay locked to the target in document coordinates through a scroll", async () => {
    // Layout stand-in: the idea block sits at document y = 900, x = 40 (360 × 300).
    let scrollY = 0;
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 4000 });
    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1280 });
    const real = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if ((this as HTMLElement).dataset?.tour === "idea") return { top: 900 - scrollY, left: 40, width: 360, height: 300, bottom: 1200 - scrollY, right: 400, x: 40, y: 900 - scrollY, toJSON() {} } as DOMRect;
      return real.call(this);
    });
    // Desktop width, so the card is placed next to the target rather than docked.
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("min-width"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    await startTour();
    const highlight = () => screen.getByTestId("tour-highlight");
    expect(highlight().style.top).toBe("900px");
    expect(highlight().style.left).toBe("40px");
    expect(card()!.style.top).toBe("1216px"); // just below the target: 900 + 300 + 16

    await act(async () => { scrollY = 650; window.dispatchEvent(new Event("scroll")); window.dispatchEvent(new Event("resize")); });
    expect(highlight().style.top).toBe("900px"); // unchanged: positioned in the document, it scrolls with the page
    expect(card()!.style.top).toBe("1216px");
  });
});
