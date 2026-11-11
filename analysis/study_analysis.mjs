#!/usr/bin/env node
// analysis/study_analysis.mjs: the study's numbers for the paper, from a research export.
//
//   node analysis/study_analysis.mjs <events.json|events.csv> [--include-test] [--out <dir outside the repo>]
//
// Input: the console's Export ("events.json" or "events.csv", i.e. GET /export?table=events). Participant data
// is read from the path you give and never written inside this repository; --out refuses a folder in it.
// Output: a Markdown report on stdout; with --out also paired.csv, runs.csv and summary.json.
//
// The joins and the Wilcoxon test are the Research Console's own (worker/src/research-join.js), so the
// console and this report give the same numbers. Codes starting with "TEST" are left out unless
// --include-test. H1 to H4 as in README.md and docs/STUDY-NOTES.md.
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pairedParticipants, wilcoxon, joinRuns } from "../worker/src/research-join.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── input ──
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.length > 1 || r[0] !== "");
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

/** Events from an export (JSON array or CSV), payloads parsed, ordered by session and seq. */
export function parseExport(text) {
  const t = text.trimStart();
  const rows = t.startsWith("[") ? JSON.parse(t) : parseCSV(t);
  return rows.map(r => ({
    session_id: r.session_id, seq: Number(r.seq), ts: r.ts, type: r.type, study_version: r.study_version || null,
    payload: typeof r.payload === "string" ? (r.payload ? JSON.parse(r.payload) : {}) : (r.payload || {}),
  })).sort((a, b) => (a.session_id < b.session_id ? -1 : a.session_id > b.session_id ? 1 : a.seq - b.seq));
}

// ── statistics ──
const median = xs => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = xs => (xs.length ? Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10 : null);
function phi(z) {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Mann-Whitney U (two independent groups): U of group a, two-sided p by the normal approximation with
 *  tie and continuity corrections. Report it with the group sizes; with very small groups p is rough. */
export function mannWhitney(a, b) {
  const n1 = a.length, n2 = b.length;
  if (!n1 || !n2) return { n1, n2, u: null, p: null, medianA: median(a), medianB: median(b) };
  const all = [...a.map(v => ({ v, g: 0 })), ...b.map(v => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
  let i = 0, ties = 0;
  while (i < all.length) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].v === all[i].v) j++;
    const t = j - i + 1;
    if (t > 1) ties += t ** 3 - t;
    for (let k = i; k <= j; k++) all[k].rank = (i + j + 2) / 2;
    i = j + 1;
  }
  const r1 = all.filter(x => x.g === 0).reduce((s, x) => s + x.rank, 0);
  const u = r1 - (n1 * (n1 + 1)) / 2, n = n1 + n2;
  const sd = Math.sqrt((n1 * n2 / 12) * (n + 1 - ties / (n * (n - 1))));
  const z = sd ? Math.max(0, Math.abs(u - (n1 * n2) / 2) - 0.5) / sd : 0;
  return { n1, n2, u, p: sd ? Math.min(1, 2 * (1 - phi(z))) : 1, medianA: median(a), medianB: median(b) };
}

// ── analysis ──
const SRC_ORD = { "0": 0, "1-2": 1, "3+": 2 };
const MEASURES = [
  ["confidence_change", "Confidence change (after minus before)", c => c.delta],
  ["confidence_after", "Confidence after", c => c.post],
  ["trust", "Trust in the assessment (1 to 7)", c => c.trust],
  ["usefulness", "Useful for judging the idea (1 to 7)", c => c.usefulness],
  ["helpfulness", "Helped see what to verify (1 to 7)", c => c.helpfulness],
  ["effort", "Effort (1 to 7)", c => c.effort],
  ["sources_checked", "Sources checked, self-report (0 / 1-2 / 3+ as 0 / 1 / 2)", c => (c.sourcesChecked == null ? null : SRC_ORD[c.sourcesChecked])],
];

function pairedTest(pairs, f) {
  const both = pairs.filter(p => f(p.baseline) != null && f(p.vistadex) != null);
  const chatbot = both.map(p => f(p.baseline)), vistadex = both.map(p => f(p.vistadex));
  const diffs = both.map(p => f(p.vistadex) - f(p.baseline));
  return { n: both.length, chatbotMean: mean(chatbot), vistadexMean: mean(vistadex), diffs, test: wilcoxon(diffs) };
}

