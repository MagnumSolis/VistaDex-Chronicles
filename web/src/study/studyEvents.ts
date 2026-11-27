// ── study/studyEvents.ts — the study-track event emitters (all consent-gated
// by telemetry.js; nothing logs before the Welcome notice).
import { track } from "@/telemetry";
import { visitSource } from "@/lib/source";
import type { Condition } from "./participant";

export function logParticipantRegistered(p: { code: string; role: string | null; track: string }) {
  track("participant_registered", { code: p.code, role: p.role, track: p.track, source: visitSource() });
}

/** Study track: a condition begins (the chatbot part when its first step is answered, VistaDex when the
 *  assigned idea is run). order_position: 1 or 2, from what the participant has actually finished. */
export function logConditionStarted(condition: Condition, ideaKey: string, orderPosition: number) {
  track("condition_started", { condition, idea_key: ideaKey, order_position: orderPosition });
}

export function logConfidencePre(condition: Condition, value: number, runId: string) {
  track("confidence_pre", { condition, value, run_id: runId });
}

export function logConfidencePost(condition: Condition, runId: string, value: number) {
  track("confidence_post", { condition, run_id: runId, value });
}

/** A claim or objection vote; "not_sure" as in comprehension_check. */
export type Vote = "agree" | "disagree" | "not_sure";

export function logClaimVote(runId: string, claimIndex: number, status: string, vote: Vote) {
  track("claim_vote", { claim_index: claimIndex, run_id: runId, status, vote });
}

export function logObjectionVote(runId: string, objectionIndex: number, severity: string, vote: Vote) {
  track("objection_vote", { objection_index: objectionIndex, run_id: runId, severity, vote });
}

/** H2 self-report: how many sources the participant opened or looked up themselves (null: not answered). */
export type SourcesChecked = "0" | "1-2" | "3+" | null;
/** study-19: what a judgement rests on (several may apply). */
export type Basis = "answer" | "sources" | "own_knowledge" | "own_search" | "other";
type SurveyAnswers = { trust: number; usefulness: number; helpfulness: number; effort: number; openText: string; sourcesChecked: SourcesChecked; basis: Basis[] };

export function logConditionSurvey(condition: Condition, answers: SurveyAnswers) {
  track("condition_survey", {
    condition,
    trust: answers.trust,
    usefulness: answers.usefulness,
    helpfulness: answers.helpfulness,
    effort: answers.effort,
    sources_checked: answers.sourcesChecked,
    basis: answers.basis,
    // The visitor wrote this text to be read (feedback field) — stored verbatim,
    // unlike usage telemetry which never stores idea or report content.
    open_text: answers.openText.slice(0, 2000),
  });
}

export function logConditionEnded(condition: Condition, runId: string, verifiedSources: number) {
  track("condition_ended", { condition, run_id: runId, verified_sources: verifiedSources });
}

// ── Learning-loop events (H4, from Berger et al. 2025) ──
// Per-run measures so calibration change across runs can be analyzed, and
// verification attention (dwell) captured per claim.



export function logComprehensionCheck(runId: string, answer: "honest_uncertainty" | "system_failure" | "not_sure" | "other") {
  track("comprehension_check", { answer, run_id: runId });
}

export function logRunScopedSurvey(runId: string, condition: Condition, answers: SurveyAnswers) {
  track("run_scoped_survey", {
    run_id: runId,
    condition,
    trust: answers.trust,
    usefulness: answers.usefulness,
    helpfulness: answers.helpfulness,
    effort: answers.effort,
    sources_checked: answers.sourcesChecked,
    basis: answers.basis,
    open_text: answers.openText.slice(0, 2000),
  });
}

/** A run id for one AI chatbot condition: "b_" + 12 random hex, like the report's "r_" ids. */
export const newBaselineRunId = () => `b_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

// ── Chatbot vs VistaDex comparison (study track only, study-16) ──
// The study track is the one exception to "no idea or report content in telemetry": the participant pastes
// their chatbot's answer to be compared with their VistaDex report, and the study page says so. Field
// visitors never send either record.

/** Asked while the chatbot writes its answer (before they read it): what they bring to the task. */
export function logParticipantProfile(runId: string, p: { marketFamiliarity: number; aiTrust: number; aiUse: number }) {
  track("participant_profile", { run_id: runId, market_familiarity: p.marketFamiliarity, ai_trust: p.aiTrust, ai_use: p.aiUse });
}

export type WebSearch = "yes" | "no" | "not_sure" | null;
export const MAX_ANSWER_CHARS = 30000;
/** The chatbot's answer as pasted (verbatim, capped), with the tool it came from. */
export function logChatbotAnswer(runId: string, a: { tool: string; model: string; webSearch: WebSearch; text: string }) {
  const text = a.text.slice(0, MAX_ANSWER_CHARS);
  track("chatbot_answer", { run_id: runId, tool: a.tool, model: a.model.slice(0, 60), web_search: a.webSearch, chars: text.length, text });
}

/** "chatbot" | "vistadex" | "same" per question; null: not answered. */
export type Pick = "chatbot" | "vistadex" | "same" | null;
export type Preference = { overall: Pick; accuracy: Pick; evidence: Pick; risks: Pick; honesty: Pick; decision: Pick; optionsOrder: "chatbot_first" | "vistadex_first"; why: string };
export function logToolPreference(p: Preference) {
  track("tool_preference", {
    overall: p.overall, accuracy: p.accuracy, evidence: p.evidence, risks: p.risks, honesty: p.honesty, decision: p.decision,
    options_order: p.optionsOrder, why: p.why.slice(0, 2000),
  });
}
