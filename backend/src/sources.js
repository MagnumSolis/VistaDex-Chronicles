// backend/src/sources.js: what counts as a source for a startup death.
// A source is a fetched page that names the company AND states that it shut down,
// was acquired or was dissolved, near that name. Some kinds of page never count,
// whatever they say: dictionaries, outage checkers, video sites, forums, social
// platforms and graveyard aggregators that republish the same summaries (not
// independent of the listing we already have).

import { registrableDomain } from "./schemas.js";
import { BLOCKED_DOMAINS } from "./tinyfish.js";

export const NON_EVIDENCE_DOMAINS = {
  restricted: BLOCKED_DOMAINS.concat(["instagram.com", "threads.net"]),
  dictionary: ["merriam-webster.com", "dictionary.com", "thesaurus.com", "cambridge.org", "collinsdictionary.com",
    "thefreedictionary.com", "wiktionary.org", "vocabulary.com", "urbandictionary.com", "oxfordlearnersdictionaries.com",
    "macmillandictionary.com", "yourdictionary.com", "wordreference.com"],
  "outage-checker": ["downdetector.*", "isitdownrightnow.com", "downforeveryoneorjustme.com", "istheservicedown.com",
    "statusgator.com", "outage.report", "updownradar.com", "isdown.app", "downforeveryone.com"],
  video: ["youtube.com", "youtu.be", "vimeo.com", "tiktok.com", "dailymotion.com", "twitch.tv", "spotify.com",
    "soundcloud.com"],
  "app-store": ["apple.com", "google.com"],
  forum: ["reddit.com", "quora.com", "ycombinator.com", "stackexchange.com", "stackoverflow.com", "discord.com",
    "tumblr.com", "pinterest.com"],
  aggregator: ["loot-drop.io", "ideaproof.io", "beforeyoubuild.fyi", "faildex.com", "buildorskip.com", "startup.bid",
    "lemstudio.co", "mentionfox.com", "gtmright.com"],
};

// null when the URL may be checked, otherwise the kind of page it is.
export function sourceBlockReason(url) {
  const d = registrableDomain(url);
  if (!d) return "bad-url";
  for (const [reason, list] of Object.entries(NON_EVIDENCE_DOMAINS)) {
    if (list.some(p => (p.endsWith(".*") ? d.startsWith(p.slice(0, -1)) : d === p))) return reason;
  }
  return null;
}

// Statements of a death, said of the company: the name comes first ("Quibi shut down",
// "Gobee.bike announced it was closing down") within SUBJECT_GAP characters, or the
// company is the object ("the shutdown of Quibi", "Google acquired Quibi").
// Bankruptcy alone is not a death (Chapter 11 is a restructuring), and neither is
// "liquidated" on its own (customs entries are liquidated too).
const DEATH = [
  "shut(?:s|ting)? (?:it(?:self)? )?down", "shut (?:its|their) doors", "shuttered",
  "(?:announc|confirm)(?:ed|es|ing) (?:its|the|a) shutdown", "clos(?:ed|es|ing) (?:its|their) doors", "clos(?:ed|es|ing) down",
  "ceas(?:ed|es|ing) (?:all )?(?:operations|trading)", "w(?:ound|ind|inds|inding) down", "dissolved", "dissolution",
  "(?:went|go|goes|going|gone|placed|entered|enter|entering) into (?:voluntary |compulsory )?liquidation",
  "liquidation proceedings", "chapter 7", "went (?:out of business|bankrupt|under|bust)", "out of business",
  "defunct", "acquired by", "acqui-?hired?", "folded", "(?:is|was) dead",
  "sunset(?:ted|ting)? (?:its|the) (?:product|app|service|platform)",
].join("|");
const DEATH_OF = "(?:shutdown|closure|liquidation|dissolution|demise|acquisition|acqui-?hire) of (?:the )?(?:[\\p{L}\\p{N}-]+ ){0,4}?";
const ACQUIRED = "(?:acquired|acquires|acquiring|bought|buys) ";
const SUBJECT_GAP = 120;

