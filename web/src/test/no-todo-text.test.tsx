// No visitor-facing screen may show a TODO(team) placeholder (e.g. a contact address not filled in).
// Every route, in both editions, plus a session report, a demo report and a sample report.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { go, loadApp, reportShown } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

const ROUTES = ["#/", "#/welcome", "#/screen", "#/running", "#/reports", "#/how-it-works", "#/contact", "#/feedback", "#/report", "#/report/sample-student-bank", "#/nowhere"];
const todos = (where: string) => (document.body.textContent?.includes("TODO") ? [where] : []);

describe("no TODO(team) text on any screen", () => {
  it("public edition", async () => {
    await loadApp({ hash: "#/" });
    const found: string[] = [...todos("#/ before the notice")];
    go("#/screen");
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mental-health journaling app" }));
    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    await reportShown();
    found.push(...todos("session report"));
    for (const r of ROUTES) { go(r); await new Promise(res => setTimeout(res, 50)); found.push(...todos(r)); }
    expect(found).toEqual([]);
  }, 30000);

  it("pitch edition", async () => {
    await loadApp({ edition: "pitch" });
    const found: string[] = [];
    for (const r of [...ROUTES, "#/report/idea-01"]) { go(r); await new Promise(res => setTimeout(res, 50)); found.push(...todos(r)); }
    expect(found).toEqual([]);
  }, 30000);
});
