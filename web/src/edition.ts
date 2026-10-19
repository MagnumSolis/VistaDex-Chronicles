// ── edition.ts — The ONE place that knows which edition is running ──
// One codebase, one build, two editions:
//   public (default) — anyone from the LinkedIn link: Welcome, walkthrough, telemetry, feedback; the
//                      Reports page lists the reports this browser has run (localStorage).
//   pitch            — the team, in investor pitches and for testing: Reports home with every screened
//                      idea (session + demo cohort), no walkthrough, no feedback and NO telemetry at all.
// Components read `features` and never compare edition names themselves (a test enforces this).
//
// The pitch edition is unlocked from the link fragment: …/#edition=pitch&code=<access code>.
// The flag is kept in sessionStorage for this tab and scrubbed from the address bar, like the code.
// TODO(team): backend enforcement of a separate pitch code. Today this is client-side only: anyone who
// knows the fragment gets the pitch edition (it only turns telemetry off and shows the demo cohort).

export type Edition = "public" | "pitch";

export type NavId = "home" | "reports" | "screen" | "how" | "contact";
export interface Features {
  /** Where "#/" lands. */
  home: "welcome" | "reports";
  welcome: boolean;
  walkthrough: boolean;
  telemetry: boolean;
  feedback: boolean;
  /** Where the Reports page's reports come from. */
  reportStore: "browser" | "session-and-demo";
  /** Small persistent header badge so the wrong edition is never demoed. */
  badge: string | null;
  nav: NavId[];
}

export function featuresFor(edition: Edition): Features {
  if (edition === "pitch") {
    return {
      home: "reports", welcome: false, walkthrough: false, telemetry: false, feedback: false,
      reportStore: "session-and-demo", badge: "Pitch edition",
      nav: ["home", "screen", "reports", "how", "contact"],
    };
  }
  return {
    home: "welcome", welcome: true, walkthrough: true, telemetry: true, feedback: true,
    reportStore: "browser", badge: null,
    nav: ["home", "screen", "reports", "how", "contact"],
  };
}

const KEY = "vistadex.edition";
const FIELD = "edition";

function stored(): Edition {
  try { return sessionStorage.getItem(KEY) === "pitch" ? "pitch" : "public"; } catch { return "public"; }
}

// Reads #edition=… from the fragment (keeping any other fragment parts, e.g. code=…, for access.js),
// remembers it for this tab and removes it from the address bar. Returns the edition in force.
export function captureEdition(loc: Pick<Location, "hash" | "pathname" | "search"> = location, hist: Pick<History, "replaceState" | "state"> = history): Edition {
  if (!loc.hash || loc.hash.startsWith("#/")) return stored();
  const params = new URLSearchParams(loc.hash.slice(1));
  const value = params.get(FIELD);
  if (value === null) return stored();
  const edition: Edition = value.trim().toLowerCase() === "pitch" ? "pitch" : "public";
  try { sessionStorage.setItem(KEY, edition); } catch { /* storage blocked: falls back to public on reload */ }
  params.delete(FIELD);
  const rest = params.toString();
  hist.replaceState(hist.state, "", loc.pathname + loc.search + (rest ? `#${rest}` : ""));
  return edition;
}

export const edition: Edition = captureEdition();
export const features: Features = featuresFor(edition);

// A later link with a different #edition= in the same tab reloads, so every feature switches together.
addEventListener("hashchange", () => {
  if (location.hash.startsWith("#/")) return;
  if (new URLSearchParams(location.hash.slice(1)).has(FIELD) && captureEdition() !== edition) location.reload();
});
