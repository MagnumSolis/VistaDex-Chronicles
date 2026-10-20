// worker/providers/search.js — Tavily web search per claim (max 5 results).
// Public news, company sites, registries, funding-DB APIs only — never ToS-restricted platforms.

export async function tavilySearch(env, { query, maxResults = 5 }) {
  if (!env.TAVILY_API_KEY) throw new Error("tavily_not_configured");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      search_depth: "basic",
    }),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.results || []).map(r => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 800) || "" }));
}
