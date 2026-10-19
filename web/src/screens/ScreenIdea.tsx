// ── Screen an idea — the input form ──
import { useId, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, LoaderCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageTitle, Panel, Problem } from "@/components/ui-vd";
import { cn } from "@/lib/utils";
import { liveMode, studyConfig } from "@/proto";
import { FIELD_LIMITS, INDUSTRIES, REQUIRED_FIELDS } from "@proto/core/input.js";
import { href, PATHS } from "@/router";
import { SAMPLES } from "@/lib/samples";
import { latestSessionReport, useSessionReports } from "@/lib/reports";
import { clearRunError, errorCopy, reportPath, startRun, useRun } from "@/lib/run";
import { JURISDICTIONS, type IdeaInput, type Jurisdiction, type Role } from "@/types";

type TextField = "title" | "pitch" | "problem" | "solution" | "moat";
const FIELDS: { id: TextField; label: string; hint: string; rows: number }[] = [
  { id: "title", label: "Idea title", hint: "A short name for the idea.", rows: 1 },
  { id: "pitch", label: "One-line pitch", hint: "What it is and who it is for, in one sentence.", rows: 2 },
  { id: "problem", label: "Problem", hint: "What is broken today, for whom, and how you know.", rows: 4 },
  { id: "solution", label: "Solution", hint: "What you build and how it solves the problem.", rows: 4 },
  { id: "moat", label: "What makes yours different / moat", hint: "Optional. Why others can't easily copy it.", rows: 3 },
];
const ROLES: { value: Role; label: string }[] = [
  { value: "founder", label: "Founder" }, { value: "investor", label: "Investor" }, { value: "accelerator", label: "Accelerator / incubator" },
];
const MARKET_LABEL: Record<Jurisdiction, string> = { EU: "European Union", USA: "United States", India: "India" };
const REQUIRED = new Set<string>(REQUIRED_FIELDS);
const empty = (): IdeaInput => ({ title: "", pitch: "", problem: "", solution: "", moat: "", industries: [], role: null, markets: [] });
const same = (a: IdeaInput | undefined, b: IdeaInput) => JSON.stringify(a) === JSON.stringify(b);

// The draft survives moving between screens (module memory only; never stored or logged).
const draft: { input: IdeaInput; sample: string | null } = { input: empty(), sample: null };
export function clearDraft() { draft.input = empty(); draft.sample = null; }

