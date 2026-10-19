// ── access-e2e.mjs — Access code and edition from the link fragment, in Chrome ──
// Checks: #code= (and #edition=pitch&code=…) are read and scrubbed from the address bar; /screen gets
// the X-VistaDex-Access header; /events uploads carry access_code (never inside an event); 401 and the
// daily-cap 429 show friendly messages on Screen an idea and fire run_failed. The proxy is stubbed.
// Usage: node scripts/access-e2e.mjs   (dev server on :5173 or VD_BASE=<url>). Exit 1 on failure.
import { BASE, events, flush, IDEA_FIELDS, launch, openApp, runIdea, useStubProxy } from "./lib.mjs";

const CODE = "K7Q2-MX9P";
const IDEA = "The legal-tech market is worth $27B globally. No such tool exists today.";
const REPORT = { idea_text: IDEA, claims: [{ claim: "The legal-tech market is worth $27B globally", type: "market_size", status: "unverified", reasoning: "stub", source_urls: [] }], graveyard_matches: [], objections: [{ objection: "stub", severity: "low" }] };
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const browser = await launch();

async function visitor(hash, reply, { inPage = false } = {}) {
  const { ctx, page } = await openApp(browser, { hash: inPage ? "#/screen" : `${hash}` });
  if (inPage) { await page.getByRole("heading", { name: /See the evidence/ }).waitFor(); await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(150); }
  if (!(await page.getByRole("button", { name: "Skip to the tool" }).isVisible().catch(() => false))) await page.evaluate(() => { location.hash = "#/screen"; });
  await page.getByRole("button", { name: "Skip to the tool" }).click();
  const seen = await useStubProxy(page, { screen: reply });
  return { ctx, page, seen };
}

// 1. Link with #code=: scrubbed, kept for the tab, sent on /screen and /events
for (const inPage of [false, true]) {
  const label = inPage ? "in-page fragment change" : "fresh load";
  const { ctx, page, seen } = await visitor(`#code=${CODE}`, () => ({ status: 200, body: REPORT }), { inPage });
  check(!(await page.evaluate(() => location.href)).includes(CODE), `${label}: code still visible in the URL`);
  check(await page.evaluate(() => sessionStorage.getItem("vistadex.access")) === CODE, `${label}: code not kept in sessionStorage`);
  await runIdea(page);
  check(await page.getByRole("heading", { name: "Your report" }).isVisible(), `${label}: report did not render with a valid code`);
  check(seen.screenHeaders[0] === CODE, `${label}: /screen header was ${seen.screenHeaders[0]}`);
  await flush(page);
  const upload = seen.eventBodies.map(b => JSON.parse(b)).at(-1);
  check(upload?.access_code === CODE, `${label}: /events upload lacks access_code`);
  check(upload && !JSON.stringify(upload.events).includes(CODE), `${label}: access code leaked into an event`);
  check(!JSON.stringify(await events(page)).includes(CODE), `${label}: access code stored in local telemetry`);
  await ctx.close();
}

// 2. Pitch link: both parts scrubbed, the code still reaches /screen, no telemetry
{
  const { ctx, page } = await openApp(browser, { hash: `#edition=pitch&code=${CODE}` });
  await page.getByRole("heading", { name: "Screened ideas" }).waitFor();
  const href = await page.evaluate(() => location.href);
  check(!href.includes(CODE) && !href.includes("edition="), `pitch: fragment not scrubbed (${href})`);
  const seen = await useStubProxy(page, { screen: () => ({ status: 200, body: REPORT }) });
  await page.locator("[data-control=nav_screen]").click();
  await runIdea(page);
  check(seen.screenHeaders[0] === CODE, `pitch: /screen header was ${seen.screenHeaders[0]}`);
  await flush(page);
  check(seen.eventBodies.length === 0, "pitch: events were uploaded");
  await ctx.close();
}

// 3. Daily cap: 429 → friendly message on Screen an idea, idea kept, run_failed with code daily_cap
{
  const { ctx, page } = await visitor(`#code=${CODE}`, () => ({ status: 429, body: { error: "daily_cap", message: "paused" } }));
  await runIdea(page);
  check(await page.getByText("VistaDex has reached today's limit").isVisible(), "daily-cap message not shown");
  check((await page.locator("#field-pitch").inputValue()) === IDEA_FIELDS.pitch, "idea text lost after the daily cap");
  const failed = (await events(page)).find(e => e.type === "run_failed");
  check(failed?.payload.code === "daily_cap", "run_failed not fired with code daily_cap");
  await ctx.close();
}

// 4. Link without a code: 401 → friendly message, run_failed
{
  const { ctx, page, seen } = await visitor("", () => ({ status: 401, body: { error: "access_code_required" } }));
  await runIdea(page);
  check(seen.screenHeaders[0] === null, "a code was sent although the link had none");
  check(await page.getByText("This link is missing its access code").isVisible(), "401 message not shown");
  check((await events(page)).some(e => e.type === "run_failed" && e.payload.code === "access"), "run_failed not fired on 401");
  await ctx.close();
}

await browser.close();
if (problems.length) { console.error("ACCESS E2E FAILED:\n- " + problems.join("\n- ")); process.exit(1); }
console.log(`ACCESS E2E OK against ${BASE}: #code= and #edition= read and scrubbed; header on /screen, body field on /events (never in events); pitch uploads nothing; 401 and daily-cap 429 shown in plain language with run_failed.`);
