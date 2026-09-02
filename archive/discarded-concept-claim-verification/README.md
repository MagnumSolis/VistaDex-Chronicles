# [Archived] VistaDex v1 — Enterprise Claim Verification

**Status: discarded.** Kept here for the record, not as active documentation. See [`../../docs/02-origin-and-pivot-history.md`](../../docs/02-origin-and-pivot-history.md) for the full story of the pivot away from this concept.

## What this was

A B2B "confidence checker" for enterprise and research knowledge workers, originally named **TrustLens**, then renamed **VistaDex**. An AI-generated analytical answer — over an audit file, a bid document, or a lab's own results — was decomposed into individual factual claims, each checked against a fixed, trusted document corpus, and paired with a concrete recommendation for what to do about any claim that didn't hold up.

This was the team's response to **Project 14** (Trust-Calibration Signals for AI Assistants), the official BITS F364 course brief, after teammate Lakshit's validation report recommended pivoting away from Aditya's original hardware-companion idea.

## The core research contribution

**Hypothesis H2 — "verification substitution":** the possibility that showing people more granular AI-generated evidence makes them *feel* more confident while actually *checking less*. This went beyond the closest prior work (PaperTrail, CHI 2026) and had real, documented real-world stakes.

## Study design

A **six-condition within-subjects study**, measuring per-claim acceptance/rejection rates and evidence-click rates across:

1. Plain answer
2. Ordinary citation
3. Claim-level labeling
4. Calibrated frequency
5. Templated advice
6. Free-form LLM advice

## Deliverables that were built

- A working **React prototype** with behavioral logging (`VistaDexConsole.jsx`).
- A **15-slide pitch deck** (`VistaDex_Pitch_Deck.pptx`).
- A **9-page project report** (`VistaDex_Project_Report.docx`).
- A **19-page master reference document** (`VistaDex_Complete_Reference.docx`) covering the full ideation history, glossary, and audience-specific guides.
- A **Project Execution Report**, covering the problem, four structuring hypotheses, full methodology, technical build, stakeholder-engagement plan (GikaGraph.ai, with a fallback route through Dr. Dhruv Kumar), and semester timeline.

## Citations verified with DOIs

- Bo, Wan & Anderson, "To Rely or Not to Rely?" — CHI 2025, DOI: `10.1145/3706598.3714097`
- Kim, Wortman Vaughan et al. — CHI 2025, DOI: `10.1145/3706598.3714020` (the N=308 study that seeded H2)
- Martin-Boyle et al., "PaperTrail" — DOI: `10.1145/3772318.3791101`
- Zhou et al., "REL-A.I." — DOI: `10.18653/v1/2025.naacl-long.556`

A citation error was caught and fixed during this process: "To Rely or Not to Rely?" had been misattributed to "Kim, J." in an earlier draft — it's actually Bo, Wan & Anderson. Kim, Wortman Vaughan et al. is a separate paper.

## Why it was discarded

The team won the **APPCAIR JAW 2026 Hackathon**, co-organized by GikaGraph.ai, which led to a close working relationship with founder **Manoj Agarwal**. Direct verification of GikaGraph's live product — actual screenshots, not marketing copy — confirmed their RFP-analysis tool already implements per-requirement confidence classification, cited evidence, and recommended next actions. This is a close, functional overlap with VistaDex v1's core mechanism.

Rather than build a worse version of a tool a funded team already ships, the team discarded this concept entirely and pivoted to the current idea-novelty and overlap screener, which inherited the VistaDex name. The accuracy-methodology discipline built here — separating hard facts from judgment calls, requiring multi-source corroboration, testing against known outcomes — carried forward directly into the current product's [accuracy & testing methodology](../../docs/06-accuracy-testing-methodology.md).

**Note:** the actual `.pptx`/`.docx` deliverable files described above were built in a prior working session and are not included in this archive folder — only this written record of their content and structure. If the original files still exist locally or in a prior download, add them here directly (`vistadex_pitch_deck.pptx`, `vistadex_project_report.docx`, etc.) to make this archive fully self-contained.
