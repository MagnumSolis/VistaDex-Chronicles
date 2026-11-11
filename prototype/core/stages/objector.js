// ── objector.js — Stage 4: arguments AGAINST the draft conclusion only ──
// The Objector never approves. With an LLM (stronger model), its output is
// filtered in code: anything that endorses, approves or gives a verdict is
// dropped, as is any severity outside high|medium|low. Deterministic objections
// derived from the computed counts are always available as the fallback.

import { parseWrapped, NoProviderAvailable } from "../providers/llm.js";
import { SEVERITIES } from "../contract.js";
import { registrableDomain } from "../evidence.js";

export const MAX_OBJECTIONS = 5;
export const HIGH_SIMILARITY = 0.35; // lexical scale; see graveyard.js

const APPROVAL = /\b(looks? (good|great|solid|promising)|is (a )?(good|great|strong|solid|promising|viable|sound) (idea|opportunity|bet|business)|i (would )?recommend|recommend (funding|investing|approval|approving|accepting)|should (be (funded|approved|accepted)|proceed|go ahead)|approve[ds]?\b|green[- ]light|no (major |real |significant )?(concerns|issues|risks)|well[- ]positioned|strong case for|verdict|overall,? (this|the idea) is)\b/i;

const OBJECTOR_PROMPT = `You are the Objector in an idea-screening pipeline. A human reviewer makes the decision; you never do.
Your ONLY job is to argue against the draft conclusion: find reasons the evidence, the claims or the idea could be wrong, weaker than it looks, or already tried.
Never approve, endorse, recommend, praise or give a verdict. Do not summarise strengths.
Ground every objection in the draft below (claims, statuses, graveyard leads) or in a gap in the evidence. Do not invent facts, numbers or companies.
Return a JSON object: {"objections": [{"objection": "...", "severity": "high|medium|low"}]}, at most ${MAX_OBJECTIONS} items. Never return a bare array.`;

export async function raiseObjections(ideaText, claims, matches, { llm, trace, competitors = [] }) {
  const draft = summarizeDraft(claims, matches, competitors);
  let objections = null;
  if (llm.available("objector")) {
    try {
      const { content, provider } = await llm.complete("objector", {
        json: true,
        temperature: 0,
        messages: [
          { role: "system", content: OBJECTOR_PROMPT },
          { role: "user", content: `Idea:\n${ideaText}\n\nDraft conclusion:\n${draft}` },
        ],
      });
      const raw = parseWrapped(content, "objections");
      if (raw) objections = filterObjections(raw, trace, provider);
      else trace.log("objector", { router: "llm", error: "malformed output (expected {\"objections\": [...]})" });
    } catch (err) {
      if (!(err instanceof NoProviderAvailable)) throw err;
    }
  }
  if (!objections || !objections.length) {
    objections = deterministicObjections(claims, matches, competitors);
    trace.log("objector", { router: llm.available("objector") ? "rules-fallback(llm-failed)" : "rules", count: objections.length });
  }
  const sorted = sortBySeverity(objections).slice(0, MAX_OBJECTIONS);
  for (const o of sorted) trace.log("objection", o);
  return sorted;
}

export function filterObjections(raw, trace, provider = "llm") {
  const kept = [];
  for (const o of raw) {
    const text = String(o?.objection ?? "").trim();
    let reason = null;
    if (!text) reason = "empty";
    else if (!SEVERITIES.includes(o?.severity)) reason = `invalid severity: ${o?.severity}`;
    else if (APPROVAL.test(text)) reason = "approves or gives a verdict";
    if (reason) trace?.log("objection_dropped", { provider, objection: text.slice(0, 200), reason });
    else kept.push({ objection: text, severity: o.severity });
  }
  trace?.log("objector", { router: "llm", provider, kept: kept.length, dropped: raw.length - kept.length });
  return kept;
}

export function deterministicObjections(claims, matches, competitors = []) {
  const out = [];
  if (competitors.length) {
    const names = competitors.slice(0, 3).map(c => c.name).join(", ");
    out.push({ severity: competitors.length >= 3 ? "high" : "medium", objection: `Fetched pages name ${competitors.length} product${competitors.length === 1 ? "" : "s"} already doing something similar (${names}${competitors.length > 3 ? ", …" : ""}). The idea has to say why buyers would switch.` });
  }
  const by = s => claims.filter(c => c.status === s);
  const contradicted = by("contradicted"), disputed = by("disputed"), unverified = by("unverified");

  for (const c of contradicted) {
    out.push({ severity: "high", objection: `Independent sources contradict the claim "${short(c.claim)}". If the idea depends on it, the premise does not hold as stated.` });
  }
  if (disputed.length) {
    out.push({ severity: "medium", objection: `${disputed.length} claim${disputed.length === 1 ? " has" : "s have"} independent sources on both sides (disputed). Disputed is not the same as supported; the reviewer should read both sides.` });
  }
  const top = matches[0];
  if (top) {
    out.push({
      severity: top.similarity >= HIGH_SIMILARITY ? "high" : "medium",
      objection: `This resembles ${top.company_name} (closed ${top.year_closed ?? "year unknown"}), whose cause of death was: "${top.cause_of_death}". The idea text does not explain why the same outcome would not repeat.`,
    });
  }
  const keyUnverified = unverified.filter(c => c.type === "novelty" || c.type === "market_size");
  if (unverified.length) {
    out.push({
      severity: keyUnverified.length ? "medium" : "low",
      objection: `${unverified.length} of ${claims.length} claim${claims.length === 1 ? " is" : "s are"} unverified — no independent evidence either way${keyUnverified.length ? `, including ${keyUnverified.length} novelty/market-size claim${keyUnverified.length === 1 ? "" : "s"}` : ""}. Treat ${unverified.length === 1 ? "it" : "them"} as open questions, not facts.`,
    });
  }
  if (!claims.length) {
    out.push({ severity: "medium", objection: "No checkable claims were found in the idea text, so nothing in it has been verified." });
  }
  out.push({ severity: "low", objection: "Retrieval covers publicly indexed web pages only. Patents, academic work, stealth startups and internal roadmaps are not searched; absence of contradicting evidence is not evidence of novelty." });
  return out;
}

// Independent sources (distinct registrable domains) on each side of a claim, as the status was computed.
function sideCounts(claim) {
  const side = stance => new Set((claim.evidence || []).filter(e => e.stance === stance).map(e => registrableDomain(e.url) || e.url)).size;
  return `(independent sources: ${side("supports")} support, ${side("contradicts")} contradict)`;
}

function summarizeDraft(claims, matches, competitors = []) {
  const lines = claims.map((c, i) => `${i + 1}. [${c.type}] [${c.status}] ${sideCounts(c)} ${c.claim}`);
  const leads = matches.map(m => `- ${m.company_name} (${m.year_closed}), similarity ${m.similarity}: ${m.cause_of_death}`);
  const comps = competitors.map(c => `- ${c.name}: ${c.why_similar}`);
  return `Claims:\n${lines.join("\n") || "(none)"}\n\nGraveyard leads:\n${leads.join("\n") || "(none)"}\n\nExisting products named on fetched pages:\n${comps.join("\n") || "(none)"}`;
}

function sortBySeverity(list) {
  const rank = { high: 0, medium: 1, low: 2 };
  return list.map((o, i) => [o, i]).sort((a, b) => rank[a[0].severity] - rank[b[0].severity] || a[1] - b[1]).map(([o]) => o);
}

function short(s) {
  return s.length > 110 ? `${s.slice(0, 107)}…` : s;
}
