# Backend handoff: connecting a backend to the VistaDex frontend

Written on 2026-10-20 from the code on `feat/weekend-prototype` (commit after `1d7b4db`), for the backend work on
`feat/backend-integration`. Every statement below points at the file that implements it; if the code and this
page disagree, the code wins and this page is wrong.

**One thing to know first:** the frontend does not call `/api/...` and does not read `{ ok, result }`. It calls the
endpoints in §1 on the base URL in `prototype/config.js` (`PROXY_URL`), sends the bodies in §1 and accepts a
response only if it passes `validateContract` (`prototype/core/contract.js:90`). The backend's own
`backend/API.md` describes a different API; §6 lists every difference.

---

## 1. Endpoints the frontend calls

Base URL: `CONFIG.PROXY_URL` (`prototype/config.js`), trailing `/` removed. Empty = no backend at all (§2).
The reference implementation of every endpoint is `worker/src/index.js` (routing at lines 44–50).

| # | Method + path | Called from | Implemented in |
|---|---|---|---|
| 1 | `POST /screen` | `prototype/ui/client.js:51` (`screenViaProxy`) | `worker/src/index.js:58` (`screen`) |
| 2 | `POST /events` | `prototype/ui/telemetry.js:92` (`flush`; `sendBeacon` at :100) and `:139` (`sendUnlinked`, feedback) | `worker/src/index.js:104` (`saveEvents`) |
| 3 | `DELETE /session/:session_id` | `prototype/ui/telemetry.js:119` (`withdraw`), from Welcome → "Delete my session" | `worker/src/index.js:123` (`withdraw`) |
| 4 | `GET /export?table=events\|traces&format=json\|csv` | not called by the frontend (researchers, with curl) | `worker/src/index.js:129` (`exportData`) |
| — | `OPTIONS *` (CORS preflight) | the browser | `worker/src/index.js:38`, headers at :168 |

### 1.1 `POST /screen`

Request headers
- `Content-Type: application/json`
- `X-VistaDex-Access: <access code>` — only when the visitor's link had `#code=…` (`prototype/ui/access.js`, `ACCESS_HEADER`). The body never carries the code.

Request body — one of two shapes (`client.js:62`; Worker decides at `index.js:65`):

```jsonc
// Structured input (what the form sends; chosen when "title" is a string)
{ "title": "…", "pitch": "…", "problem": "…", "solution": "…", "moat": "…",
  "industries": ["AI/ML", "…"], "role": "founder|investor|accelerator" | null, "markets": ["EU","USA","India"] }

// Old shape (still accepted)
{ "idea_text": "…" }
```

Limits (`prototype/core/input.js`): `title` 120, `pitch` 280, `problem` 1600, `solution` 2000, `moat` 2000 characters;
`title`, `pitch`, `problem`, `solution` are required; `idea_text` ≤ 6000 characters (`MAX_IDEA_CHARS`). Unknown
`industries`/`role`/`markets` values are dropped by `normalizeInput`. The pipeline joins the five text fields into
`idea_text` with `buildIdeaText`. Request bodies over 256 KB are treated as empty (`index.js:25`, `readJSON`).

Response `200` — the report itself (no envelope), plus headers:
- `X-VistaDex-Trace-Id: <uuid>` — read at `client.js:77`, sent in telemetry `run_completed.trace_id`.
- `X-VistaDex-Mode: live | mock` — `client.js:76`: anything but `live` is shown as "proxy-mock".
- `Access-Control-Expose-Headers: X-VistaDex-Trace-Id, X-VistaDex-Mode` — without it the browser hides both.

The report contract (`prototype/core/contract.js`, shape at lines 1–17, checks at :90):

