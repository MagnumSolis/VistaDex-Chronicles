import { useEffect, useRef, useState } from "react";
import { features } from "@/edition";
import { navigate, useRoute, type RouteName } from "@/router";
import { Shell } from "@/shell/Shell";
import * as study from "@/study/controller";
import { ScreenIdea } from "@/screens/ScreenIdea";
import { Dashboard } from "@/screens/Dashboard";
import { Graveyard } from "@/screens/Graveyard";
import { ConsentDialog } from "@/study/StudyUI";
import type { ViewName } from "@/types";

// Routes an edition does not have fall back to its home screen.
function allowed(name: RouteName) {
  if (name === "dashboard") return features.dashboard;
  return name === "screen" || name === "graveyard";
}

export function App() {
  const route = useRoute();
  const [consentOpen, setConsentOpen] = useState(false);
  const resumeAfterConsent = useRef<(() => void) | null>(null);
  const home = features.dashboard ? "/dashboard" : "/screen";

  useEffect(() => { study.init(); }, []);
  useEffect(() => {
    if (route.name === "home" || !allowed(route.name)) { navigate(home, { replace: true }); return; }
    if (study.viewChanged(route.name as ViewName)) setConsentOpen(true);
  }, [route.name, home]);

  return (
    <Shell route={route.name} onHelp={() => {}}>
      {/* Screens stay mounted (hidden when inactive) so a report survives switching screens. */}
      <div className="on-light rounded-panel bg-background p-4 text-foreground md:p-8">
        {features.dashboard && <div hidden={route.name !== "dashboard"}><Dashboard /></div>}
        <div hidden={route.name !== "screen"}>
          <ScreenIdea onReadStudyInfo={() => setConsentOpen(true)} onNeedConsent={resume => { resumeAfterConsent.current = resume; setConsentOpen(true); }} />
        </div>
        <div hidden={route.name !== "graveyard"}><Graveyard /></div>
      </div>
      <ConsentDialog open={consentOpen} onDone={() => {
        setConsentOpen(false);
        const resume = resumeAfterConsent.current;
        resumeAfterConsent.current = null;
        resume?.();
      }} />
    </Shell>
  );
}
