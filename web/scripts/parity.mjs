// ── parity.mjs — Replays the recorded participant flow on the new UI and compares the
// telemetry it produces with tests/fixtures/event-contract.json (the vanilla UI's events).
// Usage: node scripts/parity.mjs   (dev server on :5173, or VD_BASE=<url>, installed Chrome). Exit code 1 on mismatch.
import { chromium } from "playwright-core";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const contract = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../../tests/fixtures/event-contract.json", import.meta.url)), "utf8"));
const BASE = process.env.VD_BASE || "http://localhost:5173/";
const IDEA = "We are building an AI-powered legal contract review tool for early-stage startups. No such tool exists today that combines LLM-based review with a human lawyer backstop at under $200/month. The legal-tech market is worth $27B globally.";
const VIEWED = new Set(["graveyard_viewed", "objections_viewed"]);

// Mock runs have no sources. For the source-click step the first run goes through a stubbed
// proxy that returns a contract-shaped report with one source (the "inject one link" step of the flow).
const STUB_REPORT = {
  idea_text: IDEA,
  claims: [
    { claim: "No such tool exists today that combines LLM-based review with a human lawyer backstop at under $200/month", type: "novelty", status: "unverified", reasoning: "stub", source_urls: ["https://example.com/evidence"] },
    { claim: "The legal-tech market is worth $27B globally", type: "market_size", status: "unverified", reasoning: "stub", source_urls: [] },
  ],
  graveyard_matches: [{ company_name: "Atrium", what_they_tried: "AI legal services", cause_of_death: "Unit economics", year_closed: 2020, similarity: 0.37 }],
  objections: [{ objection: "stub objection", severity: "low" }],
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", e => console.error("page error:", e.message));
await page.route("http://stub-proxy.test/screen", r => r.fulfill({
  status: 200, contentType: "application/json", body: JSON.stringify(STUB_REPORT),
  headers: { "X-VistaDex-Trace-Id": "stub-trace", "X-VistaDex-Mode": "live", "Access-Control-Expose-Headers": "X-VistaDex-Trace-Id, X-VistaDex-Mode", "Access-Control-Allow-Origin": "*" },
}));

const events = () => page.evaluate(() => JSON.parse(localStorage.getItem("vistadex.study.v1") || "{}").events || []);
const setProxy = url => page.evaluate(async u => { (await import("/@fs/" + window.__protoConfigPath)).CONFIG.PROXY_URL = u; }, url);
const nav = re => page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: re });
const run = async () => { await page.getByRole("button", { name: "Run pipeline" }).click(); await page.getByRole("button", { name: "Run pipeline" }).waitFor({ state: "visible" }); await page.waitForFunction(() => !document.querySelector("button[disabled]")?.textContent?.includes("Running")); };

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
// Path of prototype/config.js as Vite serves it (same module instance the app uses).
const cfgPath = fileURLToPath(new URL("../../prototype/config.js", import.meta.url)).replace(/\\/g, "/");
await page.evaluate(p => { window.__protoConfigPath = p; }, cfgPath);

// 1. decline → run → no events
await nav(/Screen/).click();
await page.getByRole("button", { name: "Use without taking part" }).click();
await page.fill("#ideaInput", IDEA);
await run();
const afterDecline = (await events()).length;

// 2. consent + pre-use trust 3
await page.getByRole("button", { name: "Read the study information" }).click();
await page.getByRole("button", { name: "I agree — take part" }).click();
await page.locator("#trustPreInput").fill("3");

// 3. demo report idea-01 (LegalAI for Startups), close, back
await nav(/Dashboard|Cohort/).click();
await page.getByRole("button", { name: "View report: LegalAI for Startups" }).click();
await page.keyboard.press("Escape");
await nav(/Screen/).click();

// 4. run (stubbed proxy, so a source exists); expand/collapse claim 0; ratings; source click
await setProxy("http://stub-proxy.test");
await run();
await page.waitForSelector("text=Screening report");
await setProxy("");
const toggle = page.getByRole("button", { name: /Show evidence|Hide evidence/ }).first();
await toggle.click(); await toggle.click(); // open, close — as in the recorded flow
await page.getByRole("button", { name: "Disagree" }).nth(0).click();
await page.getByRole("button", { name: "Agree", exact: true }).nth(1).click();
// The recorded flow clicked the source link programmatically while the evidence was collapsed.
await page.locator("a[href='https://example.com/evidence']").evaluate(a => {
  a.addEventListener("click", e => e.preventDefault(), { once: true }); // no navigation
  a.click();
});

// 5. panels into view, notes
await page.locator("#leads").scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
await page.locator("#objections").scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
await page.locator("textarea[id^=notes-]").fill("check Harvey");
await page.locator("textarea[id^=notes-]").blur();

// 6. survey
await page.locator("#trustPostInput").fill("5");
const finish = page.locator("section[aria-labelledby=finish-title]");
for (const [i, fs_] of (await finish.locator("fieldset").all()).entries()) await fs_.locator("label").nth(i + 1).click();
await finish.locator("textarea").fill("ok");
await page.getByRole("button", { name: "Submit" }).click();

