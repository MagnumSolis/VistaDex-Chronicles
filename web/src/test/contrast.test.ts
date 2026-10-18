// WCAG AA contrast for every text/background token pair used in the UI.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8"); // tests run from web/
const token = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
};

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// [foreground, background, minimum ratio] — 4.5 for body text, 3 for large text / UI parts.
const PAIRS: [string, string, number][] = [
  ["foreground", "background", 4.5], ["foreground", "card", 4.5],
  ["muted-foreground", "background", 4.5], ["muted-foreground", "card", 4.5], ["muted-foreground", "muted", 4.5],
  ["primary", "card", 4.5], ["primary", "background", 4.5], ["primary-foreground", "primary", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["st-confirmed", "st-confirmed-bg", 4.5], ["st-confirmed", "card", 4.5],
  ["st-contradicted", "st-contradicted-bg", 4.5], ["st-contradicted", "card", 4.5],
  ["st-disputed", "st-disputed-bg", 4.5], ["st-disputed", "card", 4.5],
  ["st-unverified", "st-unverified-bg", 4.5], ["st-unverified", "card", 4.5],
  ["sev-high", "card", 4.5], ["sev-medium", "card", 4.5], ["sev-low", "card", 4.5], ["sev-medium", "background", 4.5],
  ["ring", "background", 3], ["border-strong", "card", 1.5],
];

describe("WCAG AA contrast of design tokens", () => {
  for (const [fg, bg, min] of PAIRS) {
    it(`${fg} on ${bg} ≥ ${min}:1`, () => {
      expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
    });
  }
});
