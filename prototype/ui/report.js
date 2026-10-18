// ── report.js — Renders a contract-shaped report (shared by modal + live run) ──

import { esc, safeHref } from "./escape.js";

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
          <span class="sim-badge">~${Math.round(m.similarity * 100)}% similar</span>
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
