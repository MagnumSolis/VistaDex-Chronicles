// ── GraveyardCounter — "924 shut-down startups confirmed", counted up from 0 on Home ──
// The number is the live graveyard's size (every entry has two independent pages stating the shutdown),
// fetched from the Worker. It counts up once, in about 1.6 s; under prefers-reduced-motion it shows the
// final number at once. Screen readers get the final number only, never the moving one.
import { useEffect, useState } from "react";
import { fetchGraveyardStats, type GraveyardStats } from "@/lib/graveyardStats";

export const COUNT_UP_MS = 1600;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function useCountUp(target: number, ms = COUNT_UP_MS) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(easeOut(t) * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

function ago(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return null;
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

export function GraveyardCounter({ load = fetchGraveyardStats }: { load?: () => Promise<GraveyardStats | null> }) {
  const [stats, setStats] = useState<GraveyardStats | null>(null);
  useEffect(() => { let live = true; load().then(s => { if (live) setStats(s); }); return () => { live = false; }; }, [load]);
  const shown = useCountUp(stats?.confirmed ?? 0);
  if (!stats) return null;
  const updated = ago(stats.updated_at);
  return (
    <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-on-page" data-testid="graveyard-counter">
      <span aria-hidden className="font-display text-[2.5rem] leading-none tabular-nums text-lime">{shown.toLocaleString("en-IN")}</span>
      <span aria-hidden className="max-w-[34ch] text-[0.9375rem] leading-snug text-on-page-muted">
        shut-down startups in the graveyard, each confirmed by two independent sources{updated ? `. Updated ${updated}.` : "."}
      </span>
      <span className="sr-only">{stats.confirmed.toLocaleString("en-IN")} shut-down startups in the graveyard, each confirmed by two independent sources{updated ? `. Updated ${updated}.` : "."}</span>
    </p>
  );
}
