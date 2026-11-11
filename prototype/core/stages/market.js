// ── market.js — Market size (TAM) from figures quoted on fetched pages ──
// The figure must come from a source, never from the founder's own text. Two kinds of figure count:
//   (1) a quote supporting a CONFIRMED market-size claim (the claim already has ≥ 2 independent sources);
//   (2) a dedicated market-size search: the model may only report a figure a page states, with the sentence
//       that contains it; code keeps it only if that sentence is verbatim on the page and holds the money
//       amount, and code (not the model) assigns the URL.
// One figure per independent site. With figures from ≥ 2 independent sites the TAM is their median, cited
// to the figure closest to it, and it counts in the score; with one site it is shown as a single source and
// does not count. SAM and SOM need the founder's own assumptions, so they are never produced.
import { registrableDomain, MIN_INDEPENDENT } from "../evidence.js";
import { isVerbatim, moneyAmounts, norm } from "../quotes.js";
import { parseWrapped, NoProviderAvailable } from "../providers/llm.js";
import { PAGE_CHARS, gatherEvidence } from "./classify.js";

export const MARKET_SOURCES = 6;
const MIN_MARKET_USD = 1e6; // smaller amounts are prices, revenues or rounds, not a market

const PROMPT = `You read numbered web pages for an idea-screening tool. List the market-size figures that a page
STATES for the market the idea below sells into (total market value or revenue, in money). Use only what the
pages say: no outside knowledge, no estimates of your own. For each figure give the source number, the figure
exactly as written on the page, the market it measures in the page's words, the year it refers to if the page
gives one, and the exact sentence from the page that contains the figure.
Return a JSON object: {"figures": [{"source": 1, "figure": "$4.2 billion", "market": "...", "year": 2024, "quote": "..."}]}.
List at most 8. Never return a bare array. If no page states a market size, return {"figures": []}.`;

/** "$4.2B", "$850M", "$1.3T": a short, rounded form of a USD amount. */
export function formatUsd(usd) {
  const [d, u] = usd >= 1e12 ? [1e12, "T"] : usd >= 1e9 ? [1e9, "B"] : usd >= 1e6 ? [1e6, "M"] : [1e3, "K"];
  const v = usd / d;
  return `$${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}${u}`;
}

export function marketQueries(ideaText, input) {
  const field = (input?.industries || []).join(" ");
  const what = [input?.title, field].filter(Boolean).join(" ").trim() || ideaText.slice(0, 120);
  return [`${what} market size`.slice(0, 200)];
}

// Figures from quotes that support confirmed market-size claims.
function claimFigures(claims) {
  const out = [];
  for (const c of claims || []) {
    if (c.type !== "market_size" || c.status !== "confirmed") continue;
    for (const e of c.evidence || []) {
      if (e.stance !== "supports") continue;
      for (const m of moneyAmounts(e.quote)) {
        if (m.usd >= MIN_MARKET_USD) out.push({ value: m.text, value_usd: m.usd, market: c.claim.slice(0, 140), year: null, url: e.url, quote: e.quote, from: "claim" });
      }
    }
  }
  return out;
}

// The model's figures → those whose sentence is verbatim on the cited page and holds the amount.
export function keepFigures(raw, pages) {
  const out = [];
  for (const f of Array.isArray(raw) ? raw : []) {
    const page = pages[Number(f?.source) - 1];
    const quote = String(f?.quote ?? "").trim();
    if (!page || !isVerbatim(page.text, quote)) continue;
    const amounts = moneyAmounts(quote).filter(m => m.usd >= MIN_MARKET_USD);
    const said = norm(String(f?.figure ?? ""));
    const m = amounts.find(a => said && (norm(a.text).includes(said) || said.includes(norm(a.text)))) || (amounts.length === 1 ? amounts[0] : null);
    if (!m) continue;
    const year = Number(f?.year);
    out.push({ value: m.text, value_usd: m.usd, market: String(f?.market ?? "").slice(0, 160), year: year >= 1990 && year <= 2100 ? year : null, url: page.url, quote: quote.slice(0, 400), from: "search" });
  }
  return out;
}

