// ── study-e2e.mjs — The whole study, end to end, against a local Worker and database ──
// Runs the Worker's handler in this process (memory store, mock pipeline, no provider keys), points the
// app at it, and takes two participants through the study in one browser (the second after "Next
// participant"; E2E01 chatbot first, E2E02 VistaDex first, by code number), plus one field visitor who
// flags a claim as looking wrong. Then checks what the research side gets: one study_comparisons
// row per participant with the pasted answer, the report snapshot, the full report and the preferences;
// the CSV and JSON exports; the console's analysis (chatbotComparison) on the same events; and that the
// field visitor has no row. Never reaches the deployed Worker (lib.mjs blocks workers.dev).
// Usage: npm --prefix web run study-e2e   (dev server on :5173 or VD_BASE=<url>). Exit 1 on a problem.
import http from "node:http";
import { handle } from "../../worker/src/index.js";
import { memoryStore } from "../../worker/src/store.js";
import { analyzeStudy } from "../../worker/src/research-join.js";
import { BASE, flush, launch, openApp, setProxy } from "./lib.mjs";

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const TOKEN = "local-e2e-token";
const env = { ALLOWED_ORIGINS: new URL(BASE).origin, ACCESS_REQUIRED: "false", EXPORT_TOKEN: TOKEN };
const store = memoryStore();
const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(`http://127.0.0.1${req.url}`, {
    method: req.method, headers: Object.fromEntries(Object.entries(req.headers).filter(([, v]) => typeof v === "string")),
    body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const response = await handle(request, env, { store });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const WORKER = `http://127.0.0.1:${server.address().port}`;
const api = async (path, init = {}) => {
  const res = await fetch(WORKER + path, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) } });
  return path.includes("format=csv") ? res.text() : res.json();
};

const pick = (page, control) => page.locator(`label:has([data-control=${control}])`).first().click();
const ANSWERS = { E2E01: "E2E answer one. Levels and Nutrisense already sell glucose-based meal advice; the $4.2B figure could not be verified. ".repeat(3),
  E2E02: "E2E answer two. Skill-swap platforms like Superprof exist; many campus marketplaces shut down. ".repeat(3) };

async function chatbotPart(page, code) {
  await page.getByRole("button", { name: "Copy prompt" }).waitFor();
  await setProxy(page, WORKER);
  await page.locator("[data-control=baseline_sent]").click();
  await page.locator("[data-control=baseline_start]").click();
  await pick(page, "baseline_tool_pick");
  await pick(page, "baseline_web_yes");
  await page.getByLabel("The chatbot's answer").fill(ANSWERS[code]);
  await page.locator("[data-control=baseline_save_answer]").click();
  await pick(page, "study_sources_1_2");
  await pick(page, "study_basis_answer");
  await page.locator("[data-control=baseline_submit]").click();
}
async function vistadexPart(page) {
  await page.getByText(/is filled in/).waitFor();
  await setProxy(page, WORKER);
  await page.getByRole("button", { name: /^Run$/ }).click();
  await page.getByRole("heading", { name: "Your report" }).waitFor({ timeout: 60000 });
  await pick(page, "study_sources_3p");
  await pick(page, "study_basis_sources");
  await page.locator("[data-control=study_survey_submit]").click();
}

// study-19: odd codes do the chatbot first, even codes VistaDex first.
async function participant(page, code, idea, { first }) {
  if (first) {
    await page.evaluate(() => { location.hash = "#/study"; });
    await page.getByRole("button", { name: "I have a participant code" }).click();
  }
  await page.getByLabel("Participant code").fill(code);
  await page.locator(`[data-control=study_idea_pick][data-control-value=${idea}]`).click();
  await page.locator("[data-control=study_start]").click();
  await page.getByRole("button", { name: "Start with walkthrough" }).click(); // must still lead to the participant's first part
  if (parseInt(code.replace(/\D/g, ""), 10) % 2 === 1) { await chatbotPart(page, code); await vistadexPart(page); }
  else { await vistadexPart(page); await chatbotPart(page, code); }
  await page.getByRole("heading", { name: "The AI chatbot or VistaDex?" }).waitFor();
  await pick(page, "compare_pick_vistadex");
  await page.getByLabel(/^Why\?/).fill(`why ${code}`);
  await page.locator("[data-control=compare_submit]").click();
  await page.getByRole("heading", { name: "You've finished both parts" }).waitFor();
  await flush(page);
}

