// backend/src/backfill-causes.js: re-read each loot-drop page and store its real
// cause of death (the Failure Analysis card). Earlier ingests copied the first 400
// characters of the narrative instead. A page without the card leaves the cause
// empty ("searched_not_found"); nothing is invented.
//   node src/backfill-causes.js            # every loot-drop entry not yet backfilled
//   BACKFILL_LIMIT=100 node src/backfill-causes.js

import { MongoClient } from "mongodb";
import { envFrom } from "./db.js";
import { failureAnalysis } from "./ingest-lootdrop.js";

const env = { ...process.env, ...envFrom(".env") };
if (!env.MONGODB_URI) { console.error("MONGODB_URI not set"); process.exit(1); }
const LIMIT = Number(process.env.BACKFILL_LIMIT || 0);
const DELAY_MS = Number(process.env.INGEST_DELAY_MS || 1200);
const UA = "VistaDex-GraveyardBot/0.1 (research; contact: vistadex.team@gmail.com)";

async function getPage(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, signal: ctrl.signal });
      if (res.status === 404 || res.status === 410) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 3000 * attempt));
    } finally {
      clearTimeout(t);
    }
  }
}

const client = new MongoClient(env.MONGODB_URI);
await client.connect();
const staging = client.db(env.MONGODB_DB || "vistadex").collection("graveyard_staging");
const cursor = staging.find({ primary_source: "loot-drop.io", cause_backfilled_at: { $exists: false } }).sort({ _id: 1 });
if (LIMIT) cursor.limit(LIMIT);
const todo = await cursor.toArray();
console.log(`${todo.length} loot-drop entries to backfill`);

let found = 0, empty = 0, failed = 0;
for (const [i, e] of todo.entries()) {
  const url = e.source_urls.find(u => u.includes("loot-drop.io/startup/"));
  try {
    const html = url ? await getPage(url) : null;
    const cause = html ? failureAnalysis(html.replace(/<script[\s\S]*?<\/script>/gi, " ")) : "";
    await staging.updateOne({ _id: e._id }, { $set: {
      failure_reason: cause,
      "search_status.failure_reason": cause ? "found" : "searched_not_found",
      cause_backfilled_at: new Date(),
    } });
    cause ? found++ : empty++;
    console.log(`[${i + 1}/${todo.length}] ${e.company_name}: ${cause ? `cause (${cause.length} chars)` : html ? "no Failure Analysis card" : "page gone"}`);
  } catch (err) {
    failed++;
    console.log(`[${i + 1}/${todo.length}] ${e.company_name}: FAILED ${err.message} (retried next run)`);
  }
  await new Promise(r => setTimeout(r, DELAY_MS));
}
console.log(`\nDone: ${found} with a cause, ${empty} without, ${failed} failed`);
await client.close();
