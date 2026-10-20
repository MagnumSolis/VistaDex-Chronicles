# Origin Story & Pivot History

This is the full chronicle — worth keeping intact rather than cleaned up, because it's the actual evidence the current product is built on a real, repeatedly-observed problem rather than an invented one.

## 1. The course project's starting point

BITS F364 (Human-AI Interaction), taught by Prof. Siddharth Mehrotra, required a team project — either a research-paper track or a startup track, producing a medium- or high-fidelity prototype. Team: Aditya Pradhan (lead), Kushagra Agnihotri, Richeek Mishra, Lakshit Tanwar.

Aditya's original idea: a handheld module (camera, mic, speaker, embedded display) that an experienced technician — say, in an auto repair shop — uses to record and narrate repair demonstrations, uploaded to a job-specific knowledge base. Apprentices carry paired modules running a small, offline-capable language model for real-time help. Envisioned as extensible to other trades. This evolved toward a software-first "context-sensitive AI companion" merging interruption-timing awareness, comprehension-adaptive explanation, and trust/reliance calibration.

## 2. The pivot to Project 14

Teammate Lakshit produced a validation report recommending the team pivot to **Project 14** (Trust-Calibration Signals for AI Assistants), the official course brief, instead of Aditya's original idea. The team agreed.

From Project 14, the team built a **B2B "confidence checker" for enterprise knowledge workers** — claim-level evidence verification, calibrated confidence, actionable advice — first named **TrustLens**, then renamed **VistaDex**. This version had real substance behind it:

- A **"verification substitution" hypothesis (H2)**: that showing users more granular AI-generated evidence makes them *feel* more confident while actually *verifying less* — a risk that goes beyond the closest prior work (PaperTrail, CHI 2026).
- A **six-condition within-subjects study design**, measuring per-claim acceptance/rejection rates and evidence-click rates across: plain answer, ordinary citation, claim-level labeling, calibrated frequency, templated advice, and free-form LLM advice.
- A working **React prototype** with behavioral logging (`VistaDexConsole.jsx`).
- Full deliverables: a 15-slide pitch deck, a 9-page project report, and a 19-page master reference document covering the full ideation history, glossary, and audience-specific guides.
- Four fully-verified citations with DOIs, including resolving a real citation error (the "To Rely or Not to Rely?" paper is by Bo, Wan & Anderson, CHI 2025 — not "Kim, J." as an earlier draft had it; Kim, Wortman Vaughan et al., CHI 2025 is a separate paper — the N=308 study on sources reducing follow-up questions — and is the empirical seed for H2).

**This version is now discarded.** See the [archive](../archive/discarded-concept-claim-verification/README.md) for the full detail on why, and for what it contained.

## 3. Why it was discarded: the GikaGraph overlap

The team won the **APPCAIR JAW 2026 Hackathon** at BITS Pilani (co-organized by GikaGraph.ai) on a related trust/reliability-in-GenAI theme, which is how Aditya became well-acquainted with GikaGraph founder **Manoj Agarwal**.

Direct verification of GikaGraph's live product — via actual screenshots, not marketing copy — confirmed their RFP-analysis tool already implements per-requirement confidence classification, cited evidence, and recommended next actions. This is a close, functional overlap with the original VistaDex mechanism. Rather than build a worse version of something a funded team already ships, the team discarded the enterprise-claim-verification concept entirely.

This mirrors a pattern that had already shown up repeatedly in Aditya's separate, parallel search for an independent startup idea (see below) — AI-proposed "novelty" was, again and again, wrong on direct verification. That repeated pattern is what the current product exists to solve.

## 4. The parallel startup search

While the course project was underway, Aditya was independently searching for a viable AI-space startup idea. Several ideas were proposed with real confidence and each time, manual checking found well-funded competitors already existed:

- **Approval-fatigue monitoring** for AI agents — judged too easily clonable by AI platform owners.
- **Chip-design AI** — dominated by ChipAgents (raised over $130M) and Synopsys.
- **AI red-teaming as a service** — crowded by HackerOne, Lakera, Confident AI, and others.
- **Indic code-mixed safety red-teaming** — survived competitive scrutiny, but rejected by Aditya as too India-niche rather than globally deployable.
- **A generic AI idea-validator** — found already occupied by Preuve AI, IdeaProof, ValidatorAI, and others going back to 2022.
- **"Proof of human" verification** — a major-AI-lab-backed competitor already had integrations with Tinder, Zoom, and Docusign.

This is what makes the underlying problem credible beyond personal experience: published research on AI ideation shows a documented tendency toward **mode collapse** (AI-generated ideas look novel individually but collapse toward a much smaller set of underlying ideas than they appear to), and separately, measured **sycophancy** — AI models affirming a user's own proposal more than a neutral evaluator would. Independent studies of AI "deep research" agents have also found meaningful rates of fabricated or broken citations even when the links look valid.

## 5. The idea that survived: the idea-novelty and overlap screener

What emerged, working title **"Precedent,"** is the current product: an idea-novelty and overlap screener, differentiated by:

- A **proprietary dead-and-pivoted-startup graveyard database** — nobody else maintains this well.
- An **adversarial Objector agent**, built specifically to argue against the system's own conclusions.
- **Per-claim external verification against live sources**, not internal pitch-quality scoring.
- Sale to **institutions** (accelerators, universities, VC funds), not individual founders.

A near-competitor, **Startup Screener** (`startupscreener.io`), was found during this research — a solo student's portfolio project (GitHub repo `AI_Portfolio_Project_Startup_Screener`, tied to a `.edu` email) with 2 cohorts and 5 decks processed, total, ever. It confirmed the institutional-buyer angle is reachable by a small team, but also showed "sell to institutions" is not exclusively novel positioning — see [`03-competitive-landscape.md`](./03-competitive-landscape.md) for the full breakdown of why VistaDex is still differentiated (external, live, evidence-checked verification plus the graveyard database — Startup Screener scores internal deck coherence, not external truth).

A full, comprehensive execution report was built for this concept under the "Precedent" working name — see [`04-product-architecture.md`](./04-product-architecture.md) onward for that content, carried forward into the current docs.

## 6. The rename: Precedent → VistaDex

Aditya decided the project should carry the **VistaDex** name — the wordplay ("Vista," a view, plus "Dex," an index) fits an idea-novelty screener at least as well as it fit the original claim-verification tool. Since the original VistaDex concept was already fully discarded (Step 3), there was no live naming conflict to resolve — the name transferred cleanly to the surviving product.

## 7. Present state: one unified project

This idea-novelty screener is now, singularly, **VistaDex** — both the BITS F364 course submission and Aditya's independent startup exploration, unified into one project rather than two. Presented to Prof. Mehrotra, who responded positively and connected the team with PIEDS for user research. Applied to AICTE Indovation Jaipur's DesertBloom: YUKTI program. A call with Manoj Agarwal (GikaGraph) is scheduled for Sept 4 to discuss problem statements and possible collaboration.