// Latest vote per item: (session, run, claim | objection, index), by seq.
function latestVotes(ev) {
  const latest = new Map();
  for (const e of ev) {
    if (e.type !== "claim_vote" && e.type !== "objection_vote") continue;
    const q = e.payload;
    latest.set([e.session_id, q.run_id, e.type, e.type === "claim_vote" ? q.claim_index : q.objection_index].join("\u0000"), e);
  }
  return [...latest.values()];
}
function tally(votes) {
  const t = { votes: votes.length, agree: 0, disagree: 0, notSure: 0, agreePct: null };
  for (const v of votes) {
    if (v.payload.vote === "agree") t.agree++;
    else if (v.payload.vote === "disagree") t.disagree++;
    else if (v.payload.vote === "not_sure") t.notSure++;
  }
  t.agreePct = t.votes ? Math.round((100 * t.agree) / t.votes) : null;
  return t;
}
const groupBy = (xs, key) => xs.reduce((m, x) => ((m[key(x)] ||= []).push(x), m), {});

/** Everything the report needs, from parsed events. */
export function analyze(events, { includeTest = false } = {}) {
  const testSids = new Set(events.filter(e => e.type === "participant_registered" && /^TEST/i.test(String(e.payload.code || "").trim())).map(e => e.session_id));
  const ev = includeTest ? events : events.filter(e => !testSids.has(e.session_id));
  const sessions = groupBy(ev, e => e.session_id);
  const versions = {};
  for (const list of Object.values(sessions)) { const v = list[0].study_version || "unknown"; versions[v] = (versions[v] || 0) + 1; }

  const pairs = pairedParticipants(ev).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const complete = pairs.filter(p => p.complete);
  const studySids = new Set(pairs.flatMap(p => p.sessions));
  const count = f => pairs.filter(f).length;
  const ideas = {};
  for (const p of pairs) ideas[p.idea || "unknown"] = (ideas[p.idea || "unknown"] || 0) + 1;

  const summary = {
    sessions: Object.keys(sessions).length, studyVersions: versions,
    studyParticipants: pairs.length, completePairs: complete.length,
    excludedTestCodes: includeTest ? 0 : new Set(events.filter(e => testSids.has(e.session_id) && e.type === "participant_registered").map(e => String(e.payload.code).trim().toUpperCase())).size,
    order: { "baseline-first": count(p => p.order === "baseline-first"), "vistadex-first": count(p => p.order === "vistadex-first"), unknown: count(p => !p.order) },
    orderFromCode: count(p => p.orderInferred), ideas,
    fieldSessionsWithRuns: Object.entries(sessions).filter(([sid, list]) => !studySids.has(sid) && list.some(e => e.type === "run_started")).length,
  };

  // H1: confidence change within each condition, and VistaDex minus chatbot.
  const within = c => {
    const ps = complete.filter(p => p[c].delta != null);
    const deltas = ps.map(p => p[c].delta);
    return { n: ps.length, deltas, meanDelta: mean(deltas), test: wilcoxon(deltas) };
  };
  const h1 = { chatbot: within("baseline"), vistadex: within("vistadex"), paired: pairedTest(complete, c => c.delta) };
  const measures = MEASURES.map(([id, label, f]) => ({ id, label, ...pairedTest(pairs, f) }));

  // Order effect: is the paired difference in confidence change different by order?
  const diffBy = o => complete.filter(p => p.order === o).map(p => p.vistadex.delta - p.baseline.delta);
  const orderEffect = mannWhitney(diffBy("baseline-first"), diffBy("vistadex-first"));

  // H2: verification, paired self-report and VistaDex links opened.
  const opened = pairs.map(p => p.vistadex.clicks).filter(c => c != null);
  const h2 = { selfReport: measures.find(m => m.id === "sources_checked"), linksOpened: { n: opened.length, none: opened.filter(c => c === 0).length, median: median(opened), mean: mean(opened) } };

  // H3: agreement with the report's verdicts, by claim status and objection severity (latest vote per item).
  const votes = latestVotes(ev);
  const claims = votes.filter(v => v.type === "claim_vote"), objections = votes.filter(v => v.type === "objection_vote");
  const by = (xs, k) => Object.fromEntries(Object.entries(groupBy(xs, v => v.payload[k] || "unknown")).map(([s, vs]) => [s, tally(vs)]));
  const h3 = {
    byClaimStatus: by(claims, "status"), byObjectionSeverity: by(objections, "severity"),
    studyOnly: by(claims.filter(v => studySids.has(v.session_id)), "status"),
  };

  // H4: runs where the participant opened sources vs runs where they did not, and change across runs.
  const runs = joinRuns(ev).filter(r => r.pre != null && r.post != null);
  const delta = r => r.post - r.pre;
  const clickers = runs.filter(r => r.clicks > 0), nonClickers = runs.filter(r => r.clicks === 0);
  const runIndex = {};
  for (const [, list] of Object.entries(groupBy(runs, r => r.sid))) {
    list.sort((a, b) => a.seq - b.seq).forEach((r, i) => (runIndex[i + 1] ||= []).push(r));
  }
  const h4 = {
    clickers: { n: clickers.length, meanDelta: mean(clickers.map(delta)), meanAbsDelta: mean(clickers.map(r => Math.abs(delta(r)))) },
    nonClickers: { n: nonClickers.length, meanDelta: mean(nonClickers.map(delta)), meanAbsDelta: mean(nonClickers.map(r => Math.abs(delta(r)))) },
    test: mannWhitney(clickers.map(delta), nonClickers.map(delta)),
    byRunIndex: Object.keys(runIndex).map(Number).sort((a, b) => a - b).map(k => ({ run: k, runs: runIndex[k].length, meanDelta: mean(runIndex[k].map(delta)), meanAbsDelta: mean(runIndex[k].map(r => Math.abs(delta(r)))) })),
  };

  // Comprehension check: what participants think "unverified" means (latest answer per run).
  const comp = new Map();
  for (const e of ev) if (e.type === "comprehension_check") comp.set(`${e.session_id}\u0000${e.payload.run_id}`, e.payload.answer);
  const comprehension = {};
  for (const a of comp.values()) comprehension[a] = (comprehension[a] || 0) + 1;

  return { summary, pairs, h1, measures, orderEffect, h2, h3, h4, comprehension, runs };
}

