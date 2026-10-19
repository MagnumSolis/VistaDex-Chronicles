// ── access-e2e.mjs — Participant side of the study access code, in Chrome ──
// Checks: #code= is read and scrubbed from the address bar; /screen gets the X-VistaDex-Access
// header; /events uploads carry access_code (never inside an event); a 401 and the daily-cap 429
// show plain messages and fire run_failed. The proxy is stubbed (no Worker needed).
// Usage: node scripts/access-e2e.mjs   (dev server on :5173 or VD_BASE=<url>). Exit 1 on failure.
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";

const BASE = process.env.VD_BASE || "http://localhost:5173/";
const PROXY = "http://stub-proxy.test";
const CODE = "K7Q2-MX9P";
const IDEA = "The legal-tech market is worth $27B globally. No such tool exists today.";
const REPORT = { idea_text: IDEA, claims: [{ claim: "The legal-tech market is worth $27B globally", type: "market_size", status: "unverified", reasoning: "stub", source_urls: [] }], graveyard_matches: [], objections: [{ objection: "stub", severity: "low" }] };
const cfgPath = fileURLToPath(new URL("../../prototype/config.js", import.meta.url)).replace(/\\/g, "/");
const telPath = fileURLToPath(new URL("../../prototype/ui/telemetry.js", import.meta.url)).replace(/\\/g, "/");
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-VistaDex-Access", "Access-Control-Expose-Headers": "X-VistaDex-Trace-Id, X-VistaDex-Mode" };
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function participant(url, screenReply, { freshLoad = true } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const seen = { screenHeaders: [], eventBodies: [] };
  await page.route(`${PROXY}/screen`, async r => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    seen.screenHeaders.push(r.request().headers()["x-vistadex-access"] ?? null);
    const { status, body } = screenReply();
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { ...cors, "X-VistaDex-Trace-Id": "t", "X-VistaDex-Mode": "live" } });
  });
  await page.route(`${PROXY}/events`, r => { seen.eventBodies.push(r.request().postData()); return r.fulfill({ status: 200, body: "{}", headers: cors }); });
  await page.goto(BASE); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  if (freshLoad) await page.goto("about:blank"); // fresh load of the link; otherwise an in-page fragment change
  await page.goto(url);
  await page.waitForTimeout(100);
  await page.evaluate(async ([p, u]) => { (await import("/@fs/" + p)).CONFIG.PROXY_URL = u; }, [cfgPath, PROXY]);
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /Screen/ }).click();
  await page.getByRole("button", { name: "I agree — take part" }).click();
  await page.locator("#trustPreInput").fill("4");
  await page.fill("#ideaInput", IDEA);
  return { page, seen };
}
const run = async page => { await page.getByRole("button", { name: "Run pipeline" }).click(); await page.waitForFunction(() => !document.body.innerText.includes("Running…")); };
const events = page => page.evaluate(() => JSON.parse(localStorage.getItem("vistadex.study.v1") || "{}").events || []);

// 1. Link with #code=: scrubbed, stored, sent on /screen and /events
{
  const { page, seen } = await participant(`${BASE}#code=${CODE}`, () => ({ status: 200, body: REPORT }));
  check(await page.evaluate(() => location.hash === ""), "code was not scrubbed from the address bar");
  check(!(await page.evaluate(() => location.href)).includes(CODE), "code still visible in the URL");
  check(await page.evaluate(() => sessionStorage.getItem("vistadex.access")) === CODE, "code not kept in sessionStorage");
  await run(page);
  check(await page.getByText("Screening report").isVisible(), "report did not render with a valid code");
  check(seen.screenHeaders[0] === CODE, `/screen header was ${seen.screenHeaders[0]}`);
  await page.evaluate(async p => (await import("/@fs/" + p)).flush(), telPath);
  const upload = seen.eventBodies.map(b => JSON.parse(b)).at(-1);
  check(upload?.access_code === CODE, "/events upload lacks access_code");
  check(upload && !JSON.stringify(upload.events).includes(CODE), "access code leaked into an event");
  check(!JSON.stringify(await events(page)).includes(CODE), "access code stored in local telemetry");
  await page.close();
}

// 1b. Link opened in a tab that already shows the site (fragment change only, no reload)
{
  const { page, seen } = await participant(`${BASE}#code=${CODE}`, () => ({ status: 200, body: REPORT }), { freshLoad: false });
  check(await page.evaluate(() => location.hash === ""), "in-page: code was not scrubbed");
  check(await page.evaluate(() => sessionStorage.getItem("vistadex.access")) === CODE, "in-page: code not stored");
  await run(page);
  check(seen.screenHeaders[0] === CODE, `in-page: /screen header was ${seen.screenHeaders[0]}`);
  await page.close();
}

// 2. Daily cap: 429 → "paused for today" shown, run_failed fired with that message
{
  const { page } = await participant(`${BASE}#code=${CODE}`, () => ({ status: 429, body: { error: "daily_cap", message: "The study is paused for today. Please try again tomorrow." } }));
  await run(page);
  check(await page.getByText(/paused for today/).isVisible(), "daily-cap message not shown");
  const failed = (await events(page)).find(e => e.type === "run_failed");
  check(failed && /paused for today/.test(failed.payload.error), "run_failed not fired with the daily-cap message");
  check(failed && JSON.stringify(Object.keys(failed.payload).sort()) === JSON.stringify(["error", "run_id"]), "run_failed payload keys changed");
  await page.close();
}

// 3. Link without a code: the proxy answers 401 → plain message, run_failed
{
  const { page, seen } = await participant(BASE, () => ({ status: 401, body: { error: "access_code_required" } }));
  await run(page);
  check(seen.screenHeaders[0] === null, "a code was sent although the link had none");
  check(await page.getByText(/missing its access code/).isVisible(), "401 message not shown");
  check((await events(page)).some(e => e.type === "run_failed"), "run_failed not fired on 401");
  await page.close();
}

await browser.close();
if (problems.length) { console.error("ACCESS E2E FAILED:\n- " + problems.join("\n- ")); process.exit(1); }
console.log("ACCESS E2E OK: code read from #code= and scrubbed; header on /screen, body field on /events (never in events); 401 and daily-cap 429 shown in plain language with run_failed.");
