// backend/src/fleet.js — the discovery agent fleet (Notion §5).
// News Scout, Post-Mortem Miner, Death Watcher, Registry Reviewer.
// All discovery lands in STAGING as "candidate"; nothing auto-publishes.
// ≥2 independent sources required before a death is "confirmed".

import { makeTinyFish, isAllowedUrl } from "./tinyfish.js";
import { MongoClient } from "mongodb";
import { registrableDomain } from "./schemas.js";
import { sourceBlockReason, checkSources } from "./sources.js";
import { makeExtractorLLM, runSignalExtraction } from "./extract-signals.js";

// Discovery query bank. Each run takes the next DISCOVERY_QUERIES queries in a fixed
// order (a cursor stored in fleet_state), so successive runs cover the whole bank and
// a run is reproducible from its cursor. {month} and {year} come from the run date;
// {company} templates use KNOWN_COMPANIES and are skipped when it is empty.
export const DISCOVERY_QUERIES = [
  { agent: "news-scout", q: "startup shutting down {month} {year}" },
  { agent: "post-mortem-miner", q: "startup post-mortem why we failed" },
  { agent: "news-scout", q: "startup shuts down operations {year}" },
  { agent: "post-mortem-miner", q: "startups that shut down in {year}" },
  { agent: "news-scout", q: "startup winding down announcement {month} {year}" },
  { agent: "post-mortem-miner", q: "why our startup failed lessons shutting down" },
  { agent: "news-scout", q: "startup ceases operations after raising funding {year}" },
  { agent: "post-mortem-miner", q: "failed startups list {year}" },
  { agent: "news-scout", q: "startup acquired product shut down {year}" },
  { agent: "news-scout", q: "startup files for chapter 7 liquidation {year}" },
  { agent: "post-mortem-miner", q: "founder announces company is shutting down" },
  { agent: "news-scout", q: "fintech startup shuts down {year}" },
  { agent: "news-scout", q: "AI startup shuts down {year}" },
  { agent: "news-scout", q: "edtech startup shuts down {year}" },
  { agent: "news-scout", q: "healthtech startup shuts down {year}" },
  { agent: "news-scout", q: "India startup shuts down {year}" },
  { agent: "news-scout", q: "Europe startup closes doors {year}" },
  { agent: "news-scout", q: "{company} shutting down" },
  { agent: "registry-reviewer", q: "{company} dissolution filing" },
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Pure: the queries for one run, starting at `cursor`. Returns the next cursor too.
export function pickQueries(cursor, n, date = new Date(), knownCompanies = [], bank = DISCOVERY_QUERIES) {
  const out = [];
  let i = cursor;
  for (let tries = 0; out.length < n && tries < bank.length; tries++, i++) {
    const { agent, q } = bank[i % bank.length];
    if (q.includes("{company}") && !knownCompanies.length) continue;
    const query = q.replace("{month}", MONTHS[date.getUTCMonth()]).replace("{year}", String(date.getUTCFullYear()))
      .replace("{company}", knownCompanies[i % (knownCompanies.length || 1)]);
    out.push({ agent, query });
  }
  return { queries: out, next: i % bank.length };
}

function toSignals(searchResults, agent) {
  // Raw leads only; extract-signals.js decides what (if anything) a page says.
  return searchResults
    .filter(r => isAllowedUrl(r.url) && !sourceBlockReason(r.url))
    .map(r => ({
      signal_title: r.title,
      url: r.url,
      snippet: (r.snippet || "").slice(0, 500),
      site: r.site,
      discovered_by: agent,
      discovered_at: new Date(),
    }));
}

// FLEET_MODE: "discovery" (search → signals → candidates), "watcher" (confirm candidates),
// "reverify" (re-check every entry under the current source rule), "all" (default).
export async function runFleet({ apiKey, mongoUri, dbName = "vistadex", knownCompanies = [], env = process.env }) {
  const mode = String(env.FLEET_MODE || "all");
  const tf = makeTinyFish(apiKey);
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  const staging = db.collection("graveyard_staging");
  const signals = db.collection("graveyard_signals");
  const state = db.collection("fleet_state");
  const result = { mode };

  try {
    if (mode === "discovery" || mode === "all") {
      const st = (await state.findOne({ _id: "discovery" })) || { cursor: 0 };
      const { queries, next } = pickQueries(st.cursor, Number(env.DISCOVERY_QUERIES || 4), new Date(), knownCompanies);
      let found = 0;
      for (const { agent, query } of queries) {
        try {
          const sigs = toSignals(await tf.search(query, 10), agent);
          for (const c of sigs) await signals.updateOne({ url: c.url }, { $set: c, $setOnInsert: { first_seen: new Date() } }, { upsert: true });
          found += sigs.length;
          console.log(`  [${agent}] "${query}" → ${sigs.length} signals`);
        } catch (e) {
          console.error(`  [${agent}] "${query}" failed: ${e.message.slice(0, 200)}`);
        }
        await new Promise(r => setTimeout(r, 500));
      }
      await state.updateOne({ _id: "discovery" }, { $set: { cursor: next, last_run: new Date(), last_queries: queries.map(q => q.query) } }, { upsert: true });
      result.signals_found = found;

      const llm = makeExtractorLLM(env);
      result.extraction = await runSignalExtraction({
        signals, staging, tf, llm,
        limit: Number(env.SIGNAL_LIMIT || 10),
        delayMs: Number(env.EXTRACT_DELAY_MS ?? 30000),
      });
      if (result.extraction.skipped) console.log("  [extractor] no GROQ_API_KEY / MISTRAL_API_KEY: signals wait for the next run with a key");
    }

    if (mode === "watcher" || mode === "reverify" || mode === "all") {
      // Death Watcher: oldest check first. reverify also re-checks confirmed entries.
      result.watcher = await runDeathWatcher(staging, tf, {
        limit: Number(env.WATCHER_LIMIT || 20),
        filter: mode === "reverify" ? { source_check_version: { $ne: SOURCE_CHECK_VERSION } } : { death_status: "candidate" },
      });
    }
  } finally {
    await client.close();
  }
  return result;
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
