// ── pipeline.js — Runs the 4 stages and returns { report, trace } ──
// Pure: no DOM, no timers. Shared by the browser (key-free) and the Worker (keys).

import { toContract } from "./contract.js";
import { createTrace } from "./trace.js";
import { createLLM } from "./providers/llm.js";
import { mockRetrieval } from "./providers/retrieval.js";
import { extractClaims } from "./stages/extract.js";
import { legacyClassify, legacyGraveyard, legacyObjector } from "./stages/legacy.js";

// deps: { llmRoutes, retrieval, graveyard, onStage, mode }
export async function runScreen(ideaText, deps = {}) {
  const mode = deps.mode || "mock";
  const trace = createTrace({ ideaText, mode });
  const llm = createLLM(deps.llmRoutes || {}, trace);
  const retrieval = deps.retrieval || mockRetrieval();
  const graveyard = deps.graveyard || [];
  const onStage = deps.onStage || (async () => {});
  trace.log("run_start", { retrieval: retrieval.name, llm_available: llm.available("default") });

  await onStage(1, "running");
  const extracted = await extractClaims(ideaText, { llm, trace });
  await onStage(1, "done", `${extracted.length} claims extracted`);

  await onStage(2, "running");
  const claims = extracted.map(legacyClassify);
  await onStage(2, "done", `${claims.length} claims classified`);

  await onStage(3, "running");
  const matches = legacyGraveyard(ideaText, graveyard);
  await onStage(3, "done", `${matches.length} leads found`);

  await onStage(4, "running");
  const objections = legacyObjector(claims, matches);
  await onStage(4, "done", `${objections.length} objections raised`);

  const report = toContract({ idea_text: ideaText, claims, graveyard_matches: matches, objections });
  trace.log("run_done", { claims: report.claims.length, matches: report.graveyard_matches.length, objections: report.objections.length });
  return { report, trace: trace.finish() };
}
