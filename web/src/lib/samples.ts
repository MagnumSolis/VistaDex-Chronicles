// Sample ideas for "Load sample idea". All three reuse existing demo text (nothing new is written):
// the original sample idea, the legal idea used by the parity/a11y scripts, and the MedNote AI demo idea
// (its one-line description and claims from prototype/data/cohort.js, joined into a paragraph).
import { COHORT_IDEAS, SAMPLE_IDEA } from "@/proto";

const medNote = (COHORT_IDEAS as { id: string; desc: string; claims: { claim: string }[] }[]).find(i => i.id === "idea-04")!;
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

export const LEGAL_IDEA = "We are building an AI-powered legal contract review tool for early-stage startups. No such tool exists today that combines LLM-based review with a human lawyer backstop at under $200/month. The legal-tech market is worth $27B globally.";

export const SAMPLES: { id: string; label: string; text: string }[] = [
  { id: "journaling", label: "Mental-health journaling app", text: SAMPLE_IDEA as string },
  { id: "legal", label: "AI contract review for startups", text: LEGAL_IDEA },
  { id: "scribe", label: "AI scribe for solo physicians", text: [medNote.desc, ...medNote.claims.map(c => c.claim)].map(sentence).join(" ") },
];
