# VistaDex: the owner's guide

Everything you need to ship VistaDex, run the study and write the BITS F364 (Human-AI Interaction) paper.
Written 2026-11-12. Times are IST. Read this first; it points to the detailed documents where they exist.

| You want to... | Read |
|---|---|
| Ship the build | section 1 |
| Use the product, or explain it in a demo | section 2 |
| Run the study | section 3 and `docs/STUDY-PROTOCOL.md` |
| Watch data and get numbers | section 4 |
| Write the paper | section 5 |
| Know what is still yours to do | section 6 |
| Answer questions in the viva | section 7 |

---

## 1. Ship the build

### 1.1 Merge the launch PRs, in this order

Each is checked on its own and on top of the ones before it. Merge with a merge commit, in order:

1. **#27** CI on every PR, automatic site deploy (P0-1)
2. **#28** Graveyard cap, student/other roles, stale wording fixed, `study-11` (P0-4, P0-5)
3. **#29** Timeouts, retries, call budget (P0-3)
4. **#30** 3 screenings a minute per visitor, failed runs refund the cap (P0-2)
5. **#31** 12-month deletion, minimal logs when not recorded (P0-6)
6. **#32** Report cache and frozen study reports (P0-7)
7. **#26** The launch plan (docs only) and the PR with this guide (docs only), any time

After #27, every later PR shows a green or red "ci" check before you merge it.

### 1.2 Two settings only you can change

- **Cloudflare API token.** GitHub, Settings, Secrets, `CLOUDFLARE_API_TOKEN` must include
  *Workers Scripts: Edit* **and** *Cloudflare Pages: Edit*. Without Pages permission the site job fails (the
  Worker still deploys). Create the token at dash.cloudflare.com, My Profile, API Tokens.
- **Workers plan.** dash.cloudflare.com, Workers, Plans. Free allows 50 outgoing calls per request; a run now
  stays under 45 by design. The paid plan ($5 a month) allows 1,000 and removes that worry.

### 1.3 After the last merge (about 5 minutes)

1. GitHub, Actions: `deploy` is green (both the Worker job and the pages job).
2. Open https://vistadex-app.pages.dev: Home shows the straight sample card. How it works describes the live
   graveyard.
3. Cloudflare dashboard, Workers, `vistadex-proxy`, Triggers: the cron `30 3 * * *` is listed (daily
   cleanup at 09:00 IST).
4. One live screening from the pitch edition (`https://vistadex-app.pages.dev/#edition=pitch`, which records
   nothing): load the "AI scribe" sample, tick EU, USA, India, Run. Expect a report in about a minute with
   competitors, market, legal per market. Run it again with the same input: it returns at once (cached).
5. `npm run prelaunch` passes once you sign off the feedback wording (section 6).

---

## 2. Using VistaDex

### 2.1 For a visitor (what people from LinkedIn and X see)

1. **Welcome.** A notice says what is recorded. "Take part" records usage; "Use without recording" records
   nothing (the server keeps only a minimal technical log without any text).
2. **Screen an idea.** Title, pitch, problem, solution, moat (optional), industry, role, target markets (EU,
   USA, India). Or load one of three samples. Press Run; a live run takes about a minute.
3. **The report**, top to bottom:
   - **Summary**: the VistaDex Score (0 to 100), overlap band, claim status counts, when the evidence was gathered.
   - **Profile**: the six axes on a radar, each with "How this was calculated".
   - **Claims**: each checkable claim from the idea with a status (Confirmed, Contradicted, Disputed,
     Unverified), why, and the quoted sources. A status needs two independent websites.
   - **Leads to check**: similar products named on web pages, and shut-down startups worded alike.
   - **Objections**: the strongest arguments against the idea, with the same visual weight as claims.
   - **Big Tech risk**, **Legal** (registries and rules per market), **Market** (TAM as the median of
     quoted figures).
   - **Your read**: confidence after reading, agree / disagree per claim and objection, ratings. This is the
     study's main measure.
4. **Reports** lists the visitor's past reports (saved in their browser only).

### 2.2 The score in one paragraph (for demos)

Six axes, each computed in code from the report, never by a model: Novelty (competitors and novelty claims),
Market (TAM on a log scale), Defensibility (moat claims and objections), Graveyard distance (word overlap with
shut-down startups), Evidence quality (share of claims backed by two sources), Regulatory load (rules named by
two sources in the target markets). Big Tech is shown but not counted. An axis without data is left out, never
guessed, and finding nothing never scores as good (Novelty, Graveyard and Legal are capped at 70 when nothing
is found).

### 2.3 The editions

- **Public** (default link): records consented usage. This is the version for LinkedIn, X and investors.
- **Pitch** (`#edition=pitch`): records nothing, opens on Reports with demo ideas. For live demos only. It is
  not protected; never describe it as locked.

### 2.4 Share links

Put the channel before the `#`, so each visit is counted by channel:

- `https://vistadex-app.pages.dev/?utm_source=linkedin`
- `https://vistadex-app.pages.dev/?utm_source=x`
- `https://vistadex-app.pages.dev/?utm_source=investors`

