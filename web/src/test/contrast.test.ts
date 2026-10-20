// WCAG AA contrast for every text/background token pair used in the UI.
import { describe, expect, it } from "vitest";
import { contrast, token } from "./colour";

// [foreground, background, minimum ratio] — 4.5 for body text, 3 for large text / UI parts.
const PAIRS: [string, string, number][] = [
  // reading surfaces
  ["foreground", "background", 4.5], ["foreground", "card", 4.5], ["foreground", "muted", 4.5],
  ["muted-foreground", "background", 4.5], ["muted-foreground", "card", 4.5], ["muted-foreground", "muted", 4.5],
  ["link", "background", 4.5], ["link", "card", 4.5], ["link", "muted", 4.5],
  ["accent-foreground", "accent", 4.5], ["foreground", "accent", 4.5],
  // the page frame
  ["on-page", "page", 4.5], ["on-page-muted", "page", 4.5], ["on-page", "page-raised", 4.5], ["on-page-muted", "page-raised", 4.5],
  ["lime", "page", 4.5], ["lime", "page-raised", 4.5],
  // brand blocks
  ["on-lime", "lime", 4.5], ["foreground", "lime", 4.5],
  ["on-charcoal", "charcoal", 4.5], ["on-charcoal-muted", "charcoal", 4.5], ["lime", "charcoal", 4.5],
  ["on-charcoal", "charcoal-raised", 4.5], ["on-charcoal-muted", "charcoal-raised", 4.5], ["lime", "charcoal-raised", 4.5], ["on-charcoal-muted", "charcoal", 3],
  // primary action (lime label on deep green) and its inverse on the page
  ["primary-foreground", "primary", 4.5], ["page", "on-page", 4.5],
  // status colour on its own tint and on paper (tags, count tiles, icons)
  ["st-contradicted", "st-contradicted-bg", 4.5], ["st-contradicted", "card", 4.5],
  ["st-disputed", "st-disputed-bg", 4.5], ["st-disputed", "card", 4.5],
  ["st-confirmed", "st-confirmed-bg", 4.5], ["st-confirmed", "card", 4.5],
  ["st-unverified", "st-unverified-bg", 4.5], ["st-unverified", "card", 4.5],
  // ink labels and numbers inside status count tiles
  ["foreground", "st-contradicted-bg", 4.5], ["foreground", "st-disputed-bg", 4.5],
  ["foreground", "st-confirmed-bg", 4.5], ["foreground", "st-unverified-bg", 4.5],
  // non-text: focus rings and field outlines (WCAG 1.4.11, 3:1)
  ["ring", "card", 3], ["ring", "background", 3], ["lime", "page", 3], ["input", "card", 3], ["input", "background", 3],
  ["on-page-muted", "page-raised", 3],
];

describe("WCAG AA contrast of design tokens", () => {
  for (const [fg, bg, min] of PAIRS) {
    it(`${fg} on ${bg} ≥ ${min}:1`, () => {
      expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
    });
  }
});
