# VistaDex Graveyard Backend

Ingest, staging, and discovery for the graveyard database of failed/pivoted startups.

## Data flow

```
loot-drop.io (sitemap crawl, robots-compliant)  ──┐
TinyFish agent fleet (Search/Fetch, free)        ──┤→  graveyard_staging (candidate)  →  [≥2 independent sources]  →  graveyard (confirmed, published)
funding-DB APIs / registries (later)             ──┘         + graveyard_signals (raw leads)
```

**Integrity rule (AGENTS.md #7):** a death is `confirmed` only with ≥2 independent sources (distinct registrable domains). Everything else stays `candidate`. Auto-discovery never auto-publishes.

## Automatic pipeline (every 6 hours)

`.github/workflows/graveyard-sync.yml` runs these steps against Atlas, then exports and deploys:

1. **Smoke test** (`npm run smoke`, key-free, no network).
2. **Discovery** (`FLEET_MODE=discovery`). News Scout and Post-Mortem Miner take the next `DISCOVERY_QUERIES` (default 4) searches from a fixed query bank, in order: a cursor in the `fleet_state` collection means each run continues where the last one stopped (no randomness). Hits go to `graveyard_signals`, except pages that can never be evidence (see below).
3. **Extraction** (`src/extract-signals.js`). Up to `SIGNAL_LIMIT` (default 10) unprocessed signals per run: TinyFish Fetch reads the page, and the pipeline's LLM providers (Mistral, then Groq; same keys as the Worker) list the startups the page says shut down. The output is checked by `validateExtraction` in `src/schemas.js`: the evidence quote must be copied from the page and name the company, a year must appear on the page, and a cause must use the page's words, otherwise the cause stays empty. New companies become `candidate` entries citing the page. A company already in staging gains the page as a source. Calls are 30 s apart to stay inside free-tier limits. Without `GROQ_API_KEY` or `MISTRAL_API_KEY` this step is skipped and the signals wait.
4. **Death Watcher** (`FLEET_MODE=watcher`). Up to `WATCHER_LIMIT` candidates, oldest check first. It searches for the company, fetches the pages and keeps a source only if one sentence names the company and states that it shut down, was acquired or was dissolved (`src/sources.js`). Pages that never count: dictionaries, outage checkers, video sites and app stores, forums, social platforms and graveyard aggregators that republish the same summaries. Bankruptcy alone (Chapter 11) is not a death. An entry is `confirmed` only with good sources on 2 distinct registrable domains; the loot-drop listing an entry came from counts as one. Each good source keeps its evidence sentence in `source_checks`, and each rejected one its reason in `rejected_sources`.
5. **Export** writes confirmed entries to `worker/data/graveyard.json`; the workflow commits it and deploys the Worker.

Nothing is confirmed without 2 good sources, and nothing is invented: a cause of death that no page gives stays empty. `FLEET_MODE=reverify` (`npm run agents:reverify`) re-checks every entry, confirmed ones too, under the current rule. Confirmed entries that fail it go back to `candidate` and drop out of the export.

## Setup

```bash
cd backend && npm install
cp .env.example .env   # then fill in MONGODB_URI + TINYFISH_API_KEY
```

Keys live only in `backend/.env` (gitignored) or server env vars — never in git or frontend code.

## MongoDB Atlas (free for students)

- **M0 free tier**: 512MB, free forever — ~1,600 loot-drop entries use well under 50MB. [Create one here](https://www.mongodb.com/cloud/atlas/register).
- Students also qualify for the [Atlas for Students program](https://www.mongodb.com/students) ($50 credit + M50 cluster) via the BITS email.
- Set `MONGODB_URI` to the connection string (network-access all IPs or your IP).
- Note: vector search on M0 is limited; the Worker currently uses in-app cosine similarity over the live collection, and entries store text ready for MiniLM embeddings when you upgrade tiers.

## Commands

```bash
npm run smoke               # key-free invariants + parser tests (no network)
INGEST_LIMIT=50 npm run ingest:lootdrop   # crawl 50 loot-drop pages into staging (full run: ~35min at 1.2s/page)
npm run db:stats            # staging vs live counts
npm run agents:run          # TinyFish fleet: discovery + extraction + death watcher (FLEET_MODE=discovery|watcher|all)
npm run agents:reverify     # re-check every entry's sources (WATCHER_LIMIT per run)
npm run db:backfill-causes  # re-read loot-drop pages for the Failure Analysis cause of death
npm run db:publish          # copy confirmed staging entries into the live graveyard
```

## TinyFish fleet

Built per the master plan (Notion §5). Uses only the **free** Search + Fetch APIs; ToS-restricted platforms (LinkedIn, Facebook, X/Twitter, Instagram) are hard-blocked in `src/tinyfish.js`. `runAgent` (paid, wallet credits) is available for high-value extraction later — sign up at [tinyfish.ai/students](https://tinyfish.ai/students) with the BITS email for the Student Program credits.

| Agent | What it does | Cost |
| --- | --- | --- |
| News Scout | Search for shutdown announcements | free |
| Post-Mortem Miner | CB Insights/Failory/HN write-ups | free |
| Signal extractor | Fetched signal page → LLM → validated staging candidates | free (TinyFish), LLM free tier |
| Death Watcher | Re-checks staging candidates for a 2nd good source (fetched, names the company, states the death) → confirms | free |
| Registry Reviewer | Dissolution filings (queries run only with `KNOWN_COMPANIES`) | free |
