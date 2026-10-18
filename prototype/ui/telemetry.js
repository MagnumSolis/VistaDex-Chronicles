// ── telemetry.js — Consent-gated, anonymous event log ──
// Nothing is recorded unless consent === "given". Events carry an anonymous
// random session ID; no names, emails, IPs or user-agent strings are collected.
// Events are kept in this browser (exportable) and, when a proxy is configured,
// sent to PROXY_URL/events.

import { CONFIG } from "../config.js";
import { STUDY_VERSION } from "./study-config.js";

const KEY = "vistadex.study.v1";
const FLUSH_DELAY_MS = 2000;

let state = load();
let flushTimer = null;

function blank() {
  return { session_id: null, consent: null, consent_at: null, seq: 0, events: [], sent: 0 };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...blank(), ...JSON.parse(raw) } : blank();
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
  state = { ...blank(), session_id: crypto.randomUUID(), consent: "given", consent_at: new Date().toISOString() };
  save();
  log("consent_given", { study_version: STUDY_VERSION });
}

// Declining is remembered locally (so we don't ask again) but never sent anywhere.
export function declineConsent() {
  state = { ...blank(), consent: "declined", consent_at: new Date().toISOString() };
  save();
}

export function log(type, payload = {}) {
  if (state.consent !== "given") return null;
  const event = { session_id: state.session_id, seq: ++state.seq, ts: new Date().toISOString(), type, study_version: STUDY_VERSION, payload };
  state.events.push(event);
  save();
  scheduleFlush();
  return event;
}

function scheduleFlush() {
  if (!proxyBase() || flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flush(); }, FLUSH_DELAY_MS);
}

export async function flush({ beacon = false } = {}) {
  const base = proxyBase();
  if (!base || state.consent !== "given" || state.sent >= state.events.length) return;
  const batch = state.events.slice(state.sent);
  const body = JSON.stringify({ session_id: state.session_id, events: batch });
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
  state = { ...blank(), consent: "declined", consent_at: new Date().toISOString() };
  save();
  return { session_id: id, server };
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

addEventListener("pagehide", () => flush({ beacon: true }));
