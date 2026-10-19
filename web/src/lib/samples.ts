// Sample ideas for "Load sample idea". Every text field reuses existing sample or demo text only (nothing
// new is written): the original sample idea (prototype/data/cohort.js SAMPLE_IDEA), the legal idea used
// by the scripts plus the LegalAI demo idea, and the MedNote AI demo idea. The industry and role picks are
// form selections for the demo, not claims.
import { COHORT_IDEAS, SAMPLE_IDEA } from "@/proto";
import type { IdeaInput } from "@/types";

type Cohort = { id: string; name: string; desc: string; claims: { claim: string }[] };
const cohort = (id: string) => (COHORT_IDEAS as Cohort[]).find(i => i.id === id)!;
const sentences = (text: string) => text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[A-Z])/);
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

export const LEGAL_IDEA = "We are building an AI-powered legal contract review tool for early-stage startups. No such tool exists today that combines LLM-based review with a human lawyer backstop at under $200/month. The legal-tech market is worth $27B globally.";

const [j1, j2, j3, j4, j5] = sentences(SAMPLE_IDEA as string);
const [l1, l2, l3] = sentences(LEGAL_IDEA);
const legal = cohort("idea-01");
const scribe = cohort("idea-04");

export interface Sample { id: string; label: string; input: IdeaInput }
export const SAMPLES: Sample[] = [
  {
    id: "journaling", label: "Mental-health journaling app",
    input: { title: "Mental-health journaling app", pitch: j1, problem: `${j4} ${j3}`, solution: j2, moat: j5, industries: ["Healthtech", "AI/ML"], role: "founder", markets: [] },
  },
  {
    id: "legal", label: "AI contract review for startups",
    input: { title: legal.name, pitch: l1, problem: `${l2} ${l3}`, solution: sentence(legal.desc), moat: sentence(legal.claims[2].claim), industries: ["AI/ML", "SaaS/B2B"], role: "founder", markets: [] },
  },
  {
    id: "scribe", label: "AI scribe for solo physicians",
    input: { title: scribe.name, pitch: sentence(scribe.desc), problem: sentence(scribe.claims[0].claim), solution: sentence(scribe.claims[1].claim), moat: sentence(scribe.claims[2].claim), industries: ["Healthtech", "AI/ML"], role: "founder", markets: [] },
  },
];
