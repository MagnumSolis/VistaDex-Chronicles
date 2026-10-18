import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STUDY_VERSION } from "../prototype/ui/study-config.js";

// The UI must emit the study_version recorded in the event contract (bumped together, see CLAUDE.md).
test("STUDY_VERSION matches the event contract", () => {
  const contract = JSON.parse(readFileSync(new URL("./fixtures/event-contract.json", import.meta.url), "utf8"));
  assert.equal(STUDY_VERSION, contract.study_version);
});
