import { useId, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLAIM_TYPE_LABEL, STATUS, StatusTag } from "@/components/status";
import { CardLabel } from "@/components/Section";
import { independentSourceCount, registrableDomain, studyConfig } from "@/proto";
import * as study from "@/study/controller";
import type { Claim } from "@/types";

// Demo data stores scheme-less paths ("harvey.ai/pricing"); count their domains too (same rule as before).
const withScheme = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
export const sourceCount = (urls: string[]) => independentSourceCount((urls || []).map(withScheme)) as number;

export function ClaimCard({ claim, index, rateable }: { claim: Claim; index: number; rateable: boolean }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<string | null>(null);
  const evidenceId = useId();
  const n = sourceCount(claim.source_urls);
  const s = STATUS[claim.status] ?? STATUS.unverified;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    study.claimExpanded(index, next);
  };

  return (
    <article className="rounded-card bg-card shadow-card" aria-label={`Claim ${index + 1}: ${s.label}`}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardLabel n={index + 1}>{CLAIM_TYPE_LABEL[claim.type] ?? claim.type}</CardLabel>
          <StatusTag status={claim.status} />
        </div>

        <p className="mt-4 text-[1.0625rem] leading-relaxed text-foreground">{claim.claim}</p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Link2 aria-hidden className="size-4" />
            <span><span className="font-mono font-medium text-foreground">{n}</span> independent source{n === 1 ? "" : "s"}</span>
          </span>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={evidenceId}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input px-4 text-sm font-medium text-primary transition-colors duration-150 hover:bg-accent"
          >
            {open ? "Hide evidence" : "Show evidence"}
            {open ? <ChevronUp aria-hidden className="size-4" /> : <ChevronDown aria-hidden className="size-4" />}
          </button>
        </div>

        <div id={evidenceId} hidden={!open} className="mt-4 space-y-3 rounded-inner bg-muted p-4">
          <p className="text-[0.9375rem] leading-relaxed text-foreground">{claim.reasoning}</p>
          {claim.source_urls.length > 0 && (
            <ul className="space-y-2 border-t pt-3">
              {claim.source_urls.map(url => <SourceItem key={url} url={url} claimIndex={index} />)}
            </ul>
          )}
        </div>
      </div>

      {rateable && (
        <fieldset className="grid grid-cols-3 gap-2 border-t px-5 py-4 sm:px-6">
          <legend className="sr-only">{studyConfig.CLAIM_RATING.prompt} Claim {index + 1}</legend>
          <span aria-hidden className="col-span-3 mb-1 text-sm font-medium">{studyConfig.CLAIM_RATING.prompt}</span>
          {studyConfig.CLAIM_RATING.options.map((o: { value: string; label: string }) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={rating === o.value}
              onClick={() => { setRating(o.value); study.claimRated(index, claim.type, claim.status, o.value); }}
              className={cn(
                "h-10 rounded-full border px-3 text-sm transition-colors duration-150",
                rating === o.value ? "border-primary bg-primary font-medium text-primary-foreground" : "border-input bg-card hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </fieldset>
      )}
    </article>
  );
}

function SourceItem({ url, claimIndex }: { url: string; claimIndex: number }) {
  const isLink = /^https?:\/\//i.test(url);
  const domain = registrableDomain(withScheme(url)) || url;
  if (!isLink) {
    return (
      <li className="flex min-w-0 items-baseline gap-2 text-sm">
        <span className="font-medium">{domain}</span>
        <span className="truncate text-muted-foreground" title="Reference from demo data — not a checked link">unchecked reference</span>
      </li>
    );
  }
  return (
    <li className="min-w-0 text-sm">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => study.sourceClicked(claimIndex, url)}
        className="group inline-flex max-w-full items-center gap-2 rounded-sm text-primary"
      >
        <span className="font-medium group-hover:underline">{domain}</span>
        <span className="truncate text-muted-foreground">{url.replace(/^https?:\/\/(www\.)?/, "")}</span>
        <ExternalLink aria-hidden className="size-3.5 shrink-0" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  );
}
