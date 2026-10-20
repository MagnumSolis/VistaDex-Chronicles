// ── a11y.mjs — Accessibility pass over every screen and state, both editions ──
// 1. axe-core (WCAG 2.2 A + AA rules) on each state at 1280, 375, 360 and 320 px.
// 2. No horizontal scrolling at any of those widths.
// 3. Keyboard-only flow with visible focus: Welcome → form → Run → report → breakdown → Reports dialog.
// 4. prefers-reduced-motion: no running CSS animations or transitions.
// Usage: node scripts/a11y.mjs   (dev server on :5173 or VD_BASE=<url>, installed Chrome). Exit 1 on failure.
import fs from "node:fs";
import { createRequire } from "node:module";
import { BASE, fillIdea, IDEA_FIELDS, launch, openApp, runIdea, setProxy, STUB } from "./lib.mjs";

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
const go = (page, hash) => page.evaluate(h => { location.hash = h; }, hash);

const VIEWPORTS = [["1280", { width: 1280, height: 900 }, false], ["375", { width: 375, height: 812 }, true], ["360", { width: 360, height: 780 }, true], ["320", { width: 320, height: 640 }, true]];

// ── 1 + 2: public edition ──
for (const [name, viewport, isMobile] of VIEWPORTS) {
  const { ctx, page } = await openApp(browser, { viewport, isMobile, hash: "#/" });
  await page.getByRole("heading", { name: /already died once/ }).waitFor();
  await both(page, `${name} home`);
  await go(page, "#/contact");
  await page.getByRole("heading", { name: "Talk to the team" }).waitFor();
  await both(page, `${name} contact (before notice)`);
  await go(page, "#/screen");
  await page.getByRole("heading", { name: /See the evidence/ }).waitFor();
  await both(page, `${name} welcome`);
  await page.getByRole("button", { name: "Start with walkthrough" }).click();
  await page.getByRole("heading", { name: "Start from a sample" }).waitFor();
  await both(page, `${name} screen + walkthrough`);
  await page.locator("[data-control=walkthrough_skip]").click();
  await page.getByRole("button", { name: /^Run$/ }).click(); // empty form → error summary
  await page.getByRole("alert").waitFor();
  await both(page, `${name} screen required-field errors`);
  await page.route(`${STUB}/**`, r => r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "daily_cap" }), headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-VistaDex-Access" } }));
  await setProxy(page, STUB);
  await runIdea(page);
  await both(page, `${name} screen daily-cap message`);
  await setProxy(page, "");
  await page.locator("[data-control=industry_toggle][data-control-value=Fintech]").click();
  await page.locator("[data-control=role_select][data-control-value=founder]").click();
  await page.getByRole("button", { name: /^Run$/ }).click();
  await page.getByRole("heading", { name: "Screening your idea" }).waitFor();
  await both(page, `${name} running`);
  await page.getByRole("heading", { name: "Your report" }).waitFor({ timeout: 20000 });
  await page.locator("[data-control=score_breakdown_toggle]").click();
  await both(page, `${name} report + breakdown`);
  await go(page, "#/reports");
  await page.getByText("Ideas analysed").waitFor();
  await both(page, `${name} reports`);
  await page.locator("[data-control=reports_filter_band]").selectOption("high");
  await both(page, `${name} reports no match`);
  await page.locator("[data-control=reports_clear]").click();
  await page.getByRole("dialog").waitFor();
  await both(page, `${name} clear-reports dialog`);
  await page.locator("[data-control=reports_clear_confirm]").click();
  await page.getByText("No reports yet").waitFor();
  await both(page, `${name} reports empty`);
  await page.locator("[data-control=reports_samples]").selectOption("15");
  await page.getByText("Sample report", { exact: true }).first().waitFor();
  await both(page, `${name} reports with 15 samples`);
  await page.getByRole("button", { name: "Open report: TidyNow" }).click();
  await page.getByText(/^Sample report ·/).waitFor();
  await page.getByRole("button", { name: /Show sources/ }).first().focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /Hide sources/ }).first().waitFor();
  await both(page, `${name} sample report`);
  await go(page, "#/how-it-works");
  await page.getByRole("heading", { name: "Evidence first. You decide." }).waitFor();
  await both(page, `${name} how it works`);
  await go(page, "#/feedback");
  await page.getByRole("heading", { name: "What did you think?" }).waitFor();
  await page.locator("[data-control=feedback_submit]").click();
  await both(page, `${name} feedback validation`);
  await go(page, "#/welcome");
  await page.getByRole("button", { name: "Delete my session" }).click();
  await page.getByRole("dialog").waitFor();
  await both(page, `${name} delete-session dialog`);
  await page.keyboard.press("Escape");
  await go(page, "#/running");
  await page.getByRole("heading", { name: "Nothing is running" }).waitFor();
  await both(page, `${name} running empty`);
  await go(page, "#/report/missing");
  await both(page, `${name} report not found`);
  await go(page, "#/nowhere");
  await both(page, `${name} not found`);
  await ctx.close();
}

