# Study notes — instrumentation changes to report in the write-up

Changes to what an event *measures*. Event names and payload fields are unchanged across versions; see `tests/fixtures/event-contract.json`. No participant data was collected under 2026-10-pilot-1.

## study_version 2026-10-public-3 (Sample reports toggle)

- **New control:** `reports_samples` (Reports page select: Off / 5 / 10 / 15), logged as `control_pressed` with its value. Sample reports are fixed, researched examples built in the browser; never stored, never sent.

## study_version 2026-10-public-2 (round 2: scores, structured input, Reports, landing page)

- **Scores (decided by the team, 2026-10-20).** The "no score" rule is lifted; every score is explainable and computed in code (`prototype/core/scoring.js`, weights and thresholds in `scoring-config.js`). Big Tech safety is shown but not counted (TODO(team): define "low").
- **New events/values:** `run_started` carries `field_chars` (lengths of title, pitch, problem, solution, moat), `industries` and `role` — never the text. `section_time` gains `profile`, `big_tech` and `score_breakdown`. Selects log `control_pressed` with their value. New controls for the form, Reports, Contact, Home and the walkthrough's Resume tour.
- **Removed:** the Graveyard page and its controls; the Dashboard (replaced by Reports).
- **Recording gate:** Home, How it works and Contact us are readable before the Welcome notice and not recorded.
- **Reports stored locally:** public reports (including the idea text) are saved in the visitor's own browser (localStorage) for the Reports page; never uploaded; "Clear my reports" deletes them. Not telemetry.
- **Graveyard seed issue found:** Atrium's TechCrunch source returns 404 and Failory gives a different cause of death (lack of product–market fit, not unit economics). TODO(team): re-check the seed.

## study_version 2026-10-public-1 (two-edition revamp — not used for the F364 paper)

The public demo is a product, not the study: the Welcome screen is a transparency notice, not research consent. No participant data from this version belongs in the F364 write-up. TODO(team): course research data source is still undecided (the study UI is kept in `web/src/retired/study/`).

- **Retired from the routes:** consent dialog, study bar, pre/post trust sliders, per-claim agree/disagree, reviewer notes, survey, `demo_report_opened`. Their events no longer occur; the pilot-2 contract is preserved under `history` in `tests/fixtures/event-contract.json`.
- **Recording starts at the Welcome notice** (`consent_given` + `welcome_choice`); "Use without recording" records nothing. Retention 12 months.
- **Idea text is no longer logged.** `run_completed` carries counts (statuses, types, leads, objections), not `idea_text`, `report` or `trace`. `trace_id` stays so withdrawal still deletes the server trace. Note the server trace itself still holds the extracted claim text.
- **New events:** `control_pressed` (every control, stable ids), `field_edited` (length only), `screen_time`, `section_time` (per report section in view, same 50 % rule), `run_cancelled`, `walkthrough_started` / `walkthrough_step_time` / `walkthrough_ended`; `feedback_submitted` under an unlinked random id. `run_failed` gains `code`; `run_started` gains `markets` and `sample`.
- **`report_time`** now counts while the report screen is shown (it has its own route) and ends with `new_run`, `page_hidden` or `withdrawn`.
- **Uploads** are batched every 10 s (was 2 s), at most 200 events per request.
- **Pitch edition** sends no events at all.

## study_version 2026-10-pilot-2 (redesigned web/ UI)

- **Panel-viewed rule changed (bug fix).** `objections_viewed` and `graveyard_viewed` now fire when a panel covers **at least 50 % of its own height OR at least 50 % of the viewport**. Under pilot-1 the rule was 50 % of the panel's own height only, so a panel taller than twice the viewport (common on phones with several objections or leads) could never report. Implemented in `web/src/study/viewRule.ts`. (Decision: 2026-10-18.)
- **`objections_viewed` measures exposure, not engagement.** Objections now sit beside the claims at equal visual weight (design brief). On desktop the objections panel is usually on screen as soon as the report renders, so the event fires almost immediately. It does not indicate that a participant went looking for objections. No engagement event was added. (Decision: 2026-10-18.)
- **Consent is tied to the study version.** A stored consent answer (given or declined) only counts for the version it was answered under; after a version change the participant sees the consent dialog again with the current wording, and any locally stored data from the old version is dropped. Pilot-1 records (no version stored) are always asked again.
- **A run blocked by the pre-use trust question brings that question into view and focuses it** (as in pilot-1), instead of only showing a note under the Run button.
- **Claim evidence stays collapsed by default** ("Show evidence"), as in pilot-1, so `claim_expanded` keeps its meaning. (Decision: 2026-10-18.)
- **Demo cohort corrected.** Demo claims that broke the 2-independent-source rule were set to "unverified" (no sources were invented). See the commit that changed `prototype/data/cohort.js`.
- **Study access code, rate limits, daily cap.** Participant links carry a shared access code (`#code=…`). Refused screens (missing code, rate limit, daily cap) show a plain message and are recorded by the existing `run_failed` event (its `error` field holds the message); no new events. When analysing, `run_failed` with "paused for today" means the daily cap was hit, not a participant error. Uploads from a link without the code are refused by the server and stay only in that browser.
- **Graveyard seed reduced to 18 entries.** BrightRoll (acquired by Yahoo, not a failure) and Timehop (no source found confirming a shutdown; its cited URL could not be confirmed) were removed. Matching threshold re-checked: unchanged results on the calibration ideas.

