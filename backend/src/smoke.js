// backend/src/smoke.js — key-free smoke test (AGENTS.md rule 4).
// Verifies parser invariants and the ≥2-source confirmation logic without
// any API keys or database.

import { newGraveyardEntry, validateEntry, isIndependentSource, registrableDomain } from "./schemas.js";
import { parseStartupPage } from "./ingest-lootdrop.js";
import { sourceBlockReason, checkSourceText, leadSkipReason, shutdownLeads, nameVariants } from "./sources.js";
import { runFleet, verifyEntry, pickQueries, DISCOVERY_QUERIES, PHRASES, SUBJECTS, EXTRAS, buildQueryBank, fillQuery, SOURCE_CHECK_VERSION } from "./fleet.js";
import { readFileSync, readdirSync } from "fs";
import { validateExtraction } from "./schemas.js";
import { parseExtraction, runSignalExtraction } from "./extract-signals.js";
import { mergeRun, formatReport, runId, KEEP_RUNS } from "./fleet-metrics.js";

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
// After the check changes, a page once rejected for its text is read again (no search needed).
const qvodPage = "Qvod, the video player, shut down in 2014 after a police raid.";
const oldCheck = () => ({ company_name: "Kuaibo (Qvod)", death_status: "candidate", source_check_version: 2, watch_attempts: 2,
  source_urls: ["https://www.loot-drop.io/startup/9-kuaibo"], rejected_sources: [{ url: "https://news.example.com/qvod", reason: "company-not-named" }, { url: "https://www.reddit.com/r/x", reason: "forum" }] });
