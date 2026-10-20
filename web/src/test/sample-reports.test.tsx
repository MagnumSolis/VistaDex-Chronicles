// "Sample reports" toggle on the Reports page: off by default, 5/10/15, labelled, never stored,
// works with sort/filter/the full report, and every score is the scoring code's own output.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { go, loadApp } from "./helpers";
import { overlapBand, scoreReport } from "@proto/core/scoring.js";
import { validateContract } from "@proto/core/contract.js";
import { SAMPLE_IDEAS } from "@proto/data/sample-reports.js";

const toggle = () => screen.getByLabelText("Sample reports") as HTMLSelectElement;
const setSamples = (n: string) => fireEvent.change(toggle(), { target: { value: n } });
const cards = () => within(screen.getByRole("region", { name: "Reports" })).queryAllByRole("button", { name: /^Open report:/ });

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Sample reports toggle", () => {
  it("is Off by default, adds 5 / 10 / 15 labelled samples, stores none, and is Off again after a reload", async () => {
    const { tm } = await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    go("#/reports");
    expect(await screen.findByText("No reports yet")).toBeTruthy();
    expect(toggle().value).toBe("0");
    expect(screen.queryByText("Sample report")).toBeNull();

    for (const n of [5, 10, 15]) {
      setSamples(String(n));
      await waitFor(() => expect(cards().length).toBe(n));
      expect(screen.getAllByText("Sample report").length).toBe(n);
      expect(screen.getByText(`${n} of ${n} shown`)).toBeTruthy();
      expect(screen.getByText("Ideas analysed").nextElementSibling?.textContent).toBe(String(n));
    }
    expect(localStorage.getItem("vistadex.reports.v1")).toBeNull();
    const pressed = tm.events().filter((e: { type: string; payload: { control?: string } }) => e.type === "control_pressed" && e.payload.control === "reports_samples");
    expect(pressed.map((e: { payload: { value?: string } }) => e.payload.value)).toEqual(["5", "10", "15"]);

    setSamples("0");
    expect(await screen.findByText("No reports yet")).toBeTruthy();
    setSamples("5");
    await waitFor(() => expect(cards().length).toBe(5));
    cleanup();
    await loadApp({ hash: "#/reports" });
    await screen.findByLabelText("Sample reports");
    expect(toggle().value).toBe("0");
    expect(screen.queryByText("Sample report")).toBeNull();
  }, 20000);

  it("samples work with filters, sorting and the full report view", async () => {
    await loadApp({ hash: "#/reports" });
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    go("#/reports");
    await screen.findByLabelText("Sample reports");
    setSamples("15");
    await waitFor(() => expect(cards().length).toBe(15));

    fireEvent.change(screen.getByLabelText("Industry"), { target: { value: "Fintech" } });
    const fintech = SAMPLE_IDEAS.filter(i => i.input.industries.includes("Fintech")).length;
    await waitFor(() => expect(cards().length).toBe(fintech));
    fireEvent.change(screen.getByLabelText("Industry"), { target: { value: "all" } });

    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "score" } });
    const { sampleEntries } = await import("@/lib/reports");
    const best = [...sampleEntries()].sort((a, b) => (b.report.scores?.vistadex.value ?? -1) - (a.report.scores?.vistadex.value ?? -1))[0];
    await waitFor(() => expect(cards()[0].getAttribute("aria-label")).toBe(`Open report: ${best.title}`));

    fireEvent.click(cards()[0]);
    await waitFor(() => expect(location.hash).toBe(`#/report/${best.id}`));
    expect(await screen.findByRole("heading", { level: 1, name: best.title })).toBeTruthy();
    expect(screen.getByText(/^Sample report ·/)).toBeTruthy();
    expect(screen.getByText(/^Sources checked/)).toBeTruthy();
    go("#/reports");
    await waitFor(() => expect(cards().length).toBe(15)); // the choice holds while the page stays loaded
    expect(localStorage.getItem("vistadex.reports.v1")).toBeNull();
  }, 20000);
});

describe("sample report content", () => {
  it("validates, and its scores and overlap band are exactly what the scoring code computes", async () => {
    const { sampleEntries } = await import("@/lib/reports");
    const entries = sampleEntries();
    expect(entries.length).toBe(15);
    for (const e of entries) {
      expect(e.kind).toBe("sample");
      expect(validateContract(e.report)).toEqual([]);
      const { scores, overlap_band, ...rest } = e.report;
      expect(scores).toEqual(scoreReport(rest));
      expect(overlap_band).toBe(overlapBand(rest));
    }
  });
});
