// ── FlagWrong: "This looks wrong" on a claim or an objection (study-19) ──
// Amershi et al. 2019, G9 (support efficient correction) and G15 (granular feedback); contestability: people can
// disagree with the report in place. Logged as report_flag with the item's status or severity, once per item.
// Shown only on this session's own runs, where the flag can be recorded.
import { useState } from "react";
import { Flag } from "lucide-react";
import * as telemetry from "@/telemetry";

const CONTROL = { claim: "report_flag_claim", objection: "report_flag_objection" } as const;

export function FlagWrong({ runId, kind, index, status = null, severity = null }:
  { runId: string | null; kind: "claim" | "objection"; index: number; status?: string | null; severity?: string | null }) {
  const [done, setDone] = useState(false);
  if (!runId) return null;
  const name = `${kind} ${index + 1}`;
  if (done) return <p role="status" className="text-sm font-medium text-foreground">Noted: you think {name} looks wrong. Thank you.</p>;
  return (
    <button type="button" aria-label={`This looks wrong: ${name}`} data-control={CONTROL[kind]}
      onClick={() => { telemetry.reportFlag(runId, kind, index, status, severity); setDone(true); }}
      className="inline-flex h-10 items-center gap-1.5 rounded-control px-2 text-sm font-medium text-foreground underline-offset-4 hover:underline print:hidden">
      <Flag aria-hidden className="size-4" /> This looks wrong
    </button>
  );
}
