// backend/src/fleet-report.js: CLI. Prints this run's discovery numbers, the totals and
// the recent trend from fleet_state, and adds them to the GitHub job summary.
import { appendFileSync } from "fs";
import { MongoClient } from "mongodb";
import { envFrom } from "./db.js";
import { formatReport, runId } from "./fleet-metrics.js";

const env = { ...process.env, ...envFrom(".env") };
const client = new MongoClient(env.MONGODB_URI);
await client.connect();
try {
  const doc = await client.db(env.MONGODB_DB || "vistadex").collection("fleet_state").findOne({ _id: "metrics" });
  const md = formatReport(doc, runId(env));
  console.log(md);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${md}\n`);
} finally {
  await client.close();
}
