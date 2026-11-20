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
