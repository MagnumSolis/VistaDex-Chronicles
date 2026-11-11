// The report's summary counts "leads to check" the same way the section does: products already doing
// something similar plus startups that shut down, with the split spelled out.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { loadApp, reportShown } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); });

it("summary and section give the same number of leads to check", async () => {
  await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  fireEvent.click(await screen.findByRole("button", { name: "AI contract review for startups" }));
  fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
  await reportShown();
  const summary = screen.getByText(/Also in this report:/).textContent!.replace(/\s+/g, " ");
  const m = summary.match(/(\d+) leads? to check \((\d+) similar products?, (\d+) shut-down startups?\)/);
  expect(m, summary).toBeTruthy();
  const [, total, prod, dead] = m!.map(Number);
  expect(total).toBe(prod + dead);
  expect(document.body.textContent).toMatch(new RegExp(`Leads to check\\s*${total}`));
}, 30000);
