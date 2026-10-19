import { SeverityTag } from "@/components/status";
import { CardLabel } from "./ReportSection";
import type { Objection } from "@/types";

// Same card, type size and spacing as a claim: objections carry equal visual weight.
export function Objections({ objections }: { objections: Objection[] }) {
  if (objections.length === 0) {
    return <p className="rounded-card bg-card p-5 text-[0.9375rem]">No objections were raised. That is not an endorsement.</p>;
  }
  return (
    <ol className="space-y-4" data-tour="objections">
      {objections.map((o, i) => (
        <li key={i} className="rounded-card bg-card p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardLabel n={i + 1}>Objection</CardLabel>
            <SeverityTag severity={o.severity} />
          </div>
          <p className="mt-4 text-[1.125rem] leading-relaxed text-foreground">{o.objection}</p>
        </li>
      ))}
    </ol>
  );
}
