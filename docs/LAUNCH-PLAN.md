# VistaDex launch plan (handover for an implementing model)

Written 2026-11-12 from a scan of `main` at `b393b8b` (study_version `2026-11-study-10`).
Audience: the model (Opus 5.5 or Sonnet 5.5) that will do the work, one workstream per session and PR.

**How to read the evidence labels.** "Verified" means I ran it or read the exact code. "Observed live" means
seen in a production run on 11 or 12 Nov. "Likely" means inferred from code and not yet reproduced: reproduce
it with a failing test before fixing.

---

## 0. Rules for every session (non-negotiable)

Read `CLAUDE.md` first; it overrides this file. In short:

- Branch from latest `main` (`git fetch` first). One PR per workstream, merged by the owner with a merge commit.
  Never commit to `main`, never squash, rebase or force-push. Ask before the first push.
- Stage files by name. One commit per fix. Show the failing test before its fix. Chain checks and commit with `&&`.
- Never commit secrets, participant data, `docs/PR-*.md` or `docs/screenshots/`.
- No `Math.random` in production code. Tests never reach the network. Never query production D1 from a script.
- No em dashes in new text. Times to the owner in IST.
- Bump `STUDY_VERSION` (`prototype/ui/study-config.js`, `tests/fixtures/event-contract.json`, README, a section in
  `docs/STUDY-NOTES.md`) whenever visitor-facing UI, report content, scores or telemetry change.
- Every weight and threshold lives in `prototype/core/scoring-config.js` and is pinned in
  `tests/scoring-config.test.js`.
- Product principles: every score explainable; absence never scores as a good result; never "good idea / bad
  idea"; never invent facts; a status needs 2 independent sources.
- After any UI change: `npm test`, `npm run test:web`, typecheck, then with the `web` dev server running
  `npm run a11y` and `npm run parity`. Restart the dev server after switching branches (stale module cache).
- Live checks: use the pitch edition (`#edition=pitch`) so nothing lands in study data. Each live screening
  costs provider quota; do not loop them.
- The implementing model must not enter production tokens. The owner signs in to the console and sets secrets.

Useful facts: Node 22 at `~/.nvm/versions/node/v22.23.4/bin`. Pages deploy is manual today:
`npx -y wrangler@4 pages deploy web/dist --project-name vistadex-app --branch main --commit-hash <sha>`.
The Worker deploys itself on pushes to `worker/**` or `prototype/**`.

---

## 1. What works today (verified live, 12 Nov)

- A live screening with EU + USA + India: claims with quoted sources, competitors, Big Tech, market size, legal by
  market, objections, a 6-axis score. About 60 to 75 seconds, 36 to 41 outgoing calls.
- Graveyard: 636 confirmed entries in the live snapshot, grown by a fleet every 2 hours.
- Study track (`#/study`), "Your read", telemetry contract, Research Console with Insights and exports,
  `docs/STUDY-PROTOCOL.md`, analysis script.
- 180 node tests, 125 backend smoke checks, 189 web tests, axe accessibility and telemetry parity scripts.

---

## 2. P0: fix before posting the link publicly

Do these in order. Each is its own PR.

### P0-1. CI on pull requests, and automatic Pages deploy  (Sonnet 5.5)
- **Verified:** PRs show zero checks. `.github/workflows/` has only `deploy.yml` and `graveyard-sync.yml`. The
  site is deployed by hand from one laptop; `deploy.yml` ignores `web/**`.
- **Do:** add `.github/workflows/ci.yml` on `pull_request` and pushes to `main`: `npm ci` (root and `web/`),
  `npm test`, `npm --prefix backend run smoke`, `npm run test:web`, `web` typecheck, `npm run build`. Add a Pages
  job to `deploy.yml` (build, then `wrangler pages deploy web/dist --project-name vistadex-app --branch main`),
  triggered by `web/**` and `prototype/**` too. Optional: run `a11y` and `parity` in CI against `vite preview`
  with Playwright Chromium.
- **Done when:** a PR that breaks a test shows a red check; a merge that touches `web/` updates the live site
  without a laptop. Update `docs/DEPLOY.md` (it still describes GitHub Pages).

### P0-2. Abuse and cost limits  (Opus 5.5)
- **Verified:** `worker/wrangler.toml` allows 30 screenings per minute per IP, and the global cap is 300 a day.
  One visitor or script can use the whole day's cap in 10 minutes. A screening that fails still uses a cap slot
  (`takeDailyScreen` runs before the pipeline).
- **Do:** lower `SCREEN_LIMITER` to about 3 per minute; add a second limiter with a longer window if the plan
  allows, or a per-session daily count (session id sent by the client, counted in D1, no IP stored); return the
  cap slot when the pipeline throws. Keep the existing friendly 429 messages. Consider Cloudflare Turnstile on
  the Run button as a follow-up (owner decision: it adds friction).