---

## 3. Running the study

The full protocol is `docs/STUDY-PROTOCOL.md`. The short version:

### 3.1 Before the first participant

1. **Freeze the four study reports.** For each idea A to D: open `#/study` with a code like `TEST01`, choose the
   idea, run the VistaDex part once. Read the report with a teammate. Then Console, Research, *Report cache*,
   press **Freeze** on that idea. From then on every participant with that idea sees exactly that report.
   (If a report has an obvious pipeline error, unfreeze, fix or rerun, freeze again.)
2. **Pilot**: two full sessions with `TEST01` (chatbot first) and `TEST02` (VistaDex first). Check *Paired
   study* shows "Complete: yes" for both. TEST codes are left out of all analysis automatically.
3. **Prepare the code sheet** (outside the repo): `P01`, `P02`, ... with ideas rotated so each idea appears in
   both orders (P01 A, P02 A, P03 B, P04 B, ...). Odd codes do the chatbot first.
4. **Freeze the version**: no UI changes while the study runs. Every visitor-facing change bumps
   `STUDY_VERSION` and splits your data.
5. **Target**: at least 20 complete pairs; recruit about 25.

### 3.2 One session (about 20 minutes)

1. Give the code; open `https://vistadex-app.pages.dev/#/study`.
2. Participant accepts the notice, picks "I have a participant code", enters code and role, picks the idea
   from your sheet.
3. Part 1 and part 2 in the order the code sets: the chatbot part (confidence before, ask their usual chatbot,
   confidence after, ratings) and the VistaDex part (confidence before, read the frozen report, Your read).
4. Check *Paired study*: "Complete: yes". Debrief.

### 3.3 The field track

Post the share links. Everyone who accepts the notice is a field participant, screening their own idea. Use it
for descriptive findings (what people read, who opens evidence, differences by role and channel), never for
causal claims.

---

## 4. Data and numbers

### 4.1 The Research Console

`https://vistadex-proxy.vistadex-team.workers.dev/research`, sign in with the research token (never put it in
a URL).

| View | Use it to |
|---|---|
| Overview | totals and latest sessions |
| Insights | each finding in words with its n; "not enough data yet" below the minimum |
| Participants, Paired study | per session; per study code with the paired tests |
| Funnel | where people drop out (study and field tracks) |
| Research | per run; **Report cache** with Freeze; every written answer |
| Feedback | confidence and ratings per condition; the feedback form |
| Sessions | delete test sessions (permanent) |
| Export | "Download all tables" (8 analysis-ready files) and the raw data |

Check weekly: Insights, Data quality (sliders left at 50, version mix), Funnel.

### 4.2 Getting the paper's numbers

Export `events.json`, then with an output folder outside the repo:

```bash
node analysis/study_analysis.mjs ~/Downloads/events.json --out ~/vistadex-analysis
```

It writes `report.md` (every finding and table), `summary.json`, and the CSVs (`paired`, `runs`, `votes`,
`attention`, `segments`, `open-answers`). The console and the script run the same code, so numbers match.
Never put participant data in the repository.

---

## 5. The paper (BITS F364, Human-AI Interaction)

### 5.1 The question

When people judge whether a startup idea is novel and viable, does an evidence-linked report change their
judgement differently from a general AI chatbot, and do they actually check the evidence it shows?

### 5.2 Hypotheses (pre-register these before data collection)

- **H1** Confidence moves differently after VistaDex than after a chatbot (paired, within subjects).
- **H2** People open the evidence (rate of runs with evidence opened; self-report vs behaviour).
- **H3** People tell verdicts apart: agreement differs by claim status (contradicted vs confirmed vs unverified).
  Agreeing with everything alike suggests the labels are taken on trust.
- **H4** Opening evidence is associated with a different confidence change (association only).

### 5.3 Suggested structure (CHI-style short paper, about 6 to 8 pages)

1. **Introduction**: AI tools judge ideas confidently and opaquely; sycophancy, untrustworthy citations, no
   memory of failures. Contribution: an evidence-linked screening tool and a within-subjects study of how
   people use it against a chatbot.
2. **Related work**: AI sycophancy and over-reliance; explainable AI and appropriate trust; verification
   behaviour with citations (people rarely click sources); automation bias; tools for startup evaluation.
   Find and cite real papers yourself; do not cite anything you have not read.
3. **System**: the pipeline (claims, two-source rule, competitors, graveyard, objections, market, legal), the
   explainable score and its principles (absence never scores as good, no verdict words), the interface
   choices (status by label and icon, equal weight for objections). Include one report screenshot.
4. **Method**: within-subjects design, counterbalanced order by code, four fixed ideas with frozen reports,
   measures (confidence before and after, ratings 1 to 7, agree / disagree per item, evidence links opened,
   reading time per section, comprehension of "unverified"), participants (n, roles), procedure, ethics
   (notice, withdrawal, 12-month retention, no names).
