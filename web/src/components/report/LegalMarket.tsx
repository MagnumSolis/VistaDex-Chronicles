// Legal and Market sections. Live runs search for both (study-9 on): every rule and figure is quoted from a
// fetched page and linked. Demo reports and runs without web search say so; only mock-mode runs carry
// clearly labelled sample data.
import type { ReactNode } from "react";
import { ExternalLink, FlaskConical, Hourglass, Landmark, MapPin, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-vd";
import { navigate, PATHS } from "@/router";
import type { Jurisdiction, Legal, Link, Market, SearchBoundary } from "@/types";

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

export function LegalSection({ legal, markets, sample, live }: { legal?: Legal; markets: Jurisdiction[]; sample: boolean; live?: SearchBoundary }) {
  if (!legal) {
    if (!markets.length) {
      return (
        <EmptyState icon={MapPin} title="No target market was picked for this screening">
          Pick EU, USA or India on the Screen an idea page before you run, and this section searches the rules named for that market and links its official registries.
        </EmptyState>
      );
    }
    return <NotAvailable what="The legal search could not run for this report (no web search was available). It lists official registries to search and rules that sources name for each target market. It never says whether something is allowed." />;
  }
  const shown = legal.jurisdictions.filter(j => markets.includes(j.jurisdiction));
  return (
    <div data-tour="legal">
      {sample && <SampleBanner />}
      {live && <p className="mb-5 text-[0.9375rem] text-muted-foreground">Searched: {live.queries.map(q => `“${q}”`).join(", ")}; {live.sources_checked} source{live.sources_checked === 1 ? "" : "s"} read. A rule is listed only if a fetched page names it; it counts in the score only when 2 independent sources name it. This is not legal advice.</p>}
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
                <Group title="Things you can check" note="Official registries to search yourself.">
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
                <Group title="Rules that may apply" note="Each names the rule and where it is named. Read the source.">
                  {j.requirements.length === 0 && (
                    <li className="rounded-inner border-2 border-dashed border-foreground/40 p-4 text-[0.9375rem]">
                      No rule named in {j.sources_checked ?? 0} source{j.sources_checked === 1 ? "" : "s"} read for this market. That is not proof there are none.
                    </li>
                  )}
                  {j.requirements.map(r => (
                    <li key={r.rule} className="rounded-inner bg-muted p-4">
                      <p className="font-medium">{r.rule}</p>
                      {r.independent_sources != null && (
                        <p className="mt-1 font-mono text-xs">{r.corroborated ? `Named by ${r.independent_sources} independent sources` : "Named by one source only: check it"}</p>
                      )}
                      <p className="mt-1.5 text-[0.9375rem] leading-relaxed">{r.summary}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {(r.sources?.length ? r.sources : [r.source]).map(src => <ExtLink key={src.url} link={src} control="legal_rule_source_link" />)}
                      </div>
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

export function MarketSection({ market, sample, search }: { market?: Market; sample: boolean; search?: SearchBoundary }) {
  if (!market?.tam) {
    if (search) {
      return (
        <EmptyState icon={SearchX} title="No market size found">
          No market-size figure was quoted in {search.sources_checked} source{search.sources_checked === 1 ? "" : "s"} read (searched: {search.queries.map(q => `“${q}”`).join(", ")}). That is not proof the market is small.
        </EmptyState>
      );
    }
    return <NotAvailable what="The market-size search could not run for this report (no web search was available). It looks for market-size figures that sources state, each quoted and linked, and takes the median of independent sources." />;
  }
  const one = market.tam.corroborated === false;
  const others = (market.figures || []).filter(f => f.citation?.url !== market.tam?.citation?.url);
  return (
    <div>
      {sample && <SampleBanner />}
      {search && <p className="mb-5 text-[0.9375rem] text-muted-foreground">Searched: {search.queries.map(q => `“${q}”`).join(", ")}; {search.sources_checked} source{search.sources_checked === 1 ? "" : "s"} read. A figure is kept only when the sentence that states it is on the page.</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <Figure label="TAM" name="Total addressable market" value={market.tam.value} scope={market.tam.scope} badge={one ? "One source" : undefined}>
          <p className="eyebrow text-muted-foreground">{market.tam.independent_sources && market.tam.independent_sources > 1 ? "Closest figure to the median" : "Source"}</p>
          {market.tam.quote && <blockquote className="mt-1 border-l-2 border-foreground/40 pl-3 text-sm leading-relaxed">“{market.tam.quote}”</blockquote>}
          {market.tam.citation && <div className="mt-1"><ExtLink link={market.tam.citation} control="market_citation_link" /></div>}
        </Figure>
        {(["sam", "som"] as const).map(k => market[k] ? (
          <Figure key={k} label={k.toUpperCase()} name={k === "sam" ? "Serviceable addressable market" : "Serviceable obtainable market"} badge="Estimate" value={market[k].value} scope={market[k].scope}>
            <p className="eyebrow text-muted-foreground">Assumptions</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[0.9375rem] leading-relaxed">
              {market[k]!.assumptions.map(a => <li key={a}>{a}</li>)}
            </ul>
          </Figure>
        ) : (
          <div key={k} className="rounded-card bg-card p-5">
            <p><span className="font-mono font-medium">{k.toUpperCase()}</span> <span className="text-sm text-muted-foreground">{k === "sam" ? "Serviceable addressable market" : "Serviceable obtainable market"}</span></p>
            <p className="mt-3 text-[0.9375rem] leading-relaxed">Needs your own assumptions (who you can reach, at what price, what share), so VistaDex does not produce it. Start from the TAM and write yours down.</p>
          </div>
        ))}
      </div>
      {others.length > 0 && (
        <div className="mt-5">
          <h4 className="font-semibold">Every figure found</h4>
          <ul className="mt-3 space-y-3">
            {others.map(f => (
              <li key={f.citation?.url ?? f.quote} className="rounded-inner bg-card p-4">
                <p className="font-display text-xl">{f.value}{f.year ? <span className="ml-2 font-mono text-xs">{f.year}</span> : null}</p>
                {f.market && <p className="text-sm text-muted-foreground">{f.market}</p>}
                <blockquote className="mt-1 border-l-2 border-foreground/40 pl-3 text-sm leading-relaxed">“{f.quote}”</blockquote>
                {f.citation && <div className="mt-1"><ExtLink link={f.citation} control="market_citation_link" /></div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Figure({ label, name, value, scope, badge, children }: { label: string; name: string; value: string; scope: string; badge?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p><span className="font-mono font-medium">{label}</span> <span className="text-sm text-muted-foreground">{name}</span></p>
        {badge && <span className="rounded-control border border-foreground/70 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em]">{badge}</span>}
      </div>
      <p className="font-display text-[1.75rem] leading-tight">{value}</p>
      <p className="text-[0.9375rem] leading-relaxed">{scope}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}
