import { test } from "node:test";
import assert from "node:assert/strict";
import { COHORT_IDEAS } from "../prototype/data/cohort.js";
import { independentSourceCount, MIN_INDEPENDENT } from "../prototype/core/evidence.js";

// Demo data must obey the same evidence rule as the pipeline: any status other than
// "unverified" needs at least two independent sources (disputed = at least one on each side).
test("no demo claim breaks the 2-independent-source rule", () => {
  const withScheme = u => (/^https?:\/\//.test(u) ? u : `https://${u}`);
  const bad = [];
  for (const idea of COHORT_IDEAS) {
    idea.claims.forEach((c, i) => {
      const n = independentSourceCount(c.source_urls.map(withScheme));
      if (c.status !== "unverified" && n < MIN_INDEPENDENT) bad.push(`${idea.id} claim ${i + 1}: ${c.status} with ${n} source(s)`);
    });
  }
  assert.deepEqual(bad, []);
});
