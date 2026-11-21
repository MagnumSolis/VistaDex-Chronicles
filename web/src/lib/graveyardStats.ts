// ── graveyardStats.ts — The live graveyard's size, for the Home counter ──
// GET <proxy>/graveyard/stats → { confirmed, updated_at }. Two public numbers, no study data, nothing
// logged. null when there is no proxy (key-free mock build) or the request fails: the counter then hides.
import { CONFIG } from "@proto/config.js";

export interface GraveyardStats { confirmed: number; updated_at: string | null }

export async function fetchGraveyardStats(): Promise<GraveyardStats | null> {
  if (!CONFIG.PROXY_URL) return null;
  try {
    const res = await fetch(`${CONFIG.PROXY_URL.replace(/\/$/, "")}/graveyard/stats`);
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.confirmed === "number" && body.confirmed > 0 ? { confirmed: body.confirmed, updated_at: body.updated_at ?? null } : null;
  } catch {
    return null;
  }
}

// ── Quiz pool for the waiting screen: GET <proxy>/graveyard/quiz → { entries: [{ name, clue, year, cause }] } ──
export interface QuizEntry { name: string; clue: string; year: number; cause: string }

export async function fetchQuizPool(): Promise<QuizEntry[] | null> {
  if (!CONFIG.PROXY_URL) return null;
  try {
    const res = await fetch(`${CONFIG.PROXY_URL.replace(/\/$/, "")}/graveyard/quiz`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.json();
    const list = Array.isArray(body?.entries) ? body.entries.filter((e: QuizEntry) => e && typeof e.name === "string" && typeof e.clue === "string") : [];
    return list.length >= 4 ? list : null;
  } catch {
    return null;
  }
}