```jsonc
{
  "idea_text": "…",                                   // required, string
  "claims": [{                                        // required, array
    "claim": "…",                                     // non-empty
    "type": "novelty|market_size|defensibility|traction|other",
    "status": "confirmed|contradicted|disputed|unverified",
    "reasoning": "…",
    "source_urls": ["https://…"],
    "evidence": [{ "url": "…", "stance": "supports|contradicts", "quote": "…" }]   // optional
  }],
  "graveyard_matches": [{ "company_name": "…", "what_they_tried": "…", "cause_of_death": "…",
                          "year_closed": 2020 | null, "similarity": 0.0–1.0,
                          "source_urls": ["…"] }],   // required; similarity 0–1, not 0–100; source_urls optional (closure pages, live graveyard only)
  "objections": [{ "objection": "…", "severity": "high|medium|low" }],            // required

  // optional (round 2); absent = "not available", never guessed
  "input": { "title", "pitch", "problem", "solution", "moat", "industries": [], "role", "markets": [] },
  "competitors": [{ "name": "…", "url": "https://…", "why_similar": "…", "quote": "…" }],   // name + http(s) url required
  "search": { "competitors": { "queries": [], "sources_checked": 0 },
              "graveyard": { "entries_checked": 0, "verified_entries": 0 } },
  "big_tech_risk": { "level": "low|medium|high|none_found|unverified", "companies": [{ "name", "relation": "direct|adjacent", "reason", "source_urls": [], "quote" }],
                     "unconfirmed": [{ "name", "source_urls": [] }], "summary": "…", "companies_checked": [], "queries": [], "sources_checked": 0 },
  "market": { "tam": { "value": "US$125 billion", "value_usd": 125000000000, "scope": "…", "citation": { "name", "url" }, "quote": "…" },
              "sam"?: { "value", "scope", "assumptions": [] }, "som"?: { … } },
  "legal": { "jurisdictions": [] },
  "sample_fields": ["competitors", "big_tech_risk", "market", "legal"],   // only for placeholder data; the server never sets it
  "overlap_band": "clear|caution|high",
  "scores": { "vistadex": { "value": 0–100 | null, "reason"?, "used": [], "excluded": [], "sample": false },
              "axes": { "novelty|market|defensibility|graveyard|evidence|big_tech": { "value": 0–100 | null, "inputs", "boundary", "note"?, "reason"?, "sample" } } }
}
```

A response that fails `validateContract` is refused with "proxy response broke the contract" (`client.js:67`,
error code `contract`), so an envelope like `{ ok, result }` or a 0–100 similarity fails every run.

Error responses (`worker/src/index.js`) and what the frontend does (`client.js:37`, messages in `access.js`):

| Status | Body `error` | When | Frontend |
|---|---|---|---|
| 400 | `fields_required` (+ `fields`) / `idea_text is required` | missing required input (`index.js:70`, `:74`) | `http` |
| 401 | `access_code_required` | access code required and missing or wrong (`index.js:149`) | `access`: "This study link is missing its access code…" |
| 403 | `origin not allowed` | browser `Origin` not in `ALLOWED_ORIGINS` (`index.js:42`) | `http` (or a CORS failure → `network`) |
| 413 | `field_too_long` (+ `fields`) / `idea_text is longer than 6000 characters` | over the limits (`index.js:67`, `:75`) | `http` |
| 429 | `rate_limited` (+ `Retry-After: 60`) | per-IP limit (`index.js:158`) | `rate_limited`: "Too many requests right now…" |
| 429 | `daily_cap` (+ `Retry-After` to 00:00 UTC) | `SCREEN_DAILY_CAP` reached (`index.js:85`) | `daily_cap`: "…paused for today…" |
| 503 | `misconfigured` | access required but no `ACCESS_CODES` set (`index.js:147`) | `misconfigured`: "…not set up correctly…" |
| 500 | `internal error` | anything thrown; provider text is never echoed (`index.js:53`) | `http` |
| — | — | fetch threw | `network` |

Every 4xx/5xx body is JSON `{ "error": "…", "message"?: "…" }`. Only `error === "daily_cap"` is read by the client.

### 1.2 `POST /events` (telemetry upload, public edition only)

`Content-Type: text/plain` (a "simple" CORS request, no preflight; `telemetry.js:107`) and `sendBeacon` on page hide.
The Worker parses the text as JSON.

```jsonc
{ "session_id": "<uuid v4>", "access_code"?: "…",
  "events": [{ "session_id": "<same uuid>", "seq": 1, "ts": "ISO 8601", "type": "control_pressed",
               "study_version": "2026-10-public-3", "payload": { … } }] }
```

