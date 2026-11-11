// ── store.js — Storage interface for the Worker (D1 in production, memory in tests) ──
//   isWithdrawn(sessionId)                  → boolean
//   saveEvents(sessionId, events, now)      → number inserted (duplicates ignored)
//   saveTrace(traceId, mode, trace, now)
//   deleteSession(sessionId, now)           → { events, traces }
//   exportEvents() / exportTraces()         → rows
//   getCached(key) / putCached(key, row) / listCached(n) / setFrozen(key, frozen)   report cache (P0-7)
//   purgeOlderThan(isoCutoff)               → { events, traces } deleted (retention cleanup)
//   takeDailyScreen(day, cap)               → { allowed, count } (atomic increment below the cap)
//   releaseDailyScreen(day)                 gives one slot back (a run that failed)

export function d1Store(db) {
  // The cache table is created on first use, so no manual migration is needed on the production database.
  let cacheReady = null;
  const cache = () => (cacheReady ??= db.prepare("CREATE TABLE IF NOT EXISTS report_cache (key TEXT PRIMARY KEY, title TEXT, created_at TEXT NOT NULL, frozen INTEGER NOT NULL DEFAULT 0, trace_id TEXT, report TEXT NOT NULL)").run());
  return {
    async getCached(key) {
      await cache();
      return await db.prepare("SELECT key, title, created_at, frozen, trace_id, report FROM report_cache WHERE key = ?").bind(key).first();
    },
    async putCached(key, row) {
      await cache();
      // A frozen entry is never overwritten.
      await db.prepare("INSERT INTO report_cache (key, title, created_at, frozen, trace_id, report) VALUES (?, ?, ?, 0, ?, ?) ON CONFLICT(key) DO UPDATE SET title = excluded.title, created_at = excluded.created_at, trace_id = excluded.trace_id, report = excluded.report WHERE report_cache.frozen = 0")
        .bind(key, row.title, row.created_at, row.trace_id, row.report).run();
    },
    async listCached(n) {
      await cache();
      const { results } = await db.prepare("SELECT key, title, created_at, frozen, trace_id FROM report_cache ORDER BY frozen DESC, created_at DESC LIMIT ?").bind(n).all();
      return results.map(r => ({ ...r, frozen: Boolean(r.frozen) }));
    },
    async purgeCache(cutoff) {
      await cache();
      await db.prepare("DELETE FROM report_cache WHERE frozen = 0 AND created_at < ?").bind(cutoff).run();
    },
    async setFrozen(key, frozen) {
      await cache();
      const r = await db.prepare("UPDATE report_cache SET frozen = ? WHERE key = ?").bind(frozen ? 1 : 0, key).run();
      return (r.meta?.changes || 0) > 0;
    },
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
    // One atomic statement: insert the day's first screen, or increment only while below the cap.
    // When the cap is reached the UPDATE's WHERE fails, nothing is returned, and the request is refused.
    async takeDailyScreen(day, cap) {
      const row = await db.prepare(
        "INSERT INTO daily_counters (day, screens) VALUES (?1, 1) ON CONFLICT(day) DO UPDATE SET screens = screens + 1 WHERE screens < ?2 RETURNING screens",
      ).bind(day, cap).first();
      return row ? { allowed: true, count: row.screens } : { allowed: false, count: cap };
    },
    async purgeOlderThan(cutoff) {
      const out = await db.batch([
        db.prepare("DELETE FROM events WHERE received_at < ?").bind(cutoff),
        db.prepare("DELETE FROM traces WHERE created_at < ?").bind(cutoff),
        db.prepare("DELETE FROM sessions WHERE last_seen < ?").bind(cutoff),
        db.prepare("DELETE FROM daily_counters WHERE day < ?").bind(cutoff.slice(0, 10)),
      ]);
      return { events: out[0].meta?.changes || 0, traces: out[1].meta?.changes || 0 };
    },
    async releaseDailyScreen(day) {
      await db.prepare("UPDATE daily_counters SET screens = screens - 1 WHERE day = ? AND screens > 0").bind(day).run();
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
  const cached = new Map();
  const events = new Map(); // `${id}:${seq}` → row
  const traces = new Map();
  const withdrawn = new Set();
  const daily = new Map();
  return {
    _events: events, _traces: traces,
    async getCached(key) { return cached.get(key) || null; },
    async putCached(key, row) { if (!cached.get(key)?.frozen) cached.set(key, { key, frozen: false, ...row }); },
    async listCached(n) { return [...cached.values()].sort((a, b) => b.frozen - a.frozen || b.created_at.localeCompare(a.created_at)).slice(0, n).map(({ report, ...r }) => r); },
    async purgeCache(cutoff) { for (const [k, r] of cached) if (!r.frozen && r.created_at < cutoff) cached.delete(k); },
    async setFrozen(key, frozen) { const r = cached.get(key); if (!r) return false; r.frozen = frozen; return true; },
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
    async takeDailyScreen(day, cap) {
      const n = daily.get(day) || 0;
      if (n >= cap) return { allowed: false, count: n };
      daily.set(day, n + 1);
      return { allowed: true, count: n + 1 };
    },
    async purgeOlderThan(cutoff) {
      let e = 0, t = 0;
      for (const [k, row] of events) if (row.received_at < cutoff) { events.delete(k); e++; }
      for (const [k, row] of traces) if (row.created_at < cutoff) { traces.delete(k); t++; }
      return { events: e, traces: t };
    },
    async releaseDailyScreen(day) { if ((daily.get(day) || 0) > 0) daily.set(day, daily.get(day) - 1); },
    async exportEvents() { return [...events.values()].sort((a, b) => a.session_id.localeCompare(b.session_id) || a.seq - b.seq); },
    async exportTraces() { return [...traces.values()]; },
  };
}

function safeJSON(s) {
  try { return JSON.parse(s); } catch { return null; }
}
