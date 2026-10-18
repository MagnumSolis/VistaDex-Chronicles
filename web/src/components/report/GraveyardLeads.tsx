import { forwardRef } from "react";
import { Section } from "@/components/Section";
import { GRAVEYARD_DB } from "@/proto";
import type { GraveyardMatch } from "@/types";

export const GraveyardLeads = forwardRef<HTMLDivElement, { matches: GraveyardMatch[] }>(function GraveyardLeads({ matches }, ref) {
  return (
    <div ref={ref}>
      <Section id="leads" title="Graveyard leads" count={matches.length} aside="Past startups that tried something similar — leads to check, never verdicts">
        {matches.length === 0 ? (
          <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">No close matches in the graveyard seed set ({GRAVEYARD_DB.length} entries). That does not mean nobody has tried this.</p>
        ) : (
          <ul className="space-y-3">
            {matches.map(m => (
              <li key={m.company_name} className="rounded-lg border border-dashed border-border-strong bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lead to check</span>
                  <span className="font-mono text-xs text-muted-foreground" title="Word-overlap similarity between this idea and what they tried. 0 = no overlap, 1 = identical wording.">
                    similarity {m.similarity.toFixed(2)} <span className="font-sans">(word overlap, 0–1)</span>
                  </span>
                </div>
                <h3 className="mt-2 text-[0.9375rem] font-semibold">
                  {m.company_name}
                  {m.year_closed != null && <span className="ml-2 font-normal text-muted-foreground">closed {m.year_closed}</span>}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground/90">{m.what_they_tried}</p>
                <dl className="mt-3 border-t pt-3 text-sm">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cause of death</dt>
                  <dd className="mt-1 leading-relaxed">{m.cause_of_death}</dd>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">Verify this yourself — a resemblance is a lead, not a conclusion.</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
});
