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

-- The study's chatbot vs VistaDex pairs (study-18): one row per study-track session, kept up to date by
-- POST /events (worker/src/comparisons.js) and rebuildable from the events. Holds the pasted chatbot
-- answer and the participant's VistaDex report (snapshot, and the full report from report_cache).
-- Deleted with the session on withdrawal; created on first use if missing.
CREATE TABLE IF NOT EXISTS study_comparisons (
  session_id         TEXT PRIMARY KEY,
  code               TEXT NOT NULL,        -- participant code (e.g. P07), never a name
  idea_key           TEXT,                 -- A to D or "own"
  study_version      TEXT,
  chatbot_run_id     TEXT,
  chatbot_tool       TEXT,
  chatbot_model      TEXT,
  chatbot_web_search TEXT,
  chatbot_text       TEXT,                 -- the answer as pasted
  chatbot_at         TEXT,
  report_run_id      TEXT,
  report_trace_id    TEXT,
  report_snapshot    TEXT,                 -- JSON: what the report said (claims, competitors, leads, objections...)
  report_full        TEXT,                 -- JSON: the full report from report_cache, when it is there
  report_at          TEXT,
  preference         TEXT,                 -- JSON: the tool_preference answers
  preference_at      TEXT,
  updated_at         TEXT NOT NULL
);
