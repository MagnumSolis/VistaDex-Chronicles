// Legal and Market sections. The pipeline does not produce either yet: live runs and demo reports show a
// neutral "not available" state; only mock-mode runs carry clearly labelled sample data.
import type { ReactNode } from "react";
import { ExternalLink, FlaskConical, Hourglass, Landmark, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-vd";
import { navigate, PATHS } from "@/router";
import type { Jurisdiction, Legal, Link, Market } from "@/types";

const JURISDICTION_NAME: Record<Jurisdiction, string> = { EU: "European Union", USA: "United States", India: "India" };

export function SampleBanner() {
  return (
    <p className="mb-5 flex items-start gap-2.5 rounded-inner border-2 border-dashed border-foreground p-3.5 text-[0.9375rem] font-medium">
      <FlaskConical aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
      Sample data, not real. Mock mode fills this section with placeholders so you can see its layout. Do not use any of it.
    </p>
  );
}

export function NotAvailable({ what }: { what: string }) {
  return (
    <EmptyState icon={Hourglass} title="Not available in this version yet"
      action={<Button variant="outline" onClick={() => navigate(PATHS.how)} data-control="report_how_it_works">What's planned</Button>}>
      {what}
    </EmptyState>
  );
}

function ExtLink({ link, control }: { link: Link; control: string }) {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" data-control={control}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-link underline underline-offset-4">
      {link.name} <ExternalLink aria-hidden className="size-3.5 shrink-0" /><span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function LegalSection({ legal, markets }: { legal?: Legal; markets: Jurisdiction[] }) {
  if (!legal) {
    return <NotAvailable what="This section will list things you can look up for each target market (patents, trademarks, approvals, licences, with registry links) and rules that may apply, each naming the rule and its source. It will never say whether something is allowed." />;
  }
  const shown = legal.jurisdictions.filter(j => markets.includes(j.jurisdiction));
  return (
    <div data-tour="legal">
      {legal.sample && <SampleBanner />}
      {shown.length === 0 ? (
        <EmptyState icon={MapPin} title="No target market was picked for this screening">
          Pick EU, USA or India on the Screen an idea page before you run, and this section covers those markets.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {shown.map(j => (
            <div key={j.jurisdiction} className="rounded-card bg-card p-5 md:p-6">
              <h3 className="flex items-center gap-2.5 font-display text-[1.5rem] leading-tight">
                <Landmark aria-hidden className="size-5" strokeWidth={1.75} /> {JURISDICTION_NAME[j.jurisdiction]} <span className="font-sans text-sm text-muted-foreground">({j.jurisdiction})</span>
              </h3>
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <Group title="Things you can check" note="Records you can look up yourself.">
                  {j.facts.map(f => (
                    <li key={f.title} className="rounded-inner bg-muted p-4">
                      <p className="eyebrow text-muted-foreground">{f.kind}</p>
                      <p className="mt-1 font-medium">{f.title}</p>
                      {f.reference && <p className="font-mono text-xs text-muted-foreground">{f.reference}</p>}
                      <p className="mt-1.5 text-[0.9375rem] leading-relaxed">{f.detail}</p>
                      <div className="mt-2"><ExtLink link={f.registry} control="legal_registry_link" /></div>
                    </li>
                  ))}
                </Group>
                <Group title="Rules that may apply" note="Each names the rule and its source. Read the source; this is not legal advice.">
                  {j.requirements.map(r => (
                    <li key={r.rule} className="rounded-inner bg-muted p-4">
                      <p className="font-medium">{r.rule}</p>
                      <p className="mt-1.5 text-[0.9375rem] leading-relaxed">{r.summary}</p>
                      <div className="mt-2"><ExtLink link={r.source} control="legal_rule_source_link" /></div>
                    </li>
                  ))}
                </Group>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Group({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="font-semibold">{title}</h4>
      <p className="mt-0.5 text-sm text-muted-foreground">{note}</p>
      <ul className="mt-3 space-y-3">{children}</ul>
    </div>
  );
}

export function MarketSection({ market }: { market?: Market }) {
  if (!market) {
    return <NotAvailable what="This section will give a ballpark market size: the total market (TAM) with its citation, and the serviceable (SAM) and obtainable (SOM) markets, clearly labelled as estimates with their assumptions listed." />;
  }
  return (
    <div>
      {market.sample && <SampleBanner />}
      <div className="grid gap-4 md:grid-cols-3">
        <Figure label="TAM" name="Total addressable market" value={market.tam.value} scope={market.tam.scope}>
          <p className="eyebrow text-muted-foreground">Source</p>
          <div className="mt-1"><ExtLink link={market.tam.citation} control="market_citation_link" /></div>
        </Figure>
        {(["sam", "som"] as const).map(k => (
          <Figure key={k} label={k.toUpperCase()} name={k === "sam" ? "Serviceable addressable market" : "Serviceable obtainable market"} estimate value={market[k].value} scope={market[k].scope}>
            <p className="eyebrow text-muted-foreground">Assumptions</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[0.9375rem] leading-relaxed">
              {market[k].assumptions.map(a => <li key={a}>{a}</li>)}
            </ul>
          </Figure>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">SAM and SOM are estimates. They are only as good as their assumptions, so check each one.</p>
    </div>
  );
}

function Figure({ label, name, value, scope, estimate = false, children }: { label: string; name: string; value: string; scope: string; estimate?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p><span className="font-mono font-medium">{label}</span> <span className="text-sm text-muted-foreground">{name}</span></p>
        {estimate && <span className="rounded-control border border-foreground/70 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em]">Estimate</span>}
      </div>
      <p className="font-display text-[1.75rem] leading-tight">{value}</p>
      <p className="text-[0.9375rem] leading-relaxed">{scope}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}
