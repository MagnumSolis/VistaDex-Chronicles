// Chatbot vs VistaDex (study-16): the pasted chatbot answer and the participant's report snapshot are
// compared in code (research-join.js chatbotComparison), so the console and the analysis script agree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeStudy, chatbotComparison, exportTables, signTest, textFeatures } from "../worker/src/research-join.js";
import { RESEARCH_PAGE } from "../worker/src/research-page.js";

const ANSWER = "This is a promising idea, 7/10. Competitors include Nutrisense and Levels. The market may be $4.2B as claimed (https://www.example.com/a, https://example.com/b). " +
  "Risks: regulation (FDA). Google could copy it. Virta tried something close.";
const REPORT = {
  score: 55, sample_fields: [], sources: 4, domains: 3,
  claims: [{ claim: "The diabetes app market is worth $4.2B", status: "disputed", urls: ["https://a.com/1"] }, { claim: "No such tool exists", status: "contradicted", urls: [] }],
  competitors: [{ name: "Levels", url: "https://levels.com" }, { name: "Signos", url: "https://signos.com" }],
  graveyard: [{ company: "Virta", cause: "Pivoted", year: 2020, similarity: 0.3, urls: [] }],
  objections: [{ objection: "Clinical claims need approval.", severity: "high" }],
  big_tech: { level: "medium", companies: ["Google"], urls: [] }, legal: null, market: null,
};
let seq = 0;
const e = (sid, type, payload) => ({ session_id: sid, seq: ++seq, ts: String(seq).padStart(4, "0"), type, payload });
const person = (sid, code, pick) => [
  e(sid, "participant_registered", { code, track: "study", role: null, source: "direct" }),
  e(sid, "condition_started", { condition: "baseline", idea_key: "A", order_position: 1 }),
  e(sid, "participant_profile", { run_id: "b_1", market_familiarity: 2, ai_trust: 5, ai_use: 6 }),
  e(sid, "chatbot_answer", { run_id: "b_1", tool: "Claude", model: "", web_search: "yes", chars: ANSWER.length, text: ANSWER }),
  e(sid, "vistadex_report_snapshot", { run_id: "r_1", idea_key: "A", report: REPORT }),
  e(sid, "tool_preference", { overall: pick, accuracy: "vistadex", evidence: "same", risks: "chatbot", honesty: null, decision: pick, options_order: "chatbot_first", why: "because" }),
];

test("text features: words, links that survived the paste, figures, hedges and verdict words, sections taken up", () => {
  const f = textFeatures(ANSWER);
  assert.equal(f.links, 2);
  assert.equal(f.domains, 1, "example.com with and without www is one website");
  assert.equal(f.figures, 1);
  assert.ok(f.hedges >= 2, "may, could");
  assert.equal(f.verdicts, 2, "promising, 7/10");
  // "as claimed" takes up the claims; nothing about startups that shut down.
  assert.deepEqual(f.sections, { claims: true, competitors: true, graveyard: false, big_tech: true, objections: true, legal: true });
  assert.equal(textFeatures("").words, 0);
});

test("per participant: what the report found that the chatbot also named, and the preferences", () => {
  const c = chatbotComparison([...person("s1", "P01", "vistadex")]);
  const r = c.rows[0];
  assert.equal(r.both, true);
  assert.deepEqual(r.overlap, { competitors: { of: 2, named: 1 }, graveyard: { of: 1, named: 1 }, bigTech: { of: 1, named: 1 }, claims: { of: 2, named: 1 } });
  assert.equal(r.vistadex.disputed, 1);
  assert.equal(r.preference.overall, "vistadex");
  assert.match(r.reportText, /\[disputed\] The diabetes app market is worth \$4\.2B \(1 sources\)/);
  assert.deepEqual(c.coverage.competitors, { n: 1, meanPct: 50 });
});

test("preferences: counts per question and a two-sided sign test without the 'same' answers", () => {
  const ev = [];
  for (let i = 1; i <= 9; i++) ev.push(...person(`s${i}`, `P0${i}`, i === 9 ? "chatbot" : "vistadex"));
  const c = chatbotComparison(ev);
  assert.deepEqual({ ...c.preferences.overall, test: undefined }, { chatbot: 1, vistadex: 8, same: 0, unanswered: 0, test: undefined });
  assert.equal(c.preferences.overall.test.p, signTest(8, 1).p);
  assert.ok(Math.abs(signTest(8, 1).p - 0.0390625) < 1e-9);
  assert.equal(c.preferences.honesty.unanswered, 9);
  assert.deepEqual(signTest(0, 0), { n: 0, p: null });
});

test("a participant with only one of the two records is listed but not paired; TEST codes are left out", () => {
  const ev = [...person("s1", "P01", "vistadex"), e("s2", "participant_registered", { code: "P02", track: "study" }), e("s2", "chatbot_answer", { run_id: "b", tool: "ChatGPT", model: "", web_search: null, chars: 3, text: "abc" }),
    ...person("s3", "TEST01", "chatbot")];
  const A = analyzeStudy(ev);
  assert.deepEqual(A.comparison.n, { participants: 2, answers: 2, both: 1, preferences: 1 });
  assert.ok(A.findings.some(f => f.id === "preference"));
  const t = exportTables(A, ev);
  const rows = t["comparison.csv"].split("\n");
  assert.equal(rows.length, 1 + 2);
  assert.ok(rows[0].split(",").includes("claims_chatbot_mentioned"));
  assert.match(t["chatbot-answers.csv"].split("\n")[0], /chatbot_claim_accuracy_1to5.*vistadex_actionability_1to5,rater,notes$/);
  assert.match(t["chatbot-answers.csv"], /Virta tried something close/);
});

test("console page: the Chatbot vs VistaDex view and its two exports are wired", () => {
  assert.match(RESEARCH_PAGE, /data-view="compare"/);
  assert.match(RESEARCH_PAGE, /id="v-compare"/);
  assert.match(RESEARCH_PAGE, /renderCompare\(A\.comparison\)/);
  assert.match(RESEARCH_PAGE, /"comparison\.csv":/);
  assert.match(RESEARCH_PAGE, /"chatbot-answers\.csv":/);
});
