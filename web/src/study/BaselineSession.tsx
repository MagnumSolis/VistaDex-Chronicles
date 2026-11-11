// ── study/BaselineSession.tsx — companion page for the BASELINE condition.
// The participant pastes the assigned idea into their AI chatbot of choice,
// reads the answer, and this page captures the SAME measures VistaDex captures:
// pre/post confidence, perceived trust/usefulness/effort, and an open answer.
// We cannot (and should not) capture anything inside ChatGPT itself — no
// scraping of other platforms — we capture the participant's ratings ABOUT it.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui-vd";
import { Slider } from "@/components/ui/slider";
import type { Participant } from "./participant";
import { conditionDone, studyIdea } from "./participant";
import { logConditionStarted, logConfidencePre, logConfidencePost, logConditionSurvey, logConditionEnded, newBaselineRunId, type SourcesChecked } from "./studyEvents";
import { Choice } from "./ReportStudyPanel";

function Likert({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-sm text-foreground/70">{value}/7</span>
      </div>
      <input
        type="range" min={1} max={7} step={1} value={value}
        data-control="baseline_likert"
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-foreground"
      />
      <div className="flex justify-between text-[11px] font-medium text-foreground/75"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

export function BaselineSession({ participant, onDone }: { participant: Participant; onDone: () => void }) {
  // First part (VistaDex still to do): hands over to VistaDex. Second part: finishes the study.
  const [first] = useState(() => !conditionDone(participant, "vistadex"));
  const part = first ? 1 : 2;
  const [step, setStep] = useState<"pre" | "chat" | "post" | "finished">("pre");
  const [runId] = useState(newBaselineRunId);
  const [sourcesChecked, setSourcesChecked] = useState<SourcesChecked>(null);
  const [confPre, setConfPre] = useState(50);
  const [confPost, setConfPost] = useState(50);
  const [tool, setTool] = useState("");
  const [trust, setTrust] = useState(4);
  const [usefulness, setUsefulness] = useState(4);
  const [helpfulness, setHelpfulness] = useState(4);
  const [effort, setEffort] = useState(4);
  const [open, setOpen] = useState("");
  const [minutes, setMinutes] = useState("");

  const idea = studyIdea(participant.ideaKey);

  // Confidence before the participant sees the chatbot's answer (H1), then the chatbot steps.
  const begin = () => {
    logConditionStarted("baseline", participant.ideaKey, part);
    logConfidencePre("baseline", confPre, runId);
    setStep("chat");
  };
  const intro = (
    <h1 className="font-display text-3xl">{first ? "Your first task: an AI chatbot" : "Your second task: an AI chatbot"}</h1>
  );

  if (step === "pre") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Panel tab={`Part ${part}: AI chatbot`} as="section">
          {intro}
          <p className="mt-4 text-sm leading-relaxed">Your idea ({first ? "also your idea for VistaDex later" : "the same idea you screened with VistaDex"}):</p>
          <div className="mt-2 rounded-inner border-2 border-foreground/10 bg-card p-3 text-xs leading-relaxed">{idea}</div>
          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Before you open the chatbot: how confident are you that this idea is novel and viable?</span>
              <span className="font-mono text-sm text-foreground/70">{confPre}%</span>
            </div>
            <Slider value={[confPre]} min={0} max={100} step={5} onValueChange={v => setConfPre(v[0])} data-control="baseline_conf_pre" className="mt-1" />
          </div>
          <Button className="mt-5" data-control="baseline_start" onClick={begin}>Next: ask the chatbot →</Button>
        </Panel>
      </div>
    );
  }

  if (step === "chat") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Panel tab={`Part ${part}: AI chatbot`} as="section">
          {intro}
          <ol className="mt-4 space-y-3 text-sm leading-relaxed">
            <li><b>1.</b> Copy this idea:
              <div className="mt-2 rounded-inner border-2 border-foreground/10 bg-card p-3 text-xs leading-relaxed">{idea}</div>
            </li>
            <li><b>2.</b> Open ChatGPT, Claude, Gemini: whichever you normally use.</li>
            <li><b>3.</b> Ask it to evaluate this startup idea, in your own words.</li>
            <li><b>4.</b> Read the answer as you normally would.</li>
            <li><b>5.</b> Come back here and answer the questions.</li>
          </ol>
          <label className="mt-4 block">
            <span className="text-sm font-medium">Which tool did you use?</span>
            <input
              className="mt-1 w-full rounded-control border-2 border-foreground/10 bg-card px-3 py-2 outline-none focus:border-foreground"
              value={tool} onChange={e => setTool(e.target.value)} data-control="baseline_tool_field"
              placeholder="e.g. ChatGPT"
            />
          </label>
          <Button className="mt-5" data-control="baseline_continue" onClick={() => setStep("post")}>
            I've read the AI's answer — continue →
          </Button>
        </Panel>
      </div>
    );
  }

  if (step === "finished") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Panel tab={`Part ${part}: done`} as="section">
          <h1 className="font-display text-3xl">You've finished both parts</h1>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-foreground">
            Thank you. Your answers for both tools are recorded, and there is nothing more to do. You can close this tab.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Panel tab={`Part ${part}: rate the AI chatbot`} as="section">
        <h1 className="font-display text-3xl">Rate what you just read</h1>
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Now: how confident are you that this idea is novel and viable?</span>
            <span className="font-mono text-sm text-foreground/70">{confPost}%</span>
          </div>
          <Slider value={[confPost]} min={0} max={100} step={5} onValueChange={v => setConfPost(v[0])} data-control="baseline_conf_post" className="mt-1" />
        </div>
        <div className="mt-6 space-y-5">
          <Likert label="I trust the AI's assessment of this idea" value={trust} onChange={setTrust} low="1 — not at all" high="7 — completely" />
          <Likert label="The assessment was useful for judging this idea" value={usefulness} onChange={setUsefulness} low="1 — useless" high="7 — extremely useful" />
          <Likert label="The assessment helped me see what to verify next" value={helpfulness} onChange={setHelpfulness} low="1 — not at all" high="7 — a lot" />
          <Likert label="Getting a good read on the idea took effort" value={effort} onChange={setEffort} low="1 — effortless" high="7 — a lot of work" />
        </div>
        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Did you check any of the AI's sources, or look anything up yourself?</legend>
          <div className="mt-2 grid grid-cols-3 gap-1.5 sm:gap-2">
            {(["0", "1-2", "3+"] as const).map((o, i) => (
              <Choice key={o} name="baseline_sources" checked={sourcesChecked === o} onSelect={() => setSourcesChecked(o)}
                control={["study_sources_0", "study_sources_1_2", "study_sources_3p"][i]} compact>
                {o}
              </Choice>
            ))}
          </div>
        </fieldset>
        <label className="mt-5 block">
          <span className="text-sm font-medium">About how long did you spend with the AI? (minutes)</span>
          <input
            className="mt-1 w-full rounded-control border-2 border-foreground/10 bg-card px-3 py-2 outline-none focus:border-foreground"
            value={minutes} onChange={e => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))} data-control="baseline_minutes_field"
            placeholder="e.g. 5"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium">In your words: what did the AI's answer make you think or feel about this idea? (optional)</span>
          <textarea
            className="mt-1 min-h-24 w-full rounded-control border-2 border-foreground/10 bg-card px-3 py-2 outline-none focus:border-foreground"
            value={open} onChange={e => setOpen(e.target.value)} maxLength={2000} data-control="baseline_open_field"
          />
        </label>
        <Button
          className="mt-5"
          onClick={() => {
            logConfidencePost("baseline", runId, confPost);
            logConditionSurvey("baseline", { trust, usefulness, helpfulness, effort, openText: open, sourcesChecked });
            logConditionEnded("baseline", runId, 0);
            onDone();
            if (!first) setStep("finished");
          }}
        data-control="baseline_submit"
        >
          {first ? "Submit and continue to VistaDex →" : "Submit and finish"}
        </Button>
      </Panel>
    </div>
  );
}
