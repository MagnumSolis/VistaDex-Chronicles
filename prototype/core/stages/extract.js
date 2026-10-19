// ── extract.js — Stage 1: claim extraction + typing ──
// Splitting: LLM when available (atomic claims), otherwise deterministic sentence
// split. Typing: rules first; the LLM is asked only about claims the rules
// cannot type confidently. Every routing decision is traced.

import { typeClaim, isFalsifiable } from "../rules.js";
import { parseWrapped, NoProviderAvailable } from "../providers/llm.js";
import { CLAIM_TYPES } from "../contract.js";

export const MAX_CLAIMS = 8;
const MIN_CLAIM_CHARS = 20;
// An LLM-extracted claim must share at least this share of its content words
// with the idea text; otherwise it is treated as invented and dropped.
const MIN_GROUNDING = 0.5;

const EXTRACT_PROMPT = `Split the startup idea into atomic, falsifiable factual claims.
Rules:
- One checkable assertion per claim (about novelty, market size, defensibility, traction, pricing, regulation, etc.).
- Use the idea's own wording; do not add facts, numbers or companies that are not in the text.
- Skip pure descriptions of what the product does.
Return a JSON object: {"claims": [{"claim": "..."}]}. Never return a bare array.`;

const TYPE_PROMPT = `Type each claim as exactly one of: novelty, market_size, defensibility, traction, other.
novelty = nothing like this exists / first / only; market_size = size, growth or demand of a market;
defensibility = moats, barriers, why others cannot copy; traction = users, customers, revenue, pilots or growth
the company says it already has; other = anything else.
Return a JSON object: {"types": [{"index": 0, "type": "..."}]}. Never return a bare array.`;

export async function extractClaims(ideaText, { llm, trace }) {
  const candidates = await splitClaims(ideaText, { llm, trace });
  const claims = candidates.map(text => {
    const t = typeClaim(text);
    return { claim: text, type: t.type, _confident: t.confident, _hits: t.hits };
  });

  const uncertain = claims.map((c, i) => (c._confident ? null : i)).filter(i => i !== null);
  let llmTypes = {};
  if (uncertain.length && llm.available("extract")) {
    llmTypes = await typeWithLLM(uncertain.map(i => claims[i].claim), { llm, trace });
  }

  return claims.map((c, i) => {
    const pos = uncertain.indexOf(i);
    let router = "rules";
    let type = c.type;
    if (pos !== -1) {
      if (llmTypes[pos]) { type = llmTypes[pos]; router = "llm"; }
      else router = llm.available("extract") ? "rules-fallback(llm-failed)" : "rules-fallback(no-llm)";
    }
    trace.log("claim_typed", { claim: c.claim, type, router, rule_hits: c._hits });
    return { claim: c.claim, type };
  });
}

async function splitClaims(ideaText, { llm, trace }) {
  if (llm.available("extract")) {
    try {
      const { content } = await llm.complete("extract", {
        json: true,
        messages: [{ role: "system", content: EXTRACT_PROMPT }, { role: "user", content: ideaText }],
      });
      const raw = parseWrapped(content, "claims");
      if (raw) {
        const kept = [];
        for (const item of raw) {
          const text = clean(typeof item === "string" ? item : item?.claim);
          if (!text || text.length < MIN_CLAIM_CHARS) continue;
          const g = grounding(text, ideaText);
          if (g < MIN_GROUNDING) { trace.log("claim_dropped", { claim: text, reason: "not grounded in idea text", grounding: g }); continue; }
          kept.push(text);
        }
        trace.log("split", { router: "llm", claims: kept.length });
        if (kept.length) return dedupe(kept).slice(0, MAX_CLAIMS);
      } else {
        trace.log("split", { router: "llm", error: "malformed output (expected {\"claims\": [...]})" });
      }
    } catch (err) {
      if (!(err instanceof NoProviderAvailable)) throw err;
    }
  }
  return splitDeterministic(ideaText, trace);
}

export function splitDeterministic(ideaText, trace) {
  const sentences = ideaText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])|;\s+/)
    .map(clean)
    .filter(Boolean);
  const kept = [];
  for (const s of sentences) {
    if (s.length < MIN_CLAIM_CHARS) { trace?.log("claim_dropped", { claim: s, reason: "too short" }); continue; }
    if (!isFalsifiable(s)) { trace?.log("claim_dropped", { claim: s, reason: "descriptive, nothing checkable" }); continue; }
    kept.push(s);
  }
  trace?.log("split", { router: "rules", claims: kept.length });
  return dedupe(kept).slice(0, MAX_CLAIMS);
}

async function typeWithLLM(texts, { llm, trace }) {
  try {
    const { content } = await llm.complete("extract", {
      json: true,
      messages: [
        { role: "system", content: TYPE_PROMPT },
        { role: "user", content: texts.map((t, i) => `${i}. ${t}`).join("\n") },
      ],
    });
    const raw = parseWrapped(content, "types");
    if (!raw) { trace.log("typing", { router: "llm", error: "malformed output (expected {\"types\": [...]})" }); return {}; }
    const out = {};
    for (const r of raw) {
      if (Number.isInteger(r?.index) && r.index >= 0 && r.index < texts.length && CLAIM_TYPES.includes(r.type)) out[r.index] = r.type;
    }
    return out;
  } catch (err) {
    if (err instanceof NoProviderAvailable) return {};
    throw err;
  }
}

function clean(s) {
  return String(s ?? "").trim().replace(/^[-•*\d.)\s]+/, "").replace(/\s+/g, " ").replace(/[.;,\s]+$/, "");
}

function dedupe(list) {
  const seen = new Set();
  return list.filter(s => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

const STOP = new Set("a an the and or of to in on for with is are was be that this it its our we they their at by as from than".split(" "));
export function contentWords(s) {
  return String(s).toLowerCase().match(/[a-z0-9$%.]+/g)?.map(w => w.replace(/\.$/, "")).filter(w => w && !STOP.has(w)) || [];
}

function grounding(claim, source) {
  const words = contentWords(claim);
  if (!words.length) return 0;
  const pool = new Set(contentWords(source));
  return words.filter(w => pool.has(w)).length / words.length;
}
