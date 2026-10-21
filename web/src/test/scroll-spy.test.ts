// The report jump nav marks the section whose top has reached the sticky offset (the same offset the
// jump scrolls to), so a jumped-to section is the active one.
import { describe, expect, it } from "vitest";
import { pickActive } from "@/components/report/ReportSection";

const at = (...tops: number[]) => (["summary", "profile", "claims", "graveyard"] as const).map((id, i) => ({ id, top: tops[i] }));

describe("report scroll-spy", () => {
  it("a section that landed exactly on the offset is active, not the one above it", () => {
    // After a jump to Leads to check: Claims ends just above the offset (its top is far above).
    expect(pickActive(at(-3000, -1800, -900, 96), 96)).toBe("graveyard");
  });
  it("sub-pixel landings still count", () => {
    expect(pickActive(at(-3000, -1800, -900, 96.6), 96)).toBe("graveyard");
  });
  it("a section still below the offset is not active yet", () => {
    expect(pickActive(at(-3000, -1800, 40, 300), 96)).toBe("claims");
  });
  it("at the top of the page the first section is active", () => {
    expect(pickActive(at(320, 1400, 2600, 3800), 96)).toBe("summary");
  });
});
