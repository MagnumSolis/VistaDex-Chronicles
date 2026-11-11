// ── legal.js — Things to look up and rules that may apply, per target market ──
// Never a judgement of whether something is allowed. Two parts per market the founder picked:
//   (a) facts: official registries to search (trademarks, patents), fixed links, nothing claimed about them;
//   (b) requirements: laws, regulations or licences that fetched pages NAME as applying to this kind of
//       product in that market. The model may only report a rule a page names, with the sentence that names
//       it; code keeps it only if that sentence is verbatim on the page and contains the rule's name, and
//       code (not the model) assigns the URL. A rule named by ≥ 2 independent sites is corroborated; a rule
//       named by one site is shown as such and does not count in the score.
// Returns null when no search could run, so "nothing found" is never said when nothing was looked at.
import { registrableDomain, MIN_INDEPENDENT } from "../evidence.js";
import { isVerbatim, namedIn, norm } from "../quotes.js";
import { NoProviderAvailable } from "../providers/llm.js";
import { PAGE_CHARS, gatherEvidence } from "./classify.js";
import { completeWrapped } from "./market.js";

export const LEGAL_MARKETS = ["EU", "USA", "India"];
export const MARKET_NAME = { EU: "European Union", USA: "United States", India: "India" };
export const LEGAL_SOURCES = 5;
export const MAX_RULES = 6;

// Official search pages. A link to look something up, never a statement about the idea.
export const REGISTRIES = {
  USA: {
    trademark: { name: "USPTO Trademark Search", url: "https://tmsearch.uspto.gov/" },
    patent: { name: "USPTO Patent Public Search", url: "https://ppubs.uspto.gov/pubwebapp/" },
  },
  EU: {
    trademark: { name: "TMview (EUIPO and national offices)", url: "https://www.tmdn.org/tmview/" },
    patent: { name: "Espacenet (European Patent Office)", url: "https://worldwide.espacenet.com/" },
  },
  India: {
    trademark: { name: "IP India trade mark search", url: "https://tmrsearch.ipindia.gov.in/ESEARCH/" },
    patent: { name: "IP India patent search", url: "https://iprsearch.ipindia.gov.in/PublicSearch/" },
  },
};

const PROMPT = `You read numbered web pages for an idea-screening tool. List the laws, regulations, licences or
approvals that a page NAMES as applying to products like the idea below in the market given. Use only what the
pages say: no outside knowledge, no guesses, and never say whether the idea is allowed. For each rule give the
source number, the rule's name exactly as written on the page, one short sentence on what it covers in the
page's words, and the exact sentence from the page that contains the rule's name.
Return a JSON object: {"rules": [{"source": 1, "rule": "...", "summary": "...", "quote": "..."}]}.
List at most 8, the most clearly named first. Never return a bare array. If no page names a rule, return {"rules": []}.`;

export function legalFacts(market, input) {
  const r = REGISTRIES[market];
  const name = String(input?.title ?? "").trim();
  return [
    { kind: "trademark", title: "Trademark search", detail: name ? `Search for marks like "${name.slice(0, 60)}" before you settle on the name.` : "Search for marks like your product's name before you settle on it.", registry: r.trademark },
    { kind: "patent", title: "Patent search", detail: "Search for patents on the core of the idea, using the words in your pitch and solution.", registry: r.patent },
  ];
}

export function legalQuery(market, ideaText, input) {
  const what = [input?.title, (input?.industries || []).join(" ")].filter(Boolean).join(" ").trim() || ideaText.slice(0, 120);
  return `${what} regulations licensing requirements ${MARKET_NAME[market]}`.slice(0, 200);
}

const ruleKey = r => norm(r).replace(/[^a-z0-9 ]/g, " ").replace(/\b(the|of|and|act|regulation|regulations|rules?)\b/g, " ").replace(/\s+/g, " ").trim();

// The model's rules → those named in a verbatim sentence, grouped by rule across independent sites.
export function keepRules(raw, pages) {
  const groups = new Map();
  for (const x of Array.isArray(raw) ? raw : []) {
    const page = pages[Number(x?.source) - 1];
    const rule = String(x?.rule ?? "").trim().slice(0, 160);
    const quote = String(x?.quote ?? "").trim();
    if (!page || rule.length < 3 || !isVerbatim(page.text, quote) || !namedIn(quote, rule)) continue;
    const key = ruleKey(rule);
    const domain = registrableDomain(page.url);
    if (!key || !domain) continue;
    const g = groups.get(key) || { rule, summary: String(x?.summary ?? "").trim().slice(0, 300) || quote.slice(0, 300), sources: [], domains: new Set() };
    if (!g.domains.has(domain)) { g.domains.add(domain); g.sources.push({ name: domain, url: page.url, quote: quote.slice(0, 400) }); }
    groups.set(key, g);
  }
  return [...groups.values()]
    .map(g => ({ rule: g.rule, summary: g.summary, source: { name: g.sources[0].name, url: g.sources[0].url }, sources: g.sources, independent_sources: g.domains.size, corroborated: g.domains.size >= MIN_INDEPENDENT }))
    .sort((a, b) => b.independent_sources - a.independent_sources || a.rule.localeCompare(b.rule))
    .slice(0, MAX_RULES);
}

export async function searchLegal({ ideaText, input }, { llm, retrieval, trace }) {
  const markets = (input?.markets || []).filter(m => LEGAL_MARKETS.includes(m));
  if (!markets.length) { trace.log("legal", { router: "skipped", reason: "no target market" }); return null; }
  if (retrieval.name === "mock" || !llm.available("classify")) {
    trace.log("legal", { router: "skipped", reason: retrieval.name === "mock" ? "no retrieval" : "no reader" });
    return null;
  }
  const jurisdictions = [];
  const queries = [];
  let read = 0;
  for (const market of markets) {
    const q = legalQuery(market, ideaText, input);
    queries.push(q);
    const pages = (await gatherEvidence({ claim: q }, `legal-${market}`, { retrieval, trace })).slice(0, LEGAL_SOURCES);
    read += pages.length;
    let requirements = [];
    if (pages.length) {
      const messages = [
        { role: "system", content: PROMPT },
        { role: "user", content: `Market: ${MARKET_NAME[market]}\nIdea: ${ideaText.slice(0, 800)}\n\n${pages.map((p, k) => `[${k + 1}] ${p.url}\n${p.title || ""}\n${p.text.slice(0, PAGE_CHARS)}`).join("\n\n")}` },
      ];
      try {
        const raw = await completeWrapped(llm, messages, "rules");
        if (raw) requirements = keepRules(raw, pages);
        else trace.log("legal", { market, router: "llm", error: "malformed output" });
      } catch (err) {
        if (!(err instanceof NoProviderAvailable)) throw err;
        trace.log("legal", { market, router: "skipped", reason: "reader unavailable" });
      }
    }
    trace.log("legal", { market, router: "llm", sources: pages.length, rules: requirements.length, corroborated: requirements.filter(r => r.corroborated).length });
    jurisdictions.push({ jurisdiction: market, facts: legalFacts(market, input), requirements, sources_checked: pages.length });
  }
  return { jurisdictions, search: { queries, sources_checked: read } };
}
