# Retired: BITS F364 study instruments

Moved out of the active routes in the 2026-10 two-edition revamp. Not imported anywhere, so not bundled; kept compiling so it can be restored.

- `StudyUI.tsx`: research consent dialog, study bar (session code, JSON/CSV export, withdraw), pre/post trust sliders, end-of-use survey.
- `StudyReportParts.tsx`: per-claim agree/disagree/unsure rating and the reviewer notes box.
- `controller.ts`, `useStudy.ts`: the pilot-2 instrumentation (events `trust_pre`, `trust_post`, `claim_rating`, `notes_edited`, `survey_submitted`, `demo_report_opened`).
- `trust-range.css`: the slider styles (import it again if the sliders come back).

Wording still lives in `prototype/ui/study-config.js` (`CONSENT`, `TRUST_PRE`, `TRUST_POST`, `CLAIM_RATING`, `SURVEY`). The pilot-1/pilot-2 event contract is preserved under `history` in `tests/fixtures/event-contract.json`.

TODO(team): course research data source is still undecided. The public demo is not used for the F364 paper.
