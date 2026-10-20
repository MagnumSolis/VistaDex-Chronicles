#!/usr/bin/env bash
# backend/sync.sh — one command: confirm more deaths, export, commit, push.
# Usage:
#   ./sync.sh              # fleet pass (20 candidates) + export + commit + push
#   WATCHER_LIMIT=200 ./sync.sh   # bigger fleet pass
# After pushing, tell the agent (or run `npx wrangler deploy` from a machine
# with wrangler) to redeploy the Worker with the new snapshot.
set -e
cd "$(dirname "$0")"

echo "── fleet pass (confirming deaths) ──"
npm run agents:run

echo "── export confirmed → snapshot ──"
npm run db:export

echo "── stats ──"
npm run db:stats

cd ..
git add worker/data/graveyard.json
if git diff --cached --quiet; then
  echo "No new confirmed entries — nothing to commit."
else
  git commit -m "data: graveyard snapshot update ($(date +%Y-%m-%d))"
  git push
  echo "Pushed. Worker redeploy needed: npx wrangler deploy (agent side), then the site serves the new snapshot."
fi
