// ── a11y.mjs — Accessibility pass for every screen and study surface ──
// 1. axe-core (WCAG 2.x A + AA rules) on each UI state, desktop and phone.
// 2. Keyboard-only participant flow: consent → trust → idea → run → evidence → rating → survey.
// 3. No horizontal scrolling at 320 and 375 px.
// Usage: node scripts/a11y.mjs   (dev server on :5173 or VD_BASE=<url>, installed Chrome). Exit 1 on failure.
import { chromium } from "playwright-core";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.VD_BASE || "http://localhost:5173/";
const IDEA = "We are building an AI-powered legal contract review tool for early-stage startups. No such tool exists today that combines LLM-based review with a human lawyer backstop at under $200/month. The legal-tech market is worth $27B globally.";
const problems = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function axe(page, label) {
  await page.waitForTimeout(250);
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations
    .map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map(n => n.target.join(" ")) })));
  for (const v of res) problems.push(`[axe ${label}] ${v.id} (${v.impact}): ${v.help} — ${v.nodes.join(" | ")}`);
  return res.length;
}

async function noHorizontalScroll(page, label) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (sw > iw + 1) problems.push(`[overflow ${label}] page is ${sw}px wide in a ${iw}px viewport`);
}

// ── 1 + 3: axe on every state, desktop and phone; overflow at 320/375 ──
for (const [name, vp] of [["desktop", { width: 1280, height: 900 }], ["phone-375", { width: 375, height: 812 }], ["phone-320", { width: 320, height: 640 }]]) {
  const page = await browser.newPage({ viewport: vp });
  const nav = re => page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: re });
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.getByRole("heading", { name: "Cohort dashboard" }).waitFor();
  await axe(page, `${name} dashboard`); await noHorizontalScroll(page, `${name} dashboard`);
  await page.getByRole("button", { name: /View report/ }).first().click();
  await page.getByRole("dialog").waitFor();
  await axe(page, `${name} demo dialog`);
  await page.keyboard.press("Escape");
  await nav(/Screen/).click();
  await page.getByRole("dialog").waitFor();
  await axe(page, `${name} consent`);
  await page.getByRole("button", { name: "I agree — take part" }).click();
  await page.locator("#trustPreInput").waitFor();
  await axe(page, `${name} screen + trust`); await noHorizontalScroll(page, `${name} screen`);
  await page.locator("#trustPreInput").fill("4");
  await page.fill("#ideaInput", IDEA);
  await page.getByRole("button", { name: "Run pipeline" }).click();
  await page.getByText("Screening report").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Show evidence" }).first().click();
  await axe(page, `${name} report + survey`); await noHorizontalScroll(page, `${name} report`);
  await page.getByRole("button", { name: "Withdraw & delete my data" }).click();
  await page.getByRole("dialog").waitFor();
  await axe(page, `${name} withdraw dialog`);
  await page.getByRole("button", { name: "Cancel" }).click();
  await nav(/Graveyard/).click();
  await axe(page, `${name} graveyard`); await noHorizontalScroll(page, `${name} graveyard`);
  await page.close();
}

// ── 2: keyboard-only participant flow ──
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.getByRole("heading", { name: "Cohort dashboard" }).waitFor();
  const focused = () => page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    const ring = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== "none";
    return { tag: el.tagName, text: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 40), id: el.id, ring };
  });
  const tabTo = async (pred, label, max = 60) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press("Tab");
      const f = await focused();
      if (pred(f)) { if (!f.ring) problems.push(`[keyboard] no visible focus indicator on ${label}`); return f; }
    }
    problems.push(`[keyboard] could not reach ${label} with Tab`);
    return null;
  };
  // Skip link is the first stop.
  await page.keyboard.press("Tab");
  const first = await focused();
  if (!/Skip to content/.test(first.text)) problems.push(`[keyboard] first Tab stop is "${first.text}", expected the skip link`);
  await tabTo(f => /^Screen/.test(f.text), "nav: Screen an idea");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  // Consent: Esc must not dismiss it; focus stays inside.
  await page.keyboard.press("Escape");
  if (!(await page.getByRole("dialog").isVisible())) problems.push("[keyboard] Esc dismissed the consent dialog");
  await tabTo(f => /I agree/.test(f.text), "consent: I agree");
  await page.keyboard.press("Enter");
  await tabTo(f => f.id === "trustPreInput", "pre-use trust slider");
  await page.keyboard.press("ArrowRight");
  const preLogged = await page.evaluate(() => (JSON.parse(localStorage.getItem("vistadex.study.v1")).events || []).some(e => e.type === "trust_pre"));
  if (!preLogged) problems.push("[keyboard] arrow key on the pre-use slider did not record trust_pre");
  await tabTo(f => f.id === "ideaInput", "idea text");
  await page.keyboard.type(IDEA);
  await tabTo(f => /Run pipeline/.test(f.text), "Run pipeline");
  await page.keyboard.press("Enter");
  await page.getByText("Screening report").waitFor({ timeout: 15000 });
  await tabTo(f => /Show evidence/.test(f.text), "Show evidence");
  await page.keyboard.press("Enter");
  if (!(await page.getByRole("button", { name: "Hide evidence" }).first().isVisible())) problems.push("[keyboard] Enter did not open the evidence");
  await tabTo(f => f.text === "Agree", "agreement: Agree");
  await page.keyboard.press("Space");
  await tabTo(f => f.id === "trustPostInput", "post-use trust slider", 120);
  await page.keyboard.press("End");
  for (let item = 0; item < 5; item++) {
    await tabTo(f => f.tag === "INPUT" && f.id === "", `survey item ${item + 1}`);
    await page.keyboard.press("ArrowRight"); // radio group: arrow selects
  }
  await tabTo(f => f.text === "Submit", "Submit");
  await page.keyboard.press("Enter");
  if (!(await page.getByText("Thank you").isVisible())) problems.push("[keyboard] survey could not be submitted by keyboard");
  const types = await page.evaluate(() => JSON.parse(localStorage.getItem("vistadex.study.v1")).events.map(e => e.type));
  for (const t of ["consent_given", "trust_pre", "run_started", "run_completed", "claim_expanded", "claim_rating", "trust_post", "survey_submitted"]) {
    if (!types.includes(t)) problems.push(`[keyboard] flow did not record ${t}`);
  }
  // Demo dialog: Esc closes it and focus returns to the trigger.
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /Cohort|Dashboard/ }).click();
  await page.getByRole("button", { name: /View report/ }).first().focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400); // focus returns after the close animation
  const back = await focused();
  if (!/View report/.test(back.text)) problems.push(`[keyboard] focus did not return to "View report" after closing the dialog (on "${back.text}")`);
  await page.close();
}

await browser.close();
if (problems.length) { console.error(`A11Y: ${problems.length} problem(s)\n- ` + problems.join("\n- ")); process.exit(1); }
console.log("A11Y OK: axe (WCAG 2.2 A/AA rules) clean on all states at 1280/375/320 px; keyboard-only flow complete with visible focus; no horizontal scroll.");
