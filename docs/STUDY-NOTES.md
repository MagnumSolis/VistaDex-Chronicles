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

## study_version 2026-11-study-4 (seq unique across tabs, assigned idea filled in: CURRENT)

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