/** `preview`: show this input read-only-style (the Home page's product screens); the draft is untouched. */
export function ScreenIdea({ preview }: { preview?: IdeaInput } = {}) {
  const run = useRun();
  useSessionReports();
  const last = preview ? null : latestSessionReport();
  const [input, setInputState] = useState<IdeaInput>(preview ?? draft.input);
  const [errors, setErrors] = useState<TextField[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);
  const running = run.status === "running";

  const update = (patch: Partial<IdeaInput>, sample: string | null = draft.sample) => {
    draft.input = { ...draft.input, ...patch };
    draft.sample = sample;
    setInputState(draft.input);
    setErrors(es => es.filter(f => !draft.input[f].trim()));
    clearRunError();
  };
  const toggle = <T extends string>(list: T[], v: T, order: readonly T[]) => (list.includes(v) ? list.filter(x => x !== v) : order.filter(x => x === v || list.includes(x)));

  function submit() {
    // Reads the draft (not this render's state), so a Run straight after loading a sample sees it.
    const current = draft.input;
    const missing = FIELDS.map(f => f.id).filter(f => REQUIRED.has(f) && !current[f].trim());
    if (missing.length) {
      setErrors(missing);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    const sample = draft.sample && same(SAMPLES.find(s => s.id === draft.sample)?.input, current) ? draft.sample : null;
    void startRun({ input: current, sample });
  }

  const copy = run.error && !preview ? errorCopy(run.error.code) : null;
  return (
    <div>
      <PageTitle eyebrow="Screen an idea" title="What are you building?">
        Describe the idea the way you would pitch it. VistaDex checks its claims, looks for competitors and startups that tried it before, and argues against it, then shows a score you can take apart.
      </PageTitle>

      <div className="space-y-4">
        {running && !preview && (
          <p className="on-light flex flex-wrap items-center gap-3 rounded-card bg-background p-4 text-foreground">
            <LoaderCircle aria-hidden className="size-5 motion-safe:animate-spin" /> A screening is running.
            <a href={href(PATHS.running)} data-control="open_last_report" data-control-value="running" className="font-medium text-link underline underline-offset-4">See its progress</a>
          </p>
        )}
        {copy && (
          <div className="on-light">
            <Problem title={copy.title}>
              <p>{copy.body}</p>
              {run.error?.code === "pipeline" || run.error?.code === "contract" || run.error?.code === "http"
                ? <p className="mt-2 font-mono text-xs text-muted-foreground">{run.error.message}</p> : null}
            </Problem>
          </div>
        )}
        {!running && last && (
          <a href={href(reportPath(last.id))} data-control="open_last_report" data-control-value="report"
            className="on-page inline-flex items-center gap-2 text-[0.9375rem] font-medium text-lime underline underline-offset-4">
            Back to your last report <ArrowRight aria-hidden className="size-4" />
          </a>
        )}

        <Panel tab="Start from a sample" as="section" aria-labelledby="samples-tab" tabId="samples-tab">
          <div data-tour="samples">
            <p className="text-sm text-muted-foreground">No idea handy? Load sample idea, then change anything you like.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SAMPLES.map(s => (
                <Button key={s.id} variant="outline" onClick={() => update({ ...s.input }, s.id)} disabled={running}
                  data-control="sample_load" data-control-value={s.id} aria-pressed={draft.sample === s.id && same(s.input, input)}
                  className="aria-pressed:border-primary aria-pressed:bg-accent">
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel tab="Your idea" as="section" aria-labelledby="idea-tab" tabId="idea-tab">
          <p className="text-sm text-muted-foreground">
            {studyConfig.INPUT_WARNING.base}. {liveMode() ? "The text is sent to our server to make the report." : "In this version it never leaves your browser."} It is not stored in usage records. Fields marked * are required.
          </p>
          {errors.length > 0 && (
            <div ref={summaryRef} tabIndex={-1} role="alert" className="mt-4 rounded-inner border-2 border-foreground bg-card p-4 outline-none">
              <p className="font-semibold">Fill in {errors.length === 1 ? "this field" : "these fields"} to run the screening:</p>
              <ul className="mt-1 list-disc pl-5 text-[0.9375rem]">
                {errors.map(f => (
                  <li key={f}>
                    <a href={`#field-${f}`} onClick={e => { e.preventDefault(); document.getElementById(`field-${f}`)?.focus(); }}
                      data-control="form_error_link" data-control-value={f} className="text-link underline underline-offset-4">
                      {FIELDS.find(x => x.id === f)!.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div data-tour="basics" className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            {FIELDS.slice(0, 2).map(f => <Field key={f.id} f={f} value={input[f.id]} error={errors.includes(f.id)} disabled={running} onChange={v => update({ [f.id]: v })} />)}
          </div>
          <div data-tour="details" className="mt-5 space-y-5">
            {FIELDS.slice(2).map(f => <Field key={f.id} f={f} value={input[f.id]} error={errors.includes(f.id)} disabled={running} onChange={v => update({ [f.id]: v })} />)}
          </div>
        </Panel>

        <Panel tab="Context" as="section" aria-labelledby="context-tab" tabId="context-tab">
          <div data-tour="context" className="space-y-6">
            <ChipGroup legend="Industry" hint="Optional. Pick every one that fits.">
              {INDUSTRIES.map(i => (
                <Chip key={i} on={input.industries.includes(i)} disabled={running} control="industry_toggle" value={i}
                  onClick={() => update({ industries: toggle(input.industries, i, INDUSTRIES) })}>{i}</Chip>
              ))}
            </ChipGroup>
            <fieldset>
              <legend className="text-[0.9375rem] font-semibold">I am a…</legend>
              <p className="mt-1 text-sm text-muted-foreground">Optional. Used to compare reports, not to change them.</p>
              <div role="radiogroup" aria-label="I am a…" className="mt-2 flex flex-wrap gap-2">
                {ROLES.map(r => (
                  <Chip key={r.value} radio on={input.role === r.value} disabled={running} control="role_select" value={r.value}
                    onClick={() => update({ role: input.role === r.value ? null : r.value })}>{r.label}</Chip>
                ))}
              </div>
            </fieldset>
            <ChipGroup legend="Target markets" hint="Optional. The report's Legal section covers the markets you pick.">
              {JURISDICTIONS.map(m => (
                <Chip key={m} on={input.markets.includes(m)} disabled={running} control="market_toggle" value={m}
                  onClick={() => update({ markets: toggle(input.markets, m, JURISDICTIONS) })}>
                  {m}<span className="sr-only"> ({MARKET_LABEL[m]})</span>
                </Chip>
              ))}
            </ChipGroup>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4 border-t pt-6">
            <Button size="lg" onClick={submit} disabled={running} data-control="run_screening" data-tour="run" className="h-12 px-7 text-base">
              {running ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : <Play aria-hidden className="fill-current" />}
              {running ? "Running…" : "Run"}
            </Button>
            <p className="text-sm text-muted-foreground">Takes a few seconds{liveMode() ? " to a minute" : ""}. You can cancel while it runs.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Field({ f, value, error, disabled, onChange }: { f: (typeof FIELDS)[number]; value: string; error: boolean; disabled: boolean; onChange: (v: string) => void }) {
  const hintId = useId();
  const countId = useId();
  const errId = useId();
  const limit = FIELD_LIMITS[f.id];
  const required = REQUIRED.has(f.id);
  const common = {
    id: `field-${f.id}`, value, disabled, maxLength: limit, "data-control": `idea_${f.id}`,
    "aria-required": required || undefined, "aria-invalid": error || undefined,
    "aria-describedby": `${hintId} ${countId}${error ? ` ${errId}` : ""}`,
  };
  return (
    <div className="min-w-0">
      <label htmlFor={`field-${f.id}`} className="text-[0.9375rem] font-semibold">{f.label}{required && <span aria-hidden> *</span>}</label>
      <p id={hintId} className="mt-0.5 text-sm text-muted-foreground">{f.hint}</p>
      {f.rows === 1 ? (
        <input type="text" {...common} onChange={e => onChange(e.target.value)}
          className={cn("mt-2 h-11 w-full rounded-control border bg-card px-3 text-base", error ? "border-2 border-foreground" : "border-input")} />
      ) : (
        <Textarea {...common} onChange={e => onChange(e.target.value)} rows={f.rows}
          className={cn("mt-2 bg-card text-base leading-relaxed md:text-base", f.rows >= 4 ? "min-h-28" : "min-h-16", error && "border-2 border-foreground")} />
      )}
      <div className="mt-1 flex flex-wrap justify-between gap-2 text-sm">
        <span id={errId} className="font-medium">{error ? `${f.label} is required.` : ""}</span>
        <span id={countId} className="font-mono text-xs text-muted-foreground">{value.length.toLocaleString("en")} / {limit.toLocaleString("en")}</span>
      </div>
    </div>
  );
}

function ChipGroup({ legend, hint, children }: { legend: string; hint: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[0.9375rem] font-semibold">{legend}</legend>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({ on, disabled, control, value, onClick, radio = false, children }: {
  on: boolean; disabled: boolean; control: string; value: string; onClick: () => void; radio?: boolean; children: ReactNode;
}) {
  return (
    <button type="button" {...(radio ? { role: "radio", "aria-checked": on } : { "aria-pressed": on })} onClick={onClick} disabled={disabled}
      data-control={control} data-control-value={value}
      className={cn("inline-flex h-10 items-center gap-2 rounded-control border px-3.5 text-sm font-medium transition-colors duration-150 disabled:opacity-50",
        on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:bg-accent")}>
      {on ? <Check aria-hidden className="size-4" /> : <span aria-hidden className={cn("size-4 border border-input", radio ? "rounded-full" : "rounded-sm")} />}
      {children}
    </button>
  );
}
