// ── parity.mjs — Replays the public-edition flow in Chrome and checks every event against
// tests/fixtures/event-contract.json; then checks the pitch edition sends nothing at all.
// Usage: node scripts/parity.mjs   (dev server on :5173 or VD_BASE=<url>, installed Chrome). Exit 1 on mismatch.
import { BASE, contract, events, fillIdea, flush, IDEA_FIELDS, launch, LEGAL_IDEA, openApp, runIdea, setProxy, STUB, useStubProxy } from "./lib.mjs";

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
// A stubbed live report with one source, a competitor and a Big Tech result, so those controls are exercised.
const STUB_REPORT = {
  idea_text: LEGAL_IDEA,
  claims: [
    { claim: "No such tool exists today that combines LLM-based review with a human lawyer backstop", type: "novelty", status: "unverified", reasoning: "stub", source_urls: ["https://example.com/evidence"] },
    { claim: "The legal-tech market is worth $27B globally", type: "market_size", status: "unverified", reasoning: "stub", source_urls: [] },
  ],
  graveyard_matches: [{ company_name: "Atrium", what_they_tried: "AI-powered legal services platform", cause_of_death: "Unit economics", year_closed: 2020, similarity: 0.37 }],
  objections: [{ objection: "stub objection", severity: "low" }],
  competitors: [{ name: "Example Rival", url: "https://example.com/rival", why_similar: "stub", quote: "Example Rival offers contract review." }],
  search: { competitors: { queries: ["stub"], sources_checked: 3 }, graveyard: { entries_checked: 18, verified_entries: 0 } },
  big_tech_risk: { level: "unverified", companies: [], unconfirmed: [{ name: "Microsoft", source_urls: ["https://example.com/ms"] }], summary: "stub", companies_checked: ["Microsoft"], queries: ["stub"], sources_checked: 2 },
  overlap_band: "caution",
  scores: { vistadex: { value: 60, sample: false, used: [], excluded: [] }, axes: Object.fromEntries(["novelty", "market", "defensibility", "graveyard", "evidence", "big_tech"].map(a => [a, { value: null, inputs: {}, boundary: "stub", sample: false }])) },
};

const browser = await launch();

