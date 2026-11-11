// backend/src/extract-signals.js: turn raw graveyard_signals (search hits from News
// Scout and Post-Mortem Miner) into staging candidates.
// For each unprocessed signal: fetch the page (TinyFish Fetch), ask an LLM (Groq or
// Mistral, the pipeline's providers) which startups the page says shut down, then
// accept only what passes validateExtraction (schemas.js) and the source check
// (sources.js). New companies land as "candidate" citing the page; a company already
// in staging gains the page as a source. Nothing is confirmed here: the Death
// Watcher confirms only with 2 good sources.

import { createLLM, routesFromEnv, parseWrapped } from "../../prototype/core/providers/llm.js";
import { newGraveyardEntry, validateEntry, validateExtraction, companyKey, registrableDomain } from "./schemas.js";
import { sourceBlockReason, checkSourceText } from "./sources.js";

const PAGE_CHARS = 8000; // ~2k tokens: keeps each call inside free-tier per-minute limits
const MAX_PER_PAGE = 8;

const SYSTEM = `You read one web page and list the startups or companies that THIS PAGE says shut down, were acquired, or were dissolved.
Use only what the page states. Never add outside knowledge, never guess. If the page names no such company, return {"startups": []}.
Return JSON only: {"startups": [{"company_name": string, "what_they_tried": string, "cause_of_death": string, "year_closed": number|null, "evidence_quote": string}]}
- what_they_tried: one sentence, what the company built or sold, as the page describes it.
- cause_of_death: why it shut down, in the page's words; "" if the page gives no reason.
- year_closed: the year the page gives for the shutdown; null if it gives none.
- evidence_quote: one sentence copied exactly from the page that names the company and says it shut down.
At most ${MAX_PER_PAGE} companies.`;

export function makeExtractorLLM(env) {
  return createLLM(routesFromEnv(env));
}

// LLM content + the page it read → { entries, rejected }. Pure; no network.
export function parseExtraction(content, pageText, url) {
  const items = parseWrapped(content, "startups") || [];
  const entries = [], rejected = [], seen = new Set();
  for (const item of items.slice(0, MAX_PER_PAGE)) {
    const v = validateExtraction(item, pageText);
    const name = v.value.company_name;
    if (!v.ok) { rejected.push({ company_name: name, errors: v.errors }); continue; }
    const check = checkSourceText(pageText, name);
    if (!check.ok) { rejected.push({ company_name: name, errors: [`page check: ${check.reason}`] }); continue; }
    const key = companyKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = newGraveyardEntry({
      company_name: name,
      what_they_tried: v.value.what_they_tried,
      cause_of_death: v.value.cause_of_death,
      year_closed: v.value.year_closed,
      source_urls: [url],
      source: registrableDomain(url),
      searched_fields: ["failure_reason"],
    });
    const inv = validateEntry(entry);
    if (!inv.ok) { rejected.push({ company_name: name, errors: inv.errors }); continue; }
    Object.assign(entry, {
      company_key: key,
      source_checks: [{ url, ...check, checked_at: new Date() }],
      discovered_by: "signal-extractor",
      signal_url: url,
    });
    entries.push(entry);
  }
  return { entries, rejected };
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function runSignalExtraction({ signals, staging, tf, llm, limit = 10, delayMs = 0 }) {
  if (!llm?.available("extract")) return { skipped: "no-llm" };
  const counts = { signals: 0, created: 0, added_source: 0, rejected: 0, blocked: 0, fetch_failed: 0 };
  const todo = await signals.find({ extraction_status: { $exists: false } }).sort({ first_seen: 1, _id: 1 }).limit(limit).toArray();
  const mark = (s, status, extra = {}) => signals.updateOne({ _id: s._id }, { $set: { extraction_status: status, extracted_at: new Date(), ...extra } });

  const open = [];
  for (const s of todo) {
    const blocked = sourceBlockReason(s.url);
    if (blocked) { counts.blocked++; await mark(s, `blocked:${blocked}`); } else open.push(s);
  }
  for (let i = 0; i < open.length; i += 10) {
    const batch = open.slice(i, i + 10);
    const pages = await tf.fetchPages(batch.map(s => s.url)); // throws on TinyFish failure: signals stay unprocessed
    for (const s of batch) {
      const text = pages[s.url]?.content;
      if (!text || pages[s.url].error) { counts.fetch_failed++; await mark(s, "fetch-failed"); continue; }
      let content;
      try {
        ({ content } = await llm.complete("extract", {
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `URL: ${s.url}\n\n${text.slice(0, PAGE_CHARS)}` }],
          json: true, temperature: 0, maxTokens: 1500,
        }));
      } catch (e) {
        console.error(`  [extractor] LLM unavailable (${e.message.slice(0, 120)}); stopping, signals retried next run`);
        return counts;
      }
      counts.signals++;
      const { entries, rejected } = parseExtraction(content, text.slice(0, PAGE_CHARS), s.url);
      counts.rejected += rejected.length;
      for (const entry of entries) {
        const existing = await staging.findOne({ $or: [{ company_key: entry.company_key }, { company_name: { $regex: `^${escapeRe(entry.company_name)}$`, $options: "i" } }] });
        if (!existing) { await staging.insertOne(entry); counts.created++; continue; }
        if ((existing.source_urls || []).includes(s.url)) continue;
        await staging.updateOne({ _id: existing._id }, {
          $push: { source_urls: s.url, source_checks: entry.source_checks[0] },
          $set: { company_key: entry.company_key, updated_at: new Date() },
        });
        counts.added_source++;
      }
      console.log(`  [extractor] ${s.url.slice(0, 80)}: ${entries.length} candidate(s), ${rejected.length} rejected`);
      await mark(s, "done", { candidates: entries.map(e => e.company_name), rejected_items: rejected.length });
      if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return counts;
}
