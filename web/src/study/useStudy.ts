import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import * as study from "./controller";
import { isPanelViewed, OBSERVER_THRESHOLDS } from "./viewRule";

// Re-render when consent, trust or run state changes.
export function useStudyState() {
  useSyncExternalStore(study.subscribe, study.getVersion);
  return {
    consent: study.consentStatus(),
    participating: study.participating(),
    trustPreDone: study.trustPreDone(),
    sessionCode: study.sessionCode(),
    currentRunId: study.currentRunId(),
  };
}

// Reports a panel as viewed once per run, using the rule in viewRule.ts
// (≥ 50 % of the panel OR ≥ 50 % of the viewport covered by it).
export function usePanelViewed(ref: RefObject<HTMLElement | null>, name: "objections_viewed" | "graveyard_viewed", runId: string | null) {
  const done = useRef(false);
  useEffect(() => {
    done.current = false;
    const el = ref.current;
    if (!el || !runId || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (!en.isIntersecting || done.current) continue;
        const viewed = isPanelViewed({
          visibleHeight: en.intersectionRect.height,
          panelHeight: en.boundingClientRect.height,
          viewportHeight: en.rootBounds?.height ?? window.innerHeight,
        });
        if (!viewed) continue;
        done.current = true;
        study.panelViewed(name, runId);
        io.disconnect();
      }
    }, { threshold: OBSERVER_THRESHOLDS });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, name, runId]);
}
