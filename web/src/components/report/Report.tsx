// ── Report — one long scrolling page: Summary · Claims · Graveyard · Objections · Legal · Market ──
import { useEffect, useState } from "react";
import { ArrowRight, FileDown, MessageSquareText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { features } from "@/edition";
import { navigate, PATHS } from "@/router";
import { STATUS, STATUS_ORDER } from "@/components/status";
import { clearDraft } from "@/screens/ScreenIdea";
import type { ReportEntry } from "@/lib/reports";
import type { RunMode } from "@/types";
import { ClaimCard, sourceCount } from "./ClaimCard";
import { GraveyardLeads } from "./GraveyardLeads";
import { Objections } from "./Objections";
import { LegalSection, MarketSection } from "./LegalMarket";
import { ReportSection, SECTIONS, type SectionId } from "./ReportSection";

const MODE_LABEL: Record<RunMode | "demo", string> = {
  live: "Live run",
  mock: "Mock run: no live evidence",
  "proxy-mock": "Mock run on the server: no live evidence",
  demo: "Demo data, statuses not re-checked",
};
const dateLabel = (d: Date | null) => (d ? d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "No date (demo data)");

export function Report({ entry }: { entry: ReportEntry }) {
  const { report } = entry;
  // Telemetry follows only this session's runs; demo reports are never instrumented.
  const runId = entry.kind === "session" ? entry.id : null;
  const active = useScrollSpy();
  const counts = Object.fromEntries(STATUS_ORDER.map(s => [s, report.claims.filter(c => c.status === s).length]));
  const sources = report.claims.reduce((n, c) => n + sourceCount(c.source_urls), 0);
  const [ideaOpen, setIdeaOpen] = useState(false);
  const longIdea = report.idea_text.length > 320;

  const jump = (id: SectionId) => {
    const el = document.getElementById(`section-${id}`);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    document.getElementById(`section-${id}-title`)?.focus({ preventScroll: true });
  };
  const another = () => { clearDraft(); navigate(PATHS.screen); };
  const countFor: Partial<Record<SectionId, number>> = { claims: report.claims.length, graveyard: report.graveyard_matches.length, objections: report.objections.length };

  return (
    <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-8 print:block">
      {/* Jump nav: sticky rail on desktop, sticky horizontal chips on phones. */}
      <nav aria-label="Report sections" className="sticky top-0 z-30 -mx-4 mb-4 bg-page px-4 py-2.5 md:top-[5.5rem] md:-mx-6 md:px-6 lg:top-28 lg:mx-0 lg:mb-0 lg:self-start lg:bg-transparent lg:p-0 print:hidden">
        <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-1 lg:overflow-visible">
          {SECTIONS.map(s => (
            <li key={s.id} className="shrink-0">
              <button type="button" onClick={() => jump(s.id)} aria-current={active === s.id ? "location" : undefined}
                data-control="report_section_jump" data-control-value={s.id}
                className={cn("flex h-10 w-full items-center justify-between gap-2 rounded-control px-3.5 text-sm font-medium transition-colors duration-150",
                  active === s.id ? "bg-lime text-on-lime" : "bg-page-raised text-on-page hover:bg-[color-mix(in_oklch,var(--page-raised),white_8%)] lg:bg-transparent lg:hover:bg-page-raised")}>
                {s.label}
                {countFor[s.id] !== undefined && <span className="font-mono text-xs opacity-80">{countFor[s.id]}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-6 md:space-y-8">
        <ReportSection id="summary" title="Summary" runId={runId}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-[70ch]">
              <p className="eyebrow text-muted-foreground">{entry.kind === "demo" ? entry.title : "Your idea"}</p>
              <p id="report-idea" className={cn("mt-2 whitespace-pre-line text-[1.0625rem] leading-relaxed", longIdea && !ideaOpen && "line-clamp-4 print:line-clamp-none")}>{report.idea_text}</p>
              {longIdea && (
                <button type="button" onClick={() => setIdeaOpen(o => !o)} aria-expanded={ideaOpen} aria-controls="report-idea" data-control="idea_text_toggle"
                  className="mt-1 text-sm font-medium text-link underline underline-offset-4 print:hidden">
                  {ideaOpen ? "Show less" : "Show the full idea"}
                </button>
              )}
            </div>
            <dl className="grid shrink-0 gap-x-4 gap-y-1 text-sm sm:text-right">
              <div><dt className="sr-only">Date</dt><dd>{dateLabel(entry.createdAt)}</dd></div>
              <div><dt className="sr-only">Mode</dt><dd className="text-muted-foreground">{MODE_LABEL[entry.mode]}</dd></div>
              {entry.markets.length > 0 && <div><dt className="sr-only">Target markets</dt><dd className="text-muted-foreground">Markets: {entry.markets.join(", ")}</dd></div>}
            </dl>
          </div>

          {/* Counts, not a score: one tile per status with equal presence. */}
          <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="summary">
            {STATUS_ORDER.map(st => {
              const meta = STATUS[st];
              const Icon = meta.icon;
              return (
                <div key={st} className={cn("flex min-h-36 flex-col justify-between gap-4 rounded-card p-4 md:p-5", meta.bg)}>
                  <dd className="font-display text-[3.25rem] leading-none text-foreground">{counts[st]}</dd>
                  <dt className="flex items-center gap-2 text-[0.9375rem] font-semibold text-foreground">
                    <Icon aria-hidden className={cn("size-5 shrink-0", meta.text)} strokeWidth={2} />
                    {meta.label}
                  </dt>
                </div>
              );
            })}
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            <span className="font-mono text-foreground">{sources}</span> independent source{sources === 1 ? "" : "s"} across {report.claims.length} claim{report.claims.length === 1 ? "" : "s"}.
            A status needs at least two. Also in this report: <span className="font-mono text-foreground">{report.graveyard_matches.length}</span> lead{report.graveyard_matches.length === 1 ? "" : "s"} to check
            and <span className="font-mono text-foreground">{report.objections.length}</span> objection{report.objections.length === 1 ? "" : "s"}. There is no overall score: you decide.
          </p>
          <Actions onAnother={another} />
        </ReportSection>

        <ReportSection id="claims" title="Claims & evidence" count={report.claims.length} runId={runId}
          intro="Each claim from the idea, with its status, why it got that status and the sources behind it.">
          {report.claims.length === 0 ? (
            <p className="rounded-card bg-card p-5 text-[0.9375rem]">No checkable claims were found in the idea text. Try stating facts the idea depends on, such as who the competitors are or how big the market is.</p>
          ) : (
            <div className="space-y-4">
              {report.claims.map((c, i) => <ClaimCard key={`${entry.id}-${i}`} claim={c} index={i} runId={runId} />)}
            </div>
          )}
        </ReportSection>

        <ReportSection id="graveyard" title="Leads to check" count={report.graveyard_matches.length} runId={runId}
          intro="Startups that shut down after trying something that looks similar. A resemblance is a lead to verify, not a verdict.">
          <GraveyardLeads matches={report.graveyard_matches} ideaText={report.idea_text} />
        </ReportSection>

        <ReportSection id="objections" title="Objections" count={report.objections.length} runId={runId}
          intro="The strongest arguments against the idea, using what was found above. Read them as carefully as the claims.">
          <Objections objections={report.objections} />
        </ReportSection>

        <ReportSection id="legal" title="Legal" runId={runId}
          intro="Things to look up and rules that may apply in each target market. Never a judgement of whether something is allowed.">
          <LegalSection legal={report.legal} markets={entry.markets} />
        </ReportSection>

        <ReportSection id="market" title="Market" runId={runId} intro="A ballpark size of the market, with its source and assumptions.">
          <MarketSection market={report.market} />
        </ReportSection>

        <div className="on-light rounded-panel bg-background p-5 text-foreground md:p-8 print:hidden">
          <p className="font-display text-2xl">Done reviewing?</p>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">Save this report as a PDF before you leave{features.reportHistory ? "" : ": it is not kept after you close this tab"}.</p>
          <Actions onAnother={another} />
        </div>

        {features.feedback && (
          <div className="rounded-panel bg-lime p-6 text-on-lime md:p-8 print:hidden">
            <p className="font-display text-[2rem] leading-tight">What did you think?</p>
            <p className="mt-2 max-w-[56ch] text-[0.9375rem] leading-relaxed">Two minutes of feedback tells us what to fix: what was useful, what was wrong, what was missing.</p>
            <Button size="lg" className="mt-5" onClick={() => navigate(PATHS.feedback)} data-control="report_feedback_prompt">
              <MessageSquareText aria-hidden /> Give feedback <ArrowRight aria-hidden />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Actions({ onAnother }: { onAnother: () => void }) {
  return (
    <div className="mt-6 flex flex-wrap gap-3 print:hidden">
      <Button size="lg" variant="outline" onClick={() => window.print()} data-control="report_save_pdf"><FileDown aria-hidden /> Save as PDF</Button>
      <Button size="lg" onClick={onAnother} data-control="report_screen_another"><RotateCcw aria-hidden /> Screen another idea</Button>
    </div>
  );
}

// The section nearest the top of the viewport is marked current in the jump nav.
function useScrollSpy(): SectionId {
  const [active, setActive] = useState<SectionId>("summary");
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id.replace("section-", "") as SectionId);
    }, { rootMargin: "-20% 0px -70% 0px" });
    SECTIONS.forEach(s => { const el = document.getElementById(`section-${s.id}`); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return active;
}
