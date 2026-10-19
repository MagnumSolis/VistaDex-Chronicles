# AGENTS.md — VistaDex Agent Rules

These rules are binding for every coding agent working in this repository. Violations are critical bugs, not style issues.

## Product
VistaDex is an idea-novelty and overlap screener for accelerators, universities, and VC funds. A submitted idea is (1) decomposed into atomic falsifiable claims, (2) each claim verified against live web evidence, (3) matched by meaning against a graveyard database of failed/pivoted startups, and (4) challenged by an adversarial Objector pass before a human reviewer sees the report.

This is also a BITS Pilani F364 research project. The final paper requires **real consented user telemetry — no synthetic data in the study**. Instrumentation is a first-class feature.

## Binding rules

1. **Never scrape LinkedIn** or any platform with restrictive Terms of Service. Public news, company sites, registries, and funding-DB APIs only.
2. **Honesty contract — abstain, never guess.** Missing or contradictory evidence → status `unverified`, always. Confidence is derived from independent-source counts, never model self-assessment.
3. **No `Math.random()` in any production code path.** It may exist only inside DEMO_MODE simulation code, clearly flagged.
4. **Key-free smoke path always green.** The app must run end-to-end with zero API keys (DEMO_MODE), including a key-free smoke test in CI/local checks.
5. **API keys never in frontend code or git.** Keys live only in serverless function / Cloudflare Worker environment variables (or a gitignored `.env`). A key in a frontend file is a critical bug.
6. **Participant privacy.** No telemetry is logged before an explicit consent banner is accepted. Pseudonymous session IDs only (random UUID per session); no PII in event logs.
7. **Graveyard integrity.** A startup death is "confirmed" only with ≥2 independent sources. Judgment calls are always framed as "verify yourself — not a verdict".
8. **Small focused commits**; one concern per commit; never commit `.env`, keys, or `node_modules`.

## Workflow

- Branch off `master` (not `main` — `main` is docs-only). Do not force-push or rewrite history.
- Do not open PRs against `main` for prototype work.
- The 8 `COHORT_IDEAS` in `prototype/data.js` are the regression bank: their known-correct outcomes must hold after every pipeline change (e.g. LegalAI must still surface Atrium as top graveyard match with the novelty claim contradicted).
- Both the DEMO_MODE simulated pipeline and the real pipeline must satisfy the same output contract consumed by `renderLiveReport()`:
  `{ claims: [{claim, type, status, reasoning, sources}], graveyard_matches: [{company_name, what_they_tried, cause_of_death, year_closed, similarity}], objections: [{objection, severity}] }`

## Deployment (Cloudflare)

The production target is Cloudflare: static frontend (Pages) + API proxy, pipeline, and events ingestion (Workers). Wrangler config lives in `wrangler.toml` / `wrangler.jsonc`. Secrets are set with `wrangler secret put`, never written to files that are committed.
