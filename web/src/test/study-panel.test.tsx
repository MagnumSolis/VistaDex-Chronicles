// The post-report form: an answer changes only when its own option is pressed. A click on the question
// text or the space around the options must not select (or log) anything.
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadApp, reportShown } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); });

type Ev = { type: string; payload: Record<string, unknown> };

async function openPanel() {
  const { tm } = await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  fireEvent.click(await screen.findByRole("button", { name: "Mental-health journaling app" }));
  fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
  await reportShown();
  return { tm, events: () => tm.events() as Ev[] };
}

const background = (question: HTMLElement) => {
  fireEvent.click(question);
  fireEvent.click(question.parentElement!);
  fireEvent.click(question.closest("section")!);
};

describe("post-report form", () => {
  it("'opened evidence links' keeps the chosen answer after background clicks, and logs it last", async () => {
    const { events } = await openPanel();
    const question = screen.getByText("Did you open any of the evidence links yourself?");
    const group = question.parentElement!;
    fireEvent.click(within(group).getByRole("radio", { name: "1-2" }));
    background(question);
    const pressed = events().filter(e => e.type === "control_pressed" && String(e.payload.control).startsWith("study_sources_"));
    expect(pressed.map(e => e.payload.control)).toEqual(["study_sources_1_2"]);
    expect((within(group).getByRole("radio", { name: "1-2" }) as HTMLInputElement).checked).toBe(true);
    expect((within(group).getByRole("radio", { name: "0" }) as HTMLInputElement).checked).toBe(false);
  }, 30000);

  it("the comprehension check selects and logs nothing on background clicks", async () => {
    const { events } = await openPanel();
    const question = screen.getByText(/Quick check: in your own understanding/);
    background(question);
    expect(events().filter(e => e.type === "comprehension_check")).toEqual([]);
    const second = within(question.parentElement!).getByRole("radio", { name: /failed or broke/ }) as HTMLInputElement;
    fireEvent.click(second);
    background(question);
    expect(events().filter(e => e.type === "comprehension_check").map(e => e.payload.answer)).toEqual(["system_failure"]);
    expect(second.checked).toBe(true);
  }, 30000);
});

describe("post-report form answers are native radios (option A)", () => {
  it("nothing preselected, one answer per question, changeable, same events and values", async () => {
    const { events } = await openPanel();
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.length).toBeGreaterThan(6);
    expect(radios.filter(r => r.checked)).toEqual([]);
    for (const r of radios) expect(r.closest("fieldset")?.querySelector("legend")?.textContent).toBeTruthy();

    const sources = screen.getByText("Did you open any of the evidence links yourself?").parentElement!;
    fireEvent.click(within(sources).getByRole("radio", { name: "3+" }));
    fireEvent.click(within(sources).getByRole("radio", { name: "0" }));
    expect((within(sources).getAllByRole("radio") as HTMLInputElement[]).map(r => r.checked)).toEqual([true, false, false]);
    expect(events().filter(e => e.type === "control_pressed" && String(e.payload.control).startsWith("study_sources_")).map(e => e.payload.control))
      .toEqual(["study_sources_3p", "study_sources_0"]);

    // Claim 1: agree, then change to disagree; pressing the chosen answer again logs again, as the buttons did.
    const claim = screen.getAllByText(/^Claim 1 \(/)[0].closest("fieldset")!;
    fireEvent.click(within(claim).getByRole("radio", { name: "Agree" }));
    fireEvent.click(within(claim).getByRole("radio", { name: "Disagree" }));
    fireEvent.click(within(claim).getByRole("radio", { name: "Disagree" }));
    expect((within(claim).getByRole("radio", { name: "Disagree" }) as HTMLInputElement).checked).toBe(true);
    expect(events().filter(e => e.type === "claim_vote").map(e => [e.payload.claim_index, e.payload.vote])).toEqual([[0, "agree"], [0, "disagree"], [0, "disagree"]]);
    expect(events().filter(e => e.type === "control_pressed" && String(e.payload.control).startsWith("study_claim_")).map(e => e.payload.control))
      .toEqual(["study_claim_agree", "study_claim_disagree", "study_claim_disagree"]);

    const objection = screen.getAllByText(/^Objection 1 /)[0].closest("fieldset")!;
    fireEvent.click(within(objection).getByRole("radio", { name: "Agree" }));
    expect(events().filter(e => e.type === "objection_vote").map(e => e.payload.vote)).toEqual(["agree"]);
    // Rows don't share a group: claim 1's answer is still there.
    expect((within(claim).getByRole("radio", { name: "Disagree" }) as HTMLInputElement).checked).toBe(true);
  }, 30000);
});

