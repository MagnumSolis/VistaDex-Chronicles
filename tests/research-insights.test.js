// The Research Console's Insights, Funnel, Feedback charts and analysis-ready exports
// (worker/src/research-join.js analyzeStudy / exportTables, embedded in research-page.js).
// Synthetic events only; participant data never enters the repository.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeStudy, exportTables, joinRuns } from "../worker/src/research-join.js";
import { RESEARCH_PAGE } from "../worker/src/research-page.js";

let seq = 0;
const ev = (sid, type, payload = {}) => ({ session_id: sid, seq: ++seq, ts: new Date(Date.UTC(2026, 10, 11, 10, 0, 0, seq * 1000)).toISOString(), type, study_version: "2026-11-study-8", payload });

// A field visitor from LinkedIn: one finished run, evidence opened outside the claims, a sample report read later.
function fieldVisit(sid, { role = "investor", source = "linkedin", pre = 60, post = 40, claimClicks = 0, links = [], votes = [], sections = {} } = {}) {
  const run = `r_${sid.padEnd(12, "0").slice(0, 12)}`;
  return [
    ev(sid, "participant_registered", { code: "", role, track: "field", source }),
    ev(sid, "run_started", { run_id: run, role, industries: ["Fintech"], markets: [], mode: "live", sample: null, idea_chars: 400, field_chars: {} }),
    ev(sid, "confidence_pre", { condition: "vistadex", value: pre, run_id: run, moved: true }),
    ev(sid, "run_completed", { run_id: run, counts: {}, duration_ms: 50000, mode: "live", trace_id: "t" }),
    ...Array.from({ length: claimClicks }, (_, i) => [
      ev(sid, "control_pressed", { control: "source_link", screen: "report" }),
      ev(sid, "source_clicked", { run_id: run, claim_index: i, url: "https://a.example" }),
    ]).flat(),
    ...links.map(control => ev(sid, "control_pressed", { control, screen: "report" })),
    ...Object.entries(sections).map(([section, ms]) => ev(sid, "section_time", { run_id: run, section, visible_ms: ms })),
    ...votes.map(([i, status, vote]) => ev(sid, "claim_vote", { claim_index: i, run_id: run, status, vote })),
    ev(sid, "confidence_post", { condition: "vistadex", run_id: run, value: post }),
    ev(sid, "run_scoped_survey", { run_id: run, condition: "vistadex", trust: 5, usefulness: 6, helpfulness: 5, effort: 3, open_text: "", sources_checked: "1-2" }),
    ev(sid, "report_time", { run_id: run, visible_ms: 180000, ended_by: "left" }),
    // a sample report read afterwards: its own run id, so its reading time is not this run's
    ev(sid, "section_time", { run_id: "sample-legal", section: "graveyard", visible_ms: 99000 }),
  ];
}

test("evidence links outside the claims count for the run open at the time; a claim source is not counted twice", () => {
  seq = 0;
  const runs = joinRuns(fieldVisit("f1", { claimClicks: 2, links: ["lead_source_link", "competitor_link", "big_tech_source_link", "report_how_it_works"] }));
  assert.equal(runs.length, 1);
  assert.equal(runs[0].clicks, 2, "claim sources (source_clicked)");
  assert.equal(runs[0].links, 3, "graveyard, competitor and Big Tech links; source_link and other buttons are not evidence links");
  assert.deepEqual(runs[0].linksBy, { graveyard: 1, competitors: 1, big_tech: 1 });
  assert.equal(runs[0].inferred, 0, "links without a run id are not inferred measures");
});

test("section and report time join only the run with that id, never a sample report read later", () => {
  seq = 0;
  const [r] = joinRuns(fieldVisit("f1", { sections: { summary: 20000, claims: 60000 } }));
  assert.equal(r.completed, true);
  assert.deepEqual(r.sectionMs, { summary: 20000, claims: 60000 });
  assert.equal(r.reportMs, 180000);
});

const DATA = () => {
  seq = 0;
  return [
    ...fieldVisit("f1", { role: "investor", source: "linkedin", pre: 60, post: 40, links: ["lead_source_link"], sections: { summary: 10000, graveyard: 30000 }, votes: [[0, "contradicted", "disagree"], [1, "confirmed", "agree"]] }),
    ...fieldVisit("f2", { role: "founder", source: "x", pre: 50, post: 50, sections: { summary: 5000 }, votes: [[0, "unverified", "agree"]] }),
    ...fieldVisit("f3", { role: "founder", source: "x", pre: 70, post: 80, claimClicks: 1, sections: { summary: 8000, claims: 4000 } }),
    ev("t1", "participant_registered", { code: "TEST01", role: "student", track: "study", source: null }),
    ev("t1", "run_started", { run_id: "r_t", sample: "study_A" }),
    ev("f4", "participant_registered", { code: "", role: "student", track: "field", source: "investors" }),
    ev("f4", "run_started", { run_id: "r_f4", role: "student", mode: "live" }), // started, never finished
  ];
};