- **Owner decision:** per-person daily limit (suggest 10) and whether to raise the 300 cap after checking the
  TinyFish and Mistral dashboards.

### P0-3. Timeouts, retries and a call budget  (Opus 5.5)
- **Verified:** no `AbortController`, `AbortSignal` or timeout anywhere in `prototype/core` or `worker/src`.
  Provider calls have no retry; an HTTP 429 from TinyFish or Mistral silently drops that stage. A run used 41
  outgoing calls; the Workers free plan allows 50 per request.
- **Do:** in `prototype/core/providers/llm.js` and `retrieval.js`, give every call a timeout (about 20 s) and one
  retry with backoff on 429 and 5xx. Add a per-run call counter in `pipeline.js` that refuses optional stages
  (legal for the third market, then Big Tech) before the budget is exceeded, and say so in the report section
  ("not searched this run") instead of "none found". Log budget and timeouts in the trace.
- **Owner check:** which Workers plan the account is on (subrequest limit 50 free, 1000 paid).
- **Done when:** tests with a fake fetch that hangs or returns 429 show a finished report with the affected
  section marked, never a hung request.

### P0-4. Statements in the UI that are no longer true  (Sonnet 5.5)
All verified in code.
- `web/src/lib/run.ts`: on a live run the "Legal & market" stage is set to `skipped`, and after the run its note
  is "Not in this version yet" or "Sample data (mock mode)". Legal and market are live now.
