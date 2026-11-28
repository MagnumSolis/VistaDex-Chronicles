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
// Keys are never reused: a retired idea's letter stays retired, so data collected under it stays separate.
/** study-22: C retired (its live run took 388 s, past the client's 240 s timeout); E replaces it. */
export const RETIRED_IDEA_KEYS: readonly string[] = ["C"];
const STUDY_IDEAS: Record<string, string> = {
  "A": "We are building an AI-powered meal-planning app for diabetic patients that reads continuous glucose monitor data and plans meals around readings, at $25/month. No such tool exists. The diabetes app market is worth $4.2B and growing 15% annually. Our moat is a nutrition model trained on 200,000 anonymized diabetic meal logs.",
  "B": "We are building a peer-to-peer skill-swap marketplace for university students — teach what you know, learn what you need, no money involved. No platform does this well today. The global ed-tech market is $250B. Our moat is exclusive partnerships with 40 university clubs in our first year.",
  "D": "We are building a same-day hardware-repair marketplace connecting users with verified local technicians, with upfront pricing and a warranty. No one has cracked this since Homejoy failed. The home-services market is $500B. Our moat is a vetting process and a pricing model built from 10,000 completed repair records.",
  "E": "We are building an app that splits rent, electricity and internet bills between flatmates and collects each share automatically over UPI, at ₹99/month. No app handles shared rent and bills for flatmates in India. India's residential rental market is worth $20B. Our moat is partnerships with 30 housing societies in Bengaluru.",
};

// The same ideas as Screen an idea input, filled in for the VistaDex condition so every participant
// with the same idea screens the same input. Every sentence of the paragraph above appears verbatim
// (the "We are building..." sentence is the solution); the one-line pitch is the only added text.
// TODO(team): approve the added pitch lines.
export type StudyInput = { title: string; pitch: string; problem: string; solution: string; moat: string };
const STUDY_INPUTS: Record<string, StudyInput> = {
  "A": {
    title: "AI meal-planning for diabetics",
    pitch: "Meal plans built from glucose readings, for people with diabetes.",
    problem: "No such tool exists. The diabetes app market is worth $4.2B and growing 15% annually.",
    solution: "We are building an AI-powered meal-planning app for diabetic patients that reads continuous glucose monitor data and plans meals around readings, at $25/month.",
    moat: "Our moat is a nutrition model trained on 200,000 anonymized diabetic meal logs.",
  },
  "B": {
    title: "Student skill-swap marketplace",
    pitch: "A money-free skill-swap marketplace for university students.",
    problem: "No platform does this well today. The global ed-tech market is $250B.",
    solution: "We are building a peer-to-peer skill-swap marketplace for university students — teach what you know, learn what you need, no money involved.",
    moat: "Our moat is exclusive partnerships with 40 university clubs in our first year.",
  },
  "D": {
    title: "Same-day repair marketplace",
    pitch: "Same-day repairs by verified local technicians.",
    problem: "No one has cracked this since Homejoy failed. The home-services market is $500B.",
    solution: "We are building a same-day hardware-repair marketplace connecting users with verified local technicians, with upfront pricing and a warranty.",
    moat: "Our moat is a vetting process and a pricing model built from 10,000 completed repair records.",
  },
  "E": {
    title: "Flatmate rent and bill splitter",
    pitch: "Split rent and utility bills with flatmates automatically, for renters in India.",
    problem: "No app handles shared rent and bills for flatmates in India. India's residential rental market is worth $20B.",
    solution: "We are building an app that splits rent, electricity and internet bills between flatmates and collects each share automatically over UPI, at ₹99/month.",
    moat: "Our moat is partnerships with 30 housing societies in Bengaluru.",
  },
};

// The participant's own idea (study track): typed once on the study page, then used for both parts, the
// chatbot (as one paragraph to copy) and VistaDex (the same fields). Kept only in this browser's storage,
// never in telemetry, which records idea_key "own" instead of a preset letter.
export const OWN_IDEA = "own";
const OWN_KEY = `${STORAGE_KEY}_own_idea`;
export function setOwnIdea(input: StudyInput) {
  try { localStorage.setItem(OWN_KEY, JSON.stringify(input)); } catch { /* storage unavailable */ }
}
export function ownIdeaInput(): StudyInput | null {
  try {
    const raw = localStorage.getItem(OWN_KEY);
    const v = raw ? JSON.parse(raw) as StudyInput : null;
    return v && typeof v.title === "string" ? v : null;
  } catch { return null; }
}
const paragraphOf = (i: StudyInput) => [i.title.trim() + ".", i.pitch, i.problem, i.solution, i.moat]
  .map(x => x.trim()).filter(Boolean).map(x => (/[.!?]$/.test(x) ? x : `${x}.`)).join(" ");

