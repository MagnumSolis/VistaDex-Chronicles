// backend/src/fleet.js — the discovery agent fleet (Notion §5).
// News Scout, Post-Mortem Miner, Death Watcher, Registry Reviewer.
// All discovery lands in STAGING as "candidate"; nothing auto-publishes.
// ≥2 independent sources required before a death is "confirmed".

import { makeTinyFish, isAllowedUrl } from "./tinyfish.js";
import { MongoClient } from "mongodb";
import { registrableDomain } from "./schemas.js";
import { sourceBlockReason, checkSources } from "./sources.js";

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

  const watcherOnly = ["watcher", "reverify"].includes(String(process.env.FLEET_MODE || ""));
  if (!watcherOnly) {
    await runAgentQueries("news-scout", QUERIES.newsScout);
    await runAgentQueries("post-mortem-miner", QUERIES.postMortemMiner);
  }
  // Death Watcher: re-check staging candidates for a second source, oldest check first.
  // FLEET_MODE=reverify re-checks every entry (confirmed ones too) under the current rule.
  const reverify = String(process.env.FLEET_MODE || "") === "reverify";
  const watched = await runDeathWatcher(staging, tf, {
    limit: Number(process.env.WATCHER_LIMIT || 20),
    filter: reverify ? { source_check_version: { $ne: SOURCE_CHECK_VERSION } } : { death_status: "candidate" },
  });

  await client.close();
  return { signals_found: found, ...watched };
}

// ── Death Watcher ──────────────────────────────────────────────────────────
// A death is confirmed only with sources on >=2 distinct registrable domains, each
// either the graveyard listing the entry came from or a fetched page that names the
// company and states the death (sources.js). Search hits alone never count.
export const SOURCE_CHECK_VERSION = 2;
const LISTINGS = new Set(["loot-drop.io"]); // the listing an entry was ingested from counts as its first source
const WATCH_QUERIES = ['"{name}" shut down', '"{name}" startup closed', '"{name}" acquired by', '"{name}" dissolved company'];

// Returns the fields to $set. Throws if TinyFish fails, so the entry is left as it was.
export async function verifyEntry(tf, entry, { maxNewChecks = 6 } = {}) {
  const urls = (entry.source_urls || []).filter(Boolean);
  const prior = new Map((entry.source_checks || []).map(c => [c.url, c]));
  const priorRejected = (entry.rejected_sources || []).filter(r => r.reason !== "fetch-failed");
  const checks = [], toFetch = [];
  for (const [i, url] of urls.entries()) {
    if (i === 0 && LISTINGS.has(registrableDomain(url))) { checks.push({ url, ok: true, reason: "graveyard-listing" }); continue; }
    if (prior.get(url)?.ok) { checks.push(prior.get(url)); continue; }
    const blocked = sourceBlockReason(url);
    if (blocked) checks.push({ url, ok: false, reason: blocked });
    else toFetch.push(url);
  }
  if (toFetch.length) checks.push(...await checkSources(tf, toFetch, entry.company_name));

  const goodDomains = () => new Set(checks.filter(c => c.ok).map(c => registrableDomain(c.url)));
  const attempts = entry.watch_attempts || 0;
  if (goodDomains().size < 2) {
    const name = String(entry.company_name).replace(/"/g, "");
    const query = WATCH_QUERIES[attempts % WATCH_QUERIES.length].replace("{name}", name);
    const seen = new Set([...checks.map(c => c.url), ...priorRejected.map(r => r.url)]);
    const fresh = [];
    for (const r of await tf.search(query, 10)) {
      if (seen.has(r.url) || sourceBlockReason(r.url) || goodDomains().has(registrableDomain(r.url))) continue;
      seen.add(r.url);
      fresh.push(r.url);
    }
    if (fresh.length) checks.push(...await checkSources(tf, fresh.slice(0, maxNewChecks), entry.company_name));
  }

  const good = checks.filter(c => c.ok);
  const rejected = new Map(priorRejected.map(r => [r.url, r]));
  for (const c of checks) if (!c.ok) rejected.set(c.url, { url: c.url, reason: c.reason, checked_at: c.checked_at || new Date() });
  for (const c of good) rejected.delete(c.url);
  return {
    source_urls: good.map(c => c.url),
    source_checks: good,
    rejected_sources: [...rejected.values()],
    sources_seen: good.length,
    death_status: goodDomains().size >= 2 ? "confirmed" : "candidate",
    source_check_version: SOURCE_CHECK_VERSION,
    sources_checked_at: new Date(),
    watch_attempts: attempts + 1,
    updated_at: new Date(),
  };
}

export async function runDeathWatcher(staging, tf, { limit = 20, filter = { death_status: "candidate" }, delayMs = 800 } = {}) {
  const entries = await staging.find(filter).sort({ sources_checked_at: 1, _id: 1 }).limit(limit).toArray();
  const counts = { watched: entries.length, confirmed: 0, demoted: 0, still_candidate: 0, errors: 0 };
  for (const entry of entries) {
    try {
      const update = await verifyEntry(tf, entry);
      await staging.updateOne({ _id: entry._id }, { $set: update });
      const was = entry.death_status;
      if (update.death_status === "confirmed") counts.confirmed++;
      else if (was === "confirmed") counts.demoted++;
      else counts.still_candidate++;
      console.log(`  [death-watcher] ${entry.company_name}: ${update.source_urls.length} good source(s) → ${update.death_status}${was !== update.death_status ? ` (was ${was})` : ""}`);
    } catch (e) {
      counts.errors++;
      console.error(`  [death-watcher] ${entry.company_name} skipped: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return counts;
}
