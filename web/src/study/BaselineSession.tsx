// ── study/BaselineSession.tsx — the AI chatbot part of the study track (study-16) ──
// 1. Prompt: one fixed prompt with the participant's idea, copied into the chatbot they normally use.
// 2. While it answers: four sliders, answered before they read the reply (confidence before, market
//    familiarity, trust in AI chatbots, how often they use them).
// 3. Paste: they read the answer as they normally would (follow-ups allowed), then paste it all here. The
//    text is stored with their study data to be compared with their VistaDex report.
// 4. Rate: the same measures VistaDex gets (confidence after, four 1 to 7 ratings, sources checked).
// Nothing is read from the chatbot's site: the participant decides what they paste.
import { useEffect, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui-vd";
import { Slider } from "@/components/ui/slider";
import { flushNow } from "@/telemetry";
import type { Participant } from "./participant";
import { chatbotPrompt, conditionDone } from "./participant";
import {
  MAX_ANSWER_CHARS, logChatbotAnswer, logConditionEnded, logConditionStarted, logConditionSurvey, logConfidencePost, logConfidencePre,
  logParticipantProfile, newBaselineRunId, type SourcesChecked, type WebSearch,
} from "./studyEvents";
import { Choice } from "./ReportStudyPanel";

export const TOOLS = ["ChatGPT", "Claude", "Gemini", "Copilot", "Perplexity", "Other"] as const;
const MIN_ANSWER_CHARS = 200;
const FIELD = "mt-1 w-full rounded-control border-2 border-input bg-card px-3 py-2 outline-none focus:border-foreground";

function Likert({ label, value, onChange, low, high, control }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string; control: string }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span id={id} className="text-sm font-medium">{label}</span>
        <span className="font-mono text-sm text-foreground/70">{value}/7</span>
      </div>
      <input
        type="range" min={1} max={7} step={1} value={value} aria-labelledby={id}
        data-control={control}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-foreground"
      />
      <div className="flex justify-between text-[11px] font-medium text-foreground/75"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-5 rounded-card bg-card p-4 md:p-5">
      <h2 className="font-display text-xl leading-tight"><span className="font-mono text-base">{n}.</span> {title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export function BaselineSession({ participant, onDone }: { participant: Participant; onDone: () => void }) {
  const [first] = useState(() => !conditionDone(participant, "vistadex"));
  const part = first ? 1 : 2;
  const [step, setStep] = useState<"prompt" | "waiting" | "paste" | "post">("prompt");
  const [runId] = useState(newBaselineRunId);
  const prompt = chatbotPrompt(participant.ideaKey);
  // Each step starts at the top of the page (the button that leads to it sits at the bottom).
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  const [copied, setCopied] = useState<"" | "ok" | "failed">("");
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied("ok"); } catch { setCopied("failed"); }
  };

  const [confPre, setConfPre] = useState(50);
  const [familiarity, setFamiliarity] = useState(4);
  const [aiTrust, setAiTrust] = useState(4);
  const [aiUse, setAiUse] = useState(4);

  const [tool, setTool] = useState("");
  const [model, setModel] = useState("");
  const [webSearch, setWebSearch] = useState<WebSearch>(null);
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState("");

  const [confPost, setConfPost] = useState(50);
  const [trust, setTrust] = useState(4);
  const [usefulness, setUsefulness] = useState(4);
  const [helpfulness, setHelpfulness] = useState(4);
  const [effort, setEffort] = useState(4);
  const [sourcesChecked, setSourcesChecked] = useState<SourcesChecked>(null);
  const [minutes, setMinutes] = useState("");
  const [open, setOpen] = useState("");

  const tab = `Part ${part}: AI chatbot`;
  const title = <h1 className="font-display text-3xl">{first ? "Your first task: an AI chatbot" : "Your second task: an AI chatbot"}</h1>;

  // The prompt is sent: the chatbot part has started.
  const sent = () => { logConditionStarted("baseline", participant.ideaKey, part); setStep("waiting"); };
  // Answered before reading the reply: confidence before (H1) and what the participant brings.
  const waited = () => {
    logConfidencePre("baseline", confPre, runId);
    logParticipantProfile(runId, { marketFamiliarity: familiarity, aiTrust, aiUse });
    setStep("paste");
  };
  const saveAnswer = () => {
    if (!tool) { setErr("Pick the chatbot you used."); return; }
    if (answer.trim().length < MIN_ANSWER_CHARS) { setErr("Paste the chatbot's whole answer (it looks too short)."); return; }
    logChatbotAnswer(runId, { tool, model, webSearch, text: answer.trim() });
    flushNow().catch(() => {});
    setStep("post");
  };
  const submit = () => {
    logConfidencePost("baseline", runId, confPost);
    logConditionSurvey("baseline", { trust, usefulness, helpfulness, effort, openText: open, sourcesChecked });
    logConditionEnded("baseline", runId, 0);
    flushNow().catch(() => {});
    onDone();
  };

  if (step === "prompt") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Panel tab={tab} as="section">
          {title}
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-foreground/80">
            You'll ask an AI chatbot about the idea, then {first ? "screen the same idea with VistaDex, and at the end say which helped you more" : "say which of the two helped you more"}.
          </p>
          <Step n={1} title="Copy this prompt">
            <pre className="whitespace-pre-wrap break-words rounded-inner border-2 border-foreground/10 bg-background p-3 font-sans text-xs leading-relaxed">{prompt}</pre>
            <div className="flex flex-wrap items-center gap-3">
              <Button data-control="baseline_copy_prompt" onClick={copyPrompt}>Copy prompt</Button>
              <span role="status" className="text-xs text-foreground/75">
                {copied === "ok" ? "Copied." : copied === "failed" ? "Copying is blocked here: select the text above and copy it." : ""}
              </span>
            </div>
          </Step>
          <Step n={2} title="Send it to your chatbot">
            <p>Open the chatbot you normally use (ChatGPT, Claude, Gemini or another) in a new tab, start a new chat, paste the prompt and send it.</p>
            <p className="font-medium">Don't read the answer yet: come back here while it writes.</p>
          </Step>
          <Button className="mt-5" data-control="baseline_sent" onClick={sent}>I've sent it →</Button>
        </Panel>
      </div>
    );
  }

  if (step === "waiting") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Panel tab={tab} as="section">
          {title}
          <Step n={3} title="While it answers: four quick questions">
            <p>Answer these before you read the chatbot's reply.</p>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span id="baseline-conf-pre-label" className="text-sm font-medium">How confident are you that this idea is novel and viable?</span>
                <span className="font-mono text-sm text-foreground/70">{confPre}%</span>
              </div>
              <Slider value={[confPre]} min={0} max={100} step={5} onValueChange={v => setConfPre(v[0])} data-control="baseline_conf_pre" aria-labelledby="baseline-conf-pre-label" className="mt-1" />
            </div>
            <Likert label="How much do you know about this idea's market?" value={familiarity} onChange={setFamiliarity} low="1, nothing" high="7, I work in it" control="baseline_profile_familiarity" />
            <Likert label="In general, how much do you trust answers from AI chatbots?" value={aiTrust} onChange={setAiTrust} low="1, not at all" high="7, completely" control="baseline_profile_trust" />
            <Likert label="How often do you use AI chatbots?" value={aiUse} onChange={setAiUse} low="1, never" high="7, several times a day" control="baseline_profile_use" />
          </Step>
          <Button className="mt-5" data-control="baseline_start" onClick={waited}>Next: read the answer →</Button>
        </Panel>
      </div>
    );
  }

  if (step === "paste") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Panel tab={tab} as="section">
          {title}
          <Step n={4} title="Read the answer, then paste it here">
            <p>Read the chatbot's answer as you normally would. You may ask it follow-up questions. When you're done, copy its whole answer (and any follow-ups) and paste it below.</p>
            <p className="text-foreground/75">What you paste is stored with your study answers, to be compared with your VistaDex report. Leave out anything personal.</p>
            <fieldset>
              <legend className="text-sm font-medium">Which chatbot did you use?</legend>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
                {TOOLS.map(t => (
                  <Choice key={t} name="baseline_tool" checked={tool === t} onSelect={() => { setTool(t); setErr(""); }} control="baseline_tool_pick">{t}</Choice>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-sm font-medium">Model or plan, if you know it (optional)</span>
              <input className={FIELD} value={model} onChange={e => setModel(e.target.value)} maxLength={60} data-control="baseline_model_field" placeholder="e.g. free plan, GPT-4o, Claude Sonnet" />
            </label>
            <fieldset>
              <legend className="text-sm font-medium">Did it search the web for this answer (it showed sources or said it was searching)?</legend>
              <div className="mt-2 grid grid-cols-3 gap-1.5 sm:gap-2">
                {([["yes", "Yes", "baseline_web_yes"], ["no", "No", "baseline_web_no"], ["not_sure", "Not sure", "baseline_web_not_sure"]] as const).map(([v, label, control]) => (
                  <Choice key={v} name="baseline_web" checked={webSearch === v} onSelect={() => setWebSearch(v)} control={control} compact>{label}</Choice>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-sm font-medium">The chatbot's answer</span>
              <textarea
                className={`${FIELD} min-h-48 font-mono text-xs`}
                value={answer} onChange={e => { setAnswer(e.target.value); setErr(""); }} maxLength={MAX_ANSWER_CHARS}
                data-control="baseline_answer_field"
              />
            </label>
            <p className="-mt-2 text-right font-mono text-[11px] text-foreground/70">{answer.length.toLocaleString("en")} / {MAX_ANSWER_CHARS.toLocaleString("en")} characters</p>
          </Step>
          {err && <p role="alert" className="mt-3 text-sm font-medium text-foreground">{err}</p>}
          <Button className="mt-5" data-control="baseline_save_answer" onClick={saveAnswer}>Save the answer →</Button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Panel tab={`Part ${part}: rate the AI chatbot`} as="section">
        <h1 className="font-display text-3xl">Rate what you just read</h1>
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <span id="baseline-conf-post-label" className="text-sm font-medium">Now: how confident are you that this idea is novel and viable?</span>
            <span className="font-mono text-sm text-foreground/70">{confPost}%</span>
          </div>
          <Slider value={[confPost]} min={0} max={100} step={5} onValueChange={v => setConfPost(v[0])} data-control="baseline_conf_post" aria-labelledby="baseline-conf-post-label" className="mt-1" />
        </div>
        <div className="mt-6 space-y-5">
          <Likert label="I trust the AI's assessment of this idea" value={trust} onChange={setTrust} low="1, not at all" high="7, completely" control="baseline_likert" />
          <Likert label="The assessment was useful for judging this idea" value={usefulness} onChange={setUsefulness} low="1, useless" high="7, extremely useful" control="baseline_likert" />
          <Likert label="The assessment helped me see what to verify next" value={helpfulness} onChange={setHelpfulness} low="1, not at all" high="7, a lot" control="baseline_likert" />
          <Likert label="Getting a good read on the idea took effort" value={effort} onChange={setEffort} low="1, effortless" high="7, a lot of work" control="baseline_likert" />
        </div>
        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Did you open any of the AI's sources, or look anything up yourself?</legend>
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
          <input className={FIELD} value={minutes} onChange={e => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))} data-control="baseline_minutes_field" placeholder="e.g. 5" />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium">In your words: what did the AI's answer make you think or feel about this idea? (optional)</span>
          <textarea className={`${FIELD} min-h-24`} value={open} onChange={e => setOpen(e.target.value)} maxLength={2000} data-control="baseline_open_field" />
        </label>
        <Button className="mt-5" onClick={submit} data-control="baseline_submit">
          {first ? "Submit and continue to VistaDex →" : "Submit and compare the two →"}
        </Button>
      </Panel>
    </div>
  );
}
