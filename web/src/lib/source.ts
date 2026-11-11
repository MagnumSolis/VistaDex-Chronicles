// source.ts — capture how the visitor arrived, before navigation scrubs it.
// UTM links (?utm_source=linkedin / x / ...) survive social-platform redirects;
// document.referrer is a coarse fallback for sites that don't strip it.
const KEY = "vistadex.source";

// Channels the team shares on: their own domains and the link wrappers they put on shared links.
const CHANNELS: [RegExp, string][] = [
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
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

export function captureSource() {
  try {
    const params = new URLSearchParams(location.search);
    const utm = (params.get("utm_source") || "").trim().toLowerCase().slice(0, 30);
    const ref = utm ? "" : referrerChannel(document.referrer || "");
    const source = utm || ref || "direct";
    // First-touch wins: don't overwrite an earlier capture this visit-chain
    if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify({ source, at: new Date().toISOString() }));
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
