// ── study/ReportStudyPanel.tsx — in-report research instrumentation for the
// VistaDex condition (and the field track): post-report confidence, per-claim
// and per-objection agree/disagree votes (agreeableness measure), and the
// post-condition survey. Rendered alongside the report, never replacing it.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui-vd";
import { Slider } from "@/components/ui/slider";
import type { Report } from "@/types";
import { logClaimVote, logConfidencePost, logConditionSurvey, logObjectionVote } from "./studyEvents";
import type { Condition } from "./participant";

function VoteRow({ label, onVote, controlId }: { label: string; onVote: (v: "agree" | "disagree") => void; controlId: { agree: string; disagree: string } }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 flex-1 truncate text-xs" title={label}>{label}</span>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          data-control={controlId.agree}
          onClick={() => onVote("agree")}
          className="rounded-control border-2 border-foreground/15 bg-card px-2.5 py-1 text-xs hover:border-foreground"
          aria-label="I agree"
        >👍 Agree</button>
        <button
          type="button"
          data-control={controlId.disagree}
          onClick={() => onVote("disagree")}
          className="rounded-control border-2 border-foreground/15 bg-card px-2.5 py-1 text-xs hover:border-foreground"
          aria-label="I disagree"
        >👎 Disagree</button>
      </div>
    </div>
  );
}

function Likert({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-sm text-on-page-muted">{value}/7</span>
      </div>
      <input type="range" min={1} max={7} step={1} value={value} data-control="baseline_likert"
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-foreground" />
      <div className="flex justify-between text-[10px] text-on-page-muted"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

export function ReportStudyPanel({ report, runId, condition, onDone }: {
  report: Report;
  runId: string;
  condition: Condition;
  onDone?: () => void;
}) {
  const [confPost, setConfPost] = useState(50);
  const [trust, setTrust] = useState(4);
  const [usefulness, setUsefulness] = useState(4);
  const [helpfulness, setHelpfulness] = useState(4);
  const [effort, setEffort] = useState(4);
  const [open, setOpen] = useState("");
  const [checkedSources, setCheckedSources] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    logConfidencePost(condition, runId, confPost);
    logConditionSurvey(condition, { trust, usefulness, helpfulness, effort, openTextLen: open.length });
    setSubmitted(true);
    onDone?.();
  };

  return (
    <div className="space-y-4">
      {/* Post-report confidence — the calibration measure */}
      <Panel tab="Your read" as="section">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Now that you've read the report: how confident are you that this idea is novel and viable?</span>
          <span className="font-mono text-sm text-on-page-muted">{confPost}%</span>
        </div>
        <Slider value={[confPost]} min={0} max={100} step={5} onValueChange={v => setConfPost(v[0])} data-control="study_conf_post" className="mt-1" />
        <p className="mt-2 text-xs text-on-page-muted">
          {checkedSources === null ? "" : checkedSources > 0
            ? `You opened ${checkedSources} source${checkedSources === 1 ? "" : "s"} yourself — noted, thanks.`
            : "You didn't open any sources yourself — noted, thanks."}
        </p>
      </Panel>

      {/* Agreeableness votes: each claim + each objection */}
      <Panel tab="Do you agree?" as="section">
        <p className="text-sm text-on-page-muted">For each item, say whether you agree with what the report concluded.</p>
        <div className="mt-3 divide-y divide-foreground/5">
          {report.claims.map((c, i) => (
            <VoteRow
              key={i}
              label={`Claim ${i + 1} — "${c.claim.slice(0, 60)}${c.claim.length > 60 ? "…" : ""}" (${c.status})`}
              controlId={{ agree: "study_claim_agree", disagree: "study_claim_disagree" }}
              onVote={v => logClaimVote(runId, i, c.status, v)}
            />
          ))}
          {report.objections.map((o, i) => (
            <VoteRow
              key={"obj" + i}
              label={`Objection ${i + 1} (${o.severity}) — "${o.objection.slice(0, 60)}${o.objection.length > 60 ? "…" : ""}"`}
              controlId={{ agree: "study_objection_agree", disagree: "study_objection_disagree" }}
              onVote={v => logObjectionVote(runId, i, o.severity, v)}
            />
          ))}
        </div>
      </Panel>

      {/* Post-condition survey */}
      <Panel tab="Rate this report" as="section">
        <div className="space-y-5">
          <Likert label="I trust this report's assessment of the idea" value={trust} onChange={setTrust} low="1 — not at all" high="7 — completely" />
          <Likert label="The report was useful for judging the idea" value={usefulness} onChange={setUsefulness} low="1 — useless" high="7 — extremely useful" />
          <Likert label="The report helped me see what to verify next" value={helpfulness} onChange={setHelpfulness} low="1 — not at all" high="7 — a lot" />
          <Likert label="Getting a good read on the idea took effort" value={effort} onChange={setEffort} low="1 — effortless" high="7 — a lot of work" />
        </div>
        <label className="mt-5 block">
          <span className="text-sm font-medium">Did you open any of the evidence links yourself?</span>
          <div className="mt-2 flex gap-2">
            {["0", "1-2", "3+"].map((o, i) => (
              <button key={o} type="button"
                data-control={i === 0 ? "study_sources_0" : i === 1 ? "study_sources_1_2" : "study_sources_3p"}
                onClick={() => setCheckedSources(i === 0 ? 0 : i === 1 ? 1 : 3)}
                className={`rounded-full border-2 px-3 py-1.5 text-sm ${checkedSources === (i === 0 ? 0 : i === 1 ? 1 : 3) ? "border-foreground bg-foreground text-on-foreground" : "border-foreground/15 bg-card"}`}>
                {o}
              </button>
            ))}
          </div>
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium">In your words: what did the report make you think or feel about this idea? (optional)</span>
          <textarea
            className="mt-1 min-h-24 w-full rounded-control border-2 border-foreground/10 bg-card px-3 py-2 outline-none focus:border-foreground"
            value={open} onChange={e => setOpen(e.target.value)} maxLength={2000} data-control="study_survey_open"
          />
        </label>
        {!submitted ? (
          <Button className="mt-5" data-control="study_survey_submit" onClick={submit}>Submit</Button>
        ) : (
          <p className="mt-5 text-sm font-medium text-green-700">✓ Thank you — your answers are recorded.</p>
        )}
      </Panel>
    </div>
  );
}
