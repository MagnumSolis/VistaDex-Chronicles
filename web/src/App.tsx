import { useEffect, useRef, useSyncExternalStore } from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageTitle } from "@/components/ui-vd";
import { features } from "@/edition";
import { navigate, PATHS, useRoute, type Route, type RouteName } from "@/router";
import { Shell } from "@/shell/Shell";
import * as telemetry from "@/telemetry";
import { Welcome } from "@/screens/Welcome";
import { ScreenIdea } from "@/screens/ScreenIdea";
import { Running } from "@/screens/Running";
import { ReportScreen } from "@/screens/ReportScreen";
import { Reports } from "@/screens/Reports";
import { Graveyard } from "@/screens/Graveyard";
import { HowItWorks } from "@/screens/HowItWorks";
import { Feedback } from "@/screens/Feedback";
import { startWalkthrough, Walkthrough } from "@/walkthrough/Walkthrough";

// Routes an edition does not have.
function available(name: RouteName) {
  if (name === "welcome") return features.welcome;
  if (name === "feedback") return features.feedback;
  return true;
}
// Before the Welcome notice is answered (public, first visit), only Welcome and How it works
// (linked from the notice, for reading first) are shown.
const beforeNotice = (name: RouteName) => name !== "welcome" && name !== "how";

export function App() {
  const route = useRoute();
  useSyncExternalStore(telemetry.subscribe, telemetry.getVersion);
  const answered = telemetry.noticeAnswered();

  useEffect(() => { telemetry.installControlTracking(); telemetry.installLifecycle(); }, []);

  // Redirects: "#/" goes home; routes this edition lacks go home; first visit goes to Welcome.
  useEffect(() => {
    if (route.name === "home") {
      navigate(features.home === "reports" ? PATHS.reports : answered ? PATHS.screen : PATHS.welcome, { replace: true });
    } else if (route.name !== "notfound" && !available(route.name)) {
      navigate(features.home === "reports" ? PATHS.reports : PATHS.screen, { replace: true });
    } else if (!answered && beforeNotice(route.name)) {
      navigate(PATHS.welcome, { replace: true });
    }
  }, [route.name, answered]);

  useEffect(() => {
    if (route.name !== "home") telemetry.screenChanged(screenName(route.name));
  }, [route.name]);

  // After moving to another screen, start at the top with focus on the content (not on first load,
  // so the skip link stays the first Tab stop).
  const previous = useRef<RouteName | null>(null);
  useEffect(() => {
    const from = previous.current;
    previous.current = route.name;
    if (from === null || from === "home") return; // first load, or its redirect from "#/"
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
    case "welcome": return <Welcome onStartWalkthrough={() => startWalkthrough("welcome")} />;
    case "screen": return <ScreenIdea />;
    case "running": return <Running />;
    case "report": return <ReportScreen param={route.param} />;
    case "reports": return <Reports />;
    case "graveyard": return <Graveyard />;
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
