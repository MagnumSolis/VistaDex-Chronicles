// ── Home — the landing page (rebuilt from the team's Figma draft, sections renumbered after removals) ──
// Readable without the Welcome notice and not recorded until the visitor has answered it. The product
// screens are the real components rendered with sample data, scaled down and inert, so they always
// match the app. The hero card shows the first claim of a researched sample report, with what the pipeline's
// own code derives from its hand-checked sources: no invented report numbers or companies.
import { useMemo, type ReactNode } from "react";
import { ArrowRight, ClipboardList, GitMerge, History, Layers, Lightbulb, ScanSearch, ShieldCheck, ThumbsUp, Unlink, Rocket, Briefcase, GraduationCap, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/status";
import { Report } from "@/components/report/Report";
import { features } from "@/edition";
import { studyConfig } from "@/proto";
import { navigate, PATHS } from "@/router";
import { SAMPLES } from "@/lib/samples";
import { checkedLabel, makeDemoEntries, sampleEntries } from "@/lib/reports";
import { ScreenIdea } from "@/screens/ScreenIdea";
import { Reports } from "@/screens/Reports";

const { NOTICE, RETENTION_PERIOD } = studyConfig;
// The hero card is the first claim of a researched sample report (prototype/data/sample-reports.js): real pages,
// read by hand, with the status, source count and leads computed by the pipeline's own code.
const HERO_SAMPLE = "sample-meeting-notes";

export function Home() {
  const demo = useMemo(() => makeDemoEntries(), []);
  return (
    <div className="space-y-5 md:space-y-6">
      {/* Hero */}
      <section aria-labelledby="home-title" className="grid items-center gap-8 py-4 md:py-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div>
          <p className="eyebrow text-on-page-muted">Evidence before judgement</p>
          <h1 id="home-title" className="mt-4 font-display text-[2.9rem] leading-[0.98] text-on-page md:text-[4.75rem]">
            Find out if your idea <span className="text-lime">already died once.</span>
          </h1>
          <p className="mt-6 max-w-[52ch] text-[1.0625rem] leading-relaxed text-on-page-muted">
            VistaDex checks each claim in a startup idea against independent sources and startups that already failed, then gives a score you can take apart.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" variant="lime" onClick={() => navigate(PATHS.screen)} data-control="home_try_demo">Try the demo <ArrowRight aria-hidden /></Button>
            <Button size="lg" variant="outline-page" onClick={() => navigate(PATHS.how)} data-control="home_how_it_works">See how it works</Button>
          </div>
        </div>
        <HeroCard />
      </section>

      {/* 01 The problem */}
      <Band n="01" label="The problem" title="Confidence is not the same as evidence."
        lead="Founders, students, and accelerator applicants increasingly use AI to generate and judge ideas. Its novelty judgements can be confident, opaque, and wrong.">
        <div className="mt-8 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ol className="grid gap-3 sm:grid-cols-2">
            {([
              ["Mode collapse", GitMerge, "Ideas look novel one by one, but cluster around a few underlying concepts."],
              ["Sycophancy", ThumbsUp, "Models tend to over-affirm the idea the user already wants to believe."],
              ["Untrustworthy citations", Unlink, "Research agents can return broken, irrelevant, or fabricated sources."],
              ["No memory of what died", History, "A past attempt is a strong signal, yet few review workflows look for one."],
            ] as const).map(([t, icon, d], i) => <NumberedCard key={t} n={i + 1} icon={icon} title={t}>{d}</NumberedCard>)}
          </ol>
          <figure className="flex flex-col justify-between rounded-card bg-lime p-6 text-on-lime">
            <blockquote className="font-display text-[1.75rem] leading-tight md:text-[2rem]">
              <span aria-hidden className="block text-5xl leading-none">“</span>
              We hit this ourselves — six AI-proposed “novel” ideas, every one already had funded competitors.
            </blockquote>
            <figcaption className="mt-6 border-t border-on-lime/40 pt-4 text-sm">That failure became the starting point for VistaDex.</figcaption>
          </figure>
        </div>
      </Band>

      {/* 02 What's in a report */}
      <Band n="02" label="What's in a report" title="A research trail, not a magic answer."
        lead="Every output is designed to be checked, challenged, and read without relying on colour alone.">
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ReportCard n={1} tag="Score" title="A score you can take apart">The VistaDex Score with every axis, input and weight one tap away. Axes without enough data are left out, never guessed.</ReportCard>
          <ReportCard n={2} tag="Status" title="Four explicit states" statuses>Confirmed, Contradicted, Disputed, and Unverified — always shown with a label and icon.</ReportCard>
          <ReportCard n={3} tag="Evidence" title="Evidence, claim by claim">Linked sources, the quote from each page, and an independent-source count sit beside every claim.</ReportCard>
          <ReportCard n={4} tag="Profile" title="The idea's profile">Novelty, market, defensibility, graveyard distance and evidence quality on one chart, with every claim's outcome.</ReportCard>
          <ReportCard n={5} tag="Precedent" title="Leads to check">Products already doing something similar, and failed startups with funding and cause of death, framed only as “Leads to check”.</ReportCard>
          <ReportCard n={6} tag="Objections" title="Objections at equal weight">Counterarguments appear beside supporting evidence, not hidden at the end.</ReportCard>
          <ReportCard n={7} tag="Big Tech" title="Big Tech risk">Whether a big platform already offers something similar. Fewer than two independent sources and it stays unverified.</ReportCard>
          <ReportCard n={8} tag="Legal & market" title="Facts, not verdicts">Official registries and named rules for the EU, USA, and India — never “allowed” or “not allowed”. TAM with its source; SAM and SOM marked as estimates.</ReportCard>
        </ul>
      </Band>

      {/* 03 Product screens */}
      <section aria-labelledby="home-screens" className="rounded-panel bg-page-raised p-5 md:p-10">
        <SectionHead n="03" label="Product screens" id="home-screens" title="One workflow. Three views." onPage />
        <ol className="mt-8 space-y-8">
          <Shot n="01" label="Input" title="Describe the idea, field by field." text="Title, pitch, problem, solution and moat; industry, role and target markets. Load a sample to try it."
            alt="The Screen an idea form, filled in with the legal contract review sample.">
            <ScreenIdea preview={SAMPLES[1].input} />
          </Shot>
          <Shot n="02" label="Report" title="See the evidence behind the score." text="The score and its breakdown, the profile, every claim with its sources, leads to check, objections and Big Tech risk."
            alt="A report for a demo idea: the VistaDex Score, overlap band and claim counts.">
            <Report entry={demo[0]} />
          </Shot>
          <Shot n="03" label="Reports" title="Return to every idea you have screened." text="Sort by score, novelty, newest or least risky; filter by status, overlap, industry and role."
            alt="The Reports page with summary charts and a list of demo ideas.">
            <Reports preview={demo.slice(0, 4)} />
          </Shot>
        </ol>
      </section>

      {/* 04 Who it's for */}
      <Band n="04" label="Who it's for" title="A better first pass for people making real decisions.">
        <ul className="mt-8 grid gap-3 md:grid-cols-3">
          {([
            ["Founders", Rocket, "Stress-test an idea before investing months in building."],
            ["VCs and angels", Briefcase, "Run faster first-pass competitor and overlap checks."],
            ["Accelerators & universities", GraduationCap, "Batch-screen applications with a consistent research trail."],
          ] as const).map(([t, icon, d], i) => <NumberedCard key={t} n={i + 1} icon={icon} title={t}>{d}</NumberedCard>)}
        </ul>
      </Band>

      {/* 05 Try the prototype */}
      <section aria-labelledby="home-try" className="grid gap-6 rounded-panel bg-page-raised p-5 md:p-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <SectionHead n="05" label="Try the prototype" id="home-try" title="Take the guided path. Tell us where it breaks." onPage />
          <p className="mt-4 max-w-[52ch] text-[1.0625rem] leading-relaxed text-on-page-muted">The demo walks through a sample screen, then asks for short, practical feedback at the end.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" variant="lime" onClick={() => navigate(PATHS.screen)} data-control="home_start_demo">Start the demo <ArrowRight aria-hidden /></Button>
            {features.feedback && <Button size="lg" variant="outline-page" onClick={() => navigate(PATHS.feedback)} data-control="home_feedback">Give feedback</Button>}
          </div>
        </div>
        <aside aria-labelledby="home-note" className="on-light rounded-card bg-background p-6 text-foreground md:p-8">
          <div className="flex items-start justify-between gap-3">
            <p className="eyebrow text-muted-foreground">Transparency note</p>
            <ShieldCheck aria-hidden className="size-5" strokeWidth={1.75} />
          </div>
          <h3 id="home-note" className="mt-4 font-display text-[1.75rem] leading-tight">What the demo records</h3>
          {/* Same wording as the Welcome notice (prototype/ui/study-config.js NOTICE). */}
          <p className="mt-3 text-[0.9375rem] leading-relaxed">{NOTICE.recorded} Kept for {RETENTION_PERIOD}. {NOTICE.identity}</p>
          <div className="mt-4 rounded-inner bg-muted p-4 text-[0.9375rem] leading-relaxed">
            <p className="font-semibold">Before pasting an idea</p>
            <p className="mt-1">{NOTICE.ideaText} {NOTICE.reportsLocal} Do not enter confidential or commercially sensitive information into this prototype.</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Nothing is recorded until you answer the notice on your first visit, and “{NOTICE.optOut}” records nothing at all.</p>
        </aside>
      </section>

      {/* 06 The team */}
      <Band n="06" label="The team" title="Built by students at BITS Pilani." lead="An early-stage team working across research, retrieval, data, product, and design.">
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["AP", "Aditya Pradhan", "Lead — architecture, backend & deployment"],
            ["KA", "Kushagra Agnihotri", "LLM & retrieval (RAG)"],
            ["LT", "Lakshit Tanwar", "UI/UX"],
            ["RM", "Richeek Mishra", "Outreach"],
          ].map(([ini, name, role], i) => (
            <li key={name} className="rounded-card bg-card p-3">
              <div aria-hidden className="relative flex aspect-[5/4] items-center rounded-inner bg-lime px-5 text-on-lime">
                <span className="absolute right-4 top-3 font-mono text-xs">0{i + 1}</span>
                <span className="font-display text-[3.5rem] leading-none">{ini}</span>
              </div>
              <p className="mt-4 px-1 font-display text-[1.375rem] leading-tight">{name}</p>
              <p className="mt-1 px-1 pb-2 text-sm text-muted-foreground">{role}</p>
            </li>
          ))}
        </ul>
      </Band>
    </div>
  );
}