// ── report ──
const fmt = v => (v == null ? "n/a" : String(v));
const fmtP = t => (t.p == null ? "n/a" : (t.p < 0.001 ? "< 0.001" : t.p.toFixed(3)) + (t.method ? ` (${t.method})` : ""));

/** Markdown report. Plain numbers, no verdict words: the reader interprets. */
export function renderReport(r) {
  const s = r.summary, L = [];
  L.push("# VistaDex study analysis", "");
  L.push(`Sessions: ${s.sessions}. Study participants: ${s.studyParticipants} (complete pairs: ${s.completePairs}). Field-track sessions with a run: ${s.fieldSessionsWithRuns}.`);
  L.push(`Order: chatbot first ${s.order["baseline-first"]}, VistaDex first ${s.order["vistadex-first"]}, unknown ${s.order.unknown} (${s.orderFromCode} taken from the code number). Ideas: ${Object.entries(s.ideas).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}.`);
  L.push(`Study versions (sessions): ${Object.entries(s.studyVersions).map(([k, n]) => `${k} ${n}`).join(", ")}. TEST codes left out: ${s.excludedTestCodes}.`, "");

  L.push("## H1: confidence before and after", "");
  L.push("| Condition | Pairs | Mean change | Wilcoxon (change vs 0) |", "|---|---|---|---|");
  L.push(`| AI chatbot | ${r.h1.chatbot.n} | ${fmt(r.h1.chatbot.meanDelta)} | p ${fmtP(r.h1.chatbot.test)} |`);
  L.push(`| VistaDex | ${r.h1.vistadex.n} | ${fmt(r.h1.vistadex.meanDelta)} | p ${fmtP(r.h1.vistadex.test)} |`, "");
  L.push("## Paired comparison (VistaDex minus AI chatbot, per participant)", "");
  L.push("| Measure | Pairs | Chatbot mean | VistaDex mean | Median difference | W+ / W- | p |", "|---|---|---|---|---|---|---|");
  for (const m of r.measures) L.push(`| ${m.label} | ${m.n} | ${fmt(m.chatbotMean)} | ${fmt(m.vistadexMean)} | ${fmt(m.test.median)} | ${m.test.n ? `${m.test.wPlus} / ${m.test.wMinus}` : "n/a"} | ${fmtP(m.test)} |`);
  L.push("", `Order effect on the confidence-change difference (Mann-Whitney, chatbot first vs VistaDex first): groups ${r.orderEffect.n1} and ${r.orderEffect.n2}, medians ${fmt(r.orderEffect.medianA)} and ${fmt(r.orderEffect.medianB)}, p ${fmtP(r.orderEffect)}.`, "");

  L.push("## H2: verification", "");
  L.push(`Self-report "sources checked", paired: see the table above (${r.h2.selfReport.n} pairs). VistaDex evidence links opened: ${r.h2.linksOpened.n} participants, ${r.h2.linksOpened.none} opened none, median ${fmt(r.h2.linksOpened.median)}, mean ${fmt(r.h2.linksOpened.mean)}.`, "");

  L.push("## H3: agreement with the report (latest vote per item)", "");
  L.push("| Claim status | Votes | Agree | Disagree | Not sure | Agree % |", "|---|---|---|---|---|---|");
  for (const [k, t] of Object.entries(r.h3.byClaimStatus)) L.push(`| ${k} | ${t.votes} | ${t.agree} | ${t.disagree} | ${t.notSure} | ${fmt(t.agreePct)} |`);
  L.push("", "| Objection severity | Votes | Agree | Disagree | Not sure | Agree % |", "|---|---|---|---|---|---|");
  for (const [k, t] of Object.entries(r.h3.byObjectionSeverity)) L.push(`| ${k} | ${t.votes} | ${t.agree} | ${t.disagree} | ${t.notSure} | ${fmt(t.agreePct)} |`);
  L.push("");

  L.push("## H4: opening sources and change across runs (all VistaDex runs with confidence before and after)", "");
  L.push(`Runs with at least one source opened: ${r.h4.clickers.n} (mean change ${fmt(r.h4.clickers.meanDelta)}, mean absolute change ${fmt(r.h4.clickers.meanAbsDelta)}). Runs without: ${r.h4.nonClickers.n} (mean change ${fmt(r.h4.nonClickers.meanDelta)}, mean absolute change ${fmt(r.h4.nonClickers.meanAbsDelta)}). Mann-Whitney on change: p ${fmtP(r.h4.test)}.`, "");
  L.push("| Run in session | Runs | Mean change | Mean absolute change |", "|---|---|---|---|");
  for (const x of r.h4.byRunIndex) L.push(`| ${x.run} | ${x.runs} | ${fmt(x.meanDelta)} | ${fmt(x.meanAbsDelta)} |`);
  L.push("", "Note: this is confidence change, not calibration. Calibration needs a ground truth for each idea (for example how its claims were later resolved), which these events do not hold.", "");

  L.push("## Comprehension check (what an \"unverified\" claim means)", "");
  L.push(Object.entries(r.comprehension).map(([k, n]) => `${k}: ${n}`).join(", ") || "No answers.", "");
  return L.join("\n");
}

