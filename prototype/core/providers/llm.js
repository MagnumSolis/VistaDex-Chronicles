// ── llm.js — One LLM interface, several backends, ordered fallback ──
// Backends are OpenAI-compatible chat endpoints (Groq, Mistral). Keys are only
// ever passed in on the server side (Worker); the browser builds an empty chain.
// Every call goes through http.js: a timeout, one retry on 429 / 5xx, and the run's call budget.
import { resilientFetch } from "./http.js";

export class ProviderError extends Error {
  constructor(provider, status, message) {
    super(`${provider}: ${message}`);
    this.provider = provider;
    this.status = status;
  }
}

export class NoProviderAvailable extends Error {
  constructor(stage, attempts) {
    super(`no LLM provider available for stage "${stage}"`);
    this.stage = stage;
    this.attempts = attempts;
  }
}

function openAICompatible({ name, url, apiKey, model, fetchImpl, budget, sleep }) {
  const call = resilientFetch(fetchImpl, { budget, sleep });
  return {
    name,
    model,
    async complete({ messages, json = false, temperature = 0, maxTokens = 1500 }) {
      const body = { model, messages, temperature, max_tokens: maxTokens };
      if (json) body.response_format = { type: "json_object" };
      let res;
      try {
        res = await call(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
        });
      } catch (err) {
        throw new ProviderError(name, 0, `network error: ${err.message}`);
      }
      if (!res.ok) {
        // Upstream error bodies go into traces: never let the key ride along.
        const detail = (await res.text().catch(() => "")).split(apiKey).join("[redacted]");
        throw new ProviderError(name, res.status, `HTTP ${res.status} ${detail.slice(0, 200)}`);
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new ProviderError(name, res.status, "empty completion");
      return content;
    },
  };
}

// Default model: openai/gpt-oss-120b — verified available on the team's Groq key
// (llama-3.3-70b-versatile is NOT on that account; override with GROQ_MODEL var).
export function groqBackend({ apiKey, model = "openai/gpt-oss-120b", fetchImpl, budget, sleep } = {}) {
  return openAICompatible({ name: "groq", url: "https://api.groq.com/openai/v1/chat/completions", apiKey, model, fetchImpl, budget, sleep });
}

export function mistralBackend({ apiKey, model = "mistral-small-latest", fetchImpl, budget, sleep } = {}) {
  return openAICompatible({ name: "mistral", url: "https://api.mistral.ai/v1/chat/completions", apiKey, model, fetchImpl, budget, sleep });
}

// routes: { default: [backend...], extract: [...], classify: [...], objector: [...] }
// A stage with no route of its own uses `default`. An empty chain means "no LLM":
// stages then take their deterministic path.
export function createLLM(routes = {}, trace = null) {
  const chainFor = stage => routes[stage] || routes.default || [];
  return {
    available(stage) {
      return chainFor(stage).length > 0;
    },
    async complete(stage, request) {
      const attempts = [];
      for (const backend of chainFor(stage)) {
        try {
          const content = await backend.complete(request);
          trace?.log("llm_call", { stage, provider: backend.name, model: backend.model, ok: true, fallbacks: attempts.length });
          return { content, provider: backend.name, model: backend.model };
        } catch (err) {
          attempts.push({ provider: backend.name, status: err.status ?? null, error: err.message });
          trace?.log("llm_fallback", { stage, provider: backend.name, status: err.status ?? null, error: err.message });
        }
      }
      throw new NoProviderAvailable(stage, attempts);
    },
  };
}

// Build the route table from environment-style keys. Only call this server-side.
// opts: { budget, sleep } shared by every backend of one run (http.js).
export function routesFromEnv(env = {}, fetchImpl, { budget, sleep } = {}) {
  const groq = env.GROQ_API_KEY ? groqBackend({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL || undefined, fetchImpl, budget, sleep }) : null;
  const mistral = model => (env.MISTRAL_API_KEY ? mistralBackend({ apiKey: env.MISTRAL_API_KEY, model, fetchImpl, budget, sleep }) : null);
  const small = mistral(env.MISTRAL_SMALL_MODEL || "mistral-small-latest");
  const strong = mistral(env.MISTRAL_OBJECTOR_MODEL || "mistral-medium-latest");
  const chain = (...bs) => bs.filter(Boolean);
  return {
    default: chain(groq, small),
    extract: chain(small, groq),
    classify: chain(small, groq),
    objector: chain(strong, groq),
  };
}

// Structured output: the model must return an object wrapper such as {"claims": [...]}.
// A bare array (or anything else) is treated as malformed and yields null, so the
// caller abstains instead of guessing.
export function parseWrapped(content, key) {
  let obj;
  try {
    obj = JSON.parse(stripFences(content));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  return Array.isArray(obj[key]) ? obj[key] : null;
}

function stripFences(s) {
  return String(s).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
