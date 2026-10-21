// The network guard is loaded for every web test (vitest setupFiles): fetch and XMLHttpRequest to a host
// other than localhost throw before anything is sent. Reserved hosts only (.invalid, .test).
import { afterEach, describe, expect, it } from "vitest";

// These blocks are expected; clear them so the setup's afterEach doesn't fail the test.
afterEach(() => { (globalThis as { __vistadexBlocked?: string[] }).__vistadexBlocked?.splice(0); });

describe("network guard (web)", () => {
  it("is loaded, and blocks fetch off localhost, naming the URL and the test", async () => {
    expect((globalThis as Record<symbol, unknown>)[Symbol.for("vistadex.networkGuard")]).toBe(true);
    await expect(fetch("https://guard-check.invalid/probe")).rejects.toThrow(/NetworkGuardError: blocked fetch to https:\/\/guard-check\.invalid\/probe in test "network guard \(web\) > is loaded/);
  });
  it("blocks XMLHttpRequest off localhost", () => {
    const xhr = new XMLHttpRequest();
    expect(() => xhr.open("POST", "https://example.test/events")).toThrow(/NetworkGuardError: blocked XMLHttpRequest to https:\/\/example\.test\/events/);
  });
  it("lets relative and localhost URLs through to the real API", () => {
    expect(() => new XMLHttpRequest().open("GET", "/local")).not.toThrow();
    expect(() => new XMLHttpRequest().open("GET", "http://127.0.0.1:9/")).not.toThrow();
  });
});
