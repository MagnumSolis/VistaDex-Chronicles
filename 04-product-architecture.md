# Product Architecture

VistaDex has two components that produce one combined report per submitted idea.

## 1. The Verifier

Takes a submitted idea, breaks it into individual factual claims (novelty, market size, defensibility), and checks each against live web sources, structured funding/patent databases, and direct competitor product verification. Produces a claim-by-claim report with evidence links and a status for each claim — **confirmed**, **contradicted**, **disputed**, or **unverified**.

**Pipeline:**
1. **Claim extraction** — an LLM prompt splits the submitted idea into individual, checkable claims.
2. **Live retrieval** — web search plus structured queries against funding databases, patent search (PQAI, Google Patents), and direct fetches of named competitors' actual product pages.
3. **Verification** — each claim is checked against what was retrieved and classified accordingly.
4. **Confidence scoring** — based on how many independent sources agree, never on the model's own stated confidence.
5. **Output** — a structured report with every claim, its status, and its evidence links.

## 2. The Graveyard Database

A separately maintained, continuously growing database of startups that failed, pivoted, or quietly shut down, each tagged with a cause of death and a short, searchable summary of what they were trying to do. Every submitted idea is compared against this database by meaning, not just keyword, surfacing past attempts that resemble the new idea — always framed as a **lead for a human reviewer to check**, never as a final verdict.

**Pipeline:**
1. **Raw signals in** — existing curated failure lists, news coverage of shutdowns, official company-registry dissolution filings, automated dead-website detection, and funding-database "closed" status flags.
2. **Entity resolution** — an LLM plus simple matching rules (domain name, founder name) confirms multiple signals refer to the same company.
3. **LLM tagging** — for each confirmed-dead company, extracts a cause of death and a clean, searchable summary of the original idea.
4. **Storage** — each entry stored to be searched by meaning, not exact wording, so a new idea can be matched without shared vocabulary.
5. **Matching engine** — compares a new idea's summary against the whole database and returns the closest matches, reusing the Verifier's retrieval technique.

## The Objector

After the system reaches a conclusion, a separate pass is run specifically instructed to look for reasons that conclusion might be wrong. This directly counters the documented tendency of AI models to be overly agreeable, especially about something a person is excited about. See [`06-accuracy-testing-methodology.md`](./06-accuracy-testing-methodology.md) for the full reasoning behind this and every other accuracy safeguard.

## How they connect

The Verifier produces the claim-by-claim report; the Graveyard Database produces the "this resembles something that already failed" panel; the Objector reviews both before anything is shown as final. Together, one report per idea.

## Team ownership

| Member | Owns |
|---|---|
| **Kushagra Agnihotri** | Claim extraction, live retrieval, matching engine (LLM/RAG engineering) |
| **Lakshit Tanwar** | Entity resolution, graveyard tagging pipeline, accuracy testing (ML/DL, data) |
| **Richeek Mishra** | Reviewer dashboard and idea-report interface (UI/UX) |
| **Aditya Pradhan** | Overall architecture, data ingestion scheduling, integration |
