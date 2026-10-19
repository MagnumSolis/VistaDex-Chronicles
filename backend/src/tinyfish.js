// backend/src/tinyfish.js — thin wrapper over the TinyFish web-access layer.
// Search + Fetch are free on every plan; Agent runs consume wallet credits.
// Ground rules (AGENTS.md): never scrape LinkedIn or ToS-restricted platforms.

const BASE = "https://agent.tinyfish.ai";

function headers(apiKey) {
  return { "content-type": "application/json", "X-API-Key": apiKey };
}

export function makeTinyFish(apiKey) {
  if (!apiKey) throw new Error("TINYFISH_API_KEY not set");

  // GET /v1/search?query=...&num_results=...
  async function search(query, numResults = 10) {
    const url = `${BASE}/v1/search?query=${encodeURIComponent(query)}&num_results=${numResults}`;
    const res = await fetch(url, { headers: headers(apiKey) });
    if (!res.ok) throw new Error(`tinyfish search ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.results || []).map(r => ({ title: r.title, url: r.url, snippet: r.snippet, site: r.site_name, date: r.date }));
  }

  // Fetch up to 10 URLs, clean extracted content (also free)
  async function fetchPages(urls, { format = "markdown" } = {}) {
    const res = await fetch(`${BASE}/v1/fetch`, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({ urls: urls.slice(0, 10), format }),
    });
    if (!res.ok) throw new Error(`tinyfish fetch ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const byUrl = {};
    for (const r of data.results || []) {
      byUrl[r.url] = { content: (r.text || "").slice(0, 20000), title: r.title, published_date: r.published_date, error: r.error };
    }
    return byUrl;
  }

  // Goal-based agent run (consumes credits) — used only for high-value pages
  async function runAgent(goal, { url, outputSchema } = {}) {
    const res = await fetch(`${BASE}/v1/automation/run`, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        goal: url ? `${goal} on ${url}` : goal,
        ...(outputSchema ? { output_schema: outputSchema } : {}),
      }),
    });
    if (!res.ok) throw new Error(`tinyfish agent ${res.status}: ${await res.text()}`);
    return res.json();
  }

  return { search, fetchPages, runAgent };
}

// ToS-restricted platforms the fleet must never touch.
export const BLOCKED_DOMAINS = ["linkedin.com", "facebook.com", "x.com", "twitter.com"];
export function isAllowedUrl(url) {
  try {
    const host = new URL(url).hostname;
    return !BLOCKED_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  } catch { return false; }
}
