# Running the VistaDex study, and getting usable numbers out

This is the practical guide: what the study asks, how to run a session, how to watch the data in the
Research Console, and how to get the paper's numbers. Instrumentation changes per version are in
[STUDY-NOTES.md](STUDY-NOTES.md); the event contract is `tests/fixtures/event-contract.json`.

## 1. What we want to find out

**Question.** When people judge whether a startup idea is novel and viable, does an evidence-linked report
(VistaDex) change their judgement differently from a general AI chatbot, and do they actually check the
evidence it shows?

| | What it asks | Measured by |
|---|---|---|
| **H1** | Does confidence in the idea move differently after VistaDex than after a chatbot? | Confidence slider (0 to 100) before and after, in both parts of the study track |
| **H2** | Do people open the evidence? | Evidence links opened (claim sources, graveyard, competitors, Big Tech, legal, market) and the "how many sources did you check" self-report |
| **H3** | Do people agree with every verdict alike, or tell the statuses apart? | Agree / disagree / not sure per claim, by the claim's status (contradicted, disputed, unverified, confirmed) |
| **H4** | Is opening evidence associated with a different confidence change? | Confidence change in runs with and without evidence opened |
| **H5** | How do the chatbot's answer and the VistaDex report differ, and which do people prefer? | The pasted chatbot answer next to the participant's VistaDex report (counted features and human ratings, section 7a), and the six comparison questions (study-16 on) |

Also measured, for context: which report sections people read and for how long, trust / usefulness /
"helped me see what to verify" / effort ratings (1 to 7), whether people read "unverified" correctly,
and all of it by role (founder, investor, student, ...) and channel (LinkedIn, X, investors, direct).

**What the data cannot show.** Calibration: whether confidence moved toward the *right* answer. No idea
here has a recorded right answer, so H1 is confidence *change*. If the paper needs calibration, write an
answer key for the four study ideas (A, B, D, E; C is retired) before the study: for each claim, the verdict two team
members agree on from their own research. TODO(team): decide whether to add the key.

## 2. Two tracks

- **Study track (controlled, within subjects).** Recruited participants (students, founders, anyone you
  sit with) do both parts on the same idea: an AI chatbot of their choice with one fixed prompt, then
  VistaDex, in an order set by the code's number (odd: chatbot first; even: VistaDex first), then a
  comparison of the two. study-16 to 18 fixed the order (chatbot first); study-19 counterbalances it again,
  and those earlier participants stay in the analysis, tagged with their version. This is where H1, H5 and
  the reliance measures are tested.
- **Field track (observational).** Everyone who opens the public link (LinkedIn, X, investors) and accepts
  the Welcome notice, screening their own idea. Self-selected, so use it for descriptive findings (who
  reads what, who opens evidence, how ratings differ by role), not for causal claims.

## 3. Before the first participant

1. **Pilot with TEST codes.** Run two full sessions yourselves with codes `TEST01` and `TEST02`, one after
   the other in the same browser (press "Next participant" at the end of the first). Check that both show
   "yes" under Complete in **Paired study** and a row in **Chatbot vs VistaDex**. TEST codes are left out of
   Insights, the exports and the analysis script automatically (tick "include TEST codes" to see them).
2. **Freeze the version.** Every visitor-facing change bumps `study_version` and resets consent. Do not
   deploy UI changes while the study runs; if you must, note the date and analyse by version (Insights,
   Data quality, and `summary.json` list the versions).
3. **Prepare the codes and ideas.** `P01`, `P02`, ... up to the number you recruit, each with an assigned
   idea, rotated by the letter participants see: A, B, C, D, then again from A. Since study-23 the shown letters A, B, C, D are stored as keys A, B, D, E (key C is the retired mock-interview idea), and the console shows both. Keep this sheet *outside the repository*, with the date, who ran the session
   and anything unusual. Note on the sheet when a participant used their own idea instead (idea "own");
   decide as a team how many own-idea sessions you want, since they are analysed separately too. Never put names in the app.
