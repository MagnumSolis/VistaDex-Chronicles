// ── study/participant.ts — two-track study: within-subjects (recruited) + field (LinkedIn)
//
// Track A (recruited, within-subjects): participant code + assigned idea +
//   counterbalanced order over [baseline AI, VistaDex]. Small-N friendly:
//   each participant is their own control; the two conditions may happen in
//   separate sittings (persisted). Wilcoxon-ready per-condition measures.
// Track B (field / LinkedIn): no code, own idea, single VistaDex condition,
//   full consented telemetry + post-report ratings + feedback. Exploratory.
//
// Identity is pseudonymous: a self-assigned code (e.g. "P07") + optional role.
// No PII is collected in either track.

const STORAGE_KEY = "vistadex_participant";

export type Track = "study" | "field";
export type Condition = "baseline" | "vistadex";
export type ConditionOrder = [Condition, Condition];

export interface Participant {
  track: Track;
  code: string;          // study track: self-assigned "P07"; field track: ""
  role: string | null;    // founder | investor | student | researcher | other
  ideaKey: string;        // study track: assigned preset idea key; field: ""
  order: ConditionOrder | null;  // study track only; field track: single VistaDex condition
  registered_at: string;
}

// Researcher-assigned idea set for Track A. Participants get one at random;
// code+ideaKey lets researchers group participants who screened the same idea.
const STUDY_IDEAS: Record<string, string> = {
  "A": "We are building an AI-powered meal-planning app for diabetic patients that reads continuous glucose monitor data and plans meals around readings, at $25/month. No such tool exists. The diabetes app market is worth $4.2B and growing 15% annually. Our moat is a nutrition model trained on 200,000 anonymized diabetic meal logs.",
  "B": "We are building a peer-to-peer skill-swap marketplace for university students — teach what you know, learn what you need, no money involved. No platform does this well today. The global ed-tech market is $250B. Our moat is exclusive partnerships with 40 university clubs in our first year.",
  "C": "We are building an AI mock-interview platform that simulates a real interviewer from the company you're applying to, with voice and follow-up questions, at $15/month. Existing tools only offer static question banks. The job-readiness market is $8B. Our moat is interview transcripts from 500 hired candidates.",
  "D": "We are building a same-day hardware-repair marketplace connecting users with verified local technicians, with upfront pricing and a warranty. No one has cracked this since Homejoy failed. The home-services market is $500B. Our moat is a vetting process and a pricing model built from 10,000 completed repair records.",
};

export const ROLES = ["founder", "investor", "student", "researcher", "other"] as const;

export function studyIdeaKeys(): string[] {
  return Object.keys(STUDY_IDEAS);
}

export function studyIdea(key: string): string {
  return STUDY_IDEAS[key] || STUDY_IDEAS["A"];
}

export function randomIdeaKey(): string {
  const keys = Object.keys(STUDY_IDEAS);
  // Deterministic-ish spread without Math.random in production paths:
  // time-based pick is fine for assignment (not a pipeline decision).
  return keys[Math.floor(Date.now() / 1000) % keys.length];
}

export function isValidRole(role: string | null): boolean {
  return role === null || (ROLES as readonly string[]).includes(role);
}

/** Study track: register with a code; order counterbalanced by code parity. */
export function registerStudyParticipant(code: string, role: string | null, ideaKey?: string): Participant {
  const clean = code.trim().slice(0, 12);
  const num = parseInt(clean.replace(/\D/g, ""), 10);
  const baselineFirst = Number.isFinite(num) && num > 0 ? num % 2 === 1 : Date.now() % 2 === 0;
  const p: Participant = {
    track: "study",
    code: clean,
    role,
    ideaKey: ideaKey || randomIdeaKey(),
    order: baselineFirst ? ["baseline", "vistadex"] : ["vistadex", "baseline"],
    registered_at: new Date().toISOString(),
  };
  persist(p);
  return p;
}

/** Field track: no code, own idea, single condition. */
export function registerFieldParticipant(role: string | null): Participant {
  const p: Participant = {
    track: "field",
    code: "",
    role,
    ideaKey: "",
    order: null,
    registered_at: new Date().toISOString(),
  };
  persist(p);
  return p;
}

function persist(p: Participant) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}

export function currentParticipant(): Participant | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Participant;
    if (!p || typeof p.code !== "string" || !p.registered_at) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearParticipant() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/** Study track: which conditions are done (from persisted progress flags). */
export function conditionDone(p: Participant, c: Condition): boolean {
  try {
    return localStorage.getItem(`${STORAGE_KEY}_done_${c}`) === "true";
  } catch { return false; }
}

export function markConditionDone(c: Condition) {
  try { localStorage.setItem(`${STORAGE_KEY}_done_${c}`, "true"); } catch { /* ignore */ }
}

export function nextCondition(p: Participant): Condition | null {
  if (p.track !== "study" || !p.order) return null;
  const [a, b] = p.order;
  if (!conditionDone(p, a)) return a;
  if (!conditionDone(p, b)) return b;
  return null; // study complete
}

export function studyComplete(p: Participant): boolean {
  return p.track === "study" && !!p.order && conditionDone(p, p.order[0]) && conditionDone(p, p.order[1]);
}
