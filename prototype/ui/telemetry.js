// ── telemetry.js — Notice-gated, anonymous event log ──
// Nothing is recorded unless consent === "given" (in the web app: the visitor went past the Welcome
// notice without choosing "Use without recording"). Events carry an anonymous random session ID; no
// names, emails, IPs or user-agent strings are collected. Events are kept in this browser and, when a
// proxy is configured, uploaded in batches to PROXY_URL/events.
// disable() switches everything off for the page (the pitch edition): nothing is logged or uploaded,
// not even events left unsent by an earlier visit in this browser.

import { CONFIG } from "../config.js";
import { STUDY_VERSION } from "./study-config.js";
import { getAccessCode } from "./access.js";

const KEY = "vistadex.study.v1";
// Batch uploads: at most one request per FLUSH_DELAY_MS while events arrive (the Worker allows 60
// /events requests per minute per IP) and at most MAX_BATCH events per request (Worker limit 200).
export const FLUSH_DELAY_MS = 10000;
export const MAX_BATCH = 200;

// Several tabs of one browser share one session (one localStorage record), and D1 keeps only the
// first event per (session_id, seq). So seq must be unique across tabs, not just within one:
// each page load claims a tab slot (0 to TAB_SLOTS - 1, from a counter in the shared record) and
// every seq it sends is congruent to its slot modulo TAB_SLOTS:
//   seq = max(now_ms * TAB_SLOTS + slot, previous seq of this tab + TAB_SLOTS)
// Tabs with different slots can never send the same seq; within a tab seq strictly increases; and
// across tabs and reloads seq follows the time the event was logged, so "order by seq" stays the
// order events happened in. (now_ms * 1024 stays below 2^53 until the year 2248.)
export const TAB_SLOTS = 1024;

// Shared (localStorage): the consent answer, the session id, the tab counter and every tab's
// unsent events, merged by seq so a reload of any tab can still send them.
// This tab (memory): its own events and how many of them were uploaded. Events adopted from
// storage at load may belong to another open tab; sending them twice is harmless (D1 ignores
// duplicate (session_id, seq) pairs).
let meta = blank();
let mine = [];
let sent = 0;
let slot = null;
let lastSeq = 0;
let flushTimer = null;
let disabled = false;

export function disable() {
  disabled = true;
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
}
export const isDisabled = () => disabled;

function blank() {
  return { session_id: null, consent: null, consent_at: null, consent_version: null, tabs: 0, events: [] };
}
const pickMeta = s => ({ session_id: s.session_id, consent: s.consent, consent_at: s.consent_at, consent_version: s.consent_version });

// Consent — given or declined — only counts for the study version it was answered under. A
// stored answer from another version (or from before versions were recorded, i.e. pilot-1) is
// discarded, so the participant sees the consent dialog again with the current wording. Anything
// stored locally under the old version is dropped with it (it was never part of this version).
export function readStored(raw, version = STUDY_VERSION) {
  if (!raw) return blank();
  let s;
  try { s = { ...blank(), ...JSON.parse(raw) }; } catch { return blank(); }
  if (s.consent && s.consent_version !== version) return blank();
  if (!Array.isArray(s.events)) s.events = [];
  return s;
}

// null when storage is blocked: the tab then keeps everything in memory.
function readShared() {
  try { return readStored(localStorage.getItem(KEY)); } catch { return null; }
}
function writeShared(rec) {
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* storage full or blocked: keep in memory */ }
}
const sameSession = s => s.session_id === meta.session_id && s.consent === meta.consent;

function resetTab(next) {
  meta = pickMeta(next);
  mine = [];
  sent = 0;
  slot = null;
  lastSeq = 0;
}

function load() {
  const s = readShared() ?? blank();
  resetTab(s);
  if (s.consent === "given") mine = s.events.slice();
}
load();

// Another tab may have changed the shared answer since this tab last looked (withdrew, or answered
// the notice again). A recording tab follows it, dropping what it holds of the old session; a tab
// that has not answered the notice keeps waiting for its own answer. Returns the shared record.
function sync() {
  const s = readShared();
  if (s && !sameSession(s) && meta.consent === "given") resetTab(s);
  return s;
}

// Writes this tab's unsent events into the shared queue (and removes the ones it sent), never
// touching another tab's events or a newer consent answer.
function persist() {
  const s = sync();
  if (!s || !sameSession(s)) return;
  const queue = new Map(s.events.map(e => [e.seq, e]));
  mine.slice(0, sent).forEach(e => queue.delete(e.seq));
  mine.slice(sent).forEach(e => queue.set(e.seq, e));
  writeShared({ ...meta, tabs: s.tabs ?? 0, events: [...queue.values()].sort((x, y) => x.seq - y.seq) });
}

// This tab's own answer (consent, decline, withdraw) replaces the shared record.
function answer(next) {
  resetTab(next);
  writeShared({ ...meta, tabs: 0, events: [] });
}

function claimSlot() {
  const s = readShared();
  if (s && sameSession(s)) {
    const n = Number.isInteger(s.tabs) && s.tabs >= 0 ? s.tabs : 0;
    slot = n % TAB_SLOTS;
    writeShared({ ...pickMeta(s), tabs: n + 1, events: s.events });
  } else {
    slot = crypto.getRandomValues(new Uint16Array(1))[0] % TAB_SLOTS; // storage blocked: no counter to share
  }
}

function nextSeq() {
  if (slot === null) claimSlot();
  lastSeq = Math.max(Date.now() * TAB_SLOTS + slot, lastSeq + TAB_SLOTS);
  return lastSeq;
}

