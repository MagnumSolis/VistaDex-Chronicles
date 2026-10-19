-- VistaDex research store (Cloudflare D1 / SQLite).
-- Apply with: npx wrangler d1 execute vistadex --remote --file=schema.sql
-- No column holds names, emails, IP addresses or user-agent strings.

CREATE TABLE IF NOT EXISTS sessions (
  session_id  TEXT PRIMARY KEY,           -- random UUID generated in the browser
  first_seen  TEXT NOT NULL,              -- server receive time (ISO 8601)
  last_seen   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  session_id    TEXT NOT NULL,
  seq           INTEGER NOT NULL,         -- per-session counter from the browser
  ts            TEXT NOT NULL,            -- client timestamp (ISO 8601)
  type          TEXT NOT NULL,
  study_version TEXT,
  payload       TEXT NOT NULL,            -- JSON
  received_at   TEXT NOT NULL,
  PRIMARY KEY (session_id, seq)           -- makes retried uploads idempotent
);
CREATE INDEX IF NOT EXISTS events_type ON events(type);

-- One trace per screened idea (live mode). Linked to a session through the
-- trace_id inside that session's run_completed event.
CREATE TABLE IF NOT EXISTS traces (
  trace_id    TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  mode        TEXT NOT NULL,
  trace       TEXT NOT NULL               -- JSON
);

-- Global daily cap on /screen (SCREEN_DAILY_CAP). One row per UTC day.
CREATE TABLE IF NOT EXISTS daily_counters (
  day      TEXT PRIMARY KEY,              -- YYYY-MM-DD (UTC)
  screens  INTEGER NOT NULL
);

-- Withdrawn sessions: late uploads for these IDs are refused.
CREATE TABLE IF NOT EXISTS withdrawals (
  session_id    TEXT PRIMARY KEY,
  withdrawn_at  TEXT NOT NULL
);
