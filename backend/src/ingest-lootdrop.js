// backend/src/ingest-lootdrop.js — ingest loot-drop.io's public graveyard.
// Compliance: robots.txt allows /startup/<id>-<slug> pages (only /startup.html is
// disallowed); we crawl the official sitemap, rate-limit politely, and record
// loot-drop.io as the cited source. Loot Drop's own content is AI-assisted
// summaries of public sources — so entries land in STAGING as "candidate"
// deaths, never auto-published as confirmed (AGENTS.md rule 7).

import { MongoClient } from "mongodb";
import { newGraveyardEntry, validateEntry } from "./schemas.js";
import { envFrom } from "./db.js";

const env = { ...process.env, ...envFrom(".env") };
const MONGO_URI = env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "vistadex";
const SITEMAP = "https://www.loot-drop.io/sitemap.xml";
const DELAY_MS = Number(process.env.INGEST_DELAY_MS || 1200); // polite crawl rate
const LIMIT = Number(process.env.INGEST_LIMIT || 0); // 0 = all

// ── HTML parsing (no DOM dependency; pages are static and well-structured) ──
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function stripTags(html) { return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim(); }

export function parseStartupPage(html, url) {
  const title = decodeEntities((html.match(/<title>([^<]*)<\/title>/)?.[1] || ""));
  const companyName = title.split("|")[0].trim();

  // stat-box pattern: <span class="stat-label">LABEL</span><span class="stat-value">VALUE</span>
  const stat = (label) => {
    const re = new RegExp(`stat-label">${label}<\\/span>\\s*<span class="stat-value">([^<]*)<`, "i");
    return html.match(re)?.[1]?.trim() || null;
  };

  const sector = stat("SECTOR");
  const productType = stat("PRODUCT TYPE");
  const burned = stat("TOTAL CASH BURNED");
  const endYear = stat("END YEAR");

  // Country: pages render flags as \USA-style codes near the title
  const country = html.match(/\\\\([A-Z]{2,3})\b/)?.[1] || null;

  // First substantive <p> = "what they tried" narrative
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const paras = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map(m => stripTags(m[1]))
    .filter(p => p.length > 80);
  const narrative = paras.find(p => !/^Humane died/i.test(p) && !/Failure Analysis/i.test(p)) || paras[0] || "";

  // Failure Analysis section (first paragraph after the heading)
  const fa = body.match(/Failure Analysis<\/[a-z]+>\s*<[a-z]+>([^<]{30,})/i)?.[1];
  const failureAnalysis = fa ? stripTags(fa) : "";

  return {
    company_name: companyName,
    what_they_tried: narrative.slice(0, 900),
    cause_of_death: (failureAnalysis || narrative.slice(0, 400)).slice(0, 600),
    cause_category: "other", // Loot Drop's 7 antipatterns map later via tagger
    year_closed: endYear ? Number(endYear) : null,
    raised: burned, // "TOTAL CASH BURNED" is the closest public funding figure
    sector, product_type: productType, country,
    source_urls: [url],
    source: "loot-drop.io",
  };
}

async function fetchSitemapUrls() {
  const res = await fetchWithTimeout(SITEMAP, { headers: { "user-agent": "VistaDex-GraveyardBot/0.1 (research; contact: vistadex.team@gmail.com)" } }, 30000);
  if (!res.ok) throw new Error(`sitemap ${res.status}`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>(https:\/\/www\.loot-drop\.io\/startup\/[^<]+)<\/loc>/g)].map(m => m[1]);
  return urls;
}

async function fetchWithTimeout(url, opts = {}, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  if (!MONGO_URI) {
    console.error("MONGODB_URI not set — aborting. Put it in .env (gitignored).");
    process.exit(1);
  }
  const urls = await fetchSitemapUrls();
  console.log(`Sitemap: ${urls.length} startup pages${LIMIT ? ` (limiting to ${LIMIT})` : ""}`);
  const targets = LIMIT ? urls.slice(0, LIMIT) : urls;

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const staging = client.db(env.MONGODB_DB || DB_NAME).collection("graveyard_staging");

  let ok = 0, failed = 0, skipped = 0;
  for (const [i, url] of targets.entries()) {
    const slug = url.split("/startup/")[1];
    process.stdout.write(`[${i + 1}/${targets.length}] ${slug} … `);
    const existing = await staging.findOne({ source_urls: url }).catch(e => { throw new Error(`mongo findOne failed: ${e.message}`); });
    if (existing) { skipped++; console.log("skip (already present)"); continue; }
    try {
      const res = await fetchWithTimeout(url, { headers: { "user-agent": "VistaDex-GraveyardBot/0.1 (research; contact: vistadex.team@gmail.com)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parsed = parseStartupPage(html, url);
      const entry = newGraveyardEntry(parsed);
      const v = validateEntry(entry);
      if (!v.ok) throw new Error(`invariants: ${v.errors.join("; ")}`);
      if (!entry.company_name || entry.company_name.toLowerCase() === "loot drop") throw new Error("unparseable name");
      await staging.updateOne(
        { company_name: entry.company_name, year_closed: entry.year_closed },
        { $set: entry },
        { upsert: true }
      ).catch(e => { throw new Error(`mongo write failed: ${e.message}`); });
      ok++;
      console.log(`ok — ${entry.company_name} (${entry.year_closed})`);
    } catch (e) {
      failed++;
      console.log(`FAILED: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  console.log(`\nDone: ${ok} ingested, ${skipped} skipped (already present), ${failed} failed`);
  await client.close();
}

// Allow import for tests without running
if (process.argv[1] && process.argv[1].endsWith("ingest-lootdrop.js")) {
  main().catch(e => { console.error(e); process.exit(1); });
}