5. **Results**: H1 with Wilcoxon signed-rank (n, median difference, W, p, effect size r = Z / sqrt(n)); the
   secondary measures with Holm correction; the order check; H2 rates; H3 table by status (Fisher's exact on
   agree vs not); H4 as association; field-track descriptives by role; themes from open answers (two coders).
6. **Discussion**: what the pattern means for designing evidence-linked AI (for example, if people agree with
   contradicted verdicts as much as confirmed ones, labels are trusted rather than read), design implications,
   and the limits below.
7. **Limitations**: confidence change is not calibration (no ground truth unless you write an answer key for A
   to D); small sample; the chatbot's answer is not captured; fixed ideas; field track self-selected;
   report content changed across versions (`docs/STUDY-NOTES.md` lists every change).
8. **Conclusion**.

### 5.4 Figures and tables worth making

- Paired dot plot: each participant's confidence change with the chatbot vs VistaDex, joined by a line.
- Agreement by claim status: stacked bars (agree, not sure, disagree) per status.
- Attention: share of runs that viewed each report section, and median seconds.
- Funnel: study and field.
- One annotated report screenshot.

### 5.5 What to keep for the write-up

- `docs/STUDY-NOTES.md`: every instrumentation change per version (method section).
- The frozen reports for A to D (export from Console, Research, the trace id; or a PDF of each).
- `report.md` and `summary.json` from the analysis script, dated.
- Your code sheet and session log (outside the repo).

---

## 6. Still yours to do

### Decisions (no code)

| Item | Where | Suggested |
|---|---|---|
| Approve the feedback wording, set `FEEDBACK.signedOff = true` | `prototype/ui/study-config.js` | the only thing failing `npm run prelaunch` |
| Approve the four study pitch lines | `web/src/study/participant.ts` | read them once |
| Per-person daily limit | would need a hashed IP; the notice says no IP is kept | keep it off; 3 a minute and the 300 cap are enough at launch |
| Calibration answer key for A to D | `docs/STUDY-PROTOCOL.md` section 1 | do it if the paper should claim calibration |
| Daily cap | `SCREEN_DAILY_CAP` in `worker/wrangler.toml` | raise from 300 only after checking quotas |

### Accounts and keys (security)

- Rotate the **Groq key** that was once pasted as a secret name; set the new one with `gh secret set` and
  `npx wrangler secret put GROQ_API_KEY`.
- Reset the **MongoDB Atlas password** for `vistadexteam_db_user` (it was exposed earlier); update
  `MONGODB_URI` in GitHub secrets and `backend/.env`.
- Keep the research token private; anyone with it can read and delete study data.

### Services this project runs on

| Service | What for | Watch |
|---|---|---|
| Cloudflare Pages | the site | deploys in GitHub Actions |
| Cloudflare Workers + D1 | the proxy, study data, report cache | plan (subrequest limit), D1 size |
| Mistral (main) and Groq (fallback) | claim judging, extraction, objections | free-tier rate limits |
| TinyFish | web search and page fetching | 150 page fetches a minute; daily quota |
| MongoDB Atlas | the graveyard database | free tier storage |
| GitHub Actions | CI, deploys, the graveyard fleet every 2 hours | minutes on the free plan |

### Next improvements (from `docs/LAUNCH-PLAN.md`, after launch)

1. P1-2 an accuracy test for claim judging, then P1-3 better claim extraction.
2. P1-1 graveyard matching by meaning instead of shared words (biggest product gain).
3. P2-1 a shareable report link (the growth loop for LinkedIn posts).
4. P1-6 real progress during the minute-long wait.

Hand each to a fresh session with the plan file and its id.

---

## 7. Understanding it (for the viva)

- **Two independent sources**: different websites, counted by registrable domain (two pages on one site are
  one source). Fewer than two on either side leaves a claim unverified; sources on both sides make it disputed.
- **Verbatim quotes**: a model may only cite a page with a sentence that is on that page; code checks it and
  assigns the URL. This is the main guard against invented citations.
- **Why unverified is normal**: most specific claims are not settled by the open web. The interface gives it
  equal visual weight so it does not read as failure.
- **Why scores are computed in code**: every number can be taken apart; the model never scores. Absence is
  capped so not finding something never flatters an idea.
- **Graveyard**: built by an automated fleet (TinyFish search, LLM extraction with quotes, a confirmation step
  that needs two pages on different sites stating the shutdown). About 640 entries and growing every 2 hours.
- **Same input, same report**: reports are cached for a day and study reports are frozen, so a participant's
  experience does not depend on what the web returned that minute.
- **Privacy by design**: no names, emails or IPs; idea text never in usage events; a minimal log for people who
  are not recorded; withdrawal deletes a session; everything older than 12 months is deleted daily.
- **Within-subjects with counterbalancing**: each participant uses both tools on the same idea; order is set by
  the code so learning effects cancel out across the sample.
- **Wilcoxon signed-rank**: a paired test that does not assume normal differences, suited to small samples and
  0 to 100 sliders. It needs at least 6 pairs to reach p < 0.05 at all.
