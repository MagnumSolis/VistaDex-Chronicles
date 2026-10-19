// ── parity.mjs — Replays the public-edition flow in Chrome and checks every event against
// tests/fixtures/event-contract.json; then checks the pitch edition sends nothing at all.
// Usage: node scripts/parity.mjs   (dev server on :5173 or VD_BASE=<url>, installed Chrome). Exit 1 on mismatch.
import { BASE, contract, events, flush, launch, LEGAL_IDEA, openApp, runIdea, setProxy, STUB, useStubProxy } from "./lib.mjs";

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
// A stubbed live report with one source, so source clicks are exercised (mock runs have no sources).
const STUB_REPORT = {
  idea_text: LEGAL_IDEA,
  claims: [
    { claim: "No such tool exists today that combines LLM-based review with a human lawyer backstop", type: "novelty", status: "unverified", reasoning: "stub", source_urls: ["https://example.com/evidence"] },
    { claim: "The legal-tech market is worth $27B globally", type: "market_size", status: "unverified", reasoning: "stub", source_urls: [] },
  ],
  graveyard_matches: [{ company_name: "Atrium", what_they_tried: "AI-powered legal services platform", cause_of_death: "Unit economics", year_closed: 2020, similarity: 0.37 }],
  objections: [{ objection: "stub objection", severity: "low" }],
};

const browser = await launch();