const csvCell = v => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function pairedCSV(pairs) {
  const per = ["runId", "pre", "preMoved", "post", "delta", "trust", "usefulness", "helpfulness", "effort", "sourcesChecked", "openText"];
  const head = ["code", "sessions", "idea", "order", "order_inferred", "complete", ...["chatbot", "vistadex"].flatMap(c => per.map(k => `${c}_${k}`)), "vistadex_links_opened", "vistadex_items_voted", "vistadex_agree_pct"];
  return [head.join(","), ...pairs.map(p => [p.code, p.sessions.join(";"), p.idea, p.order, p.orderInferred, p.complete,
    ...[p.baseline, p.vistadex].flatMap(c => per.map(k => c[k])), p.vistadex.clicks, p.vistadex.votes, p.vistadex.agreePct].map(csvCell).join(","))].join("\n");
}
function runsCSV(runs) {
  const head = ["session_id", "run_id", "label", "pre", "pre_moved", "post", "delta", "clicks", "dwell_ms", "votes", "agrees", "comprehension"];
  return [head.join(","), ...runs.map(r => [r.sid, r.runId, r.label, r.pre, r.preMoved, r.post, r.post - r.pre, r.clicks, r.dwell, r.votes, r.agrees, r.comp].map(csvCell).join(","))].join("\n");
}

// ── CLI ──
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--out");
  if (!input) {
    console.error("usage: node analysis/study_analysis.mjs <events.json|events.csv> [--include-test] [--out <dir>]");
    process.exit(2);
  }
  const result = analyze(parseExport(readFileSync(input, "utf8")), { includeTest: args.includes("--include-test") });
  process.stdout.write(renderReport(result) + "\n");
  const outAt = args.indexOf("--out");
  if (outAt >= 0) {
    const out = resolve(args[outAt + 1] || "");
    const rel = relative(REPO, out);
    if (!rel || (!rel.startsWith("..") && !isAbsolute(rel))) {
      console.error(`Refusing to write participant data inside the repository (${out}). Pick a folder outside it.`);
      process.exit(2);
    }
    mkdirSync(out, { recursive: true });
    writeFileSync(resolve(out, "paired.csv"), pairedCSV(result.pairs));
    writeFileSync(resolve(out, "runs.csv"), runsCSV(result.runs));
    const { pairs, runs, ...summary } = result;
    writeFileSync(resolve(out, "summary.json"), JSON.stringify(summary, null, 2));
    console.error(`Wrote paired.csv, runs.csv and summary.json to ${out}`);
  }
}
