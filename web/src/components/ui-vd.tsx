// ── ui-vd.tsx — VistaDex building blocks (see the design brief in CLAUDE.md) ──
// Page titles sit on the deep-green page; content sits in flat cream panels with folder-tab titles.
import type { HTMLAttributes, ReactNode } from "react";
import { Search, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Eyebrow + soft-serif title + lead, on the page. */
export function PageTitle({ eyebrow, title, children, aside, id }: { eyebrow?: string; title: string; children?: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-6 md:pb-10">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="eyebrow text-lime">{eyebrow}</p>}
        <h1 id={id} className="mt-2 font-display text-[2.5rem] font-normal leading-[1.02] text-on-page md:text-[3.75rem]">{title}</h1>
        {children && <div className="mt-4 max-w-[62ch] text-[1.0625rem] leading-relaxed text-on-page-muted">{children}</div>}
      </div>
      {aside}
    </header>
  );
}

/** Flat cream panel (no border, no shadow). `tab` adds a folder-tab title on its top-left edge. */
export function Panel({ children, className, tab, tabId, tone = "cream", as: Tag = "div", ...rest }: {
  children: ReactNode; className?: string; tab?: ReactNode; tabId?: string; tone?: "cream" | "lime" | "paper" | "charcoal";
  as?: "div" | "section" | "article" | "aside";
} & HTMLAttributes<HTMLElement>) {
  const bg = { cream: "bg-background text-foreground", lime: "bg-lime text-on-lime", paper: "bg-card text-foreground", charcoal: "bg-charcoal text-on-charcoal" }[tone];
  const ring = tone === "charcoal" ? "on-page" : "on-light";
  return (
    // overflow-x-clip: a tab as wide as the panel (long title at 320px) must not push its notch past the page edge.
    <Tag className={cn("relative min-w-0", ring, tab && "pt-11 overflow-x-clip", className)} {...rest}>
      {tab && (
        <div className={cn("tab-notch absolute left-0 top-0 h-12 rounded-t-[1.25rem] px-5 pt-3", bg)} style={{ ["--notch" as string]: `var(--${tone === "cream" ? "background" : tone === "paper" ? "card" : tone})` }}>
          <div id={tabId} className="font-display text-[1.375rem] leading-tight">{tab}</div>
        </div>
      )}
      <div className={cn("rounded-panel p-5 md:p-8", bg, tab && "rounded-tl-none")}>{children}</div>
    </Tag>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("eyebrow text-muted-foreground", className)}>{children}</p>;
}

/** Bento tile: lots of room, small line icon and a label anchored bottom-left. */
export function Tile({ icon: Icon, label, children, className }: { icon?: LucideIcon; label: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-40 flex-col justify-between gap-6 rounded-card p-5 md:p-6", className)}>
      <div className="text-[0.9375rem] leading-relaxed">{children}</div>
      <div className="flex items-center gap-2.5 font-medium">
        {Icon && <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />}
        <span>{label}</span>
      </div>
    </div>
  );
}

export function SearchField({ id, label, value, onChange, placeholder, control }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string; control: string;
}) {
  return (
    <div className="relative min-w-0 flex-1 md:max-w-sm">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id={id}
        type="search"
        data-control={control}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-control border border-input bg-card pl-10 pr-3 text-[0.9375rem] text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}

/** Single-choice chips (a radio group semantically). */
export function FilterChips<T extends string>({ label, options, value, onChange, control }: {
  label: string; options: { value: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void; control: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          data-control={control}
          data-control-value={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-control border px-3.5 text-sm font-medium transition-colors duration-150",
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:bg-accent",
          )}
        >
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

/** Neutral empty / not-available state (never styled as an error). */
export function EmptyState({ icon: Icon, title, children, action, className }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-card bg-muted p-5 md:p-6", className)}>
      <Icon aria-hidden className="size-6" strokeWidth={1.5} />
      <p className="font-display text-xl leading-snug">{title}</p>
      {children && <div className="max-w-[62ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{children}</div>}
      {action}
    </div>
  );
}

/** A problem the visitor should know about (run refused, failed …). Ink on paper, no status colour. */
export function Problem({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex gap-3 rounded-card border-2 border-foreground bg-card p-5 text-foreground">
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0 space-y-2">
        <p className="font-semibold">{title}</p>
        {children && <div className="text-[0.9375rem] leading-relaxed">{children}</div>}
        {action}
      </div>
    </div>
  );
}
