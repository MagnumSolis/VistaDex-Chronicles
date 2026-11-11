import { useEffect, type RefObject } from "react";
import { isPanelViewed, OBSERVER_THRESHOLDS } from "./viewRule";
import { claimInView, sectionInView } from "./index";

// Reports when a report section is "in view" by the panel-viewed rule (≥ 50 % of the section OR
// ≥ 50 % of the viewport covered by it), for time-per-section and the first-view panel events.
export function useSectionInView(ref: RefObject<HTMLElement | null>, section: string, runId: string | null) {
  useInViewRule(ref, runId, (id, now) => sectionInView(id, section, now), section);
}

/** The same rule for one claim card: reading time per claim (claim_dwell). */
export function useClaimInView(ref: RefObject<HTMLElement | null>, claimIndex: number, runId: string | null) {
  useInViewRule(ref, runId, (id, now) => claimInView(id, claimIndex, now), claimIndex);
}

function useInViewRule(ref: RefObject<HTMLElement | null>, runId: string | null, report: (runId: string, inView: boolean) => void, key: string | number) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !runId || !("IntersectionObserver" in window)) return;
    let inView = false;
    const io = new IntersectionObserver(entries => {
      for (const en of entries) {
        const now = en.isIntersecting && isPanelViewed({
          visibleHeight: en.intersectionRect.height,
          panelHeight: en.boundingClientRect.height,
          viewportHeight: en.rootBounds?.height ?? window.innerHeight,
        });
        if (now !== inView) { inView = now; report(runId, now); }
      }
    }, { threshold: OBSERVER_THRESHOLDS });
    io.observe(el);
    return () => { io.disconnect(); if (inView) report(runId, false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report is rebuilt each render; key identifies it
  }, [ref, key, runId]);
}
