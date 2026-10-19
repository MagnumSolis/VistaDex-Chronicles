# VistaDex Graveyard Backend

Ingest, staging, and discovery for the graveyard database of failed/pivoted startups.

## Data flow

```
loot-drop.io (sitemap crawl, robots-compliant)  ──┐
TinyFish agent fleet (Search/Fetch, free)        ──┤→  graveyard_staging (candidate)  →  [≥2 independent sources]  →  graveyard (confirmed, published)
funding-DB APIs / registries (later)             ──┘         + graveyard_signals (raw leads)
```

**Integrity rule (AGENTS.md #7):** a death is `confirmed` only with ≥2 independent sources (distinct registrable domains). Everything else stays `candidate`. Auto-discovery never auto-publishes.

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
npm run agents:run          # TinyFish fleet: news scout, post-mortem miner, death watcher
npm run db:publish          # copy confirmed staging entries into the live graveyard
```

## TinyFish fleet

Built per the master plan (Notion §5). Uses only the **free** Search + Fetch APIs; ToS-restricted platforms (LinkedIn, Facebook, X/Twitter, Instagram) are hard-blocked in `src/tinyfish.js`. `runAgent` (paid, wallet credits) is available for high-value extraction later — sign up at [tinyfish.ai/students](https://tinyfish.ai/students) with the BITS email for the Student Program credits.

| Agent | What it does | Cost |
| --- | --- | --- |
| News Scout | Search for shutdown announcements | free |
| Post-Mortem Miner | CB Insights/Failory/HN write-ups | free |
| Death Watcher | Re-checks staging candidates for a 2nd independent source → confirms | free |
| Registry Reviewer | Dissolution filings (queries defined, wiring later) | free |
