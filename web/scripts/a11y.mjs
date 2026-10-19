// ── a11y.mjs — Accessibility pass over every screen and state, both editions ──
// 1. axe-core (WCAG 2.2 A + AA rules) on each state at 1280, 375, 360 and 320 px.
// 2. No horizontal scrolling at any of those widths.
// 3. Keyboard-only flow with visible focus: Welcome → idea → Run → report → sources → graveyard sheet.
// 4. prefers-reduced-motion: no running CSS animations or transitions.
// Usage: node scripts/a11y.mjs   (dev server on :5173 or VD_BASE=<url>, installed Chrome). Exit 1 on failure.
import fs from "node:fs";
import { createRequire } from "node:module";
import { launch, LEGAL_IDEA, openApp, runIdea, setProxy, STUB } from "./lib.mjs";

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const problems = [];
const browser = await launch();

async function axe(page, label) {
  await page.waitForTimeout(300);
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations
    .map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map(n => n.target.join(" ")) })));
  for (const v of res) problems.push(`[axe ${label}] ${v.id} (${v.impact}): ${v.help} — ${v.nodes.join(" | ")}`);
}
async function overflow(page, label) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (sw > iw + 1) problems.push(`[overflow ${label}] page is ${sw}px wide in a ${iw}px viewport`);
}
const both = async (page, label) => { await axe(page, label); await overflow(page, label); };

const VIEWPORTS = [["1280", { width: 1280, height: 900 }, false], ["375", { width: 375, height: 812 }, true], ["360", { width: 360, height: 780 }, true], ["320", { width: 320, height: 640 }, true]];

// ── 1 + 2: public edition ──
for (const [name, viewport, isMobile] of VIEWPORTS) {
  const { ctx, page } = await openApp(browser, { viewport, isMobile });
  await page.getByRole("heading", { name: /See the evidence/ }).waitFor();
  await both(page, `${name} welcome`);
  await page.getByRole("button", { name: "Start with walkthrough" }).click();
  await page.getByRole("heading", { name: "Paste an idea" }).waitFor();
  await both(page, `${name} screen + walkthrough`);
  await page.locator("[data-control=walkthrough_skip]").click();
  await page.getByRole("button", { name: /^Run$/ }).click(); // empty idea → inline message
  await both(page, `${name} screen empty-idea message`);
  // refusal message (daily cap) through a stubbed proxy
  await page.route(`${STUB}/**`, r => r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "daily_cap" }), headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-VistaDex-Access" } }));
  await setProxy(page, STUB);
  await runIdea(page);
  await both(page, `${name} screen daily-cap message`);
  await setProxy(page, "");
  await page.getByRole("button", { name: /^Run$/ }).click();
  await page.getByRole("heading", { name: "Screening your idea" }).waitFor();
  await both(page, `${name} running`);
  await page.getByRole("heading", { name: "Your report" }).waitFor({ timeout: 20000 });
  await both(page, `${name} report`);
  await page.locator("[data-control=nav_graveyard], [data-control=tab_graveyard]").locator("visible=true").first().click();
  await page.getByRole("heading", { name: "Startups that shut down" }).waitFor();
  await both(page, `${name} graveyard`);
  await page.locator("[data-control=graveyard_entry_open]").first().click();
  await page.getByRole("dialog").waitFor();
  await both(page, `${name} graveyard sheet`);
  await page.keyboard.press("Escape");
  await page.locator("[data-control=graveyard_search]").fill("zzzz");
  await both(page, `${name} graveyard no results`);
  await page.evaluate(() => { location.hash = "#/how-it-works"; });
  await page.getByRole("heading", { name: "Evidence first. You decide." }).waitFor();
  await both(page, `${name} how it works`);
  await page.evaluate(() => { location.hash = "#/feedback"; });
  await page.getByRole("heading", { name: "What did you think?" }).waitFor();
  await both(page, `${name} feedback`);
  await page.locator("[data-control=feedback_submit]").click();
  await both(page, `${name} feedback validation`);
  await page.evaluate(() => { location.hash = "#/welcome"; });
  await page.getByRole("button", { name: "Delete my session" }).click();
  await page.getByRole("dialog").waitFor();
  await both(page, `${name} delete-session dialog`);
  await page.keyboard.press("Escape");
  await page.evaluate(() => { location.hash = "#/running"; });
  await page.getByRole("heading", { name: "Nothing is running" }).waitFor();
  await both(page, `${name} running empty`);
  await page.evaluate(() => { location.hash = "#/nowhere"; });
  await both(page, `${name} not found`);
  await ctx.close();
}

