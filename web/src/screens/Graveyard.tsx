// ── Graveyard — the seed set of startups that shut down; ideas are matched against it ──
// The seed has no business category or founding year yet, so the filter is by cause of death and
// "years active" shows only the closing year. TODO(team): add category and year_founded to the seed.
import { useState, type ReactNode } from "react";
import { ChevronRight, CircleCheck, CircleDashed, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { EmptyState, FilterChips, PageTitle, SearchField } from "@/components/ui-vd";
import { GRAVEYARD_DB, registrableDomain } from "@/proto";

interface Entry {
  id: string; company_name: string; what_they_tried: string; cause_of_death: string;
  cause_category: string; year_closed: number; raised?: string; sources?: string[]; source_verified?: boolean;
}
const ENTRIES = GRAVEYARD_DB as Entry[];

type Cause = "all" | "unit-economics" | "timing" | "competition" | "regulation";
const CAUSES: { value: Cause; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unit-economics", label: "Unit economics" },
  { value: "timing", label: "Bad timing" },
  { value: "competition", label: "Competition" },
  { value: "regulation", label: "Regulation" },
];
const causeLabel = (c: string) => CAUSES.find(x => x.value === c)?.label ?? c;
const verifiedCount = ENTRIES.filter(e => e.source_verified === true).length;

export function Graveyard() {
  const [q, setQ] = useState("");
  const [cause, setCause] = useState<Cause>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const rows = ENTRIES.filter(e =>
    (cause === "all" || e.cause_category === cause) &&
    (!needle || [e.company_name, e.what_they_tried, e.cause_of_death].some(s => s.toLowerCase().includes(needle))));
  const open = ENTRIES.find(e => e.id === openId) ?? null;

  return (
    <div>
      <PageTitle eyebrow="Graveyard" title="Startups that shut down">
        {ENTRIES.length} startups in the seed set. Every idea you screen is compared with them by word overlap; a resemblance is a lead to check, not a verdict.
        Closure sources checked by the team so far: <span className="font-mono text-on-page">{verifiedCount}</span> of {ENTRIES.length}.
      </PageTitle>

      <div className="on-light space-y-4 rounded-panel bg-background p-4 text-foreground md:p-6">
        <SearchField id="graveyardSearch" label="Search the graveyard" value={q} onChange={setQ} placeholder="Search by name, what they tried or cause" control="graveyard_search" />
        <div className="space-y-2">
          <p className="text-sm font-semibold">Cause of death</p>
          <FilterChips label="Filter by cause of death" options={CAUSES} value={cause} onChange={setCause} control="graveyard_filter" />
        </div>
      </div>

      <p className="mt-5 text-sm text-on-page-muted" aria-live="polite">{rows.length} of {ENTRIES.length} shown</p>
      {rows.length === 0 ? (
        <div className="on-light mt-3 text-foreground">
          <EmptyState icon={Search} title="No startups match"
            action={<Button variant="outline" onClick={() => { setQ(""); setCause("all"); }} data-control="graveyard_clear">Clear search and filter</Button>}>
            Try another word, or pick “All” causes.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(e => (
            <li key={e.id}>
              <button type="button" onClick={() => setOpenId(e.id)} data-control="graveyard_entry_open" data-control-value={e.id}
                className="on-light flex h-full w-full flex-col rounded-card bg-background p-5 text-left text-foreground transition-colors duration-150 hover:bg-[color-mix(in_oklch,var(--background),var(--lime)_25%)]">
                <span className="flex w-full items-start justify-between gap-3">
                  <span className="font-display text-[1.5rem] leading-tight">{e.company_name}</span>
                  <ChevronRight aria-hidden className="mt-1.5 size-5 shrink-0" />
                </span>
                <span className="mt-2 line-clamp-2 text-[0.9375rem] leading-relaxed">{e.what_they_tried}</span>
                <span className="mt-4 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-control bg-muted px-2 py-1 font-semibold">{causeLabel(e.cause_category)}</span>
                  <span className="rounded-control bg-muted px-2 py-1 font-mono">closed {e.year_closed}</span>
                  <span className="rounded-control bg-muted px-2 py-1">{e.raised || "Funding not known"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open !== null} onOpenChange={o => { if (!o) setOpenId(null); }} closeControl="graveyard_sheet_close"
        title={open?.company_name} description={open ? `${causeLabel(open.cause_category)} · closed ${open.year_closed}` : undefined}>
        {open && (
          <dl className="space-y-3">
            <Detail label="What they tried">{open.what_they_tried}</Detail>
            <Detail label="Cause of death">{open.cause_of_death}</Detail>
            <div className="grid grid-cols-2 gap-3">
              <Detail label="Funding">{open.raised || "Not known"}</Detail>
              <Detail label="Years active">Closed {open.year_closed}; founding year not recorded</Detail>
            </div>
            <Detail label="Source">
              <span className="flex items-center gap-1.5 font-medium">
                {open.source_verified ? <CircleCheck aria-hidden className="size-4" /> : <CircleDashed aria-hidden className="size-4" />}
                {open.source_verified ? "Checked by the team" : "Not yet checked by the team"}
              </span>
              <ul className="mt-2 space-y-1.5">
                {(open.sources ?? []).map(url => (
                  <li key={url} className="min-w-0">
                    <a href={url} target="_blank" rel="noopener noreferrer" data-control="graveyard_source_link" className="inline-flex max-w-full items-center gap-1.5 text-link">
                      <span className="font-semibold underline underline-offset-4">{registrableDomain(url) || url}</span>
                      <span className="truncate text-muted-foreground">{url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                      <ExternalLink aria-hidden className="size-3.5 shrink-0" /><span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
                {!open.sources?.length && <li className="text-muted-foreground">No source recorded.</li>}
              </ul>
            </Detail>
          </dl>
        )}
      </Sheet>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-inner bg-card p-4">
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 text-[0.9375rem] leading-relaxed">{children}</dd>
    </div>
  );
}
