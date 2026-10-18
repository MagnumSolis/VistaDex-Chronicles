# VistaDex — working rules

VistaDex is an evidence-linked screening tool for accelerator / VC / university reviewers. A human makes the final decision; **the tool never gives a verdict.** It is also a BITS F364 trust-calibration study with real participants.

## Git
- Work on `feat/weekend-prototype`. Never commit to `master` or `main`; never merge into, rebase or force-push them. Check the branch before every commit.
- Ask before the first push. Never commit secrets (`.env` is ignored; see `.env.example`).

## Frozen unless explicitly asked
- Pipeline logic (`prototype/core/`), the POST /screen contract, the key-free mock path, the proxy (`worker/`).
- Research instrumentation behaviour: consent gate, trust sliders, per-claim agreement, survey, and every telemetry event and field. `tests/fixtures/event-contract.json` is the contract; the UI must reproduce it. Bump `STUDY_VERSION` (prototype/ui/study-config.js) whenever the participant-facing UI changes, and record it in the fixture.
- Everything must run end-to-end with zero API keys and deploy as a static site (GitHub Pages).

## UI design brief (applies to every UI change)
- **Tone:** calm, credible, research-grade — a well-made analyst tool, not a consumer app or landing page. Clean typography, generous spacing, one restrained accent colour, neutral base.
- **Do not inflate trust** (this UI is used in a trust-calibration study):
  - No celebratory treatment for "confirmed" — no confetti, glow or success animation.
  - "unverified" is a normal, expected state: neutral styling, never an error or failure.
  - The four statuses (confirmed / contradicted / disputed / unverified) must be distinguishable **without colour**: always a text label and an icon as well.
  - Show the evidence, not a score: each claim shows its sources and its independent-source count. No overall novelty score, verdict or rating badge.
  - Objections are as visible as the claims (beside them at equal visual weight), never hidden at the bottom.
  - Graveyard matches are "leads to check", with the similarity value and cause of death visible.
- **Motion:** minimal, short transitions only. The 4-stage pipeline progress may animate subtly because it shows real work. Respect `prefers-reduced-motion`.
- **Accessibility:** WCAG AA contrast, fully keyboard navigable, visible focus states.
- **Responsive:** usable at phone width (participants may open the link on mobile).
- **Theme:** light mode required. No OS-dependent dark mode during the study (it would differ between participants).
- **Fonts** are self-hosted in the build (no Google Fonts or other font CDNs at runtime).

## Commands
- `npm test` — node tests (pipeline, proxy, telemetry).
- `npm run serve` — current static prototype on :5173. `npm run dev-proxy` — Worker handler in Node on :8787.
