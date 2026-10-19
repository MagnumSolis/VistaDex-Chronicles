import { describe, expect, it } from "vitest";
import { isPanelViewed } from "./viewRule";

describe("panel viewed rule (pilot-2)", () => {
  it("counts a short panel once half of it is visible", () => {
    expect(isPanelViewed({ visibleHeight: 150, panelHeight: 300, viewportHeight: 800 })).toBe(true);
    expect(isPanelViewed({ visibleHeight: 149, panelHeight: 300, viewportHeight: 800 })).toBe(false);
  });
  it("counts a tall panel once it covers half the viewport (pilot-1 never fired here)", () => {
    // 2000px panel in a 640px phone viewport: 50 % of itself (1000px) can never be on screen.
    expect(isPanelViewed({ visibleHeight: 320, panelHeight: 2000, viewportHeight: 640 })).toBe(true);
    expect(isPanelViewed({ visibleHeight: 319, panelHeight: 2000, viewportHeight: 640 })).toBe(false);
  });
  it("never counts an off-screen panel", () => {
    expect(isPanelViewed({ visibleHeight: 0, panelHeight: 100, viewportHeight: 800 })).toBe(false);
  });
});