- 1–200 events per request (`MAX_EVENTS_PER_BATCH`), `type` matches `/^[a-z_]{1,64}$/`, `seq` > 0, every event's `session_id` = the batch's.
- The access code rides in the body because beacons cannot set headers; it is not stored.
- Responses: `200 { stored, received }` (duplicates `(session_id, seq)` ignored), `400` malformed / bad session id, `401`/`503` access, `410 session withdrawn`, `429 rate_limited`.
- Feedback (`feedback_submitted`) is sent the same way under a **new random session id**, never the visitor's usage session (`telemetry.js:139`). Its payload contains the visitor's free-text answer (`wrong`, ≤ 2000 chars) and an optional `email` (`web/src/screens/Feedback.tsx:41`).

### 1.3 `DELETE /session/:session_id` (withdraw)

No access code, no body. `200 { withdrawn: true, deleted: { events, traces } }`; `400` if the id is not a UUID.
Deletes the session's events, the traces linked through its `run_completed.trace_id` values, and blocks later
uploads for that id (`worker/src/store.js:27`). The browser clears its own copy whatever the server answers and tells
the visitor if the server could not be reached (`web/src/screens/Welcome.tsx:32`).

### 1.4 `GET /export` (researchers only)

`Authorization: Bearer <EXPORT_TOKEN>` (timing-safe compare); disabled (`401`) when `EXPORT_TOKEN` is unset.
`?table=events` (default) or `traces`; `?format=csv` for CSV, otherwise JSON. Not called by the frontend; there is no
participant download button in the current UI (`telemetry.js:158` `exportJSON` is only used by the retired study UI).

---

## 2. Mock vs live mode

`PROXY_URL` (`prototype/config.js`) is the only switch in the frontend (`liveMode()`, `client.js:9`):

| | `PROXY_URL` empty (default) | `PROXY_URL` set |
|---|---|---|
| Where the pipeline runs | in the browser: `runScreen(…, { mode: "mock", samples: MOCK_SAMPLES })` (`client.js:25`) | on the server: `POST /screen` |
| Evidence | none: every claim `unverified` | the server's retrieval |
| `competitors`, `big_tech_risk`, `market`, `legal` | **sample placeholders**, listed in `sample_fields` and labelled "sample data" | only what the server produced (the server never sends placeholders, `index.js:93`) |
| Telemetry upload | none (events stay in the browser) | `POST /events` |
| Footer label | "Mock mode: no live evidence" | "Live providers" (`web/src/shell/Shell.tsx`) |

The Worker itself runs the mock path when it has no provider keys and says so with `X-VistaDex-Mode: mock` (`index.js:92`).

