import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSectionInView } from "@/telemetry/useSectionInView";

export type SectionId = "summary" | "profile" | "claims" | "graveyard" | "objections" | "big_tech" | "legal" | "market";
export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "profile", label: "Profile" },
  { id: "claims", label: "Claims" },
  { id: "graveyard", label: "Leads to check" },
  { id: "objections", label: "Objections" },
  { id: "big_tech", label: "Big Tech risk" },
  { id: "legal", label: "Legal" },
  { id: "market", label: "Market" },
];

/** A report section: cream panel with a folder-tab title (and count), time-in-view tracked. */
export function ReportSection({ id, title, count, intro, runId, children, className }: {
  id: SectionId; title: string; count?: number; intro?: ReactNode; runId: string | null; children: ReactNode; className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useSectionInView(ref, id, runId);
  return (
    <section ref={ref} id={`section-${id}`} aria-labelledby={`section-${id}-title`} className={cn("on-light relative min-w-0 scroll-mt-32 pt-11 md:scroll-mt-28", className)}>
      <div className="tab-notch absolute left-0 top-0 flex h-12 items-center gap-2.5 rounded-t-[1.25rem] bg-background px-5 text-foreground" style={{ ["--notch" as string]: "var(--background)" }}>
        <h2 id={`section-${id}-title`} tabIndex={-1} className="font-display text-[1.5rem] leading-none outline-none">{title}</h2>
        {count !== undefined && (
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-control bg-page px-1.5 font-mono text-sm text-lime" aria-label={`${count} items`}>{count}</span>
        )}
      </div>
      <div className="rounded-panel rounded-tl-none bg-background p-4 text-foreground sm:p-5 md:p-8">
        {intro && <div className="mb-5 max-w-[68ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{intro}</div>}
        {children}
      </div>
    </section>
  );
}

/** Card header: number chip + small uppercase label (claims and objections share it, equal weight). */
export function CardLabel({ n, children }: { n?: number; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {n !== undefined && (
        <span className="inline-flex size-7 items-center justify-center rounded-control bg-muted font-mono text-xs font-medium text-foreground">{n}</span>
      )}
      <span className="eyebrow text-muted-foreground">{children}</span>
    </span>
  );
}
