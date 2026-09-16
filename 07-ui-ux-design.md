# UI/UX Design — Interface Specification

Two screens cover the whole product: an institution's reviewer sees a batch overview first, then drills into one idea's full report.

## Screen 1 — Cohort Dashboard

![Cohort dashboard mockup](../assets/dashboard-mockup.png)

*The batch-screening view a program officer or fund analyst sees first — every submitted idea in one place, worst cases surfaced first.*

**Layout, top to bottom:** a header bar with the product name and the current cohort/batch selected; a row of four summary numbers (total screened, clear, caution, high overlap); a search and filter bar; and a table listing every idea with its submitter, category, status badge, closest match if any, and a confidence indicator showing how many independent sources back that judgment. Sorting defaults to showing the riskiest ideas first, since that's what a reviewer actually needs to see immediately.

## Screen 2 — Individual Idea Report

![Idea detail report mockup](../assets/detail-view-mockup.png)

*The drill-down view for one idea — every claim checked, evidence for each, and past look-alikes framed as leads to verify, not verdicts.*

**Layout:** a header with the idea title, submitter, and overall status. Below that, two columns. The left, wider column lists each claim checked as its own card — the exact claim text, a status badge, the specific evidence behind it, and a one-line note on why that claim matters. The right column holds a compact "big-tech clone risk" assessment and a free-text box for the human reviewer's own notes, which feeds the accuracy feedback loop. Below both columns, a visually distinct panel — shaded differently from the rest of the page — shows graveyard matches, deliberately worded as "verify yourself," never as a certainty. A small footer line states exactly how many sources were consulted and reminds the reader that confidence comes from source count, not the model's own opinion of itself.

## Design principles behind these choices

- Worst cases surface first — a reviewer's time is the scarce resource, not screen space.
- Every number is explained, not just displayed — "2/4 sources" is more honest than a single confidence percentage.
- The graveyard panel is visually separate from the fact-checked claims — so nobody mistakes a "resembles a past failure" lead for a confirmed fact.
- A reviewer-notes field exists on every report — there is no version of this tool that doesn't collect its own accuracy feedback.

## Physical paper-prototype guide

For demoing to Prof. Mehrotra without a working build: index cards, sticky notes, two marker colours, a printed sample "idea" paragraph, and a printed table standing in for the dashboard.

1. Lay the printed dashboard table flat — five rows, each a fictional submitted idea, each with a hand-coloured status dot (green, amber, red).
2. Pick the "high overlap" row and lay out its full report next to it, one index card per claim (novelty, market size, clone-risk).
3. On each claim card, attach a small flap that lifts to reveal the "evidence" — nothing is asserted without something to check.
4. Add a separate, differently-coloured card labelled "Graveyard Match" showing a fictional dead startup with a one-line cause of death, and write "verify yourself" on it directly — make the hedge visible, not just implied.
5. Add a small "Reviewer Notes" sticky note at the bottom, and actually invite the reviewer to write a note on it during the demo — that's the feedback loop, made tangible.

**Line to say while doing this:**
> "Every card here can be lifted to check the evidence behind it. Nothing is presented as certain unless multiple independent sources agree — and this graveyard card is deliberately labelled 'verify yourself,' not 'confirmed,' because that's the honest level of confidence the evidence actually supports."
