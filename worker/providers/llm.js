// worker/providers/llm.js — thin provider interface so Groq ↔ Mistral can swap
// without touching stage logic. Secrets arrive as Worker env vars only.

class LLMProvider {
  constructor({ apiKey, model }) {
    if (!apiKey) throw new Error(`${this.constructor.name}: missing API key`);
    this.apiKey = apiKey;
    this.model = model;
  }
  async chat({ system, user, json }) { throw new Error("not implemented"); }
}

export class GroqProvider extends LLMProvider {
  constructor({ apiKey, model = "openai/gpt-oss-120b" }) {
    super({ apiKey, model });
    this.name = "groq";
  }
  async chat({ system, user, json }) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`${this.name}  ${res.status}: ${await res.text()}`);
    const data = await res.json();
    this.lastUsage = data.usage ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens } : null;
    return data.choices?.[0]?.message?.content ?? "";
  }
}

export class MistralProvider extends LLMProvider {
  constructor({ apiKey, model = "mistral-small-latest" }) {
    super({ apiKey, model });
    this.name = "mistral";
  }
  async chat({ system, user, json }) {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`mistral ${res.status}: ${await res.text()}`);
    const data = await res.json();
    this.lastUsage = data.usage ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens } : null;
    return data.choices?.[0]?.message?.content ?? "";
  }
}

// Returns the first provider that has a key; callers may pass an explicit order.
export function makeLLM(env, { preferObjector = false } = {}) {
  const primaries = preferObjector
    ? [new MistralProvider({ apiKey: env.MISTRAL_API_KEY }), new GroqProvider({ apiKey: env.GROQ_API_KEY })]
    : [new GroqProvider({ apiKey: env.GROQ_API_KEY }), new MistralProvider({ apiKey: env.MISTRAL_API_KEY })];
  return primaries.find(p => p.apiKey) || null;
}

export async function chatWithFallback(env, opts, { preferObjector = false } = {}) {
  const providers = [];
  const g = env.GROQ_API_KEY ? new GroqProvider({ apiKey: env.GROQ_API_KEY }) : null;
  const m = env.MISTRAL_API_KEY ? new MistralProvider({ apiKey: env.MISTRAL_API_KEY }) : null;
  if (preferObjector) { if (m) providers.push(m); if (g) providers.push(g); }
  else { if (g) providers.push(g); if (m) providers.push(m); }
  if (providers.length === 0) throw new Error("no_llm_provider_configured");
  let lastErr;
  for (const p of providers) {
    try {
      return { provider: p.name, content: await p.chat(opts) };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
