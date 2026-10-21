// Run ids are random, so (session_id, run_id) stays unique across reloads and tabs. The old "r1", "r2"…
// counter restarted on every page load while the session id persisted, so a reload reused "r1".
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdeaInput } from "@/types";

const input: IdeaInput = { title: "t", pitch: "p", problem: "q", solution: "s", moat: "", industries: [], role: null, markets: [] };
const start = async () => (await import("@/telemetry")).runStarted({ input, ideaChars: 4, mode: "mock", sample: null });

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetModules(); });

describe("run ids", () => {
  it("are r_ + 12 random hex, distinct within a page load and after a reload", async () => {
    const a = await start();
    const b = await start();
    vi.resetModules(); // simulated reload: the telemetry module starts afresh
    const c = await start();
    for (const id of [a, b, c]) expect(id).toMatch(/^r_[0-9a-f]{12}$/);
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
