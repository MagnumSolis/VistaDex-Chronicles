// ── study/BasisQuestion.tsx: what a participant's judgement of the idea rests on (study-19) ──
// After Kim et al. (FAccT 2024): asked after each part, so reliance on the tool's answer can be told apart
// from the participant's own checking, knowledge or search. Several answers may apply; none is required.
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Basis } from "./studyEvents";

const OPTIONS: [Basis, (tool: string) => string][] = [
  ["answer", tool => `What ${tool} said`],
  ["sources", () => "Sources I opened and read myself"],
  ["own_knowledge", () => "What I already knew"],
  ["own_search", () => "My own search, outside the tool"],
  ["other", () => "Something else"],
];

export function BasisQuestion({ tool, value, onChange }: { tool: "the chatbot" | "the VistaDex report"; value: Basis[]; onChange: (v: Basis[]) => void }) {
  const toggle = (b: Basis) => onChange(value.includes(b) ? value.filter(x => x !== b) : [...value, b]);
  return (
    <fieldset className="mt-5">
      <legend className="text-sm font-medium">What is your judgement of the idea based on? Tick all that apply.</legend>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2 sm:gap-2">
        {OPTIONS.map(([b, label]) => {
          const on = value.includes(b);
          return (
            <label key={b} className={cn("flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control border px-3.5 py-2 text-sm font-medium transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
              on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-accent")}>
              <input type="checkbox" checked={on} onChange={() => toggle(b)} data-control={`study_basis_${b}`} className="sr-only" />
              <span aria-hidden className={cn("flex size-4 shrink-0 items-center justify-center rounded-sm border-2", on ? "border-primary-foreground" : "border-input")}>
                {on && <Check className="size-3" strokeWidth={3} />}
              </span>
              {label(tool)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
