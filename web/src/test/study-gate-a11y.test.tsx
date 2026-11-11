// Study registration is usable with a screen reader: the code field has a label, every choice says
// whether it is selected (aria-pressed), and each idea button names its idea.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { go, loadApp } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); });

it("participant code, role and idea are labelled and announce their selected state", async () => {
  await loadApp({ hash: "#/study" });
  go("/study");
  fireEvent.click(await screen.findByRole("button", { name: "I have a participant code" }));
  expect(screen.getByLabelText("Participant code")).toBeTruthy();
  const student = screen.getByRole("button", { name: "student" });
  expect(student.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(student);
  expect(student.getAttribute("aria-pressed")).toBe("true");
  const ideaB = screen.getByRole("button", { name: /^Idea B: Student skill-swap marketplace$/ });
  expect(ideaB.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(ideaB);
  expect(ideaB.getAttribute("aria-pressed")).toBe("true");
}, 20000);
