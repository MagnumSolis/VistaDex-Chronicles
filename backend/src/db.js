// backend/src/db.js — Mongo connection + stats + publish (staging → graveyard).
// "publish" copies validated, confirmed entries into the live graveyard collection.

import { MongoClient } from "mongodb";
import { validateEntry } from "./schemas.js";

// minimal .env loader for local runs (keys never in git)
import { readFileSync } from "fs";
export function envFrom(file = ".env") {
  const out = {};
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {}
  return out;
}

async function connect() {
  const env = { ...process.env, ...envFrom(".env") };
  const uri = env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set (backend/.env)");
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db(env.MONGODB_DB || "vistadex") };
}

async function stats() {
  const { client, db } = await connect();
  const staging = db.collection("graveyard_staging");
  const live = db.collection("graveyard");
  console.log("staging:", await staging.countDocuments({}), "candidates:", await staging.countDocuments({ death_status: "candidate" }), "confirmed:", await staging.countDocuments({ death_status: "confirmed" }));
  console.log("live graveyard:", await live.countDocuments({}));
  await client.close();
}

async function publish() {
  const { client, db } = await connect();
  const staging = db.collection("graveyard_staging");
  const live = db.collection("graveyard");
  const confirmed = staging.find({ death_status: "confirmed" });
  let n = 0, blocked = 0;
  for await (const entry of confirmed) {
    const v = validateEntry(entry);
    if (!v.ok) { blocked++; console.error(`✗ ${entry.company_name}: ${v.errors.join("; ")}`); continue; }
    await live.updateOne({ company_name: entry.company_name, year_closed: entry.year_closed }, { $set: { ...entry, published_at: new Date() } }, { upsert: true });
    n++;
  }
  console.log(`Published ${n} entries (${blocked} blocked by invariants)`);
  await client.close();
}

const cmd = process.argv[2];
if (process.argv[1] && process.argv[1].endsWith("db.js")) {
  if (cmd === "stats") stats().catch(e => { console.error(e.message); process.exit(1); });
  else if (cmd === "publish") publish().catch(e => { console.error(e.message); process.exit(1); });
  else console.log("usage: node src/db.js stats|publish");
}
