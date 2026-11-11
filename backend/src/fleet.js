// backend/src/fleet.js — the discovery agent fleet (Notion §5).
// News Scout, Post-Mortem Miner, Death Watcher, Registry Reviewer.
// All discovery lands in STAGING as "candidate"; nothing auto-publishes.
// ≥2 independent sources required before a death is "confirmed".

import { makeTinyFish, isAllowedUrl } from "./tinyfish.js";
import { MongoClient } from "mongodb";
import { registrableDomain } from "./schemas.js";
import { sourceBlockReason, checkSources, leadSkipReason } from "./sources.js";
import { makeExtractorLLM, runSignalExtraction } from "./extract-signals.js";
import { recordRun, runId, summaryLine } from "./fleet-metrics.js";

// Discovery query bank. Each run takes the next DISCOVERY_QUERIES queries in a fixed
// order (a cursor stored in fleet_state), so successive runs cover the whole bank and
// a run is reproducible from its cursor and date.
// The bank asks for news pages that name a company next to its death ("X shuts down",
// "X files for bankruptcy"), not advice or statistics pages, which name none (the
// 2026-11-11 run read 7 such pages and found 0 companies). Each news phrasing is
// paired with each sector or region subject: with coprime list lengths, entry i uses
// PHRASES[i % P] and SUBJECTS[i % S], which visits every pair once per P*S entries.
// Every EXTRA_EVERY entries one EXTRAS query follows (lists of shutdowns, {company}
// templates). Tokens: {month} {year} the run month, {now} "November 2026", {prev}
// the month before ("October 2026"); {company} uses KNOWN_COMPANIES and is skipped
// when it is empty.
export const PHRASES = [
  '{subject} "shuts down" {now}',
  '{subject} "is shutting down" {year}',
  '{subject} "winds down" operations {prev}',
  '{subject} "ceases operations" {year}',
  '{subject} "files for bankruptcy" {now}',
  '{subject} acquihired team joins {year}',
  '{subject} "shutting down" announcement {prev}',
];
export const SUBJECTS = [
  "startup", "fintech startup", "AI startup", "edtech startup", "healthtech startup", "crypto startup",
  "climate tech startup", "SaaS startup", "ecommerce startup", "EV startup", "proptech startup",
  "India startup", "Europe startup", "UK startup", "Germany startup", "Southeast Asia startup",
  "Africa startup", "Latin America startup", "Israel startup", "Australia startup",
];
export const EXTRAS = [
  { agent: "post-mortem-miner", q: '"startups that shut down" {year}' },
  { agent: "post-mortem-miner", q: "startup shutdowns this month {now}" },
  { agent: "news-scout", q: "{company} shutting down" },
  { agent: "post-mortem-miner", q: "tech companies that shut down {prev}" },
  { agent: "registry-reviewer", q: "{company} dissolution filing" },
  { agent: "post-mortem-miner", q: 'founder "we are shutting down" {year}' },
];
const EXTRA_EVERY = 8;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export function buildQueryBank(phrases = PHRASES, subjects = SUBJECTS, extras = EXTRAS, every = EXTRA_EVERY) {
  if (gcd(phrases.length, subjects.length) !== 1) throw new Error("PHRASES and SUBJECTS lengths must be coprime");
  const bank = [];
  for (let i = 0, x = 0; i < phrases.length * subjects.length; i++) {
    bank.push({ agent: "news-scout", q: phrases[i % phrases.length].replace("{subject}", subjects[i % subjects.length]) });
    if (extras.length && i % every === every - 1) bank.push(extras[x++ % extras.length]);
  }
  return bank;
}
export const DISCOVERY_QUERIES = buildQueryBank();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function fillQuery(q, date = new Date(), company = "") {
  const m = date.getUTCMonth(), y = date.getUTCFullYear();
  const prev = m === 0 ? `December ${y - 1}` : `${MONTHS[m - 1]} ${y}`;
  return q.replaceAll("{now}", `${MONTHS[m]} ${y}`).replaceAll("{prev}", prev)
    .replaceAll("{month}", MONTHS[m]).replaceAll("{year}", String(y)).replaceAll("{company}", company);
}

