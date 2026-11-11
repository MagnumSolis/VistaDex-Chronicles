// Study track: what each condition records for the paired analysis (H1 confidence before → after, H2
// verification, condition order and idea). Both conditions log condition_started, confidence_pre (before the
// participant sees the tool's answer), confidence_post, condition_survey with the verification self-report,
// and condition_ended, all under one run id per condition.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { go, loadApp, reportShown } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); });

type Ev = { type: string; payload: Record<string, unknown> };
const participant = (order: ["baseline", "vistadex"] | ["vistadex", "baseline"], ideaKey = "C") =>
  localStorage.setItem("vistadex_participant", JSON.stringify({ track: "study", code: "P09", role: null, ideaKey, order, registered_at: "2026-11-11T00:00:00Z" }));
const of = (evs: Ev[], type: string, condition?: string) => evs.filter(e => e.type === type && (!condition || e.payload.condition === condition));

async function start(hash: string) {
  const app = await loadApp();
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  go(hash);
  return app;
}

describe("AI chatbot condition", () => {
  it("asks for confidence before the chatbot steps, and logs every measure under one run id", async () => {
    participant(["baseline", "vistadex"]);
    const { tm } = await start("/baseline");
    await screen.findByText(/Before you open the chatbot: how confident/);
    expect(screen.queryByText(/Open ChatGPT, Claude, Gemini/)).toBe(null);
    fireEvent.click(screen.getByRole("button", { name: /Next: ask the chatbot/ }));
    const evs = () => tm.events() as Ev[];
    expect(of(evs(), "condition_started", "baseline")[0].payload).toEqual({ condition: "baseline", idea_key: "C", order_position: 1 });
    const pre = of(evs(), "confidence_pre", "baseline");
    expect(pre).toHaveLength(1);
    const runId = pre[0].payload.run_id as string;
    expect(runId).toMatch(/^b_[0-9a-f]{12}$/);

    expect(screen.getByText(/Open ChatGPT, Claude, Gemini/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /I've read the AI's answer/ }));
    fireEvent.click(screen.getByRole("radio", { name: "1-2" }));
    fireEvent.click(screen.getByRole("button", { name: /Submit and continue to VistaDex/ }));

    expect(of(evs(), "confidence_post", "baseline")[0].payload.run_id).toBe(runId);
    expect(of(evs(), "condition_survey", "baseline")[0].payload.sources_checked).toBe("1-2");
    expect(of(evs(), "condition_ended", "baseline")[0].payload).toEqual({ condition: "baseline", run_id: runId, verified_sources: 0 });
  }, 30000);

  it("done second: the order position is 2", async () => {
    participant(["vistadex", "baseline"]);
    localStorage.setItem("vistadex_participant_done_vistadex", "true");
    const { tm } = await start("/baseline");
    fireEvent.click(await screen.findByRole("button", { name: /Next: ask the chatbot/ }));
    expect(of(tm.events() as Ev[], "condition_started", "baseline")[0].payload.order_position).toBe(2);
  }, 30000);
});

describe("VistaDex condition", () => {
  it("logs its start, the verification self-report and its end under the report's run id", async () => {
    participant(["baseline", "vistadex"], "D");
    localStorage.setItem("vistadex_participant_done_baseline", "true");
    const { tm } = await start("/screen");
    fireEvent.click(await screen.findByRole("button", { name: /^Run$/ }));
    await reportShown();
    const evs = () => tm.events() as Ev[];
    const runId = of(evs(), "run_started")[0].payload.run_id;
    expect(of(evs(), "condition_started", "vistadex")[0].payload).toEqual({ condition: "vistadex", idea_key: "D", order_position: 2 });
    fireEvent.click(screen.getByRole("radio", { name: "3+" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(of(evs(), "condition_survey", "vistadex")[0].payload.sources_checked).toBe("3+");
    expect(of(evs(), "run_scoped_survey")[0].payload.sources_checked).toBe("3+");
    expect(of(evs(), "condition_ended", "vistadex")[0].payload).toEqual({ condition: "vistadex", run_id: runId, verified_sources: 0 });
  }, 30000);

  it("field-track runs log no condition start or end", async () => {
    const { tm } = await start("/screen");
    fireEvent.click(await screen.findByRole("button", { name: "Mental-health journaling app" }));
    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
    await reportShown();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const evs = tm.events() as Ev[];
    expect(of(evs, "condition_started")).toEqual([]);
    expect(of(evs, "condition_ended")).toEqual([]);
    expect(of(evs, "condition_survey")[0].payload.sources_checked).toBe(null);
  }, 30000);
});
