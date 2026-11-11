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

Also measured, for context: which report sections people read and for how long, trust / usefulness /
"helped me see what to verify" / effort ratings (1 to 7), whether people read "unverified" correctly,
and all of it by role (founder, investor, student, ...) and channel (LinkedIn, X, investors, direct).

**What the data cannot show.** Calibration: whether confidence moved toward the *right* answer. No idea
here has a recorded right answer, so H1 is confidence *change*. If the paper needs calibration, write an
answer key for the four study ideas (A to D) before the study: for each claim, the verdict two team
members agree on from their own research. TODO(team): decide whether to add the key.

## 2. Two tracks

- **Study track (controlled, within subjects).** Recruited participants (students, founders, anyone you
  sit with) do both parts on the same assigned idea: an AI chatbot of their choice, and VistaDex. The
  order is counterbalanced by the participant code: odd codes do the chatbot first, even codes VistaDex
  first. This is where H1 is tested.
- **Field track (observational).** Everyone who opens the public link (LinkedIn, X, investors) and accepts
  the Welcome notice, screening their own idea. Self-selected, so use it for descriptive findings (who
  reads what, who opens evidence, how ratings differ by role), not for causal claims.

## 3. Before the first participant

1. **Pilot with TEST codes.** Run two full sessions yourselves with codes `TEST01` and `TEST02`, one in
   each order. Check that both show "yes" under Complete in **Paired study**. TEST codes are left out of
   Insights, the exports and the analysis script automatically (tick "include TEST codes" to see them).
2. **Freeze the version.** Every visitor-facing change bumps `study_version` and resets consent. Do not
   deploy UI changes while the study runs; if you must, note the date and analyse by version (Insights,
   Data quality, and `summary.json` list the versions).
3. **Prepare the codes and ideas.** `P01`, `P02`, ... up to the number you recruit, each with an assigned
   idea, rotated so every idea appears in both orders: P01 A, P02 A, P03 B, P04 B, P05 C, P06 C, P07 D,
   P08 D, then again from A. Keep this sheet *outside the repository*, with the date, who ran the session
   and anything unusual. Never put names in the app.
4. **Decide the sample size now.** A paired Wilcoxon test cannot reach p < 0.05 with fewer than 6
   complete pairs, and only large effects show with 10 to 15. Aim for **at least 20 complete pairs**, and
   recruit about 25 to allow for drop-outs. Write the analysis plan (section 7) down before you start.

## 4. Running one study session

The study page tells participants about 20 minutes; time your pilot to check. One laptop, a quiet room, and do not
help with the task itself: answer only questions about the procedure.

1. Give the participant their code and open `https://vistadex-app.pages.dev/#/study`.
2. They accept the Welcome notice, choose "I have a participant code", enter the code and their role, and
   pick the idea from your sheet under "Your assigned idea". The order of the two parts follows the code.
3. **Chatbot part.** Confidence before (slider) → they paste the idea into the chatbot they normally use
   and read its answer → confidence after → ratings and "how many sources did you check".
4. **VistaDex part.** Confidence before → they run the assigned idea (it is pre-filled) and read the
   report as long as they like → **Your read** at the end of the report: confidence after, agree /
   disagree / not sure per claim and objection, ratings, and the "what does unverified mean" question.
5. The app moves them to the other part when one ends. When both are done, check **Paired study**: their
   row should say Complete "yes". If not, note which part is missing on your sheet.
6. Debrief: what the study was about, and the withdrawal contact on the notice.

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
| `participants.csv` | session | the Participants view |
| `insights.json` | | every number in Insights, for scripts |

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

Confidence change is not calibration (section 1). The field track is self-selected. The chatbot's answer
is not captured (only the ratings around it). The four study ideas are fixed and hand-written. Small
samples: give n and effect sizes with every p. Data from different `study_version`s may not be comparable
(STUDY-NOTES.md says what changed in each).
