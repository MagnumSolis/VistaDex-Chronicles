// Score summary (with "How this was calculated"), overlap band, Profile charts, competitors and Big Tech risk.
// Scores are ink numbers, never coloured as good/bad; every value has its inputs and search boundary one
// tap away; axes without enough data say so and are left out of the score.
import { useId, useRef, useState } from "react";
import { ChevronDown, CircleDashed, ExternalLink, FlaskConical, Layers, OctagonAlert, SearchX, Shield, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { registrableDomain } from "@/proto";
import { STATUS_ORDER } from "@/components/status";
import { Radar } from "@/components/charts/Radar";
import { Donut } from "@/components/charts/Donut";
import { NotAvailable, SampleBanner } from "./LegalMarket";
import { useSectionInView } from "@/telemetry/useSectionInView";
import type { AxisId, BigTechLevel, BigTechRisk, ClaimStatus, Competitor, OverlapBand, Report, Scores } from "@/types";

export const AXIS_LABEL: Record<AxisId, string> = {
  novelty: "Novelty", market: "Market", defensibility: "Defensibility", graveyard: "Graveyard distance", evidence: "Evidence quality", legal: "Regulatory load", big_tech: "Big Tech safety",
};
const RADAR_AXES: AxisId[] = ["novelty", "market", "defensibility", "graveyard", "evidence", "legal"];

// ── Overlap band: neutral ink (it is not a claim status) with a 1–3 bar like severity ──
const BAND: Record<OverlapBand, { label: string; level: number; help: string }> = {
  clear: { label: "Clear", level: 1, help: "No graveyard match at 0.3 or above and fewer than 3 competitors." },
  caution: { label: "Caution", level: 2, help: "A graveyard match between 0.3 and 0.5 word overlap." },
  high: { label: "High", level: 3, help: "A graveyard match of 0.5 or more, or 3 or more competitors found." },
};
export function OverlapBadge({ band, className }: { band: OverlapBand; className?: string }) {
  const b = BAND[band];
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-control bg-muted px-2.5 py-1 text-[0.8125rem] font-semibold text-foreground", className)} title={b.help}>
      <span aria-hidden className="inline-flex items-end gap-px">
        {[1, 2, 3].map(n => <span key={n} className={cn("w-1 rounded-[1px]", n <= b.level ? "bg-current" : "bg-border-strong")} style={{ height: 4 + n * 3 }} />)}
      </span>
      {b.label} overlap
    </span>
  );
}

