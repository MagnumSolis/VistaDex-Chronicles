import { useId, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLAIM_TYPE_LABEL, STATUS, StatusTag } from "@/components/status";
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
    <article className={cn("rounded-lg border border-l-4 bg-card", s.rule)} aria-label={`Claim ${index + 1}: ${s.label}`}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Claim {index + 1} · {CLAIM_TYPE_LABEL[claim.type] ?? claim.type}
          </span>
          <StatusTag status={claim.status} />
        </div>

        <p className="mt-3 text-[0.9375rem] leading-relaxed text-foreground">{claim.claim}</p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <Link2 aria-hidden className="size-3.5" />
            {n} independent source{n === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={evidenceId}
            className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline"
          >
            {open ? "Hide evidence & reasoning" : "Show evidence & reasoning"}
            {open ? <ChevronUp aria-hidden className="size-4" /> : <ChevronDown aria-hidden className="size-4" />}
          </button>
        </div>

        <div id={evidenceId} hidden={!open} className="mt-3 space-y-3 rounded-md bg-muted/60 p-3.5">
          <p className="text-sm leading-relaxed text-foreground/90">{claim.reasoning}</p>
          {claim.source_urls.length > 0 ? (
            <ul className="space-y-1.5">
              {claim.source_urls.map(url => <SourceItem key={url} url={url} claimIndex={index} />)}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No sources were cited for this claim.</p>
          )}
        </div>
      </div>

      {rateable && (
        <fieldset className="grid grid-cols-3 gap-2 border-t px-4 py-3 sm:flex sm:flex-wrap sm:items-center sm:px-5">
          <legend className="sr-only">{studyConfig.CLAIM_RATING.prompt} Claim {index + 1}</legend>
          <span aria-hidden className="col-span-3 text-sm text-muted-foreground sm:col-auto sm:mr-1">{studyConfig.CLAIM_RATING.prompt}</span>
          {studyConfig.CLAIM_RATING.options.map((o: { value: string; label: string }) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={rating === o.value}
              onClick={() => { setRating(o.value); study.claimRated(index, claim.type, claim.status, o.value); }}
              className={cn(
                "h-10 rounded-md border px-3 text-sm transition-colors duration-150 sm:h-9 sm:min-w-20",
                rating === o.value ? "border-primary bg-accent font-medium text-accent-foreground" : "border-input bg-card text-foreground hover:bg-muted",
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
      <li className="flex items-baseline gap-2 text-sm">
        <span className="font-medium">{domain}</span>
        <span className="truncate text-xs text-muted-foreground" title="Reference from demo data — not a checked link">{url} · unchecked reference</span>
      </li>
    );
  }
  return (
    <li className="text-sm">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => study.sourceClicked(claimIndex, url)}
        className="group inline-flex max-w-full items-baseline gap-2 rounded-sm text-primary"
      >
        <span className="font-medium group-hover:underline">{domain}</span>
        <span className="truncate text-xs text-muted-foreground">{url}</span>
        <ExternalLink aria-hidden className="size-3 shrink-0 self-center" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  );
}
