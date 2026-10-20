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

export function logClaimVote(runId: string, claimIndex: number, status: string, vote: "agree" | "disagree") {
  track("claim_vote", { claim_index: claimIndex, run_id: runId, status, vote });
}

export function logObjectionVote(runId: string, objectionIndex: number, severity: string, vote: "agree" | "disagree") {
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
