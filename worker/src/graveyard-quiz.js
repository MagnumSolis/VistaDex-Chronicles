// ── graveyard-quiz.js — Entries for the waiting-screen quiz, drawn from the live graveyard ──
// Each entry: { name, clue, year, cause }. The clue is the first sentence of what the startup tried, with
// the company's name replaced, so the answer is never in the question. Randomness comes from the caller
// (crypto in the Worker), never Math.random.

const MIN_CLUE = 25, MAX_CLUE = 180, MAX_CAUSE = 180;

export function firstSentence(text, max = MAX_CLUE) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  const s = m ? m[1] : t;
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : s;
}

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function maskName(text, name) {
  const variants = [name, name.replace(/\s*\(.*\)\s*/, ""), ...(/\(([^)]+)\)/.exec(name) || []).slice(1)].map(v => v.trim()).filter(v => v.length >= 2);
  let out = text;
  for (const v of variants) out = out.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escape(v)}(?![\\p{L}\\p{N}])`, "gu"), (m, pre) => `${pre}${pre === "" ? "This startup" : "this startup"}`);
  return out;
}

/** n entries for a quiz; rand() returns a number in [0, 1). */
export function quizPool(entries, n, rand) {
  const usable = [];
  for (const e of entries) {
    const name = String(e.company_name || "").trim();
    const year = Number(e.year_closed);
    if (name.length < 2 || name.length > 40 || !(year > 1990 && year <= new Date().getUTCFullYear())) continue;
    const clue = maskName(firstSentence(e.what_they_tried), name);
    const cause = firstSentence(e.cause_of_death, MAX_CAUSE);
    if (clue.length < MIN_CLUE || cause.length < 10 || clue.toLowerCase().includes(name.toLowerCase())) continue;
    usable.push({ name, clue, year, cause });
  }
  const out = [];
  while (out.length < n && usable.length) out.push(usable.splice(Math.floor(rand() * usable.length), 1)[0]);
  return out;
}
