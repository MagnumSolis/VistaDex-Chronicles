// ── retrieval.js — Thin web-retrieval wrapper ──
// Interface every backend implements:
//   search(query, { limit }) → [{ url, title, snippet }]
//   fetchPages(urls)         → [{ url, title, text }]
// TinyFish is the planned backend; Tavily/Firecrawl can replace it by
// implementing the same two methods.

import { ProviderError } from "./llm.js";
import { resilientFetch } from "./http.js";

// Search 15 s, fetch 25 s per attempt; one retry on 429 / 5xx; every attempt counts against the run's budget.
export function tinyfishRetrieval({ apiKey, fetchImpl, budget, sleep } = {}) {
  const f = resilientFetch(fetchImpl, { budget, sleep, timeoutMs: 25000 });
  const fs = resilientFetch(fetchImpl, { budget, sleep, timeoutMs: 15000 });
  return {
    name: "tinyfish",
    async search(query, { limit = 5 } = {}) {
      const url = `https://agent.tinyfish.ai/v1/search?query=${encodeURIComponent(query)}&num_results=${limit}`;
      const res = await fs(url, { headers: { "X-API-Key": apiKey } }).catch(err => {
        throw new ProviderError("tinyfish-search", 0, err.message);
      });
      if (!res.ok) throw new ProviderError("tinyfish-search", res.status, `HTTP ${res.status}`);
      const data = await res.json();
      return (data.results || []).slice(0, limit).map(r => ({ url: r.url, title: r.title || "", snippet: r.snippet || "" }));
    },
    async fetchPages(urls) {
      if (!urls.length) return [];
      const res = await f("https://agent.tinyfish.ai/v1/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ urls: urls.slice(0, 10), format: "markdown" }),
      }).catch(err => {
        throw new ProviderError("tinyfish-fetch", 0, err.message);
      });
      if (!res.ok) throw new ProviderError("tinyfish-fetch", res.status, `HTTP ${res.status}`);
      const data = await res.json();
      return (data.results || []).map(r => ({ url: r.final_url || r.url, title: r.title || "", text: r.text || "" }));
    },
  };
}

// Key-free backend: no evidence at all. Stage 2 then abstains ("unverified").
export function mockRetrieval() {
  return {
    name: "mock",
    async search() { return []; },
    async fetchPages() { return []; },
  };
}

export function retrievalFromEnv(env = {}, fetchImpl, { budget, sleep } = {}) {
  return env.TINYFISH_API_KEY ? tinyfishRetrieval({ apiKey: env.TINYFISH_API_KEY, fetchImpl, budget, sleep }) : mockRetrieval();
}