## Open — for the team to decide (not decided in code)

- **Data retention: 12 months** (public-1). Previously open: Shown to participants as a bracketed placeholder in the consent text until set in `prototype/ui/study-config.js` (`RETENTION_PERIOD`).
- **Withdrawal contact: vistadex.team@gmail.com** (`WITHDRAWAL_CONTACT`). Previously open: placeholder in the consent text and in the withdraw-failure message.
- **TODO: survey item sign-off.** The 5 Likert items are drafts (`SURVEY.signedOff = false`). Retired with the study UI in public-1.
- **TODO: feedback question wording** (public-1). `FEEDBACK.signedOff = false`; `npm run prelaunch` blocks until it is approved.

## study_version 2026-11-study-21 (honest timeout error: CURRENT)

Bumped because the telemetry changed (decision: 2026-11-27, fix/screen-timeout). The report is unchanged.

- **A screening that takes too long now says so.** When the client gives up after 240 s, `run_failed` carries the new code `timeout` (it was `network`) and the visitor sees "This screening took too long" instead of "We couldn't reach the screening server". A rejected request is still `network`.
- The server now ends a run after 150 s with the report built from what arrived (providers that had not answered abstain), so long runs end in a report rather than a client timeout.
- When comparing failure rates across versions, read study-20 and earlier `network` failures as "timeout or network".
- **The running screen past 75 s:** the progress bar keeps creeping towards 99% instead of sticking at 95%, and the copy says "Taking longer than usual · it should finish within 2½ minutes" instead of "About 5s to go". Participants in long runs saw a stuck bar up to study-20; no event changed.

## study_version 2026-11-study-20 (HAI design audit fixes)

Bumped because the report a participant reads changed (decision: 2026-11-27, design audit against Amershi et al. 2019 and BITS F364 L20-21). No new events or payload keys.

- **"Before you rely on this" now opens the summary**, before the VistaDex Score (side by side from tablet width, note on the left; stacked above it on phones), so the caveat is read before the number anchors (it was below the status tiles in study-19).
- **The score says how much evidence backs it:** "Evidence behind it: X of N claims have two independent sources", plus "So this number rests on very little checked evidence" when none do. The formula is unchanged, so scores stay comparable across versions.
- **"What's new"** on How it works (Amershi G18).
- study-19 and study-20 pairs differ only in this report presentation; pool them, and report the version split as for earlier versions.

## study_version 2026-11-study-19 (appropriate reliance: counterbalanced order, judgement basis, answer key, contesting)

Bumped because the study flow, the visitor-facing report and the telemetry changed (decision: 2026-11-27, redesign against BITS F364: Amershi et al. 2019 guidelines, Lectures 20-21 on appropriate reliance).

