import { useEffect, useSyncExternalStore } from "react";
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
import { Dashboard } from "@/screens/Dashboard";
import { Graveyard } from "@/screens/Graveyard";
import { HowItWorks } from "@/screens/HowItWorks";

// Routes an edition does not have.
function available(name: RouteName) {
  if (name === "dashboard") return features.dashboard;
  if (name === "welcome") return features.welcome;
  if (name === "feedback") return false; // added in a later screen
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
      navigate(features.home === "dashboard" ? PATHS.dashboard : answered ? PATHS.screen : PATHS.welcome, { replace: true });
    } else if (route.name !== "notfound" && !available(route.name)) {
      navigate(features.home === "dashboard" ? PATHS.dashboard : PATHS.screen, { replace: true });
    } else if (!answered && beforeNotice(route.name)) {
      navigate(PATHS.welcome, { replace: true });
    }
  }, [route.name, answered]);

  useEffect(() => {
    if (route.name !== "home") telemetry.screenChanged(screenName(route.name));
  }, [route.name]);

  useEffect(() => {
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [route.path]);

  return (
    <Shell route={route.name}>
      <Screen route={route} />
    </Shell>
  );
}

const screenName = (n: RouteName) => (n === "how" ? "how_it_works" : n);

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case "welcome": return <Welcome onStartWalkthrough={() => navigate(PATHS.screen)} />;
    case "screen": return <ScreenIdea />;
    case "running": return <Running />;
    case "report": return <ReportScreen param={route.param} />;
    case "dashboard": return <Dashboard />;
    case "graveyard": return <Graveyard />;
    case "how": return <HowItWorks />;
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
