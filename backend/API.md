# VistaDex Backend API Contract

The backend the new UI (built by Claude Code per the Project Hub) connects to. All endpoints are served by the Cloudflare Worker; the UI never talks to Groq/Tavily/TinyFish/Mongo directly and never holds API keys.

**Base URL (deployed):** `https://vistadex.vistadex-team.workers.dev`
**Base URL (local dev):** `http://localhost:8787`

## Endpoints

### POST /api/screen — run the 4-stage pipeline on an idea

Request:
```json
{ "idea": "<idea text, 1–5000 chars>", "session_id": "<pseudonymous UUID>" }
```

Response (the unified output contract, identical shape in DEMO_MODE and real mode):
```json
{
  "ok": true,
  "result": {
    "claims": [
      { "claim": "...", "type": "novelty|market_size|defensibility|other",
        "status": "confirmed|contradicted|disputed|unverified",
        "reasoning": "...", "sources": ["https://real-url-only.example"] }
    ],
    "graveyard_matches": [
      { "company_name": "Atrium", "what_they_tried": "...", "cause_of_death": "...",
        "year_closed": 2020, "similarity": 87 }
    ],
    "objections": [ { "objection": "...", "severity": "high|medium|low" } ]
  },
  "trace": [ { "stage": "extract", "ts": 812, "provider": "groq", "claims": 4 } ]
}
```

Errors: `{ "ok": false, "error": "invalid_idea" | "rate_limited" | "no_llm_configured" | "screen_failed" }`.
With no LLM keys configured the frontend falls back to DEMO_MODE automatically (key-free path always green).

### POST /api/events — telemetry ingestion (public demo edition only)

Request: `{ "session_id": "...", "ts": "ISO timestamp", "event": "<event_name>", "payload": { ... } }`

Telemetry rules per the hub (decided 19 Oct): every button press + time spent; users are told what is recorded; 12-month retention; the pitch/internal edition sends nothing. No PII, no idea text in payloads.

Standard event names (the UI should emit these; the backend accepts any):
| Event | Payload shape |
| --- | --- |
| `consent_granted` | `{}` |
| `page_view` | `{ page: "dashboard|screen|graveyard" }` |
| `button_press` | `{ button: "run_pipeline|load_sample|view_report|...", context: "..." }` |
| `time_spent` | `{ screen_or_section: "...", ms: 1234 }` |
| `pipeline_run` | `{ mode: "demo|real", duration_ms, claims, graveyard_matches, objections }` |
| `claim_expanded` / `graveyard_card_opened` / `evidence_link_clicked` | `{ id, ... }` |
| `trust_slider_pre` / `trust_slider_post` | `{ value: 0–100 }` |
| `claim_agree` / `claim_disagree` / `objection_agree` / `objection_disagree` | `{ claim_index, status }` |
| `csat_rating` | `{ rating: 1–5 }` |
| `feedback_text` | `{ length }` (length only — free text stays in the UI's own store if PII-risky) |
| `reviewer_note` | `{ idea_id, length }` |
| `walkthrough_step` | `{ step: 1..n, completed: true|false }` |
| `pipeline_error` | `{ mode, error }` |

Storage: forwarded to `EVENTS_SINK_URL` (Mongo/Atlas collection or D1 via the weekend-prototype worker) with schema `{"session_id", "ts", "event", "payload", "received_ts"}`. If unreachable, the UI queues in localStorage and flushes later — the backend never blocks UX on telemetry.

### POST /api/session/withdraw — GDPR-style deletion

Request: `{ "session_id": "..." }` → deletes/flags all events for that session. No access code needed (per hub: withdrawal works without it).

### GET /api/export — researcher data export

Header: `Authorization: Bearer <RESEARCHER_EXPORT_TOKEN>` → all events (respecting retention window). Token is a Worker secret; never in the UI.

### GET /api/graveyard — browse the graveyard (for the public Graveyard DB view)

Query params: `?q=<search>&cause=<category>&sector=<sector>&page=1&limit=50`
Response: `{ ok: true, entries: [ ...graveyard docs... ], total: 123, page: 1 }`
Only `death_status: "confirmed"` + `source_verified: true` entries are served publicly.

### GET /api/health

`{ "ok": true, "ts": 169... }`

## Graveyard document schema (per Project Hub, decided 19 Oct)

```json
{
  "company_name": "Theranos",
  "what_they_tried": "...",
  "failure_reason": "...",
  "cause_category": "fraud|unit-economics|timing|competition|regulation|team|product-failure|market-need|pivot|other",
  "year_closed": 2018,
  "closure_date": "2018-09-04",
  "raised": "$945M",
  "funding_rounds": [ { "date": "2014-02-01", "amount": "$50M", "lead_investor": "...", "valuation": null } ],
  "sector": "Health Care",
  "product_type": "Medical",
  "country": "USA",
  "registry_record": "https://opencorporates.com/...",
  "search_status": { "failure_reason": "found", "registry_record": "searched_not_found", "funding_rounds": "never_searched" },
  "source_urls": ["..."],
  "source_verified": true,
  "death_status": "confirmed",
  "primary_source": "loot-drop.io"
}
```

Blank ≠ guessed: a field that can't be found stays `null`, and `search_status` records whether it was searched ("searched_not_found") vs never attempted ("never_searched").

## Safety rails (mirror of the weekend-prototype rules)

- One shared access code for run endpoints (link fragment `#code=...`); withdraw works without it.
- Rate limits: ~30 runs/min, ~60 telemetry/min per IP; IP never stored.
- Daily run cap so API credit can't be burned.
- Fails closed if the access-code secret is missing.
