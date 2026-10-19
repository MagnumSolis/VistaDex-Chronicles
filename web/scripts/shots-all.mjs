// ── shots-all.mjs — Screenshots of every screen and state, both editions, desktop + phone ──
// Usage: node scripts/shots-all.mjs <outDir>   (dev server on :5173 or VD_BASE=<url>, installed Chrome)
import fs from "node:fs";
import path from "node:path";
import { launch, LEGAL_IDEA, openApp, setProxy, STUB } from "./lib.mjs";

const out = path.resolve(process.argv[2] || "screenshots");
fs.mkdirSync(out, { recursive: true });
const VIEWPORTS = { desktop: [{ width: 1280, height: 900 }, false], phone: [{ width: 360, height: 780 }, true] };
const browser = await launch();

for (const [name, [viewport, isMobile]] of Object.entries(VIEWPORTS)) {
  const shot = async (page, label, full = true) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${name}-${label}.png`), fullPage: full });
  };
  {
    const { ctx, page } = await openApp(browser, { viewport, isMobile });
    await page.getByRole("heading", { name: /See the evidence/ }).waitFor();
    await shot(page, "01-welcome");
    await page.getByRole("button", { name: "Start with walkthrough" }).click();
    await shot(page, "02-screen-walkthrough", false);
    await page.locator("[data-control=walkthrough_skip]").click();
    await page.route(`${STUB}/**`, r => r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "daily_cap" }), headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-VistaDex-Access" } }));
    await setProxy(page, STUB);
    await page.locator("#ideaInput").fill(LEGAL_IDEA);
    await page.getByRole("button", { name: /^Run$/ }).click();
    await page.getByText("VistaDex has reached today's limit").waitFor();
    await shot(page, "03-screen-daily-cap");
    await setProxy(page, "");
    await page.locator("[data-control=market_toggle][data-control-value=EU]").click();
    await page.getByRole("button", { name: /^Run$/ }).click();
    await page.getByRole("heading", { name: "Screening your idea" }).waitFor();
    await shot(page, "04-running", false);
    await page.getByRole("heading", { name: "Your report" }).waitFor({ timeout: 20000 });
    await shot(page, "05-report");
    await page.emulateMedia({ media: "print" });
    await shot(page, "06-report-print");
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => { location.hash = "#/graveyard"; });
    await page.getByRole("heading", { name: "Startups that shut down" }).waitFor();
    await shot(page, "07-graveyard");
    await page.locator("[data-control=graveyard_entry_open]").first().click();
    await shot(page, "08-graveyard-sheet", false);
    await page.keyboard.press("Escape");
    await page.evaluate(() => { location.hash = "#/how-it-works"; });
    await shot(page, "09-how-it-works");
    await page.evaluate(() => { location.hash = "#/feedback"; });
    await shot(page, "10-feedback");
    await ctx.close();
  }
  {
    const { ctx, page } = await openApp(browser, { viewport, isMobile, hash: "#edition=pitch" });
    await page.getByRole("heading", { name: "Screened ideas" }).waitFor();
    await shot(page, "11-pitch-dashboard");
    await page.locator("[data-control=dashboard_open_report]").first().click();
    await page.getByRole("button", { name: /Show sources/ }).first().click();
    await shot(page, "12-pitch-demo-report");
    await ctx.close();
  }
}
await browser.close();
console.log("screenshots in", out);