- **Earlier participants stay in.** The analysis pools every study version; each pair carries the version its participant saw (`pairs[].version`, `paired.csv` `study_version`, the console's Version column). Measures added in study-19 are empty for earlier versions, never filled in. Report in the paper how many pairs saw each version, and run the main tests with and without the earlier pairs as a robustness check.
- **Order counterbalanced again** by the code's number: odd (or no number) does the AI chatbot first, even does VistaDex first (`partOrder` in `web/src/study/participant.ts`), the same rule as the comparison page's option order. Order is now a factor (`orderEffect`), no longer a stated limitation. study-16 to 18 were chatbot first, except the study-16 walkthrough path (see study-17).
- **"What is your judgement of the idea based on?"** after each part (Kim et al., FAccT 2024): multi-select `basis` in `condition_survey` and `run_scoped_survey`: `answer` (what the tool said), `sources` (sources I opened), `own_knowledge`, `own_search`, `other`. Tells reliance on the tool apart from the participant's own checking.
- **Appropriate reliance.** Each claim vote (agree = accepts VistaDex's status, disagree = overrides it) is set against the team's answer key for ideas A to D (`DEFAULT_ANSWER_KEY` in `worker/src/research-join.js`): appropriate reliance, over-reliance, under-reliance, appropriate override (console: Paired study; `reliance.csv`). **TODO(team): fill in the key** (truth `true` / `false` / `disputed` / `unknown`, with a source, for each claim) before reporting; until then every vote is "unkeyed" and the console says so. It applies to earlier versions' votes too, since their claim votes and snapshots are stored.
- **Report:** a "Before you rely on this" note in every report's summary (what was checked, that it can miss things and be wrong, what "unverified" means; Amershi G1/G2), and a plain "We're not sure" line on unverified and disputed claims (Kim et al. 2024).
- **"This looks wrong"** on each claim and objection of the visitor's own report (Amershi G9/G15, contestability): new event `report_flag` { run_id, kind, index, status, severity }, controls `report_flag_claim`, `report_flag_objection`. Counted in the console.

## study_version 2026-11-study-18 (the chatbot answer and the report side by side in the database)

Bumped because a payload changed (decision: 2026-11-24).

- **`vistadex_report_snapshot` gains `trace_id`**, the server's id for the run, so the Worker can store the full report next to the snapshot.
- **New D1 table `study_comparisons`** (worker/schema.sql, worker/src/comparisons.js): one row per study-track session with the pasted chatbot answer (tool, model, web search), the report snapshot, the full report the server generated (copied from `report_cache` by trace id; empty when the run was not cached, e.g. mock mode in the browser), and the `tool_preference` answers. `POST /events` updates it as those events arrive; field visitors never get a row. It is derived data: the events stay the source, `POST /research/comparisons/rebuild` (console: Chatbot vs VistaDex, "Rebuild from events") recreates it, and withdrawal and the 12-month retention delete it.
- **Exports:** `/export?table=comparisons&format=csv` (answer and report as text, side by side, with the preferences) and `/export?table=comparisons&full=1` (JSON, with the snapshot and the full report). TEST codes are left out unless `include_test=1`. Rows from study-16 and study-17 have the snapshot only (their snapshots had no trace id).
- **End-to-end check:** `npm --prefix web run study-e2e` takes two participants and a field visitor through the app against a local Worker and checks the rows, the exports and the analysis.

## study_version 2026-11-study-17 (study track: the next part comes first, whatever the Welcome choice)

Bumped because the study flow changed (decision: 2026-11-23). No new events or payload keys.

- **Bug fixed: "Start with walkthrough" ran VistaDex first.** The tour opens Screen an idea, which for a study participant is pre-filled with their idea, so a participant who chose the walkthrough on the Welcome notice did VistaDex first and the chatbot part second. Now a study participant who still has a part to do goes straight to it (the choice is still logged as `welcome_choice: walkthrough`), and opening Screen an idea before the chatbot part leads back to the chatbot part. **In study-16 data, check `condition_started.order_position`:** a participant with `vistadex` at position 1 took this path; analyse them as VistaDex first (their chatbot answer is unaffected, their judgements are not).

## study_version 2026-11-study-16 (study track: chatbot answer pasted in, fixed order, comparison page, fresh start)

Bumped because the study flow and the telemetry changed (decision: 2026-11-23, the team asked for the chatbot's answer to be captured and compared with the report).

- **A new participant starts a new session.** A study machine is reused, and all tabs of a private window share one storage, so the next participant used to inherit the previous person's usage session, notice answer, finished parts and reports. Now the study page says who used the browser last and offers "Start a new participant" or "Continue as <code>"; any other code also starts fresh: queued events are uploaded, then the notice answer and session id are forgotten (the new person answers the notice and gets their own `session_id`), and the participant, own idea, saved reports and the form draft are cleared. "Next participant" on the last page does the same. Sessions before study-16 may mix two people: check `participant_registered` codes per session.
- **Fixed order: chatbot, then VistaDex, then the comparison.** The code no longer sets the order (it was counterbalanced by parity up to study-15). The comparison page needs both answers fresh, so everyone does the chatbot part first. State this in the paper: an order effect cannot be separated from the tool effect for H1 from study-16 on. Data from study-15 and before keeps its counterbalanced order (`condition_started.order_position`).
- **A fixed prompt.** The chatbot part gives one prompt with the idea (`chatbotPrompt` in `web/src/study/participant.ts`): the claims with true / false / disputed / cannot be verified and sources, competitors, startups that shut down, Big Tech, objections and risks, legal issues, and "say what you could not verify". It asks the chatbot for what VistaDex does, section by section, so the two answers can be compared point by point. Up to study-15 participants asked in their own words. Control `baseline_copy_prompt` replaces `baseline_copy_idea`.
- **Four questions while the chatbot writes**, before the answer is read: confidence before (`confidence_pre`, as before), and new `participant_profile` with `market_familiarity`, `ai_trust` (trust in AI chatbots in general) and `ai_use` (how often they use them), each 1 to 7. Use them as covariates.
- **The chatbot's answer is captured.** After reading it (follow-ups allowed) the participant pastes the whole answer: new event `chatbot_answer` with `text` (verbatim, up to 30,000 characters), `chars`, `tool` (ChatGPT, Claude, Gemini, Copilot, Perplexity, Other), `model` (free text, optional) and `web_search` (yes / no / not sure). Up to study-15 the answer was not captured.
- **The VistaDex report is captured for study participants.** New event `vistadex_report_snapshot` (study track only, on the assigned idea's run): the claims with status and source links, competitors, graveyard leads, objections with severity, Big Tech level and companies, legal rules per market, market TAM, the score, `sample_fields`, and counts of distinct sources and websites.
- **These two events are the only ones with content**, and only for participants with a code; the study page says so. Field visitors never send them. Withdrawal deletes them with the session.
- **Comparison page** (route `#/compare`, after both parts): six questions, each "The AI chatbot / VistaDex / About the same" (overall; which claims are true or false; evidence to check; competitors, failed startups and risks; honesty about what it didn't know; rely on for a real decision) and an optional reason. New event `tool_preference` with the six answers, `why` and `options_order`: the two tools swap places by code parity (odd: chatbot first) to balance position bias.
- **Analysis:** Research Console, Chatbot vs VistaDex; Export `comparison.csv` and `chatbot-answers.csv` (coding sheet). See STUDY-PROTOCOL.md sections 7 and 7a.
- **The bump resets consent**, as every bump does.

## study_version 2026-11-study-15 (study track: Copy idea button; fresh start for a new code)

Bumped because the chatbot part changed (decision: 2026-11-23).

- **Copy idea.** The AI chatbot part has a "Copy idea" button under the idea paragraph (preset or own idea), so participants paste it instead of selecting or retyping it. Only the idea is copied, no prompt wording: they still ask the chatbot in their own words. New control `baseline_copy_idea` (logged as `control_pressed`), so the data shows who copied the idea.
- **A new code starts fresh.** Registering a different code or idea in a browser that already took part used to keep the earlier participant's finished parts, skipping the new person's and leaving Screen an idea empty. Now a different code or idea clears that progress; the same code and idea still resume. Sessions before study-15 that reused a browser may have a part missing (Paired study shows Complete "no").
- **The bump resets consent**, as every bump does.

## study_version 2026-11-study-14 (study track: own idea option)

Bumped because the study page changed (decision: 2026-11-23). No new events or payload keys.

- **Own idea.** Besides ideas A to D, a study participant can pick "My own idea" and type it once on the study page (title, one-line pitch, problem, solution, optional moat: the Screen an idea fields). The same text is the paragraph they copy into the AI chatbot and the input filled into Screen an idea, so both parts still judge one identical idea. The text stays in the browser (localStorage, removed with the participant record); telemetry records `condition_started.idea_key = "own"` and the run's `sample` is null.
- **For the analysis.** Each own-idea pair is still within-subject (same person, same idea, both tools), so H1 holds. But own ideas differ between people and the participant knows them well, so report preset (A to D) and own-idea pairs separately as well as together; `paired.csv` has `idea = own` for them. An answer key cannot cover own ideas.
- **The bump resets consent**, as every bump does.

## study_version 2026-11-study-13 (graveyard quiz: fresh questions and engagement events)

Bumped because the waiting-screen quiz and the telemetry changed (decision: 2026-11-20).

- **Fresh questions.** While a live run is working, the quiz now asks 3 startups drawn at random from the whole graveyard (a new public Worker route, `GET /graveyard/quiz`, returns 12 usable entries per request, never cached). Each clue is the first sentence of what the startup tried with its name masked as "This startup"; the four answer choices are the right name plus three other names from the same draw. If the route cannot be reached, the old fixed three (Vine, Juicero, Quibi) are used and the event says so.
- **New events** (no idea text, no answer text):
  - `quiz_started` {run_id, source: live | fallback} when the visitor presses Start.
  - `quiz_answered` {run_id, question 1 to 3, correct, ms from the question appearing to the answer}.
  - `quiz_finished` {run_id, score, answered, total, completed}. `completed` is false when the run ended or the visitor left before the last question; that record is still sent once.
- **For the paper.** Whether visitors use the wait at all (start rate among live runs), how they do (scores, answer times), and whether playing the graveyard quiz goes with more attention to the report's graveyard section (time on "Leads to check", graveyard links opened), quizzers vs non-quizzers. This is correlational: visitors choose to play.
- **Channel from a later tagged visit** (same version, 21 Nov): the channel was first-touch per browser, so a person who had once opened the site directly and later came from the LinkedIn post (or the X / WhatsApp link) stayed `direct`. Now a `utm_source` link always replaces the stored channel, and a LinkedIn or X referrer replaces a stored `direct`; untagged return visits keep it. A visitor who had already accepted the notice registers again (`participant_registered` with the new `source`), and the analysis and the Participants table use a session's latest registration. Sessions before this fix may show `direct` for returning visitors who came from a post.
- **The bump resets consent**, as every bump does.

## study_version 2026-11-study-12 (Home graveyard counter; longer time limit)

Bumped because the Home page changed (decision: 2026-11-20). Telemetry is unchanged.

- **Home counter.** Under the hero text, the live graveyard size ("924 shut-down startups in the graveyard, each confirmed by two independent sources. Updated 3 h ago."), counted up from 0 in about 1.6 s (shown at once under reduced motion). It comes from a new public Worker route, `GET /graveyard/stats`, which returns only the count and the export time.
- **Channel for the LinkedIn post's link** (same version, 20 Nov): the post links to `vistadex-study.github.io`, a redirect page that adds `?utm_source=linkedin`. A visit arriving from that page without a channel tag (for example when extra query text replaced it) is now recorded as `linkedin` instead of `ref:vistadex-study`. A `utm_source` still wins.
- **Time limit 240 s** (was 150 s). On 18 Nov two live runs hit the 150 s limit and failed with "network"; successful runs took 47 to 144 s. Runs before study-12 may include such failures.
- **The bump resets consent**, as every bump does.

## study_version 2026-11-study-11 (launch fixes: graveyard cap, roles, live wording)

Bumped because a score and a telemetry enum changed (decision: 2026-11-12, docs/LAUNCH-PLAN.md P0-4 and P0-5).

- **Graveyard distance with no match is capped at 70** (was 100): finding no lookalike is not proof nobody tried. Most reports match nothing, so VistaDex Scores from study-11 on are lower than before for those ideas; do not compare scores across this version.
- **Roles.** The Screen an idea form adds Student and Other; the feedback form adds Accelerator / incubator and Student. `run_started.role` and `feedback_submitted.role` gain those values. Role-based comparisons now have a student group from the field track too.
- **Wording.** The progress screen no longer marks Legal & market as skipped on live runs; How it works describes the live graveyard (fleet-confirmed, two independent pages each) instead of the 18-entry offline seed; the walkthrough's legal step describes the live section.
- **Same input, same report** (P0-7): a report is cached for 24 hours by its exact input, and the team can freeze a reviewed report (Console, Research, Report cache). **Freeze study ideas A to D before the study**, so every participant with the same idea sees the same report. Reports show "Evidence gathered <date>".
- **Privacy** (P0-6): data older than 12 months is deleted daily; runs from visitors who are not recorded keep only a minimal log (no text) and are never cached. The Welcome notice says so.
- **Reliability** (P0-2, P0-3): 3 screenings a minute per visitor; provider calls have timeouts and one retry; a run never exceeds its call budget, and legal markets it could not search are listed as "not searched this run".
- **The bump resets consent**, as every bump does.

## study_version 2026-11-study-10 (stricter claim judging; Home hero card)

Bumped because claim statuses can change and the Home page changed (decision: 2026-11-12). Telemetry is unchanged.

- **Claim judging.** A live report confirmed "No HIPAA-compliant AI medical scribe exists at under $100/month" with quotes listing such scribes at $39 and $49 a month. The judge prompt now spells out negation (a page naming such a product contradicts a non-existence claim), thresholds (the source's own number must meet the claim's) and overreach (a general point is irrelevant to a specific claim). In code, a "support" for a non-existence claim counts only if its sentence states an absence. "No <anything> exists" is typed novelty. **For H3**, statuses from study-10 on are stricter; compare agreement by status within a version.
- **Market and legal recall** (same version, 12 Nov): searches use the one-line pitch instead of the invented product name, and the market reader may give the broader market an idea belongs to (it named which). Before, the same idea got a TAM in one run and none in the next. The trace records how many figures and rules the reader returned and how many were kept.
- **Legal by market** (same version, 12 Nov): a rule whose name ties it to another market (HIPAA or the FDA for the USA, GDPR for the EU, DPDP or CDSCO for India) is no longer listed under this one, and the reader is told to list only the market's own rules. A live run had listed HIPAA under the EU and US state recording laws under India.
- **Home.** The hero card is one straight card: no tilt, the leads on a light inner surface, the source sites named, and the sample's own VistaDex Score in a lime band.
- **The bump resets consent**, as every bump does.

## study_version 2026-11-study-9 (live Market and Legal, Regulatory load in the score)

Bumped because the report content and the VistaDex Score changed (decision: 2026-11-11). Telemetry is unchanged.

- **Market is live.** A market-size search on the title and industry reads up to 6 pages; a figure is kept only if the sentence that states it is on the page and holds the money amount. One figure per independent site; the TAM is their median, cited to the closest figure. The Market axis counts only with figures from 2 or more independent sites (or quotes supporting a confirmed market-size claim). Before, the TAM came only from a confirmed market-size claim, so most reports had no Market axis. Expect more reports with a Market value from study-9 on.
- **Legal is live.** For each target market the founder picks: links to the official trademark and patent search, and the rules that fetched pages name for this kind of product, each with the sentence that names it. A rule named by 2 independent sites is corroborated.
- **New axis: Regulatory load** (weight 10; the counted weights now add up to 100): 100 minus 15 per corroborated rule (at most 5), capped at 70 when none is found, no value without a target market. Scores from study-9 are not directly comparable with earlier ones.
- **Competitor search retries once** when the model answers in the wrong shape, and (fixed later on 2026-11-12, same version) no longer loses its list when a page names dozens of products: the reply was cut off by the length limit. The model now lists at most 8, gets room for them, and the complete entries of a cut-off reply are kept (each still checked against its page). Before this fix, ideas in crowded fields could show "Competitor search: not available".
- **Home.** The hero card shows a researched sample report (sources checked by hand on 20 Oct 2026) instead of the mock-mode card.
- **The bump resets consent**, as every bump does.

## study_version 2026-11-study-8 (Home problem cards; console Insights)

Bumped because the visitor-facing Home page changed (decision: 2026-11-11). Telemetry is unchanged: same events, payloads and controls as study-7.

- **Home.** The "The problem" and "Who it's for" cards carry a line icon next to their number; the empty band between the number and the title is gone.
- **Research Console (not visitor-facing).** A new Insights view and analysis-ready exports, from the same code as `analysis/study_analysis.mjs` (`analyzeStudy` in `worker/src/research-join.js`). **Evidence opened** now counts every evidence link in a report: claim sources (`source_clicked`) plus graveyard, competitor, Big Tech, legal and market links (`control_pressed` with those control ids, joined to the run open at the time). Before, only claim sources counted, so the Participants "Sources" column was blank for nearly everyone. H4 uses evidence of any kind. This applies to all past data, since those control presses were already logged.
- **The bump resets consent**, as every bump does.

## study_version 2026-11-study-7 (report "Your read", claim reading time, channels)

Bumped because the report, the study page and the telemetry changed (decision: 2026-11-11, before sharing the public demo on LinkedIn and X and with investors).

- **"Your read" is part of the report.** The ratings (confidence after, agree / disagree / not sure per claim and objection, the survey) were below the end of a ~27,000 px phone report, after "Done reviewing?" and a feedback card that leads to another form. They are now the report's last section, "Your read", in the jump nav (session reports only), before those two, and the Summary points to it. Votes and the sources answer sit three in a row on phones, so the vote list is about a third as tall. Expect a higher completion rate from study-7 on; compare with care.
- **New measure: `claim_dwell { run_id, claim_index, ms }`**, the time each claim card was in view by the panel-viewed rule, summed per run and claim and sent when the report ends (like `section_time`). It was in the contract since study-1 but never sent. `source_clicked_by_claim` (never sent; `source_clicked` carries `claim_index`) is removed. `section_time.section` gains `rate`.
- **Channels.** `participant_registered.source` maps LinkedIn (`linkedin.com`, `lnkd.in`) to `linkedin` and X (`x.com`, `twitter.com`, `t.co`) to `x`; before, a LinkedIn referrer was recorded as `ref:www`. The study page's registration now sends `source` too (it had none). Share links with `?utm_source=` (README).
- **Report content.** Graveyard leads link the pages that state the shutdown ("Shutdown stated in N independent sources (automatic check)") and the "no match" line counts the graveyard the run checked (was the 18-entry offline seed). A price is no longer typed as a market-size claim; the objector sees each claim's source counts. The quiz no longer says "900+ documented failures".
- **Not a measure, but in the data:** the report shows "Your read" to field-track visitors too, as before.
- **The bump resets consent**, as every bump does.

## study_version 2026-11-study-6 (paired measures for the within-subjects analysis)

Bumped because the AI chatbot page changed and the study events changed (decision: 2026-11-11, from checking every study event against H1 to H4).

- **Both conditions now log the same paired measures under one run id each.** `condition_started { condition, idea_key, order_position }` (never logged before, so the assigned idea and the order were not in the data; older data can only take the order from the code's parity, which the console and the analysis flag as "from code"), `confidence_pre`, `confidence_post`, `condition_survey` and `condition_ended { run_id, verified_sources }`. The chatbot part's run id is `b_` + 12 hex (before: a new `baseline-<ms>` for every event, so its before and after could not be joined); the VistaDex part uses the report's run id, and `verified_sources` counts the evidence links opened in that report. `order_position` comes from what the participant has finished (1 or 2), not from the planned order.
- **The chatbot part asks for confidence before the chatbot steps.** Until study-5 the "before" slider was on the same page as the instructions and was logged on "I've read the AI's answer", i.e. after the participant had read the chatbot's answer (H1). Now: the idea and the confidence question, "Next: ask the chatbot" (new control `baseline_start`, logs `condition_started` and `confidence_pre`), then the chatbot steps, then the ratings.
- **H2 is measured in both conditions.** The chatbot ratings ask "Did you check any of the AI's sources, or look anything up yourself?" (0 / 1-2 / 3+), as VistaDex asks about its evidence links. Both `condition_survey` and `run_scoped_survey` now carry `sources_checked` ("0" | "1-2" | "3+" | null when unanswered; field-track runs too). Before, the VistaDex answer was only a `control_pressed` and the chatbot had none.
- **Console.** New Paired study view and paired.csv (one row per participant code across sessions, both conditions side by side, Wilcoxon signed-rank per measure). The Overview "Paired-complete" count and the funnel now count per condition (they counted any survey as both). The per-run join no longer puts the chatbot condition's measures on a VistaDex run (they had overwritten that run's before/after and survey in the Research view and the H4 split). The login form posts the token; tokens in URLs are no longer accepted.
- **Analysis.** `analysis/study_analysis.mjs` (README) gives H1 to H4 from an export with the console's own joins. For study-4 and study-5 data: the chatbot part's before-confidence was taken after reading the chatbot's answer, the order comes from the code number, and the idea only from an unedited VistaDex run's `sample`; report those sessions separately or as a limitation.
- **The bump resets consent**, as every bump does.

## study_version 2026-11-study-5 (study flow: both parts reachable and finished)

Same events, payload keys and control ids as 2026-11-study-4. Bumped because the visitor-facing study flow changed (decision: 2026-11-11, found by testing the live study-4 site the day data window 2 opens).

- **The VistaDex condition is now finished by its ratings.** Until study-4 nothing ever marked it done. Participants who started with VistaDex (even codes) could not reach the AI chatbot part: after the report there was no way on, and the gate kept sending them back to Screen an idea. Participants who did the chatbot first completed both parts but were never recorded as finished in the browser. Now "Submit" under a VistaDex report marks the condition done for a study-track participant and, if the chatbot part is still to do, goes on to it. Field-track ratings leave study progress alone.
- **The AI chatbot part follows the participant's order.** It said "Your first task" and "also your idea for VistaDex later" to everyone, and always sent the participant to VistaDex afterwards. Done second, it now says "Your second task", the button reads "Submit and finish", and the page ends with "You've finished both parts". Panel tabs read "Part 1" / "Part 2".
- **The assigned idea replaces a draft typed before registering.** In study-4 the form was filled in only when empty, so a visitor who used the form and then registered in the same page load kept the old text under a note saying the assigned idea was filled in. Edits made after it is filled in are kept; when the form no longer matches the assigned idea the note says so.
- **No Tailwind green or red outside the status palette**: the ratings "Thank you" line, the graveyard quiz's right and wrong answers and the study registration error are ink.
- **Analysis.** In study-4 data (live from 2026-11-11), even-code participants have no baseline condition events unless they typed the address themselves; their VistaDex data is usable. Field-track data is unaffected.
- **The bump resets consent**, as every bump does.

## study_version 2026-11-study-4 (seq unique across tabs, assigned idea filled in)

Same events and payload keys as 2026-10-study-3; `run_started.sample` gains four values. Bumped because what `seq` means changed and the study-track VistaDex form changed, so data from before and after can be told apart (decision: 2026-11-09, before data window 2 opens on 2026-11-11).

- **Study track: the assigned idea is filled in for the VistaDex condition.** Until study-3, Screen an idea opened empty and each participant split the assigned paragraph into title, pitch, problem and solution in their own words, so participants with the same idea screened different inputs and got different reports (a confound for the paired baseline vs VistaDex comparison). Now the form starts with a fixed structured version of the assigned idea (`STUDY_INPUTS` in `web/src/study/participant.ts`): every sentence of the paragraph the chatbot gets appears verbatim, the "We are building..." sentence is the solution, and a one-line pitch is the only added text (TODO(team): approve the pitch lines). A note asks the participant to run it without changes. Industries, role and markets stay empty (optional). Field-track visitors and participants who finished the VistaDex condition get the usual empty form.
- **New `run_started.sample` values `study_A` to `study_D`**: the run used the assigned idea unedited. An edited assigned idea logs `sample: null` (as an edited sample did before), so analysis can keep or drop edited study runs; `field_chars` shows how much changed.

- **The bug (study-1 to study-3).** All tabs of one browser share one telemetry session, but each tab kept its own copy of the stored state and wrote the whole copy back on every event. So (1) two tabs counted `seq` from the same value and sent the same numbers; D1 keeps only the first event per (session_id, seq), so the other tab's events were silently dropped; (2) each tab overwrote the other's unsent events in storage; (3) a tab still open after "Delete my session" in another tab wrote the old session and its consent back. Dropped events cannot be recovered, and nothing in the stored data marks which sessions used two tabs.
- **`seq` is now unique across tabs.** Each page load claims a tab slot (0 to 1023, from a counter in the shared record) and every `seq` it sends is `max(now_ms × 1024 + slot, previous seq of this tab + 1024)`. Two tabs never send the same `seq`; within a tab it strictly increases; across tabs and reloads it follows the time the event was logged (to the millisecond), so ordering by `seq` (as the console's start-order join and "latest vote" do) still means "earlier". Values are large (about 1.8 × 10^15) and no longer consecutive: do not read gaps as lost events, and do not use `seq` as an event count. Two tabs can only share a slot if 1024 page loads of one session happen in between or two tabs load in the same instant (then they would also have to log in the same millisecond to collide).
- **Shared storage is merged, not overwritten.** Every tab writes only its own unsent events into the shared queue (merged by `seq`), so a reload of any tab can still send everything; an event may then be uploaded by two tabs, which D1 ignores as a duplicate (`stored` < `received` in the `/events` reply is expected).
- **A withdrawal or a new consent in one tab is followed by the others.** A recording tab re-reads the shared answer before every event and every upload: after "Delete my session" elsewhere it stops recording and drops what it held. A tab that has not answered the Welcome notice does not start recording because another tab did (it waits for its own answer or a reload, as before).
- **Analysis.** Compare runs before and after this version with the two-tab loss in mind: study-1 to study-3 sessions that used two tabs at once can miss events (votes, section times, survey answers) from one of the tabs.
- **The bump resets consent**, as every bump does: returning visitors see the Welcome notice again and get a new session id.

## study_version 2026-10-study-3 (research console fixes, pre-run confidence)

- **New field-track measure: the pre-run confidence slider** on Screen an idea (public edition only; hidden in the pitch edition and in the Home page preview). Every run logs exactly one `confidence_pre { condition: "vistadex", value, run_id, moved }`. An untouched slider logs its starting value: `{ value: 50, moved: false }`. `moved` is optional in the contract (the baseline session's `confidence_pre` has no such key). The console includes untouched values in the calibration delta and marks them ("pre 50 · untouched"); the CSV has `conf_pre_moved`.
- **Run ids are random**: `r_` + 12 hex. Older ids (`r1`, `r2`…) were per-page-load counters: they restarted on every reload while the session id persisted, so one session can hold several `r1` runs. The console matches those older events to the run that started last before them (by `seq`, then `ts`), and flags every such match as inferred ("matched by start order", counted in the per-run table header). Events with a missing or unmatched `run_id` are matched the same way. A study-panel `run_id` from before 84273db was the report entry id (`<entry>-r<N>`) and is reduced to `r<N>` first.
- **Agreement uses each item's latest vote.** Every vote press is logged (a change of mind, or the same answer again). The console now counts only the latest vote per (session, run, claim or objection, index). Agree rate = agree ÷ all votes: `not_sure` is a vote, not agreement, so it stays in the denominator. "Votes cast" is now "Items voted"; the CSV adds `votes_agree`, `votes_disagree` and `votes_not_sure`.
- **The bump resets consent**, as every bump does: returning visitors see the Welcome notice again and get a new session id.

**Known limitations**
- **Two tabs in one session send duplicate `seq` values.** Each tab counts from the same stored value, and D1 keeps only the first event per (session_id, seq), so the second tab's colliding events are silently dropped. This is older than this version and the lost events cannot be recovered. Fixed in 2026-11-study-4.
- **Old r1-style data is matched by start order and flagged as inferred.** One case cannot be told apart: after a reload, a vote on a reopened older report (legacy `r1` id) joins the newest `r1` run. New `r_` ids join exactly.

## study_version 2026-10-study-2 (21 Oct frontend fixes)

Same events, payload keys and answer values as 2026-10-study-1. Bumped because the visitor-facing report UI changed: the post-report form no longer selects an answer on background clicks (study-1 data can contain a phantom `study_sources_0` press or `comprehension_check` event right after a real answer), the jump nav lands on and highlights the clicked section, and the report top / walkthrough scrolling changed.

## study_version 2026-10-study-1 (F364 research instrumentation)

The course research data source is now the live public demo: the Welcome notice is the
research consent, accepting it auto-enrolls the visitor (field track), and the retired
study UI is superseded. Two tracks:

- **Field track**: every consenting public visitor; own idea; post-report study panel
  (confidence slider, per-claim/objection agree-disagree votes, T/U/H/E likerts,
  source self-report, open text — stored verbatim, the visitor wrote it to be read).
- **Study track** (recruited, within-subjects): participant code via #/study, assigned
  idea, counterbalanced [baseline chatbot, VistaDex] via #/baseline; same measures per
  condition; paired analysis (Wilcoxon). #/study was added to the router TABLE (it 404'd
  when the TABLE entry was missed — fixed and component-tested).

New events: participant_registered (code, role, track, source/channel — utm_source
first-touch), condition_started, confidence_pre/post, claim_vote, objection_vote,
condition_survey (open_text verbatim), condition_ended, quiz_started/finished.
Withdraw now blocks re-uploads (pre-existing); console purges also write a withdrawal —
purging a session whose browser is still open silently rejects its later uploads.

**Berger et al. 2025 (arXiv:2512.13253) — human learning & synergy.** Their re-analysis
of the 74-study synergy meta-analysis: outcome feedback → higher synergy;
explanations+feedback → positive synergy; explanations WITHOUT feedback → NEGATIVE
synergy. VistaDex is their paradigm-shift experiment in the ideation domain: every
status verifiable (2-independent-domain rule), every claim carries sources, the
graveyard is ground-truth outcome data. New hypothesis **H4**: participants who verify
(source-clickers) show improving calibration across runs; explanation-only readers do
not. Stratify the analysis by verification behavior. Cite prominently — the paper is
positioned as answering their call.
