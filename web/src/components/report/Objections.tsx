import { forwardRef } from "react";
import { SeverityTag } from "@/components/status";
import { Section } from "@/components/Section";
import type { Objection } from "@/types";

export const Objections = forwardRef<HTMLDivElement, { objections: Objection[] }>(function Objections({ objections }, ref) {
  return (
    <div ref={ref}>
      <Section id="objections" title="Objections" count={objections.length} aside="A separate pass that only argues against the draft">
        {objections.length === 0 ? (
          <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">The Objector raised no objections. That is not an endorsement.</p>
        ) : (
          <ol className="space-y-3">
            {objections.map((o, i) => (
              <li key={i} className="rounded-lg border bg-card p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Objection {i + 1}</span>
                  <SeverityTag severity={o.severity} />
                </div>
                <p className="mt-2.5 text-[0.9375rem] leading-relaxed">{o.objection}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
});
