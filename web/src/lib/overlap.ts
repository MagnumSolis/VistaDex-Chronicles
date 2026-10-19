// Words an idea and a graveyard entry have in common, using the pipeline's own tokenizer — the same
// word-overlap the matcher scores on (prototype/core/providers/embed.js). Shown so a lead explains itself.
import { tokenize } from "@proto/core/providers/embed.js";

export function sharedWords(ideaText: string, whatTheyTried: string, max = 8): string[] {
  const idea = new Set(tokenize(ideaText) as string[]);
  const seen = new Set<string>();
  for (const w of tokenize(whatTheyTried) as string[]) if (idea.has(w)) seen.add(w);
  return [...seen].slice(0, max);
}

// Plain match strength from the 0–1 word-overlap score. A description of the overlap, never a verdict.
// TODO(team): confirm the band edges (defaults below; the matcher's own threshold is 0.15).
export function matchStrength(similarity: number): "Strong" | "Moderate" | "Weak" {
  if (similarity >= 0.5) return "Strong";
  if (similarity >= 0.3) return "Moderate";
  return "Weak";
}
