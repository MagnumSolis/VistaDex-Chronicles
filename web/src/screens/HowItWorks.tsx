// ── How it works — the method, the statuses, the evidence rule, data sources and honest limitations ──
import type { ReactNode } from "react";
import { ClipboardList, ExternalLink, Ghost, Hourglass, Link2, MessageSquareWarning, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTitle, Panel, Tile } from "@/components/ui-vd";
import { STATUS, STATUS_ORDER, StatusTag } from "@/components/status";
import { GRAVEYARD_DB, liveMode } from "@/proto";
import { BIG_TECH_COMPANIES, MIN_SCORE_AXES, MIN_SCORE_WEIGHT_SHARE, NOVELTY, DEFENSIBILITY, OVERLAP, WEIGHTS } from "@proto/core/scoring-config.js";
import { navigate, PATHS } from "@/router";

const SEED = GRAVEYARD_DB as { source_verified?: boolean }[];

// Official registries and rule sources the Legal section is designed to cite (it is not produced yet).
// TODO(team): confirm this list before the Legal section ships.
const REGISTRIES: { market: string; items: { name: string; what: string; url: string }[] }[] = [
  { market: "European Union", items: [
    { name: "EUIPO", what: "EU trade marks and designs", url: "https://euipo.europa.eu/" },
    { name: "Espacenet (European Patent Office)", what: "Patents", url: "https://worldwide.espacenet.com/" },
    { name: "EUR-Lex", what: "EU law and regulations", url: "https://eur-lex.europa.eu/" },
  ] },
  { market: "United States", items: [
    { name: "USPTO", what: "Patents and trademarks", url: "https://www.uspto.gov/" },
    { name: "FDA", what: "Product approvals and clearances", url: "https://www.fda.gov/" },
    { name: "eCFR", what: "Federal regulations", url: "https://www.ecfr.gov/" },
  ] },
  { market: "India", items: [
    { name: "IP India", what: "Patents, trade marks and designs", url: "https://ipindia.gov.in/" },
    { name: "CDSCO", what: "Drug and medical device approvals", url: "https://cdsco.gov.in/" },
    { name: "India Code", what: "Central acts and rules", url: "https://www.indiacode.nic.in/" },
  ] },
];

