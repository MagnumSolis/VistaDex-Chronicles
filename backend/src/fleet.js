// backend/src/fleet.js — the discovery agent fleet (Notion §5).
// News Scout, Post-Mortem Miner, Death Watcher, Registry Reviewer.
// All discovery lands in STAGING as "candidate"; nothing auto-publishes.
// ≥2 independent sources required before a death is "confirmed".

import { makeTinyFish, isAllowedUrl } from "./tinyfish.js";
import { MongoClient } from "mongodb";
import { newGraveyardEntry, validateEntry, isIndependentSource } from "./schemas.js";

const QUERIES = {
  newsScout: [
    "{company} shutting down",
    "startup shutdown announcement 2025",
    "what happened to {company} startup",
  ],
  postMortemMiner: [
    "startup post-mortem why we failed",
    "CB Insights startup failure post-mortem",
    "site:news.ycombinator.com startup shutting down",
  ],
  registryReviewer: [
    "{company} dissolution filing",
    "{company} company registry strike-off",
  ],
};

function extractCandidates(searchResults) {
  // Lightweight heuristic candidate extraction from search snippets.
  // The Groq tagger (pipeline stage) does the real classification later.
  return searchResults
    .filter(r => isAllowedUrl(r.url))
    .map(r => ({
      signal_title: r.title,
      url: r.url,
      snippet: (r.snippet || "").slice(0, 500),
      site: r.site,
      discovered_by: "fleet",
      discovered_at: new Date(),
    }));
}

export async function runFleet({ apiKey, mongoUri, dbName = "vistadex", knownCompanies = [] }) {
  const tf = makeTinyFish(apiKey);
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  const staging = db.collection("graveyard_staging");
  const signals = db.collection("graveyard_signals");

  let found = 0;
  const runAgentQueries = async (agentName, queries) => {
    for (const q of queries) {
      const query = q.replace("{company}", knownCompanies[Math.floor(knownCompanies.length * Math.random())] || "startup");
      if (query.includes("{company}") && !knownCompanies.length) continue;
      try {
        const results = await tf.search(query, 10);
        const candidates = extractCandidates(results);
        for (const c of candidates) {
          await signals.updateOne({ url: c.url }, { $set: c, $setOnInsert: { first_seen: new Date() } }, { upsert: true });
          found++;
        }
        console.log(`  [${agentName}] "${query.slice(0, 50)}" → ${candidates.length} signals`);
      } catch (e) {
        console.error(`  [${agentName}] "${query.slice(0, 50)}" failed: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  };

  await runAgentQueries("news-scout", QUERIES.newsScout);
  await runAgentQueries("post-mortem-miner", QUERIES.postMortemMiner);
  // Death Watcher: re-check known staging entries for a second source
  const candidatesPending = await staging.find({ death_status: "candidate" }).limit(20).toArray();
  for (const entry of candidatesPending) {
    try {
      const results = await tf.search(`"${entry.company_name}" shut down OR closing OR dissolved`, 10);
      const independent = results.filter(r =>
        isAllowedUrl(r.url) &&
        isIndependentSource(r.url, entry.source_urls) &&
        !r.url.includes("loot-drop.io") // Loot Drop already counted as one source
      );
      if (independent.length > 0) {
        const newSources = independent.slice(0, 2).map(r => r.url);
        const updatedUrls = [...entry.source_urls, ...newSources];
        const distinctDomains = new Set(updatedUrls.map(u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } }));
        const confirmed = distinctDomains.size >= 2;
        await staging.updateOne(
          { _id: entry._id },
          { $set: { source_urls: updatedUrls, sources_seen: (entry.sources_seen || 1) + newSources.length, death_status: confirmed ? "confirmed" : "candidate", updated_at: new Date() } }
        );
        console.log(`  [death-watcher] ${entry.company_name}: +${newSources.length} source(s) → ${confirmed ? "CONFIRMED" : "still candidate"}`);
      }
    } catch (e) {
      console.error(`  [death-watcher] ${entry.company_name} failed: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 800));
  }

  await client.close();
  return { signals_found: found };
}
