import { useRef } from "react";
import { cn } from "@/lib/utils";
import { STATUS, STATUS_ORDER } from "@/components/status";
import { Section } from "@/components/Section";
import { ClaimCard, sourceCount } from "./ClaimCard";
import { Objections } from "./Objections";
import { GraveyardLeads } from "./GraveyardLeads";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { usePanelViewed } from "@/study/useStudy";
import * as study from "@/study/controller";
import type { Report as ReportT, RunMode } from "@/types";

const MODE_LABEL: Record<RunMode, string> = {
  live: "Live run",
  mock: "Mock run, no live evidence",
  "proxy-mock": "Mock run, no live evidence",
};

export function Report({ report, mode, runId, rateable, demo = false }: {
  report: ReportT; mode?: RunMode; runId: string | null; rateable: boolean; demo?: boolean;
}) {
  const objectionsRef = useRef<HTMLDivElement>(null);
  const leadsRef = useRef<HTMLDivElement>(null);
  usePanelViewed(objectionsRef, "objections_viewed", runId);
  usePanelViewed(leadsRef, "graveyard_viewed", runId);

  const counts = Object.fromEntries(STATUS_ORDER.map(s => [s, report.claims.filter(c => c.status === s).length]));
  const sources = report.claims.reduce((n, c) => n + sourceCount(c.source_urls), 0);

  return (
    <div className="space-y-10">
      <header className="rounded-panel bg-card p-6 shadow-panel sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[2.25rem] font-bold leading-none tracking-tight sm:text-[2.75rem]">Screening report</h2>
          <span className="rounded-full bg-muted px-3.5 py-1.5 text-[0.8125rem] font-medium text-muted-foreground">
            {demo ? "Demo data, not re-checked" : mode ? MODE_LABEL[mode] : ""}
          </span>
        </div>
        <p className="mt-4 line-clamp-3 max-w-[70ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{report.idea_text}</p>

        {/* Counts, not a score: one tile per status with equal presence — own tint, coloured icon, ink word and number. */}
        <dl className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATUS_ORDER.map(st => {
            const meta = STATUS[st];
            const Icon = meta.icon;
            return (
              <div key={st} className={cn("flex flex-col justify-between gap-6 rounded-card p-5", meta.bg)}>
                <dt className="flex items-center gap-2.5 text-[0.9375rem] font-semibold text-foreground">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-card">
                    <Icon aria-hidden className={cn("size-5", meta.text)} strokeWidth={2} />
                  </span>
                  {meta.label}
                </dt>
                <dd className="font-display text-6xl font-bold leading-none tabular-nums text-foreground">{counts[st]}</dd>
              </div>
            );
          })}
        </dl>

        <p className="mt-5 text-sm text-muted-foreground">
          <span className="font-mono text-foreground">{sources}</span> independent source{sources === 1 ? "" : "s"} across {report.claims.length} claim{report.claims.length === 1 ? "" : "s"}.
          A status needs at least two. There is no overall score: you decide.
        </p>

        {/* On phones the sections stack, so the other two are one tap away. */}
        <nav aria-label="Report sections" className="mt-5 flex flex-wrap gap-2 lg:hidden">
          {([["claims", "Claims", report.claims.length], ["objections", "Objections", report.objections.length], ["leads", "Leads", report.graveyard_matches.length]] as const).map(([id, label, n]) => (
            <a key={id} href={`#${id}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-input px-4 text-sm font-medium hover:bg-muted">
              {label} <span className="font-mono text-muted-foreground">{n}</span>
            </a>
          ))}
        </nav>
      </header>

      {/* Claims and objections side by side at equal weight; leads under the objections. */}
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
        <Section id="claims" title="Claims" count={report.claims.length}>
          {report.claims.length === 0 ? (
            <p className="rounded-card bg-card p-6 text-[0.9375rem] shadow-card">No checkable claims were found in the idea text.</p>
          ) : (
            <div className="space-y-4">
              {report.claims.map((c, i) => <ClaimCard key={`${runId}-${i}`} claim={c} index={i} rateable={rateable} />)}
            </div>
          )}
        </Section>
        <div className="space-y-10">
          <Objections ref={objectionsRef} objections={report.objections} />
          <GraveyardLeads ref={leadsRef} matches={report.graveyard_matches} />
        </div>
      </div>

      <div className="rounded-card bg-card p-5 shadow-card sm:p-6">
        <Label htmlFor={`notes-${runId ?? "demo"}`} className="font-display text-xl font-bold">Your notes</Label>
        <Textarea
          id={`notes-${runId ?? "demo"}`}
          className="mt-3 min-h-28"
          placeholder="Anything you want to remember about this idea"
          onBlur={e => study.notesEdited(e.currentTarget.value.length)}
        />
      </div>
    </div>
  );
}
