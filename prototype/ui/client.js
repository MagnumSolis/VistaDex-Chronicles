// ── client.js — Chooses the proxy (live providers) or the in-browser mock path ──

import { CONFIG } from "../config.js";
import { runScreen } from "../core/pipeline.js";
import { validateContract } from "../core/contract.js";
import { GRAVEYARD_DB } from "../data/graveyard.js";
import { MOCK_SAMPLES } from "../data/samples.js";
import { ACCESS_HEADER, getAccessCode, refusalMessage } from "./access.js";
import { consentStatus, isDisabled } from "./telemetry.js";

export function liveMode() {
  return Boolean(CONFIG.PROXY_URL);
}

// Errors carry a machine-readable code next to the plain-language message:
//   access | daily_cap | rate_limited | misconfigured | http | contract | network | cancelled
export class ScreenError extends Error {
  constructor(code, message) { super(message); this.name = "ScreenError"; this.code = code; }
}

const cancelled = () => new ScreenError("cancelled", "The screening was cancelled.");

// Returns { report, trace, traceId, mode }. Pass { signal } (AbortSignal) to cancel: the mock path
// stops at the next stage boundary; the proxy request is aborted (the server may still finish it).
// ideaOrInput: the structured input from the form (or a plain idea text).
export async function screenIdea(ideaOrInput, { onStage, signal } = {}) {
  if (liveMode()) return screenViaProxy(ideaOrInput, onStage, signal);
  const guarded = async (...args) => {
    if (signal?.aborted) throw cancelled();
    await onStage?.(...args);
    if (signal?.aborted) throw cancelled();
  };
  // In-browser mock only: sample placeholders for what the key-free path cannot produce (marked in sample_fields).
  const { report, trace } = await runScreen(ideaOrInput, { mode: "mock", graveyard: GRAVEYARD_DB, onStage: guarded, samples: MOCK_SAMPLES });
  return { report, trace, traceId: trace.trace_id, mode: "mock" };
}

function refusalCode(status, body) {
  if (status === 401) return "access";
  if (status === 429) return body?.error === "daily_cap" ? "daily_cap" : "rate_limited";
  if (status === 503) return "misconfigured";
  return "http";
}

export const SCREEN_TIMEOUT_MS = 150000;

async function screenViaProxy(ideaOrInput, onStage = async () => {}, signal) {
  // The proxy runs all stages server-side and does not report them one by one; the UI says so and
  // marks them done together once it answers.
  await onStage(1, "running");
  const code = getAccessCode();
  // A live run takes about a minute; past SCREEN_TIMEOUT_MS the visitor gets a clear error, never an endless wait.
  const limit = new AbortController();
  const timer = setTimeout(() => limit.abort(), SCREEN_TIMEOUT_MS);
  const onCancel = () => limit.abort();
  signal?.addEventListener("abort", onCancel);
  let res;
  try {
    res = await fetch(`${CONFIG.PROXY_URL.replace(/\/$/, "")}/screen`, {
      method: "POST",
      signal: limit.signal,
      // The access code travels in a header so the request body stays exactly the input.
      // Not recorded (pitch edition, declined, or not answered yet): the server keeps only a minimal log.
      headers: { "Content-Type": "application/json", ...(code ? { [ACCESS_HEADER]: code } : {}), ...(isDisabled() || consentStatus() !== "given" ? { "X-VistaDex-Record": "no" } : {}) },
      body: JSON.stringify(typeof ideaOrInput === "string" ? { idea_text: ideaOrInput } : ideaOrInput),
    });
  } catch (err) {
    if (signal?.aborted) throw cancelled();
    if (limit.signal.aborted) throw new ScreenError("network", `The server took longer than ${SCREEN_TIMEOUT_MS / 1000} seconds. Please try again in a minute.`);
    throw new ScreenError("network", `The server could not be reached (${err?.message || "network error"}).`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCancel);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ScreenError(refusalCode(res.status, body), refusalMessage(res.status, body) || `proxy returned HTTP ${res.status}`);
  }
  const report = await res.json();
  const problems = validateContract(report);
  if (problems.length) throw new ScreenError("contract", `proxy response broke the contract: ${problems.join("; ")}`);
  const counts = [`${report.claims.length} claims extracted`, `${report.claims.length} claims classified`,
    `${report.graveyard_matches.length} leads found`, `${report.objections.length} objections raised`];
  for (let n = 1; n <= 4; n++) {
    if (n > 1) await onStage(n, "running");
    await onStage(n, "done", counts[n - 1]);
  }
  // The proxy runs the mock path too when it has no keys; it says which in a header.
  const mode = res.headers.get("X-VistaDex-Mode") === "live" ? "live" : "proxy-mock";
  return { report, trace: null, traceId: res.headers.get("X-VistaDex-Trace-Id"), mode };
}
