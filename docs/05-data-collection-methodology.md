# Data Collection & Scraping Methodology

The graveyard database is the actual asset, so how it's built matters more than any other part of this plan.

## Sources, in the order to build them

1. **Existing curated lists** — startup-failure post-mortem collections and similar public write-ups (e.g. CB Insights' Startup Failure Post-Mortems, Failory's Graveyard). Small (a few hundred entries) but already well-explained — the fastest way to have something real to demo.
2. **Automated dead-website detection** — checking whether a company's own site, live at one point, has gone offline or been abandoned. Fully automatable, no special access needed, legally uncomplicated.
3. **Public news coverage** — shutdown announcements and "what happened to X" articles from tech news outlets. Public content, safe to reference and link back to.
4. **Structured "closed" status from funding databases** — pulling entries already flagged as closed or inactive as a corroborating layer, via official APIs.
5. **Official company-registry filings** — legal dissolution records, where a government registry confirms a company was formally shut down. The most reliable signal available, but the slowest to process since filings aren't always in a clean, structured format.

## What to deliberately avoid

**Scraping LinkedIn or similar platforms for signals like mass employee departures is not recommended.** It sits against those platforms' terms of service and carries real legal risk for comparatively little benefit at this stage — the five sources above are sufficient to start.

## Entity resolution, in plain terms

A shutdown article, a dead website, and a "closed" flag on a funding database might all describe the same company under slightly different names. An LLM is genuinely good at this specific judgment — shown two records, it can usually tell whether they refer to the same company — backed up by simple checks like matching domain names or founder names as supporting evidence.