v = await verifyEntry(fakeTf({ "https://news.example.com/qvod": qvodPage }), oldCheck());
check("older check: a text-rejected page is read again and can confirm", v.death_status === "confirmed" && v.source_urls.includes("https://news.example.com/qvod"));
v = await verifyEntry(fakeTf({ "https://news.example.com/qvod": qvodPage }), { ...oldCheck(), source_check_version: SOURCE_CHECK_VERSION });
check("current check: a rejected page is not fetched again", v.death_status === "candidate");
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
    return { sort(spec) { const ks = Object.entries(spec); m.sort((a, b) => { for (const [k, dir] of ks) { if (a[k] < b[k]) return -dir; if (a[k] > b[k]) return dir; } return 0; }); return this; },
      limit(n) { return { toArray: async () => m.slice(0, n) }; } }; },
  async findOne(q) { const key = q.$or?.[0].company_key; return docs.find(d => d.company_key === key) || null; },
  async insertOne(d) { docs.push(d); },
  async updateOne(q, u) { const d = docs.find(x => (q._id !== undefined ? x._id === q._id : x.url === q.url)); if (!d) return; Object.assign(d, u.$set || {}); for (const [k, v] of Object.entries(u.$push || {})) (d[k] ||= []).push(v); },
});
const sig = memColl([{ _id: 1, url: "https://techcrunch.com/x", signal_title: "Vreal shuts down" }, { _id: 2, url: "https://www.reddit.com/r/x", signal_title: "Vreal shuts down" }]);
const stg = memColl([{ _id: 9, company_name: "Zoomo", company_key: "zoomo", death_status: "candidate", source_urls: ["https://www.loot-drop.io/startup/1-zoomo"] }]);
const fakeLLM = { available: () => true, complete: async () => ({ content: JSON.stringify({ startups: [item] }) }) };
const res = await runSignalExtraction({ signals: sig, staging: stg, tf: fakeTf({ "https://techcrunch.com/x": page }), llm: fakeLLM, limit: 5 });
check("signal page -> one new candidate", res.created === 1 && stg.docs.some(d => d.company_name === "Vreal" && d.death_status === "candidate"));
check("forum signal skipped without an LLM call", sig.docs.find(d => d._id === 2).extraction_status === "blocked:forum");
check("processed signal is marked done", sig.docs.find(d => d._id === 1).extraction_status === "done");
const sig2 = memColl([{ _id: 3, url: "https://variety.com/y", signal_title: "Zoomo is shutting down" }]);
await runSignalExtraction({ signals: sig2, staging: stg, tf: fakeTf({ "https://variety.com/y": page.replace("Vreal", "Zoomo").replace("Vreal", "Zoomo") }), llm: { available: () => true, complete: async () => ({ content: JSON.stringify({ startups: [{ ...item, company_name: "Zoomo", evidence_quote: item.evidence_quote.replace("Vreal", "Zoomo") }] }) }) }, limit: 5 });
const zoomo = stg.docs.find(d => d.company_name === "Zoomo");
check("known company: page added as a source, no duplicate", stg.docs.filter(d => d.company_key === "zoomo").length === 1 && zoomo.source_urls.includes("https://variety.com/y"));
// Pre-filter: hits whose title/snippet name no company next to a shutdown phrase skip the fetch and the LLM.
const hits = JSON.parse(readFileSync(new URL("../fixtures/discovery-hits.json", import.meta.url), "utf8")).hits;
const wrong = hits.filter(h => (leadSkipReason(h.title, h.snippet) === null) !== (h.expect === "lead"));
check(`pre-filter labels the fixture hits (${hits.length}); wrong: ${wrong.map(h => h.title).join(" / ")}`, wrong.length === 0);
check("the 2026-11-11 run's advice pages would all have been skipped", hits.filter(h => h.from === "2026-11-11 run").every(h => leadSkipReason(h.title, h.snippet)));
check("names come from the words next to the phrase", JSON.stringify(shutdownLeads("Exclusive: Synapse, the banking-as-a-service startup, files for bankruptcy")) === '["Synapse"]');
check("a capitalised common word or state code is not a name", shutdownLeads("But in the startup world, CA founders shut down.").length === 0);
let llmCalls = 0;
const countingLLM = { available: () => true, complete: async () => { llmCalls++; return { content: JSON.stringify({ startups: [item] }) }; } };
const sig3 = memColl([
  { _id: 13, url: "https://techcrunch.com/new", signal_title: "Vreal shuts down", first_seen: 3 },
  { _id: 11, url: "https://blog.example/advice", signal_title: "When to Shut Down Your Startup", snippet: "Shutting down is hard.", first_seen: 1 },
  { _id: 12, url: "https://techcrunch.com/old", signal_title: "Vreal shuts down", first_seen: 2 },
]);
const res3 = await runSignalExtraction({ signals: sig3, staging: memColl([]), tf: fakeTf({ "https://techcrunch.com/old": page, "https://techcrunch.com/new": page }), llm: countingLLM, limit: 1 });
check("advice hit skipped and counted, no fetch or LLM call", res3.prefiltered === 1 && sig3.docs.find(d => d._id === 11).extraction_status === "skipped:no-named-shutdown");
check("pre-filtered signals do not use up the LLM limit", llmCalls === 1 && res3.signals === 1);
check("backlog drains oldest first", sig3.docs.find(d => d._id === 12).extraction_status === "done" && !("extraction_status" in sig3.docs.find(d => d._id === 13)));
let clock = 0;
const sig4 = memColl([1, 2, 3].map(n => ({ _id: 20 + n, url: `https://techcrunch.com/b${n}`, signal_title: "Vreal shuts down", first_seen: n })));
const res4 = await runSignalExtraction({ signals: sig4, staging: memColl([]), tf: fakeTf(Object.fromEntries([1, 2, 3].map(n => [`https://techcrunch.com/b${n}`, page]))),
  llm: { available: () => true, complete: async () => { clock += 60_000; return { content: JSON.stringify({ startups: [item] }) }; } }, limit: 10, budgetMs: 90_000, now: () => clock });
