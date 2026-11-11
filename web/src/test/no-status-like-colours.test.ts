// CLAUDE.md colour rules: status hues only for statuses, no celebratory green, and problems are ink on
// paper. Tailwind's own green, emerald, red and rose palettes are never used outside the retired study UI.
import { describe, expect, it } from "vitest";

const sources = import.meta.glob(["../**/*.{ts,tsx}", "!../retired/**", "!../test/**"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("no Tailwind green or red", () => {
  it("no component uses green, emerald, red or rose colour classes", () => {
    const hits = Object.entries(sources).flatMap(([file, src]) =>
      [...src.matchAll(/\b(?:text|bg|border|ring|fill|stroke|outline|accent|decoration)-(?:green|emerald|red|rose)-\d{2,3}\b/g)].map(m => `${file}: ${m[0]}`));
    expect(hits).toEqual([]);
  });
});
