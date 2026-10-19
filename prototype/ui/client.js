// ── client.js — Chooses the proxy (live providers) or the in-browser mock path ──

import { CONFIG } from "../config.js";
import { runScreen } from "../core/pipeline.js";
import { validateContract } from "../core/contract.js";
import { GRAVEYARD_DB } from "../data/graveyard.js";
import { ACCESS_HEADER, getAccessCode, refusalMessage } from "./access.js";

export function liveMode() {
  return Boolean(CONFIG.PROXY_URL);
}

// Returns { report, trace, traceId, mode }.
export async function screenIdea(ideaText, { onStage } = {}) {
  if (liveMode()) return screenViaProxy(ideaText, onStage);
  const { report, trace } = await runScreen(ideaText, { mode: "mock", graveyard: GRAVEYARD_DB, onStage });
  return { report, trace, traceId: trace.trace_id, mode: "mock" };
}

async function screenViaProxy(ideaText, onStage = async () => {}) {
  // The proxy runs all stages server-side; the UI marks them in sequence once it answers.
  await onStage(1, "running");
  const code = getAccessCode();
  const res = await fetch(`${CONFIG.PROXY_URL.replace(/\/$/, "")}/screen`, {
    method: "POST",
    // The access code travels in a header so the request body stays exactly the contract's { idea_text }.
    headers: { "Content-Type": "application/json", ...(code ? { [ACCESS_HEADER]: code } : {}) },
    body: JSON.stringify({ idea_text: ideaText }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(refusalMessage(res.status, body) || `proxy returned HTTP ${res.status}`);
  }
  const report = await res.json();
  const problems = validateContract(report);
  if (problems.length) throw new Error(`proxy response broke the contract: ${problems.join("; ")}`);
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
