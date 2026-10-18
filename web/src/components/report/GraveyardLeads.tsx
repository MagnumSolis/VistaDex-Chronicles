import { forwardRef } from "react";
import { CardLabel, Section } from "@/components/Section";
import { GRAVEYARD_DB } from "@/proto";
import type { GraveyardMatch } from "@/types";

// Leads are deliberately flat with a dashed outline: they are things to check, not evidence.
export const GraveyardLeads = forwardRef<HTMLDivElement, { matches: GraveyardMatch[] }>(function GraveyardLeads({ matches }, ref) {
  return (
    <div ref={ref}>
      <Section id="leads" title="Graveyard leads" count={matches.length}>
        {matches.length === 0 ? (
          <p className="rounded-card border-2 border-dashed border-border-strong p-6 text-[0.9375rem]">
            No close matches among the {GRAVEYARD_DB.length} failed startups in the seed set. That doesn&apos;t mean nobody has tried this.
          </p>
        ) : (
          <ul className="space-y-4">
            {matches.map(m => (
              <li key={m.company_name} className="rounded-card border-2 border-dashed border-border-strong p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardLabel>Lead to check</CardLabel>
                  <span className="rounded-full bg-card px-3 py-1 text-[0.8125rem]" title="Word overlap between this idea and what they tried: 0 = none, 1 = identical wording.">
                    Similarity <span className="font-mono font-medium">{m.similarity.toFixed(2)}</span>
                  </span>
                </div>
                <h3 className="mt-4 font-display text-xl font-bold leading-tight">
                  {m.company_name}
                  {m.year_closed != null && <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">closed {m.year_closed}</span>}
                </h3>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed">{m.what_they_tried}</p>
                <div className="mt-4 rounded-inner bg-card p-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Cause of death</p>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed">{m.cause_of_death}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {matches.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">Similarity is word overlap (0–1). A resemblance is a lead to verify, not a verdict.</p>
        )}
      </Section>
    </div>
  );
});
