#!/usr/bin/env node
// analysis/study_analysis.mjs: the study's numbers for the paper, from a research export.
//
//   node analysis/study_analysis.mjs <events.json|events.csv> [--include-test] [--out <dir outside the repo>]
//
// Input: the console's Export ("events.json" or "events.csv", i.e. GET /export?table=events). Participant data
// is read from the path you give and never written inside this repository; --out refuses a folder in it.
// Output: a Markdown report on stdout; with --out also report.md, summary.json and the console's CSV tables
// (paired, runs, attention, votes, open-answers, segments).
//
// The joins and the Wilcoxon test are the Research Console's own (worker/src/research-join.js), so the
// console and this report give the same numbers. Codes starting with "TEST" are left out unless
// --include-test. H1 to H4 as in README.md and docs/STUDY-NOTES.md.
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyzeStudy, exportTables, mannWhitney } from "../worker/src/research-join.js";

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

// ── analysis ──
// The numbers come from worker/src/research-join.js (analyzeStudy): the same code the Research Console's
// Insights view runs, so the console, its CSV downloads and this report always agree.
export { mannWhitney };

/** Everything the report needs, from parsed events. */
export function analyze(events, { includeTest = false } = {}) {
  return analyzeStudy(events, { includeTest });
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

  L.push("## Findings", "", "Each finding with its n. \"Not enough data yet\" means the group is below the minimum to state it (6 pairs for a paired test, 5 runs per group, 10 votes).", "");
  for (const f of r.findings) L.push(`- **${f.title}** (${f.n === Infinity ? 0 : f.n} ${f.unit}${f.enough ? "" : `; not enough data yet, needs ${f.min}`}): ${f.text}`);
  L.push("");

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
  L.push(`Runs with at least one evidence link opened (claim sources, graveyard, competitors, Big Tech, legal, market): ${r.h4.clickers.n} (mean change ${fmt(r.h4.clickers.meanDelta)}, mean absolute change ${fmt(r.h4.clickers.meanAbsDelta)}). Runs without: ${r.h4.nonClickers.n} (mean change ${fmt(r.h4.nonClickers.meanDelta)}, mean absolute change ${fmt(r.h4.nonClickers.meanAbsDelta)}). Mann-Whitney on change: p ${fmtP(r.h4.test)}.`, "");
  L.push("| Run in session | Runs | Mean change | Mean absolute change |", "|---|---|---|---|");
  for (const x of r.h4.byRunIndex) L.push(`| ${x.run} | ${x.runs} | ${fmt(x.meanDelta)} | ${fmt(x.meanAbsDelta)} |`);
  L.push("", "Note: this is confidence change, not calibration. Calibration needs a ground truth for each idea (for example how its claims were later resolved), which these events do not hold.", "");

  L.push("## Reading: share of finished runs that showed each section", "");
  L.push("| Section | Runs | Share | Median seconds |", "|---|---|---|---|");
  for (const a of r.attention) L.push(`| ${a.section} | ${a.runs} | ${fmt(a.reachPct)}% | ${fmt(a.medianSec)} |`);
  L.push("", `Median time on the report: ${fmt(r.reportMedianMin)} min.`, "");

  for (const [by, title] of [["role", "role"], ["channel", "channel"], ["track", "track"]]) {
    L.push(`## By ${title} (finished runs)`, "");
    L.push("| Group | Runs | Mean confidence change | Evidence opened | Mean trust | Agree % |", "|---|---|---|---|---|---|");
    for (const g of r.segments[by]) L.push(`| ${g.group} | ${g.runs} | ${fmt(g.meanDelta)} (n ${g.confN}) | ${fmt(g.evidencePct)}% | ${fmt(g.trust)} (n ${g.surveyN}) | ${fmt(g.agreePct)} (n ${g.votes}) |`);
    L.push("");
  }

  L.push("## Funnels", "", "| Field track (sessions) | n |", "|---|---|");
  for (const [k, n] of r.funnel.field) L.push(`| ${k} | ${n} |`);
  L.push("", "| Study track (participants) | n |", "|---|---|");
  for (const [k, n] of r.funnel.study) L.push(`| ${k} | ${n} |`);
  L.push("");

  L.push("## Comprehension check (what an \"unverified\" claim means)", "");
  L.push(Object.entries(r.comprehension).map(([k, n]) => `${k}: ${n}`).join(", ") || "No answers.", "");
  return L.join("\n");
}

// ── CLI ──
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--out");
  if (!input) {
    console.error("usage: node analysis/study_analysis.mjs <events.json|events.csv> [--include-test] [--out <dir>]");
    process.exit(2);
  }
  const events = parseExport(readFileSync(input, "utf8"));
  const result = analyze(events, { includeTest: args.includes("--include-test") });
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
    const tables = exportTables(result, events);
    for (const [name, csv] of Object.entries(tables)) writeFileSync(resolve(out, name), csv);
    const { pairs, runs, votes, ...summary } = result;
    writeFileSync(resolve(out, "summary.json"), JSON.stringify(summary, null, 2));
    writeFileSync(resolve(out, "report.md"), renderReport(result));
    console.error(`Wrote ${Object.keys(tables).join(", ")}, summary.json and report.md to ${out}`);
  }
}
