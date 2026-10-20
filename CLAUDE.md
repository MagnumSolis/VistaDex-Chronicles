# VistaDex — working rules

VistaDex is an evidence-linked idea screener. Someone describes a startup idea (title, pitch, problem, solution, moat, industry, role, markets); it (1) splits it into checkable claims, (2) checks each claim against independent web sources and labels it confirmed / contradicted / disputed / unverified, (3) looks for competitors and Big Tech activity, (4) matches it against a "graveyard" of startups that shut down, and (5) lists objections, then (6) computes an **explainable** VistaDex Score in code. **It never says "good idea" or "bad idea": the person decides.**

One app, one build, **two editions** (`web/src/edition.ts` is the only place that knows which one is running; components read `features`, and a test fails if any other file names an edition):

| | Public demo (default) | Pitch / internal |
|---|---|---|
| Who | Anyone from the LinkedIn link | The team, in pitches and for testing |
| Start page | Home (landing); the LinkedIn link is #/screen | Reports (on a fresh load) |
| Walkthrough · Feedback | Yes | No |
| Telemetry | Yes, after the Welcome notice | **None**: telemetry.js is disabled, nothing is logged or uploaded |
| Reports page | Reports this browser ran (localStorage, clearable) | Session runs (memory) + the demo cohort |
| Sample reports toggle | Off / 5 / 10 / 15 researched samples (memory only, never saved) | Same |

The pitch edition is opened with `#edition=pitch` (the `code=…` usually next to it is only the study access code for the proxy). It is **not protected**: the switch is client-side and no code is checked, so never describe it as locked. TODO(team): a separate `PITCH_CODES` secret verified by the Worker (docs/BACKEND-HANDOFF.md §7). A "Pitch edition" badge is always shown in it.

## Git
- Work on `feat/ui-revamp` (branched from `feat/weekend-prototype`). Never commit to `master`, `main` or `feat/weekend-prototype`; never merge into, rebase or force-push them. Check the branch before every commit.
- Ask before the first push. Never commit secrets (`.env` is ignored; see `.env.example`).

## Frozen unless explicitly asked
- Pipeline logic (`prototype/core/`), the POST /screen contract, the key-free mock path, the proxy (`worker/`). Round 2 (2026-10-20) changed them deliberately: structured input, traction claims, competitors, Big Tech risk, TAM from verified quotes, scores. Every weight and threshold lives in `prototype/core/scoring-config.js`, pinned by `tests/scoring-config.test.js`.
- Telemetry: `tests/fixtures/event-contract.json` is the contract (event types, payload keys, enum values, control ids). The UI must reproduce it; `npm run parity` checks it in Chrome. Bump `STUDY_VERSION` (prototype/ui/study-config.js) whenever the visitor-facing UI or the telemetry changes, and record it in the fixture.
- No idea text and no report content in telemetry; runs are described by lengths and counts. Feedback is sent under its own random id, never with the usage session.
- Everything must run end-to-end with zero API keys and deploy as a static site (GitHub Pages).
- The BITS F364 study UI (consent dialog, trust sliders, per-claim rating, notes, survey) is retired to `web/src/retired/study/` (not routed). The public demo is not used for the F364 paper.