function proxyBase() {
  return CONFIG.PROXY_URL ? CONFIG.PROXY_URL.replace(/\/$/, "") : null;
}

export function consentStatus() { return meta.consent; }
export function sessionId() { return meta.session_id; }
export function sessionCode() { return meta.session_id ? meta.session_id.slice(0, 8).toUpperCase() : null; }
export function events() { return mine.slice(); }

export function giveConsent() {
  answer({ session_id: crypto.randomUUID(), consent: "given", consent_at: new Date().toISOString(), consent_version: STUDY_VERSION });
  log("consent_given", { study_version: STUDY_VERSION });
}

// Declining is remembered locally (so we don't ask again) but never sent anywhere.
export function declineConsent() {
  answer({ session_id: null, consent: "declined", consent_at: new Date().toISOString(), consent_version: STUDY_VERSION });
}

export function log(type, payload = {}) {
  if (disabled) return null;
  sync();
  if (meta.consent !== "given") return null;
  const event = { session_id: meta.session_id, seq: nextSeq(), ts: new Date().toISOString(), type, study_version: STUDY_VERSION, payload };
  mine.push(event);
  persist();
  scheduleFlush();
  return event;
}

function scheduleFlush() {
  if (disabled || !proxyBase() || flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flush(); }, FLUSH_DELAY_MS);
}

// Marks this tab's events up to `upTo` as uploaded, unless the session changed meanwhile.
function markSent(session, upTo) {
  if (meta.session_id !== session) return;
  sent = Math.max(sent, upTo);
  persist();
}

export async function flush({ beacon = false } = {}) {
  const base = proxyBase();
  if (disabled || !base) return;
  sync();
  if (meta.consent !== "given" || sent >= mine.length) return;
  const session = meta.session_id;
  const start = sent;
  const batch = mine.slice(start, start + MAX_BATCH);
  // access_code rides in the upload body (beacons cannot set headers); it is never part of an event.
  const code = getAccessCode();
  const body = JSON.stringify({ session_id: session, events: batch, ...(code ? { access_code: code } : {}) });
  if (beacon && navigator.sendBeacon) {
    if (navigator.sendBeacon(`${base}/events`, new Blob([body], { type: "text/plain" }))) markSent(session, start + batch.length);
    return;
  }
  try {
    // text/plain keeps this a "simple" CORS request (no preflight); the Worker parses JSON.
    const res = await fetch(`${base}/events`, { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: true });
    if (res.ok) {
      markSent(session, start + batch.length);
      if (sent < mine.length) scheduleFlush(); // more than one batch waiting
    } else {
      // Non-OK (e.g. 429 rate-limited, 410 withdrawn): keep the batch queued and
      // warn — a future log() or pagehide retries it. 410 means withdrawn: drop instead.
      if (res.status === 410) markSent(session, mine.length);
      else console.warn(`[vistadex] telemetry upload HTTP ${res.status}; ${batch.length} events stay queued for retry`);
    }
  } catch { /* offline: retried on the next event or page hide */ }
}

// Deletes local data and asks the server to delete this session. Returns the
// server outcome so the UI can tell the participant what happened.
export async function withdraw() {
  const id = meta.session_id;
  const base = proxyBase();
  let server = "not-configured";
  if (id && base) {
    try {
      const res = await fetch(`${base}/session/${encodeURIComponent(id)}`, { method: "DELETE" });
      server = res.ok ? "deleted" : `failed (HTTP ${res.status})`;
    } catch {
      server = "failed (network)";
    }
  }
  answer({ session_id: null, consent: "declined", consent_at: new Date().toISOString(), consent_version: STUDY_VERSION });
  return { session_id: id, server };
}

// Feedback form answers. Sent as one event under a NEW random id that is not linked to the telemetry
// session, so an optional email address is never joined to the visitor's usage records.
// Returns "sent" | "not-configured" | "failed (…)".
export async function sendUnlinked(type, payload) {
  const base = proxyBase();
  if (disabled) return "disabled";
  if (!base) return "not-configured";
  const id = crypto.randomUUID();
  const code = getAccessCode();
  const event = { session_id: id, seq: 1, ts: new Date().toISOString(), type, study_version: STUDY_VERSION, payload };
  try {
    const res = await fetch(`${base}/events`, {
      method: "POST", headers: { "Content-Type": "text/plain" }, keepalive: true,
      body: JSON.stringify({ session_id: id, events: [event], ...(code ? { access_code: code } : {}) }),
    });
    return res.ok ? "sent" : `failed (HTTP ${res.status})`;
  } catch {
    return "failed (network)";
  }
}

// ── Export (participant's own copy; researchers export from the Worker) ──
export function exportJSON() {
  download(`vistadex-${sessionCode() || "session"}.json`, "application/json",
    JSON.stringify({ session_id: meta.session_id, consent_at: meta.consent_at, study_version: STUDY_VERSION, events: mine }, null, 2));
}

export function exportCSV() {
  download(`vistadex-${sessionCode() || "session"}.csv`, "text/csv", toCSV(mine));
}

export function toCSV(list) {
  const cols = ["session_id", "seq", "ts", "type", "study_version", "payload"];
  const cell = v => {
    const s = typeof v === "string" ? v : JSON.stringify(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...list.map(e => cols.map(c => cell(e[c])).join(","))].join("\n");
}

function download(name, type, text) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

addEventListener("pagehide", () => { if (!disabled) flush({ beacon: true }); });
