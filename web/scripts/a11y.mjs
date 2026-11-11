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
  // clientWidth, not innerWidth: on a phone (isMobile) Chrome widens the layout viewport to fit an
  // over-wide page, so innerWidth grows with it and hides the overflow.
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth }));
  if (sw > iw + 1) problems.push(`[overflow ${label}] page is ${sw}px wide in a ${iw}px viewport`);
}
// Folder-tab titles (.tab-notch) must fit inside their tab: a wrapped title must not spill onto the panel.
async function tabs(page, label) {
  const spill = await page.evaluate(() => [...document.querySelectorAll(".tab-notch")].filter(t => t.getClientRects().length && t.scrollHeight > t.clientHeight + 1).map(t => t.textContent.trim()));
  for (const t of spill) problems.push(`[tab ${label}] "${t}" overflows its folder tab onto the panel`);
}
const both = async (page, label) => { await axe(page, label); await overflow(page, label); await tabs(page, label); };
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
  await ctx.route(/^https:\/\/[^/]*workers\.dev\//, r => r.abort("blockedbyclient")); // never the deployed Worker
  const page = await ctx.newPage();
  await page.goto(BASE + "#/screen");
  await setProxy(page, "");
  await page.getByRole("button", { name: "Skip to the tool" }).click();
  await fillIdea(page);
  await page.getByRole("button", { name: /^Run$/ }).click();
  await page.getByRole("heading", { name: "Screening your idea" }).waitFor();
  const moving = await page.evaluate(() => document.getAnimations().filter(a => (a.effect?.getTiming?.().duration ?? 0) > 1).length);
  if (moving) problems.push(`[motion] ${moving} animation(s) still run with prefers-reduced-motion: reduce`);
  await ctx.close();
}

// ── 5: report jump nav — every section, both editions ──
// After a click the section heading is fully visible (not under the sticky header or chip bar) and the
// clicked item is the highlighted one, during the smooth scroll and after it.
{
  // Resolves once scrollY has not changed for 300ms (the smooth scroll has landed).
  const settled = page => page.evaluate(() => new Promise(r => { let y = -1; const t = setInterval(() => { if (scrollY === y) { clearInterval(t); r(); } y = scrollY; }, 300); }));
  // What is drawn over the heading's top and bottom edge (null when the heading itself is on top).
  const covered = (page, id) => page.evaluate(id => {
    const el = document.getElementById(`section-${id}-title`), h = el.getBoundingClientRect();
    const over = [h.top + 2, h.bottom - 2].map(y => document.elementFromPoint(h.left + 4, y)).find(hit => !el.contains(hit));
    return over === undefined ? null : `${over ? over.tagName.toLowerCase() + (over.getAttribute("aria-label") ? `[${over.getAttribute("aria-label")}]` : "") : "nothing (off screen)"} at y=${Math.round(h.top)}`;
  }, id);
  const activeItem = page => page.evaluate(() => document.querySelector("[data-control=report_section_jump][aria-current=location]")?.dataset.controlValue ?? null);
  async function jumpNav(page, label) {
    const ids = await page.$$eval("[data-control=report_section_jump]", els => els.map(e => e.dataset.controlValue));
    for (const id of ids) {
      await page.locator(`[data-control=report_section_jump][data-control-value=${id}]`).click();
      const during = await activeItem(page);
      await settled(page);
      const after = await activeItem(page);
      if (during !== id || after !== id) problems.push(`[jump ${label}] clicked "${id}", highlighted "${during}" while scrolling and "${after}" after`);
      const over = await covered(page, id);
      if (over) problems.push(`[jump ${label}] the "${id}" heading is covered: ${over}`);
    }
  }
  for (const [name, viewport, isMobile] of [VIEWPORTS[0], ["820", { width: 820, height: 1000 }, false], VIEWPORTS[1], VIEWPORTS[2]]) {
    for (const edition of ["public", "pitch"]) {
      const { ctx, page } = await openApp(browser, { viewport, isMobile, hash: edition === "pitch" ? "#edition=pitch" : "#/screen" });
      if (edition === "public") await page.getByRole("button", { name: "Skip to the tool" }).click();
      await go(page, "#/reports");
      await page.locator("[data-control=reports_samples]").selectOption("5");
      await page.getByText("Sample report", { exact: true }).first().waitFor();
      await go(page, "#/report/sample-student-bank");
      await page.getByRole("heading", { name: "CampusBank", level: 1 }).waitFor();
      await jumpNav(page, `${name} ${edition}`);
      await ctx.close();
    }
  }
}

