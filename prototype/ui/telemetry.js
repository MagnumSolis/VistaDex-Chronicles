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

let state = load();
let flushTimer = null;
let disabled = false;

export function disable() {
  disabled = true;
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
}
export const isDisabled = () => disabled;

function blank() {
  return { session_id: null, consent: null, consent_at: null, consent_version: null, seq: 0, events: [], sent: 0 };
}

// Consent — given or declined — only counts for the study version it was answered under. A
// stored answer from another version (or from before versions were recorded, i.e. pilot-1) is
// discarded, so the participant sees the consent dialog again with the current wording. Anything
// stored locally under the old version is dropped with it (it was never part of this version).
export function readStored(raw, version = STUDY_VERSION) {
  if (!raw) return blank();
  let s;
  try { s = { ...blank(), ...JSON.parse(raw) }; } catch { return blank(); }
  if (s.consent && s.consent_version !== version) return blank();
  return s;
}

function load() {
  try {
    return readStored(localStorage.getItem(KEY));
  } catch {
    return blank();
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked: keep in memory */ }
}

function proxyBase() {
  return CONFIG.PROXY_URL ? CONFIG.PROXY_URL.replace(/\/$/, "") : null;
}

export function consentStatus() { return state.consent; }
export function sessionId() { return state.session_id; }
export function sessionCode() { return state.session_id ? state.session_id.slice(0, 8).toUpperCase() : null; }
export function events() { return state.events.slice(); }

export function giveConsent() {
  state = { ...blank(), session_id: crypto.randomUUID(), consent: "given", consent_at: new Date().toISOString(), consent_version: STUDY_VERSION };
  save();
  log("consent_given", { study_version: STUDY_VERSION });
}

// Declining is remembered locally (so we don't ask again) but never sent anywhere.
export function declineConsent() {
  state = { ...blank(), consent: "declined", consent_at: new Date().toISOString(), consent_version: STUDY_VERSION };
  save();
}

export function log(type, payload = {}) {
  if (disabled || state.consent !== "given") return null;
  const event = { session_id: state.session_id, seq: ++state.seq, ts: new Date().toISOString(), type, study_version: STUDY_VERSION, payload };
  state.events.push(event);
  save();
  scheduleFlush();
  return event;
}

function scheduleFlush() {
  if (disabled || !proxyBase() || flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flush(); }, FLUSH_DELAY_MS);
}

export async function flush({ beacon = false } = {}) {
  const base = proxyBase();
  if (disabled || !base || state.consent !== "given" || state.sent >= state.events.length) return;
  const batch = state.events.slice(state.sent, state.sent + MAX_BATCH);
  // access_code rides in the upload body (beacons cannot set headers); it is never part of an event.
  const code = getAccessCode();
  const body = JSON.stringify({ session_id: state.session_id, events: batch, ...(code ? { access_code: code } : {}) });
  if (beacon && navigator.sendBeacon) {
    if (navigator.sendBeacon(`${base}/events`, new Blob([body], { type: "text/plain" }))) {
      state.sent += batch.length;
      save();
    }
    return;
  }
  try {
    // text/plain keeps this a "simple" CORS request (no preflight); the Worker parses JSON.
    const res = await fetch(`${base}/events`, { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: true });
    if (res.ok) {
      state.sent += batch.length;
      save();
      if (state.sent < state.events.length) scheduleFlush(); // more than one batch waiting
    }
  } catch { /* offline: retried on the next event or page hide */ }
}

// Deletes local data and asks the server to delete this session. Returns the
// server outcome so the UI can tell the participant what happened.
export async function withdraw() {
  const id = state.session_id;
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
  state = { ...blank(), consent: "declined", consent_at: new Date().toISOString(), consent_version: STUDY_VERSION };
  save();
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
    JSON.stringify({ session_id: state.session_id, consent_at: state.consent_at, study_version: STUDY_VERSION, events: state.events }, null, 2));
}

export function exportCSV() {
  download(`vistadex-${sessionCode() || "session"}.csv`, "text/csv", toCSV(state.events));
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
