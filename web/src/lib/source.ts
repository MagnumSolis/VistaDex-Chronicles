// source.ts — capture how the visitor arrived, before navigation scrubs it.
// UTM links (?utm_source=linkedin / x / ...) survive social-platform redirects;
// document.referrer is a coarse fallback for sites that don't strip it.
const KEY = "vistadex.source";

export function captureSource() {
  try {
    const params = new URLSearchParams(location.search);
    const utm = (params.get("utm_source") || "").trim().toLowerCase().slice(0, 30);
    let ref = "";
    if (!utm) {
      const r = document.referrer || "";
      if (r) {
        try { ref = new URL(r).hostname.replace(/^www\\./, "").split(".")[0].slice(0, 30); } catch { ref = ""; }
      }
    }
    const source = utm || (ref ? `ref:${ref}` : "") || "direct";
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
