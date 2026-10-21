// The Research Console's run join (worker/src/research-join.js), tested directly. The served page embeds
// the same source, so these tests cover what the console shows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { joinRuns, researchJoin } from "../worker/src/research-join.js";
import { RESEARCH_PAGE } from "../worker/src/research-page.js";

const SID = "99999999-8888-4777-a666-555555555555";
let seq = 0;
const ev = (type, payload = {}, sid = SID) => ({ session_id: sid, seq: ++seq, ts: new Date(Date.UTC(2026, 9, 21, 10, 0, seq)).toISOString(), type, study_version: "v", payload });

test("research join: per-run measures land on their run (session_id, run_id)", () => {
  seq = 0;
  const runs = joinRuns([
    ev("run_started", { run_id: "r1", role: "founder", industries: ["AI", "Fintech"] }),
    ev("confidence_pre", { run_id: "r1", value: 40 }),
    ev("claim_vote", { run_id: "r1", claim_index: 0, vote: "agree" }),
    ev("source_clicked", { run_id: "r1", url: "u" }),
    ev("claim_dwell", { run_id: "r1", ms: 1200 }),
    ev("run_started", { run_id: "r2", role: "investor" }),
    ev("confidence_post", { run_id: "r1", value: 60 }),
    ev("objection_vote", { run_id: "r2", objection_index: 0, vote: "disagree" }),
    ev("run_scoped_survey", { run_id: "r2", trust: 5, usefulness: 4, effort: 2 }),
    ev("comprehension_check", { run_id: "r2", answer: "not_sure" }),
    ev("source_clicked_by_claim", {}), // no run_id: the run in progress (r2)
  ]);
  assert.equal(runs.length, 2);
  assert.deepEqual(
    { runId: runs[0].runId, role: runs[0].role, industries: runs[0].industries, pre: runs[0].pre, post: runs[0].post, votes: runs[0].votes, agrees: runs[0].agrees, clicks: runs[0].clicks, dwell: runs[0].dwell },
    { runId: "r1", role: "founder", industries: "AI, Fintech", pre: 40, post: 60, votes: 1, agrees: 1, clicks: 1, dwell: 1200 });
  assert.deepEqual(
    { runId: runs[1].runId, votes: runs[1].votes, agrees: runs[1].agrees, clicks: runs[1].clicks, trust: runs[1].survey.trust, comp: runs[1].comp },
    { runId: "r2", votes: 1, agrees: 0, clicks: 1, trust: 5, comp: "not_sure" });
});

test("research console page embeds the shared join and its inline script parses", () => {
  assert.ok(RESEARCH_PAGE.includes(researchJoin.toString()), "page carries research-join.js's source verbatim");
  const scripts = [...RESEARCH_PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 1);
  for (const s of scripts) assert.doesNotThrow(() => new Function(s));
});
