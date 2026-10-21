// ── network-guard.js — tests may only talk to localhost ──
// Loaded before every test: node suite via `node --import` (package.json), web suite via vitest's
// setupFiles, and imported directly at the top of tests/telemetry.test.js. Any request from a test to a
// host other than localhost / 127.0.0.1 / [::1] throws NetworkGuardError before anything is sent, so the
// test fails instead of reaching a real server (until 2026-10-21 every `npm test` sent DELETE /session
// to the production Worker). Tests that need a server stub fetch themselves (see tests/telemetry*.test.js).
// Safe to load more than once: it wraps each API only once.

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const MARK = Symbol.for("vistadex.networkGuard");

export class NetworkGuardError extends Error {
  constructor(url, via) {
    const test = globalThis.__vistadexCurrentTest?.();
    super(`NetworkGuardError: blocked ${via} to ${url}${test ? ` in test "${test}"` : ""}. Tests may only reach localhost; stub the request instead.`);
    this.name = "NetworkGuardError";
  }
}

// Every blocked request is also recorded, because app code may catch the error (telemetry's withdraw()
// turns it into "failed (network)"). The web setup fails the test that caused one; in node the process
// exits non-zero with the list, so a swallowed block still fails the run.
const blocked = (globalThis.__vistadexBlocked ??= []);
/** Returns and clears the recorded blocks (the guard's own tests use it for the blocks they expect). */
export const takeBlocked = () => blocked.splice(0);

export function assertLocal(input, via) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url ?? String(input);
  let host;
  try { host = new URL(raw, globalThis.location?.href ?? "http://localhost/").hostname; } catch { return; } // not a URL: let the real API reject it
  if (LOCAL.has(host)) return;
  const err = new NetworkGuardError(raw, via);
  blocked.push(err.message);
  throw err;
}

if (!globalThis[MARK]) {
  globalThis[MARK] = true;

  if (typeof process !== "undefined" && typeof process.on === "function" && !globalThis.window) {
    process.on("beforeExit", () => {
      if (!blocked.length) return;
      for (const m of blocked) console.error(m);
      process.exitCode = 1;
    });
  }

  const realFetch = globalThis.fetch;
  if (realFetch) {
    globalThis.fetch = function guardedFetch(input, init) {
      try { assertLocal(input, "fetch"); } catch (e) { return Promise.reject(e); }
      return realFetch.call(this, input, init);
    };
  }

  const XHR = globalThis.XMLHttpRequest;
  if (XHR?.prototype?.open) {
    const realOpen = XHR.prototype.open;
    XHR.prototype.open = function guardedOpen(method, url, ...rest) {
      assertLocal(url, "XMLHttpRequest");
      return realOpen.call(this, method, url, ...rest);
    };
  }

  const nav = globalThis.navigator;
  if (nav && typeof nav.sendBeacon === "function") {
    const realBeacon = nav.sendBeacon.bind(nav);
    nav.sendBeacon = (url, data) => { assertLocal(url, "sendBeacon"); return realBeacon(url, data); };
  }
}
