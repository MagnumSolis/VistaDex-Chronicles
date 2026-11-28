// ── comparisons.js: the study's chatbot vs VistaDex pairs, kept as one database row per participant ──
// The events already hold everything (chatbot_answer, vistadex_report_snapshot, tool_preference), but the
// team wants the pairs in one table they can query and export side by side. As study events arrive, the
// Worker updates the participant's row in study_comparisons (one per session: a new participant code
// always starts a new session). The row is derived data: POST /research/comparisons/rebuild recreates it
// from the event log, and withdrawing the session deletes it with the events.
// Only sessions registered on the study track with a code get a row; field visitors never do.
import { researchJoin, normCode } from "./research-join.js"; // normCode: "Its P50" is P50, as in the analysis

const { reportText } = researchJoin();

/** The columns a row may set (anything else is ignored). */
export const COMPARISON_COLUMNS = [
  "code", "idea_key", "study_version",
  "chatbot_run_id", "chatbot_tool", "chatbot_model", "chatbot_web_search", "chatbot_text", "chatbot_at",
  "report_run_id", "report_trace_id", "report_snapshot", "report_full", "report_at",
  "preference", "preference_at",
];
const RELEVANT = new Set(["participant_registered", "condition_started", "chatbot_answer", "vistadex_report_snapshot", "tool_preference"]);
const CONTENT = new Set(["chatbot_answer", "vistadex_report_snapshot", "tool_preference"]);

const str = (v, max) => (v == null ? null : String(v).slice(0, max));

/** The row fields a batch of one session's events sets (later events win). Pure: no storage. */
export function comparisonFields(events) {
  const f = {};
  for (const e of events) {
    const q = e.payload || {};
    if (e.type === "participant_registered") {
      // The latest registration counts; a field-track one does not make a study row.
      if (q.track === "study" && normCode(q.code)) f.code = normCode(q.code);
      else delete f.code;
    }
    if (e.type === "condition_started" && q.idea_key && !f.idea_key) f.idea_key = str(q.idea_key, 12);
    if (e.type === "chatbot_answer") {
      Object.assign(f, {
        chatbot_run_id: str(q.run_id, 40), chatbot_tool: str(q.tool, 40), chatbot_model: str(q.model, 60),
        chatbot_web_search: str(q.web_search, 12), chatbot_text: str(q.text, 30000), chatbot_at: str(e.ts, 40),
      });
    }
    if (e.type === "vistadex_report_snapshot") {
      Object.assign(f, {
        report_run_id: str(q.run_id, 40), report_trace_id: str(q.trace_id, 80), report_snapshot: JSON.stringify(q.report ?? null),
        report_at: str(e.ts, 40), ...(q.idea_key ? { idea_key: str(q.idea_key, 12) } : {}),
      });
    }
    if (e.type === "tool_preference") Object.assign(f, { preference: JSON.stringify(q), preference_at: str(e.ts, 40) });
    if (RELEVANT.has(e.type) && e.study_version) f.study_version = str(e.study_version, 40);
  }
  return f;
}

/** After /events stored a batch: update the session's study row when the batch carries study content. */
export async function recordComparisons(store, sessionId, events, now) {
  if (!store.upsertComparison || !events.some(e => RELEVANT.has(e.type))) return false;
  const f = comparisonFields(events);
  const hasContent = events.some(e => CONTENT.has(e.type));
  // The code: from this batch, or from the session's earlier registration.
  if (!f.code) {
    if (!hasContent) return false;
    const code = await store.studyCodeOf(sessionId);
    if (!code) return false; // field track: no row
    f.code = normCode(code);
  }
  // The full report the server generated for this run (the report cache keeps it by trace id).
  if (f.report_trace_id && store.reportByTrace) f.report_full = (await store.reportByTrace(f.report_trace_id)) ?? null;
  await store.upsertComparison(sessionId, f, now);
  return true;
}

/** Recreates every row from the stored events (the console's "Rebuild from events"). */
export async function rebuildComparisons(store, now) {
  const rows = await store.exportEvents();
  const bySession = new Map();
  for (const r of rows) {
    const e = { ...r, payload: typeof r.payload === "string" ? safeJSON(r.payload) : r.payload };
    if (!bySession.has(r.session_id)) bySession.set(r.session_id, []);
    bySession.get(r.session_id).push(e);
  }
  await store.clearComparisons();
  let n = 0;
  for (const [sid, list] of bySession) {
    const f = comparisonFields(list);
    if (!f.code) continue;
    if (f.report_trace_id && store.reportByTrace) f.report_full = (await store.reportByTrace(f.report_trace_id)) ?? null;
    await store.upsertComparison(sid, f, now);
    n++;
  }
  return n;
}

const isTest = code => /^TEST/.test(code || "");

/** Export rows: one per participant, both answers side by side. TEST codes only when asked for. */
export function exportComparisonRows(rows, { includeTest = false, full = false } = {}) {
  return rows.filter(r => includeTest || !isTest(r.code)).map(r => {
    const snap = safeJSON(r.report_snapshot);
    const pref = safeJSON(r.preference) || {};
    const out = {
      code: r.code, session_id: r.session_id, idea_key: r.idea_key, study_version: r.study_version,
      chatbot_tool: r.chatbot_tool, chatbot_model: r.chatbot_model, chatbot_web_search: r.chatbot_web_search,
      chatbot_chars: r.chatbot_text ? r.chatbot_text.length : null, chatbot_text: r.chatbot_text,
      report_score: snap ? snap.score ?? null : null, report_claims: snap ? (snap.claims || []).length : null, report_sources: snap ? snap.sources ?? null : null,
      report_text: snap ? reportText(snap) : null, report_full_available: Boolean(r.report_full),
      pref_overall: pref.overall ?? null, pref_accuracy: pref.accuracy ?? null, pref_evidence: pref.evidence ?? null, pref_risks: pref.risks ?? null,
      pref_honesty: pref.honesty ?? null, pref_decision: pref.decision ?? null, pref_options_order: pref.options_order ?? null, pref_why: pref.why ?? null,
      chatbot_at: r.chatbot_at, report_at: r.report_at, preference_at: r.preference_at, updated_at: r.updated_at,
    };
    if (full) Object.assign(out, { report_snapshot: snap, report_full: safeJSON(r.report_full) });
    return out;
  });
}

function safeJSON(s) {
  if (s == null || typeof s !== "string") return s ?? null;
  try { return JSON.parse(s); } catch { return null; }
}
