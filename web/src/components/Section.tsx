import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ id, title, count, aside, children, className }: {
  id?: string; title: string; count?: number; aside?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("min-w-0 scroll-mt-24", className)}>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-2">
        <h2 id={id ? `${id}-title` : undefined} className="text-base font-semibold tracking-tight">
          {title}
          {count !== undefined && <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">{count}</span>}
        </h2>
        {aside && <div className="text-xs text-muted-foreground">{aside}</div>}
      </header>
      {children}
    </section>
  );
}
