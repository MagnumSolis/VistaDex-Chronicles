// ── rules.js — Deterministic claim typing (cheap, explainable, first) ──
// Each rule adds weight to one claim type. A claim is typed by rules only when
// the top type scores ≥ CONFIDENT_SCORE and strictly beats the runner-up;
// otherwise it is "uncertain" and may be routed to the LLM.

export const CONFIDENT_SCORE = 2;

const RULES = [
  // market_size — magnitudes, growth rates, market language
  { type: "market_size", w: 2, re: /\$\s?\d[\d.,]*\s?(k|m|mn|b|bn|t|million|billion|trillion)\b/i, why: "money magnitude" },
  { type: "market_size", w: 2, re: /\b\d[\d.,]*\s?(million|billion|trillion)\b/i, why: "large magnitude" },
  { type: "market_size", w: 2, re: /\bmarket\b[^.]*\b(worth|size|sized|valued|value|grow|growing|growth|cagr|projected)\b/i, why: "market size/growth" },
  { type: "market_size", w: 2, re: /\b(cagr|tam|sam|addressable market)\b/i, why: "market metric" },
  { type: "market_size", w: 1, re: /\b\d+(\.\d+)?\s?%\s?(annually|a year|per year|per annum|yoy|year[- ]on[- ]year)\b/i, why: "growth rate" },

  // novelty — existence / uniqueness assertions
  { type: "novelty", w: 2, re: /\bno (such |other |existing |current |direct |comparable )?(tool|product|app|company|startup|platform|solution|service|competitor|one)s?\b/i, why: "nothing-exists claim" },
  { type: "novelty", w: 2, re: /\b(nobody|no one|none of|none)\b/i, why: "nobody/none" },
  { type: "novelty", w: 2, re: /\b(does not|doesn't|do not|don't) (yet )?exist\b/i, why: "does not exist" },
  { type: "novelty", w: 1, re: /\b(currently exists?|first|only|unique|unlike|novel|unprecedented|never been)\b/i, why: "uniqueness word" },

  // defensibility — moats and barriers
  { type: "defensibility", w: 2, re: /\b(moat|patent(ed|s)?|proprietary|defensib\w*|barrier to entry|barriers|network effects?|switching costs?|lock-in|exclusive)\b/i, why: "moat/barrier" },
  { type: "defensibility", w: 2, re: /\b(cannot|can't|could not|unable to) (easily )?(replicate|copy|compete|match)\b/i, why: "cannot-replicate" },
  { type: "defensibility", w: 1, re: /\b(trained on|hard to (copy|replicate)|years ahead|head start)\b/i, why: "data/time advantage" },

  // traction — users, customers, revenue, pilots, growth already achieved
  { type: "traction", w: 3, re: /\b(mrr|arr|annual recurring revenue|monthly recurring revenue|in revenue|revenue run[- ]rate)\b/i, why: "recurring revenue" },
  { type: "traction", w: 2, re: /\b\d[\d,.]*\s?(k|m)?\+?\s?(paying |active |monthly |daily |registered )?(users|customers|clients|subscribers|downloads|installs|sign-?ups|members)\b/i, why: "user/customer count" },
  { type: "traction", w: 2, re: /\b(paying customers|pilots?|lois?|letters? of intent|wait-?list|pre-?orders?|design partners?)\b/i, why: "pilots/LOIs/waitlist" },
  { type: "traction", w: 1, re: /\b\d+(\.\d+)?\s?%\s?(month[- ]on[- ]month|mom|week[- ]on[- ]week|wow)\b/i, why: "growth rate" },

  // other — pricing, regulation, timelines, unit economics
  // A bare price mention is weak: "no tool exists at under $200/month" is still a novelty claim.
  { type: "other", w: 1, re: /\$\s?\d[\d.,]*\s?(\/|per )\s?(month|mo|year|yr|user|seat|unit)\b/i, why: "price point" },
  { type: "other", w: 2, re: /\b(price point|pricing|margin|unit economics|regulat\w*|approval|compliant|compliance)\b/i, why: "viability/regulatory" },
  { type: "other", w: 1, re: /\bwithin \d+ (weeks|months|years)\b/i, why: "timeline" },
];

// Words that make a sentence checkable at all (used by the falsifiability filter).
const ASSERTIVE = /\d|\b(no|none|nobody|only|first|every|all|never|cannot|can't|will|is worth|exists?|largest|cheapest|fastest|better|more|less|than)\b/i;

export function scoreClaim(text) {
  const scores = { novelty: 0, market_size: 0, defensibility: 0, traction: 0, other: 0 };
  const hits = [];
  for (const r of RULES) {
    if (r.re.test(text)) {
      scores[r.type] += r.w;
      hits.push(`${r.type}:${r.why}`);
    }
  }
  return { scores, hits };
}

// → { type, confident, scores, hits }
export function typeClaim(text) {
  const { scores, hits } = scoreClaim(text);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [[topType, top], [, second]] = ranked;
  const confident = top >= CONFIDENT_SCORE && top > second;
  return { type: top > 0 && top > second ? topType : "other", confident, scores, hits };
}

export function isFalsifiable(text) {
  const { hits } = scoreClaim(text);
  return hits.length > 0 || ASSERTIVE.test(text);
}
