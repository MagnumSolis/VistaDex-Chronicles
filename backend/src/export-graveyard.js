// backend/src/export-graveyard.js — sync confirmed graveyard entries to a JSON
// file the Cloudflare Worker serves. Mongo stays the system of record; the
// deployed app reads the exported snapshot (no Mongo access needed at the edge).
// Run this from a machine with network access to Atlas (e.g. the laptop):
//   MONGODB_URI=... npm run db:export

import { MongoClient } from "mongodb";
import { writeFileSync, mkdirSync } from "fs";
import { envFrom } from "./db.js";

const env = { ...process.env, ...envFrom(".env") };
if (!env.MONGODB_URI) { console.error("MONGODB_URI not set"); process.exit(1); }

const client = new MongoClient(env.MONGODB_URI);
await client.connect();
const db = client.db(env.MONGODB_DB || "vistadex");

const staging = db.collection("graveyard_staging");
const confirmed = await staging.find({ death_status: "confirmed" }).sort({ year_closed: -1 }).toArray();

const entries = confirmed.map(e => ({
  company_name: e.company_name,
  what_they_tried: e.what_they_tried,
  cause_of_death: e.failure_reason || e.cause_of_death,
  cause_category: e.cause_category,
  year_closed: e.year_closed,
  closure_date: e.closure_date,
  raised: e.raised,
  funding_rounds: e.funding_rounds,
  sector: e.sector,
  product_type: e.product_type,
  country: e.country,
  registry_record: e.registry_record,
  source_urls: e.source_urls,
  source_verified: e.source_verified,
}));

mkdirSync("../worker/data", { recursive: true });
writeFileSync("../worker/data/graveyard.json", JSON.stringify({
  exported_at: new Date().toISOString(),
  count: entries.length,
  entries,
}, null, 2));

console.log(`Exported ${entries.length} confirmed entries → worker/data/graveyard.json`);
console.log("Commit that file and redeploy the Worker to serve the live data.");
await client.close();
