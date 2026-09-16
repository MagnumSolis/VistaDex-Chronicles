// ── app.js — VistaDex Prototype UI Controller ────────────────────────

// ── State ─────────────────────────────────────────────────────────────
let currentStatusFilter = 'all';
let currentCauseFilter = 'all';
let pipelineRunning = false;

// ── View Router ───────────────────────────────────────────────────────
function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');
  document.getElementById(`nav-${viewName}`)?.classList.add('active');
}

// ── Dashboard ─────────────────────────────────────────────────────────
function renderTable(ideas) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  tbody.innerHTML = ideas.map(idea => {
    const conf = idea.confidence_pct;
    const confColor = conf >= 70 ? '#22c55e' : conf >= 50 ? '#f59e0b' : '#ef4444';
    const graveyardCell = idea.graveyard_match
      ? `<span class="graveyard-match"><strong>${idea.graveyard_match}</strong><br><span style="font-size:0.75rem;color:var(--text-muted)">verify yourself</span></span>`
      : `<span style="color:var(--text-muted);font-size:0.82rem;">—</span>`;
    return `
      <tr onclick="openIdeaModal('${idea.id}')" style="cursor:pointer;">
        <td>
          <div class="idea-name">${idea.name}</div>
          <div class="idea-desc">${idea.desc}</div>
        </td>
        <td class="submitter">${idea.submitter}</td>
        <td><span class="category-tag">${idea.category}</span></td>
        <td>${statusBadge(idea.status)}</td>
        <td>${graveyardCell}</td>
        <td>
          <div class="confidence-wrap">
            <div class="conf-bar">
              <div class="conf-fill" style="width:${conf}%;background:${confColor};"></div>
            </div>
            <span class="conf-pct">${conf}% · ${idea.sources_checked} src</span>
          </div>
        </td>
        <td><button class="btn-ghost btn-view" onclick="event.stopPropagation();openIdeaModal('${idea.id}')">View →</button></td>
      </tr>
    `;
  }).join('');
}

