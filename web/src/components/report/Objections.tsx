import { forwardRef } from "react";
import { SeverityTag } from "@/components/status";
import { CardLabel, Section } from "@/components/Section";
import type { Objection } from "@/types";

export const Objections = forwardRef<HTMLDivElement, { objections: Objection[] }>(function Objections({ objections }, ref) {
  return (
    <div ref={ref}>
      <Section id="objections" title="Objections" count={objections.length}>
        {objections.length === 0 ? (
          <p className="rounded-card bg-card p-6 text-[0.9375rem] shadow-card">No objections were raised. That is not an endorsement.</p>
        ) : (
          <ol className="space-y-4">
            {objections.map((o, i) => (
              <li key={i} className="rounded-card bg-card p-5 shadow-card sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardLabel n={i + 1}>Objection</CardLabel>
                  <SeverityTag severity={o.severity} />
                </div>
                <p className="mt-4 text-[1.0625rem] leading-relaxed">{o.objection}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
});
