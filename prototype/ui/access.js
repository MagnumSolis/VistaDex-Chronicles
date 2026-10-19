// ── access.js — Study access code from the participant link ──
// The link looks like https://…/VistaDex-Chronicles/#code=K7Q2-MX9P. The code is read from the
// URL fragment (never sent to the web host or logged by it), kept in sessionStorage for this
// tab only, and scrubbed from the address bar so it does not travel in screenshots or copied
// URLs. It is sent to the proxy on /screen and /events, and never written to telemetry.

const KEY = "vistadex.access";
const FIELD = "code";

// Call once at startup, before anything reads the URL.
export function captureAccessCode(loc = globalThis.location, hist = globalThis.history) {
  if (!loc || !loc.hash) return getAccessCode();
  const params = new URLSearchParams(loc.hash.slice(1));
  const code = (params.get(FIELD) || "").trim();
  if (!code) return getAccessCode();
  try { sessionStorage.setItem(KEY, code); } catch { /* storage blocked: code lives for this page only */ memory = code; }
  params.delete(FIELD);
  const rest = params.toString();
  hist?.replaceState?.(hist.state, "", loc.pathname + loc.search + (rest ? `#${rest}` : ""));
  return code;
}

let memory = null;

// Also capture when only the fragment changes (the participant opens their link in a tab that
// already shows the site — the browser does not reload, so startup code would not run again).
export function watchAccessCode(win = globalThis) {
  captureAccessCode(win.location, win.history);
  win.addEventListener?.("hashchange", () => captureAccessCode(win.location, win.history));
}

export function getAccessCode() {
  try { return sessionStorage.getItem(KEY) || memory; } catch { return memory; }
}

export const ACCESS_HEADER = "X-VistaDex-Access";

// Plain-language messages for proxy refusals, shown in the UI (and recorded in run_failed.error).
export function refusalMessage(status, body) {
  if (status === 401) return "This study link is missing its access code. Please open the link you were given.";
  if (status === 429 && body?.error === "daily_cap") return "The study is paused for today. Please try again tomorrow.";
  if (status === 429) return "Too many requests right now. Please wait a minute and try again.";
  if (status === 503) return "The study server is not set up correctly. Please tell the VistaDex team.";
  return null;
}