describe("post-report form sliders", () => {
  it("every slider has an accessible name (its question)", async () => {
    await openPanel();
    for (const name of [/how confident are you that this idea is novel/, /I trust this report's assessment/, /useful for judging/, /see what to verify next/, /took effort/])
      expect(screen.getByRole("slider", { name })).toBeTruthy();
  }, 30000);
});

describe("'Do you agree?' has a Not sure option", () => {
  it("every row offers Agree · Disagree · Not sure; Not sure is selectable, changeable and logged as not_sure", async () => {
    const { events } = await openPanel();
    const rows = [...document.querySelectorAll("fieldset")].filter(f => /^(Claim|Objection) \d+ /.test(f.querySelector("legend")?.textContent ?? ""));
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) expect(within(row as HTMLElement).getAllByRole("radio").map(r => r.closest("label")!.textContent!.trim())).toEqual(["Agree", "Disagree", "Not sure"]);

    const claim = rows.find(r => r.querySelector("legend")!.textContent!.startsWith("Claim 1 "))! as HTMLElement;
    fireEvent.click(within(claim).getByRole("radio", { name: "Not sure" }));
    expect((within(claim).getByRole("radio", { name: "Not sure" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(claim).getByRole("radio", { name: "Agree" }));
    expect((within(claim).getByRole("radio", { name: "Not sure" }) as HTMLInputElement).checked).toBe(false);
    const objection = rows.find(r => r.querySelector("legend")!.textContent!.startsWith("Objection 1 "))! as HTMLElement;
    fireEvent.click(within(objection).getByRole("radio", { name: "Not sure" }));

    expect(events().filter(e => e.type === "claim_vote").map(e => e.payload.vote)).toEqual(["not_sure", "agree"]);
    expect(events().filter(e => e.type === "objection_vote").map(e => e.payload.vote)).toEqual(["not_sure"]);
    expect(events().filter(e => e.type === "control_pressed" && /^study_(claim|objection)_/.test(String(e.payload.control))).map(e => e.payload.control))
      .toEqual(["study_claim_not_sure", "study_claim_agree", "study_objection_not_sure"]);
  }, 30000);
});

describe("claim and objection labels", () => {
  it("use the same text style as the panel's other question labels", async () => {
    await openPanel();
    const style = (el: Element) => [...el.classList].filter(c => /^(text-|font-)/.test(c)).sort().join(" ");
    const question = style(screen.getByText("I trust this report's assessment of the idea"));
    expect(question).not.toBe("");
    const legends = [...document.querySelectorAll("legend")].filter(l => /^(Claim|Objection) \d+ /.test(l.textContent ?? ""));
    expect(legends.length).toBeGreaterThan(1);
    for (const l of legends) expect(style(l)).toBe(question);
  }, 30000);
});

describe("claim and objection labels keep their status or severity readable", () => {
  it("put it before the (truncatable) quote, so phones don't cut it off", async () => {
    await openPanel();
    const legends = [...document.querySelectorAll("legend")].map(l => l.textContent ?? "").filter(t => /^(Claim|Objection) \d+ /.test(t));
    for (const t of legends) expect(t).toMatch(/^(Claim \d+ \((confirmed|contradicted|disputed|unverified)\)|Objection \d+ \((low|medium|high)\)) — "/);
  }, 30000);
});
