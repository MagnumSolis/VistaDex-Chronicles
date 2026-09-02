# VistaDex

**An idea-novelty and overlap screener for accelerators, universities, and VC funds.**

VistaDex takes a submitted startup or research idea, decomposes it into individual factual claims, verifies each claim against live sources, checks the idea against a proprietary database of dead and pivoted startups (the "graveyard"), and runs the result through an adversarial **Objector** agent whose job is to argue against the system's own conclusion before anything is presented as final.

This repository is the single source of truth for the project — documentation, methodology, research, slides, and progress — for the BITS F364 (Human-AI Interaction) course submission and the independent startup exploration it has since merged with.

---

## Current status (as of Sept 2026)

- Presented the current concept to course instructor **Prof. Siddharth Mehrotra** — positive response
- Prof. Mehrotra connected the team with **PIEDS** (BITS Pilani's startup incubator) for a user-research interview — PIEDS represents VistaDex's real target user base
- Applied to **AICTE Indovation Jaipur's DesertBloom: YUKTI Ideation Workshop & Mentorship** program
- Call scheduled with **Manoj Agarwal**, founder of **GikaGraph.ai**, for **Sept 4** — problem statements, possible collaboration, and a potential summer internship

## Team

| Member | Role |
|---|---|
| **Aditya Pradhan** | Team lead / coordinator — final technical and non-technical decisions, overall architecture |
| **Kushagra Agnihotri** | LLM engineering — claim extraction, live retrieval, matching engine |
| **Richeek Mishra** | UI/UX design, SEO, marketing |
| **Lakshit Tanwar** | Technical work and data processing — entity resolution, graveyard tagging pipeline, accuracy testing |

## Repo map

```
docs/
  01-executive-summary.md          What VistaDex is, in one page
  02-origin-and-pivot-history.md   How the project got here — full chronicle
  03-competitive-landscape.md      Who else is in this space, and why we still hold up
  04-product-architecture.md       The two components and how they connect
  05-data-collection-methodology.md   How the graveyard database gets built
  06-accuracy-testing-methodology.md  How we know the system is honest
  07-ui-ux-design.md               Interface spec, with the built mockups
  08-business-model-and-gtm.md     Who pays, and the sequencing to get there
  09-roadmap.md                    Execution plan
  10-glossary-and-references.md    Terms and sources
slides/
  VistaDex_Pitch_Deck.pptx         Current pitch deck
assets/
  dashboard-mockup.png
  detail-view-mockup.png
archive/
  discarded-concept-claim-verification/
    README.md                     The first VistaDex — enterprise claim verification —
                                   discarded after confirming GikaGraph already ships it
```

## Contributing

Keep new docs in `docs/`, numbered so reading order stays obvious. Anything superseded goes to `archive/` with a note on why, not deleted — that's the point of a "Chronicles" repo. Use PRs so changes are attributable per person.