4. **Decide the sample size now.** A paired Wilcoxon test cannot reach p < 0.05 with fewer than 6
   complete pairs, and only large effects show with 10 to 15. Aim for **at least 20 complete pairs**, and
   recruit about 25 to allow for drop-outs. Write the analysis plan (section 7) down before you start.

## 4. Running one study session

The study page tells participants about 20 minutes; time your pilot to check. One laptop, a quiet room, and do not
help with the task itself: answer only questions about the procedure.

1. Open `https://vistadex-app.pages.dev/#/study`. If the page says the browser was last used by another
   participant, press **Start a new participant** (or use a fresh private window). Give the participant their code.
2. They choose "I have a participant code", enter the code and their role, and pick the idea from your
   sheet under "The idea you'll judge", or "My own idea" if they bring one (typed once, used for both
   parts). Then **Start part 1** and they answer the Welcome notice themselves.
3. **Chatbot part.** Copy the prompt (one button) → paste it into a new chat in the chatbot they normally
   use and send it → while it writes, four sliders: confidence before, market familiarity, trust in AI
   chatbots, how often they use them → read the answer as they normally would (follow-ups allowed) → paste
   the whole answer back, with the chatbot used, the model if known and whether it searched the web →
   confidence after, ratings and "how many sources did you check".
4. **VistaDex part.** Confidence before → they run the idea (pre-filled) and read the report as long as
   they like → **Your read** at the end of the report: confidence after, agree / disagree / not sure per
   claim and objection, ratings, and the "what does unverified mean" question.
5. **Comparison.** Six questions, each "the AI chatbot / VistaDex / about the same", and why.
6. Check **Paired study** (Complete "yes") and **Chatbot vs VistaDex** (their row has both answers). If
   not, note what is missing on your sheet.
7. Debrief: what the study was about, and the withdrawal contact on the notice. Then press **Next
   participant** on the last page before the next person sits down.

## 5. Field track: sharing the link

Share links with the channel before the `#`, so each visit is counted by channel:

- LinkedIn: `https://vistadex-app.pages.dev/?utm_source=linkedin`
- X: `https://vistadex-app.pages.dev/?utm_source=x`
- Investors (email, WhatsApp): `https://vistadex-app.pages.dev/?utm_source=investors`

Nothing is recorded before the Welcome notice is answered, and nothing after "Use without recording".
No idea text and no report content is recorded; runs are described by lengths and counts. The pitch
edition (`#edition=pitch`) records nothing at all, so never send it to people whose use you want to count.

## 6. Watching the data (Research Console, `/research`)

- **Overview**: totals and the latest sessions.
- **Insights**: each finding in plain words with its n. "Not enough data yet" marks a finding whose group
  is below the minimum (6 pairs, 5 runs per group, 10 votes). The tables below it are H3 by status, what
  people read, and every measure by role, channel and track.
- **Funnel**: where people drop out. Study track: registered → chatbot part → VistaDex part → complete
  pair. Field track: started a screening → got a report → ... → rated the report. A big drop between
  "got a report" and "answered confidence after" means people leave before Your read.
- **Paired study**: one row per code, both parts side by side, and the paired test per measure.
- **Participants / Research / Feedback**: per session, per run, and every rating and written answer.
- **Weekly check** (Insights, Data quality): sliders left at 50 ("untouched"), runs matched by start order,
  the version mix, TEST codes. Report untouched sliders, or rerun H1 without them.

## 7. Getting the numbers out

**From the console:** Export → **Download all tables**. Every table is built in the browser from the live
data, with TEST codes left out:

