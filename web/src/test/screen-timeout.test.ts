// A screening the client gives up on after SCREEN_TIMEOUT_MS is a "timeout", not a connection problem;
// a request that fails outright is still "network".
import { afterEach, describe, expect, it, vi } from "vitest";

async function client() {
  vi.resetModules();
  const { CONFIG } = await import("@proto/config.js");
  CONFIG.PROXY_URL = "https://proxy.test";
  return import("@proto/ui/client.js");
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("client: timeout vs network", () => {
  it("a request aborted by the client timeout gives code timeout", async () => {
    vi.useFakeTimers();
    // Never answers; rejects only when its signal aborts, as fetch does.
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")));
    })));
    const { screenIdea, SCREEN_TIMEOUT_MS } = await client();
    const caught = screenIdea("An idea").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(SCREEN_TIMEOUT_MS);
    const err = (await caught) as { code: string; message: string };
    expect(err.code).toBe("timeout");
    expect(err.message).toMatch(/longer than 240 seconds/);
  });

  it("a rejected fetch still gives code network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const { screenIdea } = await client();
    const err = (await screenIdea("An idea").catch((e: unknown) => e)) as { code: string };
    expect(err.code).toBe("network");
  });
});

describe("errorCopy", () => {
  it("timeout has its own honest copy", async () => {
    const { errorCopy } = await import("@/lib/run");
    expect(errorCopy("timeout")).toEqual({
      title: "This screening took too long",
      body: "One of our sources was slow to answer. Please try again in a few minutes. Your idea text is still here.",
    });
    expect(errorCopy("network").title).toBe("We couldn't reach the screening server");
  });
});