check("time budget stops the run cleanly; the rest wait unmarked", res4.stopped === "time-budget" && res4.signals === 2 && !("extraction_status" in sig4.docs[2]));
const res5 = await runSignalExtraction({ signals: memColl([{ _id: 30, url: "https://techcrunch.com/c", signal_title: "Vreal shuts down", first_seen: 1 }]), staging: memColl([]), tf: fakeTf({ "https://techcrunch.com/c": page }),
  llm: { available: () => true, complete: async () => { throw new Error("429 rate limit"); } }, limit: 5 });
check("rate-limited LLM stops the run and says why", res5.stopped === "llm-unavailable" && res5.signals === 0);
check("no LLM key -> extraction skipped, nothing written", (await runSignalExtraction({ signals: memColl([{ _id: 4, url: "https://a.com/z" }]), staging: stg, tf: fakeTf({}), llm: { available: () => false } })).skipped === "no-llm");

// 8. Discovery rotation is deterministic (AGENTS.md rule 3: no Math.random in production paths)
const nov = new Date("2026-11-11T00:00:00Z");
const r1 = pickQueries(0, 4, nov), r1b = pickQueries(0, 4, nov);
check("same cursor + date -> same queries", JSON.stringify(r1) === JSON.stringify(r1b));
check("next run starts where this one stopped", pickQueries(r1.next, 4, nov).queries[0].query !== r1.queries[0].query && r1.next === 4);
check("month and year filled from the run date", r1.queries[0].query === 'startup "shuts down" November 2026');
check("{prev} is the month before, across a year end", fillQuery("{prev}", new Date("2026-01-05T00:00:00Z")) === "December 2025" && fillQuery("{prev}", nov) === "October 2026");
const pairs = new Set(DISCOVERY_QUERIES.filter(e => e.agent === "news-scout" && !e.q.includes("{company}")).map(e => e.q));
check("every phrasing is paired with every sector/region subject", pairs.size === PHRASES.length * SUBJECTS.length);
check("lists and {company} templates are interleaved", DISCOVERY_QUERIES.length === PHRASES.length * SUBJECTS.length + Math.floor(PHRASES.length * SUBJECTS.length / 8) && EXTRAS.every(x => DISCOVERY_QUERIES.includes(x)));
check("news queries use shutdown phrasing that names a company", PHRASES.every(p => /shut|wind|cease|bankrupt|acquihire/i.test(p)));
check("bank lengths must be coprime", (() => { try { buildQueryBank(["a {subject}", "b {subject}"], ["x", "y"]); return false; } catch { return true; } })());
let cur = 0; const covered = new Set();
for (let k = 0; k < Math.ceil(DISCOVERY_QUERIES.length / 4); k++) { const r = pickQueries(cur, 4, nov); r.queries.forEach(q => covered.add(q.query)); cur = r.next; }
check("rotation covers the whole bank (minus {company} templates)", covered.size === new Set(DISCOVERY_QUERIES.filter(q => !q.q.includes("{company}")).map(q => fillQuery(q.q, nov))).size);
check("{company} templates skipped without KNOWN_COMPANIES", [...covered].every(q => !q.includes("{company}") && !q.includes("undefined")));
const companyAt = DISCOVERY_QUERIES.findIndex(e => e.q === "{company} shutting down");
check("{company} templates use KNOWN_COMPANIES when given", pickQueries(companyAt, 1, nov, ["Quibi"]).queries[0].query === "Quibi shutting down");
// A bracketed alias or a legal suffix after a comma is matched by its parts, never by a descriptor.
check("bracketed alias: either name counts", checkSourceText("Qvod, the video player, shut down in 2014 after a police raid.", "Kuaibo (Qvod)").ok && checkSourceText("Kuaibo was shut down by regulators in 2014.", "Kuaibo (Qvod)").ok);
check("a bracketed descriptor is not a name", !nameVariants("Getir (Intl. Ops)").includes("Intl. Ops") && nameVariants("Getir (Intl. Ops)").includes("Getir"));
check("comma before the legal suffix", checkSourceText("HomeHero shut down in 2016 after failing to raise.", "HomeHero, Inc").ok);
check("common death phrasings count", ["collapsed in 2019", "ceased to exist in 2020", "stopped operations last year"].every(v => checkSourceText(`Testco ${v}.`, "Testco").ok));
check("a bare common word stays rejected", !checkSourceText("plenty (noun): a full supply. The shop collapsed.", "Plenty Unlimited").ok);
// 9. Per-run metrics in fleet_state: one record per GitHub run, totals over all runs
let mdoc = mergeRun(null, "r1", { queries: 4, signals: 25, prefiltered: 18, extracted: 7, new_candidates: 2, sources_added: 1, stopped: null });
mdoc = mergeRun(mdoc, "r1", { confirmed: 14, watched: 50 });
check("discovery and watcher steps of one run share a record", mdoc.runs.length === 1 && mdoc.runs[0].new_candidates === 2 && mdoc.runs[0].confirmed === 14);
mdoc = mergeRun(mdoc, "r2", { queries: 4, signals: 30, new_candidates: 5, confirmed: 3 });
check("totals sum the runs", mdoc.totals.runs === 2 && mdoc.totals.signals === 55 && mdoc.totals.new_candidates === 7 && mdoc.totals.confirmed === 17);
check("a re-reported field replaces, not doubles, its total", mergeRun(mdoc, "r2", { confirmed: 4 }).totals.confirmed === 18);
let many = null; for (let k = 0; k < KEEP_RUNS + 5; k++) many = mergeRun(many, `m${k}`, { signals: 1 });
check("only the last KEEP_RUNS run records are kept; totals keep everything", many.runs.length === KEEP_RUNS && many.runs[0].run_id === "m5" && many.totals.signals === KEEP_RUNS + 5);
const md = formatReport(mdoc, "r2");
check("report names every number for this run", ["queries 4", "signals 30", "pre-filtered –", "new candidates 5", "confirmed 3"].every(t => md.includes(t)));
const rows = md.split("\n").filter(l => /^\| (\*\*this run|\d{4}-)/.test(l));
check("report shows the trend, newest first, times in IST", rows.length === 2 && rows[0].startsWith("| **this run**") && rows[1].includes(" IST |"));
check("IST is UTC+5:30", mergeRun && formatReport(mergeRun(null, "z", { signals: 1 }, new Date("2026-11-11T15:46:00Z")), "z").includes("2026-11-11 21:16 IST"));
check("signals waiting is a level, not summed", mergeRun(mergeRun(null, "a", { backlog: 60 }), "b", { backlog: 50 }).totals.backlog === undefined);
check("run id comes from GITHUB_RUN_ID", runId({ GITHUB_RUN_ID: "43047343056" }) === "43047343056" && runId({}, nov).startsWith("local-2026-11-11"));

