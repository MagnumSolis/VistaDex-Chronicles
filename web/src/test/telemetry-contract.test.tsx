// Every interactive control has a registered, stable id; the registry equals the contract; and the
// events the app emits use exactly the payload keys the contract lists.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { CONTROLS } from "@/telemetry/controls";
import { go, loadApp, reportShown } from "./helpers";

const contract = JSON.parse(readFileSync(resolve(process.cwd(), "../tests/fixtures/event-contract.json"), "utf8"));

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("control registry", () => {
  it("equals the contract's control list", () => {
    expect([...CONTROLS].sort()).toEqual([...contract.controls].sort());
  });
  it("every registered id is used somewhere in the source", () => {
    const root = resolve(process.cwd(), "src");
    let src = "";
    const walk = (d: string) => readdirSync(d).forEach(n => {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (!/retired|test/.test(n)) walk(p); }
      else if (/\.tsx?$/.test(n) && !n.endsWith("controls.ts")) src += readFileSync(p, "utf8");
    });
    walk(root);
    // ids may also be built from a template prefix (`nav_${id}`, `idea_${f.id}`)
    const unused = CONTROLS.filter(id => !src.includes(`"${id}"`) && !src.includes("`" + id.split("_")[0] + "_${"));
    expect(unused).toEqual([]);
  });
});

function unregistered() {
  const ids = new Set<string>(CONTROLS);
  return [...document.querySelectorAll("button, a[href], input, textarea, select, [role=radio], [role=slider]")]
    .filter(el => !(el as HTMLElement).closest("[data-control]") || !ids.has(((el as HTMLElement).closest("[data-control]") as HTMLElement).dataset.control!))
    .filter(el => !(el instanceof HTMLInputElement && el.type === "radio" && el.closest("label")?.querySelector("[data-control]")))
    .map(el => `${el.tagName.toLowerCase()} "${(el.textContent || (el as HTMLInputElement).name || el.getAttribute("aria-label") || "").trim().slice(0, 40)}" on ${location.hash}`);
}

describe("every interactive element on every screen has a registered data-control", () => {
  it("public edition", async () => {
    await loadApp();
    await screen.findByRole("button", { name: "Skip to the tool" });
    const missing = unregistered();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the tool" }));
    await screen.findByLabelText(/^Idea title/);
    missing.push(...unregistered());
    for (const path of ["#/reports", "#/how-it-works", "#/contact", "#/feedback", "#/report", "#/running", "#/nope", "#/welcome"]) {
      go(path);
      await new Promise(r => setTimeout(r, 0));
      missing.push(...unregistered());
    }
    go("#/screen");
    fireEvent.click(await screen.findByRole("button", { name: "AI contract review for startups" }));
    fireEvent.click(screen.getByRole("button", { name: /^EU/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    await screen.findByRole("heading", { name: "Screening your idea" });
    missing.push(...unregistered());
    await reportShown();
    const toggle = screen.queryAllByRole("button", { name: /Show sources/ })[0]; if (toggle) fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: /How this was calculated/ }));
    missing.push(...unregistered());
    go("#/reports");
    await screen.findByText("Ideas analysed");
    missing.push(...unregistered());
    fireEvent.click(screen.getByRole("button", { name: /Clear my reports/ }));
    await screen.findByRole("dialog");
    missing.push(...unregistered());
    expect([...new Set(missing)]).toEqual([]);
  }, 30000);
});

describe("emitted events match the contract", () => {
  it("payload keys and enum values", async () => {
    const { tm } = await loadApp();
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mental-health journaling app" }));
    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    await reportShown();
    fireEvent.click(screen.getAllByRole("button", { name: /Show sources|Summary/ })[0]);
    go("#/reports");
    await screen.findByText("Ideas analysed");
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "score" } });
    window.dispatchEvent(new Event("pagehide"));
    const events = tm.events() as { type: string; payload: Record<string, unknown> }[];
    expect(events.length).toBeGreaterThan(5);
    for (const e of events) {
      expect(Object.keys(e).sort(), e.type).toEqual([...contract.envelope].sort());
      const keys = contract.payload_keys[e.type];
      expect(keys, `${e.type} is in the contract`).toBeTruthy();
      const optional = contract.optional_keys[e.type] ?? [];
      expect(Object.keys(e.payload).filter(k => !optional.includes(k)).sort(), e.type).toEqual([...keys].sort());
      if (e.type === "control_pressed") expect(contract.controls).toContain(e.payload.control);
      if (e.type === "view_changed") expect(contract.values["view_changed.view"]).toContain(e.payload.view);
      if (e.type === "screen_time") expect(contract.values["screen_time.ended_by"]).toContain(e.payload.ended_by);
      if (e.type === "run_completed") expect(Object.keys(e.payload.counts as object).sort()).toEqual(contract.values["run_completed.counts"]);
      if (e.type === "report_time") expect(contract.values["report_time.ended_by"]).toContain(e.payload.ended_by);
    }
  }, 20000);
});
