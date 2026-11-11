// ── classify.js — Stage 2: live retrieval + per-source stance + computed status ──
// The LLM labels each retrieved page as supports / contradicts / irrelevant and
// must quote it. Code keeps a judgment only if the quote really appears in that
// page, maps source numbers back to URLs (the model never writes URLs), and
// computes the status from independent-domain counts (evidence.js).

import { computeStatus, STANCES } from "../evidence.js";
import { parseWrapped, NoProviderAvailable } from "../providers/llm.js";
import { isVerbatim } from "../quotes.js";

export const SOURCES_PER_CLAIM = 5;
export const PAGE_CHARS = 2500;

export const JUDGE_PROMPT = `You check one factual claim against numbered web sources.
For EACH source decide its stance toward the claim:
- "supports": the source states something that makes the claim true
- "contradicts": the source states something that makes the claim false
- "irrelevant": anything else, including when you are unsure
Read the claim's exact wording:
- If the claim says something does not exist, or that nobody offers it, a source that names a product or company
  offering it contradicts the claim. Such a source never supports it, however closely it matches the topic.
- If the claim has a number or a threshold ("more than 3 hours", "under $100"), the source supports it only if its own
  number meets that threshold. A number that does not ("one to three hours", "$150") contradicts it.
- A general point on the same topic does not support a specific claim: "integration is hard" does not show that
  "large vendors are prevented from competing". Mark it irrelevant.
Quote the exact sentence from the source that justifies a supports/contradicts stance.
Do not use outside knowledge. Do not judge the claim overall.
Return a JSON object: {"judgments": [{"source": 1, "stance": "supports|contradicts|irrelevant", "quote": "..."}]}. Never return a bare array.`;

export async function classifyClaims(claims, { llm, retrieval, trace }) {
  // Claims verify in parallel; each one isolates its own failures downstream,
  // and the output order always matches the input order (indexed map).
  const out = await Promise.all(claims.map((c, i) => classifyOne(c, i, { llm, retrieval, trace })));
  return out;
}

// Novelty claims also hand their fetched pages on (as _pages, never part of the contract) so the
// competitor stage can look for named products on them without fetching again.
async function classifyOne(claim, index, ctx) {
  const pages = await gatherEvidence(claim, index, ctx);
  const result = await judge(claim, index, pages, ctx);
  return claim.type === "novelty" ? { ...result, _pages: pages } : result;
}

async function judge(claim, index, pages, { llm, trace }) {
  if (!pages.length) {
    return abstain(claim, index, trace, "abstain(no-evidence)",
      "No evidence was retrieved for this claim, so it is not marked true or false. Check it yourself.");
  }
  if (!llm.available("classify")) {
    return abstain(claim, index, trace, "abstain(no-classifier)",
      `${pages.length} page(s) were retrieved but no classifier was available, so no status was assigned.`, pages.map(p => p.url));
  }

  let judgments;
  try {
    const { content } = await llm.complete("classify", {
      json: true,
      messages: [
        { role: "system", content: JUDGE_PROMPT },
        { role: "user", content: `Claim: ${claim.claim}\n\n${pages.map((p, k) => `[${k + 1}] ${p.url}\n${p.title}\n${p.text.slice(0, PAGE_CHARS)}`).join("\n\n")}` },
      ],
    });
    judgments = parseWrapped(content, "judgments");
  } catch (err) {
    if (!(err instanceof NoProviderAvailable)) throw err;
    return abstain(claim, index, trace, "abstain(all-providers-failed)", "The classifier was unavailable, so no status was assigned.", pages.map(p => p.url));
  }
  if (!judgments) {
    return abstain(claim, index, trace, "abstain(malformed-output)", "The classifier returned malformed output, so no status was assigned.", pages.map(p => p.url));
  }

  const kept = [];
  const nonExistence = isNonExistenceClaim(claim.claim);
  for (const j of judgments) {
    const page = pages[Number(j?.source) - 1];
    const stance = STANCES.includes(j?.stance) ? j.stance : null;
    const quote = String(j?.quote ?? "").trim();
    const verbatim = Boolean(page) && isVerbatim(page.text, quote);
    trace.log("judgment", { claim_index: index, source: page?.url ?? null, stance, quote_verified: Boolean(verbatim) });
    // "Nothing like this exists" can only be supported by a sentence that states an absence; a page that
    // lists products on the topic is not support (a live report confirmed such a claim with price lists).
    if (page && stance === "supports" && verbatim && nonExistence && !statesAbsence(quote)) {
      trace.log("judgment_dropped", { claim_index: index, source: page.url, reason: "support without an absence" });
      continue;
    }
    if (page && stance && stance !== "irrelevant" && verbatim) kept.push({ url: page.url, stance, quote });
  }

  const result = computeStatus(kept);
  trace.log("classified", {
    claim_index: index, router: "llm+computed", status: result.status,
    supporting: result.supporting, contradicting: result.contradicting, conflicted: result.conflicted,
  });
  // One verified quote per counted source (the first found), shown next to its link in the report.
  const evidence = [];
  for (const url of result.source_urls) {
    const k = kept.find(x => x.url === url);
    if (k) evidence.push({ url, stance: k.stance, quote: k.quote.slice(0, 400) });
  }
  return { ...claim, status: result.status, reasoning: explain(result, kept), source_urls: result.source_urls, evidence };
}

