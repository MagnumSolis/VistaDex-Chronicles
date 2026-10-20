// Donut of claim outcomes: all four statuses in the status palette (with gaps between segments), the
// total in the centre, and a legend with each status's label and icon — readable without colour.
// A visually hidden table carries the same numbers.
import { useId } from "react";
import { cn } from "@/lib/utils";
import { STATUS, STATUS_ORDER } from "@/components/status";
import type { ClaimStatus } from "@/types";

const R = 54, STROKE = 18, C = 2 * Math.PI * R, GAP = 3;
const COLOR: Record<ClaimStatus, string> = {
  confirmed: "var(--st-confirmed)", contradicted: "var(--st-contradicted)", disputed: "var(--st-disputed)", unverified: "var(--st-unverified)",
};

export function Donut({ counts, caption }: { counts: Record<ClaimStatus, number>; caption: string }) {
  const id = useId();
  const total = STATUS_ORDER.reduce((s, k) => s + counts[k], 0);
  const present = STATUS_ORDER.filter(s => counts[s] > 0);
  let offset = 0;
  return (
    <figure className="min-w-0">
      <svg viewBox="-80 -80 160 160" role="img" aria-labelledby={`${id}-cap`} className="mx-auto block w-full max-w-[13rem]">
        <circle r={R} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
        {present.map(s => {
          const len = (C * counts[s]) / total;
          const gap = present.length > 1 ? GAP : 0;
          const seg = <circle key={s} r={R} fill="none" stroke={COLOR[s]} strokeWidth={STROKE} transform="rotate(-90)"
            strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`} strokeDashoffset={-offset} />;
          offset += len;
          return seg;
        })}
        <text y={6} textAnchor="middle" fontFamily="var(--font-display)" fontSize={34} fill="var(--foreground)">{total}</text>
        <text y={26} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{total === 1 ? "claim" : "claims"}</text>
      </svg>
      <figcaption id={`${id}-cap`} className="sr-only">{caption}</figcaption>
      <ul aria-hidden className="mt-3 grid grid-cols-2 gap-1.5 text-sm">
        {STATUS_ORDER.map(s => {
          const Icon = STATUS[s].icon;
          return (
            <li key={s} className={cn("flex items-center gap-1.5 rounded-control px-2 py-1 font-medium", STATUS[s].bg)}>
              <Icon className={cn("size-4 shrink-0", STATUS[s].text)} strokeWidth={2} /> {STATUS[s].label} <span className="ml-auto font-mono">{counts[s]}</span>
            </li>
          );
        })}
      </ul>
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Status</th><th scope="col">Claims</th></tr></thead>
        <tbody>{STATUS_ORDER.map(s => <tr key={s}><th scope="row">{STATUS[s].label}</th><td>{counts[s]}</td></tr>)}<tr><th scope="row">Total</th><td>{total}</td></tr></tbody>
      </table></div>
    </figure>
  );
}
