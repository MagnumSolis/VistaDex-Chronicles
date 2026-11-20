// The research console can delete ticked sessions from the Sessions page too, and a tick survives the
// 30-second refresh (it lives in a store, not only in the re-rendered table).
import { test } from "node:test";
import assert from "node:assert/strict";
import { RESEARCH_PAGE } from "../worker/src/research-page.js";

const section = id => {
  const start = RESEARCH_PAGE.indexOf(`<section class="view" id="${id}">`);
  return RESEARCH_PAGE.slice(start, RESEARCH_PAGE.indexOf("</section>", start));
};

test("both Sessions and Participants have a delete button", () => {
  assert.match(section("v-sessions"), /Delete ticked sessions/);
  assert.match(section("v-participants"), /Delete ticked sessions/);
});

test("rendered tick boxes keep their ticked state across a refresh", () => {
  const ticks = RESEARCH_PAGE.match(/class='sel' value='[^\n]*/g) || [];
  assert.equal(ticks.length, 2);
  for (const t of ticks) assert.match(t, /picked\[/);
});