// A claim that something does not exist / nobody offers it.
const NON_EXISTENCE = /\b(no (one|body)|nobody|none|no\b[^.]{0,80}\b(exists?|available|offers?|on the market|does this|provides?)|(does not|doesn't|do not|don't) (yet )?exist|there (is|are) no)\b/i;
export const isNonExistenceClaim = text => NON_EXISTENCE.test(String(text));
// A sentence that states an absence or a gap.
const ABSENCE = /\b(no|not|none|nobody|never|lacks?|lacking|absence|absent|without|missing|gap|unavailable|unmet|few|rarely|only)\b|n't\b/i;
export const statesAbsence = text => ABSENCE.test(String(text));

export async function gatherEvidence(claim, index, { retrieval, trace }) {
  let hits = [];
  try {
    hits = await retrieval.search(claim.claim.slice(0, 200), { limit: SOURCES_PER_CLAIM });
    trace.log("search", { claim_index: index, provider: retrieval.name, results: hits.map(h => h.url) });
  } catch (err) {
    trace.log("search_error", { claim_index: index, provider: retrieval.name, error: err.message });
    return [];
  }
  if (!hits.length) return [];
  let pages = [];
  try {
    pages = await retrieval.fetchPages(hits.map(h => h.url));
    trace.log("fetch", { claim_index: index, provider: retrieval.name, ok: pages.map(p => p.url), requested: hits.length });
  } catch (err) {
    trace.log("fetch_error", { claim_index: index, provider: retrieval.name, error: err.message });
  }
  // Fall back to search snippets for pages that could not be fetched.
  const fetched = new Set(pages.map(p => p.url));
  for (const h of hits) if (!fetched.has(h.url) && h.snippet) pages.push({ url: h.url, title: h.title, text: h.snippet });
  return pages.filter(p => p.text);
}

function abstain(claim, index, trace, router, reasoning, consulted = []) {
  trace.log("classified", { claim_index: index, router, status: "unverified", consulted });
  return { ...claim, status: "unverified", reasoning, source_urls: [] };
}

export function explain(result, kept) {
  const s = result.supporting.length, c = result.contradicting.length;
  const head = `${s} independent source${s === 1 ? "" : "s"} support this claim; ${c} contradict${c === 1 ? "s" : ""} it.`;
  const rule = result.status === "unverified" ? ` At least 2 independent sources on one side are needed for a status, so this stays unverified.` : "";
  const quotes = kept.slice(0, 2).map(k => ` ${k.stance === "supports" ? "Supporting" : "Contradicting"}: "${k.quote.slice(0, 220)}"`).join("");
  return head + rule + quotes;
}