// 7. two more runs, pagehide, failing run
await run(); await page.waitForTimeout(100);
await page.locator("#objections").scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await run(); await page.waitForTimeout(100);
await page.locator("#objections").scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await page.evaluate(() => dispatchEvent(new Event("pagehide")));
await setProxy("http://127.0.0.1:9");
await run();
await setProxy("");

const ev = await events();

// Tall-panel check (pilot-2 rule): on a small phone the objections panel is taller than twice
// the viewport. pilot-1 never reported it; now it must report once it covers half the screen.
const tall = { checked: false, panelHeight: 0, viewportHeight: 0, fired: false };
{
  const ph = await browser.newPage({ viewport: { width: 320, height: 400 }, isMobile: true });
  await ph.goto(BASE); await ph.evaluate(() => localStorage.clear()); await ph.reload();
  await ph.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /Screen/ }).click();
  await ph.getByRole("button", { name: "I agree — take part" }).click();
  await ph.locator("#trustPreInput").fill("4");
  await ph.fill("#ideaInput", IDEA);
  await ph.getByRole("button", { name: "Run pipeline" }).click();
  await ph.getByText("Screening report").waitFor({ timeout: 15000 });
  const box = await ph.locator("#objections").evaluate(el => ({ h: el.getBoundingClientRect().height, vh: innerHeight }));
  tall.panelHeight = Math.round(box.h); tall.viewportHeight = box.vh; tall.checked = box.h > 2 * box.vh;
  // Scroll so the panel's middle fills the screen (less than 50 % of the panel visible).
  await ph.locator("#objections").evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY + el.getBoundingClientRect().height / 2 - innerHeight / 2));
  await ph.waitForTimeout(500);
  tall.fired = await ph.evaluate(() => (JSON.parse(localStorage.getItem("vistadex.study.v1")).events || []).some(e => e.type === "objections_viewed"));
  await ph.close();
}
await browser.close();

// ── compare ──
const problems = [];
if (afterDecline !== 0) problems.push(`events after decline: ${afterDecline}`);
const envelope = ev[0] ? Object.keys(ev[0]) : [];
if (JSON.stringify(envelope) !== JSON.stringify(contract.envelope)) problems.push(`envelope ${envelope} != ${contract.envelope}`);
const keys = {};
for (const e of ev) {
  const k = JSON.stringify(Object.keys(e.payload).sort());
  if (keys[e.type] && keys[e.type] !== k) problems.push(`${e.type}: inconsistent payload keys`);
  keys[e.type] = k;
}
for (const [type, expected] of Object.entries(contract.payload_keys)) {
  if (!keys[type]) problems.push(`missing event type: ${type}`);
  else if (keys[type] !== JSON.stringify([...expected].sort())) problems.push(`${type}: keys ${keys[type]} != ${JSON.stringify(expected)}`);
}
for (const t of Object.keys(keys)) if (!contract.payload_keys[t]) problems.push(`unexpected event type: ${t}`);
const label = e => e.type + (e.payload.ended_by ? ":" + e.payload.ended_by : "") + (e.payload.view ? ":" + e.payload.view : "");
const seq = ev.map(label);
const strip = s => s.filter(x => !VIEWED.has(x));
if (JSON.stringify(strip(seq)) !== JSON.stringify(strip(contract.sequence))) {
  problems.push(`sequence differs (ignoring panel-viewed events):\n  got      ${strip(seq).join(", ")}\n  expected ${strip(contract.sequence).join(", ")}`);
}
// Panel-viewed events: at most once per run per panel, never outside a run.
const perRun = {};
for (const e of ev) if (VIEWED.has(e.type)) { const k = `${e.payload.run_id}:${e.type}`; perRun[k] = (perRun[k] || 0) + 1; }
for (const [k, n] of Object.entries(perRun)) if (n > 1) problems.push(`${k} fired ${n} times`);
const sv = ev.find(e => e.type === "survey_submitted");
if (sv && JSON.stringify(Object.keys(sv.payload.answers)) !== JSON.stringify(contract.values["survey_submitted.answers"])) problems.push("survey answer keys differ");
const versions = [...new Set(ev.map(e => e.study_version))];
if (JSON.stringify(versions) !== JSON.stringify([contract.study_version])) problems.push(`study_version ${versions} != ${contract.study_version}`);
const tp = ev.find(e => e.type === "trust_pre");
if (tp && JSON.stringify(tp.payload.scale) !== JSON.stringify(contract.values.scale)) problems.push("trust scale differs");

if (!tall.checked) problems.push(`tall-panel check not exercised: panel ${tall.panelHeight}px vs viewport ${tall.viewportHeight}px`);
else if (!tall.fired) problems.push(`objections_viewed did not fire for a ${tall.panelHeight}px panel in a ${tall.viewportHeight}px viewport`);
else console.log(`tall panel: objections_viewed fired for a ${tall.panelHeight}px panel in a ${tall.viewportHeight}px viewport`);
console.log(`events: ${ev.length}, types: ${Object.keys(keys).length}/${Object.keys(contract.payload_keys).length}, study_version: ${ev[0]?.study_version}`);
console.log("sequence:", seq.join(", "));
if (problems.length) { console.error("PARITY FAILED:\n- " + problems.join("\n- ")); process.exit(1); }
console.log("PARITY OK: envelope, payload keys for all event types, sequence and value checks match the contract.");
