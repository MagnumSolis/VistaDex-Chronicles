// backend/src/tinyfish-fleet.js — CLI: run the discovery fleet against staging.
import { runFleet } from "./fleet.js";
import { envFrom } from "./db.js";

const env = { ...process.env, ...envFrom(".env") };
if (!env.TINYFISH_API_KEY) { console.error("TINYFISH_API_KEY not set"); process.exit(1); }
if (!env.MONGODB_URI) { console.error("MONGODB_URI not set"); process.exit(1); }

const known = process.env.KNOWN_COMPANIES ? process.env.KNOWN_COMPANIES.split(",") : [];
runFleet({ apiKey: env.TINYFISH_API_KEY, mongoUri: env.MONGODB_URI, dbName: env.MONGODB_DB || "vistadex", knownCompanies: known })
  .then(r => console.log("Fleet done:", JSON.stringify(r)))
  .catch(e => { console.error(e); process.exit(1); });
