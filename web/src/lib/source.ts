// source.ts — capture how the visitor arrived, before navigation scrubs it.
// UTM links (?utm_source=linkedin / x / ...) survive social-platform redirects;
// document.referrer is a coarse fallback for sites that don't strip it.
const KEY = "vistadex.source";

// Channels the team shares on: their own domains and the link wrappers they put on shared links.
const CHANNELS: [RegExp, string][] = [
  // vistadex-study.github.io is the redirect page behind the LinkedIn post's link (LinkedIn rejects the
  // pages.dev address): it adds ?utm_source=linkedin, but a link that arrives with other query text loses it.
  [/(^|\.)(linkedin\.com|lnkd\.in|vistadex-study\.github\.io)$/, "linkedin"],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, "x"],
];

/** "linkedin" | "x" for those channels, "ref:<site>" for any other referrer, "" for none. */
function referrerChannel(referrer: string): string {
  if (!referrer) return "";
  let host = "";
  try { host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
  if (!host) return "";
  for (const [re, name] of CHANNELS) if (re.test(host)) return name;
  return `ref:${host.split(".")[0].slice(0, 30)}`;
}

// Which channel a browser is counted under. A tagged link (utm_source) is the clearest evidence of how
// someone arrived, so it always replaces what an earlier visit stored: a person who once typed the address
// and later came from the LinkedIn post counts as LinkedIn. A LinkedIn or X referrer replaces only an
// earlier "direct". Anything else (reloads, typed addresses, other sites) never erases a stored channel.
const KNOWN = new Set(CHANNELS.map(([, name]) => name));
let changedThisLoad = false;
/** True when this page load replaced an earlier visit's channel (telemetry then registers again). */
export const sourceChangedThisLoad = () => changedThisLoad;
export function captureSource() {
  try {
    const params = new URLSearchParams(location.search);
    const utm = (params.get("utm_source") || "").trim().toLowerCase().slice(0, 30);
    const ref = utm ? "" : referrerChannel(document.referrer || "");
    const source = utm || ref || "direct";
    const stored = visitSource();
    const replace = stored === "unknown" || (utm && utm !== stored) || (!utm && KNOWN.has(ref) && stored === "direct");
    if (replace) {
      changedThisLoad = stored !== "unknown";
      localStorage.setItem(KEY, JSON.stringify({ source, at: new Date().toISOString() }));
    }
  } catch { /* storage unavailable */ }
}

export function visitSource(): string {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw).source as string) : "unknown";
  } catch {
    return "unknown";
  }
}

export function clearSource() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
