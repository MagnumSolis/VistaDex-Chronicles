import { useMemo, useRef, useState } from "react";
import { Ghost, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilterPills, PageHeader, SearchField } from "@/components/ui-vd";
import { STATUS, STATUS_ORDER, StatusTag } from "@/components/status";
import { Report } from "@/components/report/Report";
import { sourceCount } from "@/components/report/ClaimCard";
import { cohort, cohortReport, type CohortIdea } from "@/lib/cohort";
import { cn } from "@/lib/utils";
import * as study from "@/study/controller";
import type { ClaimStatus } from "@/types";

type Filter = "all" | "contradicted" | "disputed" | "graveyard";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "contradicted", label: "Has contradicted" },
  { value: "disputed", label: "Has disputed" },
  { value: "graveyard", label: "Has graveyard lead" },
];

const count = (idea: CohortIdea, s: ClaimStatus) => idea.claims.filter(c => c.status === s).length;
// Most contradicted + disputed claims first; ties by name (same order as the original UI).
const weight = (idea: CohortIdea) => count(idea, "contradicted") + count(idea, "disputed");
const sorted = [...cohort].sort((a, b) => weight(b) - weight(a) || a.name.localeCompare(b.name));

export function Dashboard() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  const reports = useMemo(() => Object.fromEntries(cohort.map(i => [i.id, cohortReport(i)])), []);
  const rows = sorted.filter(idea => {
    const r = reports[idea.id];
    const matchFilter = filter === "all" || (filter === "graveyard" ? r.graveyard_matches.length > 0 : count(idea, filter) > 0);
    const needle = q.trim().toLowerCase();
    const matchSearch = !needle || [idea.name, idea.submitter, idea.category, idea.desc].some(s => s.toLowerCase().includes(needle));
    return matchFilter && matchSearch;
  });
  const withStatus = (s: ClaimStatus) => cohort.filter(i => count(i, s) > 0).length;
  const withLead = cohort.filter(i => reports[i.id].graveyard_matches.length > 0).length;
  const open = cohort.find(i => i.id === openId) ?? null;

  const openReport = (id: string, button: HTMLButtonElement) => {
    trigger.current = button;
    setOpenId(id);
    study.cohortReportOpened(id);
  };

  const stats: { label: string; value: number; icon: typeof Ghost; tint?: ClaimStatus }[] = [
    { label: "Demo ideas", value: cohort.length, icon: ListChecks },
    { label: "With a contradicted claim", value: withStatus("contradicted"), icon: STATUS.contradicted.icon, tint: "contradicted" },
    { label: "With a disputed claim", value: withStatus("disputed"), icon: STATUS.disputed.icon, tint: "disputed" },
    { label: "With a graveyard lead", value: withLead, icon: Ghost },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cohort dashboard"
        aside={<span className="rounded-full bg-card px-4 py-2 text-sm font-medium shadow-card">Demo data</span>}
      >
        {cohort.length} hand-written example ideas. Submitters are fictional and statuses have not been re-checked.
      </PageHeader>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={cn("flex flex-col justify-between gap-6 rounded-card p-5 shadow-card", s.tint ? STATUS[s.tint].bg : "bg-card")}>
              <dt className="flex items-start gap-2.5 text-[0.9375rem] font-semibold leading-snug">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-card shadow-card">
                  <Icon aria-hidden className={cn("size-5", s.tint ? STATUS[s.tint].text : "text-foreground")} />
                </span>
                {s.label}
              </dt>
              <dd className="font-display text-6xl font-bold leading-none tabular-nums">{s.value}</dd>
            </div>
          );
        })}
      </dl>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SearchField id="dashSearch" label="Search ideas" value={q} onChange={setQ} placeholder="Search by idea, submitter or category" />
        <FilterPills label="Filter ideas" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <section aria-label="Ideas" className="space-y-3">
        <p className="text-sm text-muted-foreground">Most contradicted and disputed claims first</p>
        {rows.length === 0 && <p className="rounded-card bg-card p-6 shadow-card">No ideas match. Clear the search or choose another filter.</p>}
        <ul className="space-y-3">
          {rows.map(idea => {
            const r = reports[idea.id];
            const lead = r.graveyard_matches[0];
            const sources = r.claims.reduce((n, c) => n + sourceCount(c.source_urls), 0);
            return (
              <li key={idea.id} className="grid gap-4 rounded-card bg-card p-5 shadow-card sm:p-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_auto] lg:items-center lg:gap-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-bold leading-tight">{idea.name}</h2>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{idea.category}</span>
                  </div>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed">{idea.desc}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Submitted by {idea.submitter} (fictional)</p>
                </div>
                <div className="flex flex-wrap gap-1.5" aria-label="Claim statuses">
                  {STATUS_ORDER.filter(s => count(idea, s) > 0).map(s => (
                    <span key={s} className="inline-flex items-center gap-1.5">
                      <StatusTag status={s} className="py-0.5" />
                      <span className="font-mono text-sm font-medium" aria-label={`${count(idea, s)} ${STATUS[s].label}`}>×{count(idea, s)}</span>
                    </span>
                  ))}
                </div>
                <div className="text-sm">
                  {lead ? (
                    <><span className="font-medium">{lead.company_name}</span> <span className="text-muted-foreground">lead to check</span></>
                  ) : (
                    <span className="text-muted-foreground">No graveyard lead</span>
                  )}
                  <div className="mt-0.5 text-muted-foreground"><span className="font-mono text-foreground">{r.claims.length}</span> claims, <span className="font-mono text-foreground">{sources}</span> sources</div>
                </div>
                <Button variant="outline" onClick={e => openReport(idea.id, e.currentTarget)} aria-label={`View report: ${idea.name}`} className="justify-self-start lg:justify-self-end">
                  View report
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <Dialog open={open !== null} onOpenChange={o => { if (!o) setOpenId(null); }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto bg-background p-4 sm:max-w-6xl sm:p-8" onCloseAutoFocus={e => { e.preventDefault(); trigger.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle className="pr-10 text-3xl">{open?.name}</DialogTitle>
            <DialogDescription>{open?.category}, submitted by {open?.submitter} (fictional)</DialogDescription>
          </DialogHeader>
          {open && <Report report={reports[open.id]} runId={null} rateable={false} demo />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
