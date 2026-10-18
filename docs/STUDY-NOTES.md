# Study notes — instrumentation changes to report in the write-up

Changes to what an event *measures* (event names and fields are unchanged; see `tests/fixtures/event-contract.json`).

## UI redesign (from study_version 2026-10-pilot-2)

- **`objections_viewed` now measures exposure, not engagement.** The redesigned report puts objections beside the claims at equal visual weight (design brief). On desktop the objections panel is usually on screen as soon as the report renders, so this event fires almost immediately. It no longer indicates that a participant scrolled to look for objections. No new events were added for engagement. (Decision: 2026-10-18.)
- **Claim evidence stays collapsed by default** ("Show evidence & reasoning"), as in the pilot-1 UI, so `claim_expanded` keeps its meaning.

## Known measurement issue (open)

- `objections_viewed` / `graveyard_viewed` use an IntersectionObserver with threshold 0.5 of the panel's own height. A panel taller than twice the viewport (likely on phones with several objections or leads) can never reach 50 % visibility, so the event never fires for that participant. Present in pilot-1 and kept unchanged for parity until a decision is made.
