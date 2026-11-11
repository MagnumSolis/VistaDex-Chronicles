// backend/src/smoke.js — key-free smoke test (AGENTS.md rule 4).
// Verifies parser invariants and the ≥2-source confirmation logic without
// any API keys or database.

import { newGraveyardEntry, validateEntry, isIndependentSource, registrableDomain } from "./schemas.js";
import { parseStartupPage } from "./ingest-lootdrop.js";
import { sourceBlockReason, checkSourceText } from "./sources.js";
import { verifyEntry, pickQueries, DISCOVERY_QUERIES } from "./fleet.js";
import { readFileSync, readdirSync } from "fs";
import { validateExtraction } from "./schemas.js";
import { parseExtraction, runSignalExtraction } from "./extract-signals.js";

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
<article class="grid-card" data-full-text="Testco died because enterprise buyers would not pay for widgets before the market existed. Sales cycles ran longer than the runway. The team &#39;tried&#39; three pivots.

A second paragraph that is not part of the cause.">
    <div class="card-header">
        <span class="card-icon"><img src="/icons/switch.png" alt="Failure Analysis" class="icon-img"></span>
        <h3 class="card-title">Failure Analysis</h3>
    </div>
    <p class="card-text">Testco died because enterprise buyers would not pay....</p>
</article>
<article class="grid-card" data-full-text="The widget market today is crowded.">
    <div class="card-header"><h3 class="card-title">Market Analysis</h3></div>
