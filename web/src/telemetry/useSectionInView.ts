import { useEffect, type RefObject } from "react";
import { isPanelViewed, OBSERVER_THRESHOLDS } from "./viewRule";
import { sectionInView } from "./index";

// Reports when a report section is "in view" by the panel-viewed rule (≥ 50 % of the section OR
// ≥ 50 % of the viewport covered by it), for time-per-section and the first-view panel events.
export function useSectionInView(ref: RefObject<HTMLElement | null>, section: string, runId: string | null) {
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
        if (now !== inView) { inView = now; sectionInView(runId, section, now); }
      }
    }, { threshold: OBSERVER_THRESHOLDS });
    io.observe(el);
    return () => { io.disconnect(); if (inView) sectionInView(runId, section, false); };
  }, [ref, section, runId]);
}