**What must come from the backend** (the client cannot make these up and does not recompute them):
- claim `status`, `reasoning`, `source_urls`, `evidence[].quote` — from fetched pages; in our pipeline the model only labels each page's stance with a verbatim quote and **code** sets the status by the two-independent-domains rule (`prototype/core/evidence.js` `computeStatus`, quotes checked by `prototype/core/quotes.js` `isVerbatim`);
- `competitors` (each with a fetched page and a verbatim quote naming it — `stages/competitors.js`), `search.competitors`;
- `big_tech_risk` (same 2-domain rule — `stages/bigtech.js` `bigTechFromLabels`);
- `market.tam` (only from a confirmed market-size claim's verbatim quote — `stages/market.js`);
- `graveyard_matches` (`stages/graveyard.js`, similarity 0–1) and `search.graveyard`.

**What is computed in code from the report** — the backend must run the same code, or the scores will be wrong or missing:
- `overlap_band` and `scores` — `finalizeReport` (`prototype/core/finalize.js:7`) → `scoring.js`, weights and thresholds in `scoring-config.js`. Our Worker gets them by calling `runScreen`, which ends with `finalizeReport` (`prototype/core/pipeline.js`). **The browser does not recompute scores for server reports**: a report without `scores` shows no VistaDex Score.
- claim `type` (rules first, `prototype/core/rules.js`), objections that are deterministic (`stages/objector.js`), `input` normalisation.

The simplest correct backend imports `runScreen` from `prototype/core/pipeline.js` (as `worker/src/index.js` does) and
swaps providers behind `prototype/core/providers/` (`llm.js`, `retrieval.js`, `embed.js`).

---

## 3. Telemetry contract and the trace

- **Contract:** `tests/fixtures/event-contract.json` (`study_version` `2026-10-public-3`): envelope
  `session_id, seq, ts, type, study_version, payload`; payload keys per type; enum values; the list of control ids.
  Event types: `consent_given, welcome_choice, view_changed, screen_time, control_pressed, field_edited, run_started,
  run_completed, run_failed, run_cancelled, claim_expanded, source_clicked, graveyard_viewed, objections_viewed,
  section_time, report_time, walkthrough_started, walkthrough_step_time, walkthrough_ended, feedback_submitted`.
- **Who sends:** only the public edition, only after the Welcome notice is answered, never after "Use without recording";
  the pitch edition calls `tm.disable()` at startup (`web/src/telemetry/index.ts:13`). Runs are described by lengths
  and counts; no idea text, claim text or report content is in usage events.
- **Upload:** batched, at most one `/events` request per 10 s, ≤ 200 events, plus a beacon on page hide (`telemetry.js`).
- **Withdraw:** `DELETE /session/:id` (§1.3). **Export:** `GET /export` (§1.4).
- **The trace (open privacy issue).** Every `/screen` run stores one trace in D1 (`index.js:95`, table `traces`). The
  trace logs each extracted or dropped claim **with its text** (`prototype/core/stages/extract.js:50`, `:69`, `:92`,
  events `claim_typed` and `claim_dropped`), i.e. sentences from the visitor's idea. Traces are linked to a usage
  session only through `run_completed.trace_id`, are deleted on withdraw, and are exported with `?table=traces`.
  This contradicts "no idea text is stored" unless the team decides otherwise. TODO(team): drop claim text from the
  trace (keep lengths/types), or say in the Welcome notice that it is stored.

---

## 4. Worker secrets, vars and running locally

Secrets (`npx wrangler secret put <NAME>`; locally in `./.env` for `dev-proxy` or `worker/.dev.vars` for `wrangler dev`, both gitignored):

| Name | Used by | Effect |
|---|---|---|
| `GROQ_API_KEY`, `MISTRAL_API_KEY` | `prototype/core/providers/llm.js:87` | LLM stages; none → deterministic path |
| `GROQ_MODEL`, `MISTRAL_SMALL_MODEL`, `MISTRAL_OBJECTOR_MODEL` | same | model overrides |
| `TINYFISH_API_KEY` | `prototype/core/providers/retrieval.js:49` | web retrieval; none → every claim `unverified` |
| `ACCESS_CODES` | `index.js:143` | comma-separated study codes for `/screen` and `/events` |
| `EXPORT_TOKEN` | `index.js:131` | bearer token for `/export` |

Vars (`worker/wrangler.toml`): `ALLOWED_ORIGINS` (browser origins allowed by CORS; localhost:5173 included),
`ACCESS_REQUIRED="true"` (no codes configured → 503, fails closed), `SCREEN_DAILY_CAP="300"`. Bindings:
`SCREEN_LIMITER` (30/60 s per IP), `EVENTS_LIMITER` (60/60 s per IP), D1 `DB` (`worker/schema.sql`).

Run the two against each other on one machine:

```bash
npm --prefix web install                  # once
npm run dev-proxy                         # Worker handler in Node on http://localhost:8787, memory store, keys from ./.env
                                          # (ACCESS_REQUIRED is off here; codes are enforced only if ACCESS_CODES is in .env)
# then set PROXY_URL: "http://localhost:8787" in prototype/config.js (do not commit it)
npm run serve                             # web app on http://localhost:5173 (the origin dev-proxy allows)
```

Or the real Worker runtime: `cd worker && npm install && npm run db:init:local && npx wrangler dev` (also :8787, local D1,
secrets from `worker/.dev.vars`).

---

## 5. Tests to keep green

| Command | What it covers |
|---|---|
| `npm test` | node tests in `tests/`: contract (`contract.test.js`), Worker routes, CORS, limits, access code, export, withdraw (`worker.test.js`, `access.test.js`, `d1-store.test.js`), telemetry uploads, pipeline stages, scoring config, sample reports, `study_version` guard |
| `npm run test:web` | vitest in `web/`: flows (incl. proxy refusals 429 `daily_cap` / `rate_limited` and 500; the 401/429/503 messages are tested in `tests/access-client.test.js`), editions (pitch sends zero events), telemetry contract and controls, contrast, colour vision |
| `npm --prefix web run typecheck` | TypeScript |
| `npm run parity` | with the dev server running: replays the public flow in Chrome against the event contract; the pitch edition must send nothing |
| `npm run a11y` | with the dev server running: axe, keyboard, overflow at 1280/375/360/320 px, both editions |
| `npm --prefix web run access-e2e` | access code and edition link handling in Chrome |

`parity`, `a11y` and `access-e2e` drive the installed Chrome (`playwright-core`); set `VD_BASE=<url>` if the dev
server is not on :5173.

---

## 6. Differences between this frontend and `backend/API.md` + `worker/index.js` (origin/feature/phase-0-bugfixes)

Read-only comparison; nothing on that branch was changed.

| Area | Frontend + `worker/src/index.js` (this branch) | `backend/API.md` | His `worker/index.js` |
|---|---|---|---|
| Screen path | `POST /screen` | `POST /api/screen` | `POST /api/screen` |
| Events path | `POST /events` | `POST /api/events` | `POST /api/events` |
| Withdraw | `DELETE /session/:id`, no body | `POST /api/session/withdraw` `{session_id}` | same as API.md |
| Export | `GET /export?table=events\|traces&format=json\|csv`, `Bearer EXPORT_TOKEN` | `GET /api/export`, `Bearer RESEARCHER_EXPORT_TOKEN`, events only | same as API.md; JSON only; `503 no_sink_configured` without Mongo |
| Extra routes | none used | `GET /api/graveyard`, `GET /api/health` | both (frontend has no Graveyard page any more) |
| Screen request | structured input `{title, pitch, problem, solution, moat, industries, role, markets}` or `{idea_text}` | `{idea, session_id}` | `{idea, session_id}`; structured input ignored |
| Input limits | per field 120/280/1600/2000/2000; `idea_text` ≤ 6000; 413 when over | `idea` 1–5000 | `idea` ≤ 5000 → **400** `invalid_idea` (not 413) |
| Response envelope | the report itself | `{ ok, result: {claims, graveyard_matches, objections}, trace }` | same as API.md; client rejects it (`validateContract`) |
| `idea_text` in response | required | absent | absent → contract failure |
| Claim sources | `source_urls` | `sources` | `sources` (+ `provider`, `evidence_count`) |
| Claim types | `novelty, market_size, defensibility, traction, other` | no `traction` | no `traction` |
| Evidence quotes | `claims[].evidence[{url, stance, quote}]`, quote verbatim on the page | none | none (snippets only) |
| Claim status | computed in code: ≥ 2 independent domains (`computeStatus`) | not specified | set by the LLM from Tavily snippets |
| Graveyard similarity | 0–1 | 0–100 (example `87`) | 0–100 (`Math.round(sim*100)`) → fails `validateContract` |
| Graveyard seed | `prototype/data/graveyard.js` (18 entries, BrightRoll and Timehop removed) | Mongo schema (`failure_reason`, `death_status`, …) | inline 20 entries incl. BrightRoll, Timehop |
| Round-2 fields | `input, competitors, search, big_tech_risk, market, overlap_band, scores` | absent | absent → no VistaDex Score, no competitors / Big Tech / TAM |
| Objections | up to 5, unknown severity → `low` | — | up to 4, unknown severity → `medium` |
| Trace | stored server-side; id in `X-VistaDex-Trace-Id` | `trace` array in the body | same as API.md; no trace id header |
| Mode | `X-VistaDex-Mode: live\|mock` header | — | no header → shown as "proxy-mock" |
| No LLM keys | 200, mock path, `X-VistaDex-Mode: mock` | "frontend falls back to DEMO_MODE automatically" | **503** `no_llm_configured` (the frontend shows "not set up correctly"; it has no fallback) |
| No claims | 200 with `claims: []` | — | **200** `{ok:false, error:"no_claims_extracted"}` → contract failure |
| Server error | 500 `{error:"internal error"}`, provider text never echoed | `screen_failed` | 500 with `detail: e.message` (may echo provider responses) |
| Access code | `X-VistaDex-Access` header on `/screen`, `access_code` in `/events` body; `ACCESS_CODES` + `ACCESS_REQUIRED`; 401 / 503 fail-closed | "one shared access code… fails closed" | **not implemented** |
| Rate limits | per IP: 30/min `/screen`, 60/min `/events` (Workers Rate Limiting); 429 `rate_limited` + `Retry-After` | ~30 runs/min, ~60 telemetry/min per IP | per `session_id`, 10 per 10 min, in memory per isolate; `/events` unlimited |
| Daily cap | `SCREEN_DAILY_CAP` in D1; 429 `daily_cap` | "daily run cap" | **not implemented** |
| CORS | `ALLOWED_ORIGINS` allow-list; methods `POST, DELETE, OPTIONS`; headers `Content-Type, X-VistaDex-Access`; exposes trace/mode headers; 403 other origins | — | `*`; methods `POST, OPTIONS`; header `content-type` only → `X-VistaDex-Access` preflight and `DELETE` fail; headers not exposed |
| Events body | `{session_id, access_code?, events: [≤200 × {session_id, seq, ts, type, study_version, payload}]}` as `text/plain` | `{session_id, ts, event, payload}` (one event) | one event; requires `event` string → our batches get 400 `invalid_event` |
| Event names | contract types (`consent_given`, `control_pressed`, `screen_time`, …) | `consent_granted`, `button_press`, `time_spent`, `page_view`, … | accepts any |
| Events response | `{stored, received}`; 400 / 410 withdrawn / 429 | `{ok:true}` | always `{ok:true}` (also after withdraw) |
| Event storage | D1 `events` (idempotent on `session_id, seq`) | forwarded to `EVENTS_SINK_URL` | forwarded to `EVENTS_SINK_URL`; dropped if unset |
| Withdraw effect | deletes events + linked traces, blocks later uploads | "deletes/flags all events" | forwards to `EVENTS_SINK_URL/withdraw`; returns `{ok:true}` even with no sink |
| Secrets | `GROQ_API_KEY, MISTRAL_API_KEY, TINYFISH_API_KEY, ACCESS_CODES, EXPORT_TOKEN` (+ model vars) | `RESEARCHER_EXPORT_TOKEN` | `GROQ_API_KEY, MISTRAL_API_KEY, TAVILY_API_KEY, RESEARCHER_EXPORT_TOKEN, EVENTS_SINK_URL, EVENTS_SINK_TOKEN, MONGODB_DATA_API_URL, MONGODB_DATA_API_KEY, MONGODB_DB` |
| Retrieval | TinyFish search + page fetch | Tavily | Tavily snippets |
| Worker config | `worker/wrangler.toml`: `vistadex-proxy`, `src/index.js`, D1 + rate-limit bindings | base `https://vistadex.vistadex-team.workers.dev` | root `wrangler.jsonc`: `vistadex`, `worker/index.js`, serves `./prototype` (old UI) as assets |

---

## 7. Access code and the pitch edition (state on 2026-10-20)

- **No secret is committed.** The history of `feat/weekend-prototype` contains no `.env` file (only `.env.example`
  with empty values), no `.dev.vars`, no API key and no real access code. `K7Q2-MX9P` appears in `docs/DEPLOY.md`,
  `prototype/ui/access.js` and tests as an **example**; never deploy it as the real code. Test files use fake values
  (`"t"`, `"test-token"`, `"gsk_SECRET123"`).
- **The pitch edition is not protected.** `web/src/edition.ts` (`captureEdition`) switches to pitch whenever the
  fragment has `edition=pitch`; it checks no code. `#edition=pitch` alone works. The `code=` part of a pitch link is
  only the study access code for the proxy (`access.js`), checked by the Worker on `/screen` and `/events`, and it is
  the same code as the public link's. What pitch "unlocks" today: no telemetry, the demo cohort on Reports, a badge.

### Backend task: a real pitch code

1. **Worker:** add a separate secret `PITCH_CODES` (comma-separated, never in a file) and an endpoint, e.g.
   `POST /pitch/verify` with header `X-VistaDex-Pitch: <code>` → `200 { pitch: true }` or `401`. Compare timing-safely
   (as `checkAccess` does), rate-limit it per IP, never log the code, fail closed (`503`) when it is required and unset.
   Keep it independent of `ACCESS_CODES`.
2. **Client** (after the endpoint exists): `#edition=pitch&pitch=<code>` is captured and scrubbed like `#code=`; the app
   stays in the **public** edition until the Worker answers `pitch: true`, then switches (`edition.ts` is the only place
   that may change). No `PROXY_URL` → no pitch edition. Add tests: wrong code stays public; pitch still sends zero events.
3. Remove the `TODO(team)` in `web/src/edition.ts`, `scripts/prelaunch.js` and `docs/DEPLOY.md` §3b when done.
