// ── Reports — every report this browser has run (public) / session runs + demo cohort (pitch) ──
import { useMemo, useState, type ReactNode } from "react";
import { Building2, FileSearch, FlaskConical, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageTitle } from "@/components/ui-vd";
import { STATUS, STATUS_ORDER } from "@/components/status";
import { Bars } from "@/components/charts/Bars";
import { Pie } from "@/components/charts/Pie";
import { OverlapBadge } from "@/components/report/ScoreParts";
import { cn } from "@/lib/utils";
import { features } from "@/edition";
import { INDUSTRIES } from "@proto/core/input.js";
import {
  checkedLabel, clearStoredReports, listedEntries, SAMPLE_COUNTS, setSampleCount, useSampleCount, useSessionReports, type ReportEntry, type SampleCount,
} from "@/lib/reports";
import { SAMPLE_CHECKED } from "@proto/data/sample-reports.js";
import { reportPath } from "@/lib/run";
import {
  filterEntries, industriesOf, MIN_REPORTS_FOR_READING, NO_FILTERS, sortEntries, SORTS, summarize, topSlices, TYPE_LABEL, TYPE_ORDER,
  type Filters, type SortKey,
} from "@/lib/reportsView";
import { navigate, PATHS } from "@/router";
import type { BigTechLevel } from "@/types";

const BIG_TECH_LABEL: Record<BigTechLevel, string> = { low: "Low", medium: "Medium", high: "High", none_found: "None found", unverified: "Unverified" };
const ROLE_LABEL = { founder: "Founder", investor: "Investor", accelerator: "Accelerator / incubator" } as const;

/** `preview`: render with these entries instead (the Home page's product screens). */
export function Reports({ preview }: { preview?: ReportEntry[] } = {}) {
  const session = useSessionReports();
  const sampleCount = useSampleCount();
  const entries = useMemo(() => preview ?? listedEntries(), [session, sampleCount, preview]);
  const [sort, setSort] = useState<SortKey>("newest");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [confirmClear, setConfirmClear] = useState(false);
  const summary = useMemo(() => summarize(entries), [entries]);
  const rows = sortEntries(filterEntries(entries, filters), sort);
  const industryOptions = useMemo(() => [...new Set(entries.flatMap(industriesOf))].sort((a, b) => INDUSTRIES.indexOf(a) - INDUSTRIES.indexOf(b)), [entries]);
  const browser = !preview && features.reportStore === "browser";

  const title = browser ? "Your reports" : "Screened ideas";
  const lead = browser
    ? "Every report this browser has run. They are saved here only, never uploaded; clear them whenever you like."
    : preview ? "Sample data: demo ideas run through the same scoring." : `${session.length} from this session and ${entries.filter(e => e.kind === "demo").length} demo ideas (hand-written examples run through the same scoring, with sample data where demo data has none). Session reports are kept until this tab is closed.`;
  const samplesControl = preview ? null : <SampleToggle value={sampleCount} />;

  if (!entries.length) {
    return (
      <div>
        <PageTitle eyebrow="Reports" title={title}>{lead}</PageTitle>
        {samplesControl}
        <div className="on-light mt-5 max-w-xl text-foreground">
          <EmptyState icon={FileSearch} title="No reports yet"
            action={<Button size="lg" onClick={() => navigate(PATHS.screen)} data-control="reports_empty_screen">Screen an idea</Button>}>
            Screen an idea and its report will be listed here, in this browser only.
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle eyebrow="Reports" title={title}
        aside={browser ? <Button variant="outline-page" onClick={() => setConfirmClear(true)} data-control="reports_clear"><Trash2 aria-hidden /> Clear my reports</Button> : undefined}>
        {lead}
      </PageTitle>
      {samplesControl}

      <section aria-label="Summary" className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-4", samplesControl && "mt-5")}>
        <Block title="Ideas analysed">
          <p className="font-display text-[3.5rem] leading-none">{summary.count}</p>
        </Block>
        <Block title="Overlap bands">
          <ul className="space-y-2">
            {(["clear", "caution", "high"] as const).map(b => (
              <li key={b} className="flex items-center justify-between gap-2"><OverlapBadge band={b} /><span className="font-mono">{summary.bands[b]}</span></li>
            ))}
            {summary.noBand > 0 && <li className="flex justify-between text-sm text-muted-foreground"><span>No band (older report)</span><span className="font-mono">{summary.noBand}</span></li>}
          </ul>
        </Block>
        <Block title="Contradicted claims by type">
          <Bars rows={TYPE_ORDER.map(t => ({ label: TYPE_LABEL[t], value: summary.byType[t] }))} caption="Number of contradicted claims of each type, across these reports." />
          <p className="mt-3 text-sm leading-relaxed">
            {summary.reading ?? `Counts only: a pattern needs at least ${MIN_REPORTS_FOR_READING} reports.`}
          </p>
        </Block>
        <Block title="Industry mix">
          <Pie slices={topSlices(summary.industries)} caption="An idea counts once per industry selected, so the total can exceed the number of ideas." />
        </Block>
      </section>

      <div className="on-light mt-5 grid gap-3 rounded-panel bg-background p-4 text-foreground sm:grid-cols-2 md:p-6 xl:grid-cols-5">
        <Select id="reports-sort" label="Sort by" control="reports_sort" value={sort} onChange={v => setSort(v as SortKey)} options={SORTS} />
        <Select id="reports-status" label="Claim status" control="reports_filter_status" value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v as Filters["status"] }))}
          options={[{ value: "all", label: "Any" }, ...STATUS_ORDER.map(s => ({ value: s, label: `Has ${STATUS[s].label.toLowerCase()}` }))]} />
        <Select id="reports-band" label="Overlap band" control="reports_filter_band" value={filters.band} onChange={v => setFilters(f => ({ ...f, band: v as Filters["band"] }))}
          options={[{ value: "all", label: "Any" }, { value: "clear", label: "Clear" }, { value: "caution", label: "Caution" }, { value: "high", label: "High" }]} />
        <Select id="reports-industry" label="Industry" control="reports_filter_industry" value={filters.industry} onChange={v => setFilters(f => ({ ...f, industry: v }))}
          options={[{ value: "all", label: "Any" }, ...industryOptions.map(i => ({ value: i, label: i }))]} />
        <Select id="reports-role" label="Role" control="reports_filter_role" value={filters.role} onChange={v => setFilters(f => ({ ...f, role: v as Filters["role"] }))}
          options={[{ value: "all", label: "Any" }, ...Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))]} />
      </div>

      <section aria-label="Reports" className="mt-5">
        <p className="mb-3 text-sm text-on-page-muted" aria-live="polite">{rows.length} of {entries.length} shown</p>
        {rows.length === 0 ? (
          <div className="on-light text-foreground">
            <EmptyState icon={Search} title="No reports match"
              action={<Button variant="outline" onClick={() => setFilters(NO_FILTERS)} data-control="reports_clear_filters">Clear filters</Button>} />
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map(e => <ReportCard key={e.id} e={e} />)}
          </ul>
        )}
      </section>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="on-light bg-background text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">Clear your reports?</DialogTitle>
            <DialogDescription className="text-[0.9375rem] text-foreground">This deletes every report saved in this browser. It can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button size="lg" variant="outline" onClick={() => setConfirmClear(false)} data-control="reports_clear_cancel">Cancel</Button>
            <Button size="lg" onClick={() => { clearStoredReports(); setConfirmClear(false); }} data-control="reports_clear_confirm">Clear my reports</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Adds the fixed sample reports to the summary and the list. Memory only: Off on every page load, never saved.
