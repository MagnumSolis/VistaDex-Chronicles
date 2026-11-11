// A graveyard lead carries the closure sources of its entry, so the report can show where the shutdown
// is stated. Only the live snapshot's machine-checked source_urls are passed on; the offline seed's
// unchecked `sources` are not presented as checked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchGraveyard } from "../prototype/core/stages/graveyard.js";
import { toContract as normalizeReport } from "../prototype/core/contract.js";

const entry = (id, extra) => ({ id, company_name: id, what_they_tried: "same day hardware repair marketplace with local technicians", cause_of_death: "ran out of money", year_closed: 2019, ...extra });

test("a match carries the live entry's source_urls", () => {
  const [m] = matchGraveyard("A same day hardware repair marketplace with verified local technicians", [entry("Fixr", { source_urls: ["https://loot-drop.io/fixr", "https://techcrunch.com/fixr-shuts-down"] })]);
  assert.deepEqual(m.source_urls, ["https://loot-drop.io/fixr", "https://techcrunch.com/fixr-shuts-down"]);
});

test("the offline seed's unchecked sources are not passed on", () => {
  const [m] = matchGraveyard("A same day hardware repair marketplace with verified local technicians", [entry("Seedy", { sources: ["https://example.org/a"] })]);
  assert.deepEqual(m.source_urls, []);
});

test("the contract keeps source_urls on graveyard matches", () => {
  const r = normalizeReport({ idea_text: "x", claims: [], objections: [], graveyard_matches: [{ company_name: "A", what_they_tried: "b", cause_of_death: "c", year_closed: 2020, similarity: 0.4, source_urls: ["https://a.example/1", 7] }] });
  assert.deepEqual(r.graveyard_matches[0].source_urls, ["https://a.example/1", "7"]);
  const old = normalizeReport({ idea_text: "x", claims: [], objections: [], graveyard_matches: [{ company_name: "A", what_they_tried: "b", cause_of_death: "c", year_closed: 2020, similarity: 0.4 }] });
  assert.deepEqual(old.graveyard_matches[0].source_urls, []);
});