// ── public edition ──
{
  const { ctx, page } = await openApp(browser);
  await page.route("https://example.com/**", r => r.fulfill({ status: 200, body: "source" }));
  const welcome = page.getByRole("heading", { name: /See the evidence/ });
  await welcome.waitFor();
  check((await events(page)).length === 0, "events exist before the Welcome notice");

  // 1. Use without recording → a run records nothing
  await page.getByRole("button", { name: "Use without recording" }).click();
  await runIdea(page);
  check((await events(page)).length === 0, "events recorded after 'Use without recording'");

  // 2. Turn recording on from Your data & privacy
  await page.locator("[data-control=footer_your_data]").click();
  await page.getByRole("button", { name: "Turn recording on" }).click();
  await page.getByRole("button", { name: "Continue to the tool" }).click();

  // 3. Live (stubbed) run with a source: expand, click the source, jump nav, scroll every section into view
  const seen = await useStubProxy(page, { screen: () => ({ status: 200, body: STUB_REPORT }) });
  await page.locator("[data-control=sample_load][data-control-value=legal]").click();
  await page.locator("[data-control=market_toggle][data-control-value=EU]").click();
  await page.getByRole("button", { name: /^Run$/ }).click();
  await page.getByRole("heading", { name: "Your report" }).waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: /Show sources/ }).first().click();
  const [popup] = await Promise.all([ctx.waitForEvent("page"), page.locator("[data-control=source_link]").first().click()]);
  await popup.close();
  await page.locator("[data-control=report_section_jump][data-control-value=objections]").first().click();
  for (const id of ["summary", "claims", "graveyard", "objections", "legal", "market"]) {
    await page.locator(`#section-${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }
  await page.locator("[data-control=report_save_pdf]").first().click();
  check(await page.evaluate(() => window.__printed === 1), "Save as PDF did not open the print dialog");

  // 4. Screen another idea (mock) → the first report ends with new_run; then cancel one; then a failure
  await setProxy(page, "");
  await page.locator("[data-control=report_screen_another]").first().click();
  await runIdea(page);
  await page.locator("[data-control=report_screen_another]").first().click();
  await page.locator("#ideaInput").fill(LEGAL_IDEA);
  await page.getByRole("button", { name: /^Run$/ }).click();
  await page.locator("[data-control=run_cancel]").click();
  await page.waitForFunction(() => location.hash === "#/screen");
  await setProxy(page, "http://127.0.0.1:9");
  await runIdea(page);
  await setProxy(page, STUB);

  // 5. Graveyard sheet, How it works, walkthrough, Feedback
  await page.locator("[data-control=nav_graveyard]").click();
  await page.locator("[data-control=graveyard_search]").fill("legal");
  await page.locator("[data-control=graveyard_search]").blur();
  await page.locator("[data-control=graveyard_filter][data-control-value=unit-economics]").click();
  await page.locator("[data-control=graveyard_entry_open]").first().click();
  await page.locator("[data-control=graveyard_sheet_close]").click();
  await page.locator("[data-control=nav_how]").click();
  await page.locator("[data-control=help_replay_walkthrough]").first().click();
  await page.locator("[data-control=walkthrough_next]").click();
  await page.locator("[data-control=walkthrough_back]").click();
  await page.locator("[data-control=walkthrough_skip]").click();
  await page.locator("[data-control=header_feedback]").first().click();
  await page.locator("label", { hasText: "Investor" }).click();
  await page.getByLabel("What was wrong or missing?").fill("parity check");
  await page.locator("[data-control=feedback_submit]").click();
  await page.getByText("Your answers are saved.").waitFor();
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  await flush(page);

  const ev = await events(page);
  const types = ev.map(e => e.type);
  // envelope, payload keys, enums
  for (const e of ev) {
    check(JSON.stringify(Object.keys(e).sort()) === JSON.stringify([...contract.envelope].sort()), `envelope of ${e.type}`);
    const keys = contract.payload_keys[e.type];
    if (!keys) { problems.push(`event type not in the contract: ${e.type}`); continue; }
    const optional = contract.optional_keys[e.type] ?? [];
    const got = Object.keys(e.payload).filter(k => !optional.includes(k)).sort();
    check(JSON.stringify(got) === JSON.stringify([...keys].sort()), `${e.type} payload keys ${got} ≠ ${keys}`);
    check(e.study_version === contract.study_version, `${e.type} study_version ${e.study_version}`);
    if (e.type === "control_pressed") check(contract.controls.includes(e.payload.control), `unknown control ${e.payload.control}`);
    for (const [path, allowed] of Object.entries(contract.values)) {
      const [t, k] = path.split(".");
      if (t === e.type && k && Array.isArray(allowed) && !Array.isArray(e.payload[k]) && typeof e.payload[k] !== "object") check(allowed.includes(e.payload[k]), `${path} = ${e.payload[k]}`);
    }
  }
  // every public event type is produced by this flow (feedback goes separately, below)
  for (const t of Object.keys(contract.payload_keys).filter(t => t !== "feedback_submitted")) check(types.includes(t), `flow did not produce ${t}`);
  // ordering rules
  const idx = (t, pred = () => true) => ev.findIndex(e => e.type === t && pred(e));
  check(idx("consent_given") === 0, "consent_given is not the first event");
  check(idx("run_started") < idx("run_completed"), "run_completed before run_started");
  check(ev.some(e => e.type === "report_time" && e.payload.ended_by === "new_run"), "a new run did not end the previous report (report_time new_run)");
  check(ev.filter(e => e.type === "graveyard_viewed").length <= ev.filter(e => e.type === "run_completed").length, "graveyard_viewed more than once per run");
  // no idea text, no claim text, no feedback answers in usage events
  const blob = JSON.stringify(ev);
  for (const s of [LEGAL_IDEA.slice(0, 40), "human lawyer backstop", "parity check"]) check(!blob.includes(s), `usage events contain "${s}"`);
  // feedback travelled under a different id
  const fb = seen.eventBodies.map(b => JSON.parse(b)).find(b => b.events.some(e => e.type === "feedback_submitted"));
  check(fb && fb.session_id !== ev[0].session_id, "feedback was not sent under its own id");
  check(seen.eventBodies.every(b => JSON.parse(b).events.length <= 200), "an upload had more than 200 events");
  console.log(`public flow: ${ev.length} events, ${new Set(types).size} types, ${new Set(ev.filter(e => e.type === "control_pressed").map(e => e.payload.control)).size} distinct controls`);
  await ctx.close();
}

// ── pitch edition: zero events ──
{
  const { ctx, page } = await openApp(browser, { hash: "#edition=pitch" });
  const uploads = [];
  await page.route(`${STUB}/**`, r => { if (r.request().url().endsWith("/events")) uploads.push(r.request().postData()); return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STUB_REPORT), headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-VistaDex-Access" } }); });
  await page.getByRole("heading", { name: "Screened ideas" }).waitFor();
  check(!(await page.evaluate(() => location.href)).includes("edition="), "edition= was not scrubbed from the address bar");
  check(await page.getByTestId("edition-badge").first().isVisible(), "Pitch edition badge not visible");
  await setProxy(page, STUB);
  await page.locator("[data-control=dashboard_open_report]").first().click();
  await page.locator("[data-control=nav_screen]").click();
  await runIdea(page);
  await page.locator("[data-control=nav_graveyard]").click();
  await page.locator("[data-control=graveyard_entry_open]").first().click();
  await page.keyboard.press("Escape");
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  await flush(page);
  await page.waitForTimeout(500);
  check(uploads.length === 0, `pitch edition uploaded ${uploads.length} batch(es)`);
  check((await events(page)).length === 0, "pitch edition logged events");
  await ctx.close();
}

await browser.close();
if (problems.length) { console.error(`PARITY FAILED (${problems.length})\n- ` + problems.join("\n- ")); process.exit(1); }
console.log(`PARITY OK against ${BASE}: every event matches the ${contract.study_version} contract; nothing before the notice or after opting out; no idea, claim or feedback text in usage events; the pitch edition sent nothing.`);
