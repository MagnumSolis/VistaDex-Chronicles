// Small VistaDex building blocks shared by the dashboard and graveyard screens.
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, children, aside }: { title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pt-2">
      <div>
        <h1 className="font-display text-[2.75rem] font-bold leading-[0.95] tracking-tight sm:text-[3.5rem]">{title}</h1>
        {children && <div className="mt-3 max-w-[62ch] text-[1.0625rem] leading-relaxed text-muted-foreground">{children}</div>}
      </div>
      {aside}
    </header>
  );
}

export function SearchField({ id, label, value, onChange, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-sm">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-full border border-input bg-card pl-11 pr-4 text-[0.9375rem] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
      />
    </div>
  );
}

// Single-choice filter pills (a radio group semantically).
export function FilterPills<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-10 rounded-full px-4 text-sm font-medium transition-colors duration-150",
            value === o.value ? "bg-primary text-primary-foreground" : "bg-card text-foreground shadow-card hover:bg-accent",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
