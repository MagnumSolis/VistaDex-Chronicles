# VistaDex handover: code, study and next steps

Hi team. VistaDex is built, deployed and ready for an audit and then the study. This message has everything
you need. Please read it fully before touching the code or starting sessions.

## 1. What VistaDex is

An evidence-linked startup idea screener for our BITS F364 (Human-AI Interaction) project. Someone describes
an idea (title, pitch, problem, solution, moat, industry, role, target markets). VistaDex:

1. splits it into checkable claims;
2. checks each claim against independent web sources and labels it Confirmed, Contradicted, Disputed or
   Unverified (a status needs two different websites);
3. finds competitors and Big Tech activity;
4. matches the idea against a graveyard of startups that shut down;
5. writes objections against the idea;
6. finds market size and the legal rules for the chosen markets;
7. computes an explainable VistaDex Score in code (never by a model).

It never says "good idea" or "bad idea". The person decides.

**Research question:** when people judge a startup idea, does an evidence-linked report change their
judgement differently from a general AI chatbot, and do they actually check the evidence?

## 2. Links

| What | Where |
|---|---|
| Live site | https://vistadex-app.pages.dev |
| Study entry page | https://vistadex-app.pages.dev/#/study |
| Demo edition (records nothing) | https://vistadex-app.pages.dev/#edition=pitch |
| Research console (token needed) | https://vistadex-proxy.vistadex-team.workers.dev/research |
| Code | GitHub: MagnumSolis/VistaDex-Chronicles |

Ask me for the console token privately. Never paste it in a group chat or a URL.

## 3. Read in this order

1. `CLAUDE.md`: the project's rules (product principles, design, git, telemetry). These are binding.
2. `docs/GUIDE.md`: how to ship, use, run the study, get numbers and write the paper.
3. `docs/STUDY-PROTOCOL.md`: the full study procedure and analysis plan.
4. `docs/STUDY-NOTES.md`: every change to what we measure, by study version (needed for the method section).
5. `docs/LAUNCH-PLAN.md`: the audit that led to the final fixes, and optional improvements.

## 4. The code

### Layout

| Folder | What |
|---|---|
| `web/` | The site (React, Vite, Tailwind). Screens in `web/src/screens`, report in `web/src/components/report` |
| `prototype/core/` | The pipeline shared by browser and server: stages, scoring, contract |
| `prototype/core/scoring-config.js` | Every score weight and threshold, pinned by a test |
| `prototype/ui/study-config.js` | Visitor-facing wording, study version, notice text |
| `worker/` | Cloudflare Worker: runs live screenings, stores study data in D1, research console |
| `backend/` | The graveyard fleet (finds and confirms shut-down startups in MongoDB Atlas) |
| `analysis/` | Script that turns exported data into the paper's numbers |
| `tests/`, `web/src/test/` | Node and web tests |

### Run it locally

You need Node 22.

```bash
npm ci --prefix web && npm ci --prefix backend
```

```bash
npm test
```

```bash
npm run test:web
```

```bash
npm run serve
```

The last one opens the site on http://localhost:5173 in mock mode (no web search, no keys needed). With the
dev server running, `npm run a11y` and `npm run parity` check accessibility and telemetry.

### How changes go live

- Work on a branch, open a pull request. GitHub runs all tests on every PR (the "ci" check).
- Never commit to `main` directly. Merge with a merge commit once the check is green.
- Merging to `main` deploys the site and the Worker automatically.
- Never commit secrets. Keys live in GitHub and Cloudflare secrets; you don't need them to audit.

### Rules that matter most

- Every score is computed in code and explainable. A missing axis says "Not enough data", never a guess.
- Finding nothing never scores as good (Novelty, Graveyard and Legal are capped at 70 when nothing is found).
- A status needs two independent sources; quotes must appear word for word on the cited page.
- Never invent facts, sources or numbers.
- **Any visitor-facing change bumps `STUDY_VERSION`** and resets consent. Do not change the site during the study.

## 5. What is live now

- Live screening in about a minute: claims with quoted sources, competitors, Big Tech risk, market size, legal
  rules per market (EU, USA, India), objections, a six-axis score.
- Graveyard: about 740 confirmed shut-down startups, grown automatically every few hours.
- Same input gives the same report for 24 hours; the team can **freeze** a report so it never changes.
- Limits: 3 screenings a minute per visitor, 300 a day overall.
- Privacy: no names, emails or IP addresses; idea text never in usage data; data deleted after 12 months;
  people who choose "Use without recording" leave only a minimal technical log.
- Study version: `2026-11-study-11`.

## 6. Study methodology

### Design

- **Study track (controlled, within subjects).** Each participant judges the same assigned idea twice: once
  with an AI chatbot of their choice, once with VistaDex. Order is counterbalanced by participant code: odd
  codes do the chatbot first, even codes VistaDex first. Four fixed ideas (A to D).
- **Field track (observational).** Anyone from our LinkedIn, X or investor links who accepts the notice,
  screening their own idea. Used for descriptive findings only, never causal claims.

### Hypotheses

- **H1** Confidence in the idea moves differently after VistaDex than after a chatbot.
- **H2** People open the evidence (links opened, and how many sources they say they checked).
- **H3** People tell verdicts apart: agreement differs by claim status. Agreeing with "contradicted" as
  often as with "confirmed" would mean labels are trusted, not read.