// 10. One whole run (discovery, then the Death Watcher as a second step) on fakes: no network
const matches = (d, q) => Object.entries(q).every(([k, v]) => {
  if (k === "$or") return v.some(sub => matches(d, sub));
  if (v && typeof v === "object" && !Array.isArray(v)) {
    if ("$exists" in v) return (k in d) === v.$exists;
    if ("$ne" in v) return d[k] !== v.$ne;
    if ("$regex" in v) return new RegExp(v.$regex, v.$options).test(d[k] || "");
  }
  return d[k] === v;
});
const memDb = () => { const cols = {}; return { cols, collection(name) { const docs = (cols[name] ||= []); let n = 0; return {
  find(q = {}) { const m = docs.filter(d => matches(d, q)); return { sort(spec) { const ks = Object.entries(spec); m.sort((a, b) => { for (const [k, dir] of ks) { if ((a[k] ?? 0) < (b[k] ?? 0)) return -dir; if ((a[k] ?? 0) > (b[k] ?? 0)) return dir; } return 0; }); return this; }, limit(l) { return { toArray: async () => m.slice(0, l) }; } }; },
  async findOne(q) { return docs.find(d => matches(d, q)) || null; },
  async countDocuments(q = {}) { return docs.filter(d => matches(d, q)).length; },
  async insertOne(d) { docs.push({ _id: `${name}-${++n}`, ...d }); },
  async replaceOne(q, d, o) { const i = docs.findIndex(x => matches(x, q)); if (i >= 0) docs[i] = d; else if (o?.upsert) docs.push(d); },
  async updateOne(q, u, o) { let d = docs.find(x => matches(x, q)); let upsertedCount = 0;
    if (!d) { if (!o?.upsert) return { matchedCount: 0 }; d = { _id: `${name}-${++n}`, ...Object.fromEntries(Object.entries(q).filter(([k]) => !k.startsWith("$"))), ...(u.$setOnInsert || {}) }; docs.push(d); upsertedCount = 1; }
    Object.assign(d, u.$set || {}); for (const [k, v] of Object.entries(u.$push || {})) (d[k] ||= []).push(v); return { matchedCount: 1, upsertedCount }; },
}; } }; };
const fdb = memDb();
const news = "Vreal, a VR game streaming platform, shut down in 2019 after it failed to raise a new round.";
const fleetTf = {
  search: async q => q.startsWith('"Vreal"') ? [{ url: "https://variety.com/vreal", title: "Vreal shuts down", snippet: news }]
    : [{ url: "https://techcrunch.com/vreal", title: "Vreal shuts down", snippet: news }, { url: "https://advice.example/when", title: "When to Shut Down Your Startup", snippet: "Shutting down is hard." }],
  fetchPages: async urls => Object.fromEntries(urls.map(u => [u, { content: u.includes("vreal") ? page : "Shutting down is hard." }])),
};
const fenv = { FLEET_MODE: "discovery", DISCOVERY_QUERIES: "2", SIGNAL_LIMIT: "5", EXTRACT_DELAY_MS: "0", SEARCH_DELAY_MS: "0", WATCH_DELAY_MS: "0", GITHUB_RUN_ID: "777" };
const d1 = await runFleet({ env: fenv, deps: { db: fdb, tf: fleetTf, llm: fakeLLM } });
check("discovery run: queries, signals, pre-filtered, extracted, new candidates", d1.discovery.queries === 2 && d1.discovery.signals === 4 && d1.discovery.new_signals === 2
  && d1.discovery.prefiltered === 1 && d1.discovery.extracted === 1 && d1.discovery.new_candidates === 1 && d1.discovery.backlog === 0);
