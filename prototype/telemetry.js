// ── telemetry.js — research instrumentation (F364).
// HARD RULES (AGENTS.md): no telemetry before consent; pseudonymous session IDs
// only; no PII in event payloads. If POST /api/events is unreachable, queue in
// localStorage and flush later. Math.random()/crypto.randomUUID are fine here —
// this is a browser session identifier, not a production pipeline decision path.

const TELEMETRY = (() => {
  const CONSENT_KEY = 'vistadex_consent';
  const QUEUE_KEY = 'vistadex_event_queue';
  const SESSION_KEY = 'vistadex_session_id';

  function getSessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        sessionStorage.setItem(SESSION_KEY, id);
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch { return 'unknown-session'; }
  }

  function hasConsent() {
    try { return localStorage.getItem(CONSENT_KEY) === 'granted'; } catch { return false; }
  }

  function setConsent(granted) {
    try {
      localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
      if (granted) logEvent('consent_granted', {});
    } catch {}
  }

  let queue = [];
  try { queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { queue = []; }
  let flushing = false;

  async function flush() {
    if (flushing || !hasConsent() || queue.length === 0) return;
    flushing = true;
    const batch = queue.splice(0, 50);
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
    for (const ev of batch) {
      try {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ session_id: getSessionId(), ts: ev.ts, event: ev.event, payload: ev.payload }),
        });
      } catch {
        // Backend unreachable — re-queue and retry on next log or interval.
        queue.push(ev);
        try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
        break;
      }
    }
    flushing = false;
  }

  function logEvent(event, payload = {}) {
    if (!hasConsent()) return; // consent gate: nothing logged before the banner
    queue.push({ ts: new Date().toISOString(), event, payload });
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-500))); } catch {}
    flush();
  }

  // Periodic flush attempt for queued events.
  setInterval(flush, 15000);

  return {
    hasConsent, setConsent, getSessionId, logEvent, flush,
  };
})();

window.TELEMETRY = TELEMETRY;