// ── pitch edition ──
for (const [name, viewport, isMobile] of [VIEWPORTS[0], VIEWPORTS[2], VIEWPORTS[3]]) {
  const { ctx, page } = await openApp(browser, { viewport, isMobile, hash: "#edition=pitch" });
  await page.getByRole("heading", { name: "Screened ideas" }).waitFor();
  await both(page, `${name} pitch reports`);
  await page.locator("[data-control=reports_open]").first().click();
  await page.getByRole("heading", { name: "Your report" }).or(page.getByText("Demo idea", { exact: false }).first()).first().waitFor();
  await page.getByRole("button", { name: /Show sources/ }).first().click();
  await page.locator("[data-control=score_breakdown_toggle]").click();
  await both(page, `${name} pitch demo report`);
  await go(page, "#/reports");
  await page.locator("[data-control=reports_samples]").selectOption("5");
  await page.getByText("Sample report", { exact: true }).first().waitFor();
  await both(page, `${name} pitch reports with samples`);
  await go(page, "#/");
  await page.getByRole("heading", { name: /already died once/ }).waitFor();
  await both(page, `${name} pitch home`);
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
  const tabTo = async (pred, label, max = 120) => {
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
  for (const k of ["title", "pitch", "problem", "solution"]) {
    await tabTo(f => f.id === `field-${k}`, `field ${k}`);
    await page.keyboard.type(IDEA_FIELDS[k]);
  }
  await tabTo(f => f.control === "industry_toggle", "industry chip");
  await page.keyboard.press("Space");
  await tabTo(f => f.control === "run_screening", "Run");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Your report" }).waitFor({ timeout: 20000 });
  await tabTo(f => f.control === "report_section_jump" && /Objections/.test(f.text), "jump nav: Objections");
  await page.keyboard.press("Enter");
  const afterJump = await focused();
  if (afterJump.id !== "section-objections-title") problems.push(`[keyboard] jump nav did not move focus to the Objections heading (on "${afterJump.text}")`);
  await go(page, "#/reports");
  await page.getByText("Ideas analysed").waitFor();
  await tabTo(f => f.control === "reports_clear", "Clear my reports");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const back = await focused();
  if (back.control !== "reports_clear") problems.push(`[keyboard] focus did not return to "Clear my reports" after closing its dialog (on "${back.text}")`);
  await ctx.close();
}

// ── 4: reduced motion ──
{
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "#/screen");
  await page.getByRole("button", { name: "Skip to the tool" }).click();
  await fillIdea(page);
  await page.getByRole("button", { name: /^Run$/ }).click();
  await page.getByRole("heading", { name: "Screening your idea" }).waitFor();
  const moving = await page.evaluate(() => document.getAnimations().filter(a => (a.effect?.getTiming?.().duration ?? 0) > 1).length);
  if (moving) problems.push(`[motion] ${moving} animation(s) still run with prefers-reduced-motion: reduce`);
  await ctx.close();
}

await browser.close();
if (problems.length) { console.error(`A11Y: ${problems.length} problem(s)\n- ` + problems.join("\n- ")); process.exit(1); }
console.log("A11Y OK: axe (WCAG 2.2 A/AA) clean on every screen and state at 1280/375/360/320 px in both editions; no horizontal scroll; keyboard-only flow with visible focus; no animation under reduced motion.");
