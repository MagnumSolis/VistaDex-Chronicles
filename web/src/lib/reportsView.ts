// ── reportsView.ts — Sorting, filtering and summary figures for the Reports page (pure functions) ──
import type { BigTechLevel, ClaimStatus, ClaimType, OverlapBand, Role } from "@/types";
import type { ReportEntry } from "./reports";

export type SortKey = "score" | "novelty" | "newest" | "least_risky";
export const SORTS: { value: SortKey; label: string }[] = [
  { value: "score", label: "VistaDex Score" },
  { value: "novelty", label: "Novelty" },
  { value: "newest", label: "Newest" },
  { value: "least_risky", label: "Least risky" },
];

const score = (e: ReportEntry) => e.report.scores?.vistadex.value ?? null;
const novelty = (e: ReportEntry) => e.report.scores?.axes.novelty.value ?? null;
const BAND_RANK: Record<OverlapBand, number> = { clear: 0, caution: 1, high: 2 };
// none_found: searched and nothing matched; unverified: mentioned by fewer than 2 sources.
const BIG_TECH_RANK: Record<BigTechLevel, number> = { low: 0, none_found: 1, unverified: 2, medium: 3, high: 4 };
const contradicted = (e: ReportEntry) => e.report.claims.filter(c => c.status === "contradicted").length;

// Descending by a number; reports without the number ("Not enough data") always last.
const byNumberDesc = (get: (e: ReportEntry) => number | null) => (a: ReportEntry, b: ReportEntry) => {
  const x = get(a), y = get(b);
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return y - x;
};

export function sortEntries(entries: ReportEntry[], key: SortKey): ReportEntry[] {
  const list = [...entries];
  const title = (a: ReportEntry, b: ReportEntry) => a.title.localeCompare(b.title);
  if (key === "score") return list.sort((a, b) => byNumberDesc(score)(a, b) || title(a, b));
  if (key === "novelty") return list.sort((a, b) => byNumberDesc(novelty)(a, b) || title(a, b));
  if (key === "newest") return list.sort((a, b) => byNumberDesc(e => e.createdAt?.getTime() ?? null)(a, b) || title(a, b));
  // Least risky: lowest overlap band, then lowest Big Tech risk, then fewest contradicted claims; unknowns last.
  const rank = (e: ReportEntry) => [
    e.report.overlap_band ? BAND_RANK[e.report.overlap_band] : 9,
    e.report.big_tech_risk ? BIG_TECH_RANK[e.report.big_tech_risk.level] : 9,
    contradicted(e),
  ];
  return list.sort((a, b) => {
    const x = rank(a), y = rank(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return title(a, b);
  });
}

export interface Filters { status: "all" | ClaimStatus; band: "all" | OverlapBand; industry: string; role: "all" | Role }
export const NO_FILTERS: Filters = { status: "all", band: "all", industry: "all", role: "all" };
export const industriesOf = (e: ReportEntry) => e.report.input?.industries?.length ? e.report.input.industries : ["Not specified"];

export function filterEntries(entries: ReportEntry[], f: Filters): ReportEntry[] {
  return entries.filter(e =>
    (f.status === "all" || e.report.claims.some(c => c.status === f.status)) &&
    (f.band === "all" || e.report.overlap_band === f.band) &&
    (f.industry === "all" || industriesOf(e).includes(f.industry)) &&
    (f.role === "all" || e.report.input?.role === f.role));
}

export const TYPE_LABEL: Record<ClaimType, string> = { market_size: "Market-size", novelty: "Novelty", defensibility: "Defensibility", traction: "Traction", other: "Other" };
export const TYPE_ORDER: ClaimType[] = ["market_size", "novelty", "defensibility", "traction", "other"];
export const MIN_REPORTS_FOR_READING = 5;

export function summarize(entries: ReportEntry[]) {
  const bands = { clear: 0, caution: 0, high: 0 } as Record<OverlapBand, number>;
  let noBand = 0;
  for (const e of entries) e.report.overlap_band ? bands[e.report.overlap_band]++ : noBand++;
  const byType = Object.fromEntries(TYPE_ORDER.map(t => [t, 0])) as Record<ClaimType, number>;
  for (const e of entries) for (const c of e.report.claims) if (c.status === "contradicted") byType[c.type]++;
  const industries = new Map<string, number>();
  for (const e of entries) for (const i of industriesOf(e)) industries.set(i, (industries.get(i) ?? 0) + 1);
  return {
    count: entries.length, bands, noBand, byType,
    reading: contradictedReading(byType, entries.length),
    industries: [...industries].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

// One plain sentence, only once there are enough reports to call it a pattern; ties are said as ties.
export function contradictedReading(byType: Record<ClaimType, number>, reports: number): string | null {
  if (reports < MIN_REPORTS_FOR_READING) return null;
  const max = Math.max(...TYPE_ORDER.map(t => byType[t]));
  if (max === 0) return "No claims have been contradicted in these reports.";
  const top = TYPE_ORDER.filter(t => byType[t] === max).map(t => TYPE_LABEL[t].toLowerCase());
  const names = top.length === 1 ? top[0] : `${top.slice(0, -1).join(", ")} and ${top.at(-1)}`;
  const sentence = top.length === 1 ? `${names} claims are contradicted most often.` : `${names} claims are contradicted equally often (${max} each).`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// Top N slices + "Other" for the pie.
export function topSlices(items: { name: string; count: number }[], n = 5) {
  if (items.length <= n + 1) return items;
  const rest = items.slice(n).reduce((s, i) => s + i.count, 0);
  return [...items.slice(0, n), { name: "Other industries", count: rest }];
}
