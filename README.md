# VistaDex

**Idea-novelty and overlap screener** for accelerators, universities, and VC funds. A submitted idea is decomposed into atomic falsifiable claims, each verified against live web evidence, matched by meaning against a graveyard database of failed/pivoted startups, and challenged by an adversarial Objector pass before a human reviewer sees the report.

> Every other tool tells you if your idea looks good today. We tell you if it already died once — and we're honest about how sure we actually are.

Also a BITS Pilani F364 (Human-AI Interaction) research project: the deployed app gathers real consented telemetry (trust, agreeableness, satisfaction). No synthetic data in the study.

## Live demo

- **App**: https://vistadex.vistadex-team.workers.dev (Cloudflare Worker — frontend + API proxy)
- **Key-free mode**: append `?demo=1` (or run with no LLM keys configured — the app falls back to the simulated pipeline automatically).
- **Real pipeline**: with `GROQ_API_KEY`/`TAVILY_API_KEY` secrets set, the same UI runs the live 4-stage pipeline.

## Architecture

- `prototype/` — static frontend (vanilla JS). `pipeline.js` routes DEMO_MODE vs real pipeline; both satisfy the same output contract `{claims, graveyard_matches, objections}`.
- `worker/` — Cloudflare Worker (`/api/screen`, `/api/events`, `/api/health`). All Groq/Tavily/Mistral calls happen server-side; the frontend never holds keys.
  - Stage 1: claim extraction — Groq `llama-3.3-70b-versatile`, structured output `{"claims": [...]}`.
  - Stage 2: Tavily search per claim (max 5 results) + Groq classification; only real retrieved URLs are cited.
  - Stage 3: graveyard matching — stopgap in-app cosine-similarity over the local 20-entry DB; MongoDB Atlas `$vectorSearch` (all-MiniLM-L6-v2) is the production target.
  - Stage 4: Objector pass — argues only AGAINST the system's conclusion (Mistral preferred, Groq fallback).
- `prototype/telemetry.js` — consent-gated instrumentation: pseudonymous session IDs, localStorage queue, `POST /api/events`.

## Environment variables (server-side only — `wrangler secret put NAME`)

| Variable | Used by | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | `/api/screen` stages 1–4 | Primary LLM (llama-3.3-70b-versatile) |
| `TAVILY_API_KEY` | `/api/screen` stage 2 | Live web evidence retrieval |
| `MISTRAL_API_KEY` | `/api/screen` stage 4 | Objector-quality calls / LLM fallback |
| `EVENTS_SINK_URL` | `/api/events` | Optional HTTP sink for telemetry (Mongo/Atlas ingest later) |
| `EVENTS_SINK_TOKEN` | `/api/events` | Optional bearer token for the sink |

Keys are never in frontend code or git (see `.env.example`). Local dev: put them in a gitignored `.dev.vars`.

## Development

```bash
npm install
npx wrangler dev      # local dev with assets + API
npx wrangler deploy   # deploy
```

Branch off `master` (not `main`). The 8 `COHORT_IDEAS` in `prototype/data.js` are the regression bank.

## Agent rules

See [AGENTS.md](AGENTS.md) — binding rules for any coding agent (no LinkedIn scraping, abstain-never-guess, no `Math.random()` in production paths, consent-gated telemetry, graveyard integrity ≥2 sources, small commits).