function HeroCard() {
  const entry = useMemo(() => sampleEntries().find(e => e.id === HERO_SAMPLE) ?? sampleEntries()[0], []);
  const r = entry.report;
  const claim = r.claims[0];
  const sources = new Set(claim.source_urls.map(u => { try { return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, ""); } catch { return u; } })).size;
  const products = r.competitors ?? [];
  return (
    <div className="relative pb-28">
    <figure aria-label="A sample report card" className="on-light relative rounded-card bg-background text-foreground lg:rotate-[1.5deg]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-t-card bg-charcoal px-5 py-3 text-on-charcoal">
        <span className="eyebrow">VistaDex / Sample report</span>
        <span className="eyebrow text-lime">Checked {checkedLabel(entry.checkedOn ?? "")}</span>
      </div>
      <div className="p-5">
        <p className="eyebrow text-muted-foreground">Idea claim · {r.input?.title}</p>
        <p className="mt-2 font-display text-[1.6rem] leading-tight md:text-[1.9rem]">“{claim.claim}”</p>
      </div>
      <div className="grid border-t min-[360px]:grid-cols-[1fr_auto]">
        <div className="p-5">
          <p className="eyebrow text-muted-foreground">Evidence status</p>
          <StatusTag status={claim.status} className="mt-2" />
        </div>
        <div className="border-t p-5 min-[360px]:border-l min-[360px]:border-t-0">
          <p className="eyebrow text-muted-foreground">Independent sources</p>
          <p className="mt-1 font-display text-[2rem] leading-none">{sources}</p>
        </div>
      </div>
      <div className="m-3 mt-0 rounded-inner bg-page p-4 text-on-page">
        <p className="eyebrow text-on-page-muted">Leads to check</p>
        <p className="mt-1 text-[0.9375rem]">
          {products.length ? `${products.length} similar product${products.length === 1 ? "" : "s"} named on a source page: ${products.map(c => c.name).join(", ")}.` : "No similar product named on the pages read."}
          {r.graveyard_matches.length ? ` ${r.graveyard_matches.length} shut-down startup${r.graveyard_matches.length === 1 ? "" : "s"} worded alike.` : ""}
        </p>
      </div>
      <figcaption className="sr-only">A researched sample report: the claim "{claim.claim}" is {claim.status}, with {sources} independent sources, read by hand on {checkedLabel(entry.checkedOn ?? "")}.</figcaption>
    </figure>
    <p className="absolute bottom-0 right-3 w-48 rotate-[3deg] rounded-inner bg-lime p-4 font-display text-[1.25rem] leading-tight text-on-lime">A score you can take apart. You decide.</p>
    </div>
  );
}