export function HowItWorks({ onReplay }: { onReplay?: () => void }) {
  const verified = SEED.filter(e => e.source_verified === true).length;
  return (
    <div className="space-y-6 md:space-y-8">
      <PageTitle eyebrow="How it works" title="Evidence first. You decide.">
VistaDex shows what the evidence says about each claim, who already does something similar, which startups failed trying it, and the best arguments against it, then sums that up in a score you can take apart. It never calls an idea good or bad.
      </PageTitle>

      <Panel as="section" tab="The method" tabId="how-method" aria-labelledby="how-method">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-center">
          <ol className="grid gap-3 sm:grid-cols-2">
            <li className="sm:col-span-2"><Tile icon={ClipboardList} label="0 · Describe the idea" className="bg-card">Title, one-line pitch, problem, solution and what makes it different (the moat), plus industry, your role and target markets. Title, pitch, problem and solution are required.</Tile></li>
            <li><Tile icon={ScanText} label="1 · Split into claims" className="bg-lime text-on-lime">Pulls the statements the idea depends on (“no tool does this”, “the market is worth $27B”, “we have 1,200 paying users”) out of your text, keeping only ones that could be checked.</Tile></li>
            <li><Tile icon={Link2} label="2 · Check each claim" className="bg-card">Searches the web for each claim, reads the pages, and counts independent sources that support or contradict it. A separate search looks for products already doing something similar, and for Big Tech.</Tile></li>
            <li><Tile icon={Ghost} label="3 · Search the graveyard" className="bg-card">Inside every report, the idea is compared with startups that shut down, so you can see who tried before and why they failed.</Tile></li>
            <li><Tile icon={MessageSquareWarning} label="4 · Argue against it" className="bg-lime text-on-lime">Writes objections using what was found. They get the same space as the claims. Then the score is computed in code from all of it.</Tile></li>
            <li className="sm:col-span-2">
              <div className="flex items-start gap-3 rounded-card border-2 border-dashed border-border-strong p-5 text-[0.9375rem] leading-relaxed">
                <Hourglass aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
                <p><span className="font-semibold">Partly built: legal and market.</span> The total market size (TAM) is read from a verified source quote when a market-size claim is confirmed. Registries, rules, SAM and SOM are not produced in this version; reports say so.</p>
              </div>
            </li>
          </ol>
          <StackDiagram />
        </div>
      </Panel>

      <Panel as="section" tab="What each status means" tabId="how-statuses" aria-labelledby="how-statuses">
        <ul className="grid gap-3 md:grid-cols-2">
          {STATUS_ORDER.map(s => (
            <li key={s} className="rounded-card bg-card p-5">
              <StatusTag status={s} />
              <p className="mt-3 text-[0.9375rem] leading-relaxed">{STATUS[s].help}</p>
              {s === "unverified" && <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">Most claims end up here, and that is fine: it means the web doesn&apos;t settle the question. It is not a mark against the idea.</p>}
              {s === "confirmed" && <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">Confirmed means sources agree with the claim, not that the idea will work.</p>}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel as="section" tab="The evidence rule" tabId="how-rule" aria-labelledby="how-rule">
        <ul className="max-w-[70ch] space-y-3 text-[1.0625rem] leading-relaxed">
          <Rule>A status needs <span className="font-semibold">at least two independent sources</span>. Independent means different websites, counted by domain. With fewer, the claim stays unverified.</Rule>
          <Rule>Every quote used as evidence must <span className="font-semibold">appear word for word on the page that was fetched</span>. Quotes that don&apos;t are thrown away.</Rule>
          <Rule>The language model only says whether each source supports or contradicts a claim. <span className="font-semibold">The status is computed in code</span> from those counts, never chosen by the model.</Rule>
          <Rule>One website saying both things counts for neither side.</Rule>
        </ul>
      </Panel>

      <Panel as="section" tab="The VistaDex Score" tabId="how-score" aria-labelledby="how-score">
        <p className="max-w-[70ch] text-[1.0625rem] leading-relaxed">
          Five axes, each out of 100 and computed in code from the report, never by a model. Each one shows its inputs and what was searched in the report's “How this was calculated”. An axis without enough data says so and is left out, never guessed.
        </p>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          <Axis name="Novelty" weight={WEIGHTS.novelty}>Starts at 100. Each distinct competitor found on a fetched page costs {NOVELTY.perCompetitor} (at most {NOVELTY.maxCompetitorsCounted} counted); each disputed novelty claim costs {NOVELTY.disputed}; each confirmed one adds {NOVELTY.confirmed}. A contradicted novelty claim costs {NOVELTY.contradicted} and caps the axis at {NOVELTY.contradictedCap}. Finding no competitors caps it at {NOVELTY.noCompetitorsCap}: not finding any is not proof there are none.</Axis>
          <Axis name="Market" weight={WEIGHTS.market}>The total market size (TAM) on a log scale: $10M or less is 0, $1B or more is 100. The TAM must come from a verified quote on a source page, never from the idea text. No TAM, no value.</Axis>
          <Axis name="Defensibility" weight={WEIGHTS.defensibility}>Starts at {DEFENSIBILITY.base}; a stated moat adds at most {DEFENSIBILITY.moatBonus}. Each confirmed defensibility claim adds {DEFENSIBILITY.confirmed}, a disputed one costs {DEFENSIBILITY.disputed}, a contradicted one {DEFENSIBILITY.contradicted}. Objections about the moat cost {DEFENSIBILITY.moatObjection.high} / {DEFENSIBILITY.moatObjection.medium} / {DEFENSIBILITY.moatObjection.low} by severity. A stated moat alone is not data.</Axis>
          <Axis name="Graveyard distance" weight={WEIGHTS.graveyard}>100 × (1 − the strongest word overlap with a shut-down startup). No match at all gives 100. Shown with the number of entries checked and whether the seed was verified.</Axis>
          <Axis name="Evidence quality" weight={WEIGHTS.evidence}>The share of claims that got a status (not unverified) backed by at least 2 independent sources.</Axis>
          <Axis name="Big Tech safety" weight={WEIGHTS.big_tech}>Low risk 100, medium 50, high 0. Shown, but not counted in this version: what evidence a low risk needs is still being defined, and “unverified” is never counted.</Axis>
        </ul>
        <p className="mt-5 max-w-[70ch] text-[0.9375rem] leading-relaxed">
          The VistaDex Score is the weighted mean of the axes that have a value, with the weights re-scaled over them. It needs at least {MIN_SCORE_AXES} axes and {Math.round(MIN_SCORE_WEIGHT_SHARE * 100)}% of the weight; otherwise the report says “Not enough data”. It describes the evidence that was found, not whether the idea will work. In mock mode, axes built on sample data are marked as such.
        </p>
      </Panel>

      <Panel as="section" tab="Overlap and Big Tech risk" tabId="how-risk" aria-labelledby="how-risk">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-card bg-card p-5">
            <p className="font-semibold">Overlap band</p>
            <ul className="mt-2 space-y-1.5 text-[0.9375rem] leading-relaxed">
              <li><span className="font-medium">Clear</span>: strongest graveyard match below {OVERLAP.caution} and fewer than {OVERLAP.highCompetitors} competitors.</li>
              <li><span className="font-medium">Caution</span>: a graveyard match from {OVERLAP.caution} to {OVERLAP.high}.</li>
              <li><span className="font-medium">High</span>: a match of {OVERLAP.high} or more, or {OVERLAP.highCompetitors}+ competitors.</li>
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">These edges are provisional and will be tuned.</p>
          </div>
          <div className="rounded-card bg-card p-5">
            <p className="font-semibold">Big Tech risk</p>
            <p className="mt-2 text-[0.9375rem] leading-relaxed">
              Searches for {BIG_TECH_COMPANIES.length} large companies ({BIG_TECH_COMPANIES.join(", ")}). Same rule as claims: a company counts only when 2 independent sources show it doing something similar (high if directly competing, medium if related). Fewer sources: unverified. Pages read and none mentioned: none found, which is not proof of safety.
            </p>
          </div>
        </div>
      </Panel>

      <Panel as="section" tab="Where the data comes from" tabId="how-data" aria-labelledby="how-data">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-card bg-card p-5">
            <p className="font-semibold">Sources for claims</p>
            <p className="mt-2 text-[0.9375rem] leading-relaxed">
              Web search results, fetched and read for each claim. {liveMode() ? "" : "This copy runs in mock mode: no web search happens, so every claim stays unverified."}
            </p>
          </div>
          <div className="rounded-card bg-card p-5">
            <p className="font-semibold">The graveyard (inside reports)</p>
            <p className="mt-2 text-[0.9375rem] leading-relaxed">
              {SEED.length} startups that shut down, taken from public shutdown reports, matched against every idea in its report's Leads to check. Each entry links its sources; the team has checked <span className="font-mono">{verified}</span> of {SEED.length} so far, and each lead says whether its source was checked.
            </p>
          </div>
          <div className="rounded-card bg-card p-5">
            <p className="font-semibold">Legal (planned)</p>
            <p className="mt-2 text-[0.9375rem] leading-relaxed">Official registries and rule sources for each market, listed below. The report will link the records it finds there.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {REGISTRIES.map(r => (
            <div key={r.market}>
              <p className="eyebrow text-muted-foreground">{r.market}</p>
              <ul className="mt-2 space-y-2">
                {r.items.map(i => (
                  <li key={i.name} className="text-[0.9375rem]">
                    <a href={i.url} target="_blank" rel="noopener noreferrer" data-control="how_registry_link" data-control-value={i.name}
                      className="inline-flex items-center gap-1.5 font-medium text-link underline underline-offset-4">
                      {i.name} <ExternalLink aria-hidden className="size-3.5" /><span className="sr-only">(opens in a new tab)</span>
                    </a>
                    <span className="block text-sm text-muted-foreground">{i.what}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <Panel as="section" tab="Honest limitations" tabId="how-limits" aria-labelledby="how-limits" tone="charcoal">
        <ul className="max-w-[72ch] list-disc space-y-2.5 pl-5 text-[1rem] leading-relaxed">
          <li>Reports can be wrong. Open the sources before you rely on anything.</li>
          <li>Graveyard matching is currently <span className="font-semibold">word overlap</span>: two ideas worded alike match even if the businesses differ, and a real lookalike worded differently can be missed.</li>
          <li>The graveyard is small ({SEED.length} startups) and {verified === 0 ? "none" : `only ${verified}`} of its closure sources {verified === 1 ? "has" : "have"} been checked by the team so far.</li>
          <li>Market size: SAM and SOM are estimates built on assumptions. They are listed so you can disagree with them.</li>
          <li>The score is a summary of what was found, built on simple formulas and provisional weights. Read the breakdown before trusting the number.</li>
          <li>Legal output, SAM and SOM are not produced yet. In mock mode, competitors, Big Tech risk, market and legal show sample placeholders, clearly marked, and so do the scores built on them.</li>
          <li>On the live server the steps run together, so the progress screen can&apos;t show each one as it happens.</li>
        </ul>
      </Panel>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" variant="lime" onClick={() => navigate(PATHS.screen)} data-control="how_try_it">Screen an idea</Button>
        {onReplay && <Button size="lg" variant="outline-page" onClick={onReplay} data-control="how_replay_walkthrough">Replay the walkthrough</Button>}
      </div>
    </div>
  );
}

function Axis({ name, weight, children }: { name: string; weight: number; children: ReactNode }) {
  return (
    <li className="rounded-card bg-card p-5">
      <p className="flex items-baseline justify-between gap-3"><span className="font-semibold">{name}</span><span className="font-mono text-sm text-muted-foreground">weight {weight}</span></p>
      <p className="mt-2 text-[0.9375rem] leading-relaxed">{children}</p>
    </li>
  );
}

function Rule({ children }: { children: ReactNode }) {
  return <li className="rounded-card bg-card p-4 md:p-5">{children}</li>;
}

// Thin-outline isometric stack (design brief P9): the idea at the bottom, each step a layer on top.
function StackDiagram() {
  const layers = [
    { label: "Objections", fill: "var(--lime)" },
    { label: "Graveyard leads", fill: "var(--card)" },
    { label: "Sources", fill: "var(--muted)" },
    { label: "Claims", fill: "var(--lime)" },
  ];
  const slab = (y: number, fill: string, key: string) => (
    <g key={key} transform={`translate(0 ${y})`}>
      <path d="M10 40 L90 0 L170 40 L90 80 Z" fill={fill} stroke="var(--foreground)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 40 L10 52 L90 92 L170 52 L170 40 L90 80 Z" fill={fill} stroke="var(--foreground)" strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  );
  return (
    <figure className="mx-auto w-full max-w-[17rem]">
      <svg viewBox="0 0 180 300" role="img" aria-labelledby="stack-cap" className="w-full">
        {[...layers].reverse().map((l, i) => slab(150 - i * 46, l.fill, l.label))}
        <g transform="translate(0 196)">
          {[[40, 60], [90, 72], [130, 58]].map(([x, y]) => (
            <path key={x} d={`M${x} ${y} l14 -7 l14 7 l-14 7 Z M${x} ${y} v12 l14 7 v-12 M${x + 28} ${y} v12 l-14 7`} fill="var(--background)" stroke="var(--foreground)" strokeWidth="1.5" strokeLinejoin="round" />
          ))}
        </g>
      </svg>
      <figcaption id="stack-cap" className="mt-3 space-y-1.5">
        {[...layers.map(l => ({ ...l })), { label: "Your idea", fill: "var(--background)" }].map(l => (
          <span key={l.label} className="flex items-center gap-2.5">
            <span aria-hidden className="size-4 rounded-[4px] border border-foreground" style={{ background: l.fill }} />
            <span className="eyebrow">{l.label}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
