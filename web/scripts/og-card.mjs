// Renders the LinkedIn / X link-preview card (scripts/og-card.html) to public/og-card.png, 1200 x 630.
// Run after changing the card: npm --prefix web run og-card. Needs a Chromium (npx playwright-core install
// chromium) or Chrome (VD_CHROME=1).
import { chromium } from "playwright-core";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../public/og-card.png");
mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch(process.env.VD_CHROME ? { channel: "chrome" } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(here, "og-card.html")).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out, type: "png" });
await browser.close();
console.log(`wrote ${out}`);
