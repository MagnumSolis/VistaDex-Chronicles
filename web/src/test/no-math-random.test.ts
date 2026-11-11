// AGENTS.md: no Math.random in production code paths (ids and shuffles use crypto.getRandomValues), and the
// quiz states no graveyard size (the number changes with every sync).
import { describe, expect, it } from "vitest";

const sources = import.meta.glob(["../**/*.{ts,tsx}", "!../retired/**", "!../test/**"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("production code", () => {
  it("does not use Math.random", () => {
    expect(Object.entries(sources).filter(([, s]) => /Math\.random\s*\(/.test(s)).map(([f]) => f)).toEqual([]);
  });
  it("the quiz does not claim a graveyard size", () => {
    const quiz = Object.entries(sources).find(([f]) => f.endsWith("GraveyardQuiz.tsx"))![1];
    expect(quiz).not.toMatch(/\d{3,}\+?\s*documented|`\d+\+`/);
  });
});
