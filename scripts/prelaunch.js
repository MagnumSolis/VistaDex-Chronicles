// ── prelaunch.js — Run before sharing the participant link. Fails while open team decisions remain.
// Usage: npm run prelaunch   (not part of npm test on purpose: it is expected to fail until launch)
import { readFileSync } from "node:fs";
import { RETENTION_PERIOD, WITHDRAWAL_CONTACT, SURVEY, STUDY_VERSION } from "../prototype/ui/study-config.js";
import { CONFIG } from "../prototype/config.js";
import { GRAVEYARD_DB } from "../prototype/data/graveyard.js";

const open = [];
if (RETENTION_PERIOD.includes("TODO")) open.push("RETENTION_PERIOD is still a placeholder (prototype/ui/study-config.js)");
if (WITHDRAWAL_CONTACT.includes("TODO")) open.push("WITHDRAWAL_CONTACT is still a placeholder (prototype/ui/study-config.js)");
if (!SURVEY.signedOff) open.push("SURVEY.signedOff is false: survey items not approved (prototype/ui/study-config.js)");
if (!CONFIG.PROXY_URL) open.push("PROXY_URL is empty: no live evidence and no server-side telemetry (prototype/config.js)");
const contract = JSON.parse(readFileSync(new URL("../tests/fixtures/event-contract.json", import.meta.url), "utf8"));
if (contract.study_version !== STUDY_VERSION) open.push(`STUDY_VERSION ${STUDY_VERSION} != contract ${contract.study_version}`);

// Warnings: worth fixing, but they do not block the launch.
const warnings = [];
const unverified = GRAVEYARD_DB.filter(g => g.source_verified !== true);
if (unverified.length) warnings.push(`${unverified.length} of ${GRAVEYARD_DB.length} graveyard entries have source_verified: false (${unverified.map(g => g.company_name).join(", ")})`);
warnings.push("Cannot check from here: Worker secret ACCESS_CODES is set, and the participant link ends with #code=<code> (see docs/DEPLOY.md)");

console.log(`study_version ${STUDY_VERSION}`);
for (const w of warnings) console.warn(`warning: ${w}`);
if (open.length) { console.error("Not ready to launch:\n- " + open.join("\n- ")); process.exit(1); }
console.log("Ready to launch.");
