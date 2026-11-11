// The rating panel is part of the report: a "Your read" section in the jump nav, before "Done reviewing?"
// and the feedback prompt, with a pointer from the Summary. Sample reports have no ratings, so no section.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { go, loadApp, reportShown } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); });

async function runReport() {
  await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  fireEvent.click(await screen.findByRole("button", { name: "Mental-health journaling app" }));
  fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
  await reportShown();
}

describe("Your read", () => {
  it("is a report section in the jump nav, before Done reviewing and the feedback prompt", async () => {
    await runReport();
    const nav = screen.getByRole("navigation", { name: "Report sections" });
    expect(nav.querySelector("[data-control-value=rate]")?.textContent).toMatch(/Your read/);
    const section = document.getElementById("section-rate")!;
    expect(section).toBeTruthy();
    expect(section.textContent).toMatch(/Do you agree\?/);
    const done = screen.getByText("Done reviewing?");
    expect(section.compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: /Go to Your read/ })).toBeTruthy();
  }, 30000);

  it("sample reports have no Your read section", async () => {
    await runReport();
    go("/reports");
    await screen.findByText("Ideas analysed");
    fireEvent.change(document.querySelector("[data-control=reports_samples]")!, { target: { value: "5" } });
    await screen.findAllByText("Sample report");
    const sampleOpen = [...document.querySelectorAll<HTMLElement>("[data-control=reports_open]")]
      .find(b => /Sample report/.test(b.parentElement?.textContent ?? ""))!;
    expect(sampleOpen).toBeTruthy();
    fireEvent.click(sampleOpen);
    await screen.findAllByText(/^Sample report/);
    expect(location.hash).toMatch(/^#\/report\/sample-/);
    await screen.findByRole("navigation", { name: "Report sections" });
    expect(document.getElementById("section-rate")).toBe(null);
  }, 30000);
});
