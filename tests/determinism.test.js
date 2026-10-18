import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runScreen } from "../prototype/core/pipeline.js";
import { GRAVEYARD_DB } from "../prototype/data/graveyard.js";
import { SAMPLE_IDEA, COHORT_IDEAS } from "../prototype/data/cohort.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const IDEAS = [
  SAMPLE_IDEA,
  "A marketplace for renting cameras between hobbyist photographers. Nobody does this well today.",
  "On-demand laundry pickup for busy professionals. The Indian laundry market is worth $9B. No app offers same-day return under ₹200.",
  ...COHORT_IDEAS.map(i => `${i.name}: ${i.desc}. ${i.claims.map(c => c.claim).join(". ")}.`),
];

test("same idea → byte-identical report (key-free path)", async () => {
  for (const idea of IDEAS) {
    const a = await runScreen(idea, { graveyard: GRAVEYARD_DB });
    const b = await runScreen(idea, { graveyard: GRAVEYARD_DB });
    assert.equal(JSON.stringify(a.report), JSON.stringify(b.report), idea.slice(0, 60));
  }
});

test("same idea → identical report even with providers present (fixed fakes)", async () => {
  const llmRoutes = { default: [{ name: "fake", model: "f", complete: async () => '{"claims":[],"types":[],"judgments":[],"objections":[]}' }] };
  const a = await runScreen(SAMPLE_IDEA, { graveyard: GRAVEYARD_DB, llmRoutes });
  const b = await runScreen(SAMPLE_IDEA, { graveyard: GRAVEYARD_DB, llmRoutes });
  assert.equal(JSON.stringify(a.report), JSON.stringify(b.report));
});

test("no Math.random() anywhere in the prototype or worker", () => {
  const offenders = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|mjs|html)$/.test(name) && /Math\.random\s*\(/.test(readFileSync(p, "utf8"))) offenders.push(p);
    }
  };
  for (const d of ["prototype", "worker"]) {
    try { walk(join(root, d)); } catch (err) { if (err.code !== "ENOENT") throw err; }
  }
  assert.deepEqual(offenders, []);
});