// Pure: the queries for one run, starting at `cursor`. Returns the next cursor too.
export function pickQueries(cursor, n, date = new Date(), knownCompanies = [], bank = DISCOVERY_QUERIES) {
  const out = [];
  let i = cursor;
  for (let tries = 0; out.length < n && tries < bank.length; tries++, i++) {
    const { agent, q } = bank[i % bank.length];
    if (q.includes("{company}") && !knownCompanies.length) continue;
    out.push({ agent, query: fillQuery(q, date, knownCompanies[i % (knownCompanies.length || 1)] || "") });
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
// `deps` ({ db, tf, llm }) replaces the real Mongo, TinyFish and LLM in tests.
export async function runFleet({ apiKey, mongoUri, dbName = "vistadex", knownCompanies = [], env = process.env, deps = {} }) {
  const mode = String(env.FLEET_MODE || "all");
  const tf = deps.tf || makeTinyFish(apiKey);
  const client = deps.db ? null : new MongoClient(mongoUri);
  if (client) await client.connect();
  const db = deps.db || client.db(dbName);
  const staging = db.collection("graveyard_staging");
  const signals = db.collection("graveyard_signals");
  const state = db.collection("fleet_state");
  const result = { mode, run_id: runId(env) };

  try {
    if (mode === "discovery" || mode === "all") {
      const st = (await state.findOne({ _id: "discovery" })) || { cursor: 0 };
      const { queries, next } = pickQueries(st.cursor, Number(env.DISCOVERY_QUERIES || 4), new Date(), knownCompanies);
      let found = 0, fresh = 0;
      for (const { agent, query } of queries) {
        try {
          const sigs = toSignals(await tf.search(query, 10), agent);
          let added = 0;
          for (const c of sigs) {
            const r = await signals.updateOne({ url: c.url }, { $set: c, $setOnInsert: { first_seen: new Date() } }, { upsert: true });
            added += r.upsertedCount || 0;
          }
          found += sigs.length;
          fresh += added;
          const leads = sigs.filter(c => !leadSkipReason(c.signal_title, c.snippet)).length;
          console.log(`  [${agent}] "${query}" → ${sigs.length} signals (${added} new, ${leads} name a company)`);
        } catch (e) {
          console.error(`  [${agent}] "${query}" failed: ${e.message.slice(0, 200)}`);
        }
        await new Promise(r => setTimeout(r, Number(env.SEARCH_DELAY_MS ?? 500)));
      }
      await state.updateOne({ _id: "discovery" }, { $set: { cursor: next, last_run: new Date(), last_queries: queries.map(q => q.query) } }, { upsert: true });
      result.signals_found = found;

      const llm = deps.llm || makeExtractorLLM(env);
      result.extraction = await runSignalExtraction({
        signals, staging, tf, llm,
        limit: Number(env.SIGNAL_LIMIT || 10),
        delayMs: Number(env.EXTRACT_DELAY_MS || 30000),
        budgetMs: Number(env.EXTRACT_BUDGET_MS || 20 * 60 * 1000),
      });
      if (result.extraction.skipped) console.log("  [extractor] no GROQ_API_KEY / MISTRAL_API_KEY: signals wait for the next run with a key");
      const x = result.extraction;
      result.discovery = {
        queries: queries.length, query_list: queries.map(q => q.query), signals: found, new_signals: fresh,
        prefiltered: x.prefiltered ?? 0, extracted: x.signals ?? 0, new_candidates: x.created ?? 0, sources_added: x.added_source ?? 0,
        rejected_items: x.rejected ?? 0, blocked: x.blocked ?? 0, fetch_failed: x.fetch_failed ?? 0, stopped: x.skipped || x.stopped || null,
        backlog: await signals.countDocuments({ extraction_status: { $exists: false } }),
      };
      await recordRun(state, result.run_id, result.discovery);
      console.log(`Discovery ${result.run_id}: ${summaryLine(result.discovery)} · signals waiting ${result.discovery.backlog}`);
    }

    if (mode === "watcher" || mode === "reverify" || mode === "all") {
      // Death Watcher: oldest check first. reverify also re-checks confirmed entries.
      result.watcher = await runDeathWatcher(staging, tf, {
        limit: Number(env.WATCHER_LIMIT || 20),
        delayMs: Number(env.WATCH_DELAY_MS ?? 800),
        filter: mode === "reverify" ? { source_check_version: { $ne: SOURCE_CHECK_VERSION } } : { death_status: "candidate" },
      });
      const w = result.watcher;
      await recordRun(state, result.run_id, { confirmed: w.confirmed, watched: w.watched, demoted: w.demoted, watcher_errors: w.errors });
      console.log(`Death Watcher ${result.run_id}: confirmed ${w.confirmed} of ${w.watched} watched, ${w.demoted} demoted, ${w.errors} errors`);
    }
  } finally {
    await client?.close();
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