export function studyIdeaInput(key: string): StudyInput {
  return STUDY_INPUTS[key] || STUDY_INPUTS["A"];
}

/** Study track, VistaDex condition not done yet: the assigned idea to fill into Screen an idea. */
export function assignedStudyIdea(): { key: string; sample: string | null; input: StudyInput; baselineDone: boolean } | null {
  const p = currentParticipant();
  if (!p || p.track !== "study" || conditionDone(p, "vistadex")) return null;
  const own = p.ideaKey === OWN_IDEA ? ownIdeaInput() : null;
  if (own) return { key: OWN_IDEA, sample: null, input: own, baselineDone: conditionDone(p, "baseline") };
  const key = STUDY_INPUTS[p.ideaKey] ? p.ideaKey : "A";
  return { key, sample: `study_${key}`, input: STUDY_INPUTS[key], baselineDone: conditionDone(p, "baseline") };
}

export const ROLES = ["founder", "investor", "student", "researcher", "other"] as const;

// study-23: the letter participants (and the code sheet) see. Stored keys stay A, B, D, E: C is the retired
// mock-interview idea and keeps its data, so a shown letter never stands for two ideas in the data.
const IDEA_LABELS: Record<string, string> = { A: "A", B: "B", D: "C", E: "D" };
export function ideaLabel(key: string): string {
  return IDEA_LABELS[key] ?? key;
}

export function studyIdeaKeys(): string[] {
  return Object.keys(STUDY_IDEAS);
}

export function studyIdea(key: string): string {
  const own = key === OWN_IDEA ? ownIdeaInput() : null;
  if (own) return paragraphOf(own);
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

// The prompt every participant sends to their chatbot (study-16): the same task VistaDex does, section by
// section, so the two answers can be compared point by point. One fixed wording for everyone.
export function chatbotPrompt(key: string): string {
  return [
    "I'm considering this startup idea and want an honest, evidence-based assessment before I decide anything.",
    "",
    `The idea: ${studyIdea(key)}`,
    "",
    "Please:",
    "1. List the idea's main factual claims (market size, \"no one does this\", traction, the moat) and say for each whether it is true, false, disputed or cannot be verified, with sources.",
    "2. Name existing competitors and similar products.",
    "3. Name startups that tried something similar and shut down, and why they failed.",
    "4. Say whether big tech companies (Google, Amazon, Microsoft, Apple, Meta) already do this or could easily.",
    "5. List the strongest objections and risks.",
    "6. Note legal or regulatory issues in the main markets.",
    "Give links for factual statements, and say clearly what you could not verify.",
  ].join("\n");
}

/** study-19: the two parts are counterbalanced by the code's number (odd or no number: AI chatbot first;
 *  even: VistaDex first), the rule the comparison page also uses for its option order. study-16 to 18 had
 *  everyone do the chatbot first. */
export function partOrder(code: string): [Condition, Condition] {
  const num = parseInt(code.replace(/\D/g, ""), 10);
  return Number.isFinite(num) && num % 2 === 0 ? ["vistadex", "baseline"] : ["baseline", "vistadex"];
}

/** Study track: register with a code; then both parts in the code's order, then the comparison. */
export function registerStudyParticipant(code: string, role: string | null, ideaKey?: string): Participant {
  const clean = code.trim().slice(0, 12);
  // A different code or idea is a new participant: the parts an earlier participant finished in this
  // browser must not count (they would skip the new person's parts and leave Screen an idea empty).
  const prev = currentParticipant();
  const chosen = ideaKey || "";
  if (!prev || prev.track !== "study" || prev.code !== clean || (chosen && prev.ideaKey !== chosen)) clearProgress();
  const p: Participant = {
    track: "study",
    code: clean,
    role,
    ideaKey: ideaKey || randomIdeaKey(),
    order: partOrder(clean),
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
    // Assigned a retired idea: not mapped to another idea (the two parts could then judge different
    // ideas). The record and its progress are cleared, so the study page asks them to register again.
    if (p.track === "study" && RETIRED_IDEA_KEYS.includes(p.ideaKey)) {
      localStorage.removeItem(STORAGE_KEY);
      clearProgress();
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function clearParticipant() {
  try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(OWN_KEY); } catch { /* ignore */ }
  clearProgress();
}

/** Study track: which conditions are done (from persisted progress flags). */
export function conditionDone(p: Participant, c: Condition): boolean {
  try {
    return localStorage.getItem(`${STORAGE_KEY}_done_${c}`) === "true";
  } catch { return false; }
}

function clearProgress() {
  try { (["baseline", "vistadex"] as Condition[]).forEach(c => localStorage.removeItem(`${STORAGE_KEY}_done_${c}`)); } catch { /* ignore */ }
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
