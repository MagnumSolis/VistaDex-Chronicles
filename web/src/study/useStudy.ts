import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import * as study from "./controller";

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

// Reports a panel as viewed once it is ≥ 50 % visible (same rule as the vanilla UI).
export function usePanelViewed(ref: RefObject<HTMLElement | null>, name: "objections_viewed" | "graveyard_viewed", runId: string | null) {
  const done = useRef(false);
  useEffect(() => {
    done.current = false;
    const el = ref.current;
    if (!el || !runId || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (!en.isIntersecting || done.current) continue;
        done.current = true;
        study.panelViewed(name, runId);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, name, runId]);
}
