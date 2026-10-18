# VistaDex Chronicles

> *"Every other tool tells you if your idea looks good today. We tell you if it already died once — and we're honest about how sure we actually are."*

VistaDex is an idea-novelty and overlap screener for **accelerators, universities, and VC funds**. A person submits an idea; VistaDex produces an evidence-linked report; **a human reviewer always makes the final decision — VistaDex never gives a verdict.**

It is also our BITS F364 (Human-AI Interaction) course project; the prototype includes consent-gated study instrumentation for real participants.

---

## Run it

ES modules don't load from `file://`, so serve the folder (Node 18+, no install needed):

```bash
npm run serve        # http://localhost:5173
npm test             # all tests, no keys or network needed
```

With no configuration the whole pipeline runs **key-free in the browser**: deterministic, same idea → same report. There's no live evidence in this mode, so claims honestly stay `unverified`. Real providers are used only through the proxy (see [`docs/DEPLOY.md`](docs/DEPLOY.md)).

### Three screens

| Screen | Description |
|--------|-------------|
| **Cohort Dashboard** | 8 hand-written **demo** ideas (fictional submitters). Shows claim-status counts and graveyard leads, sorted by contradicted + disputed claims |
| **Screen an Idea** | Paste idea text → 4-stage pipeline → claims with evidence, graveyard leads, Objector. Study consent, trust sliders, per-claim agreement and survey live here |
| **Graveyard DB** | 20 seed entries (failed, pivoted or acquired startups) with cause-of-death filters |

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
prototype/                  static site (GitHub Pages)
  index.html, style.css
  config.js                 PROXY_URL (public URL only — never keys)
  core/                     pure ES modules shared by browser and Worker
    pipeline.js             runScreen(ideaText, deps) → { report, trace }
    contract.js rules.js evidence.js trace.js
    stages/                 extract.js classify.js graveyard.js objector.js
    providers/              llm.js (Groq, Mistral, fallback) retrieval.js (TinyFish) embed.js
  data/                     graveyard.js (seed set), cohort.js (demo ideas, sample idea)
  ui/                       app.js report.js client.js escape.js
                            study.js telemetry.js study-config.js (consent, survey wording)
worker/                     Cloudflare Worker proxy: /screen /events /session/:id /export
  src/index.js src/store.js schema.sql wrangler.toml
scripts/                    serve.js (static server), dev-proxy.js (Worker handler in Node)
tests/                      node:test suites
docs/DEPLOY.md              deployment + data export
.env.example                key names (copy to .env locally; never commit .env)
```

---

## Research instrumentation

- Consent screen before first use; declining keeps the tool usable and records nothing.
- Pre-use and post-use trust sliders (1–7), agree / disagree / unsure on every claim status, a 5-item survey plus optional comments.
- Timestamped events under a random anonymous session ID: claim expanded, source clicked, objections/graveyard viewed, time on report, ratings, survey.
- No names, emails, IP addresses or user agents. Idea text is stored (participants are warned not to include identifying details).
- Participants can download their data (JSON/CSV) and withdraw (local + server deletion). Researchers export from the Worker with a token.

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
