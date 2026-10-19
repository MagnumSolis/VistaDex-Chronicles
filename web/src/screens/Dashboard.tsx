// ── Dashboard (pitch edition home) — every screened idea: this session's runs + the demo cohort ──
// The Worker does not persist reports, so nothing from earlier sessions appears here.
// TODO(team): persistent report storage.
import { useMemo, useState } from "react";
import { Ghost, ListChecks, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, FilterChips, PageTitle, SearchField } from "@/components/ui-vd";
import { STATUS, STATUS_ORDER } from "@/components/status";
import { cn } from "@/lib/utils";
import { allEntries, useSessionReports, type ReportEntry } from "@/lib/reports";
import { reportPath } from "@/lib/run";
import { navigate } from "@/router";
import type { ClaimStatus } from "@/types";

type StatusFilter = "all" | ClaimStatus;
const count = (e: ReportEntry, s: ClaimStatus) => e.report.claims.filter(c => c.status === s).length;
const SESSION = "This session";

export function Dashboard() {
  const session = useSessionReports();
  const entries = useMemo(() => allEntries(), [session]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState("all");
  const categories = useMemo(() => [...new Set(entries.map(e => e.category ?? SESSION))], [entries]);

  const needle = q.trim().toLowerCase();
  const rows = entries.filter(e =>
    (status === "all" || count(e, status) > 0) &&
    (category === "all" || (e.category ?? SESSION) === category) &&
    (!needle || [e.title, e.report.idea_text, e.category ?? ""].some(s => s.toLowerCase().includes(needle))));

  const withLeads = entries.filter(e => e.report.graveyard_matches.length > 0).length;
  const tiles: { label: string; value: number; icon: typeof Ghost; tint?: ClaimStatus }[] = [
    { label: "Ideas screened", value: entries.length, icon: ListChecks },
    { label: "With graveyard leads", value: withLeads, icon: Ghost },
    ...STATUS_ORDER.map(s => ({ label: `With ${s === "unverified" ? "an" : "a"} ${STATUS[s].label.toLowerCase()} claim`, value: entries.filter(e => count(e, s) > 0).length, icon: STATUS[s].icon, tint: s })),
  ];
  const clear = () => { setQ(""); setStatus("all"); setCategory("all"); };

  return (
    <div>
      <PageTitle eyebrow="Dashboard" title="Screened ideas">
        {session.length} from this session and {entries.length - session.length} demo ideas (hand-written examples; their statuses have not been re-checked).
        Reports run here are kept only until this tab is closed.
      </PageTitle>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map(t => {
          const Icon = t.icon;
          return (
            <div key={t.label} className={cn("on-light flex min-h-32 flex-col justify-between gap-4 rounded-card p-4 text-foreground", t.tint ? STATUS[t.tint].bg : "bg-background")}>
              <dd className="font-display text-[2.75rem] leading-none">{t.value}</dd>
              <dt className="flex items-center gap-2 text-sm font-semibold leading-snug">
                <Icon aria-hidden className={cn("size-5 shrink-0", t.tint && STATUS[t.tint].text)} strokeWidth={1.75} /> {t.label}
              </dt>
            </div>
          );
        })}
      </dl>

      <div className="on-light mt-5 space-y-4 rounded-panel bg-background p-4 text-foreground md:p-6">
        <SearchField id="dashSearch" label="Search ideas" value={q} onChange={setQ} placeholder="Search by idea or category" control="dashboard_search" />
        <div className="space-y-2">
          <p className="text-sm font-semibold">Claim status</p>
          <FilterChips label="Filter by claim status" control="dashboard_filter_status" value={status} onChange={setStatus}
            options={[{ value: "all", label: "Any" }, ...STATUS_ORDER.map(s => ({ value: s, label: `Has ${STATUS[s].label.toLowerCase()}` }))]} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Category</p>
          <FilterChips label="Filter by category" control="dashboard_filter_category" value={category} onChange={setCategory}
            options={[{ value: "all", label: "All" }, ...categories.map(c => ({ value: c, label: c }))]} />
        </div>
      </div>

      <section aria-label="Ideas" className="mt-5">
        {rows.length === 0 ? (
          <div className="on-light text-foreground">
            <EmptyState icon={Search} title="No ideas match" action={<Button variant="outline" onClick={clear} data-control="dashboard_clear">Clear search and filters</Button>} />
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map(e => (
              <li key={e.id} className="on-light flex flex-col rounded-card bg-background p-5 text-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-control bg-muted px-2 py-0.5 text-xs font-medium">{e.category ?? SESSION}</span>
                  <span className="text-xs text-muted-foreground">{e.createdAt ? e.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Demo data, no date"}</span>
                </div>
                <h2 className="mt-3 font-display text-[1.5rem] leading-tight">{e.title}</h2>
                <p className="mt-1.5 line-clamp-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{e.report.idea_text}</p>
                <ul aria-label="Claims by status" className="mt-4 grid grid-cols-2 gap-1.5">
                  {STATUS_ORDER.map(s => {
                    const Icon = STATUS[s].icon;
                    return (
                      <li key={s} className={cn("flex items-center gap-1.5 rounded-control px-2 py-1 text-[0.8125rem] font-semibold", STATUS[s].bg)}>
                        <Icon aria-hidden className={cn("size-4", STATUS[s].text)} /> <span className="font-mono">{count(e, s)}</span> {STATUS[s].label}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 flex items-center gap-1.5 text-sm"><Ghost aria-hidden className="size-4" /> <span className="font-mono">{e.report.graveyard_matches.length}</span> graveyard lead{e.report.graveyard_matches.length === 1 ? "" : "s"}</p>
                <Button variant="outline" className="mt-5 self-start" onClick={() => navigate(reportPath(e.id))} data-control="dashboard_open_report" aria-label={`Open report: ${e.title}`}>
                  Open report
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