// ── The score and its breakdown ──
export function ScoreSummary({ scores, band, runId }: { scores?: Scores; band?: OverlapBand; runId: string | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!scores) {
    return <p className="rounded-card bg-card p-4 text-[0.9375rem] text-muted-foreground">This report was made before scores existed, so it has no VistaDex Score.</p>;
  }
  const v = scores.vistadex;
  const toggle = () => { setOpen(o => !o); };
  return (
    <div className="rounded-card bg-card p-4 md:p-5" data-tour="score">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted-foreground">VistaDex Score</p>
          {v.value === null ? (
            <p className="mt-1 font-display text-[2.5rem] leading-none">Not enough data</p>
          ) : (
            <p className="mt-1 font-display leading-none"><span className="text-[4rem]">{v.value}</span><span className="ml-1 text-xl text-muted-foreground">/ 100</span></p>
          )}
          {v.sample && <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium"><FlaskConical aria-hidden className="size-4" /> Includes sample data</p>}
        </div>
        {band && <div className="text-right"><p className="eyebrow mb-1 text-muted-foreground">Overlap</p><OverlapBadge band={band} /></div>}
      </div>
      <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
        {v.value === null ? v.reason : "A weighted mean of the axes below that have enough data. It describes the evidence found, not whether the idea will work."}
      </p>
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={panelId}
        data-control="score_breakdown_toggle" data-control-value={open ? "close" : "open"}
        className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-control border border-foreground/70 px-3.5 text-sm font-medium hover:bg-accent print:hidden">
        How this was calculated <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-150", open && "rotate-180")} />
      </button>
      <div id={panelId} hidden={!open} data-print-expand>{open && <Breakdown scores={scores} runId={runId} />}</div>
    </div>
  );
}

function Breakdown({ scores, runId }: { scores: Scores; runId: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useSectionInView(ref, "score_breakdown", runId);
  const used = new Map(scores.vistadex.used.map(u => [u.axis, u]));
  const excluded = new Map(scores.vistadex.excluded.map(e => [e.axis, e.reason]));
  const order: AxisId[] = ["novelty", "market", "defensibility", "graveyard", "evidence", "big_tech"];
  return (
    <div ref={ref} className="mt-4 space-y-3">
      <ul className="space-y-2">
        {order.map(id => {
          const a = scores.axes[id];
          const u = used.get(id);
          return (
            <li key={id} className="rounded-inner bg-muted p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{AXIS_LABEL[id]}{a.sample && <span className="ml-2 text-xs font-medium">(sample data)</span>}</p>
                <p className="font-mono text-sm">
                  {a.value === null ? "Not enough data" : <>{a.value}<span className="text-muted-foreground"> / 100</span></>}
                  {u ? <span className="text-muted-foreground"> · weight {u.weight} ({Math.round(u.share * 100)}%)</span> : <span className="text-muted-foreground"> · not counted</span>}
                </p>
              </div>
              <p className="mt-1 text-sm leading-relaxed">{a.boundary}.</p>
              {a.note && <p className="mt-1 text-sm leading-relaxed">{a.note}</p>}
              {!u && excluded.get(id) && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Left out: {excluded.get(id)}</p>}
              <p className="mt-1 font-mono text-xs leading-relaxed text-muted-foreground">{Object.entries(a.inputs).map(([k, val]) => `${k.replace(/_/g, " ")}: ${val === null ? "—" : String(val)}`).join(" · ")}</p>
            </li>
          );
        })}
      </ul>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Weights: Novelty 25, Market 20, Defensibility 20, Graveyard distance 15, Evidence quality 10, Big Tech safety 10 (not counted in this version). They are re-scaled over the axes that have data; a score needs at least 3 of them and half the weight. How it works explains each formula.
      </p>
    </div>
  );
}

// ── Profile: radar of the five axes + donut of claim outcomes ──
export function Profile({ report }: { report: Report }) {
  const counts = Object.fromEntries(STATUS_ORDER.map(s => [s, report.claims.filter(c => c.status === s).length])) as Record<ClaimStatus, number>;
  const axes = RADAR_AXES.map(id => ({ id, label: AXIS_LABEL[id], value: report.scores?.axes[id]?.value ?? null, note: report.scores?.axes[id]?.reason }));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" data-tour="profile">
      <div className="rounded-card bg-card p-4">
        <p className="eyebrow text-muted-foreground">Idea profile</p>
        {report.scores
          ? <Radar axes={axes} caption="Each axis out of 100; n/a = not enough data (left out, not zero)." />
          : <p className="mt-2 text-[0.9375rem] text-muted-foreground">No profile: this report was made before scores existed.</p>}
      </div>
      <div className="rounded-card bg-card p-4">
        <p className="eyebrow text-muted-foreground">Claim outcomes</p>
        <Donut counts={counts} caption={`Claim outcomes: ${STATUS_ORDER.map(s => `${counts[s]} ${s}`).join(", ")}.`} />
      </div>
    </div>
  );
}

// ── Competitors (inside Leads to check) ──
export function Competitors({ report }: { report: Report }) {
  const list = report.competitors;
  const search = report.search?.competitors;
  const sample = Boolean(report.sample_fields?.includes("competitors"));
  return (
    <div className="mb-6">
      <h3 className="font-display text-[1.375rem] leading-tight">Products already doing something similar</h3>
      {!list || !search ? (
        <p className="mt-2 text-[0.9375rem] text-muted-foreground">Competitor search: not available in this version yet.</p>
      ) : (
        <>
          {sample && <div className="mt-3"><SampleBanner /></div>}
          <p className="mt-1 text-sm text-muted-foreground">Searched: {search.queries.map(q => `“${q}”`).join(", ")}; {search.sources_checked} source{search.sources_checked === 1 ? "" : "s"} read. A product is listed only if a fetched page names it.</p>
          {list.length === 0 ? (
            <p className="mt-3 rounded-card bg-card p-4 text-[0.9375rem]">No competitors found in {search.sources_checked} source{search.sources_checked === 1 ? "" : "s"} searched. That is not proof there are none.</p>
          ) : (
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {list.map((c: Competitor) => (
                <li key={c.name} className="rounded-card bg-card p-4">
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed">{c.why_similar}</p>
                  <blockquote className="mt-2 border-l-2 border-foreground/40 pl-3 text-sm leading-relaxed">“{c.quote}”</blockquote>
                  <SourceLink url={c.url} control="competitor_link" />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function SourceLink({ url, control }: { url: string; control: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" data-control={control}
      className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-link underline underline-offset-4">
      <span className="truncate">{registrableDomain(url) || url}</span> <ExternalLink aria-hidden className="size-3.5 shrink-0" /><span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

// ── Big Tech risk ──
const LEVEL: Record<BigTechLevel, { label: string; icon: LucideIcon; help: string }> = {
  high: { label: "High", icon: OctagonAlert, help: "A big company offers a directly competing product (2+ independent sources)." },
  medium: { label: "Medium", icon: TriangleAlert, help: "A big company has a related product or announcement (2+ independent sources)." },
  low: { label: "Low", icon: Shield, help: "Low risk." },
  unverified: { label: "Unverified", icon: CircleDashed, help: "Companies were mentioned, but by fewer than 2 independent sources." },
  none_found: { label: "None found", icon: SearchX, help: "Searched; none of the companies was mentioned. Not proof they aren't working on it." },
};
export function BigTech({ risk, sample }: { risk?: BigTechRisk; sample: boolean }) {
  if (!risk) return <NotAvailable what="This section shows whether a big platform company already offers or has announced something similar, with linked sources. It needs live web search, which this copy does not run." />;
  const L = LEVEL[risk.level];
  return (
    <div data-tour="big-tech">
      {sample && <SampleBanner />}
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-control bg-card px-3 py-1.5 font-semibold">
          <L.icon aria-hidden className="size-5" strokeWidth={1.75} /> {L.label} risk
        </span>
        <span className="text-sm text-muted-foreground">{L.help}</span>
      </div>
      <p className="mt-3 max-w-[70ch] text-[0.9375rem] leading-relaxed">{risk.summary}</p>
      {risk.companies.length > 0 && (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {risk.companies.map(c => (
            <li key={c.name} className="rounded-card bg-card p-4">
              <p className="font-semibold">{c.name} <span className="ml-1 text-sm font-medium text-muted-foreground">{c.relation === "direct" ? "Direct" : "Adjacent"}</span></p>
              {c.reason && <p className="mt-1 text-[0.9375rem] leading-relaxed">{c.reason}</p>}
              {c.quote && <blockquote className="mt-2 border-l-2 border-foreground/40 pl-3 text-sm leading-relaxed">“{c.quote}”</blockquote>}
              <div className="flex flex-wrap gap-x-4">{c.source_urls.map(u => <SourceLink key={u} url={u} control="big_tech_source_link" />)}</div>
            </li>
          ))}
        </ul>
      )}
      {risk.unconfirmed.length > 0 && (
        <div className="mt-4 rounded-card bg-card p-4">
          <p className="font-semibold">Mentioned by only one source</p>
          <ul className="mt-1 space-y-1">
            {risk.unconfirmed.map(c => (
              <li key={c.name} className="flex flex-wrap items-baseline gap-x-3 text-[0.9375rem]">{c.name}{c.source_urls.map(u => <SourceLink key={u} url={u} control="big_tech_source_link" />)}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
        <Layers aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>Checked: {risk.companies_checked.join(", ")}. Searched {risk.queries.length} quer{risk.queries.length === 1 ? "y" : "ies"}; {risk.sources_checked} source{risk.sources_checked === 1 ? "" : "s"} read. Shown, but not counted in the VistaDex Score in this version.</span>
      </p>
    </div>
  );
}