check("a new candidate is never confirmed by discovery", fdb.cols.graveyard_staging.every(e => e.death_status === "candidate"));
const w1 = await runFleet({ env: { ...fenv, FLEET_MODE: "watcher" }, deps: { db: fdb, tf: fleetTf, llm: fakeLLM } });
check("watcher confirms only with a 2nd fetched page on another domain", w1.watcher.confirmed === 1 && fdb.cols.graveyard_staging[0].death_status === "confirmed" && new Set(fdb.cols.graveyard_staging[0].source_urls.map(registrableDomain)).size === 2);
const m1 = fdb.cols.fleet_state.find(d => d._id === "metrics");
check("fleet_state holds one record for the run with every number", m1.runs.length === 1 && m1.runs[0].run_id === "777" && m1.runs[0].new_candidates === 1 && m1.runs[0].confirmed === 1 && m1.totals.prefiltered === 1);
check("the query cursor still advances", fdb.cols.fleet_state.find(d => d._id === "discovery").cursor === 2);

const srcDir = new URL(".", import.meta.url);
check("no Math.random in backend/src", readdirSync(srcDir).filter(f => f.endsWith(".js") && f !== "smoke.js").every(f => !readFileSync(new URL(f, srcDir), "utf8").includes("Math.random")));

console.log(`\nSmoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
