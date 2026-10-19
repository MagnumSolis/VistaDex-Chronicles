-- worker/schema.sql — D1 telemetry store (applied via wrangler d1 execute)
-- Telemetry rules (Project Hub, decided 19 Oct): public demo only; every button
-- press + time spent; users told what is recorded; 12-month retention;
-- session withdraw without auth; export researcher-token protected.

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  received_ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);

-- Screen runs (pipeline results, for analytics + accuracy probes)
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  idea_hash TEXT NOT NULL,
  claims_count INTEGER,
  graveyard_count INTEGER,
  objections_count INTEGER,
  duration_ms INTEGER,
  created_ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);