| File | One row per | Use it for |
|---|---|---|
| `paired.csv` | study code | H1 and the paired measures (`chatbot_*` vs `vistadex_*`) |
| `runs.csv` | screening run | H2, H4, field-track analysis: confidence, evidence opened by kind, votes, ratings, time on the report |
| `votes.csv` | item voted (latest vote) | H3: `claim_status` or `objection_severity` against `vote` |
| `attention.csv` | finished run | seconds each report section was in view |
| `segments.csv` | group | the Insights tables by role, channel and track |
| `open-answers.csv` | written answer | qualitative coding |
| `comparison.csv` | study code (study-16 on) | H5: counted features of the chatbot answer and the report side by side, what the report found that the chatbot also named, the six preferences and why, the profile covariates |
| `chatbot-answers.csv` | study code (study-16 on) | H5: both answers in full, with empty columns for raters (section 7a) |
| `participants.csv` | session | the Participants view |
| `insights.json` | | every number in Insights, for scripts |

**The chatbot answers and reports, side by side (database):** the Worker keeps one row per study
participant in the D1 table `study_comparisons`: the pasted chatbot answer, the VistaDex report they saw
(snapshot and full report) and their preference answers. Console → Chatbot vs VistaDex → `comparisons.csv`
(both as text, one row per participant, ready for the raters) or `comparisons.json` (with the full
reports, for scripts). The panel there says whether the table matches the events; "Rebuild from events"
recreates it. From a terminal: `curl -H "Authorization: Bearer $EXPORT_TOKEN"
"https://vistadex-proxy.vistadex-team.workers.dev/export?table=comparisons&format=csv"`.

**For the paper (reproducible):** Export → `events.json`, then, with an output folder outside the repo:

```bash
node analysis/study_analysis.mjs ~/Downloads/events.json --out ~/vistadex-analysis
```

It writes `report.md` (every finding and table), `summary.json` and the same CSVs. It runs the same code as
the console (`analyzeStudy` in `worker/src/research-join.js`), so the numbers match. Participant data never
goes into the repository: the script refuses an output folder inside it.

**Analysis plan (write it down before you start):**

1. **Primary, H1:** Wilcoxon signed-rank on confidence change, VistaDex minus chatbot, per participant,
   two-sided. Report n, the median difference, W+ / W- and p (exact up to 25 pairs).
2. **Secondary:** the same test for confidence after, trust, usefulness, "helped see what to verify",
   effort and self-reported sources. Correct these for multiple comparisons (Holm), and say so.
3. **Order check:** the confidence-change difference by order (chatbot first vs VistaDex first),
   Mann-Whitney. A difference means the first part influenced the second; report it either way.
4. **H2:** share of runs with evidence opened, and which kinds; compare the self-report with what was
   opened.
5. **H3:** the agree / disagree / not sure table by claim status. With small counts, test agree vs not
   by status with Fisher's exact test (R: `fisher.test`) on `votes.csv`.
6. **H4:** report as an association only (people choose to open links).
7. **Field track:** descriptive, by role and channel, with every n.
8. **Open answers:** two people code them into themes independently, then compare.
9. **H5, preference:** for each of the six questions, how many chose VistaDex, the chatbot or about the
   same; two-sided exact sign test over those who chose one tool (console and `comparison.csv`). Check
   whether the first-shown option was picked more often (`pref_options_order`).