test("analyzeStudy: field funnel, attention, segments and evidence over finished runs", () => {
  const A = analyzeStudy(DATA());
  assert.equal(A.summary.excludedTestCodes, 1);
  assert.deepEqual(A.funnel.field.map(s => s[1]), [4, 3, 3, 2, 2, 3, 3]);
  assert.equal(A.h2.runs.n, 3);
  assert.equal(A.h2.runs.opened, 2);
  assert.deepEqual(A.h2.runs.links, { claims: 1, graveyard: 1 });
  const reach = Object.fromEntries(A.attention.map(a => [a.section, a.reachPct]));
  assert.equal(reach.summary, 100);
  assert.equal(reach.graveyard, 33, "the sample report's graveyard time is not counted");
  assert.equal(A.reportMedianMin, 3);
  const roles = Object.fromEntries(A.segments.role.map(s => [s.group, s]));
  assert.equal(roles.founder.runs, 2);
  assert.equal(roles.founder.meanDelta, 5);
  assert.equal(roles.investor.evidencePct, 100);
  assert.deepEqual(A.segments.channel.map(s => s.group), ["linkedin", "x"]);
  assert.equal(A.direction.lower, 1);
  assert.equal(A.direction.same, 1);
  assert.equal(A.direction.higher, 1);
});

test("findings state their n and say when there is not enough data yet; no verdict words, no em dashes", () => {
  const A = analyzeStudy(DATA());
  const byId = Object.fromEntries(A.findings.map(f => [f.id, f]));
  assert.equal(byId.h1_paired.enough, false, "no complete pairs");
  assert.equal(byId.h2_evidence.n, 3);
  assert.match(byId.h2_evidence.text, /opened in 2 of 3 finished runs \(67%\)/);
  assert.match(byId.h3_agreement.text, /contradicted 0% agree \(1 vote\)/);
  for (const f of A.findings) {
    assert.ok(!/—/.test(f.text + f.title), `no em dash in ${f.id}`);
    assert.ok(!/\b(good|bad) idea\b/i.test(f.text), `no verdict in ${f.id}`);
  }
});

test("exportTables: every analysis-ready table, with a header and one row per item", () => {
  const data = DATA();
  const t = exportTables(analyzeStudy(data), data);
  assert.deepEqual(Object.keys(t).sort(), ["attention.csv", "open-answers.csv", "paired.csv", "runs.csv", "segments.csv", "votes.csv"]);
  const runs = t["runs.csv"].split("\n");
  assert.equal(runs.length, 1 + 4, "header + every run (the TEST code left out)");
  const head = runs[0].split(",");
  for (const col of ["channel", "evidence_opened", "graveyard_links", "report_seconds", "matched_by_start_order"]) assert.ok(head.includes(col), col);
  const votes = t["votes.csv"].split("\n");
  assert.equal(votes.length, 1 + 3);
  assert.match(votes.join("\n"), /contradicted,,disagree,investor,field/);
  assert.equal(t["attention.csv"].split("\n").length, 1 + 3, "finished runs only");
});

test("console page: Feedback histograms close every tag, funnels stay inside their track, Insights and exports are wired", () => {
  assert.ok(!/<span class="v">' \+ \(c \|\| ""\) \+ '<\/div>/.test(RESEARCH_PAGE), "the confidence histogram's count closes its span");
  assert.ok(RESEARCH_PAGE.includes("Math.min(100, Math.round(100 * st[1] / top))"), "funnel bars capped at the track width");
  assert.ok(RESEARCH_PAGE.includes('id="funnel-study"') && RESEARCH_PAGE.includes('id="funnel-field"'));
  assert.ok(RESEARCH_PAGE.includes("grid-template-columns: 228px minmax(0, 1fr)"), "wide content scrolls inside the main column");
  assert.ok(RESEARCH_PAGE.includes('data-view="insights"') && RESEARCH_PAGE.includes("JOIN.analyzeStudy(ev"));
  assert.ok(RESEARCH_PAGE.includes("JOIN.exportTables(A, ev)"));
  assert.ok(RESEARCH_PAGE.includes("<th>Evidence opened</th>"));
  assert.ok(!RESEARCH_PAGE.includes("the calibration measure"), "confidence change is not called calibration");
});
