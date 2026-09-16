# VistaDex Chronicles

> *"Every other tool tells you if your idea looks good today. We tell you if it already died once — and we're honest about how sure we actually are."*

VistaDex is an institutional startup idea screening tool built for **accelerators, universities, and VC funds**. It checks a submitted idea's factual claims against live evidence, and separately matches it against a proprietary database of startups that already failed, pivoted, or quietly shut down.

---

## Prototype

Open `prototype/index.html` directly in any browser — no build step, no server required.

### Three screens

| Screen | Description |
|--------|-------------|
| **Cohort Dashboard** | Batch view of all submitted ideas — riskiest surfaced first, status badges, graveyard matches, confidence scores |
| **Screen an Idea** | Paste raw idea text → watch the 4-stage pipeline animate live → get a full Verifier + Graveyard + Objector report |
| **Graveyard DB** | 20 real failed startups with cause-of-death filtering and full-text search |

---

## LLM Pipeline Architecture (Kushagra's module)

```
Idea Text Input
    │
    ▼
Stage 1 — Claim Extraction       (Groq llama-3.3-70b-versatile)
    │  → JSON array of atomic, falsifiable claims
    ▼
Stage 2 — Live Retrieval + Classification   (Tavily API + Groq)
    │  → each claim: confirmed / contradicted / disputed / unverified
    ▼
Stage 3 — Graveyard Matching     (all-MiniLM-L6-v2 + MongoDB Atlas)
    │  → top 3–5 past startups that tried something similar
    ▼
Stage 4 — Objector Pass          (Groq — argues AGAINST the conclusion)
    │
    ▼
Final Combined Report
```

Full architecture: [`vistadex-llm-pipeline-architecture.md`](./vistadex-llm-pipeline-architecture.md)

---

## Stack

| Component | Tool | Cost |
|-----------|------|------|
| LLM (extraction + classification) | Groq API — `llama-3.3-70b-versatile` | Free tier |
| Live web retrieval | Tavily API | Free tier (1000 searches/mo) |
| Embeddings | `all-MiniLM-L6-v2` (Sentence Transformers) | Free, local |
| Vector store + DB | MongoDB Atlas | Free tier |

---

## Repo Structure

```
/
├── prototype/              ← Working browser prototype (open index.html)
│   ├── index.html          ← App shell
│   ├── style.css           ← Dark-theme design system
│   ├── data.js             ← Graveyard DB + cohort mock data (mirrors MongoDB schema)
│   ├── pipeline.js         ← 4-stage pipeline (stubs → replace with real API calls)
│   └── app.js              ← UI controller
│
├── 01-executive-summary.md
├── 02-origin-and-pivot-history.md
├── 03-competitive-landscape.md
├── 04-product-architecture.md
├── 05-data-collection-methodology.md
├── 06-accuracy-testing-methodology.md
├── 07-ui-ux-design.md
├── 08-business-model-and-gtm.md
├── 09-roadmap.md
├── 10-glossary-and-references.md
└── vistadex-llm-pipeline-architecture.md
```

---

## Team

| Member | Owns |
|--------|------|
| **Kushagra Agnihotri** | Claim extraction, live retrieval, matching engine (LLM/RAG) |
| **Lakshit Tanwar** | Entity resolution, graveyard tagging pipeline, accuracy testing |
| **Richeek Mishra** | Reviewer dashboard and idea-report interface (UI/UX) |
| **Aditya Pradhan** | Overall architecture, data ingestion, integration |

---

## API Contract (POST /screen)

```json
// Request
{ "idea_text": "..." }

// Response
{
  "claims": [
    { "claim": "...", "type": "novelty|market_size|defensibility|other",
      "status": "confirmed|contradicted|disputed|unverified",
      "reasoning": "...", "source_urls": ["..."] }
  ],
  "graveyard_matches": [
    { "company_name": "...", "what_they_tried": "...",
      "cause_of_death": "...", "year_closed": 2020, "similarity": 0.87 }
  ],
  "objections": [
    { "objection": "...", "severity": "high|medium|low" }
  ]
}
```

---

*BITS Pilani · HCI Course · Fall 2026*