// One figure per independent site (the first kept), then the TAM.
export function marketFromFigures(figures, search) {
  const byDomain = new Map();
  for (const f of figures) {
    const d = registrableDomain(f.url);
    if (d && !byDomain.has(d)) byDomain.set(d, { ...f, domain: d });
  }
  const list = [...byDomain.values()].sort((a, b) => a.value_usd - b.value_usd);
  if (!list.length) return search ? { figures: [], search } : null;
  const n = list.length;
  const corroborated = n >= MIN_INDEPENDENT;
  const mid = n % 2 ? list[(n - 1) / 2].value_usd : (list[n / 2 - 1].value_usd + list[n / 2].value_usd) / 2;
  const near = list.reduce((a, b) => (Math.abs(Math.log(b.value_usd / mid)) < Math.abs(Math.log(a.value_usd / mid)) ? b : a));
  const usd = corroborated ? mid : list[0].value_usd;
  const scope = corroborated
    ? `Median of ${n} market-size figures from ${n} independent sources (${formatUsd(list[0].value_usd)} to ${formatUsd(list[n - 1].value_usd)}). Each source measures the market its own way; read them before you rely on the number.`
    : `Quoted by one source only (${near.domain}). A second independent source is needed before it counts in the VistaDex Score.`;
  return {
    tam: { value: formatUsd(usd), value_usd: Math.round(usd), scope, citation: { name: near.domain, url: near.url }, quote: near.quote, corroborated, independent_sources: n },
    figures: list.map(f => ({ value: f.value, value_usd: f.value_usd, market: f.market, year: f.year, citation: { name: f.domain, url: f.url }, quote: f.quote })),
    ...(search ? { search } : {}),
  };
}

/** Kept for callers that only have claims (the confirmed-claim figures, no search). */
export function tamFromEvidence(claims, trace) {
  const m = marketFromFigures(claimFigures(claims), null);
  trace?.log("market", { tam_usd: m?.tam?.value_usd ?? null, source: m?.tam?.citation?.url ?? null, figures: m?.figures?.length ?? 0 });
  return m;
}

// The full market stage: confirmed-claim figures plus a dedicated search when one can run.
export async function searchMarket({ ideaText, input, claims }, { llm, retrieval, trace }) {
  const figures = claimFigures(claims);
  if (retrieval.name === "mock" || !llm.available("classify")) {
    trace.log("market", { router: "claims only", reason: retrieval.name === "mock" ? "no retrieval" : "no reader", figures: figures.length });
    return marketFromFigures(figures, null);
  }
  const queries = marketQueries(ideaText, input);
  const pages = [];
  for (const [i, q] of queries.entries()) pages.push(...await gatherEvidence({ claim: q }, `market-${i}`, { retrieval, trace }));
  const read = pages.slice(0, MARKET_SOURCES);
  const search = { queries, sources_checked: read.length };
  if (read.length) {
    const messages = [
      { role: "system", content: PROMPT },
      { role: "user", content: `Idea: ${ideaText.slice(0, 800)}\n\n${read.map((p, k) => `[${k + 1}] ${p.url}\n${p.title || ""}\n${p.text.slice(0, PAGE_CHARS)}`).join("\n\n")}` },
    ];
    try {
      const raw = await completeWrapped(llm, messages, "figures");
      if (raw) figures.push(...keepFigures(raw, read));
      else trace.log("market", { router: "llm", error: "malformed output" });
    } catch (err) {
      if (!(err instanceof NoProviderAvailable)) throw err;
      trace.log("market", { router: "skipped", reason: "reader unavailable" });
    }
  }
  const market = marketFromFigures(figures, search);
  trace.log("market", { router: "llm", sources: read.length, figures: market?.figures?.length ?? 0, tam_usd: market?.tam?.value_usd ?? null, corroborated: market?.tam?.corroborated ?? false });
  return market;
}

// One retry when the reply is not the expected JSON object (a model sometimes answers in another shape).
// A reply cut off by the length limit keeps its complete entries (every entry is still checked against its
// page by the caller, so nothing unverified gets through).
export const LIST_MAX_TOKENS = 3000;
export async function completeWrapped(llm, messages, key) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { content } = await llm.complete("classify", { json: true, maxTokens: LIST_MAX_TOKENS, messages: attempt ? [...messages, { role: "user", content: `Reply with the JSON object {"${key}": [...]} only.` }] : messages });
    const raw = parseWrapped(content, key) ?? salvageList(content, key);
    if (raw) return raw;
  }
  return null;
}

// {"key": [{...}, {...}, {...cut off  →  the complete objects before the cut, or null.
export function salvageList(content, key) {
  const s = String(content ?? "");
  const start = s.indexOf("[", s.indexOf(`"${key}"`));
  if (s.indexOf(`"${key}"`) < 0 || start < 0) return null;
  for (let end = s.lastIndexOf("}"); end > start; end = s.lastIndexOf("}", end - 1)) {
    try {
      const arr = JSON.parse(s.slice(start, end + 1) + "]");
      if (Array.isArray(arr) && arr.length) return arr;
    } catch { /* try the previous closing brace */ }
  }
  return null;
}
