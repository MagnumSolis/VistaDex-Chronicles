// ── pipeline.js — Runs the 4 stages and returns { report, trace } ──
// Pure: no DOM, no timers, no randomness in any decision. Shared by the browser
// (key-free mock path) and the Worker (real providers when keys are present).

import { toContract } from "./contract.js";
import { createTrace } from "./trace.js";
import { createLLM } from "./providers/llm.js";
import { mockRetrieval } from "./providers/retrieval.js";
import { lexicalSimilarity } from "./providers/embed.js";
import { extractClaims } from "./stages/extract.js";
import { classifyClaims } from "./stages/classify.js";
import { matchGraveyard } from "./stages/graveyard.js";
import { raiseObjections } from "./stages/objector.js";

// deps: { llmRoutes, retrieval, similarity, graveyard, onStage, mode }
export async function runScreen(ideaText, deps = {}) {
  const mode = deps.mode || "mock";
  const trace = createTrace({ ideaText, mode });
  const llm = createLLM(deps.llmRoutes || {}, trace);
  const retrieval = deps.retrieval || mockRetrieval();
  const similarity = deps.similarity || lexicalSimilarity;
  const graveyard = deps.graveyard || [];
  const onStage = deps.onStage || (async () => {});
  trace.log("run_start", {
    retrieval: retrieval.name, similarity: similarity.name,
    llm: { extract: llm.available("extract"), classify: llm.available("classify"), objector: llm.available("objector") },
  });

  await onStage(1, "running");
  const extracted = await extractClaims(ideaText, { llm, trace });
  await onStage(1, "done", `${extracted.length} claims extracted`);

  await onStage(2, "running");
  const claims = await classifyClaims(extracted, { llm, retrieval, trace });
  await onStage(2, "done", `${claims.length} claims classified`);

  await onStage(3, "running");
  const matches = matchGraveyard(ideaText, graveyard, { similarity, trace });
  await onStage(3, "done", `${matches.length} lead${matches.length === 1 ? "" : "s"} found`);

  await onStage(4, "running");
  const objections = await raiseObjections(ideaText, claims, matches, { llm, trace });
  await onStage(4, "done", `${objections.length} objections raised`);

  const report = toContract({ idea_text: ideaText, claims, graveyard_matches: matches, objections });
  trace.log("run_done", { claims: report.claims.length, matches: report.graveyard_matches.length, objections: report.objections.length });
  return { report, trace: trace.finish() };
}
