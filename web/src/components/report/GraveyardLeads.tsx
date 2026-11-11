import { CircleCheck, CircleDashed, ExternalLink } from "lucide-react";
import { CardLabel } from "./ReportSection";
import { GRAVEYARD_DB, registrableDomain } from "@/proto";
import { matchStrength, sharedWords } from "@/lib/overlap";
import { checkedLabel, type LeadCheck } from "@/lib/reports";
import type { GraveyardMatch } from "@/types";

interface SeedEntry { company_name: string; sources?: string[]; source_verified?: boolean }
const SEED = GRAVEYARD_DB as SeedEntry[];

// "Leads to check": startups that shut down after trying something similar. Flat dashed cards — leads,
// not evidence. The overlap is shown as words in common and a plain strength, never as a verdict.
// checks (sample reports): the page each lead's closure was checked on; its quote is the cause shown.
// entriesChecked: how many shut-down startups the run compared against (report.search.graveyard).
export function GraveyardLeads({ matches, ideaText, checks, entriesChecked }: { matches: GraveyardMatch[]; ideaText: string; checks?: Record<string, LeadCheck>; entriesChecked?: number | null }) {
  if (matches.length === 0) {
    return (
      <p className="rounded-card border-2 border-dashed border-border-strong p-5 text-[0.9375rem] leading-relaxed">
        No close matches among the {entriesChecked ?? SEED.length} shut-down startups checked. That doesn&apos;t mean nobody has tried this.
      </p>
    );
  }
  return (
    <ul className="space-y-4" data-tour="leads">
      {matches.map(m => {
        const seed = SEED.find(e => e.company_name === m.company_name);
        const words = sharedWords(ideaText, m.what_they_tried);
        const check = checks?.[m.company_name];
        const live = m.source_urls ?? [];
        const sources = check ? [check.url] : live.length ? live : seed?.sources ?? [];
        const liveDomains = new Set(live.map(u => registrableDomain(u) || u)).size;
        return (
          <li key={m.company_name} className="rounded-card border-2 border-dashed border-border-strong bg-card p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardLabel>Lead to check</CardLabel>
              <span className="rounded-control bg-muted px-2.5 py-1 text-[0.8125rem]" title="Word overlap between your idea and what they tried: 0 = none, 1 = identical wording.">
                {matchStrength(m.similarity)} word overlap <span className="font-mono font-medium">{m.similarity.toFixed(2)}</span>
              </span>
            </div>
            <h3 className="mt-4 font-display text-[1.5rem] leading-tight">
              {m.company_name}
              <span className="ml-2 font-sans text-sm text-muted-foreground">{m.year_closed != null ? `closed ${m.year_closed}` : "year closed not recorded"}</span>
            </h3>
            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-inner bg-muted p-4">
                <dt className="eyebrow text-muted-foreground">What they tried</dt>
                <dd className="mt-1.5 text-[0.9375rem] leading-relaxed">{m.what_they_tried}</dd>
              </div>
              <div className="rounded-inner bg-muted p-4">
                <dt className="eyebrow text-muted-foreground">Cause of death</dt>
                <dd className="mt-1.5 text-[0.9375rem] leading-relaxed">{check ? <>&ldquo;{m.cause_of_death}&rdquo; <span className="text-muted-foreground">(quoted from {registrableDomain(check.url) || check.url})</span></> : m.cause_of_death}</dd>
              </div>
              <div className="rounded-inner bg-muted p-4 md:col-span-2">
                <dt className="eyebrow text-muted-foreground">How it overlaps</dt>
                <dd className="mt-1.5 text-[0.9375rem] leading-relaxed">
                  {words.length ? (
                    <>Words in common: <span className="font-medium">{words.join(", ")}</span>.</>
                  ) : "Few words in common; matched on overall wording."}
                  <span className="text-muted-foreground"> Matching is word overlap only, so check whether the businesses really are alike.</span>
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {check
                ? <span className="inline-flex items-center gap-1.5 font-medium"><CircleCheck aria-hidden className="size-4" /> Closure checked for this sample on {checkedLabel(check.checked)}</span>
                : seed?.source_verified
                ? <span className="inline-flex items-center gap-1.5 font-medium"><CircleCheck aria-hidden className="size-4" /> Closure source checked by the team</span>
                : liveDomains >= 2
                ? <span className="inline-flex items-center gap-1.5 font-medium"><CircleCheck aria-hidden className="size-4" /> Shutdown stated in {liveDomains} independent sources (automatic check)</span>
                : <span className="inline-flex items-center gap-1.5 font-medium"><CircleDashed aria-hidden className="size-4" /> Closure source not yet checked by the team</span>}
              {sources.map(url => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" data-control="lead_source_link"
                  className="inline-flex items-center gap-1 text-link underline underline-offset-4">
                  {registrableDomain(url) || url} <ExternalLink aria-hidden className="size-3.5" /><span className="sr-only">(opens in a new tab)</span>
                </a>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