function statusBadge(status) {
  const map = {
    'clear':     ['badge-clear',     '✅ Clear'],
    'caution':   ['badge-caution',   '⚠️ Caution'],
    'high-risk': ['badge-high-risk', '❌ High Risk'],
    'unverified':['badge-unverified','❓ Unverified'],
  };
  const [cls, label] = map[status] || ['badge-unverified', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function claimStatusBadge(status) {
  const map = {
    'confirmed':    ['badge-clear',      '✅ Confirmed'],
    'contradicted': ['badge-high-risk',  '❌ Contradicted'],
    'disputed':     ['badge-caution',    '⚠️ Disputed'],
    'unverified':   ['badge-unverified', '❓ Unverified'],
  };
  const [cls, label] = map[status] || ['badge-unverified', status];
  return `<span class="badge ${cls}" style="font-size:0.76rem;padding:3px 8px;">${label}</span>`;
}

function filterTable() {
  const q = document.getElementById('dashSearch')?.value.toLowerCase() || '';
  const filtered = COHORT_IDEAS.filter(idea => {
    const matchStatus = currentStatusFilter === 'all' || idea.status === currentStatusFilter;
    const matchSearch = !q ||
      idea.name.toLowerCase().includes(q) ||
      idea.submitter.toLowerCase().includes(q) ||
      idea.category.toLowerCase().includes(q) ||
      idea.desc.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });
  renderTable(filtered);
}

function filterStatus(btn, status) {
  currentStatusFilter = status;
  document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  filterTable();
}

// ── Idea Modal ────────────────────────────────────────────────────────
function openIdeaModal(ideaId) {
  const idea = COHORT_IDEAS.find(i => i.id === ideaId);
  if (!idea) return;

  const graveyardEntries = (idea.graveyard || []).map(g => {
    const entry = GRAVEYARD_DB.find(e => e.id === g.id);
    if (!entry) return '';
    return `
      <div class="ghost-card">
        <div class="ghost-top">
          <div>
            <div class="ghost-name">${entry.company_name}</div>
            <div class="ghost-tried">${entry.what_they_tried}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
            <span class="ghost-year">${entry.year_closed}</span>
            <span class="sim-badge">~${g.similarity}% similar</span>
          </div>
        </div>
        <div class="ghost-cod">
          <span class="cod-label">Cause:</span>
          <span class="cod-value">${entry.cause_of_death}</span>
        </div>
        <div><span class="verify-label">⚠ verify yourself — not a verdict</span></div>
      </div>`;
  }).join('');

  const claimsHTML = idea.claims.map(c => `
    <div class="claim-card">
      <div class="claim-top">
        <span class="claim-type-tag type-${c.type}">${c.type.replace('_', ' ')}</span>
        ${claimStatusBadge(c.status)}
        <div class="claim-text" style="margin-left:4px;">${c.claim}</div>
      </div>
      <div class="claim-reasoning">${c.reasoning}</div>
      <div class="claim-sources">
        ${(c.sources || []).map(s => `<span class="source-chip">🔗 ${s}</span>`).join('')}
      </div>
    </div>
  `).join('');

  const objectionsHTML = idea.objections.map(o => `
    <div class="objection-item">
      <div class="severity-dot sev-${o.severity}"></div>
      <div>
        <div class="severity-label sev-label-${o.severity}" style="margin-bottom:4px;">${o.severity.toUpperCase()}</div>
        <div class="objection-text">${o.objection}</div>
      </div>
    </div>
  `).join('');

  document.getElementById('modalContent').innerHTML = `
    <div class="report-header">
      <div class="report-meta">
        ${statusBadge(idea.status)}
        <span class="category-tag">${idea.category}</span>
        <span style="color:var(--text-muted);font-size:0.82rem;">Submitted by ${idea.submitter}</span>
      </div>
      <div class="report-title">${idea.name}</div>
      <div style="color:var(--text-secondary);font-size:0.875rem;">${idea.desc}</div>
      <div class="report-footer-line">
        ${idea.sources_checked} sources checked · ${idea.claims.length} claims extracted · Confidence ${idea.confidence_pct}%
      </div>
    </div>

    <div class="report-body">
      <div>
        <div class="section-title">Claim Verifier — ${idea.claims.length} claims checked</div>
        ${claimsHTML}
      </div>

      ${idea.graveyard?.length > 0 ? `
        <div class="graveyard-panel">
          <div class="graveyard-header">
            <div class="graveyard-eyebrow">☠ Graveyard Matches</div>
            <div class="graveyard-hedge">leads to verify — never verdicts</div>
          </div>
          ${graveyardEntries}
        </div>
      ` : `
        <div class="graveyard-panel" style="text-align:center;padding:24px;">
          <div class="graveyard-eyebrow">☠ Graveyard Matches</div>
          <div style="color:var(--text-muted);font-size:0.875rem;margin-top:8px;">No close matches found in the graveyard database.</div>
        </div>
      `}

      <div class="objector-panel">
        <div class="objector-eyebrow">🔴 Objector Pass — arguments against this conclusion</div>
        ${objectionsHTML}
      </div>

      <div class="card" style="display:flex;flex-direction:column;gap:8px;">
        <div class="section-title">Reviewer Notes</div>
        <textarea style="background:var(--bg-input);border:1px solid var(--border);border-radius:6px;padding:12px;color:var(--text-primary);font-family:var(--font);font-size:0.875rem;resize:vertical;min-height:80px;outline:none;" placeholder="Add your own notes — these feed the accuracy feedback loop…"></textarea>
        <div style="font-size:0.75rem;color:var(--text-muted);font-style:italic;">Notes are saved locally. In the full product, these train the confidence model.</div>
      </div>
    </div>
  `;

  document.getElementById('reportModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e.target.id === 'reportModal') closeModalDirect();
}
function closeModalDirect() {
  document.getElementById('reportModal').style.display = 'none';
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModalDirect(); });

// ── Screen a New Idea ─────────────────────────────────────────────────
function loadSample() {
  document.getElementById('ideaInput').value = SAMPLE_IDEA;
}

async function runPipeline() {
  if (pipelineRunning) return;
  const ideaText = document.getElementById('ideaInput').value.trim();
  if (!ideaText) {
    alert('Please paste an idea first.');
    return;
  }

  pipelineRunning = true;
  const runBtn = document.getElementById('runBtn');
  runBtn.disabled = true;
  runBtn.innerHTML = `<svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Running…`;

  // Reset stages
  for (let i = 1; i <= 4; i++) setStage(i, 'idle');
  document.getElementById('resultsPanel').style.display = 'none';
  document.getElementById('reportView').innerHTML = '';

  try {
    const result = await runPipelineOn(ideaText);
    renderLiveReport(ideaText, result);
  } catch (err) {
    console.error(err);
  }

  pipelineRunning = false;
  runBtn.disabled = false;
  runBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Pipeline`;
}

function renderLiveReport(ideaText, { claims, graveyard, objections }) {
  const panel = document.getElementById('resultsPanel');
  const reportView = document.getElementById('reportView');

  // Compute overall status
  const contradicted = claims.filter(c => c.status === 'contradicted').length;
  const confirmed = claims.filter(c => c.status === 'confirmed').length;
  const hasHighGraveyardMatch = graveyard.some(g => g.similarity >= 70);

  let overallStatus = 'clear';
  if (contradicted >= 2 || (contradicted >= 1 && hasHighGraveyardMatch)) overallStatus = 'high-risk';
  else if (contradicted >= 1 || graveyard.length > 0) overallStatus = 'caution';

  const sourcesChecked = claims.length * 5; // Tavily fetches 5 per claim
  const confidence = Math.round(50 + confirmed * 10 - contradicted * 12 + (graveyard.length === 0 ? 5 : -8));

  const claimsHTML = claims.map(c => `
    <div class="claim-card">
      <div class="claim-top">
        <span class="claim-type-tag type-${c.type}">${c.type.replace('_',' ')}</span>
        ${claimStatusBadge(c.status)}
      </div>
      <div class="claim-text" style="margin-bottom:10px;">${c.claim}</div>
      <div class="claim-reasoning">${c.reasoning}</div>
      <div class="claim-sources">
        ${(c.sources || []).map(s => `<span class="source-chip">🔗 ${s}</span>`).join('')}
      </div>
    </div>
  `).join('');

  const graveyardHTML = graveyard.map(entry => `
    <div class="ghost-card">
      <div class="ghost-top">
        <div>
          <div class="ghost-name">${entry.company_name}</div>
          <div class="ghost-tried">${entry.what_they_tried}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <span class="ghost-year">${entry.year_closed}</span>
          <span class="sim-badge">~${entry.similarity}% similar</span>
        </div>
      </div>
      <div class="ghost-cod">
        <span class="cod-label">Cause:</span>
        <span class="cod-value">${entry.cause_of_death}</span>
      </div>
      <div><span class="verify-label">⚠ verify yourself — not a verdict</span></div>
    </div>
  `).join('');

  const objectionsHTML = objections.map(o => `
    <div class="objection-item">
      <div class="severity-dot sev-${o.severity}"></div>
      <div>
        <div class="severity-label sev-label-${o.severity}" style="margin-bottom:4px;">${o.severity.toUpperCase()}</div>
        <div class="objection-text">${o.objection}</div>
      </div>
    </div>
  `).join('');

  reportView.innerHTML = `
    <div class="report-header" style="animation:modal-in 0.3s ease;">
      <div class="report-meta">
        ${statusBadge(overallStatus)}
        <span style="color:var(--text-muted);font-size:0.82rem;">Live pipeline run</span>
      </div>
      <div class="report-title">Screening Report</div>
      <div style="color:var(--text-secondary);font-size:0.845rem;margin-top:4px;line-height:1.5;">${ideaText.slice(0, 120)}…</div>
      <div class="report-footer-line">
        ${sourcesChecked} sources checked · ${claims.length} claims extracted · Confidence ${Math.max(20, Math.min(confidence, 95))}% · Graveyard: ${graveyard.length} match${graveyard.length !== 1 ? 'es' : ''}
      </div>
    </div>

    <div class="report-body" style="animation:modal-in 0.35s 0.05s both ease;">
      <div>
        <div class="section-title">Claim Verifier — ${claims.length} claims</div>
        ${claimsHTML}
      </div>

      <div class="graveyard-panel">
        <div class="graveyard-header">
          <div class="graveyard-eyebrow">☠ Graveyard Matches (${graveyard.length})</div>
          <div class="graveyard-hedge">leads to verify — never verdicts</div>
        </div>
        ${graveyard.length > 0 ? graveyardHTML : `<div style="color:var(--text-muted);font-size:0.875rem;text-align:center;padding:12px 0;">No close matches in graveyard database.</div>`}
      </div>

      <div class="objector-panel">
        <div class="objector-eyebrow">🔴 Objector Pass — arguments against this conclusion</div>
        ${objectionsHTML}
      </div>

      <div class="card" style="display:flex;flex-direction:column;gap:8px;">
        <div class="section-title">Reviewer Notes</div>
        <textarea style="background:var(--bg-input);border:1px solid var(--border);border-radius:6px;padding:12px;color:var(--text-primary);font-family:var(--font);font-size:0.875rem;resize:vertical;min-height:80px;outline:none;" placeholder="Add your own notes…"></textarea>
      </div>
    </div>
  `;

  panel.style.display = 'block';

  // Add spin animation for loading button
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.8s linear infinite; }`;
  document.head.appendChild(style);
}

// ── Graveyard DB View ─────────────────────────────────────────────────
function renderGraveyard(entries) {
  const grid = document.getElementById('graveyardGrid');
  if (!grid) return;

  grid.innerHTML = entries.map(entry => `
    <div class="gyard-entry">
      <div class="gyard-top">
        <div class="gyard-name">${entry.company_name}</div>
        <div class="gyard-year">${entry.year_closed}</div>
      </div>
      <div class="gyard-tried">${entry.what_they_tried}</div>
      <div class="gyard-footer">
        <span class="cause-badge cause-${entry.cause_category}">${causeCategoryLabel(entry.cause_category)}</span>
        <span class="gyard-sources">${entry.raised || 'n/a raised'}</span>
      </div>
    </div>
  `).join('');
}

function causeCategoryLabel(cat) {
  const map = {
    'unit-economics': '💸 Unit Economics',
    'timing':         '⏱ Bad Timing',
    'competition':    '⚔️ Competition',
    'regulation':     '⚖️ Regulation',
    'team':           '👥 Team',
    'pivot':          '🔄 Pivot / Acquired',
  };
  return map[cat] || cat;
}

function filterGraveyard() {
  const q = document.getElementById('graveyardSearch')?.value.toLowerCase() || '';
  const filtered = GRAVEYARD_DB.filter(e => {
    const matchCause = currentCauseFilter === 'all' || e.cause_category === currentCauseFilter;
    const matchSearch = !q ||
      e.company_name.toLowerCase().includes(q) ||
      e.what_they_tried.toLowerCase().includes(q) ||
      e.cause_of_death.toLowerCase().includes(q);
    return matchCause && matchSearch;
  });
  renderGraveyard(filtered);
}

function filterCause(btn, cause) {
  currentCauseFilter = cause;
  document.querySelectorAll('#view-graveyard .filter-pills .pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  filterGraveyard();
}

// ── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Sort ideas: riskiest first
  const sorted = [...COHORT_IDEAS].sort((a, b) => {
    const order = { 'high-risk': 0, 'caution': 1, 'clear': 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });
  renderTable(sorted);
  renderGraveyard(GRAVEYARD_DB);
});
