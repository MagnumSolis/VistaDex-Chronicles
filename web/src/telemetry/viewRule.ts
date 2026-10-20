// ── viewRule.ts — When a report panel counts as "viewed" (from study_version 2026-10-pilot-2) ──
// A panel is viewed when at least half of its own height is on screen, OR when it covers at
// least half of the viewport. The second clause fixes pilot-1, where a panel taller than twice
// the viewport (common on phones) could never reach 50 % of itself and so never reported.

export const VIEWED_FRACTION = 0.5;

export function isPanelViewed({ visibleHeight, panelHeight, viewportHeight }: {
  visibleHeight: number; panelHeight: number; viewportHeight: number;
}): boolean {
  if (visibleHeight <= 0 || panelHeight <= 0 || viewportHeight <= 0) return false;
  return visibleHeight >= VIEWED_FRACTION * panelHeight || visibleHeight >= VIEWED_FRACTION * viewportHeight;
}

// IntersectionObserver thresholds fine enough to notice either condition being crossed.
export const OBSERVER_THRESHOLDS = Array.from({ length: 41 }, (_, i) => i / 40);
