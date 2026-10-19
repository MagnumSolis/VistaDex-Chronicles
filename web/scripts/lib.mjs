// ── lib.mjs — Shared helpers for the browser scripts (parity, a11y, access-e2e, shots) ──
// They drive the Vite dev server (default :5173, or VD_BASE=<url>) in an installed Chrome.
import { chromium } from "playwright-core";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const BASE = (process.env.VD_BASE || "http://localhost:5173/").replace(/\/?$/, "/");
export const contract = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../../tests/fixtures/event-contract.json", import.meta.url)), "utf8"));
export const LEGAL_IDEA = "We are building an AI-powered legal contract review tool for early-stage startups. No such tool exists today that combines LLM-based review with a human lawyer backstop at under $200/month. The legal-tech market is worth $27B globally.";
// The Screen an idea form's required fields (the legal idea split across them).
export const IDEA_FIELDS = {
  title: "LegalAI for Startups",
  pitch: "We are building an AI-powered legal contract review tool for early-stage startups.",
  problem: "No such tool exists today that combines LLM-based review with a human lawyer backstop at under $200/month.",
  solution: "The legal-tech market is worth $27B globally.",
};
const cfgPath = fileURLToPath(new URL("../../prototype/config.js", import.meta.url)).replace(/\\/g, "/");
const telPath = fileURLToPath(new URL("../../prototype/ui/telemetry.js", import.meta.url)).replace(/\\/g, "/");
export const STUB = "http://stub-proxy.test";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-VistaDex-Access", "Access-Control-Expose-Headers": "X-VistaDex-Trace-Id, X-VistaDex-Mode" };

export const launch = () => chromium.launch({ channel: "chrome", headless: true });

/** A fresh context (empty storage). Default: the public LinkedIn link (#/screen → Welcome first). */
export async function openApp(browser, { viewport = { width: 1280, height: 900 }, hash = "#/screen", isMobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: isMobile ? 2 : 1 });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.error("page error:", e.message));
  await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await page.goto(BASE + hash);
  return { ctx, page };
}

/** Points the running app at a stubbed proxy (same module instance the app uses). */
export async function useStubProxy(page, { screen = () => ({ status: 200, body: null }), onEvents = () => {} } = {}) {
  const seen = { screenHeaders: [], eventBodies: [] };
  await page.route(`${STUB}/screen`, async r => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    seen.screenHeaders.push(r.request().headers()["x-vistadex-access"] ?? null);
    const { status, body } = screen(JSON.parse(r.request().postData() || "{}"));
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { ...cors, "X-VistaDex-Trace-Id": "stub-trace", "X-VistaDex-Mode": "live" } });
  });
  await page.route(`${STUB}/events`, r => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    seen.eventBodies.push(r.request().postData()); onEvents(r.request().postData());
    return r.fulfill({ status: 200, body: "{}", headers: cors });
  });
  await setProxy(page, STUB);
  return seen;
}
export const setProxy = (page, url) => page.evaluate(async ([p, u]) => { (await import("/@fs/" + p)).CONFIG.PROXY_URL = u; }, [cfgPath, url]);
export const flush = page => page.evaluate(async p => (await import("/@fs/" + p)).flush(), telPath);
export const events = page => page.evaluate(() => JSON.parse(localStorage.getItem("vistadex.study.v1") || "{}").events || []);

export async function fillIdea(page, fields = IDEA_FIELDS) {
  for (const [k, v] of Object.entries(fields)) await page.locator(`#field-${k}`).fill(v);
}

/** Fills the form and presses Run; resolves when the report (or an error on Screen) is shown. */
export async function runIdea(page, fields = IDEA_FIELDS, { markets = [] } = {}) {
  await fillIdea(page, fields);
  for (const m of markets) await page.locator(`[data-control=market_toggle][data-control-value=${m}]`).click();
  await page.getByRole("button", { name: /^Run$/ }).click();
  await page.waitForFunction(() => location.hash === "#/report" || /^#\/report\//.test(location.hash) || (location.hash === "#/screen" && document.querySelector("[role=alert]")), null, { timeout: 20000 });
}
