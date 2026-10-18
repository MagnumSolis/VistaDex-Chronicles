import { test } from "node:test";
import assert from "node:assert/strict";
import { createLLM, parseWrapped, ProviderError, NoProviderAvailable, routesFromEnv } from "../prototype/core/providers/llm.js";
import { createTrace } from "../prototype/core/trace.js";
import { mockRetrieval, retrievalFromEnv } from "../prototype/core/providers/retrieval.js";

const failing = (name, status) => ({ name, model: "x", complete: async () => { throw new ProviderError(name, status, "boom"); } });
const ok = (name, content) => ({ name, model: "y", complete: async () => content });

test("fallback: rate-limited provider falls through to the next and is traced", async () => {
  const trace = createTrace({ ideaText: "x", mode: "test" });
  const llm = createLLM({ default: [failing("groq", 429), ok("mistral", '{"claims":[]}')] }, trace);
  const out = await llm.complete("extract", { messages: [] });
  assert.equal(out.provider, "mistral");
  const kinds = trace.record.events.map(e => e.kind);
  assert.deepEqual(kinds, ["llm_fallback", "llm_call"]);
  assert.equal(trace.record.events[0].status, 429);
});

test("fallback: all providers failing throws NoProviderAvailable", async () => {
  const llm = createLLM({ default: [failing("groq", 500), failing("mistral", 503)] });
  await assert.rejects(llm.complete("extract", { messages: [] }), NoProviderAvailable);
});

test("empty chain means no LLM available", async () => {
  const llm = createLLM({});
  assert.equal(llm.available("extract"), false);
  await assert.rejects(llm.complete("extract", { messages: [] }), NoProviderAvailable);
});

test("stage-specific route wins over default", async () => {
  const llm = createLLM({ default: [ok("groq", "a")], objector: [ok("mistral", "b")] });
  assert.equal((await llm.complete("objector", {})).provider, "mistral");
  assert.equal((await llm.complete("extract", {})).provider, "groq");
});

test("parseWrapped requires an object wrapper, rejects bare arrays", () => {
  assert.deepEqual(parseWrapped('{"claims":[{"claim":"a"}]}', "claims"), [{ claim: "a" }]);
  assert.deepEqual(parseWrapped('```json\n{"claims":[]}\n```', "claims"), []);
  assert.equal(parseWrapped('[{"claim":"a"}]', "claims"), null);
  assert.equal(parseWrapped('{"other":[]}', "claims"), null);
  assert.equal(parseWrapped("not json", "claims"), null);
});

test("no keys → no LLM routes and mock retrieval", () => {
  const routes = routesFromEnv({});
  for (const chain of Object.values(routes)) assert.equal(chain.length, 0);
  assert.equal(retrievalFromEnv({}).name, "mock");
});

test("keys → Mistral first for quality stages, Groq first by default", () => {
  const routes = routesFromEnv({ GROQ_API_KEY: "g", MISTRAL_API_KEY: "m" });
  assert.deepEqual(routes.default.map(b => b.name), ["groq", "mistral"]);
  assert.deepEqual(routes.extract.map(b => b.name), ["mistral", "groq"]);
  assert.equal(routes.objector[0].model, "mistral-medium-latest");
});

test("mock retrieval returns no evidence", async () => {
  const r = mockRetrieval();
  assert.deepEqual(await r.search("anything"), []);
  assert.deepEqual(await r.fetchPages(["https://a.com"]), []);
});
