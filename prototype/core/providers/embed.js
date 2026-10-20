// ── embed.js — Text similarity for graveyard matching ──
// Default: deterministic TF-IDF cosine over the local seed set (key-free).
// Slot for MiniLM: any object with similarities(query, docs) → number[] (0–1)
// can replace lexicalSimilarity, e.g. all-MiniLM-L6-v2 embeddings.

const STOP = new Set(("a an the and or of to in on for with is are was were be been that this it its our we they their at by as from than " +
  "into via who what which when where how can will would could should not no but so if about over under more most less very also just " +
  "app apps platform service startup company product tool users user people based").split(" "));

export function tokenize(text) {
  return (String(text).toLowerCase().match(/[a-z][a-z0-9-]+/g) || [])
    .flatMap(w => w.split("-"))
    .map(stem)
    .filter(w => w.length > 2 && !STOP.has(w));
}

// Tiny suffix stripper — enough to match "streaming"/"stream", "assistants"/"assistant".
function stem(w) {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export const lexicalSimilarity = {
  name: "tfidf-cosine",
  similarities(query, docs) {
    const docTokens = docs.map(tokenize);
    const qTokens = tokenize(query);
    const N = docs.length + 1;
    const df = new Map();
    for (const toks of [...docTokens, qTokens]) for (const t of new Set(toks)) df.set(t, (df.get(t) || 0) + 1);
    const vec = toks => {
      const tf = new Map();
      for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
      const v = new Map();
      for (const [t, n] of tf) v.set(t, n * Math.log((N + 1) / (df.get(t) + 0.5)));
      return v;
    };
    const q = vec(qTokens);
    return docTokens.map(toks => cosine(q, vec(toks)));
  },
};

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [, x] of a) na += x * x;
  for (const [t, y] of b) { nb += y * y; if (a.has(t)) dot += a.get(t) * y; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
