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
const unverified = GRAVEYARD_DB.filter(g => g.source_verified !== true);
if (unverified.length) warnings.push(`${unverified.length} of ${GRAVEYARD_DB.length} graveyard entries have source_verified: false (${unverified.map(g => g.company_name).join(", ")})`);
warnings.push("Cannot check from here: Worker secret ACCESS_CODES is set, and the public link ends with #code=<code> (see docs/DEPLOY.md)");
// Open team decisions with a default in code (non-blocking). Every one is marked TODO(team) in the source.
const decisions = [
  "pitch edition is unlocked client-side only (#edition=pitch); no separate pitch code is enforced by the Worker (web/src/edition.ts)",
  "opt-out policy: Welcome offers \"Use without recording\" (prototype/ui/study-config.js NOTICE)",
  "idea text is not stored in telemetry; the Worker trace keeps extracted claim text (prototype/ui/study-config.js NOTICE)",
  "no persistent report storage: the pitch Dashboard shows the demo cohort + this session (web/src/lib/reports.ts)",
  "legal and market output not produced by the pipeline; per-source quotes not emitted (web/src/types.ts)",
  "graveyard seed has no business category or founding year (web/src/screens/Graveyard.tsx)",
  "graveyard match-strength bands 0.3 / 0.5 (web/src/lib/overlap.ts)",
  "official registry list for the Legal section (web/src/screens/HowItWorks.tsx)",
  "course research data source for the retired study UI (web/src/retired/study/README.md)",
];
for (const d of decisions) warnings.push(`TODO(team): ${d}`);

console.log(`study_version ${STUDY_VERSION}`);
for (const w of warnings) console.warn(`warning: ${w}`);
if (open.length) { console.error("Not ready to launch:\n- " + open.join("\n- ")); process.exit(1); }
console.log("Ready to launch.");
