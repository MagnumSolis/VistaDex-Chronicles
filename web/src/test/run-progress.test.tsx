// Live-run progress comes from the run's own start time, so leaving the running screen and coming back
// shows the real elapsed time and never moves the bar backwards.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RunProgress } from "@/components/RunProgress";
import { fillIdea, go, json, loadApp, PROXY_REPORT, stubFetch } from "./helpers";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

const bar = () => {
  const el = screen.getByRole("progressbar");
  return { pct: Number(el.getAttribute("aria-valuenow")), secs: Number(/Running (\d+)s/.exec(el.parentElement!.textContent ?? "")?.[1] ?? NaN) };
};
const wait = (ms: number) => act(() => new Promise(r => setTimeout(r, ms)));

describe("RunProgress", () => {
  it("shows the time since the run started, not since it was drawn", () => {
    render(<RunProgress running doneCount={0} total={5} server startedAt={performance.now() - 30_000} />);
    expect(bar().secs).toBeGreaterThanOrEqual(30);
    expect(bar().pct).toBe(40); // 30s of the 75s estimate
  });
});

describe("leaving the running screen and coming back (live run)", () => {
  it("keeps elapsed time and the bar, starts no second run, and shows the report when it finished while away", async () => {
    let answer!: () => void;
    const screenCalls = stubFetch(url => url.endsWith("/screen")
      ? new Promise<Response>(res => { answer = () => res(json(PROXY_REPORT, 200, { "X-VistaDex-Mode": "live" })); })
      : json({ stored: 1 }));
    const { tm } = await loadApp({ proxy: true });
    fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
    fillIdea();
    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    await screen.findByRole("progressbar");
    await wait(2600);
    const before = bar();
    expect(before.secs).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole("button", { name: "Back to the idea" }));
    fireEvent.click(await screen.findByRole("link", { name: "See its progress" }));
    go("#/running"); // the link's hash navigation, as jsdom does not follow it
    await screen.findByRole("progressbar");
    const after = bar();
    expect(after.secs).toBeGreaterThanOrEqual(before.secs);
    expect(after.pct).toBeGreaterThanOrEqual(before.pct);

    // Finishes while the visitor is on Screen an idea: the report is shown, no stuck bar.
    go("#/screen");
    await act(async () => { answer(); });
    await waitFor(() => expect(location.hash).toMatch(/^#\/report\//));
    const types = (tm.events() as { type: string }[]).map(e => e.type);
    expect(types.filter(t => t === "run_started")).toHaveLength(1);
    expect(types.filter(t => t === "run_completed")).toHaveLength(1);
    expect(types.filter(t => t.startsWith("quiz_"))).toEqual([]);
    expect(screenCalls.filter(c => c.url.endsWith("/screen"))).toHaveLength(1);
  }, 30000);
});
