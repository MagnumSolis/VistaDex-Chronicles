// A live run past the 75 s estimate (now legitimate, up to the server's 150 s deadline): the bar keeps
// creeping towards 99% without reaching it, and the copy says the run is slow instead of "About 5s to go".
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESTIMATE_MS, RUN_CAP_MS, RunProgress, estimatedPct } from "@/components/RunProgress";

beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance", "Date"] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const state = () => {
  const el = screen.getByRole("progressbar");
  const box = el.parentElement!;
  return { pct: Number(el.getAttribute("aria-valuenow")), width: (el.firstElementChild as HTMLElement).style.width, text: box.textContent ?? "" };
};
const at = (ms: number) => act(() => { vi.advanceTimersByTime(ms - performance.now()); });

describe("RunProgress past the estimate", () => {
  it("keeps moving, says it is slow, and never reaches 100", () => {
    render(<RunProgress running doneCount={0} total={5} server startedAt={performance.now()} />);
    const t0 = performance.now();
    const after = (ms: number) => at(t0 + ms);

    after(60_000);
    const s60 = state();
    expect(s60.pct).toBeLessThan(95);
    expect(s60.text).toMatch(/About \d+s to go/);
    expect(s60.text).toMatch(/usually done in about a minute/);

    after(76_000);
    const s76 = state();
    expect(s76.text).toMatch(/Taking longer than usual/);
    expect(s76.text).not.toMatch(/to go/);
    expect(s76.text).toMatch(/Running 76s · some sources are slow; it should finish within 2½ minutes/);

    after(100_000);
    const s100 = state();
    after(140_000);
    const s140 = state();
    expect(s140.text).toMatch(/Taking longer than usual/);
    expect(s140.pct).toBeGreaterThan(s100.pct);
    expect(s100.pct).toBeGreaterThan(s76.pct);
    expect(s76.pct).toBeGreaterThanOrEqual(95);
    expect(s140.width).toBe(`${s140.pct}%`); // aria-valuenow and the bar show the same pct

    after(10 * 60_000);
    const s10m = state();
    expect(s10m.pct).toBeLessThan(100);
    expect(s10m.pct).toBeLessThan(99);
    expect(s10m.pct).toBeGreaterThanOrEqual(s140.pct);
  });

  it("the estimate never goes backwards and never reaches 99", () => {
    let prev = -1;
    for (let ms = 0; ms <= 30 * 60_000; ms += 250) {
      const pct = estimatedPct(ms);
      expect(pct).toBeGreaterThanOrEqual(prev);
      expect(pct).toBeLessThan(99);
      prev = pct;
    }
    expect(estimatedPct(ESTIMATE_MS)).toBe(95);
    expect(estimatedPct(RUN_CAP_MS)).toBeGreaterThan(estimatedPct(ESTIMATE_MS + 1_000));
  });
});
