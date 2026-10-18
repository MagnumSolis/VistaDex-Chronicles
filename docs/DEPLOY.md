# Deploying VistaDex (proxy + static site)

Nothing here has been deployed yet. This is the checklist for whoever does it.

```
Browser (GitHub Pages, static)            Cloudflare Worker "vistadex-proxy"          Providers
prototype/ ──POST /screen──────────────►  holds keys as secrets  ───────────────────► Groq, Mistral, TinyFish
           ──POST /events (consented)──►  D1 database "vistadex" (events, traces)
           ──DELETE /session/:id──────►   (withdraw)
researcher ──GET /export (token)───────►  JSON / CSV
```

**Keys never go in the frontend.** `prototype/config.js` only holds the proxy's public URL.

## 0. What you need

| Thing | Cost | Used for |
|---|---|---|
| Cloudflare account | Free plan | Worker (proxy) + D1 (study data) |
| Groq API key | Free tier | Default/bulk LLM (`llama-3.3-70b-versatile`) |
| Mistral API key | Free tier / pay-as-you-go | Extraction/classification (Small) and the Objector (Medium) |
| TinyFish API key | Search + Fetch are free | Live web retrieval |
| Node.js 18+ | — | Running `wrangler` |

All keys are optional. If one is missing, that provider is skipped. If all LLM keys are missing, the stages take their deterministic path. Without a TinyFish key, every claim is `unverified`.

Free-tier limits change, so check the current Workers and D1 limits on Cloudflare's pricing pages before the study. A few hundred participants is well within the free plan.

## 1. Create the Worker and database

```bash
cd worker
npm install                       # installs wrangler (dev dependency only)
npx wrangler login
npx wrangler d1 create vistadex   # prints a database_id
```

Paste the printed `database_id` into `worker/wrangler.toml`, replacing `REPLACE_WITH_ID_FROM_wrangler_d1_create`. The ID is not a secret, so it is safe to commit. Then create the tables:

```bash
npm run db:init                   # runs schema.sql against the remote D1 database
```

## 2. Set secrets

Each command prompts for the value. The value is stored encrypted by Cloudflare and never goes in a file.

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put MISTRAL_API_KEY
npx wrangler secret put TINYFISH_API_KEY
npx wrangler secret put EXPORT_TOKEN      # a long random string; only researchers get it
```

Optional model overrides (defaults shown) can be set as secrets or `[vars]`:
- `GROQ_MODEL=llama-3.3-70b-versatile`
- `MISTRAL_SMALL_MODEL=mistral-small-latest`
- `MISTRAL_OBJECTOR_MODEL=mistral-medium-latest`

## 3. Allowed origins

`ALLOWED_ORIGINS` in `wrangler.toml` lists the browser origins that may call the proxy. For GitHub Pages the origin is just the scheme and host, `https://magnumsolis.github.io`, not the repo path. Remove the localhost entries if you don't want local frontends to reach the deployed proxy.

## 4. Deploy the Worker

```bash
npm run deploy                    # = wrangler deploy; prints https://vistadex-proxy.<subdomain>.workers.dev
```

The Worker imports `../../prototype/core/*`, so deploy from inside a full checkout of this repo.

Smoke test (no browser needed):

```bash
curl -s -X POST "https://vistadex-proxy.<subdomain>.workers.dev/screen" -H "Content-Type: application/json" -d '{"idea_text":"The legal-tech market is worth $27B globally."}' -D -
```

Look for `X-VistaDex-Mode: live` in the response headers. `mock` means no provider keys were picked up.

## 5. Point the frontend at the proxy

In `prototype/config.js`:

```js
export const CONFIG = { PROXY_URL: "https://vistadex-proxy.<subdomain>.workers.dev" };
```

The sidebar badge then reads "Live providers (proxy)", and study events are sent to `/events`.

## 6. GitHub Pages

Pages can only publish from a branch root, from `/docs`, or through a GitHub Actions workflow. The site lives in `prototype/`, so use a workflow:

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Add `.github/workflows/pages.yml` on the branch you publish from:

```yaml
name: Deploy prototype to Pages
on:
  push:
    branches: [master]          # or the branch you publish from
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: prototype }
      - id: deployment
        uses: actions/deploy-pages@v4
```

The site is then at `https://magnumsolis.github.io/VistaDex-Chronicles/`. All asset paths are relative, so the sub-path works.

This workflow is deliberately not committed as an active file: committing it to the publishing branch is what starts a deployment.

## 7. Exporting study data (researchers)

```bash
# all events (one row per event; payload is JSON)
curl -H "Authorization: Bearer $EXPORT_TOKEN" "https://vistadex-proxy.<subdomain>.workers.dev/export?format=csv" -o events.csv
curl -H "Authorization: Bearer $EXPORT_TOKEN" "https://vistadex-proxy.<subdomain>.workers.dev/export" -o events.json
# per-idea pipeline traces (live runs)
curl -H "Authorization: Bearer $EXPORT_TOKEN" "https://vistadex-proxy.<subdomain>.workers.dev/export?table=traces" -o traces.json
```

Participants can also download their own data from the study bar, and withdraw. Withdrawing deletes their events and linked traces in D1 and blocks later uploads for that session.

## 8. Running locally

```bash
npm run serve                     # frontend on http://localhost:5173 (key-free mock path)
npm run dev-proxy                 # the Worker handler in Node on :8787, data in memory, keys from ./.env
npm test                          # unit + Worker tests, no network or keys needed
```

To use the dev proxy, temporarily set `PROXY_URL: "http://localhost:8787"` in `prototype/config.js`, and don't commit that change. `cd worker && npx wrangler dev` runs the real Worker runtime locally against a local D1. Run `npm run db:init:local` first.

## Known gaps before the study

- **`/screen` is open to anyone who finds the URL.** CORS only stops other websites, not scripts, so someone could use up the free provider quotas. Add a Cloudflare rate-limiting rule on `/screen`, or a shared study code, before sharing the link.
- **No automatic retention or deletion schedule.** Decide how long study data is kept and delete it at the end of the course.
- **Graveyard matching is lexical (TF-IDF).** MiniLM embeddings are planned, and the threshold must be re-calibrated when switching.
