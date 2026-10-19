// ── quotes.js — The verbatim-quote rule shared by every stage that reads web pages ──
// A model may only cite a page with a quote that appears in that page's text, and code (never the model)
// maps the source number back to the URL.

export const MIN_QUOTE_CHARS = 12;

export function norm(s) {
  return String(s).toLowerCase().replace(/[“”"‘’'`]/g, "").replace(/\s+/g, " ").trim();
}

export function isVerbatim(pageText, quote, min = MIN_QUOTE_CHARS) {
  const q = String(quote ?? "").trim();
  return q.length >= min && norm(pageText).includes(norm(q));
}

/** True when `name` appears inside `quote` (case- and spacing-insensitive). */
export function namedIn(quote, name) {
  const n = norm(name);
  return n.length >= 2 && norm(quote).includes(n);
}

// Money amounts written in a quote → USD. Recognises "$27B", "$27 billion", "US$ 1.2 trillion",
// "USD 500 million", "27 billion dollars". Returns [{ text, usd }].
const UNIT = { t: 1e12, tn: 1e12, trillion: 1e12, b: 1e9, bn: 1e9, billion: 1e9, m: 1e6, mn: 1e6, million: 1e6, k: 1e3, thousand: 1e3 };
export function moneyAmounts(text) {
  const out = [];
  const s = String(text);
  const pre = /(?:US\$|USD\s?|\$)\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(trillion|billion|million|thousand|tn|bn|mn|[tbmk])\b/gi;
  const post = /\b(\d+(?:\.\d+)?)\s?(trillion|billion|million)\s+(?:US\s)?dollars\b/gi;
  for (const re of [pre, post]) {
    for (const m of s.matchAll(re)) {
      const usd = Number(m[1].replace(/,/g, "")) * UNIT[m[2].toLowerCase()];
      if (Number.isFinite(usd) && usd > 0) out.push({ text: m[0].trim(), usd });
    }
  }
  return out;
}