## Product principles (they override any visual reference)
- **Every score is explainable.** The VistaDex Score and each axis are computed in code from the report, never by a model. The breakdown — each axis's value, inputs, search boundary (what was searched or checked), weight and the formula — is always one tap away ("How this was calculated").
- **Absence never scores as a good result.** An axis without enough data shows "Not enough data" and is left out of the score, never guessed or drawn as zero. Finding nothing is said as "nothing found in N sources", with a cap where it would otherwise flatter (Novelty with no competitors found ≤ 70). A stated moat alone is not data.
- Never "good idea" / "bad idea" wording, no grades, no confidence percentages. Scores are ink numbers, never coloured good/bad.
- Status colour is used only for statuses. Every status is readable without colour: a text label **and** an icon, always.
- "Unverified" is a normal state with equal visual presence, never styled as an error. No celebratory styling for "confirmed" (no green, no glow, no animation).
- Objections get equal visual weight to claims (same card, type size and spacing). Graveyard matches are framed as "Leads to check", with cause of death, the shared words and a plain match strength, never a verdict.
- Do not invent facts, data, sources or metrics. Anything the live pipeline cannot produce shows "Not available in this version yet"; only the in-browser mock mode carries clearly labelled sample placeholders (`prototype/data/samples.js`, listed in `sample_fields`), and scores built on them say "sample data". The same two-source rule applies to Big Tech risk: fewer than 2 independent sources → "unverified"; searched and nothing found → "none found".

## Design brief (applies to every UI change)
Derived from the reference screenshots as principles, not layouts:
- **Colour blocks, not borders or shadows.** One fixed theme for everyone (shadcn `dark:` never follows the OS): a deep-green page frame, flat cream panels for reading and forms, paper cards inside them, lime for brand blocks and the primary action on the page, charcoal "product windows" for live machinery (progress, the walkthrough card). No drop shadows: depth comes from tonal contrast. Two or three surface colours per view.
- **Interlocking blocks.** Panels sit on the page with a 16–20px gutter of page colour between them. Section titles are **folder tabs** on the top-left edge of their panel, joined with an inward-curved corner (`.tab-notch`). On phones blocks simply stack.
- **Bento tiles.** Generous empty space, a small line icon and a medium-weight label anchored bottom-left (`Tile`). Big counts in the display face, top-left.
- **Type.** Fraunces (soft serif, regular weight, tight leading) for page titles, section tabs and big numbers; Instrument Sans for body, claims and objections (17–18px reading size); JetBrains Mono for small numbers, counters and codes. Small uppercase, letter-spaced eyebrows (`.eyebrow`) above titles and as card labels. All fonts are self-hosted (no font CDN at runtime).
- **Shape ladder.** Panels 28px, cards and tiles 20px, nested surfaces 14px, controls 6px. Buttons are rectangles (solid deep green with lime label on light surfaces; solid lime or cream outline on the page), never pills.
- **Lines and diagrams.** Thin dark-outline line art (the How it works stack), legends as small rounded squares with uppercase labels.
- **Density.** Low: one idea per panel, comfortable line length (≤ 70ch).
- **Navigation.** Home · Screen an idea · Reports · How it works · Contact us (+ Feedback button and "?" in public). Floating inset cream header bar with text links on desktop; compact top bar plus a fixed bottom tab bar on phones. The report has a sticky section jump nav (side rail on desktop, horizontal chips on phones): Summary · Profile · Claims · Leads to check · Objections · Big Tech risk · Legal · Market.
- **Charts.** Hand-written SVG, each with a caption and a visually hidden data table. The radar marks axes without data as n/a (dashed, not plotted) and its labels never clip at 360px; the donut uses the status palette with gaps and a label + icon legend; bars are ink; category charts (industry pie) use the brand-green lightness ramp `--cat-1…6`, never status hues.
- **Landing page (Home).** Built from the team's Figma draft with our tokens; product screens are the real components rendered with sample data, scaled and inert.
- **Motion.** Minimal, short colour transitions only; the running spinner and the walkthrough outline are the only movement, and nothing moves under `prefers-reduced-motion`.
- **Accessibility.** WCAG 2.2 AA: contrast for every token pair, fully keyboard navigable, visible focus (ink ring on light surfaces, lime ring on the page), focus never hidden under the sticky header or tab bar.
- **Responsive.** Mobile-first; every screen works at 360px (and 320px) with no horizontal scroll. Each screen has empty, loading, error (pipeline failed, rate limit, daily cap) and phone states.