function SampleToggle({ value }: { value: SampleCount }) {
  return (
    <div className="on-light flex flex-col gap-3 rounded-card bg-background p-4 text-foreground sm:flex-row sm:items-end md:p-5">
      <div className="w-full sm:w-44 sm:shrink-0">
        <Select id="reports-samples" label="Sample reports" control="reports_samples" value={String(value)} onChange={v => setSampleCount(Number(v) as SampleCount)}
          options={SAMPLE_COUNTS.map(n => ({ value: String(n), label: n ? `Show ${n}` : "Off" }))} />
      </div>
      <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
        Fixed sample ideas, each labelled &ldquo;Sample report&rdquo;. Their sources were checked by hand on {checkedLabel(SAMPLE_CHECKED)}; statuses, scores and overlap bands come from the same code as every report. Never saved.
      </p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="on-light rounded-card bg-background p-4 text-foreground md:p-5">
      <p className="eyebrow mb-3 text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Select({ id, label, control, value, onChange, options }: {
  id: string; label: string; control: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} data-control={control}
        className="mt-1 h-11 w-full rounded-control border border-input bg-card px-3 text-[0.9375rem] text-foreground">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ReportCard({ e }: { e: ReportEntry }) {
  const r = e.report;
  const score = r.scores?.vistadex.value ?? null;
  const count = (s: string) => r.claims.filter(c => c.status === s).length;
  return (
    <li className="on-light flex flex-col rounded-card bg-background p-5 text-foreground">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {e.kind === "sample" && <span className="inline-flex items-center gap-1 rounded-control bg-foreground px-2 py-0.5 font-semibold text-background"><FlaskConical aria-hidden className="size-3.5" /> Sample report</span>}
        <span className="text-muted-foreground">{e.checkedOn ? `Sources checked ${checkedLabel(e.checkedOn)}` : e.createdAt ? e.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Demo data, no date"}</span>
        {industriesOf(e).map(i => <span key={i} className="rounded-control bg-muted px-2 py-0.5 font-medium">{i}</span>)}
      </div>
      <h2 className="mt-3 font-display text-[1.5rem] leading-tight">{e.title}</h2>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <p>
          <span className="eyebrow block text-muted-foreground">VistaDex Score</span>
          {score === null ? <span className="text-[0.9375rem] font-medium">Not enough data</span> : <span className="font-display text-[2rem] leading-none">{score}<span className="text-base text-muted-foreground"> / 100</span></span>}
        </p>
        {r.overlap_band && <OverlapBadge band={r.overlap_band} />}
      </div>
      <ul aria-label="Claims by status" className="mt-4 grid grid-cols-2 gap-1.5">
        {STATUS_ORDER.map(s => {
          const Icon = STATUS[s].icon;
          return (
            <li key={s} className={cn("flex items-center gap-1.5 rounded-control px-2 py-1 text-[0.8125rem] font-semibold", STATUS[s].bg)}>
              <Icon aria-hidden className={cn("size-4", STATUS[s].text)} /> <span className="font-mono">{count(s)}</span> {STATUS[s].label}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-sm"><Building2 aria-hidden className="size-4" /> Big Tech risk: <span className="font-medium">{r.big_tech_risk ? BIG_TECH_LABEL[r.big_tech_risk.level] : "Not available"}</span></p>
      <Button variant="outline" className="mt-5 self-start" onClick={() => navigate(reportPath(e.id))} data-control="reports_open" aria-label={`Open report: ${e.title}`}>
        Open report
      </Button>
    </li>
  );
}
