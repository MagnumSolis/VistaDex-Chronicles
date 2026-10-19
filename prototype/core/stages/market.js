// ── market.js — TAM from a verified source quote ──
// The figure must come from a source, never from the founder's own text: only quotes that support a
// CONFIRMED market-size claim (≥ 2 independent sources) and appear verbatim on the fetched page are
// read, and the largest money amount written in one of them becomes the TAM, cited to that page.
// SAM and SOM are not produced live (they need assumptions), so they stay absent.
import { registrableDomain } from "../evidence.js";
import { moneyAmounts } from "../quotes.js";

export function tamFromEvidence(claims, trace) {
  let best = null;
  for (const c of claims) {
    if (c.type !== "market_size" || c.status !== "confirmed") continue;
    for (const e of c.evidence || []) {
      if (e.stance !== "supports") continue;
      for (const m of moneyAmounts(e.quote)) {
        if (!best || m.usd > best.usd) best = { ...m, url: e.url, quote: e.quote, claim: c.claim };
      }
    }
  }
  trace?.log("market", { tam_usd: best?.usd ?? null, source: best?.url ?? null });
  if (!best) return null;
  const domain = registrableDomain(best.url) || best.url;
  return {
    tam: {
      value: best.text, value_usd: best.usd,
      scope: `Market size quoted by ${domain}, one of the independent sources that confirmed: "${best.claim.slice(0, 140)}"`,
      citation: { name: domain, url: best.url },
      quote: best.quote,
    },
  };
}
