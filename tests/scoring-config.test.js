// Pins every weight and threshold behind the scores. Changing one must be a deliberate decision:
// update this test, How it works and docs/STUDY-NOTES.md together.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as cfg from "../prototype/core/scoring-config.js";

test("scoring weights and thresholds are pinned", () => {
  assert.deepEqual({ ...cfg.WEIGHTS }, { novelty: 25, market: 20, defensibility: 20, graveyard: 15, evidence: 10, big_tech: 10 });
  assert.equal(cfg.BIG_TECH_IN_SCORE, false);
  assert.deepEqual({ ...cfg.BIG_TECH_SAFETY }, { low: 100, medium: 50, high: 0 });
  assert.equal(cfg.MIN_SCORE_AXES, 3);
  assert.equal(cfg.MIN_SCORE_WEIGHT_SHARE, 0.5);
  assert.deepEqual({ ...cfg.NOVELTY }, { start: 100, perCompetitor: 12, maxCompetitorsCounted: 5, disputed: 15, confirmed: 5, contradicted: 30, contradictedCap: 40, noCompetitorsCap: 70 });
  assert.deepEqual({ ...cfg.DEFENSIBILITY, moatObjection: { ...cfg.DEFENSIBILITY.moatObjection } },
    { base: 50, moatBonus: 10, moatMinChars: 20, confirmed: 15, disputed: 10, contradicted: 25, moatObjection: { high: 15, medium: 10, low: 5 } });
  assert.deepEqual({ ...cfg.MARKET }, { tamFloorUsd: 1e7, tamCapUsd: 1e9 });
  assert.deepEqual({ ...cfg.OVERLAP }, { caution: 0.3, high: 0.5, highCompetitors: 3 });
  assert.equal(cfg.BIG_TECH_COMPANIES.length, 11);
});

test("a stated moat is worth at most 10 points", () => {
  assert.ok(cfg.DEFENSIBILITY.moatBonus <= 10);
});
