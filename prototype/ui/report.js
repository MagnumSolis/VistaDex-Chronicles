// ── report.js — Renders a contract-shaped report (shared by modal + live run) ──

import { esc, safeHref } from "./escape.js";
import { independentSourceCount } from "../core/evidence.js";
import { CLAIM_STATUSES } from "../core/contract.js";

// Demo data stores scheme-less paths ("harvey.ai/pricing"); count their domains too.
export function sourceCount(urls) {
  return independentSourceCount((urls || []).map(u => (/^https?:\/\//i.test(u) ? u : `https://${u}`)));
}

export function statusCounts(claims) {
  const counts = Object.fromEntries(CLAIM_STATUSES.map(s => [s, 0]));
  for (const c of claims) counts[c.status] = (counts[c.status] || 0) + 1;
  return counts;
}

// Counts only — no overall verdict, no percentage. The human reviewer decides.
export function renderCountChips(report, { includeGraveyard = true } = {}) {
  const n = statusCounts(report.claims);
  const chip = (cls, label, value) => `<span class="count-chip ${cls}${value ? "" : " zero"}">${value} ${label}</span>`;
  return [
    chip("cc-contradicted", "contradicted", n.contradicted),
    chip("cc-disputed", "disputed", n.disputed),
    chip("cc-confirmed", "confirmed", n.confirmed),
    chip("cc-unverified", "unverified", n.unverified),
    includeGraveyard ? chip("cc-graveyard", report.graveyard_matches.length === 1 ? "graveyard lead" : "graveyard leads", report.graveyard_matches.length) : "",
  ].join("");
}

export function renderEvidenceLine(report) {
  const sources = report.claims.reduce((n, c) => n + sourceCount(c.source_urls), 0);
  return `${report.claims.length} claim${report.claims.length === 1 ? "" : "s"} checked · ${sources} independent source${sources === 1 ? "" : "s"} cited · a status needs ≥ 2 independent sources; it never comes from the model's own confidence`;
}

export function claimStatusBadge(status) {
  const map = {
    confirmed:    ["badge-clear",      "✅ Confirmed"],
    contradicted: ["badge-high-risk",  "❌ Contradicted"],
    disputed:     ["badge-caution",    "⚠️ Disputed"],
    unverified:   ["badge-unverified", "❓ Unverified"],
  };
  const [cls, label] = map[status] || ["badge-unverified", esc(status)];
  return `<span class="badge ${cls}" style="font-size:0.76rem;padding:3px 8px;">${label}</span>`;
}

function sourceChip(url) {
  const href = safeHref(url);
  return href
    ? `<a class="source-chip" href="${href}" target="_blank" rel="noopener noreferrer" data-source-url="${href}">🔗 ${esc(url)}</a>`
    : `<span class="source-chip" title="Not a checked link">🔗 ${esc(url)}</span>`;
}

export function renderClaims(claims) {
  return claims.map((c, i) => `
    <div class="claim-card" data-claim-index="${i}">
      <div class="claim-top">
        <span class="claim-type-tag type-${esc(c.type)}">${esc(c.type.replace("_", " "))}</span>
        ${claimStatusBadge(c.status)}
        <span class="source-count">${sourceCount(c.source_urls)} independent source${sourceCount(c.source_urls) === 1 ? "" : "s"}</span>
      </div>
      <div class="claim-text" style="margin-bottom:10px;">${esc(c.claim)}</div>
      <div class="claim-reasoning">${esc(c.reasoning)}</div>
      <div class="claim-sources">${(c.source_urls || []).map(sourceChip).join("")}</div>
    </div>`).join("");
}

export function renderGraveyardMatches(matches) {
  if (!matches.length) {
    return `<div style="color:var(--text-muted);font-size:0.875rem;text-align:center;padding:12px 0;">No close matches in the graveyard database.</div>`;
  }
  return matches.map(m => `
    <div class="ghost-card">
      <div class="ghost-top">
        <div>
          <div class="ghost-name">${esc(m.company_name)}</div>
          <div class="ghost-tried">${esc(m.what_they_tried)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <span class="ghost-year">${esc(m.year_closed ?? "")}</span>
          <span class="sim-badge" title="Word-overlap similarity between this idea and what they tried (0 = none, 1 = identical)">similarity ${m.similarity.toFixed(2)}</span>
        </div>
      </div>
      <div class="ghost-cod">
        <span class="cod-label">Cause:</span>
        <span class="cod-value">${esc(m.cause_of_death)}</span>
      </div>
      <div><span class="verify-label">⚠ verify yourself — not a verdict</span></div>
    </div>`).join("");
}

export function renderObjections(objections) {
  return objections.map(o => `
    <div class="objection-item">
      <div class="severity-dot sev-${esc(o.severity)}"></div>
      <div>
        <div class="severity-label sev-label-${esc(o.severity)}" style="margin-bottom:4px;">${esc(o.severity.toUpperCase())}</div>
        <div class="objection-text">${esc(o.objection)}</div>
      </div>
    </div>`).join("");
}

export function renderReportBody(report, { notesPlaceholder = "Add your own notes…" } = {}) {
  return `
    <div>
      <div class="section-title">Claim Verifier — ${report.claims.length} claims</div>
      ${renderClaims(report.claims)}
    </div>
    <div class="graveyard-panel">
      <div class="graveyard-header">
        <div class="graveyard-eyebrow">☠ Graveyard Matches (${report.graveyard_matches.length})</div>
        <div class="graveyard-hedge">leads to verify — never verdicts</div>
      </div>
      ${renderGraveyardMatches(report.graveyard_matches)}
    </div>
    <div class="objector-panel">
      <div class="objector-eyebrow">🔴 Objector Pass — arguments against this conclusion</div>
      ${renderObjections(report.objections)}
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:8px;">
      <div class="section-title">Reviewer Notes</div>
      <textarea class="notes-box" placeholder="${esc(notesPlaceholder)}"></textarea>
    </div>`;
}
