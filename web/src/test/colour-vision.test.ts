// The four status colours must stay distinguishable from each other under the common colour-vision
// deficiencies (protanopia, deuteranopia, tritanopia — Machado 2009, full severity), not only for
// typical vision. Every status also has a text label and an icon; this guards the colour channel.
import { describe, expect, it } from "vitest";
import { CVD, deltaE2000, lab, simulate, token } from "./colour";

const STATUSES = ["contradicted", "disputed", "confirmed", "unverified"] as const;
// CIEDE2000: ≥ 10 is an obvious difference; ≥ 5 is clearly visible side by side.
const MIN_STRONG = 10; // icon / tag-text colour
const MIN_TINT = 5;    // tag and count-tile backgrounds (always shown with the strong colour, label and icon)

const pairs = STATUSES.flatMap((a, i) => STATUSES.slice(i + 1).map(b => [a, b] as const));

describe("status colours are distinguishable under colour-vision deficiencies", () => {
  for (const [vision, matrix] of Object.entries(CVD)) {
    for (const [a, b] of pairs) {
      it(`${vision}: ${a} vs ${b}`, () => {
        const strong = deltaE2000(lab(simulate(token(`st-${a}`), matrix)), lab(simulate(token(`st-${b}`), matrix)));
        const tint = deltaE2000(lab(simulate(token(`st-${a}-bg`), matrix)), lab(simulate(token(`st-${b}-bg`), matrix)));
        expect(strong, "strong colour ΔE2000").toBeGreaterThanOrEqual(MIN_STRONG);
        expect(tint, "tint ΔE2000").toBeGreaterThanOrEqual(MIN_TINT);
      });
    }
  }
});

describe("status colours have equal visual weight and are never green", () => {
  const L = (name: string) => lab(simulate(token(name), CVD["typical vision"]))[0];
  const hue = (name: string) => {
    const [, a, b] = lab(simulate(token(name), CVD["typical vision"]));
    const h = (Math.atan2(b, a) * 180) / Math.PI;
    return h < 0 ? h + 360 : h;
  };
  it("tints sit in one narrow lightness band (no tile looks emptier or louder)", () => {
    const ls = STATUSES.map(s => L(`st-${s}-bg`));
    expect(Math.max(...ls) - Math.min(...ls)).toBeLessThanOrEqual(10);
  });
  it("no status hue is green (the brand colour must never read as 'confirmed')", () => {
    for (const s of STATUSES) {
      for (const n of [`st-${s}`, `st-${s}-bg`]) {
        const h = hue(n);
        expect(h > 100 && h < 170, `${n} hue ${h.toFixed(0)}°`).toBe(false);
      }
    }
  });
});
