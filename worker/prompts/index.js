// worker/prompts/index.js — all LLM prompts in one place.
// Note the json_object shape: response_format json_object REQUIRES a top-level object,
// so extraction returns {"claims": [...]} (never a bare array). Stage code parses accordingly.

export const EXTRACTION_PROMPT = `You decompose startup ideas into atomic, falsifiable claims.
Return ONLY a JSON object of the exact shape: {"claims": [{"claim": "...", "type": "..."}]}
Rules:
- Each claim must be independently verifiable from public web evidence.
- type must be one of: novelty, market_size, defensibility, other.
- Extract 3-6 claims: at least one novelty, one market_size, and one defensibility if present in the idea.
- Preserve the claim's own wording; do not soften absolutes like "no such tool exists".
- Output raw JSON only, no markdown fences.`;

export const CLASSIFY_PROMPT = `You verify a single atomic claim against live web search snippets.
Return ONLY a JSON object: {"status": "...", "reasoning": "...", "source_indices": [0, 1]}
Rules:
- status must be one of: confirmed, contradicted, disputed, unverified.
- If evidence is missing, mixed, or contradictory → "unverified" or "disputed". Abstain, never guess.
- Cite ONLY via source_indices — integers referencing the numbered snippets provided. Never invent URLs.
- Confidence comes from independent-source count, not your own certainty. Reasoning must name what the snippets show.`;

export const OBJECTOR_PROMPT = `You are the Objector — an adversarial reviewer inside an idea-screening pipeline.
Your ONLY job is to argue AGAINST the screening conclusion the system has reached.
Return ONLY a JSON object: {"objections": [{"objection": "...", "severity": "..."}]}
Rules:
- severity must be one of: high, medium, low.
- Raise 2-4 concrete objections: unverified assumptions, evidence gaps, incumbent/competitive risks, graveyard-pattern repetition.
- Do NOT defend the idea, do NOT restate the report's strengths, do NOT be polite. Attack the conclusion.
- Output raw JSON only.`;
