// ── study/studyEvents.ts — the study-track event emitters (all consent-gated
// by telemetry.js; nothing logs before the Welcome notice).
import { track } from "@/telemetry";
import type { Condition } from "./participant";

export function logParticipantRegistered(p: { code: string; role: string | null; track: string }) {
  track("participant_registered", { code: p.code, role: p.role, track: p.track });
}

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

export function logConditionSurvey(condition: Condition, answers: { trust: number; usefulness: number; helpfulness: number; effort: number; openText: string }) {
  track("condition_survey", {
    condition,
    trust: answers.trust,
    usefulness: answers.usefulness,
    helpfulness: answers.helpfulness,
    effort: answers.effort,
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

export function logClaimDwell(runId: string, claimIndex: number, ms: number) {
  track("claim_dwell", { claim_index: claimIndex, ms, run_id: runId });
}

export function logSourceClickedByClaim(runId: string, claimIndex: number, url: string) {
  track("source_clicked_by_claim", { claim_index: claimIndex, run_id: runId, url: url.slice(0, 300) });
}

export function logComprehensionCheck(runId: string, answer: "honest_uncertainty" | "system_failure" | "not_sure" | "other") {
  track("comprehension_check", { answer, run_id: runId });
}

export function logRunScopedSurvey(runId: string, condition: Condition, answers: { trust: number; usefulness: number; helpfulness: number; effort: number; openText: string }) {
  track("run_scoped_survey", {
    run_id: runId,
    condition,
    trust: answers.trust,
    usefulness: answers.usefulness,
    helpfulness: answers.helpfulness,
    effort: answers.effort,
    open_text: answers.openText.slice(0, 2000),
  });
}