// Scrolled to the bottom by hand (wheel), the last section is current even where it can't reach the top
// (a tall window, little content below it): every demo and sample report in the pitch edition.
{
  const { ctx, page } = await openApp(browser, { viewport: { width: 1280, height: 1400 }, hash: "#edition=pitch" });
  await go(page, "#/reports");
  await page.locator("[data-control=reports_samples]").selectOption("15");
  await page.getByText("Sample report", { exact: true }).first().waitFor();
  const ids = await page.evaluate(async () => (await import("/src/lib/reports.ts")).listedEntries().filter(e => e.kind !== "session").map(e => e.id));
  for (const id of ids) {
    await go(page, `#/report/${id}`);
    await page.locator("#section-market").waitFor();
    await page.waitForFunction(() => scrollY === 0); // the route's own scroll to the top has happened
    await page.mouse.move(640, 700);
    for (let i = 0; i < 40 && !(await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2)); i++) await page.mouse.wheel(0, 1200);
    const ok = await page.waitForFunction(() => document.querySelector("[data-control=report_section_jump][aria-current=location]")?.dataset.controlValue === "market", null, { timeout: 2000 }).then(() => true, () => false);
    if (!ok) problems.push(`[jump 1280x1400 pitch] ${id}: scrolled to the bottom, "${await page.evaluate(() => document.querySelector("[aria-current=location]")?.dataset.controlValue)}" is current, not "market"`);
  }
  await ctx.close();
}

// ── 6: top of the report — nothing under the sticky header, Summary card text left-aligned ──
{
  const settled = page => page.evaluate(() => new Promise(r => { let y = -1; const t = setInterval(() => { if (scrollY === y) { clearInterval(t); r(); } y = scrollY; }, 300); }));
  // "visible": the eyebrow and title are fully on screen below the sticky header; "partly": the header
  // covers part of them; "scrolled past": entirely above it.
  const titleState = page => page.evaluate(() => {
    const hdr = document.querySelector("header.sticky");
    const below = hdr && getComputedStyle(hdr).display !== "none" ? hdr.getBoundingClientRect().bottom : 0;
    const top = document.querySelector("main header p").getBoundingClientRect().top, bottom = document.querySelector("main h1").getBoundingClientRect().bottom;
    return top >= below ? "visible" : bottom <= below ? "scrolled past" : `partly under the header (top ${Math.round(top)}, header ends ${Math.round(below)})`;
  });
  const summaryAligned = page => page.evaluate(() => [...document.querySelectorAll("#section-summary dl:first-of-type dd")].every(dd => ["start", "left"].includes(getComputedStyle(dd).textAlign)));
  for (const [name, viewport, isMobile] of [VIEWPORTS[0], ["1280x720", { width: 1280, height: 720 }, false], ["820", { width: 820, height: 1000 }, false], VIEWPORTS[1], VIEWPORTS[2]]) {
    // Arriving from Screen an idea, with and without the walkthrough.
    for (const tour of [false, true]) {
      const { ctx, page } = await openApp(browser, { viewport, isMobile });
      await page.getByRole("button", { name: tour ? "Start with walkthrough" : "Skip to the tool" }).click();
      await fillIdea(page);
      await page.getByRole("button", { name: /^Run$/ }).click();
      await page.getByRole("heading", { name: "Your report" }).waitFor({ timeout: 20000 });
      await settled(page);
      const state = await titleState(page);
      // The tour may scroll to the score only where it doesn't fit under the title (phones, short windows),
      // and then all the way, never leaving the title half under the header.
      const mayScroll = tour && ["1280x720", "375", "360"].includes(name);
      if (mayScroll ? state.startsWith("partly") : state !== "visible") problems.push(`[top ${name}${tour ? " tour" : ""}] arriving from Screen an idea: title ${state}`);
      if (tour && await page.locator("[data-testid=tour-card]").evaluate(c => { const r = c.getBoundingClientRect(); return r.top < 0 || r.bottom > innerHeight; })) problems.push(`[top ${name} tour] the tour card is not fully on screen`);
      if (!tour) {
        // Fresh load of the same report, then the Summary jump.
        await page.reload();
        await page.getByRole("heading", { name: "Your report" }).waitFor();
        if ((await titleState(page)) !== "visible") problems.push(`[top ${name}] fresh load: title ${await titleState(page)}`);
        if (!(await summaryAligned(page))) problems.push(`[top ${name}] Summary card meta text is not left-aligned`);
        await page.locator("[data-control=report_section_jump][data-control-value=claims]").click();
        await settled(page);
        await page.locator("[data-control=report_section_jump][data-control-value=summary]").click();
        await settled(page);
        if ((await titleState(page)) !== "visible") problems.push(`[top ${name}] after the Summary jump: title ${await titleState(page)}`);
      }
      await ctx.close();
    }
    // Every sample report (and, in pitch, every demo report): alignment and title on open.
    for (const edition of ["public", "pitch"]) {
      const { ctx, page } = await openApp(browser, { viewport, isMobile, hash: edition === "pitch" ? "#edition=pitch" : "#/screen" });
      if (edition === "public") await page.getByRole("button", { name: "Skip to the tool" }).click();
      await go(page, "#/reports");
      await page.locator("[data-control=reports_samples]").selectOption("15");
      await page.getByText("Sample report", { exact: true }).first().waitFor();
      const ids = await page.evaluate(async () => (await import("/src/lib/reports.ts")).listedEntries().filter(e => e.kind !== "session").map(e => e.id));
      for (const id of ids) {
        await go(page, `#/report/${id}`);
        await page.locator("#section-summary").waitFor();
        await settled(page);
        if (!(await summaryAligned(page))) problems.push(`[top ${name} ${edition}] ${id}: Summary card meta text is not left-aligned`);
        if ((await titleState(page)) !== "visible") problems.push(`[top ${name} ${edition}] ${id}: title ${await titleState(page)}`);
        await go(page, "#/reports");
        await page.getByText("Sample report", { exact: true }).first().waitFor();
      }
      await ctx.close();
    }
  }
}

