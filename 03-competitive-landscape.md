# Competitive Landscape

This section exists to be shown, not hidden. Being able to say "here is exactly who else is in this space, and here is precisely why we are still worth building" is a stronger position than pretending the space is empty.

## Direct competitors — generic AI idea validators

| Company | What it does | Pricing |
|---|---|---|
| **Preuve AI** | Scans 60+ live sources, maps up to 15 competitors with funding/pricing, links every claim to a source | Free scan; $29 one-time report |
| **IdeaProof** | TAM/SAM/SOM plus competitor SWOT analysis, ~120-second reports | From €19.99 |
| **ValidatorAI** | Validation using behavioral data from 300,000+ founders | Free / $49 |
| **DimeADozen** | One-time idea validation reports | $9–$129+ |
| **Startup.ai, VenturusAI, Trend Seeker, Inodash** | Idea generation, validation, and demand-signal matching | Various, mostly low-cost |

One of these (a Reddit-posted "Startup Idea Validator") dates to December 2022 — this category has been rebuilt repeatedly for over three years. Google's own AI Overview, for the plain search "startup idea validator," already names Preuve AI directly. That's the clearest signal available that the free-standing, founder-facing validation app angle is closed.

## Adjacent, better-funded players — VC and diligence tooling

| Company | Relevance |
|---|---|
| **Rogo** | AI research/diligence for finance; raised a $160M round in 2026 at roughly a $2B valuation |
| **Hebbia, Energent.ai, V7 Go, Brightwave** | AI research and diligence agents used by investment/research teams |
| **PitchBook, Crunchbase, CB Insights, Harmonic, Specter, Synaptic, Dealroom** | The incumbent data layer — increasingly shipping AI features directly into ChatGPT, Claude, and Copilot themselves |

## The patent/IP-search adjacency

Checking "has this already been done" is structurally the same problem patent attorneys solve for prior art. Real tools already exist here too — PQAI (free), PatSnap, IPRally, Cypris — and the USPTO itself has been piloting AI-assisted prior art search. Useful evidence the underlying method has real commercial demand, but this market is mature and not a place to compete head-on.

## The closest direct competitor: Startup Screener

[`startupscreener.io`](https://startupscreener.io/) — founder Nay Linn Aung, GitHub repo literally named `AI_Portfolio_Project_Startup_Screener`, tied to a `.edu` email at Hood College. A solo student's portfolio project, not a funded company. Self-reported adoption: **2 cohorts, 5 decks analyzed, total, ever.**

Founders upload a pitch deck (PDF/PPTX/DOCX/XLSX); it scores the deck across seven dimensions — Problem-Solution Clarity, Market Research, Business Model, Traction, Defensibility & Competition, Team, Deck Quality — with a SWOT breakdown, cohort dashboards for reviewers, and exports. Markets explicitly to founders, mentors, accelerators, *and universities*.

**The real overlap:** it targets the exact same buyer VistaDex is positioned around — accelerators and universities running cohort screening, not individual founders. "Sell to institutions" is no longer uniquely VistaDex's insight.

**The real difference — a mechanism difference, not a feature list:** Startup Screener scores **deck quality and internal coherence** — is the pitch well-argued, is the market sizing reasoning sound — with "evidence-linked" meaning each score traces back to *a specific slide in the deck itself*. That's internal traceability to the founder's own document, not external verification against the outside world. Nowhere does it check a claim against a live competitor's actual product, cross-reference funding databases, or — the piece that matters most — maintain any database of startups that already tried something similar and failed. It's judging whether the pitch is convincing. VistaDex is built to judge whether the pitch is *true*.

**What this means practically:** don't lead a pitch with "we sell to institutions" alone — lead with the mechanism difference (external, live, evidence-checked verification plus the failure-precedent graveyard), since that's the part Startup Screener doesn't touch at all. The flip side is genuinely good news: a single unfunded student got far enough into this exact customer segment to have a working product with real (if tiny) usage — direct proof the segment is reachable by a small team with no funding, which is exactly the team's situation.

## Platform risk — the biggest threat

OpenAI, Google, and Microsoft are moving fast here. OpenAI shipped an agent product ("ChatGPT Work") in mid-2026 aimed at exactly this kind of multi-step research task. PitchBook and Crunchbase have both shipped official, direct integrations into ChatGPT, Claude, and Copilot. No major lab has shipped a feature specifically named "verify my startup idea against real competitors" as of writing — but any of them plausibly could, using data access they already have.

## What survives scrutiny

- **Kill:** a generic, founder-facing, self-serve idea validator. Crowded, three-plus years old, already the default answer in Google's own AI results.
- **Keep, in a narrower form:** an institutional screening tool, built around the graveyard database none of the existing tools have, with an honest, documented accuracy methodology as part of the product itself.

The reasoning: every existing tool answers "does this look good right now," using live, easy-to-get data. None of them answer "has this specific idea already been tried and quietly killed," because that requires *building* something, not just querying something that already exists. That's the actual gap — narrow, honestly stated, and defensible under a hard question in a room.