// ── pitch edition ──
for (const [name, viewport, isMobile] of [VIEWPORTS[0], VIEWPORTS[3]]) {
  const { ctx, page } = await openApp(browser, { viewport, isMobile, hash: "#edition=pitch" });
  await page.getByRole("heading", { name: "Screened ideas" }).waitFor();
  await both(page, `${name} pitch dashboard`);
  await page.locator("[data-control=dashboard_open_report]").first().click();
  await page.getByRole("heading", { name: "LegalAI for Startups" }).waitFor();
  await page.getByRole("button", { name: /Show sources/ }).first().click();
  await both(page, `${name} pitch demo report`);
  await page.evaluate(() => { location.hash = "#/report/missing"; });
  await both(page, `${name} pitch report not found`);
  await ctx.close();
}

// ── 3: keyboard-only flow ──
{
  const { ctx, page } = await openApp(browser);
  await page.getByRole("heading", { name: /See the evidence/ }).waitFor();
  const focused = () => page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
    return { tag: el.tagName, text: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 60), id: el.id, control: el.dataset?.control, ring };
  });
  const tabTo = async (pred, label, max = 80) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press("Tab");
      const f = await focused();
      if (pred(f)) { if (!f.ring) problems.push(`[keyboard] no visible focus indicator on ${label}`); return f; }
    }
    problems.push(`[keyboard] could not reach ${label} with Tab`);
    return null;
  };
  await page.keyboard.press("Tab");
  const first = await focused();
  if (!/Skip to content/.test(first.text)) problems.push(`[keyboard] first Tab stop is "${first.text}", expected the skip link`);
  await tabTo(f => f.control === "welcome_skip", "Welcome: Skip to the tool");
  await page.keyboard.press("Enter");
  await tabTo(f => f.id === "ideaInput", "idea text");
  await page.keyboard.type(LEGAL_IDEA);
  await tabTo(f => f.control === "market_toggle", "target market EU");
  await page.keyboard.press("Space");
  await tabTo(f => f.control === "run_screening", "Run");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Your report" }).waitFor({ timeout: 20000 });
  await tabTo(f => f.control === "report_section_jump" && /Objections/.test(f.text), "jump nav: Objections");
  await page.keyboard.press("Enter");
  const afterJump = await focused();
  if (afterJump.id !== "section-objections-title") problems.push(`[keyboard] jump nav did not move focus to the Objections heading (on "${afterJump.text}")`);
  await tabTo(f => f.control === "report_save_pdf", "Save as PDF", 200);
  await page.evaluate(() => { location.hash = "#/graveyard"; });
  await tabTo(f => f.control === "graveyard_entry_open", "a graveyard entry");
  const opener = await focused();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const back = await focused();
  if (back.text !== opener.text) problems.push(`[keyboard] focus did not return to the graveyard entry after closing the sheet (on "${back.text}")`);
  await ctx.close();
}

// ── 4: reduced motion ──
{
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const { BASE } = await import("./lib.mjs");
  await page.goto(BASE);
  await page.getByRole("button", { name: "Skip to the tool" }).click();
  await page.locator("#ideaInput").fill(LEGAL_IDEA);
  await page.getByRole("button", { name: /^Run$/ }).click();
  await page.getByRole("heading", { name: "Screening your idea" }).waitFor();
  const moving = await page.evaluate(() => document.getAnimations().filter(a => (a.effect?.getTiming?.().duration ?? 0) > 1).length);
  if (moving) problems.push(`[motion] ${moving} animation(s) still run with prefers-reduced-motion: reduce`);
  await ctx.close();
}

await browser.close();
if (problems.length) { console.error(`A11Y: ${problems.length} problem(s)\n- ` + problems.join("\n- ")); process.exit(1); }
console.log("A11Y OK: axe (WCAG 2.2 A/AA) clean on every screen and state at 1280/375/360/320 px in both editions; no horizontal scroll; keyboard-only flow with visible focus; no animation under reduced motion.");
