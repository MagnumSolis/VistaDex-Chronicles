// worker/graveyard.js — Stage 3 graveyard matching.
// STOPGAP: in-app cosine-similarity over token-set vectors of the local 20-entry
// graveyard corpus. Production replaces this with all-MiniLM-L6-v2 embeddings +
// MongoDB Atlas $vectorSearch. The function signature here mirrors that future call.

const STOPWORDS = new Set(["the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "that", "this", "is", "are", "was", "were", "be", "by", "at", "as", "it", "its", "their", "our", "your", "we", "us", "they", "them", "from", "into", "using", "via", "per"]);

export function tokenize(text) {
  return String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function vec(text) {
  const v = new Map();
  for (const t of tokenize(text)) v.set(t, (v.get(t) || 0) + 1);
  return v;
}

export function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, x] of a) { na += x * x; if (b.has(k)) dot += x * b.get(k); }
  for (const [, y] of b) nb += y * y;
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function matchGraveyard(ideaText, graveyardDb, { topK = 3, minSimilarity = 0.18 } = {}) {
  const ideaVec = vec(ideaText);
  return graveyardDb
    .map(entry => {
      const sim = cosineSimilarity(ideaVec, vec(`${entry.company_name} ${entry.what_they_tried} ${entry.cause_of_death}`));
      return {
        company_name: entry.company_name,
        what_they_tried: entry.what_they_tried,
        cause_of_death: entry.cause_of_death,
        year_closed: entry.year_closed,
        similarity: Math.round(sim * 100),
        _raw: sim,
      };
    })
    .filter(m => m._raw >= minSimilarity)
    .sort((a, b) => b._raw - a._raw)
    .slice(0, topK)
    .map(({ _raw, ...m }) => m);
}
