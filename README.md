# VistaDex Chronicles

> *"Every other tool tells you if your idea looks good today. We tell you if it already died once — and we're honest about how sure we actually are."*

VistaDex is an idea-novelty and overlap screener for **founders, VCs, accelerators and universities**. A person describes an idea; VistaDex produces an evidence-linked report with an **explainable VistaDex Score** (every axis, input, search boundary and weight one tap away; axes without enough data are left out, never guessed); **a human always makes the decision — VistaDex never calls an idea good or bad.**

One app, two editions: a **public demo** (the LinkedIn link: Welcome notice, walkthrough, usage telemetry, feedback) and a **pitch / internal** edition (`#edition=pitch&code=…`: Dashboard of every screened idea, no telemetry at all). The BITS F364 study UI is retired from the routes (`web/src/retired/study/`).

---

## Run it

The frontend is a Vite + React + TypeScript app in `web/` (Tailwind + shadcn/ui). Node 20+:

```bash
npm --prefix web install   # once
npm run serve              # http://localhost:5173
npm test                   # pipeline, proxy and telemetry tests — no keys or network needed
npm run build              # static site in web/dist (GitHub Pages)
```

`npm run parity` and `npm run a11y` (with the dev server running) check telemetry against the event contract (and that the pitch edition sends nothing) and run the accessibility pass at 1280/375/360/320 px. See [`CLAUDE.md`](CLAUDE.md) for the UI design rules.

With no configuration the whole pipeline runs **key-free in the browser**: deterministic, same idea → same report. There's no live evidence in this mode, so claims honestly stay `unverified`. Real providers are used only through the proxy (see [`docs/DEPLOY.md`](docs/DEPLOY.md)).

### Screens (`#/…` hash routes)

| Route | Screen | Edition |
|---|---|---|
| `#/` | Home: the landing page (hero, the problem, what's in a report, product screens, who it's for, try the prototype, the team) | both (pitch opens on Reports) |
| `#/welcome` | What VistaDex does, prototype warning, what is recorded, delete-my-session; "Start with walkthrough" / "Skip to the tool" / "Use without recording" | public (first visit to a recording page) |
| `#/screen` | The form: title, pitch, problem, solution, moat, industry, role, markets; three samples; Run; refusal and daily-cap messages | both (the LinkedIn link) |
| `#/running` | Five-stage tracker with Cancel | both |
| `#/report/:id` | One long page: Summary (VistaDex Score + "How this was calculated", overlap band, status counts) · Profile (radar + donut) · Claims & evidence · Leads to check (competitors + graveyard) · Objections · Big Tech risk · Legal · Market; Save as PDF, Screen another idea | both |
| `#/reports` | Summary blocks (ideas, overlap bands, contradicted claim types, industry mix), sortable and filterable list | public: this browser's reports · pitch: session + demo |
| `#/how-it-works` | Method, statuses, evidence rule, the score and its formulas, overlap and Big Tech risk, data sources, limitations | both |
| `#/contact` | Who we are, email, feedback, data requests, source code | both |
| `#/feedback` | Short feedback form | public |

Live mode never fabricates: competitor search, Big Tech risk and the TAM need live retrieval and a reader; SAM, SOM and legal output are not produced yet ("Not available in this version yet"). The in-browser mock mode shows clearly labelled sample placeholders for them.

---

## Pipeline

```
Idea text
  → Stage 1  Claim extraction     rules type claims; LLM only for claims rules can't type confidently
  → Stage 2  Retrieval + status   TinyFish search/fetch → LLM labels each source's stance (verbatim quote)
                                  → status COMPUTED in code from independent domains
  → Stage 3  Graveyard matching   similarity vs. failed-startup entries (TF-IDF now; MiniLM planned)
  → Stage 4  Objector             stronger model, may only argue against; approvals filtered in code
  → Report → human reviewer decides
```

Status rules (`prototype/core/evidence.js`): **confirmed** = ≥ 2 independent domains support and none contradict; **contradicted** = ≥ 2 contradict and none support; **disputed** = sources on both sides; **unverified** = anything else (no evidence, one source, malformed model output, provider failure). Confidence is the count of independent sources — never the model's self-assessment.

Providers, all behind thin interfaces in `prototype/core/providers/`:

| Role | Default | Fallback |
|---|---|---|
| Extraction / classification | Mistral Small | Groq `llama-3.3-70b-versatile` |
| Objector | Mistral Medium | Groq |
| Web retrieval | TinyFish Search + Fetch | none → `unverified` (swap in Tavily/Firecrawl via `retrieval.js`) |
| Graveyard similarity | TF-IDF cosine (local) | MiniLM slot in `embed.js` |

If a provider errors or rate-limits, the next one is tried; every call, fallback, fetch, judgment, match score and objection is written to one trace per idea.

---

## API contract (POST /screen)