const SUFFIX = /[\s,]+(?:inc\.?|llc|l\.l\.c\.|ltd\.?|limited|corp\.?|corporation|co\.?|gmbh|s\.a\.|pvt\.? ltd\.?|plc)$/i;
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function nameVariants(name) {
  const n = String(name || "").trim();
  const out = new Set([n]);
  const bare = n.replace(SUFFIX, "").trim();
  if (bare.length >= 2) out.add(bare);
  const noTld = bare.replace(/\.(?:com|io|ai|co|app|net|org)$/i, "");
  if (noTld.length >= 2) out.add(noTld);
  return [...out].filter(Boolean);
}

// { ok, reason, quote } for one page's text: some sentence must name the company and
// state its death. Names are matched case-sensitively, so a dictionary entry for
// "plenty" never stands in for "Plenty Unlimited".
export function checkSourceText(text, companyName) {
  const t = String(text || "");
  if (t.trim().length < 20) return { ok: false, reason: "empty-page" };
  const n = `(?<![\\p{L}\\p{N}])(?:${nameVariants(companyName).map(escape).join("|")})(?![\\p{L}\\p{N}])`;
  const name = new RegExp(n, "u");
  const said = new RegExp(`${n}[^]{0,${SUBJECT_GAP}}?\\b(?:${DEATH})\\b|\\b(?:${DEATH_OF}|${ACQUIRED})${n}`, "iu");
  const sentences = t.split(/\n+|(?<=[.!?])\s+(?=["'“(]?[\p{Lu}\p{N}])/u).map(x => x.replace(/[#*_>|`]+/g, " ").replace(/\s+/g, " ").trim());
  const named = sentences.filter(x => name.test(x));
  if (!named.length) return { ok: false, reason: "company-not-named" };
  // The name itself must match case-sensitively; `said` is case-insensitive only for the verbs.
  const hit = named.find(x => x.length <= 600 && said.test(x) && name.test(x.match(said)[0]));
  return hit ? { ok: true, reason: "states-death", quote: hit.slice(0, 300) } : { ok: false, reason: "no-death-statement" };
}

// Fetch pages (TinyFish Fetch, free, ≤10 per call) and check each. Throws when
// TinyFish itself fails, so the caller can leave the entry untouched.
export async function checkSources(tf, urls, companyName) {
  const out = [];
  for (let i = 0; i < urls.length; i += 10) {
    const batch = urls.slice(i, i + 10);
    const pages = await tf.fetchPages(batch);
    for (const url of batch) {
      const p = pages[url];
      if (!p || p.error || !p.content) { out.push({ url, ok: false, reason: "fetch-failed" }); continue; }
      out.push({ url, ...checkSourceText(p.content, companyName) });
    }
  }
  return out.map(c => ({ ...c, checked_at: new Date() }));
}

// ── Discovery pre-filter (cheap, before any fetch or LLM call) ─────────────
// A search hit is worth extracting only if its title or snippet puts a proper noun
// next to a shutdown phrase ("Bench shuts down", "the shutdown of Quibi"). Advice and
// statistics pages ("When to shut down your startup", "Startup shutdowns rose 25%")
// name no company and are skipped. This only routes LLM calls: it is never evidence,
// and the Death Watcher still needs 2 fetched pages that state the death.
const LEAD = `${DEATH}|acqui-?hires|files? for bankruptcy|filed for bankruptcy|filing for bankruptcy|lays? off (?:all|its entire|entire)|laid off (?:all|its entire)|pulls? the plug|(?:goes|went|entered|enters|placed) into administration|announc(?:es|ed) (?:its )?shutdown|to close|closes|closing`;
const LEAD_RE = new RegExp(`\\b(?:${LEAD})\\b`, "giu");
const LEAD_OF = /\b(?:shutdown|closure|demise|collapse|liquidation|dissolution|acquisition|acqui-?hire)s? of\b/giu;
const BREAK = /[.!?](?:\s|$)|\s[|–—-]\s|[:;\n]/gu;
const TOKEN = /(?<![\p{L}\p{N}])(?:\p{Lu}|\p{N}+\p{L}{2}|\p{Ll}+\p{Lu})[\p{L}\p{N}&'’.]*(?<!\.)/gu;
const NOT_NAMES = new Set(`a an the this that these those it its their our your my we you i he she they here there if as so
why when how what who which where should can could would will must may might do does did is are was were be been has have had
not no to of in on for and or with by from at after before into over amid despite just also again now then
more most many some every all another other few top best worst big real reason reasons signs ways steps things lessons guide
startup startups company companies founder founders ceo cto firm firms business businesses team teams brand brands app apps
tech fintech edtech healthtech proptech insurtech climate ai saas crypto web3 ev d2c b2b b2c vc vcs venture capital backed funded unicorn unicorns
report reports data study survey analysis list record number rate rates share percent
time year years month months week weeks day days today yesterday new update breaking exclusive news opinion watch video live podcast
january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday
india indian europe european uk us usa u.s. america american germany german berlin london british israel israeli africa african
australia australian asia asian southeast latin china chinese global local world y combinator yc silicon valley
officially abruptly suddenly quietly finally reportedly formally soon shut shuts shutting shutdown shutdowns down winds wind
ceases closes closing close files bankruptcy acquired acquihired inc ltd llc corp
but yet still never nearly roughly eventually sadly sometimes even only once take make let ask hn hated anything than
one two three four five six seven eight nine ten first last next service services united states government federal congress
mental health post mortem postmortem failure failures failed fail dead death`.split(/\s+/));
// A capitalised common word, a contraction ("We're") or a two-letter code ("CA") is not a name.
const isName = t => !NOT_NAMES.has(t.toLowerCase().replace(/['’]s$/, "")) && !/-based$/i.test(t)
  && !/['’](?:re|m|ve|ll|d|t)$/i.test(t) && !/^\p{Lu}{1,2}$/u.test(t);

// Proper nouns found next to a shutdown phrase in a search hit's title/snippet ([] when none).
export function shutdownLeads(text) {
  const t = String(text || "").replace(/\s+/g, " ");
  const names = new Set();
  const segment = (from, to) => t.slice(from, to);
  const lastBreak = end => { let b = 0; for (const m of t.slice(0, end).matchAll(BREAK)) b = m.index + m[0].length; return b; };
  for (const m of t.matchAll(LEAD_RE)) {
    const start = Math.max(lastBreak(m.index), m.index - 80);
    for (const tok of segment(start, m.index).match(TOKEN) || []) if (isName(tok)) names.add(tok);
  }
  for (const m of t.matchAll(LEAD_OF)) {
    const after = segment(m.index + m[0].length, m.index + m[0].length + 60).split(BREAK)[0];
    for (const tok of after.match(TOKEN) || []) if (isName(tok)) names.add(tok);
  }
  return [...names];
}

// Round-ups of shutdowns name many companies in the body, none in the title:
// "All the startups that shut down in 2026", "10 companies that folded this year".
const SHUT = "(?:shut down|shuttered|closed|folded|died|collapsed|went bust|went under|wound down)";
const LIST_RE = new RegExp(`\\b(?:list|all the|every)\\b[^.?!]{0,50}\\b(?:startups|companies|apps)\\b(?: that| which| to have)? ${SHUT}\\b`
  + `|\\b\\d+ (?:[\\p{L}-]+ ){0,2}(?:startups|companies|apps) (?:that|which) ${SHUT}\\b`
  + `|\\b(?:startups|companies|apps) (?:that|which) ${SHUT}\\b[^.?!]{0,40}\\b(?:list|in \\d{4}|this year|this month)\\b`
  + `|\\b(?:closed|defunct|dead|shuttered) (?:companies|startups)\\b|\\bcompanies (?:disestablished|dissolved) in \\d{4}\\b|\\bfailed startups of \\d{4}\\b`, "iu");
export const isShutdownList = text => LIST_RE.test(String(text || "").replace(/\s+/g, " "));

// null when a search hit is worth an extraction call, otherwise why it is skipped.
export function leadSkipReason(title, snippet) {
  const text = `${title || ""}. ${snippet || ""}`;
  return shutdownLeads(text).length || isShutdownList(text) ? null : "no-named-shutdown";
}
