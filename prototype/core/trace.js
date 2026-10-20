// ── trace.js — One trace record per screened idea ──
// Records every fetch, classification, router path, match score and objection.
// The trace is kept out of the POST /screen body so the contract stays exact.

export function createTrace({ ideaText, mode, now = () => new Date().toISOString(), id } = {}) {
  const record = {
    trace_id: id || newId(),
    mode,
    idea_chars: ideaText ? ideaText.length : 0,
    started_at: now(),
    finished_at: null,
    events: [],
  };
  return {
    record,
    log(kind, data = {}) {
      record.events.push({ t: now(), kind, ...data });
    },
    finish() {
      record.finished_at = now();
      return record;
    },
  };
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `trace-${Date.now().toString(36)}`;
}
