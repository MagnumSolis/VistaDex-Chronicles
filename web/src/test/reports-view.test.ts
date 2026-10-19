import { describe, expect, it } from "vitest";
import { contradictedReading, filterEntries, NO_FILTERS, sortEntries, summarize, topSlices } from "@/lib/reportsView";
import type { ReportEntry } from "@/lib/reports";
import type { ClaimStatus, ClaimType, Report } from "@/types";

let n = 0;
function entry({ title, score = null, novelty = null, band, bigTech, contradicted = 0, date = null, industries = [], role = null, claims = [] }: {
  title: string; score?: number | null; novelty?: number | null; band?: Report["overlap_band"]; bigTech?: "low" | "medium" | "high" | "none_found" | "unverified";
  contradicted?: number; date?: string | null; industries?: string[]; role?: "founder" | "investor" | "accelerator" | null; claims?: [ClaimType, ClaimStatus][];
}): ReportEntry {
  const allClaims = [...claims, ...Array.from({ length: contradicted }, () => ["other", "contradicted"] as [ClaimType, ClaimStatus])];
  const axis = (value: number | null) => ({ value, inputs: {}, boundary: "", sample: false });
  return {
    id: `e${n++}`, runId: null, title, kind: "session", createdAt: date ? new Date(date) : null, mode: "mock", markets: [], category: null, traceId: null,
    report: {
      idea_text: title, claims: allClaims.map(([type, status]) => ({ claim: "c", type, status, reasoning: "", source_urls: [] })), graveyard_matches: [], objections: [],
      overlap_band: band, ...(bigTech ? { big_tech_risk: { level: bigTech, companies: [], unconfirmed: [], summary: "", companies_checked: [], queries: [], sources_checked: 0 } } : {}),
      input: { title, pitch: "", problem: "", solution: "", moat: "", industries, role, markets: [] },
      scores: { vistadex: { value: score, sample: false, used: [], excluded: [] }, axes: { novelty: axis(novelty), market: axis(null), defensibility: axis(null), graveyard: axis(null), evidence: axis(null), big_tech: axis(null) } },
    },
  };
}
const titles = (l: ReportEntry[]) => l.map(e => e.title);

describe("sorting", () => {
  const list = [entry({ title: "A", score: 40, novelty: null }), entry({ title: "B", score: null, novelty: 90 }), entry({ title: "C", score: 70, novelty: 10 })];
  it("by score and by novelty, highest first, 'Not enough data' last", () => {
    expect(titles(sortEntries(list, "score"))).toEqual(["C", "A", "B"]);
    expect(titles(sortEntries(list, "novelty"))).toEqual(["B", "C", "A"]);
  });
  it("newest first; undated (demo) last", () => {
    const l = [entry({ title: "old", date: "2026-10-01" }), entry({ title: "demo" }), entry({ title: "new", date: "2026-10-19" })];
    expect(titles(sortEntries(l, "newest"))).toEqual(["new", "old", "demo"]);
  });
  it("least risky: overlap band, then Big Tech risk, then fewest contradicted claims", () => {
    const l = [
      entry({ title: "high band", band: "high", bigTech: "none_found" }),
      entry({ title: "clear + medium", band: "clear", bigTech: "medium" }),
      entry({ title: "clear + none, 2 contradicted", band: "clear", bigTech: "none_found", contradicted: 2 }),
      entry({ title: "clear + none, 0 contradicted", band: "clear", bigTech: "none_found" }),
      entry({ title: "no band", bigTech: "low" }),
    ];
    expect(titles(sortEntries(l, "least_risky"))).toEqual(["clear + none, 0 contradicted", "clear + none, 2 contradicted", "clear + medium", "high band", "no band"]);
  });
});

describe("filtering", () => {
  const l = [
    entry({ title: "fin founder", industries: ["Fintech"], role: "founder", band: "clear", claims: [["novelty", "disputed"]] }),
    entry({ title: "health investor", industries: ["Healthtech", "AI/ML"], role: "investor", band: "high" }),
    entry({ title: "unspecified", band: "caution" }),
  ];
  it("by claim status, band, industry and role", () => {
    expect(titles(filterEntries(l, { ...NO_FILTERS, status: "disputed" }))).toEqual(["fin founder"]);
    expect(titles(filterEntries(l, { ...NO_FILTERS, band: "high" }))).toEqual(["health investor"]);
    expect(titles(filterEntries(l, { ...NO_FILTERS, industry: "AI/ML" }))).toEqual(["health investor"]);
    expect(titles(filterEntries(l, { ...NO_FILTERS, industry: "Not specified" }))).toEqual(["unspecified"]);
    expect(titles(filterEntries(l, { ...NO_FILTERS, role: "founder" }))).toEqual(["fin founder"]);
  });
});

describe("summary", () => {
  it("counts bands, contradicted types and industries (once per industry selected)", () => {
    const s = summarize([
      entry({ title: "a", band: "clear", industries: ["Fintech", "AI/ML"], claims: [["market_size", "contradicted"], ["novelty", "contradicted"]] }),
      entry({ title: "b", band: "high", industries: ["AI/ML"], claims: [["market_size", "contradicted"]] }),
    ]);
    expect(s.count).toBe(2);
    expect(s.bands).toEqual({ clear: 1, caution: 0, high: 1 });
    expect(s.byType.market_size).toBe(2);
    expect(s.industries).toEqual([{ name: "AI/ML", count: 2 }, { name: "Fintech", count: 1 }]);
    expect(s.reading).toBeNull(); // fewer than 5 reports: counts only
  });
  it("the plain reading needs 5 reports and says ties as ties", () => {
    const by = (m: number, nv: number) => ({ market_size: m, novelty: nv, defensibility: 0, traction: 0, other: 0 });
    expect(contradictedReading(by(3, 1), 4)).toBeNull();
    expect(contradictedReading(by(3, 1), 5)).toBe("Market-size claims are contradicted most often.");
    expect(contradictedReading(by(2, 2), 5)).toBe("Market-size and novelty claims are contradicted equally often (2 each).");
    expect(contradictedReading(by(0, 0), 6)).toBe("No claims have been contradicted in these reports.");
  });
  it("the pie keeps the top 5 and groups the rest", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"].map((name, i) => ({ name, count: 10 - i }));
    expect(topSlices(items).map(s => s.name)).toEqual(["a", "b", "c", "d", "e", "Other industries"]);
    expect(topSlices(items).at(-1)!.count).toBe(5 + 4); // f + g
    expect(topSlices(items.slice(0, 6)).length).toBe(6);
  });
});
