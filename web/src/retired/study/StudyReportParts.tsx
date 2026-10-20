// ── Retired from the report (2026-10 revamp): per-claim agreement rating and the reviewer notes box ──
// Kept, not routed, so the BITS F364 study instruments can be restored. See README.md in this folder.
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { studyConfig } from "@/proto";
import * as study from "./controller";
import type { Claim } from "@/types";

export function ClaimRating({ claim, index }: { claim: Claim; index: number }) {
  const [rating, setRating] = useState<string | null>(null);
  return (
    <fieldset className="grid grid-cols-3 gap-2 border-t px-5 py-4 sm:px-6">
      <legend className="sr-only">{studyConfig.CLAIM_RATING.prompt} Claim {index + 1}</legend>
      <span aria-hidden className="col-span-3 mb-1 text-sm font-medium">{studyConfig.CLAIM_RATING.prompt}</span>
      {studyConfig.CLAIM_RATING.options.map((o: { value: string; label: string }) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={rating === o.value}
          onClick={() => { setRating(o.value); study.claimRated(index, claim.type, claim.status, o.value); }}
          className={cn(
            "h-10 rounded-full border px-3 text-sm transition-colors duration-150",
            rating === o.value ? "border-primary bg-primary font-medium text-primary-foreground" : "border-input bg-card hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

export function ReviewerNotes({ runId }: { runId: string | null }) {
  return (
    <div className="rounded-card bg-card p-5 sm:p-6">
      <Label htmlFor={`notes-${runId ?? "demo"}`} className="font-display text-xl font-bold">Your notes</Label>
      <Textarea
        id={`notes-${runId ?? "demo"}`}
        className="mt-3 min-h-28"
        placeholder="Anything you want to remember about this idea"
        onBlur={e => study.notesEdited(e.currentTarget.value.length)}
      />
    </div>
  );
}
