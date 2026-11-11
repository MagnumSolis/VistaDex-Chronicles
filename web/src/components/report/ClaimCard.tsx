import { useId, useRef, useState } from "react";
import { useClaimInView } from "@/telemetry/useSectionInView";
import { ChevronDown, ExternalLink, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLAIM_TYPE_LABEL, STATUS, StatusTag } from "@/components/status";
import { CardLabel } from "./ReportSection";
import { independentSourceCount, registrableDomain } from "@/proto";
import * as telemetry from "@/telemetry";
import type { Claim, Evidence } from "@/types";

// Demo data stores scheme-less paths ("harvey.ai/pricing"); count their domains too (same rule as the pipeline).
const withScheme = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
export const sourceCount = (urls: string[]) => independentSourceCount((urls || []).map(withScheme)) as number;

export function ClaimCard({ claim, index, runId }: { claim: Claim; index: number; runId: string | null }) {
  const [open, setOpen] = useState(false);
  const sourcesId = useId();
  const ref = useRef<HTMLElement>(null);
  useClaimInView(ref, index, runId);
  const n = sourceCount(claim.source_urls);
  const s = STATUS[claim.status] ?? STATUS.unverified;
  const quoteFor = (url: string): Evidence | undefined => claim.evidence?.find(e => e.url === url);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    telemetry.claimExpanded(runId, index, next);
  };

  return (
    <article ref={ref} className="rounded-card bg-card p-5 md:p-6" aria-label={`Claim ${index + 1}: ${s.label}`} data-tour={index === 0 ? "claim" : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardLabel n={index + 1}>{CLAIM_TYPE_LABEL[claim.type] ?? claim.type} claim</CardLabel>
        <StatusTag status={claim.status} />
      </div>

      <p className="mt-4 text-[1.125rem] leading-relaxed text-foreground">{claim.claim}</p>

      <div className="mt-4 rounded-inner bg-muted p-4">
        <p className="eyebrow text-muted-foreground">Why this status</p>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed">{claim.reasoning || "No reasoning was recorded."}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm">
          <Link2 aria-hidden className="size-4" />
          <span><span className="font-mono font-medium">{n}</span> independent source{n === 1 ? "" : "s"}</span>
        </span>
        {claim.source_urls.length > 0 && (
          <button type="button" onClick={toggle} aria-expanded={open} aria-controls={sourcesId}
            data-control="sources_toggle" data-control-value={String(index)}
            className="inline-flex h-10 items-center gap-1.5 rounded-control border border-foreground/70 px-3.5 text-sm font-medium transition-colors duration-150 hover:bg-accent print:hidden">
            {open ? "Hide sources" : `Show sources (${claim.source_urls.length})`}
            <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-150", open && "rotate-180")} />
          </button>
        )}
      </div>

      {claim.source_urls.length > 0 && (
        <ul id={sourcesId} hidden={!open} data-print-expand className="mt-4 space-y-3 border-t pt-4">
          {claim.source_urls.map(url => <SourceItem key={url} url={url} evidence={quoteFor(url)} claimIndex={index} runId={runId} />)}
          {!claim.evidence?.length && (
            <li className="text-sm text-muted-foreground">Quotes from these pages appear in “Why this status” above when the source was fetched.</li>
          )}
        </ul>
      )}
    </article>
  );
}

function SourceItem({ url, evidence, claimIndex, runId }: { url: string; evidence?: Evidence; claimIndex: number; runId: string | null }) {
  const isLink = /^https?:\/\//i.test(url);
  const domain = registrableDomain(withScheme(url)) || url;
  if (!isLink) {
    return (
      <li className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">{domain}</span>
        <span className="text-muted-foreground">reference from demo data, not a checked link</span>
      </li>
    );
  }
  return (
    <li className="min-w-0 text-sm">
      <a href={url} target="_blank" rel="noopener noreferrer" data-control="source_link"
        onClick={() => telemetry.sourceClicked(runId, claimIndex, url)}
        className="group inline-flex max-w-full items-center gap-2 rounded-sm text-link">
        <span className="font-semibold underline-offset-4 group-hover:underline">{domain}</span>
        <span className="truncate text-muted-foreground">{url.replace(/^https?:\/\/(www\.)?/, "")}</span>
        <ExternalLink aria-hidden className="size-3.5 shrink-0" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {evidence && (
        <blockquote className="mt-1.5 border-l-2 border-foreground/40 pl-3 text-[0.9375rem] leading-relaxed">
          <span className="eyebrow mr-2 text-muted-foreground">{evidence.stance === "supports" ? "Supports" : "Contradicts"}</span>
          “{evidence.quote}”
        </blockquote>
      )}
    </li>
  );
}