const browser = await launch();
try {
  // Two participants, one browser: the second starts with "Next participant".
  {
    const { ctx, page } = await openApp(browser, { hash: "#/study" });
    await setProxy(page, WORKER);
    await participant(page, "E2E01", "A", { first: true });
    await page.locator("[data-control=study_next_participant]").click();
    await page.getByRole("button", { name: "I have a participant code" }).click();
    await participant(page, "E2E02", "B", { first: false });
    await page.evaluate(() => dispatchEvent(new Event("pagehide")));
    await flush(page);
    await ctx.close();
  }
  // A field visitor: a consented run, never a study row.
  {
    const { ctx, page } = await openApp(browser, { hash: "#/screen" });
    await setProxy(page, WORKER);
    await page.getByRole("button", { name: "Skip to the tool" }).click();
    await page.getByRole("button", { name: "Mental-health journaling app" }).click();
    await page.getByRole("button", { name: /^Run$/ }).click();
    await page.getByRole("heading", { name: "Your report" }).waitFor({ timeout: 60000 });
    await page.locator("[data-control=report_flag_claim]").first().click();
    await flush(page);
    await ctx.close();
  }

  // ── what the research side gets ──
  const rows = await api("/export?table=comparisons&full=1");
  check(Array.isArray(rows) && rows.length === 2, `expected 2 study_comparisons rows, got ${rows.length}`);
  check(new Set(rows.map(r => r.session_id)).size === 2, "the two participants share a session");
  for (const [code, idea] of [["E2E01", "A"], ["E2E02", "B"]]) {
    const r = rows.find(x => x.code === code);
    if (!r) { problems.push(`no row for ${code}`); continue; }
    check(r.idea_key === idea, `${code}: idea ${r.idea_key}`);
    check(r.chatbot_text === ANSWERS[code].trim(), `${code}: the stored chatbot answer is not the pasted text`);
    check(r.chatbot_tool === "ChatGPT" && r.chatbot_web_search === "yes", `${code}: tool / web search ${r.chatbot_tool} / ${r.chatbot_web_search}`);
    check(r.report_snapshot && r.report_snapshot.claims.length > 0, `${code}: no report snapshot`);
    check(r.report_full && Array.isArray(r.report_full.claims) && r.report_full.claims.length === r.report_snapshot.claims.length, `${code}: no full report, or it does not match the snapshot`);
    check(r.pref_overall === "vistadex" && r.pref_why === `why ${code}`, `${code}: preferences ${r.pref_overall} / ${r.pref_why}`);
    check(typeof r.report_text === "string" && r.report_text.includes("Claims:"), `${code}: no readable report text`);
  }
  const csv = await api("/export?table=comparisons&format=csv");
  check(csv.split("\n")[0].includes("chatbot_text") && csv.includes("E2E answer one") && csv.includes("Claims:"), "comparisons.csv lacks the two texts side by side");

  // The console's analysis, on the events the Worker stored.
  const data = await api("/research/data?full=1");
  const A = analyzeStudy(data.all_events);
  check(A.comparison.n.both === 2 && A.comparison.n.preferences === 2, `analysis: ${JSON.stringify(A.comparison.n)}`);
  check(A.pairs.filter(p => p.complete).length === 2, "Paired study: both participants should be complete");
  const orderOf = c => A.pairs.find(p => p.code === c)?.order;
  check(orderOf("E2E01") === "baseline-first" && orderOf("E2E02") === "vistadex-first", `order not counterbalanced by code: ${orderOf("E2E01")} / ${orderOf("E2E02")}`);
  check(A.pairs.every(p => p.version === "2026-11-study-20"), "a pair is not tagged with the current study version");
  const basisOf = c => A.pairs.find(p => p.code === c);
  check(["E2E01", "E2E02"].every(c => JSON.stringify(basisOf(c)?.baseline.basis) === '["answer"]' && JSON.stringify(basisOf(c)?.vistadex.basis) === '["sources"]'), "judgement basis not recorded for both parts");
  check(A.flags.total === 1 && A.flags.claim === 1, `report_flag: ${JSON.stringify(A.flags)}`);
  const types = new Set(data.all_events.map(e => e.type));
  for (const t of ["participant_profile", "chatbot_answer", "vistadex_report_snapshot", "tool_preference", "condition_survey", "report_flag"]) check(types.has(t), `no ${t} event reached the Worker`);
  const fieldSid = data.all_events.find(e => e.type === "participant_registered" && e.payload.track === "field")?.session_id;
  check(fieldSid && !rows.some(r => r.session_id === fieldSid), "the field visitor got a study row");
  console.log(`study e2e: ${data.all_events.length} events in ${new Set(data.all_events.map(e => e.session_id)).size} sessions; ${rows.length} study_comparisons rows`);
} finally {
  await browser.close();
  server.close();
}
if (problems.length) { console.error(`STUDY E2E FAILED (${problems.length})\n- ` + problems.join("\n- ")); process.exit(1); }
console.log("STUDY E2E OK: two participants and a field visitor through the local Worker; each participant's chatbot answer, report snapshot, full report and preferences are in study_comparisons and both exports, the analysis sees two complete pairs, and the field visitor has no row.");
