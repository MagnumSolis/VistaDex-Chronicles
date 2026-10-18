// ── shots.mjs — Full-resolution screenshots of the dev server using the installed Chrome ──
// Usage: node scripts/shots.mjs <outDir>   (dev server must be running on :5174)
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const out = path.resolve(process.argv[2] || "screenshots");
fs.mkdirSync(out, { recursive: true });
const BASE = "http://localhost:5174/";
const IDEA = "We are building an AI-powered legal contract review tool for early-stage startups. No such tool exists today that combines LLM-based review with a human lawyer backstop at under $200/month. The legal-tech market is worth $27B globally. Big law firms cannot easily replicate this because their cost structure requires billing by hour.";
const VIEWPORTS = { desktop: { width: 1280, height: 900, deviceScaleFactor: 1 }, phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };

const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const [name, vp] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.error(`[${name}] page error:`, e.message));

  // 1. Mock run as a consenting participant (agreement row visible); evidence of claim 1 opened.
  await page.goto(BASE);
  await page.evaluate(async () => { localStorage.clear(); const s = await import("/src/study/controller.ts"); s.giveConsent(); s.logTrustPre(4); });
  await page.fill("#ideaInput", IDEA);
  await page.click("text=Run pipeline");
  await page.waitForSelector("text=Screening report", { timeout: 15000 });
  await page.getByRole("button", { name: "Show evidence & reasoning" }).first().click();
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `${name}-report-mock.png`), fullPage: true });

  // 2. Style sample: demo cohort report with all four statuses, sources and a lead.
  await page.goto(`${BASE}?demo=idea-07`);
  await page.waitForSelector("text=Screening report");
  const show = page.getByRole("button", { name: "Show evidence & reasoning" });
  while (await show.count()) await show.first().click();
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `${name}-report-demo-statuses.png`), fullPage: true });
  await ctx.close();
}
await browser.close();
console.log("screenshots in", out);