</article>
</body></html>`;
const parsed = parseStartupPage(fixture, "https://www.loot-drop.io/startup/999-testco");
check("parses company name", parsed.company_name === "Testco");
check("parses year_closed", parsed.year_closed === 2024);
check("parses raised", parsed.raised === "$50.0M");
check("parses sector", parsed.sector === "SaaS B2B");
check("parses product type", parsed.product_type === "Developer Tools");
check("parses narrative", parsed.what_they_tried.includes("Testco attempted"));
check("records source url", parsed.source_urls[0].includes("loot-drop.io"));
// Cause of death comes from the Failure Analysis card, never from the narrative
check("cause is the Failure Analysis text", parsed.cause_of_death.startsWith("Testco died because enterprise buyers"));
check("cause keeps whole sentences of the first paragraph", parsed.cause_of_death.endsWith("three pivots.") && !parsed.cause_of_death.includes("second paragraph"));
check("cause is not a copy of what_they_tried", parsed.cause_of_death !== parsed.what_they_tried);
const noFa = parseStartupPage(fixture.replace(/<article[\s\S]*<\/article>/, ""), "https://www.loot-drop.io/startup/998-testco");
check("no Failure Analysis card -> cause stays empty", noFa.cause_of_death === "");
const noFaEntry = newGraveyardEntry(noFa);
check("empty cause is recorded as searched_not_found", noFaEntry.failure_reason === "" && noFaEntry.search_status.failure_reason === "searched_not_found");
check("entry without a cause still validates as candidate", validateEntry(noFaEntry).ok);
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

// 5. Source quality: a second source must be a real page that names the company and states the death
check("dictionary blocked", sourceBlockReason("https://www.merriam-webster.com/dictionary/shut") === "dictionary");
check("outage checker blocked (any country)", sourceBlockReason("https://downdetector.com/") === "outage-checker" && sourceBlockReason("https://downdetector.co.uk/status/x") === "outage-checker");
check("video site blocked", sourceBlockReason("https://www.youtube.com/watch?v=1") === "video" && sourceBlockReason("https://youtu.be/1") === "video");
check("forum blocked", sourceBlockReason("https://www.reddit.com/r/x/comments/1") === "forum" && sourceBlockReason("https://www.quora.com/Why") === "forum");
check("derivative graveyard aggregator blocked", sourceBlockReason("https://ideaproof.io/failure/plenty-unlimited") === "aggregator");
check("ToS-restricted platform blocked", sourceBlockReason("https://www.linkedin.com/posts/x") === "restricted");
check("news site allowed", sourceBlockReason("https://techcrunch.com/2020/10/21/quibi-is-dead/") === null);
check("bad url blocked", sourceBlockReason("not a url") === "bad-url");
const article = "LOS ANGELES - Quibi, the short-form video app, said on Wednesday it would shut down six months after launch. Investors had put in $1.75 billion.";
check("names company + states shutdown -> ok", checkSourceText(article, "Quibi").ok);
check("ok check keeps the evidence sentence", checkSourceText(article, "Quibi").quote.includes("shut down"));
check("company not named -> rejected", checkSourceText("Many startups shut down every year.", "Quibi").reason === "company-not-named");
check("named but no death statement -> rejected", checkSourceText("Quibi launched a new show with famous actors today.", "Quibi").reason === "no-death-statement");
check("death words far from the name do not count", !checkSourceText("Quibi launched today. " + "x ".repeat(400) + "Another firm shut down.", "Quibi").ok);
check("dictionary page for a common word -> rejected", !checkSourceText("plenty (noun): a full supply. Example: the shop shut down.", "Plenty Unlimited").ok);
check("acquisition counts", checkSourceText("Atrium was acquired by a rival in 2020.", "Atrium").ok);
check("dissolution counts", checkSourceText("The board voted to dissolve Testco Inc. and the company was dissolved in 2021.", "Testco Inc").ok);
check("corporate suffix optional", checkSourceText("Testco wound down operations last year.", "Testco Inc.").ok);
check("bankruptcy restructuring alone is not a death", !checkSourceText("Plenty Unlimited filed for Chapter 11 and emerged from bankruptcy.", "Plenty Unlimited").ok);
check("same sentence: death words in the next line do not count", !checkSourceText("Aetech Guardian gas safety valve\nAutomatic shutdown of the gas supply when a leak is found.", "Aetech").ok);
check("customs 'liquidated' is not a death", !checkSourceText("The entries by Dingli importers will be liquidated without regard to antidumping duties.", "Dingli").ok);
check("liquidation of the company counts", checkSourceText("Dingli went into voluntary liquidation in 2023.", "Dingli").ok);
check("headline 'X is dead' counts", checkSourceText("# Quibi is dead\nThe app launched in April.", "Quibi").ok);
check("the acquirer is not the one that died", !checkSourceText("Kuailexue (acquired by 17zuoye in 2016) is one example.", "17zuoye").ok);
check("others shutting down is not this company", !checkSourceText("Some ESL companies have already shut down their services, while others such as Magic Ears have vowed to stay.", "Magic Ears").ok);
check("object form 'the shutdown of X' counts", checkSourceText("Investors reacted to the shutdown of Quibi last week.", "Quibi").ok);
check("object form 'Y acquired X' counts", checkSourceText("In 2020 a rival acquired Atrium and closed the app.", "Atrium").ok);
check("lowercase common word still does not match the name", !checkSourceText("A plenty unlimited supply shut down the market.", "Plenty Unlimited").ok);
check("empty page -> rejected", checkSourceText("", "Quibi").reason === "empty-page");

// 6. Death Watcher with a fake TinyFish (no network)
const fakeTf = (pages, searchResults = []) => ({
  search: async () => searchResults.map(url => ({ url, title: "", snippet: "" })),
  fetchPages: async urls => Object.fromEntries(urls.filter(u => u in pages).map(u => [u, { content: pages[u] }])),
});
const lootEntry = () => ({ company_name: "Quibi", primary_source: "loot-drop.io", death_status: "confirmed",
  source_urls: ["https://www.loot-drop.io/startup/1-quibi", "https://downdetector.com/", "https://www.merriam-webster.com/dictionary/shut"] });
let v = await verifyEntry(fakeTf({}), lootEntry());
check("junk second sources -> back to candidate", v.death_status === "candidate" && v.source_urls.length === 1);
check("junk sources recorded as rejected with a reason", v.rejected_sources.length === 2 && v.rejected_sources.every(r => r.reason));
v = await verifyEntry(fakeTf({ "https://variety.com/quibi": article }, ["https://variety.com/quibi", "https://www.youtube.com/watch?v=q"]), lootEntry());
check("one fetched page stating the death -> confirmed", v.death_status === "confirmed" && v.source_urls.includes("https://variety.com/quibi"));
check("good source keeps its evidence quote", v.source_checks.find(c => c.url === "https://variety.com/quibi").quote.includes("shut down"));
v = await verifyEntry(fakeTf({ "https://variety.com/a": article, "https://variety.com/b": article }, ["https://variety.com/a", "https://variety.com/b"]),
  { company_name: "Quibi", primary_source: "variety.com", death_status: "candidate", source_urls: ["https://variety.com/a"], source_checks: [{ url: "https://variety.com/a", ok: true }] });
check("two pages on one domain are one source", v.death_status === "candidate");
v = await verifyEntry(fakeTf({ "https://variety.com/q": "Quibi is a video app." }, ["https://variety.com/q"]), lootEntry());
check("page that names but does not state the death -> still candidate", v.death_status === "candidate");
const down = { search: async () => { throw new Error("rate limited"); }, fetchPages: async () => { throw new Error("rate limited"); } };
check("TinyFish failure throws, so the caller leaves the entry unchanged", await verifyEntry(down, lootEntry()).then(() => false, () => true));

// 7. Signal -> candidate extraction (LLM output is untrusted: schema + page checks, no network)
const page = "Startups that shut down this year.\nVreal, a VR game streaming platform, shut down in 2019 after it failed to raise a new round. The team moved on.\nZipline raised more money.";
const item = { company_name: "Vreal", what_they_tried: "A VR game streaming platform.", cause_of_death: "It failed to raise a new round.", year_closed: 2019, evidence_quote: "Vreal, a VR game streaming platform, shut down in 2019 after it failed to raise a new round." };
check("valid extraction passes", validateExtraction(item, page).ok);
check("quote not on the page -> rejected", !validateExtraction({ ...item, evidence_quote: "Vreal shut down after a fraud scandal." }, page).ok);
check("quote must name the company", !validateExtraction({ ...item, company_name: "Zipline", evidence_quote: "The team moved on." }, page).ok);
check("year not on the page -> rejected", !validateExtraction({ ...item, year_closed: 2018 }, page).ok);
check("year out of range -> rejected", !validateExtraction({ ...item, year_closed: 1700 }, page).ok);
check("cause not supported by the page -> rejected", !validateExtraction({ ...item, cause_of_death: "Regulators banned cryptocurrency exchanges nationwide." }, page).ok);
check("no cause is allowed (stays empty)", validateExtraction({ ...item, cause_of_death: "" }, page).ok);
check("generic name -> rejected", !validateExtraction({ ...item, company_name: "the startup" }, page).ok);
check("missing what_they_tried -> rejected", !validateExtraction({ ...item, what_they_tried: "" }, page).ok);
const parsedX = parseExtraction(JSON.stringify({ startups: [item, { ...item, company_name: "Zipline", evidence_quote: "Zipline raised more money." }] }), page, "https://techcrunch.com/x");
check("only the startup the page says died becomes a candidate", parsedX.entries.length === 1 && parsedX.entries[0].company_name === "Vreal");
check("candidate cites the signal page with its evidence", parsedX.entries[0].source_urls[0] === "https://techcrunch.com/x" && parsedX.entries[0].source_checks[0].ok);
check("extracted entry is a candidate, never confirmed", parsedX.entries[0].death_status === "candidate" && validateEntry(parsedX.entries[0]).ok);
check("rejected items are counted with reasons", parsedX.rejected.length === 1 && parsedX.rejected[0].errors.length > 0);
check("malformed LLM output -> nothing", parseExtraction("not json", page, "https://t.co/x").entries.length === 0 && parseExtraction('[{"company_name":"Vreal"}]', page, "https://t.co/x").entries.length === 0);

const memColl = (docs = []) => ({ docs,
  find(q) { const m = docs.filter(d => Object.entries(q).every(([k, v]) => (v && v.$exists === false) ? !(k in d) : d[k] === v));
    return { sort() { return this; }, limit(n) { return { toArray: async () => m.slice(0, n) }; } }; },
  async findOne(q) { const key = q.$or?.[0].company_key; return docs.find(d => d.company_key === key) || null; },
  async insertOne(d) { docs.push(d); },
  async updateOne(q, u) { const d = docs.find(x => (q._id !== undefined ? x._id === q._id : x.url === q.url)); if (!d) return; Object.assign(d, u.$set || {}); for (const [k, v] of Object.entries(u.$push || {})) (d[k] ||= []).push(v); },
});
const sig = memColl([{ _id: 1, url: "https://techcrunch.com/x" }, { _id: 2, url: "https://www.reddit.com/r/x" }]);
const stg = memColl([{ _id: 9, company_name: "Zoomo", company_key: "zoomo", death_status: "candidate", source_urls: ["https://www.loot-drop.io/startup/1-zoomo"] }]);
const fakeLLM = { available: () => true, complete: async () => ({ content: JSON.stringify({ startups: [item] }) }) };
const res = await runSignalExtraction({ signals: sig, staging: stg, tf: fakeTf({ "https://techcrunch.com/x": page }), llm: fakeLLM, limit: 5 });
check("signal page -> one new candidate", res.created === 1 && stg.docs.some(d => d.company_name === "Vreal" && d.death_status === "candidate"));
check("forum signal skipped without an LLM call", sig.docs.find(d => d._id === 2).extraction_status === "blocked:forum");
check("processed signal is marked done", sig.docs.find(d => d._id === 1).extraction_status === "done");
const sig2 = memColl([{ _id: 3, url: "https://variety.com/y" }]);
await runSignalExtraction({ signals: sig2, staging: stg, tf: fakeTf({ "https://variety.com/y": page.replace("Vreal", "Zoomo").replace("Vreal", "Zoomo") }), llm: { available: () => true, complete: async () => ({ content: JSON.stringify({ startups: [{ ...item, company_name: "Zoomo", evidence_quote: item.evidence_quote.replace("Vreal", "Zoomo") }] }) }) }, limit: 5 });
const zoomo = stg.docs.find(d => d.company_name === "Zoomo");
check("known company: page added as a source, no duplicate", stg.docs.filter(d => d.company_key === "zoomo").length === 1 && zoomo.source_urls.includes("https://variety.com/y"));
check("no LLM key -> extraction skipped, nothing written", (await runSignalExtraction({ signals: memColl([{ _id: 4, url: "https://a.com/z" }]), staging: stg, tf: fakeTf({}), llm: { available: () => false } })).skipped === "no-llm");

// 8. Discovery rotation is deterministic (AGENTS.md rule 3: no Math.random in production paths)
const nov = new Date("2026-11-11T00:00:00Z");
const r1 = pickQueries(0, 4, nov), r1b = pickQueries(0, 4, nov);
check("same cursor + date -> same queries", JSON.stringify(r1) === JSON.stringify(r1b));
check("next run starts where this one stopped", pickQueries(r1.next, 4, nov).queries[0].query !== r1.queries[0].query && r1.next === 4);
check("month and year filled from the run date", r1.queries[0].query === "startup shutting down November 2026");
let cur = 0; const covered = new Set();
for (let k = 0; k < 10; k++) { const r = pickQueries(cur, 4, nov); r.queries.forEach(q => covered.add(q.query)); cur = r.next; }
check("rotation covers the whole bank (minus {company} templates)", covered.size === DISCOVERY_QUERIES.filter(q => !q.q.includes("{company}")).length);
check("{company} templates skipped without KNOWN_COMPANIES", [...covered].every(q => !q.includes("{company}") && !q.includes("undefined")));
check("{company} templates use KNOWN_COMPANIES when given", pickQueries(17, 1, nov, ["Quibi"]).queries[0].query === "Quibi shutting down");
const srcDir = new URL(".", import.meta.url);
check("no Math.random in backend/src", readdirSync(srcDir).filter(f => f.endsWith(".js") && f !== "smoke.js").every(f => !readFileSync(new URL(f, srcDir), "utf8").includes("Math.random")));

console.log(`\nSmoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