```json
// Request
{ "idea_text": "..." }

// Response
{
  "idea_text": "...",
  "claims": [
    { "claim": "...", "type": "novelty|market_size|defensibility|other",
      "status": "confirmed|contradicted|disputed|unverified",
      "reasoning": "...", "source_urls": ["..."] }
  ],
  "graveyard_matches": [
    { "company_name": "...", "what_they_tried": "...",
      "cause_of_death": "...", "year_closed": 2020, "similarity": 0.87 }
  ],
  "objections": [
    { "objection": "...", "severity": "high|medium|low" }
  ]
}
```

The proxy adds `X-VistaDex-Trace-Id` and `X-VistaDex-Mode` (`live` | `mock`) response headers; the body is exactly the contract.

---

## Repo structure

```
web/                        frontend: Vite + React + TS + Tailwind + shadcn/ui (static build → web/dist)
  src/edition.ts            the only module that knows the edition (features)
  src/router.ts src/boot.ts hash routes; link fragments (#edition=, #code=) captured first
  src/screens/              Home, Welcome, ScreenIdea, Running, ReportScreen, Reports, HowItWorks, Contact, Feedback
  src/components/report/    report sections: summary + score, profile, claims, leads, objections, Big Tech, legal, market
  src/components/charts/    Radar, Donut, Bars, Pie (SVG, with hidden data tables)
  src/telemetry/            the only caller of telemetry.js; controls.ts = control ids (contract)
  src/walkthrough/          coach-mark walkthrough
  src/lib/                  run controller, report store, Reports sorting/filtering, samples, word overlap
  src/retired/study/        retired BITS F364 study UI (not routed)
  src/index.css             design tokens (colours, radii, fonts, print)
  scripts/                  parity.mjs, a11y.mjs, access-e2e.mjs, shots-all.mjs (drive the installed Chrome)
prototype/                  shared, framework-free code (imported by web/ and the Worker)
  config.js                 PROXY_URL (public URL only — never keys)
  core/                     pure ES modules shared by browser and Worker
    pipeline.js             runScreen(input | ideaText, deps) → { report, trace }
    contract.js rules.js evidence.js quotes.js trace.js input.js finalize.js
    scoring.js scoring-config.js   explainable scores; every weight and threshold (pinned by a test)
    stages/                 extract.js classify.js competitors.js bigtech.js market.js graveyard.js objector.js
    providers/              llm.js (Groq, Mistral, fallback) retrieval.js (TinyFish) embed.js
  data/                     graveyard.js (seed set), cohort.js (demo ideas, sample idea), samples.js (mock-mode placeholders)
  ui/                       client.js (proxy vs mock), telemetry.js (event log, export, withdraw),
                            study-config.js (notice + feedback wording, open decisions, STUDY_VERSION)
worker/                     Cloudflare Worker proxy: /screen /events /session/:id /export
  src/index.js src/store.js schema.sql wrangler.toml
scripts/                    dev-proxy.js (Worker handler in Node)
tests/                      node:test suites; fixtures/event-contract.json (telemetry contract)
docs/STUDY-NOTES.md         instrumentation changes to report in the study write-up
docs/DEPLOY.md              deployment + data export
.env.example                key names (copy to .env locally; never commit .env)
```

---

## Telemetry (public edition only)

- The Welcome notice comes first and nothing is recorded before the visitor chooses; "Use without recording" records nothing at all. Kept for 12 months under a random session ID; no names, emails, IP addresses or user agents.
- Every button press / control (stable `data-control` ids), time per screen, per report section in view and per walkthrough step, and run events described by counts only: **the idea text and the report content are not logged**.
- Batched uploads to `/events` (at most one request per 10 s, 200 events each). Visitors can delete their session (local + server, including linked traces). Feedback is sent under a separate random id.
- The pitch edition sends **zero** events (`telemetry.js` is disabled at startup); tests and `npm run parity` check this.
- Links carry a shared access code in the URL fragment (`#code=…`); the proxy also applies per-IP rate limits and a daily cap on `/screen` — see `docs/DEPLOY.md` §3b.
- Every event carries `study_version` (`2026-10-public-1`). The contract in `tests/fixtures/event-contract.json` keeps the pilot-2 study contract under `history`.

---

## Team

| Member | Owns |
|--------|------|
| **Kushagra Agnihotri** | Claim extraction, live retrieval, matching engine (LLM/RAG) |
| **Lakshit Tanwar** | Entity resolution, graveyard tagging pipeline, accuracy testing |
| **Richeek Mishra** | Reviewer dashboard and idea-report interface (UI/UX) |
| **Aditya Pradhan** | Overall architecture, data ingestion, integration |

Documentation (methodology, architecture, pitch deck) lives on the `main` branch.

---

*BITS Pilani · BITS F364 Human-AI Interaction · Fall 2026*
