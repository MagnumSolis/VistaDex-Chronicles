import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted fonts (bundled by Vite; no font CDN at runtime).
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans-condensed/600.css";
import "@fontsource/ibm-plex-sans-condensed/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./index.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App } from "./App";
import { watchAccessCode } from "@proto/ui/access.js";

// Read #code=… from the participant link (now and on later fragment changes) and scrub it from
// the address bar before the app renders.
watchAccessCode();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
