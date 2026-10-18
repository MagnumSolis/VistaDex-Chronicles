import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Section title in the condensed display face; the count sits in a round chip.
export function Section({ id, title, count, children, className }: {
  id?: string; title: string; count?: number; children: ReactNode; className?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("min-w-0 scroll-mt-28", className)}>
      <h2 id={id ? `${id}-title` : undefined} className="mb-4 flex items-center gap-3 font-display text-[1.75rem] font-bold leading-none tracking-tight">
        {title}
        {count !== undefined && (
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-card font-mono text-sm font-medium shadow-card">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}

// Small uppercase card-header label with an optional number chip (claims and objections are numbered lists).
export function CardLabel({ n, children }: { n?: number; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {n !== undefined && (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted font-mono text-xs font-medium text-foreground">{n}</span>
      )}
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</span>
    </span>
  );
}