// ── public edition ──
{
  // Home and How it works first: readable before the notice, and not recorded.
  const { ctx, page } = await openApp(browser, { hash: "#/" });
  await page.route("https://example.com/**", r => r.fulfill({ status: 200, body: "source" }));
  await page.getByRole("heading", { name: /already died once/ }).waitFor();
  await page.locator("[data-control=home_how_it_works]").click();
  await page.getByRole("heading", { name: "Evidence first. You decide." }).waitFor();
  check((await events(page)).length === 0, "events exist before the Welcome notice");

  // 1. Use without recording → a run records nothing
  await page.locator("[data-control=nav_screen]").click();
  await page.getByRole("button", { name: "Use without recording" }).click();
  await runIdea(page);
  check((await events(page)).length === 0, "events recorded after 'Use without recording'");

  // 2. Turn recording on from Your data & privacy
  await page.locator("[data-control=footer_your_data]").click();
  await page.getByRole("button", { name: "Turn recording on" }).click();
  await page.getByRole("button", { name: "Continue to the tool" }).click();

  // 3. Live (stubbed) run: the form, sources, competitors, Big Tech, the score breakdown, every section in view
  const seen = await useStubProxy(page, { screen: () => ({ status: 200, body: STUB_REPORT }) });
  await page.locator("[data-control=sample_load][data-control-value=legal]").click();
  await page.locator("[data-control=industry_toggle][data-control-value=Fintech]").click();
  await page.locator("[data-control=role_select][data-control-value=investor]").click();
  await page.locator("[data-control=market_toggle][data-control-value=EU]").click();
  await page.locator("#field-moat").fill("Big law firms cannot easily replicate this.");
  await page.locator("#field-moat").blur();
  await page.getByRole("button", { name: /^Run$/ }).click();
  await page.getByRole("heading", { name: "Your report" }).waitFor({ timeout: 20000 });
  await page.locator("[data-control=score_breakdown_toggle]").click();
  await page.getByRole("button", { name: /Show sources/ }).first().click();
  for (const sel of ["[data-control=source_link]", "[data-control=competitor_link]", "[data-control=big_tech_source_link]"]) {
    const [popup] = await Promise.all([ctx.waitForEvent("page"), page.locator(sel).first().click()]);
    await popup.close();
  }
  await page.locator("[data-control=report_section_jump][data-control-value=objections]").first().click();
  for (const id of ["summary", "profile", "claims", "graveyard", "objections", "big_tech", "legal", "market"]) {
    await page.locator(`#section-${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }
  await page.locator("[data-control=report_save_pdf]").first().click();
  check(await page.evaluate(() => window.__printed === 1), "Save as PDF did not open the print dialog");

  // 4. Screen another idea (mock) → the first report ends with new_run; then a cancel and a failure
  await setProxy(page, "");
  await page.locator("[data-control=report_screen_another]").first().click();
  await runIdea(page);
  await page.locator("[data-control=report_screen_another]").first().click();
  await fillIdea(page);
  await page.getByRole("button", { name: /^Run$/ }).click();
  await page.locator("[data-control=run_cancel]").click();
  await page.waitForFunction(() => location.hash === "#/screen");
  await setProxy(page, "http://127.0.0.1:9");
  await page.getByRole("button", { name: /^Run$/ }).click();
  await page.waitForFunction(() => document.querySelector("[role=alert]"));
  await setProxy(page, STUB);

  // 5. Reports, Contact, the walkthrough, Feedback
  await page.locator("[data-control=nav_reports]").click();
  await page.getByText("Ideas analysed").waitFor();
  await page.locator("[data-control=reports_samples]").selectOption("5");
  await page.getByText("Sample report", { exact: true }).first().waitFor();
  await page.locator("[data-control=reports_sort]").selectOption("score");
  await page.locator("[data-control=reports_filter_band]").selectOption("caution");
  await page.locator("[data-control=reports_clear_filters]").or(page.locator("[data-control=reports_open]").first()).first().click();
  await page.locator("[data-control=nav_contact]").click();
  await page.getByRole("heading", { name: "Talk to the team" }).waitFor();
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
  for (const t of Object.keys(contract.payload_keys).filter(t => t !== "feedback_submitted")) check(types.includes(t), `flow did not produce ${t}`);
  const idx = t => ev.findIndex(e => e.type === t);
  check(idx("consent_given") === 0, "consent_given is not the first event");
  check(idx("run_started") < idx("run_completed"), "run_completed before run_started");
  check(ev.some(e => e.type === "report_time" && e.payload.ended_by === "new_run"), "a new run did not end the previous report (report_time new_run)");
  for (const s of ["profile", "big_tech", "score_breakdown"]) check(ev.some(e => e.type === "section_time" && e.payload.section === s), `no section_time for ${s}`);
  const started = ev.find(e => e.type === "run_started" && e.payload.industries?.length);
  check(started && started.payload.role === "investor" && started.payload.field_chars.moat > 0, "run_started lacks the selections or field lengths");
  const blob = JSON.stringify(ev);
  for (const s of [IDEA_FIELDS.pitch.slice(0, 40), IDEA_FIELDS.problem.slice(0, 40), "Big law firms cannot", "human lawyer backstop", "parity check"]) check(!blob.includes(s), `usage events contain "${s}"`);
  const fb = seen.eventBodies.map(b => JSON.parse(b)).find(b => b.events.some(e => e.type === "feedback_submitted"));
  check(fb && fb.session_id !== ev[0].session_id, "feedback was not sent under its own id");
  check(seen.eventBodies.every(b => JSON.parse(b).events.length <= 200), "an upload had more than 200 events");
  check(ev.some(e => e.type === "control_pressed" && e.payload.control === "reports_samples" && e.payload.value === "5"), "reports_samples not logged with its value");
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
  await page.locator("[data-control=reports_samples]").selectOption("15");
  await page.getByText("Sample report", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Open report: MinuteMate" }).click();
  await page.getByText(/^Sample report ·/).waitFor();
  await page.locator("[data-control=nav_reports]").first().click();
  await page.locator("[data-control=reports_open]").first().click();
  await page.locator("[data-control=score_breakdown_toggle]").click();
  await page.locator("[data-control=nav_screen]").click();
  await runIdea(page);
  await page.locator("[data-control=nav_home]").first().click();
  await page.getByRole("heading", { name: /already died once/ }).waitFor();
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
