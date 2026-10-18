# Study notes — instrumentation changes to report in the write-up

Changes to what an event *measures*. Event names and payload fields are unchanged across versions; see `tests/fixtures/event-contract.json`. No participant data was collected under 2026-10-pilot-1.

## study_version 2026-10-pilot-2 (redesigned web/ UI)

- **Panel-viewed rule changed (bug fix).** `objections_viewed` and `graveyard_viewed` now fire when a panel covers **at least 50 % of its own height OR at least 50 % of the viewport**. Under pilot-1 the rule was 50 % of the panel's own height only, so a panel taller than twice the viewport (common on phones with several objections or leads) could never report. Implemented in `web/src/study/viewRule.ts`. (Decision: 2026-10-18.)
- **`objections_viewed` measures exposure, not engagement.** Objections now sit beside the claims at equal visual weight (design brief). On desktop the objections panel is usually on screen as soon as the report renders, so the event fires almost immediately. It does not indicate that a participant went looking for objections. No engagement event was added. (Decision: 2026-10-18.)
- **Claim evidence stays collapsed by default** ("Show evidence"), as in pilot-1, so `claim_expanded` keeps its meaning. (Decision: 2026-10-18.)
- **Demo cohort corrected.** Demo claims that broke the 2-independent-source rule were set to "unverified" (no sources were invented). See the commit that changed `prototype/data/cohort.js`.
- **Graveyard seed reduced.** BrightRoll (acquired, not failed) was removed; see the graveyard section of the commit history for Timehop.

## Open — for the team to decide (not decided in code)

- **TODO: data retention period.** Shown to participants as a bracketed placeholder in the consent text until set in `prototype/ui/study-config.js` (`RETENTION_PERIOD`).
- **TODO: withdrawal contact channel.** Placeholder in the consent text and in the withdraw-failure message (`WITHDRAWAL_CONTACT`).
- **TODO: survey item sign-off.** The 5 Likert items are drafts (`SURVEY.signedOff = false`).
