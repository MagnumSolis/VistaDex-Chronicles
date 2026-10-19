// ── scoring-config.js — Every weight and threshold behind the VistaDex Score, in one place ──
// Pinned by tests/scoring-config.test.js: changing a value here must be deliberate (update the test,
// How it works, and record it in docs/STUDY-NOTES.md). Scores are computed in code (scoring.js), never by a model.

// Weights of the VistaDex Score (re-normalised over the axes that have enough data).
export const WEIGHTS = Object.freeze({ novelty: 25, market: 20, defensibility: 20, graveyard: 15, evidence: 10, big_tech: 10 });

// TODO(team): define what a "low" Big Tech risk needs as evidence. Until then the live pipeline never
// outputs "low" and the Big Tech axis is shown but NOT counted in the VistaDex Score.
export const BIG_TECH_IN_SCORE = false;
export const BIG_TECH_SAFETY = Object.freeze({ low: 100, medium: 50, high: 0 });

// A VistaDex Score is shown only when at least this much data is available; otherwise "Not enough data".
// TODO(team): confirm.
export const MIN_SCORE_AXES = 3;
export const MIN_SCORE_WEIGHT_SHARE = 0.5; // of the weight of the axes that count towards the score

export const NOVELTY = Object.freeze({
  start: 100,
  perCompetitor: 12,          // per distinct competitor found …
  maxCompetitorsCounted: 5,   // … counting at most 5
  disputed: 15,               // per disputed novelty claim
  confirmed: 5,               // per confirmed novelty claim
  contradicted: 30,           // per contradicted novelty claim …
  contradictedCap: 40,        // … and then capped here
  noCompetitorsCap: 70,       // nothing found is not proof of novelty (absence never scores as a good result)
});

export const DEFENSIBILITY = Object.freeze({
  base: 50,
  moatBonus: 10,              // a stated moat is at most a +10 bonus
  moatMinChars: 20,
  confirmed: 15, disputed: 10, contradicted: 25, // per defensibility claim with that status
  moatObjection: Object.freeze({ high: 15, medium: 10, low: 5 }),
});

// Market: TAM on a log scale, $10M → 0, $1B or more → 100.
export const MARKET = Object.freeze({ tamFloorUsd: 1e7, tamCapUsd: 1e9 });

// Overlap band. TODO(team): tune.
export const OVERLAP = Object.freeze({ caution: 0.3, high: 0.5, highCompetitors: 3 });

// Big Tech companies the Big Tech risk search names. TODO(team): confirm the list.
export const BIG_TECH_COMPANIES = Object.freeze([
  "Alphabet/Google", "Microsoft", "Apple", "Amazon", "Meta", "Nvidia", "Salesforce", "Oracle", "IBM", "Adobe", "OpenAI",
]);