10. **H5, answer content:** paired Wilcoxon on distinct sources (links that survived the paste vs the
    report's sources), and on distinct websites (from those links plus websites named without a link,
    such as levels.com, since a paste often keeps a link's words but not its URL). Describe the rest per participant: verdict words in the chatbot answer, which of
    the six sections it took up, and the share of the report's claims, competitors, shut-down startups and
    Big Tech companies the chatbot also named. These are counts from fixed word lists, not quality.
11. **H5, answer quality:** the human ratings from section 7a, Wilcoxon per dimension (Holm-corrected),
    with inter-rater agreement (weighted Cohen's kappa or ICC) reported before any test.
12. **Appropriate reliance (study-19):** with the team's answer key filled in (`DEFAULT_ANSWER_KEY`, worker/src/research-join.js),
    each claim vote is appropriate reliance, over-reliance, under-reliance or an appropriate override
    (`reliance.csv`). Report the four counts and the share of appropriate decisions, per participant and overall.
    Write the key before looking at the votes, from sources, and keep it with the paper's materials.
13. **Judgement basis (study-19):** what each judgement was based on, after each part (`chatbot_basis`,
    `vistadex_basis` in `paired.csv`): how often people relied on the tool's answer alone versus their own
    checking, compared between the two parts with McNemar's test per option.
14. **Versions:** state how many pairs saw each study version (`study_version`); run the main tests on all
    pairs and on study-19 pairs only, and report both.

## 7a. Rating the two answers (codebook for `chatbot-answers.csv`)

Two raters, independently, each with their own copy of the sheet. Rate every row's chatbot answer and
VistaDex report on each dimension, 1 (poor) to 5 (excellent). For ideas A, B, D and E, agree on the facts first
(the answer key in section 1, if the team writes one); for own ideas, rate from what you can check in ten
minutes. Raters can tell the tools apart from their style, so say in the paper that rating was not blind.

| Dimension | 5 means | 1 means |
|---|---|---|
| `claim_accuracy` | Every factual claim it makes about the idea and its market is right, and it says which of the idea's own claims are false or unsupported | Several wrong facts, or the idea's claims repeated as true |
| `evidence` | Each important statement has a source you can open and that says what it is cited for | No sources, or sources that do not support the statement |
| `risk_coverage` | Real competitors, startups that tried and failed, Big Tech and legal risks, the strongest objections | Generic risks that would fit any idea |
| `calibration` | Says what it could not verify and does not overstate; no verdict beyond the evidence | Confident verdict ("great idea", "8/10") with little support |
| `actionability` | Leaves the reader knowing what to check next and how | Nothing a founder could act on |

Average the two raters per row after the agreement check; settle differences of 2 or more points by
discussion and report how many there were.

## 7b. Testing the study end to end (no production data)

`npm --prefix web run study-e2e` (with the dev server running) takes two participants and a field visitor
through the real app against a local copy of the Worker and database (mock pipeline, no keys), then checks
the `study_comparisons` rows, both exports and the console analysis. `npm run parity` checks every event
against the contract; `npm test` covers the table's SQL (real SQLite) and the analysis. Run these after any
change to the study; never test against the live site with recording on.

## 8. What would be worth finding

- **Verdicts taken on trust.** If people agree with "contradicted" claims about as often as with
  "confirmed" ones, they follow the label rather than reading it, even with evidence one tap away.
- **Opening vs trusting.** High trust ratings with few evidence links opened would mean the links work as a
  signal of reliability more than as something people check.
- **Chatbot vs evidence report.** A larger drop in confidence after VistaDex than after the chatbot, for
  the same idea and the same person, would point to the chatbot affirming ideas the report questions.
- **"Unverified".** How many people read it as "not enough sources either way" rather than a failure.
- **Who reads what.** Whether investors and founders read different sections (graveyard, objections) and
  open different evidence.

## 9. Limits to state in the paper

Confidence change is not calibration (section 1). The field track is self-selected. study-16 to 18 fixed
the order (chatbot first), so for those pairs an order effect cannot be told apart from the tool effect;
study-19 counterbalances by code number, and the analysis tests the order. The study-19 report also adds a
"Before you rely on this" note and "This looks wrong", so earlier pairs saw a slightly different report. The chatbot got one fixed prompt that
asks for what VistaDex does, which is fairer for the comparison but not how everyone uses a chatbot.
Chatbot answers vary by tool, model, plan and whether it searched the web (recorded, but the groups will be
small). Copying an answer often drops its citation links, so link counts undercount the chatbot. The
counted features are word-list heuristics; the human ratings are the quality measure. The four study ideas are fixed and hand-written. Small
samples: give n and effect sizes with every p. Data from different `study_version`s may not be comparable
(STUDY-NOTES.md says what changed in each).
