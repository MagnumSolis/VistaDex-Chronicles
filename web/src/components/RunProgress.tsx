// ── RunProgress — elapsed timer + estimated progress bar for live runs.
// The server answers once (no per-stage updates), so progress is an honest
// time-based estimate: typical live runs complete in 45-90s. The bar fills
// linearly to 95% over ESTIMATE_MS; past it, it keeps creeping towards 99%,
// slower and slower, and never reaches it, so it never claims "done" before
// the result lands and never looks frozen. Mock mode shows real stage completion.
import { useEffect, useState } from "react";
import { cn } from "cn";

export const ESTIMATE_MS = 75_000; // typical live run
/** Longest a live run should take: mirrors the Worker's RUN_DEADLINE_MS (worker/wrangler.toml). */
export const RUN_CAP_MS = 150_000;
const SLOW_EASE_MS = 40_000; // how quickly the bar creeps towards 99% after ESTIMATE_MS

/** Estimated progress of a live run, in % (one decimal past ESTIMATE_MS): rises with time, below 99, never 100. */
export function estimatedPct(elapsed: number): number {
  if (elapsed <= ESTIMATE_MS) return Math.min(95, Math.round(100 * elapsed / ESTIMATE_MS));
  const slow = 95 + 4 * (1 - Math.exp(-(elapsed - ESTIMATE_MS) / SLOW_EASE_MS));
  return Math.min(98.9, Math.floor(slow * 10) / 10); // float rounding would hit 99 after ~20 min
}

// 150 000 ms → "2½ minutes"
function minutesText(ms: number): string {
  const whole = Math.floor(ms / 60_000);
  const half = ms % 60_000 >= 30_000;
  return `${whole}${half ? "½" : ""} minute${whole === 1 && !half ? "" : "s"}`;
}

export function RunProgress({ running, doneCount, total, server, startedAt }: {
  running: boolean;
  doneCount: number;
  total: number;
  server: boolean;
  /** performance.now() when the run started (run state), not when this was drawn. */
  startedAt: number;
}) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!running) return;
    setNow(performance.now());
    const t = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(t);
  }, [running]);
  const elapsed = Math.max(0, now - startedAt);

  if (!running) return null;

  const pct = server ? estimatedPct(elapsed) : Math.round(100 * doneCount / total);
  const secs = Math.floor(elapsed / 1000);
  const slow = server && elapsed > ESTIMATE_MS;
  const estimateSecs = ESTIMATE_MS / 1000;

  return (
    <div className="mb-4 rounded-inner bg-charcoal-raised p-4" data-tour="run-progress">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.08em] text-lime">
          {!server ? `${doneCount}/${total} steps`
            : slow ? "Taking longer than usual"
            : `About ${Math.min(estimateSecs, Math.max(5, Math.ceil(estimateSecs - secs)))}s to go`}
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
        {!server ? "Each step finishes before the next starts."
          : slow ? `Running ${secs}s · some sources are slow; it should finish within ${minutesText(RUN_CAP_MS)}`
          : `Running ${secs}s · usually done in about a minute — the estimate is honest, not a countdown`}
      </p>
    </div>
  );
}
