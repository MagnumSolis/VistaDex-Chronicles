// Reading time per claim (claim_dwell): how long each claim card was in view by the panel-viewed rule,
// summed per run and claim and sent when the report ends, like section_time.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { loadApp, reportShown } from "./helpers";

afterEach(() => { cleanup(); localStorage.clear(); });
type Ev = { type: string; payload: Record<string, unknown> };

it("logs claim_dwell per claim when the report ends", async () => {
  const { tm } = await loadApp();
  const telemetry = await import("@/telemetry");
  fireEvent.click(await screen.findByRole("button", { name: "Skip to the tool" }));
  fireEvent.click(await screen.findByRole("button", { name: "Mental-health journaling app" }));
  fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));
  await reportShown();
  const runId = (tm.events() as Ev[]).find(e => e.type === "run_started")!.payload.run_id as string;
  telemetry.claimInView(runId, 1, true);
  await new Promise(r => setTimeout(r, 30));
  telemetry.claimInView(runId, 1, false);
  window.dispatchEvent(new Event("pagehide"));
  const dwell = (tm.events() as Ev[]).filter(e => e.type === "claim_dwell");
  expect(dwell).toHaveLength(1);
  expect(dwell[0].payload.run_id).toBe(runId);
  expect(dwell[0].payload.claim_index).toBe(1);
  expect(dwell[0].payload.ms as number).toBeGreaterThanOrEqual(20);
}, 30000);
