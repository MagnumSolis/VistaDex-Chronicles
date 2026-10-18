// ── shots-all.mjs — Screenshots of every screen and study surface, desktop + phone ──
// Usage: node scripts/shots-all.mjs <outDir>   (dev server on :5174, installed Chrome)
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const out = path.resolve(process.argv[2] || "screenshots");
fs.mkdirSync(out, { recursive: true });
const BASE = "http://localhost:5174/";
const IDEA = "We are building an AI-powered legal contract review tool for early-stage startups. No such tool exists today that combines LLM-based review with a human lawyer backstop at under $200/month. The legal-tech market is worth $27B globally. Big law firms cannot easily replicate this because their cost structure requires billing by hour.";
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const [name, opts] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.error(`[${name}] page error:`, e.message));
  const shot = async (label, target) => {
    await page.waitForTimeout(350);
    const file = path.join(out, `${name}-${label}.png`);
    if (target) {
      // Element captures scroll the page; un-stick the top bar so it does not overlap the element.
      await page.evaluate(() => { const h = document.querySelector("header.sticky"); if (h) h.style.position = "static"; });
      await target.screenshot({ path: file });
      await page.evaluate(() => { const h = document.querySelector("header.sticky"); if (h) h.style.position = ""; });
    }
    else { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(150); await page.screenshot({ path: file, fullPage: true }); }
  };
  const nav = re => page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: re });

  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Dashboard + demo report dialog
  await page.getByRole("heading", { name: "Cohort dashboard" }).waitFor();
  await shot("1-dashboard");
  await page.getByRole("button", { name: /View report/ }).first().click();
  await page.waitForSelector("[role=dialog]");
  await shot("2-demo-report-dialog", page.locator("[role=dialog]"));
  await page.keyboard.press("Escape");

  // Consent
  await nav(/Screen/).click();
  await page.waitForSelector("text=Before you start");
  await shot("3-consent", page.getByRole("dialog"));
  await page.getByRole("button", { name: "I agree — take part" }).click();

  // Study bar + pre-use trust question (untouched, then answered)
  await page.waitForSelector("#trustPreInput");
  await shot("4-trust-pre-untouched", page.locator("main"));
  await page.locator("#trustPreInput").fill("5");

  // Run + report with agreement rows
  await page.fill("#ideaInput", IDEA);
  await page.getByRole("button", { name: "Run pipeline" }).click();
  await page.waitForSelector("text=Screening report", { timeout: 15000 });
  await page.getByRole("button", { name: "Show evidence" }).first().click();
  await page.getByRole("button", { name: "Disagree" }).first().click();
  await shot("5-screen-report");

  // Survey (filled) then thank-you
  const finish = page.locator("section[aria-labelledby=finish-title]");
  await page.locator("#trustPostInput").fill("4");
  for (const [i, fieldset] of (await finish.locator("fieldset").all()).entries()) await fieldset.locator("label").nth(i + 1).click();
  await shot("6-survey-filled", finish);
  await page.getByRole("button", { name: "Submit" }).click();
  await shot("7-thank-you", page.locator("text=Thank you").locator("xpath=.."));

  // Withdraw confirmation
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Withdraw & delete my data" }).click();
  await shot("8-withdraw-confirm", page.getByRole("dialog"));
  await page.getByRole("button", { name: "Cancel" }).click();

  // Graveyard DB
  await nav(/Graveyard/).click();
  await shot("9-graveyard");
  await ctx.close();
}
await browser.close();
console.log("screenshots in", out);
