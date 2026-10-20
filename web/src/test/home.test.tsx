// Home (landing): readable before the Welcome notice and not recorded; its buttons route correctly; the
// transparency note matches the Welcome notice; the pitch edition opens on Reports.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { go, loadApp } from "./helpers";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Home", () => {
  it("is the public start page, readable without the notice and not recorded", async () => {
    const { tm } = await loadApp({ hash: "" });
    expect(await screen.findByRole("heading", { name: /Find out if your idea already died once/ })).toBeTruthy();
    for (const h of ["Confidence is not the same as evidence.", "A research trail, not a magic answer.", "One workflow. Three views.",
      "A better first pass for people making real decisions.", "Take the guided path. Tell us where it breaks.", "Built by students at BITS Pilani."]) {
      expect(screen.getByRole("heading", { name: h })).toBeTruthy();
    }
    expect(screen.queryByText(/APPCAIR/)).toBeNull();
    expect(screen.queryByText(/No score\. No verdict\./)).toBeNull();
    expect(screen.getByText("A score you can take apart. You decide.")).toBeTruthy();
    // the transparency note uses the Welcome notice's own wording
    const { NOTICE } = await import("@proto/ui/study-config.js");
    const note = screen.getByRole("complementary", { name: "What the demo records" });
    expect(note.textContent).toContain(NOTICE.recorded);
    expect(note.textContent).toContain(NOTICE.identity);
    expect(note.textContent).toContain(NOTICE.reportsLocal);
    // product screens are real components, inert
    expect(document.querySelectorAll("[inert]").length).toBe(3);
    expect(tm.events()).toEqual([]);
  });

  it("Try the demo goes through the Welcome notice and continues to Screen an idea", async () => {
    await loadApp({ hash: "" });
    fireEvent.click(await screen.findByRole("button", { name: /Try the demo/ }));
    await waitFor(() => expect(location.hash).toBe("#/welcome"));
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    await waitFor(() => expect(location.hash).toBe("#/screen"));
    expect(await screen.findByRole("heading", { name: "What are you building?" })).toBeTruthy();
  });

  it("See how it works opens How it works without the notice", async () => {
    await loadApp({ hash: "" });
    fireEvent.click(await screen.findByRole("button", { name: "See how it works" }));
    await waitFor(() => expect(location.hash).toBe("#/how-it-works"));
  });

  it("a deep link to Reports also continues there after the notice", async () => {
    await loadApp({ hash: "#/reports" });
    await waitFor(() => expect(location.hash).toBe("#/welcome"));
    fireEvent.click(await screen.findByRole("button", { name: "Use without recording" }));
    await waitFor(() => expect(location.hash).toBe("#/reports"));
  });

  it("pitch: a fresh load opens on Reports; Home is one tap away", async () => {
    await loadApp({ edition: "pitch" });
    expect(await screen.findByRole("heading", { name: "Screened ideas" })).toBeTruthy();
    go("#/");
    expect(await screen.findByRole("heading", { name: /Find out if your idea already died once/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Give feedback" })).toBeNull();
  });
});
