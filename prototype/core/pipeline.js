// ── pipeline.js — Runs the stages and returns { report, trace } ──
// Pure: no DOM, no timers, no randomness in any decision. Shared by the browser
// (key-free mock path) and the Worker (real providers when keys are present).

import { finalizeReport, applySamples } from "./finalize.js";
import { buildIdeaText, normalizeInput } from "./input.js";
import { createTrace } from "./trace.js";
import { createLLM } from "./providers/llm.js";
import { mockRetrieval } from "./providers/retrieval.js";
import { lexicalSimilarity } from "./providers/embed.js";
import { extractClaims } from "./stages/extract.js";
import { classifyClaims } from "./stages/classify.js";
import { matchGraveyard } from "./stages/graveyard.js";
import { raiseObjections } from "./stages/objector.js";
import { findCompetitors } from "./stages/competitors.js";
import { assessBigTech } from "./stages/bigtech.js";
import { searchMarket } from "./stages/market.js";
import { searchLegal } from "./stages/legal.js";

// ideaOrInput: the idea text (string), or the structured input { title, pitch, problem, solution, moat,
// industries, role, markets } — then idea_text is built from it (input.js) and the input is kept on the report.
// deps: { llmRoutes, retrieval, similarity, graveyard, onStage, mode, samples }
//   samples: mock-mode placeholders (prototype/data/samples.js) — passed by the browser mock path only.
const stripSearch = ({ search, ...rest }) => rest;
// Bump when the pipeline's output for the same input would change (prompts, rules, stages): cached reports
// from an older version are not reused (worker/src/index.js cacheKey).
export const PIPELINE_VERSION = "2026-11-12a";

export async function runScreen(ideaOrInput, deps = {}) {
  const input = typeof ideaOrInput === "string" ? null : normalizeInput(ideaOrInput);
  const ideaText = input ? buildIdeaText(input) : String(ideaOrInput ?? "");
  const mode = deps.mode || "mock";
  const trace = createTrace({ ideaText, mode });
  const llm = createLLM(deps.llmRoutes || {}, trace);
  const retrieval = deps.retrieval || mockRetrieval();
  const similarity = deps.similarity || lexicalSimilarity;
  const graveyard = deps.graveyard || [];
  const onStage = deps.onStage || (async () => {});
  trace.log("run_start", {
    retrieval: retrieval.name, similarity: similarity.name, structured_input: Boolean(input), samples: Boolean(deps.samples),
    llm: { extract: llm.available("extract"), classify: llm.available("classify"), objector: llm.available("objector") },
  });

  await onStage(1, "running");
  const extracted = await extractClaims(ideaText, { llm, trace });
  await onStage(1, "done", `${extracted.length} claims extracted`);

  await onStage(2, "running");
  const classified = await classifyClaims(extracted, { llm, retrieval, trace });
  const novelPages = classified.flatMap(c => c._pages || []);
  const claims = classified.map(({ _pages, ...c }) => c);
  // Competitors (dedicated search on title + pitch, plus the novelty claims' pages) and Big Tech risk.
  // Both are null when no search could run; the report then says "Not available in this version yet".
  // Competitors, Big Tech risk, market size and legal are independent of each other: run in parallel.
  // Market and legal are null when no search could run (the report then says so); market still reads the
  // quotes of confirmed market-size claims without a search.
  const [competitors, bigTech, market, legal] = await Promise.all([
    findCompetitors({ ideaText, input, novelPages }, { llm, retrieval, trace }),
    assessBigTech({ ideaText, input }, { llm, retrieval, trace }),
    searchMarket({ ideaText, input, claims }, { llm, retrieval, trace }),
    searchLegal({ ideaText, input }, { llm, retrieval, trace }),
  ]);
  await onStage(2, "done", `${claims.length} claims classified`);

  await onStage(3, "running");
  const matches = matchGraveyard(ideaText, graveyard, { similarity, trace });
  await onStage(3, "done", `${matches.length} lead${matches.length === 1 ? "" : "s"} found`);

  await onStage(4, "running");
  const objections = await raiseObjections(ideaText, claims, matches, { llm, trace, competitors: competitors?.list ?? [] });
  await onStage(4, "done", `${objections.length} objections raised`);

  const raw = applySamples({
    idea_text: ideaText,
    ...(input ? { input } : {}),
    claims, graveyard_matches: matches, objections,
    ...(competitors ? { competitors: competitors.list } : {}),
    ...(bigTech ? { big_tech_risk: bigTech } : {}),
    ...(market ? { market: stripSearch(market) } : {}),
    ...(legal ? { legal: stripSearch(legal) } : {}),
    search: {
      ...(competitors ? { competitors: competitors.search } : {}),
      ...(market?.search ? { market: market.search } : {}),
      ...(legal ? { legal: legal.search } : {}),
      graveyard: { entries_checked: graveyard.length, verified_entries: graveyard.filter(g => g.source_verified === true).length },
    },
  }, deps.samples);
  const report = finalizeReport(raw);
  trace.log("run_done", {
    claims: report.claims.length, matches: report.graveyard_matches.length, objections: report.objections.length,
    overlap_band: report.overlap_band, vistadex: report.scores.vistadex.value,
  });
  return { report, trace: trace.finish() };
}
