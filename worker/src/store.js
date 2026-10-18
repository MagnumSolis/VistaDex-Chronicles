// ── store.js — Storage interface for the Worker (D1 in production, memory in tests) ──
//   isWithdrawn(sessionId)                  → boolean
//   saveEvents(sessionId, events, now)      → number inserted (duplicates ignored)
//   saveTrace(traceId, mode, trace, now)
//   deleteSession(sessionId, now)           → { events, traces }
//   exportEvents() / exportTraces()         → rows

export function d1Store(db) {
  return {
    async isWithdrawn(id) {
      return Boolean(await db.prepare("SELECT 1 FROM withdrawals WHERE session_id = ?").bind(id).first());
    },
    async saveEvents(id, events, now) {
      const insert = db.prepare(
        "INSERT OR IGNORE INTO events (session_id, seq, ts, type, study_version, payload, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
      const results = await db.batch([
        db.prepare("INSERT INTO sessions (session_id, first_seen, last_seen) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET last_seen = excluded.last_seen").bind(id, now, now),
        ...events.map(e => insert.bind(id, e.seq, e.ts, e.type, e.study_version ?? null, JSON.stringify(e.payload ?? {}), now)),
      ]);
      return results.slice(1).reduce((n, r) => n + (r.meta?.changes || 0), 0);
    },
    async saveTrace(traceId, mode, trace, now) {
      await db.prepare("INSERT OR REPLACE INTO traces (trace_id, created_at, mode, trace) VALUES (?, ?, ?, ?)")
        .bind(traceId, now, mode, JSON.stringify(trace)).run();
    },
    async deleteSession(id, now) {
      const { results } = await db.prepare("SELECT payload FROM events WHERE session_id = ? AND type = 'run_completed'").bind(id).all();
      const traceIds = results.map(r => safeJSON(r.payload)?.trace_id).filter(Boolean);
      const stmts = [
        db.prepare("INSERT OR REPLACE INTO withdrawals (session_id, withdrawn_at) VALUES (?, ?)").bind(id, now),
        db.prepare("DELETE FROM events WHERE session_id = ?").bind(id),
        db.prepare("DELETE FROM sessions WHERE session_id = ?").bind(id),
        ...traceIds.map(t => db.prepare("DELETE FROM traces WHERE trace_id = ?").bind(t)),
      ];
      const out = await db.batch(stmts);
      return { events: out[1].meta?.changes || 0, traces: traceIds.length };
    },
    async exportEvents() {
      const { results } = await db.prepare("SELECT session_id, seq, ts, type, study_version, payload, received_at FROM events ORDER BY session_id, seq").all();
      return results;
    },
    async exportTraces() {
      const { results } = await db.prepare("SELECT trace_id, created_at, mode, trace FROM traces ORDER BY created_at").all();
      return results;
    },
  };
}

export function memoryStore() {
  const events = new Map(); // `${id}:${seq}` → row
  const traces = new Map();
  const withdrawn = new Set();
  return {
    _events: events, _traces: traces,
    async isWithdrawn(id) { return withdrawn.has(id); },
    async saveEvents(id, list, now) {
      let n = 0;
      for (const e of list) {
        const k = `${id}:${e.seq}`;
        if (events.has(k)) continue;
        events.set(k, { session_id: id, seq: e.seq, ts: e.ts, type: e.type, study_version: e.study_version ?? null, payload: JSON.stringify(e.payload ?? {}), received_at: now });
        n++;
      }
      return n;
    },
    async saveTrace(traceId, mode, trace, now) { traces.set(traceId, { trace_id: traceId, created_at: now, mode, trace: JSON.stringify(trace) }); },
    async deleteSession(id) {
      withdrawn.add(id);
      let n = 0, t = 0;
      for (const [k, row] of events) {
        if (row.session_id !== id) continue;
        const traceId = row.type === "run_completed" ? safeJSON(row.payload)?.trace_id : null;
        if (traceId && traces.delete(traceId)) t++;
        events.delete(k);
        n++;
      }
      return { events: n, traces: t };
    },
    async exportEvents() { return [...events.values()].sort((a, b) => a.session_id.localeCompare(b.session_id) || a.seq - b.seq); },
    async exportTraces() { return [...traces.values()]; },
  };
}

function safeJSON(s) {
  try { return JSON.parse(s); } catch { return null; }
}