## Colour tokens (web/src/index.css — source of truth)
AA verified in `web/src/test/contrast.test.ts`; status hues verified distinguishable under protanopia, deuteranopia and tritanopia (CIEDE2000 ≥ 10 strong, ≥ 5 tints) and kept in one lightness band in `web/src/test/colour-vision.test.ts`.

| Role | Token | Value |
|---|---|---|
| Page frame | `--page` / `--on-page` / `--on-page-muted` | `#0B3B2C` / `#EEF2E2` / `#B5CCBC` |
| Raised block on the page (tab bar, chips) | `--page-raised` | `#144A38` |
| Brand block / primary on the page | `--lime` / `--on-lime` | `#CBEF6A` / `#0B2E22` |
| Product window | `--charcoal` / `--charcoal-raised` / `--on-charcoal` | `#232623` / `#2E322E` / `#EEF2E2` |
| Reading panel (cream) | `--background` | `#EEF2E2` |
| Card (paper) | `--card` | `#F9FBF4` |
| Nested surface | `--muted` | `#E3EAD3` |
| Ink — all body, claim and objection text | `--foreground` | `#0B2E22` |
| Helper text | `--muted-foreground` | `#45584C` |
| Primary button on light surfaces | `--primary` / `--primary-foreground` | `#0B3B2C` / `#CBEF6A` |
| Inline links | `--link` | `#1F5A36` |
| Field outline | `--input` | `#6E7F6F` (≥ 3:1, WCAG 1.4.11) |
| Contradicted | `--st-contradicted` / `-bg` | `#661812` / `#EECBC7` |
| Disputed | `--st-disputed` / `-bg` | `#705713` / `#FBE2A3` |
| Confirmed | `--st-confirmed` / `-bg` | `#084BC9` / `#CAD6F7` |
| Unverified | `--st-unverified` / `-bg` | `#661A58` / `#F6DAEF` |
| Chart categories (industry pie) | `--cat-1` … `--cat-6` | `#0B3B2C` `#2E6B4D` `#5E9474` `#9DBF7A` `#CBEF6A` `#F9FBF4` (ΔE2000 ≥ 10 apart under all three colour-vision simulations) |

**Colour rules**
- **Status hues only for status**: status tags, status count tiles, status icons. Never for body text, objections, severity, errors, the brand or decoration. No status hue is green, so the brand never reads as "confirmed".
- All four status tiles have equal presence (own tint, coloured icon, ink label and number).
- Objection severity is neutral: the word plus a 1–3 bar indicator in ink.
- Problems (refusals, failures) are ink on paper with an outline and an icon, never a status hue.
- Any new text/background pair is added to the contrast test.

## Telemetry rules (public edition)
- Every interactive control carries `data-control="<id>"` from `web/src/telemetry/controls.ts` (same list as the contract); a test fails if a rendered button, link or field has none. Text fields log their length only, when left.
- Time per screen, per report section (in view by the panel-viewed rule: ≥ 50 % of the section or ≥ 50 % of the viewport) and per walkthrough step.
- Nothing before the Welcome notice is answered (Home, How it works and Contact us are readable without it); nothing after "Use without recording"; nothing ever in the pitch edition.

## Commands
- `npm test` — node tests (pipeline, proxy, telemetry, study_version guard). `npm run test:web` — web tests (contrast, colour vision, editions, flows, telemetry contract, pitch sends zero events).
- `npm run serve` — web/ dev server on :5173. `npm run build` — static build in web/dist. `npm run dev-proxy` — Worker handler in Node on :8787.
- With the dev server running (`VD_BASE=<url>` for another port): `npm run parity` (telemetry against the contract, pitch sends nothing), `npm run a11y` (axe at 1280/375/360/320, keyboard, overflow, reduced motion), `npm --prefix web run access-e2e` (access code and edition link), `npm --prefix web run shots` (screenshots). Run parity and a11y after any UI change.
- `npm run prelaunch` — fails while blocking team decisions remain; lists the non-blocking TODO(team) defaults as warnings.
