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
  return t;
}