- **H4** Opening evidence is associated with a different confidence change (association only).

### Measures

- Confidence in the idea, 0 to 100, before and after each part.
- Ratings 1 to 7: trust, usefulness, helped me see what to verify, effort.
- Agree / disagree / not sure on every claim and objection.
- Evidence links opened, reading time per report section and per claim.
- What "unverified" means to them (comprehension check), sources checked (self-report), open comments.

### Before the first participant (team tasks)

1. **Audit and freeze the four study reports.** For each idea A to D: open `#/study`, enter a code starting
   with `TEST`, pick the idea, run the VistaDex part. Two of us read the report: are the claims, statuses and
   quotes right? Then in the console: Research, Report cache, **Freeze** that idea. Every participant with
   that idea will then see exactly that report.
2. **Pilot** two full sessions: `TEST01` (chatbot first) and `TEST02` (VistaDex first). Console, Paired
   study must show "Complete: yes" for both. TEST codes are left out of all analysis automatically.
3. **Code sheet**, kept outside the repo: `P01`, `P02`, ... with ideas rotated so each idea appears in both
   orders (P01 A, P02 A, P03 B, P04 B, P05 C, P06 C, P07 D, P08 D, then repeat). Note the date, who ran the
   session and anything unusual. Never write names in the app.
4. **Target: at least 20 complete pairs** (recruit about 25). A paired test cannot show anything below 6.
5. **Freeze the version.** No visitor-facing changes while the study runs.

### Running one session (about 20 minutes)

1. Give the participant their code and open https://vistadex-app.pages.dev/#/study
2. They accept the notice, choose "I have a participant code", enter code and role, and pick the idea from
   the sheet.
3. They do both parts in the order the code sets:
   - **Chatbot part:** confidence before, paste the idea into their usual chatbot, read the answer,
     confidence after, ratings.
   - **VistaDex part:** confidence before, read the report as long as they like, then "Your read" at the end
     (confidence after, agree / disagree per item, ratings).
4. Do not help with the task itself; answer only procedure questions.
5. Check the console, Paired study: their row says "Complete: yes". Debrief.

### Field track sharing links

Put the channel before the `#` so each visit is counted by channel:

- https://vistadex-app.pages.dev/?utm_source=linkedin
- https://vistadex-app.pages.dev/?utm_source=x
- https://vistadex-app.pages.dev/?utm_source=investors

Never share the `#edition=pitch` link for the study: it records nothing.

## 7. Data and analysis

### Research console

| View | Use |
|---|---|
| Insights | each finding in plain words with its n; "not enough data yet" below the minimum |
| Paired study | one row per code, both parts side by side, paired tests |
| Funnel | where people drop out |
| Research | per run; Report cache with Freeze; every written answer |
| Sessions | delete test sessions (permanent) |
| Export | "Download all tables" (8 analysis-ready files) and raw data |

Check weekly: Insights, Data quality (sliders left at 50, version mix), Funnel.

### Getting the paper's numbers

Export `events.json` from the console, then, with an output folder **outside** the repo:

```bash
node analysis/study_analysis.mjs ~/Downloads/events.json --out ~/vistadex-analysis
```

It writes `report.md`, `summary.json` and CSV tables. The console and the script use the same code, so the
numbers match. Never put participant data in the repository.

### Analysis plan (agreed before data collection)

1. H1: Wilcoxon signed-rank on confidence change, VistaDex minus chatbot, per participant, two-sided. Report
   n, median difference, W and p, and effect size.
2. Secondary measures (trust, usefulness, verify, effort, sources checked): same test, Holm correction.
3. Order check: Mann-Whitney, chatbot first vs VistaDex first.
4. H2: share of runs with evidence opened; compare with self-report.
5. H3: agree / disagree / not sure by claim status; Fisher's exact test.
6. H4: association only.
7. Field track: descriptive by role and channel.
8. Open answers: two of us code themes independently, then compare.

## 8. The paper

Outline and figures are in `docs/GUIDE.md` section 5. Limitations to state:

- We measure confidence change, not calibration (no idea has a recorded right answer).
- Small sample; the chatbot's answer is not captured; four fixed ideas; the field track is self-selected.
- Graveyard matching is by shared words, not meaning; verdicts can still be wrong on hard claims.
- The report changed across study versions (`docs/STUDY-NOTES.md` lists every change).

## 9. What I need from the audit

1. The four study reports: are claims, statuses and quotes correct before we freeze them?
2. The Welcome notice and privacy text (`prototype/ui/study-config.js`) against what we actually store.
3. Scoring rules and weights (`prototype/core/scoring-config.js`) and how they are explained on How it works.
4. Run through the study flow once each, on a phone and a laptop.

Report issues as GitHub issues, or fix them on a branch with a PR. Please don't push to `main`.

## 10. Security

- I am rotating the Groq key and the MongoDB password before giving wider access.
- The console token can read and delete study data: only the person running sessions needs it.
- Don't put real names, emails or confidential ideas in test runs.

Questions: ask me before changing anything visitor-facing, scoring, or telemetry.
