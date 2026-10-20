// ── router.ts — Hash routes (#/screen, #/report/idea-01 …) ──
// Hash routing keeps the static GitHub Pages build working on any sub-path. Fragments that are not
// routes (#edition=…, #code=…) are read and scrubbed by edition.ts / access.js before the app renders.
import { useSyncExternalStore } from "react";

export type RouteName = "home" | "welcome" | "study" | "baseline" | "screen" | "running" | "report" | "reports" | "how" | "contact" | "feedback" | "notfound";
export interface Route { name: RouteName; param: string | null; path: string }

const TABLE: Record<string, RouteName> = {
  "": "home", welcome: "welcome", study: "study", baseline: "baseline", screen: "screen", running: "running", report: "report",
  reports: "reports", dashboard: "reports", "how-it-works": "how", contact: "contact", feedback: "feedback",
};

export const PATHS: Record<Exclude<RouteName, "home" | "notfound">, string> = {
  welcome: "/welcome", study: "/study", baseline: "/baseline", screen: "/screen", running: "/running", report: "/report",
  reports: "/reports", how: "/how-it-works", contact: "/contact", feedback: "/feedback",
};

export function parse(hash: string): Route {
  const path = hash.startsWith("#/") ? hash.slice(1) : "/";
  const [first = "", second = null, ...rest] = path.slice(1).split("/").filter((p, i) => p !== "" || i === 0);
  const name = rest.length ? undefined : TABLE[first];
  if (!name || (second !== null && name !== "report")) return { name: "notfound", param: null, path };
  return { name, param: second ? decodeURIComponent(second) : null, path };
}

let current = parse(location.hash);
// How the current route was reached: "replace" for redirects (which must not move focus), else "push".
let lastKind: "push" | "replace" = "push";
export const lastNavigation = () => lastKind;
const listeners = new Set<() => void>();
function update(kind: "push" | "replace" = "push") {
  const next = parse(location.hash);
  if (next.path === current.path) return;
  current = next;
  lastKind = kind;
  listeners.forEach(l => l());
}
addEventListener("hashchange", () => update("push"));

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export const getRoute = () => current;

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getRoute);
}

/** Go to a path such as "/screen" or "/report/idea-01". `replace` keeps the back button tidy for redirects. */
export function navigate(path: string, { replace = false } = {}) {
  const hash = `#${path}`;
  if (location.hash === hash) return;
  if (replace) history.replaceState(history.state, "", `${location.pathname}${location.search}${hash}`);
  else location.hash = hash;
  update(replace ? "replace" : "push");
}

export const href = (path: string) => `#${path}`;
