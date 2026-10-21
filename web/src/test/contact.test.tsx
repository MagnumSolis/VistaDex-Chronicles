// Contact us shows no source-code item and no link to the GitHub repository, in either edition.
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadApp } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

describe("Contact us", () => {
  for (const edition of ["public", "pitch"] as const) {
    it(`${edition}: no source-code item, no github.com link`, async () => {
      await loadApp({ edition, hash: "#/contact" });
      expect(await screen.findByRole("heading", { name: "Talk to the team" })).toBeTruthy();
      expect(screen.queryByText("Source code")).toBeNull();
      expect([...document.querySelectorAll("a")].filter(a => /github\.com/i.test(a.href))).toEqual([]);
    });
  }
});
