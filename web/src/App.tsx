import { useEffect, useRef, useSyncExternalStore } from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageTitle } from "@/components/ui-vd";
import { features } from "@/edition";
import { lastNavigation, navigate, PATHS, useRoute, type Route, type RouteName } from "@/router";
import { Shell } from "@/shell/Shell";
import * as telemetry from "@/telemetry";
import { Welcome } from "@/screens/Welcome";
import { StudyGate } from "@/study/StudyGate";
import { BaselineSession } from "@/study/BaselineSession";
import { currentParticipant, nextCondition, conditionDone, markConditionDone } from "@/study/participant";
import { ScreenIdea } from "@/screens/ScreenIdea";
import { Running } from "@/screens/Running";
import { ReportScreen } from "@/screens/ReportScreen";
import { Reports } from "@/screens/Reports";
import { Contact } from "@/screens/Contact";
import { Home } from "@/screens/Home";
import { rememberTarget } from "@/lib/gate";
import { HowItWorks } from "@/screens/HowItWorks";
import { Feedback } from "@/screens/Feedback";
import { startWalkthrough, Walkthrough } from "@/walkthrough/Walkthrough";

// Routes an edition does not have.
function available(name: RouteName) {
  if (name === "welcome") return features.welcome;
  if (name === "feedback") return features.feedback;
  return true;
}
// Before the Welcome notice is answered (public, first visit), only pages that record nothing can be
// read: Home, Welcome, How it works and Contact us.
const beforeNotice = (name: RouteName) => !["home", "welcome", "study", "how", "contact"].includes(name);
// A fresh load of the pitch edition opens on Reports; after that, Home is the landing page.
let firstRoute = true;

export function App() {
  const route = useRoute();
  useSyncExternalStore(telemetry.subscribe, telemetry.getVersion);
  const answered = telemetry.noticeAnswered();

  useEffect(() => { telemetry.installControlTracking(); telemetry.installLifecycle(); }, []);

  // Redirects: routes this edition lacks go to its start page; pages that record go behind the Welcome
  // notice on a first visit (and continue to the page asked for afterwards).
  useEffect(() => {
    const first = firstRoute;
    firstRoute = false;
    if (route.name === "home" && first && features.home === "reports") {
      navigate(PATHS.reports, { replace: true });
    } else if (route.name !== "notfound" && route.name !== "home" && !available(route.name)) {
      navigate(features.home === "reports" ? PATHS.reports : PATHS.screen, { replace: true });
    } else if (!answered && beforeNotice(route.name)) {
      rememberTarget(route.path);
      navigate(PATHS.welcome, { replace: true });
    }
  }, [route.name, route.path, answered]);

  useEffect(() => {
    telemetry.screenChanged(screenName(route.name));
  }, [route.name]);

  // After moving to another screen, start at the top with focus on the content (not on first load,
  // so the skip link stays the first Tab stop).
  const previous = useRef<RouteName | null>(null);
  useEffect(() => {
    const from = previous.current;
    previous.current = route.name;
    // First load, and redirects (replace), keep focus where it is: the skip link stays the first Tab stop.
    if (from === null || lastNavigation() === "replace") return;
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [route.path]);

  return (
    <Shell route={route.name} onHelp={features.walkthrough ? () => startWalkthrough("help") : undefined}>
      <Screen route={route} />
      {features.walkthrough && <Walkthrough route={route.name} />}
    </Shell>
  );
}

const screenName = (n: RouteName) => (n === "how" ? "how_it_works" : n);

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case "home": return <Home />;
    case "welcome": return <Welcome onStartWalkthrough={() => startWalkthrough("welcome")} />;
    case "study": return <StudyGate onDone={() => navigate("/welcome")} />;
    case "baseline": {
      const p = currentParticipant();
      if (!p || p.track !== "study") { navigate("/study"); return null; }
      return <BaselineSession participant={p} onDone={() => { markConditionDone("baseline"); if (!conditionDone(p, "vistadex")) navigate("/screen"); }} />;
    }
    case "screen": return <ScreenIdea />;
    case "running": return <Running />;
    case "report": return <ReportScreen param={route.param} />;
    case "reports": return <Reports />;
    case "contact": return <Contact />;
    case "how": return <HowItWorks onReplay={features.walkthrough ? () => startWalkthrough("how_it_works") : undefined} />;
    case "feedback": return <Feedback />;
    case "notfound": return <NotFound />;
    default: return null;
  }
}

function NotFound() {
  return (
    <div>
      <PageTitle eyebrow="Not found" title="There's nothing at this address" />
      <div className="on-light max-w-xl text-foreground">
        <EmptyState icon={Compass} title="This page doesn't exist."
          action={<Button size="lg" onClick={() => navigate("/")} data-control="notfound_home">Go to the start</Button>}>
          Reports are not shared by link: each visitor sees only the reports they ran in their own tab.
        </EmptyState>
      </div>
    </div>
  );
}
