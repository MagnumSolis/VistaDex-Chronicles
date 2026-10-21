// The footer mentions the usage study only where usage is recorded (public); the pitch edition records
// nothing and has no "Your data & privacy" page, so its footer says nothing about it.
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadApp } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

const STUDY = "This demo is part of a BITS Pilani research study — your anonymous usage helps us study how people judge startup ideas with AI. Opt out any time via “Your data & privacy”.";
const footer = () => document.querySelector("footer")!.textContent!;

describe("footer", () => {
  it("public: unchanged, with the study note and the Your data & privacy link", async () => {
    await loadApp({ hash: "#/contact" });
    await screen.findByRole("heading", { name: "Talk to the team" });
    expect(footer()).toContain(STUDY);
    expect(footer()).toContain("Prototype. Reports can be wrong; you make the decision.");
    expect(within(document.querySelector("footer")!).getByRole("link", { name: "Your data & privacy" })).toBeTruthy();
  });
  it("pitch: no word about studying usage or opting out", async () => {
    await loadApp({ edition: "pitch", hash: "#/contact" });
    await screen.findByRole("heading", { name: "Talk to the team" });
    expect(footer()).not.toMatch(/research study|usage|opt out|Your data/i);
    expect(footer()).toContain("Prototype. Reports can be wrong; you make the decision.");
  });
});
