// backend/src/sync-research.js — durable research archive: D1 events → MongoDB Atlas.
// The Worker's export endpoint returns all telemetry (feedback, surveys, registrations
// included). This command pulls it and upserts the qualitative corpus into Atlas
// (database: research_data, collection: qualitative) so the team has the study data
// in Mongo alongside the graveyard — queryable with Compass, backed up with the
// paper artifacts. Run from the laptop (Mongo port 27017 is reachable there):
//
//   cd backend && npm run research:sync
//
// Needs in .env: MONGODB_URI (existing Graveyard01 string). Optionally
// RESEARCH_EXPORT_TOKEN + RESEARCH_EXPORT_URL (defaults to the deployed proxy).
import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
import { envFrom } from "./db.js";

const env = { ...process.env, ...envFrom(".env") };
const MONGO_URI = env.MONGODB_URI;
const TOKEN = env.RESEARCH_EXPORT_TOKEN;
const BASE = env.RESEARCH_EXPORT_URL || "https://vistadex-proxy.vistadex-team.workers.dev";
const QUALITATIVE_TYPES = new Set(["feedback_submitted", "condition_survey", "participant_registered", "run_scoped_survey", "comprehension_check"]);

if (!MONGO_URI) { console.error("MONGODB_URI not set (backend/.env)"); process.exit(1); }
if (!TOKEN) { console.error("RESEARCH_EXPORT_TOKEN not set (backend/.env) — the researcher export token from the Worker secrets"); process.exit(1); }

async function fetchEvents() {
  const res = await fetch(`${BASE}/export?table=events`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  if (res.status === 401) throw new Error("unauthorized — check RESEARCH_EXPORT_TOKEN");
  if (!res.ok) throw new Error(`export failed: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  console.log("→ pulling telemetry from the Worker export…");
  const events = await fetchEvents();
  console.log(`  ${events.length} events total`);

  const qualitative = events.filter(e => QUALITATIVE_TYPES.has(e.type));
  console.log(`  ${qualitative.length} qualitative events (feedback / surveys / registrations / comprehension)`);

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const coll = client.db("research_data").collection("qualitative");

  // Idempotent upsert: (session_id, seq, type) identifies an event uniquely.
  let written = 0;
  for (const e of qualitative) {
    await coll.updateOne(
      { session_id: e.session_id, seq: e.seq, type: e.type },
      { $set: {
        session_id: e.session_id,
        seq: e.seq,
        ts: e.ts,
        type: e.type,
        study_version: e.study_version || null,
        payload: typeof e.payload === "string" ? JSON.parse(e.payload) : (e.payload || {}),
        received_at: e.received_at,
        archived_at: new Date().toISOString(),
      }},
      { upsert: true }
    );
    written++;
  }

  // Also archive a full snapshot of ALL events for the paper (events_all collection)
  const allColl = client.db("research_data").collection("events_all");
  for (const e of events) {
    await allColl.updateOne(
      { session_id: e.session_id, seq: e.seq },
      { $set: {
        session_id: e.session_id, seq: e.seq, ts: e.ts, type: e.type,
        study_version: e.study_version || null,
        payload: typeof e.payload === "string" ? JSON.parse(e.payload) : (e.payload || {}),
        received_at: e.received_at,
        archived_at: new Date().toISOString(),
      }},
      { upsert: true }
    );
  }

  const qCount = await coll.countDocuments();
  const aCount = await allColl.countDocuments();
  console.log(`✓ Atlas research_data: ${written} qualitative upserted (collection now ${qCount}), full archive ${aCount} events`);
  console.log("  View in Atlas → Browse Collections → research_data.qualitative / events_all");
  await client.close();
}

main().catch(e => { console.error("✗", e.message); process.exit(1); });
