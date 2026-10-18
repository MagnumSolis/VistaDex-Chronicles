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
- **Fonts** are self-hosted in the build (no Google Fonts or other font CDNs at runtime): IBM Plex Sans Condensed (bold) for page/section titles and large counts (tabular figures); IBM Plex Sans for body and claim text; IBM Plex Mono for small numbers.
- **Shape:** squircle cards (28px report header, 24px cards, 16px nested surfaces), soft shadows instead of borders, pill buttons/nav/tags, round icon chips. Graveyard leads are flat dashed cards (leads, not evidence).

## Colour tokens (web/src/index.css — source of truth; AA verified in web/src/test/contrast.test.ts)
| Role | Token | Value |
|---|---|---|
| Background (warm paper) | `--background` | `#F6F5F1` |
| Cards | `--card` | `#FFFFFF` + soft shadow |
| Ink — all body, claim and objection text | `--foreground` | `#1B1F2A` |
| Muted / helper text | `--muted-foreground` | `#5B6475` |
| Accent (indigo) — interactive only | `--primary` / `--ring` | `#3B4CCA` (tint `#ECEEFB`) |
| Field outline | `--input` | `#96948F` (3:1 on white, WCAG 1.4.11) |
| Contradicted | `--st-contradicted` / `-bg` | `#B4413C` / `#FBEDEC` |
| Disputed | `--st-disputed` / `-bg` | `#9A6410` / `#FBF3E4` |
| Confirmed | `--st-confirmed` / `-bg` | `#2E7B60` / `#E9F4EF` (spec `#2F7D62` nudged for AA on its tint) |
| Unverified | `--st-unverified` / `-bg` | `#5B6475` / `#EEF0F4` |

**Colour rules**
- **Status colour is used only for status** — status tags, status count tiles, status icons. Never for body text, claim text, objections, numbering badges, severity, errors or decoration.
- **The accent is used only for interactive elements** — primary button, active nav pill, links, selected choices, focus rings, pipeline step indicators.
- All four status count tiles have equal presence (own tint, coloured icon, ink label and number). Unverified is never styled as emptier, weaker or as an error.
- Objection severity is neutral: the word (Low / Medium / High) plus a 1–3 bar indicator in ink. It never reuses status hues.
- Any new text/background pair is added to the contrast test.

## Commands
- `npm test` — node tests (pipeline, proxy, telemetry).
- `npm run serve` — current static prototype on :5173. `npm run dev-proxy` — Worker handler in Node on :8787.
