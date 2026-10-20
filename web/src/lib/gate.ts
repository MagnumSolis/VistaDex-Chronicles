// Where to go after the Welcome notice: the page the visitor asked for (e.g. the LinkedIn link #/screen,
// or "Try the demo" on Home), defaulting to Screen an idea.
import { PATHS } from "@/router";

let target: string = PATHS.screen;
export function rememberTarget(path: string) {
  if (path && path !== PATHS.welcome && path !== "/") target = path;
}
export function takeTarget() {
  const t = target;
  target = PATHS.screen;
  // Study-track participants land on their next condition, not the plain tool.
  try {
    const raw = localStorage.getItem("vistadex_participant");
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.track === "study" && Array.isArray(p.order)) {
        const done = (c: string) => localStorage.getItem("vistadex_participant_done_" + c) === "true";
        const [a, b] = p.order;
        if (!done(a)) return a === "baseline" ? PATHS.baseline : PATHS.screen;
        if (!done(b)) return b === "baseline" ? PATHS.baseline : PATHS.screen;
      }
    }
  } catch { /* fall through to the plain target */ }
  return t;
}
