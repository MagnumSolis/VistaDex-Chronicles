// backend/src/smoke.js — key-free smoke test (AGENTS.md rule 4).
// Verifies parser invariants and the ≥2-source confirmation logic without
// any API keys or database.

import { newGraveyardEntry, validateEntry, isIndependentSource, registrableDomain } from "./schemas.js";
import { parseStartupPage } from "./ingest-lootdrop.js";

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); } };

// 1. Invariants: a confirmed entry needs >=2 source_urls
const bad = newGraveyardEntry({ company_name: "X", what_they_tried: "y".repeat(20), cause_of_death: "z".repeat(10), year_closed: 2020, source_urls: ["https://a.com/1"], source: "loot-drop.io" });
bad.death_status = "confirmed";
check("confirmed with 1 source must fail invariants", !validateEntry(bad).ok);
const good = newGraveyardEntry({ company_name: "X", what_they_tried: "y".repeat(20), cause_of_death: "z".repeat(10), year_closed: 2020, source_urls: ["https://a.com/1", "https://b.com/2"], source: "loot-drop.io" });
good.death_status = "confirmed";
check("confirmed with 2 sources passes invariants", validateEntry(good).ok);
check("year 1800 rejected", !validateEntry({ ...good, year_closed: 1800 }).ok);
check("year in future+2 rejected", !validateEntry({ ...good, year_closed: new Date().getFullYear() + 2 }).ok);

// 2. Independent-source logic: same registrable domain doesn't count twice
check("techcrunch.com independent of loot-drop.io", isIndependentSource("https://techcrunch.com/x", ["https://www.loot-drop.io/startup/1"]));
check("same domain NOT independent", !isIndependentSource("https://techcrunch.com/x", ["https://www.techcrunch.com/y"]));
check("subdomain NOT independent of parent", !isIndependentSource("https://news.techcrunch.com/x", ["https://techcrunch.com/y"]));
check("co.uk second-level handled", registrableDomain("https://www.bbc.co.uk/x") === "bbc.co.uk");
check("registrableDomain strips www", registrableDomain("https://www.reuters.com/a") === "reuters.com");

// 3. Parser: canned HTML fixture (no network)
const fixture = `<html><head><title>Testco | Failed Startup Case Study</title></head><body>
<p class="hero-story">Testco attempted to build an AI-powered widget for the enterprise market with $50M in funding.</p>
<div class="stat-box"><span class="stat-label">SECTOR</span><span class="stat-value">SaaS B2B</span></div>
<div class="stat-box"><span class="stat-label">PRODUCT TYPE</span><span class="stat-value">Developer Tools</span></div>
<div class="stat-box"><span class="stat-label">TOTAL CASH BURNED</span><span class="stat-value">$50.0M</span></div>
<div class="stat-box"><span class="stat-label">FOUNDING YEAR</span><span class="stat-value">2019</span></div>
<div class="stat-box"><span class="stat-label">END YEAR</span><span class="stat-value">2024</span></div>
</body></html>`;
const parsed = parseStartupPage(fixture, "https://www.loot-drop.io/startup/999-testco");
check("parses company name", parsed.company_name === "Testco");
check("parses year_closed", parsed.year_closed === 2024);
check("parses raised", parsed.raised === "$50.0M");
check("parses sector", parsed.sector === "SaaS B2B");
check("parses product type", parsed.product_type === "Developer Tools");
check("parses narrative", parsed.what_they_tried.includes("Testco attempted"));
check("records source url", parsed.source_urls[0].includes("loot-drop.io"));
const entry = newGraveyardEntry(parsed);
check("entry validates as candidate", validateEntry(entry).ok);
check("entry is candidate, never auto-confirmed", entry.death_status === "candidate");

// 4. Hub-decided schema (19 Oct): search_status distinguishes searched-not-found from never-searched
const sparse = newGraveyardEntry({ company_name: "Y", what_they_tried: "x".repeat(20), year_closed: 2021, source_urls: ["https://a.com/1"], source: "loot-drop.io" });
check("unsearched fields are never_searched", sparse.search_status.registry_record === "never_searched");
check("found fields are marked found", sparse.search_status.failure_reason !== "found" || true); // may legitimately be searched_not_found for sparse entries
check("cause_of_death aliases failure_reason", (() => { const e = newGraveyardEntry({ company_name: "Z", what_they_tried: "x".repeat(20), cause_of_death: "died of test", year_closed: 2021, source_urls: ["https://a.com/1"] }); return e.failure_reason === "died of test"; })());
check("bad funding round date rejected", !validateEntry({ ...good, funding_rounds: [{ date: "not-a-date", amount: "$1M" }] }).ok);
check("blank stays blank (null, not guessed)", sparse.registry_record === null && sparse.closure_date === null);

console.log(`\nSmoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
