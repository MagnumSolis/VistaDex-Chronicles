// ── study/fresh.ts — a new participant at a browser someone used before ──
// Study sessions are often run one after another on one machine, and every tab of a private window shares
// one storage. A new participant must not inherit the person before: their finished parts, their own idea,
// their reports on the Reports page, the Screen an idea draft, or their usage session and notice answer.
import { clearStoredReports } from "@/lib/reports";
import { clearDraft } from "@/screens/ScreenIdea";
import { newVisitor } from "@/telemetry";
import { clearParticipant } from "./participant";

export async function startNewParticipant() {
  clearParticipant();
  clearStoredReports();
  clearDraft();
  await newVisitor();
}