- `web/src/screens/HowItWorks.tsx`: says the graveyard has `SEED.length` (18) startups and that the team checked
  0 of them, in two places. Live reports check 636 fleet-confirmed entries. Show the live count (take it from
  the last report's `search.graveyard.entries_checked`, or publish the count in a small JSON the site loads) and
  describe the automatic two-source check. The Graveyard axis text says "word overlap ... verified seed".
- `scripts/prelaunch.js`: warnings say legal output is not produced, registries list unconfirmed, and it cannot
  see `ACCESS_CODES` although the gate is off by design. Refresh the list.
- `web/src/types.ts` `Role` is founder / investor / accelerator, while the audience includes students and the
  study track records "student". Add "student" and "other" to the Screen form and the Feedback form
  (`FEEDBACK.role` has only founder / investor / other). This changes a telemetry enum: update the contract.
- Walkthrough step "Legal and market" says "Where this version can't produce them, the section says so".
- Grep the web app for "not available in this version", "planned", "mock" and "sample" and check each one.
- **Done when:** a test renders each screen and fails on the stale phrases; version bumped.

### P0-5. Graveyard axis rewards finding nothing  (Opus 5.5)
- **Verified:** `graveyardAxis` in `prototype/core/scoring.js` returns 100 when no entry matches. That breaks
  "absence never scores as a good result" (Novelty is capped at 70 for the same case). With word-overlap
  matching most ideas match nothing, so most reports get 100 on a 15-weight axis.
- **Do:** add `GRAVEYARD.noMatchCap` (suggest 70) to `scoring-config.js`, pin it, note it in the axis ("no close
  match among N entries: not proof nobody tried"), update How it works, bump the version.

### P0-6. Stored logs: retention and people who chose not to be recorded  (Opus 5.5)
- **Verified:** every `/screen` call saves a trace (extracted claim text, searches, sources) in D1, including
  runs from the pitch edition and from visitors who chose "Use without recording". A trace is deleted only when
  a session that logged its `trace_id` withdraws. The notice promises deletion after 12 months
  (`RETENTION_PERIOD`), and `docs/DEPLOY.md` says there is no deletion schedule.
- **Do:** (a) a scheduled Worker handler (`[triggers] crons`) that deletes events, sessions and traces older
  than the retention period, with a test on the memory store; (b) the client sends a "no record" flag when the
  visitor has not consented or is in the pitch edition, and the Worker then stores a trace without claim text
  and idea-derived strings (keep counts, timings, errors) or does not store one; (c) make the Welcome notice
  wording match exactly what is kept. This touches the frozen `/screen` contract and notice text: confirm the
  wording with the owner first.

### P0-7. The same idea gives different reports  (Opus 5.5)
- **Observed live:** four runs of one idea within an hour gave 6, 6, 6 and 3 claims, a TAM from 3 sources, then
  none, then 1 source, and one claim as Confirmed, Contradicted and Unverified.
- **Why it matters:** in the study track every participant with idea A must see the same report, or the
  within-subjects comparison measures the lottery, not the tool.
- **Do:** a report cache in D1 keyed by a hash of the normalised input plus a pipeline version constant. Study
  ideas (`sample: "study_A"` to `"study_D"`): serve a frozen report that the team has run once and reviewed (a
  console action "freeze this report for idea A"). Field runs: serve a cached report for the same input for 24
  hours (saves quota too). The report shows "Checked on <date>". Add `X-VistaDex-Cache: hit|miss`.
- **Also:** set `seed` where the provider supports it; sort search results by URL before prompting so order
  does not change the answer.
- **Owner task after merge:** run and review ideas A to D, freeze them, then start the study.

### P0-8. Owner-only items (no code)
- Approve the feedback wording, then set `FEEDBACK.signedOff = true` (the only thing failing `npm run prelaunch`).
- Approve the four study pitch lines (`web/src/study/participant.ts`).
- Rotate the Groq key that was pasted into a secret name, and the Atlas password for `vistadexteam_db_user`.
  Confirm the Mistral key works (it returned 401 earlier; live runs currently succeed on Mistral, so it may be
  fixed).
- Decide: per-person limit (P0-2), no-record trace policy (P0-6), calibration answer key (section 5).
- Pilot two full study sessions with `TEST01` and `TEST02`, then delete them in the console.

---

## 3. P1: quality of the report (after P0, before or during the first week)

### P1-1. Graveyard matching by meaning, and richer entries  (Opus 5.5)
- **Verified with the live snapshot:** matching is TF-IDF word overlap with a threshold (0.15) calibrated on 18
  entries. "Premium short-form video for phones" matches Quibi at only 0.18; the AI scribe idea matches nothing
  in 636. All 636 entries have `cause_category: "other"` and `country: null`; 29 have no sector.
- **Do:** embeddings for matching. Precompute a vector per entry in `backend/src/export-graveyard.js` (Workers AI
  `@cf/baai/bge-small-en-v1.5` or the same model run in the fleet), store them next to the snapshot, embed the
  idea at request time (one extra call), score by cosine blended with the current lexical score. Keep the
  key-free path on TF-IDF. Build an evaluation file of about 30 ideas with the entries they should match, and
  pick the threshold from it; pin it in `scoring-config.js`. In the fleet, backfill `cause_category`, `sector`
  and `country` from each entry's sources (LLM with a verbatim quote, same rule as everywhere).
- **Report:** show each lead's cause category and year; group "why they died" when 2 or more leads share a cause.

### P1-2. An accuracy test for claim judging  (Opus 5.5)
- **Observed live (fixed case by case so far):** product lists confirming a "nothing exists" claim, numbers that
  miss a threshold counted as support, general statements confirming specific claims.
- **Do:** a golden set built from `prototype/data/sample-reports.js` (15 ideas with hand-checked evidence and
  stances) plus the 12 Nov cases: recorded page text, claim, expected stance. A script (`npm run eval:judge`,
  manual, needs keys, not part of `npm test`) reports agreement per stance; a key-free unit test covers the code
  guards. Use it before changing any prompt. Add guards for: thresholds (compare numbers in claim and quote when
  both have one), and quotes that support only a weaker statement.
- **Still wrong live:** "Large vendors are prevented from competing..." stays Confirmed from general text.

### P1-3. Claim extraction  (Sonnet 5.5 after P1-2 exists)
- **Observed live:** "The target market is solo-practice physicians" and "HIPAA compliance is a requirement"
  are extracted as claims and Confirmed; they are descriptions, and they inflate Evidence quality. Claim count
  varies 3 to 6 for the same text.
- **Do:** tighten `EXTRACT_PROMPT` (a claim must be something that could be false and that the idea depends on),
  drop restatements of the product, merge near-duplicates (the two defensibility claims), and prefer at least
  one novelty, one market and one defensibility claim when the text has them. Evaluate on the 15 samples.

### P1-4. Market size details  (Sonnet 5.5)
- **Verified:** `moneyAmounts` reads only USD. Figures mix years and forecasts: one quote gave "$36.67 billion in
  2026 ... USD 194.79 billion" and the current value was used by luck of order.
- **Do:** parse the year next to each amount and prefer the most recent past or current year over forecasts;
  label forecasts and leave them out of the median; read EUR, GBP and INR (crore, lakh) with a fixed, dated
  conversion table and show the original; show the market each figure measures (already in `figures[].market`).

### P1-5. Legal depth  (Opus 5.5)
- **Observed live:** every rule is "named by one source only", so the Regulatory load axis is nearly always its
  no-data cap (70); India usually finds nothing.
- **Do:** two searches per market, one restricted to official domains (`eur-lex.europa.eu`, `ecfr.gov`,
  `fda.gov`, `indiacode.nic.in`, `meity.gov.in`, `cdsco.gov.in`); merge near-identical rule names ("HIPAA
  Security Rule" and "HIPAA Privacy and Security Rules"). Owner decision: whether one official government page
  may count as enough for a rule (I recommend yes, labelled "official source").
- Keep the call budget (P0-3) in mind: this adds 3 to 6 calls.

### P1-6. Run screen during the 60 to 75 second wait  (Opus 5.5)
- **Verified:** live runs show every stage as "server" with no progress.
- **Do:** stream stage events from the Worker (Server-Sent Events from `/screen` behind an `Accept` header, or a
  `/screen/status/<trace>` poll) using the existing `onStage` hook, so the tracker shows real stages. Keep the
  current response for clients that do not ask for the stream. Contract change: document it.

---

## 4. P2: features worth adding (pick with the owner)

1. **Shareable report link** (Opus 5.5). Reports live only in the browser that ran them, so nobody can post
   their report on LinkedIn or send it to a co-founder. Add "Share this report": stores a read-only copy on the
   server on the user's explicit action, at an unguessable URL, with an expiry and a delete link; the page has
   its own preview card (score, claim counts). This is the main growth loop for a LinkedIn launch. Needs a
   notice line and a retention rule.
2. **"What to verify next" checklist** at the end of the report: unverified claims, one-source rules and
   figures, and leads, as a list the person can tick and export (Markdown or PDF).
3. **Compare two versions of an idea**: rerun after edits and show what changed in claims and score.
4. **Console health view**: today's cap usage, provider errors and fallbacks per day, median run time, calls
   per run, fleet status and graveyard growth, progress toward the target number of complete pairs.
5. **Trace viewer** in the console: open one run and see searches, pages, judgments kept and dropped.
6. **Pitch edition code** checked by the Worker (`PITCH_CODES`), as `docs/BACKEND-HANDOFF.md` section 7 plans.
7. **Calibration answer key** for ideas A to D so the paper can report calibration, not only confidence change
   (see `docs/STUDY-PROTOCOL.md` section 1).
8. **Basics for a public launch**: `robots.txt`, a `/health` route on the Worker (it returns 404 today), an
   uptime check, a custom domain, a short privacy page linked from the footer.

---

## 5. Study readiness checklist (owner, after P0)

1. P0-7 merged; ideas A to D frozen and read by two team members.
2. `npm run prelaunch` passes. Version frozen: no UI deploys while the study runs.
3. Two TEST pilots done and deleted; both show "Complete: yes" in Paired study.
4. Codes and ideas sheet prepared (`docs/STUDY-PROTOCOL.md` section 3); at least 20 complete pairs targeted.
5. Share links use `?utm_source=linkedin`, `x`, `investors` before the `#`.
6. Console checked on day 1 and weekly: Insights, Data quality, Funnel.

---

## 6. Suggested order and model choice

| Order | Workstream | Model | Why |
|---|---|---|---|
| 1 | P0-1 CI and Pages deploy | Sonnet 5.5 | mechanical, unblocks safe merges for everything after |
| 2 | P0-4 stale statements | Sonnet 5.5 | text and small UI, well specified |
| 3 | P0-5 graveyard axis cap | Opus 5.5 | scoring change, small but principle-bound |
| 4 | P0-3 timeouts and budget | Opus 5.5 | failure-path design across providers and pipeline |
| 5 | P0-2 limits | Opus 5.5 | abuse model, storage without IPs |
| 6 | P0-6 retention and no-record | Opus 5.5 | privacy and contract change, wording with the owner |
| 7 | P0-7 report cache and frozen study ideas | Opus 5.5 | research validity depends on it |
| 8 | P1-2 judging eval, then P1-3, P1-4 | Opus, then Sonnet | build the measure before tuning prompts |
| 9 | P1-1 semantic graveyard | Opus 5.5 | largest product gain; needs an evaluation set |
| 10 | P1-5, P1-6, then P2 by choice | Opus 5.5 | |

Give each session: this file, the workstream id, and "follow CLAUDE.md and section 0". Ask it to (1) reproduce
the finding with a failing test, (2) fix, (3) run all checks, (4) open one PR that states what was and was not
verified live.

**Minimum to post publicly:** P0-1 to P0-6 and the owner items in P0-8. **Minimum to start the controlled
study:** all of that plus P0-7 and section 5.

---

## 7. What this scan did not cover

- I did not read every web component line by line (about 1,450 lines of screens); P0-4 asks for a targeted grep.
- I did not load-test the Worker or check provider dashboards for remaining quota.
- Fleet internals changed today in another session (PRs #18 and #22); I checked its output (636 entries), not
  its code.
- "Likely" items: the client may also lack a request timeout in `web/src/proto` (not read); check with P0-3.
