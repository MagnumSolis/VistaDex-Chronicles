// GET /graveyard/quiz: fresh quiz entries from the live graveyard for the waiting screen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { quizPool, maskName, firstSentence } from "../worker/src/graveyard-quiz.js";
import { handle } from "../worker/src/index.js";
import { memoryStore } from "../worker/src/store.js";

const entries = [
  { company_name: "Getir", what_they_tried: "Getir promised groceries delivered in under 10 minutes. More text here.", cause_of_death: "Unsustainable unit economics. And more.", year_closed: 2024 },
  { company_name: "PepperTap", what_they_tried: "PepperTap was India's hyperlocal grocery delivery platform.", cause_of_death: "Negative unit economics on every order.", year_closed: 2016 },
  { company_name: "Quibi", what_they_tried: "Short premium video for phones.", cause_of_death: "Launched into lockdowns and nobody watched.", year_closed: 2020 },
  { company_name: "X", what_they_tried: "too short", cause_of_death: "", year_closed: null },
  { company_name: "Juicero", what_they_tried: "A $400 WiFi juicer for proprietary juice packs.", cause_of_death: "The packs could be squeezed by hand.", year_closed: 2017 },
];

test("the clue never names the company, and long texts are cut to their first sentence", () => {
  assert.equal(maskName("Getir promised groceries in 10 minutes", "Getir"), "This startup promised groceries in 10 minutes");
  assert.equal(maskName("India's PepperTap app", "PepperTap"), "India's this startup app");
  assert.equal(firstSentence("Unsustainable unit economics. And more."), "Unsustainable unit economics.");
});

test("a pool skips entries without a usable clue, cause or year, and draws in the order the random source gives", () => {
  const seq = [0.99, 0.01, 0.5, 0.2, 0.7, 0.3];
  let i = 0;
  const pool = quizPool(entries, 3, () => seq[i++ % seq.length]);
  assert.equal(pool.length, 3);
  for (const q of pool) {
    assert.ok(!q.clue.toLowerCase().includes(q.name.toLowerCase()), `clue hides ${q.name}`);
    assert.ok(q.cause.length > 0 && q.year > 1990);
  }
  assert.ok(!pool.some(q => q.name === "X"));
  assert.equal(new Set(pool.map(q => q.name)).size, 3, "no repeats");
});

test("the Worker serves a fresh pool, never cached, readable by the site", async () => {
  const res = await handle(new Request("https://proxy.test/graveyard/quiz", { headers: { Origin: "http://localhost:5173" } }), { ALLOWED_ORIGINS: "http://localhost:5173" }, { store: memoryStore() });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  const body = await res.json();
  assert.ok(Array.isArray(body.entries) && body.entries.length >= 4);
  assert.deepEqual(Object.keys(body.entries[0]).sort(), ["cause", "clue", "name", "year"]);
});
