// ── escape.js — Every string rendered into innerHTML goes through esc() ──

const MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => MAP[ch]);
}

// Only http(s) URLs become links; anything else is shown as inert text.
export function safeHref(url) {
  return /^https?:\/\//i.test(String(url)) ? esc(url) : null;
}
