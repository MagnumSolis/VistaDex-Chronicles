import { useState } from "react";
import { FilterPills, PageHeader, SearchField } from "@/components/ui-vd";
import { GRAVEYARD_DB } from "@/proto";

interface Entry {
  id: string; company_name: string; what_they_tried: string; cause_of_death: string;
  cause_category: string; year_closed: number; raised?: string;
}
const ENTRIES = GRAVEYARD_DB as Entry[];

type Cause = "all" | "unit-economics" | "timing" | "competition" | "regulation" | "pivot";
const CAUSES: { value: Cause; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unit-economics", label: "Unit economics" },
  { value: "timing", label: "Bad timing" },
  { value: "competition", label: "Competition" },
  { value: "regulation", label: "Regulation" },
  { value: "pivot", label: "Pivot / acquired" },
];
const causeLabel = (c: string) => CAUSES.find(x => x.value === c)?.label ?? c;

export function Graveyard() {
  const [q, setQ] = useState("");
  const [cause, setCause] = useState<Cause>("all");
  const needle = q.trim().toLowerCase();
  const rows = ENTRIES.filter(e =>
    (cause === "all" || e.cause_category === cause) &&
    (!needle || [e.company_name, e.what_they_tried, e.cause_of_death].some(s => s.toLowerCase().includes(needle))));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Graveyard DB"
        aside={<span className="rounded-full bg-card px-4 py-2 text-sm font-medium shadow-card"><span className="font-mono">{ENTRIES.length}</span> seed entries</span>}
      >
        Startups that failed, pivoted or were acquired. Ideas are matched against these as leads to check.
      </PageHeader>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SearchField id="graveyardSearch" label="Search the graveyard" value={q} onChange={setQ} placeholder="Search by name, what they tried or cause" />
        <FilterPills label="Filter by cause of death" options={CAUSES} value={cause} onChange={setCause} />
      </div>

      {rows.length === 0 && <p className="rounded-card bg-card p-6 shadow-card">No entries match. Clear the search or choose another cause.</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(e => (
          <li key={e.id} className="flex flex-col rounded-card bg-card p-5 shadow-card sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-bold leading-tight">{e.company_name}</h2>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs">{e.year_closed}</span>
            </div>
            <p className="mt-2 text-[0.9375rem] leading-relaxed">{e.what_they_tried}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{e.cause_of_death}</p>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{causeLabel(e.cause_category)}</span>
              <span className="text-xs text-muted-foreground">{e.raised || "Funding not known"}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
