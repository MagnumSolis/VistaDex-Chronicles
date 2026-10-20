// ── competitors.js — Existing products named on fetched pages ──
// A dedicated search on the idea's title + pitch runs for EVERY idea; the pages fetched for novelty
// claims are read too. The model may only name a product that a page names, with a quote; code keeps
// it only if the quote is verbatim on that page AND the name appears inside the quote, and code (not
// the model) assigns the URL. Returns null when no search could run (no retrieval or no reader), so
// "nothing found" is never reported when nothing was looked at.

import { parseWrapped, NoProviderAvailable } from "../providers/llm.js";
import { isVerbatim, namedIn } from "../quotes.js";
import { PAGE_CHARS, gatherEvidence } from "./classify.js";

export const COMPETITOR_SOURCES = 6;
export const MAX_COMPETITORS = 8;

const PROMPT = `You read numbered web pages for an idea-screening tool. List products or companies that a page
NAMES as already offering something similar to the idea below. Use only what the pages say: no outside
knowledge, no guesses. For each one give the source number, the name exactly as written on the page,
one short sentence on why it is similar, and the exact sentence from the page that contains the name.
Return a JSON object: {"competitors": [{"source": 1, "name": "...", "why_similar": "...", "quote": "..."}]}. Never return a bare array.`;

export function competitorQueries(ideaText, input) {
  const head = [input?.title, input?.pitch].filter(Boolean).join(" — ") || ideaText.slice(0, 160);
  return [head.slice(0, 200)];
}

export async function findCompetitors({ ideaText, input, novelPages = [] }, { llm, retrieval, trace }) {
  if (retrieval.name === "mock" || !llm.available("classify")) {
    trace.log("competitors", { router: "skipped", reason: retrieval.name === "mock" ? "no retrieval" : "no reader" });
    return null;
  }
  const queries = competitorQueries(ideaText, input);
  const searched = [];
  for (const [i, q] of queries.entries()) {
    searched.push(...await gatherEvidence({ claim: q }, `competitors-${i}`, { retrieval, trace }));
  }
  const byUrl = new Map();
  for (const p of [...searched.slice(0, COMPETITOR_SOURCES), ...novelPages]) if (p?.url && p.text && !byUrl.has(p.url)) byUrl.set(p.url, p);
  const pages = [...byUrl.values()];
  const search = { queries, sources_checked: pages.length };
  if (!pages.length) { trace.log("competitors", { router: "searched", sources: 0 }); return { list: [], search }; }

  let raw;
  try {
    const { content } = await llm.complete("classify", {
      json: true,
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: `Idea: ${ideaText.slice(0, 1200)}\n\n${pages.map((p, k) => `[${k + 1}] ${p.url}\n${p.title || ""}\n${p.text.slice(0, PAGE_CHARS)}`).join("\n\n")}` },
      ],
    });
    raw = parseWrapped(content, "competitors");
  } catch (err) {
    if (!(err instanceof NoProviderAvailable)) throw err;
    trace.log("competitors", { router: "skipped", reason: "reader unavailable" });
    return null;
  }
  if (!raw) { trace.log("competitors", { router: "llm", error: "malformed output" }); return null; }

  const own = String(input?.title ?? "").trim().toLowerCase();
  const seen = new Set();
  const list = [];
  for (const c of raw) {
    const page = pages[Number(c?.source) - 1];
    const name = String(c?.name ?? "").trim();
    const quote = String(c?.quote ?? "").trim();
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const ok = page && name.length >= 2 && name.length <= 60 && isVerbatim(page.text, quote) && namedIn(quote, name) && key && key !== own.replace(/[^a-z0-9]+/g, "");
    trace.log("competitor_judgment", { source: page?.url ?? null, name: name.slice(0, 60), kept: Boolean(ok) && !seen.has(key) });
    if (!ok || seen.has(key)) continue;
    seen.add(key);
    list.push({ name, url: page.url, why_similar: String(c?.why_similar ?? "").trim().slice(0, 240), quote: quote.slice(0, 400) });
    if (list.length >= MAX_COMPETITORS) break;
  }
  trace.log("competitors", { router: "llm", sources: pages.length, found: list.length });
  return { list, search };
}