function SectionHead({ n, label, title, id, onPage = false }: { n: string; label: string; title: string; id: string; onPage?: boolean }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <p className={`eyebrow ${onPage ? "text-on-page-muted" : "text-muted-foreground"}`}><span className="font-mono">{n}</span>&nbsp;&nbsp;{label}</p>
      <h2 id={id} className={`font-display text-[2.4rem] leading-[1.02] md:text-[3.5rem] ${onPage ? "text-on-page" : ""}`}>{title}</h2>
    </div>
  );
}

function Band({ n, label, title, lead, children }: { n: string; label: string; title: string; lead?: string; children?: ReactNode }) {
  const id = `home-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="on-light rounded-panel bg-background p-5 text-foreground md:p-10">
      <SectionHead n={n} label={label} title={title} id={id} />
      {lead && <p className="mt-4 max-w-[60ch] text-[1.0625rem] leading-relaxed text-muted-foreground lg:ml-[15rem]">{lead}</p>}
      {children}
    </section>
  );
}

// A problem card: a line icon on a nested tile and the number on one row, then the title and text right
// under them (no empty band between the number and the title).
function NumberedCard({ n, icon: Icon, title, children }: { n: number; icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-4 rounded-card border border-border-strong bg-card p-5">
      <div className="flex items-start justify-between">
        <span aria-hidden className="grid size-11 place-items-center rounded-inner bg-muted text-foreground"><Icon className="size-5" strokeWidth={1.75} /></span>
        <span className="font-mono text-sm text-muted-foreground">0{n}</span>
      </div>
      <div>
        <p className="font-display text-[1.6rem] leading-tight">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

const TAG_ICON = { Score: Lightbulb, Status: ClipboardList, Evidence: ScanSearch, Profile: Layers } as const;
function ReportCard({ n, tag, title, statuses = false, children }: { n: number; tag: string; title: string; statuses?: boolean; children: ReactNode }) {
  const Icon = TAG_ICON[tag as keyof typeof TAG_ICON];
  return (
    <li className="flex flex-col gap-5 rounded-card border border-border-strong bg-card p-5">
      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground"><span>0{n}</span><span className="eyebrow">{tag}</span></div>
      <div aria-hidden className="rounded-inner bg-muted p-4">
        {statuses ? (
          <div className="flex flex-wrap gap-1.5">{(["confirmed", "contradicted", "disputed", "unverified"] as const).map(s => <StatusTag key={s} status={s} className="px-2 text-xs" />)}</div>
        ) : (
          <div className="space-y-2">
            {Icon && <Icon className="mb-1 size-5" strokeWidth={1.75} />}
            <div className="h-2.5 w-4/5 rounded-full bg-page" /><div className="h-2 w-3/5 rounded-full bg-border-strong" /><div className="h-2 w-2/3 rounded-full bg-border-strong" />
          </div>
        )}
      </div>
      <div className="mt-auto">
        <p className="font-display text-[1.4rem] leading-tight">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

// A real screen of the app, scaled to half size and inert (not focusable, not announced); the text beside
// it says what it shows.
function Shot({ n, label, title, text, alt, children }: { n: string; label: string; title: string; text: string; alt: string; children: ReactNode }) {
  return (
    <li className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
      <div>
        <p className="eyebrow text-lime"><span className="font-mono">{n}</span> / {label}</p>
        <p className="mt-2 font-display text-[1.75rem] leading-tight text-on-page">{title}</p>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-on-page-muted">{text}</p>
      </div>
      <figure className="min-w-0">
        <div className="relative h-[22rem] overflow-hidden rounded-card bg-page md:h-[26rem]">
          <div inert className="pointer-events-none absolute left-0 top-0 w-[200%] origin-top-left scale-50 select-none p-6">{children}</div>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-page to-transparent" />
        </div>
        <figcaption className="sr-only">{alt}</figcaption>
      </figure>
    </li>
  );
}
