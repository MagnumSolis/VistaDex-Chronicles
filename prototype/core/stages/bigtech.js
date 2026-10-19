// ── bigtech.js — Big Tech risk: is a big platform company already doing this? ──
// Same evidence rule as claims: the model labels each fetched page (company, direct/adjacent, quote);
// code keeps a label only if the quote is verbatim on the page and names the company, then counts
// independent domains per company. A company counts with ≥ 2 independent domains.
//   high       — a counted company offers a directly competing product
//   medium     — a counted company has an adjacent product or announcement
//   unverified — companies were mentioned, but none by 2 independent sources
//   none_found — pages were read and no company was mentioned (not proof of safety)
//   low        — never output: TODO(team) define what evidence a low risk needs
// Returns null when no search could run (no retrieval or no reader).

import { registrableDomain } from "../evidence.js";
import { parseWrapped, NoProviderAvailable } from "../providers/llm.js";
import { isVerbatim, namedIn } from "../quotes.js";
import { BIG_TECH_COMPANIES } from "../scoring-config.js";
import { PAGE_CHARS, gatherEvidence } from "./classify.js";

export const MIN_INDEPENDENT = 2;
// Names a page may use for each listed company.
const ALIASES = { "Alphabet/Google": ["Google", "Alphabet", "DeepMind", "YouTube"], Meta: ["Meta", "Facebook", "Instagram", "WhatsApp"], Amazon: ["Amazon", "AWS"] };
const aliasesOf = c => ALIASES[c] ?? [c];

const PROMPT = `You read numbered web pages for an idea-screening tool. For each page, say whether it shows one of
these companies offering or announcing something similar to the idea: ${BIG_TECH_COMPANIES.join(", ")}.
relation: "direct" = the company offers a product that does what the idea does; "adjacent" = a related product,
feature or announcement; "none" = anything else or unsure. Use only what the page says.
Quote the exact sentence from the page that names the company.
Return a JSON object: {"labels": [{"source": 1, "company": "<one name from the list>", "relation": "direct|adjacent|none", "reason": "...", "quote": "..."}]}. Never return a bare array.`;

export function bigTechQueries(ideaText, input) {
  const head = (input?.pitch || input?.title || ideaText.slice(0, 120)).slice(0, 140);
  const half = Math.ceil(BIG_TECH_COMPANIES.length / 2);
  const names = list => list.map(c => aliasesOf(c)[0]).join(" OR ");
  return [`${head} ${names(BIG_TECH_COMPANIES.slice(0, half))}`, `${head} ${names(BIG_TECH_COMPANIES.slice(half))}`];
}

export async function assessBigTech({ ideaText, input }, { llm, retrieval, trace }) {
  if (retrieval.name === "mock" || !llm.available("classify")) {
    trace.log("big_tech", { router: "skipped", reason: retrieval.name === "mock" ? "no retrieval" : "no reader" });
    return null;
  }
  const queries = bigTechQueries(ideaText, input);
  const byUrl = new Map();
  for (const [i, q] of queries.entries()) {
    for (const p of await gatherEvidence({ claim: q }, `big-tech-${i}`, { retrieval, trace })) if (p.text && !byUrl.has(p.url)) byUrl.set(p.url, p);
  }
  const pages = [...byUrl.values()];
  const base = { companies_checked: [...BIG_TECH_COMPANIES], queries, sources_checked: pages.length };
  if (!pages.length) { trace.log("big_tech", { router: "searched", sources: 0 }); return null; }

  let labels;
  try {
    const { content } = await llm.complete("classify", {
      json: true,
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: `Idea: ${ideaText.slice(0, 1200)}\n\n${pages.map((p, k) => `[${k + 1}] ${p.url}\n${p.title || ""}\n${p.text.slice(0, PAGE_CHARS)}`).join("\n\n")}` },
      ],
    });
    labels = parseWrapped(content, "labels");
  } catch (err) {
    if (!(err instanceof NoProviderAvailable)) throw err;
    trace.log("big_tech", { router: "skipped", reason: "reader unavailable" });
    return null;
  }
  if (!labels) { trace.log("big_tech", { router: "llm", error: "malformed output" }); return null; }

  // company → domain → { relation, url, quote, reason }
  const found = new Map();
  for (const l of labels) {
    const page = pages[Number(l?.source) - 1];
    const company = BIG_TECH_COMPANIES.find(c => c === l?.company || aliasesOf(c).includes(l?.company));
    const relation = l?.relation === "direct" || l?.relation === "adjacent" ? l.relation : null;
    const quote = String(l?.quote ?? "").trim();
    const ok = page && company && relation && isVerbatim(page.text, quote) && aliasesOf(company).some(a => namedIn(quote, a));
    trace.log("big_tech_label", { source: page?.url ?? null, company: company ?? null, relation, kept: Boolean(ok) });
    if (!ok) continue;
    const domain = registrableDomain(page.url);
    if (!domain) continue;
    if (!found.has(company)) found.set(company, new Map());
    const byDomain = found.get(company);
    if (!byDomain.has(domain) || relation === "direct") byDomain.set(domain, { relation, url: page.url, quote: quote.slice(0, 400), reason: String(l?.reason ?? "").trim().slice(0, 240) });
  }

  const companies = [], unconfirmed = [];
  for (const [name, byDomain] of found) {
    const items = [...byDomain.values()];
    if (byDomain.size >= MIN_INDEPENDENT) {
      const direct = items.filter(x => x.relation === "direct").length >= MIN_INDEPENDENT;
      companies.push({ name, relation: direct ? "direct" : "adjacent", reason: items[0].reason, source_urls: items.map(x => x.url), quote: items[0].quote });
    } else unconfirmed.push({ name, source_urls: items.map(x => x.url) });
  }
  const level = companies.some(c => c.relation === "direct") ? "high" : companies.length ? "medium" : unconfirmed.length ? "unverified" : "none_found";
  const summary = {
    high: `${companies.filter(c => c.relation === "direct").map(c => c.name).join(", ")} ${companies.filter(c => c.relation === "direct").length === 1 ? "offers" : "offer"} a directly competing product, according to at least ${MIN_INDEPENDENT} independent sources.`,
    medium: `${companies.map(c => c.name).join(", ")} ${companies.length === 1 ? "has" : "have"} related products or announcements, according to at least ${MIN_INDEPENDENT} independent sources.`,
    unverified: `${unconfirmed.map(c => c.name).join(", ")} ${unconfirmed.length === 1 ? "is" : "are"} mentioned, but by fewer than ${MIN_INDEPENDENT} independent sources, so the risk is unverified.`,
    none_found: `None of the ${BIG_TECH_COMPANIES.length} companies was mentioned on the ${pages.length} pages read. That is not proof they are not working on it.`,
  }[level];
  trace.log("big_tech", { router: "llm", sources: pages.length, level, counted: companies.map(c => c.name), unconfirmed: unconfirmed.map(c => c.name) });
  return { level, companies, unconfirmed, summary, ...base };
}
