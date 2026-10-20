// ── RunProgress — elapsed timer + estimated progress bar for live runs.
// The server answers once (no per-stage updates), so progress is an honest
// time-based estimate: typical live runs complete in 45-90s. The bar is
// capped near 95% until the real result lands, so it never claims "done"
// before it is. Mock mode shows real stage completion instead.
import { useEffect, useState } from "react";
import { cn } from "cn";

const ESTIMATE_MS = 75_000; // typical live run

export function RunProgress({ running, doneCount, total, server }: {
  running: boolean;
  doneCount: number;
  total: number;
  server: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const started = performance.now();
    const t = window.setInterval(() => setElapsed(performance.now() - started), 250);
    return () => window.clearInterval(t);
  }, [running]);

  if (!running) return null;

  const pct = server
    ? Math.min(95, Math.round(100 * Math.min(elapsed / ESTIMATE_MS, 1)))
    : Math.round(100 * doneCount / total);
  const secs = Math.floor(elapsed / 1000);
  const remaining = server ? Math.max(1, Math.ceil((ESTIMATE_MS - elapsed) / 1000)) : null;

  return (
    <div className="mb-4 rounded-inner bg-charcoal-raised p-4" data-tour="run-progress">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.08em] text-lime">
          {server ? `About ${Math.min(75, Math.max(5, Math.ceil(ESTIMATE_MS / 1000 - secs)))}s to go` : `${doneCount}/${total} steps`}
        </span>
        <span className="font-mono text-sm tabular-nums text-on-charcoal-muted" aria-hidden>
          {pct}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={server ? "Screening progress (estimated)" : "Screening progress"}
        className="mt-2 h-2 overflow-hidden rounded-full bg-charcoal"
      >
        <div
          className={cn("h-full rounded-full bg-lime transition-[width] duration-300 ease-out", server && "motion-safe:animate-pulse")}
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-on-charcoal-muted">
        {server
          ? `Running ${secs}s${remaining ? ` · usually done in about a minute` : ""} — the estimate is honest, not a countdown`
          : "Each step finishes before the next starts."}
      </p>
    </div>
  );
}
