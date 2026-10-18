// ── graveyard.js — Stage 3: similarity against failed-startup entries ──
// Scores and thresholds are computed here; matches are leads, never verdicts.

import { lexicalSimilarity } from "../providers/embed.js";

// Calibrated for TF-IDF cosine on the seed set (18 entries; re-checked after removing BrightRoll and Timehop) (see tests/stages.test.js).
// Re-calibrate when switching to MiniLM embeddings — their scale is different.
export const MATCH_THRESHOLD = 0.15;
export const MAX_MATCHES = 3;

export function matchGraveyard(ideaText, graveyard, { similarity = lexicalSimilarity, trace } = {}) {
  const scores = similarity.similarities(ideaText, graveyard.map(g => g.what_they_tried));
  const ranked = graveyard
    .map((g, i) => ({ entry: g, score: Math.round(scores[i] * 100) / 100 }))
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  trace?.log("graveyard_scores", {
    method: similarity.name, threshold: MATCH_THRESHOLD,
    top: ranked.slice(0, 5).map(r => ({ id: r.entry.id, score: r.score })),
  });
  return ranked
    .filter(r => r.score >= MATCH_THRESHOLD)
    .slice(0, MAX_MATCHES)
    .map(r => ({
      company_name: r.entry.company_name,
      what_they_tried: r.entry.what_they_tried,
      cause_of_death: r.entry.cause_of_death,
      year_closed: r.entry.year_closed,
      similarity: r.score,
    }));
}
