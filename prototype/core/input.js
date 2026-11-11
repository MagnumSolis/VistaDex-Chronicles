// ── input.js — Structured idea input → the idea_text the stages read ──
// The form collects title, pitch, problem, solution and moat (plus industries, role and markets).
// The stages keep working on one text: buildIdeaText joins the five text fields in that order.
// Per-field limits add up to MAX_IDEA_CHARS (6,000), the Worker's limit on the combined text.

export const MAX_IDEA_CHARS = 6000;
export const FIELD_LIMITS = { title: 120, pitch: 280, problem: 1600, solution: 2000, moat: 2000 };
export const REQUIRED_FIELDS = ["title", "pitch", "problem", "solution"];
export const TEXT_FIELDS = ["title", "pitch", "problem", "solution", "moat"];

export const INDUSTRIES = [
  "AI/ML", "SaaS/B2B", "Fintech", "Healthtech", "Edtech", "Consumer", "E-commerce",
  "Climate/Energy", "Mobility", "Agritech", "Deeptech/Hardware", "Media/Creator", "Other",
];
export const ROLES = ["founder", "investor", "accelerator", "student", "other"];
export const MARKETS = ["EU", "USA", "India"];

// Coerce anything into the input shape; unknown list values are dropped, text is trimmed and cut to its limit.
export function normalizeInput(raw = {}) {
  const text = k => String(raw?.[k] ?? "").replace(/\s+/g, " ").trim().slice(0, FIELD_LIMITS[k]);
  const list = (v, allowed) => [...new Set((Array.isArray(v) ? v : []).filter(x => allowed.includes(x)))];
  return {
    title: text("title"), pitch: text("pitch"), problem: text("problem"), solution: text("solution"), moat: text("moat"),
    industries: list(raw?.industries, INDUSTRIES),
    role: ROLES.includes(raw?.role) ? raw.role : null,
    markets: list(raw?.markets, MARKETS),
  };
}

// → [{ field, message }] ; empty means valid.
export function validateInput(input) {
  const errs = [];
  for (const f of REQUIRED_FIELDS) if (!String(input?.[f] ?? "").trim()) errs.push({ field: f, message: "required" });
  for (const f of TEXT_FIELDS) if (String(input?.[f] ?? "").length > FIELD_LIMITS[f]) errs.push({ field: f, message: `longer than ${FIELD_LIMITS[f]} characters` });
  return errs;
}

const sentence = s => (/[.!?]$/.test(s) ? s : `${s}.`);

// "Title. Pitch. Problem. Solution. Moat." — empty fields are skipped.
export function buildIdeaText(input) {
  return TEXT_FIELDS.map(f => String(input?.[f] ?? "").trim()).filter(Boolean).map(sentence).join(" ");
}
