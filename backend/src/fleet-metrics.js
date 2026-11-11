// backend/src/fleet-metrics.js: per-run discovery numbers, kept in fleet_state so the
// trend is visible. One document, _id "metrics": `totals` sums every run, `runs` keeps
// the last KEEP_RUNS records. A GitHub run writes twice (the discovery step, then the
// Death Watcher step) into one record keyed by GITHUB_RUN_ID. Steps of one run are
// sequential and runs never overlap (workflow concurrency group), so a read-modify-
// write of this document is safe.

export const KEEP_RUNS = 120; // 30 days at 4 runs a day
export const COLUMNS = [
  ["queries", "queries"], ["signals", "signals"], ["prefiltered", "pre-filtered"], ["extracted", "extracted"],
  ["new_candidates", "new candidates"], ["sources_added", "sources added"], ["confirmed", "confirmed"],
];

const LEVELS = new Set(["backlog"]); // a level at the end of the run, not summed into totals
export const runId = (env = process.env, now = new Date()) => String(env.GITHUB_RUN_ID || `local-${now.toISOString().slice(0, 16)}`);

// Pure: the metrics document after adding `fields` to run `id`. Numbers are summed
// into totals; a field a run reports twice replaces its first value in the run record.
export function mergeRun(doc, id, fields, at = new Date()) {
  const out = { _id: "metrics", totals: { ...(doc?.totals || {}) }, runs: [...(doc?.runs || [])] };
  let i = out.runs.findIndex(r => r.run_id === id);
  if (i < 0) { out.runs.push({ run_id: id, at }); i = out.runs.length - 1; out.totals.runs = (out.totals.runs || 0) + 1; }
  const run = { ...out.runs[i] };
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "number" && Number.isFinite(v) && !LEVELS.has(k)) out.totals[k] = (out.totals[k] || 0) - (typeof run[k] === "number" ? run[k] : 0) + v;
    run[k] = v;
  }
  out.runs[i] = run;
  out.runs = out.runs.slice(-KEEP_RUNS);
  out.updated_at = at;
  return out;
}

export async function recordRun(state, id, fields) {
  const doc = mergeRun(await state.findOne({ _id: "metrics" }), id, fields);
  await state.replaceOne({ _id: "metrics" }, doc, { upsert: true });
  return doc;
}

const cell = v => (v === undefined || v === null ? "–" : String(v));
export const summaryLine = r => COLUMNS.map(([k, label]) => `${label} ${cell(r[k])}`).join(" · ");

// Times in IST (UTC+5:30), the team's time zone.
export const ist = at => `${new Date(new Date(at).getTime() + 330 * 60000).toISOString().slice(0, 16).replace("T", " ")} IST`;

// Markdown: this run, the totals, and the last `last` runs (newest first).
export function formatReport(doc, id, last = 12) {
  const runs = doc?.runs || [];
  const run = runs.find(r => r.run_id === id);
  const t = doc?.totals || {};
  const head = `| run | ${COLUMNS.map(c => c[1]).join(" | ")} |\n|${" --- |".repeat(COLUMNS.length + 1)}`;
  const row = r => `| ${r.run_id === id ? `**this run** (${ist(r.at)})` : ist(r.at)} | ${COLUMNS.map(([k]) => cell(r[k])).join(" | ")} |`;
  return [
    "## Graveyard discovery",
    run ? `This run (${id}): ${summaryLine(run)}${run.stopped ? ` · extraction stopped: ${run.stopped}` : ""}${run.backlog !== undefined ? ` · signals waiting: ${run.backlog}` : ""}` : `No record for run ${id}.`,
    `All ${cell(t.runs)} recorded runs: ${summaryLine(t)}`,
    "", head, ...runs.slice(-last).reverse().map(row),
  ].join("\n");
}