// ── 7: phone header — fits at 320/360/375, 44px targets, named, visible focus ──
for (const w of [320, 360, 375]) {
  for (const edition of ["public", "pitch"]) {
    const { ctx, page } = await openApp(browser, { viewport: { width: w, height: 700 }, isMobile: true, hash: edition === "pitch" ? "#edition=pitch" : "#/" });
    await page.locator("main h1").first().waitFor();
    await overflow(page, `${w} ${edition} phone header`);
    const controls = await page.evaluate(() => [...document.querySelectorAll("header")].filter(h => !h.closest("main") && getComputedStyle(h).display !== "none")
      .flatMap(h => [...h.querySelectorAll("a, button")]).map(el => {
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
        return { name, w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), control: el.dataset.control };
      }));
    for (const c of controls) {
      if (c.control === "nav_home") continue; // the wordmark is a text link, not a tap button
      if (c.w < 44 || c.h < 44) problems.push(`[header ${w} ${edition}] "${c.name}" is ${c.w}x${c.h}px (< 44px)`);
      if (!c.name) problems.push(`[header ${w} ${edition}] a header control has no accessible name`);
    }
    if (edition === "public") {
      const fb = page.locator("header [data-control=header_feedback]").last();
      if ((await fb.getAttribute("aria-label")) !== "Feedback" && (await fb.innerText()).trim() !== "Feedback") problems.push(`[header ${w}] the Feedback control is not named "Feedback"`);
      await fb.focus();
      await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab"); // keyboard focus, so :focus-visible applies
      const ring = await fb.evaluate(el => { const s = getComputedStyle(el); return document.activeElement === el && ((s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none"); });
      if (!ring) problems.push(`[header ${w}] the Feedback control has no visible focus style`);
    }
    await ctx.close();
  }
}

await browser.close();
if (problems.length) { console.error(`A11Y: ${problems.length} problem(s)\n- ` + problems.join("\n- ")); process.exit(1); }
console.log("A11Y OK: axe (WCAG 2.2 A/AA) clean on every screen and state at 1280/375/360/320 px in both editions; no horizontal scroll; keyboard-only flow with visible focus; no animation under reduced motion.");
