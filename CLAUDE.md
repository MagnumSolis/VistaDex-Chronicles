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
- For each piece of work, branch from the latest `main` (`git fetch` first) and merge back by PR with **Create a merge commit** (never squash or rebase). Never commit to `main` directly, never rewrite pushed history, never force-push. Check the branch before every commit, and push with an explicit remote branch: `git push -u origin <branch>:<branch>`.
- Ask before the first push. Never commit secrets (`.env` is ignored; see `.env.example`).
- Never commit `docs/PR-*.md` or `docs/screenshots/` (untracked on purpose). Stage files by name, never `git add -A` / `git add .`. One commit per fix; show each new test failing before its fix; chain the checks and the commit with `&&`.

## Frozen unless explicitly asked
- Pipeline logic (`prototype/core/`), the POST /screen contract, the key-free mock path. In the Worker: the `/screen` route and its contract, `/events` intake, the D1 schema, `/export` and `DELETE /session` — frozen unless the task explicitly says otherwise. The Research Console (`worker/src/research-page.js`, `worker/src/research-join.js`) is open. Round 2 (2026-10-20) changed them deliberately: structured input, traction claims, competitors, Big Tech risk, TAM from verified quotes, scores. Every weight and threshold lives in `prototype/core/scoring-config.js`, pinned by `tests/scoring-config.test.js`.
- Telemetry: `tests/fixtures/event-contract.json` is the contract (event types, payload keys, enum values, control ids). The UI must reproduce it; `npm run parity` checks it in Chrome. Bump `STUDY_VERSION` (prototype/ui/study-config.js) whenever the visitor-facing UI or the telemetry changes, and record it in the fixture.
- No idea text and no report content in telemetry; runs are described by lengths and counts. Feedback is sent under its own random id, never with the usage session.
- Everything must run end-to-end with zero API keys and deploy as a static site (live on Cloudflare Pages, vistadex-app.pages.dev; the relative `base` keeps sub-path hosting working).
- The BITS F364 study UI (consent dialog, trust sliders, per-claim rating, notes, survey) is retired to `web/src/retired/study/` (not routed). Since 2026-10-study-1 the live public demo is the course research data source (field track: the Welcome notice is the research consent), which is what the Research Console measures.

## Deploys
- Merging to `main` does **not** deploy the site. The site is deployed by hand: `npm run build`, then `npx wrangler pages deploy web/dist --project-name vistadex-app`.
- The Worker (`worker/`: proxy, Research Console, D1) deploys from `main` through `.github/workflows/deploy.yml` on pushes that touch `worker/**` or `prototype/**`. After every such merge, check that the run happened. If it didn't, deploy with `cd worker && npx wrangler deploy`.
- `.github/workflows/graveyard-sync.yml` also deploys the Worker after each graveyard snapshot push, so any sync ships main's Worker code.
- Claude never deploys and never queries production D1; the team does both.

## Network guard
- Both test suites load `tests/setup/network-guard.js` (node `--import`, vitest `setupFiles`), which blocks and records any non-localhost request. Tests use `https://proxy.test` with a stub.
- `npm run smoke` does not load the guard. Run `node --import ../tests/setup/network-guard.js src/smoke.js` from `backend/`.
- `prototype/config.js` points PROXY_URL at production. For checks, run the dev server only on a scratch Vite config outside the repo with PROXY_URL blanked, and delete it afterwards.
- Browser scripts (parity, a11y, access-e2e, shots) run only under a Chrome-lock runner outside the repo (`--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"` + `--disable-background-networking`), shown blocking https://example.org first.
- Anything embedded via `Function.prototype.toString` must be tested against the wrangler bundle, not just the source: `npx --offline wrangler deploy --dry-run --outdir <scratch>`. esbuild keepNames inserts `__name` calls.

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

## Contrast rule (binding for every new UI surface)

Check the background before choosing a text token. The muted tokens are tuned
for ONE background each: `--on-page-muted` (`#B5CCBC`) only on the dark page
frame (`--page`); on cream/white surfaces (`--background`, `--card`, `--lime`,
`--charcoal`) use `text-foreground/70`–`/80` (dark ink) — pale green on white
fails WCAG AA. New components on light panels must never use `text-on-page-muted`
/ `text-on-charcoal-muted`. `web/src/test/contrast.test.ts` guards the core
tokens; if a new surface adds text, add it there too.

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
- `npm run serve` — web/ dev server on :5173 (talks to the production Worker; for checks use the offline config above). `npm run build` — static build in web/dist. `npm run dev-proxy` — Worker handler in Node on :8787.
- Under the Chrome lock, with the offline dev server running (`VD_BASE=<url>` for another port): `npm run parity` (telemetry against the contract, pitch sends nothing), `npm run a11y` (axe at 1280/375/360/320, keyboard, overflow, reduced motion), `npm --prefix web run access-e2e` (access code and edition link), `npm --prefix web run shots` (screenshots). Run parity and a11y after any UI change.
- `npm run prelaunch` — fails while blocking team decisions remain; lists the non-blocking TODO(team) defaults as warnings.
