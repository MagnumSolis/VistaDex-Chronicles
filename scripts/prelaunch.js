// ── prelaunch.js — Run before sharing the public link. Fails while blocking team decisions remain.
// Usage: npm run prelaunch   (not part of npm test on purpose: it is expected to fail until launch)
import { readFileSync } from "node:fs";
import { RETENTION_PERIOD, WITHDRAWAL_CONTACT, FEEDBACK, STUDY_VERSION } from "../prototype/ui/study-config.js";
import { CONFIG } from "../prototype/config.js";
import { GRAVEYARD_DB } from "../prototype/data/graveyard.js";

const open = [];
if (RETENTION_PERIOD.includes("TODO")) open.push("RETENTION_PERIOD is still a placeholder (prototype/ui/study-config.js)");
if (WITHDRAWAL_CONTACT.includes("TODO")) open.push("WITHDRAWAL_CONTACT is still a placeholder (prototype/ui/study-config.js)");
if (!FEEDBACK.signedOff) open.push("FEEDBACK.signedOff is false: feedback question wording not approved (prototype/ui/study-config.js)");
if (!CONFIG.PROXY_URL) open.push("PROXY_URL is empty: no live evidence and no server-side telemetry (prototype/config.js)");
const contract = JSON.parse(readFileSync(new URL("../tests/fixtures/event-contract.json", import.meta.url), "utf8"));
if (contract.study_version !== STUDY_VERSION) open.push(`STUDY_VERSION ${STUDY_VERSION} != contract ${contract.study_version}`);

// Warnings: worth fixing, but they do not block the launch.
const warnings = [];
// The live graveyard is the fleet's snapshot (every entry with 2 independent closure sources); the 18-entry
// offline seed only serves the key-free mock path.
const live = JSON.parse(readFileSync(new URL("../worker/data/graveyard.json", import.meta.url), "utf8"));
if (!(live.count > 0)) warnings.push("worker/data/graveyard.json is empty: live reports fall back to the 18-entry offline seed");
else console.log(`live graveyard: ${live.count} confirmed entries (exported ${live.exported_at ?? "?"})`);
const unverifiedSeed = GRAVEYARD_DB.filter(g => g.source_verified !== true).length;
if (unverifiedSeed) warnings.push(`offline seed (mock mode only): ${unverifiedSeed} of ${GRAVEYARD_DB.length} entries not checked by hand`);
// Open team decisions with a default in code (non-blocking). Every one is marked TODO(team) in the source.
const decisions = [
  "Big Tech \"low\" risk is undefined, so Big Tech safety is not counted in the VistaDex Score (prototype/core/scoring-config.js)",
  "minimum data for a VistaDex Score: 3 axes and half the weight (prototype/core/scoring-config.js)",
  "overlap band edges 0.3 / 0.5 / 3 competitors (prototype/core/scoring-config.js)",
  "Big Tech company list (prototype/core/scoring-config.js)",
  "demo category → industry mapping (web/src/lib/cohort.ts)",
  "pitch edition is unlocked client-side only (#edition=pitch); no separate pitch code is enforced by the Worker (web/src/edition.ts)",
  "opt-out policy: Welcome offers \"Use without recording\" (prototype/ui/study-config.js NOTICE)",
  "idea text is not stored in telemetry; the Worker trace keeps extracted claim text (prototype/ui/study-config.js NOTICE)",
  "no persistent server storage for reports: public reports live in the visitor's browser, pitch in memory + demo cohort (web/src/lib/reports.ts)",
  "graveyard entries have no cause category or country yet (docs/LAUNCH-PLAN.md P1-1)",
  "SAM and SOM are never produced: they need the founder's own assumptions",
  "graveyard match-strength wording bands 0.3 / 0.5 (web/src/lib/overlap.ts)",
  "course research data source for the retired study UI (web/src/retired/study/README.md)",
];
for (const d of decisions) warnings.push(`TODO(team): ${d}`);

console.log(`study_version ${STUDY_VERSION}`);
for (const w of warnings) console.warn(`warning: ${w}`);
if (open.length) { console.error("Not ready to launch:\n- " + open.join("\n- ")); process.exit(1); }
console.log("Ready to launch.");
