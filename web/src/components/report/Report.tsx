import { useRef } from "react";
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

const MODE_LINE: Record<RunMode, string> = {
  live: "Live run — evidence retrieved from the web",
  mock: "Key-free mock run — no live evidence, so claims stay unverified",
  "proxy-mock": "Key-free mock run — no live evidence, so claims stay unverified",
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
    <div className="space-y-6">
      <header className="rounded-lg border bg-card p-4 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {demo ? "Demo data — hand-written, not re-checked" : mode ? MODE_LINE[mode] : ""}
        </p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight">Screening report</h2>
        <blockquote className="mt-2 line-clamp-3 border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground">{report.idea_text}</blockquote>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-4 text-sm sm:flex sm:flex-wrap">
          {STATUS_ORDER.map(st => {
            const Icon = STATUS[st].icon;
            return (
              <div key={st} className="flex items-center gap-1.5">
                <Icon aria-hidden className={`size-4 ${STATUS[st].text}`} />
                <dt className="sr-only">{STATUS[st].label}</dt>
                <dd><span className="font-mono font-medium">{counts[st]}</span> {STATUS[st].label.toLowerCase()}</dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {report.claims.length} claim{report.claims.length === 1 ? "" : "s"} checked · {sources} independent source{sources === 1 ? "" : "s"} cited.
          A status needs at least 2 independent sources; it never comes from the model&apos;s own confidence. There is no overall score — you make the decision.
        </p>

        {/* Jump links: on phones the three sections stack, so make the others one tap away. */}
        <nav aria-label="Report sections" className="mt-4 flex flex-wrap gap-2 lg:hidden">
          {[["claims", "Claims", report.claims.length], ["objections", "Objections", report.objections.length], ["leads", "Graveyard leads", report.graveyard_matches.length]].map(([id, label, n]) => (
            <a key={id as string} href={`#${id}`} className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted">
              {label} <span className="font-mono text-muted-foreground">{n}</span>
            </a>
          ))}
        </nav>
      </header>

      {/* Claims and objections side by side at equal weight; leads under the objections. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Section id="claims" title="Claims" count={report.claims.length} aside="Each with its sources and independent-source count">
          {report.claims.length === 0 ? (
            <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">No checkable claims were found in the idea text.</p>
          ) : (
            <div className="space-y-3">
              {report.claims.map((c, i) => <ClaimCard key={`${runId}-${i}`} claim={c} index={i} rateable={rateable} />)}
            </div>
          )}
        </Section>
        <div className="space-y-6">
          <Objections ref={objectionsRef} objections={report.objections} />
          <GraveyardLeads ref={leadsRef} matches={report.graveyard_matches} />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 sm:p-5">
        <Label htmlFor={`notes-${runId ?? "demo"}`} className="text-sm font-semibold">Reviewer notes</Label>
        <p className="mt-1 text-xs text-muted-foreground">Your own notes. Only their length is recorded in the study.</p>
        <Textarea
          id={`notes-${runId ?? "demo"}`}
          className="mt-2 min-h-24"
          placeholder="Add your own notes…"
          onBlur={e => study.notesEdited(e.currentTarget.value.length)}
        />
      </div>
    </div>
  );
}
