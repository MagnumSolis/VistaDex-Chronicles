// ── Report — one long page: Summary · Profile · Claims · Leads to check · Objections · Big Tech risk · Legal · Market ──
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight, FileDown, MessageSquareText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { features } from "@/edition";
import { navigate, PATHS } from "@/router";
import { STATUS, STATUS_ORDER } from "@/components/status";
import { clearDraft } from "@/screens/ScreenIdea";
import { checkedLabel, type ReportEntry } from "@/lib/reports";
import type { RunMode } from "@/types";
import { ClaimCard, sourceCount } from "./ClaimCard";
import { GraveyardLeads } from "./GraveyardLeads";
import { Objections } from "./Objections";
import { LegalSection, MarketSection } from "./LegalMarket";
import { atBottom, pickActive, RATE_SECTION, ReportSection, SECTIONS, type SectionId } from "./ReportSection";
import { BigTech, Competitors, Profile, ScoreSummary } from "./ScoreParts";

const MODE_LABEL: Record<RunMode | "demo" | "sample", string> = {
  live: "Live run",
  mock: "Mock run: no live evidence",
  "proxy-mock": "Mock run on the server: no live evidence",
  demo: "Demo data, statuses not re-checked",
  sample: "Sample report: sources checked by hand, statuses and scores computed by the same code",
};
const dateLabel = (d: Date | null) => (d ? d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "No date (demo data)");

// closing: the visitor's own read of the report (ratings), shown as the last section, "Your read".
export function Report({ entry, closing }: { entry: ReportEntry; closing?: ReactNode }) {
  const { report } = entry;
  // Telemetry follows only this session's runs; demo reports are never instrumented.
  const runId = entry.runId;
  const sections = closing ? [...SECTIONS, RATE_SECTION] : SECTIONS;
  const [active, pin] = useScrollSpy(sections);
  const counts = Object.fromEntries(STATUS_ORDER.map(s => [s, report.claims.filter(c => c.status === s).length]));
  const sources = report.claims.reduce((n, c) => n + sourceCount(c.source_urls), 0);
  const [ideaOpen, setIdeaOpen] = useState(false);
  const input = report.input;
  const longIdea = input ? Boolean(input.problem || input.solution || input.moat) : report.idea_text.length > 320;

  const jump = (id: SectionId) => {
    const el = document.getElementById(`section-${id}`);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    pin(id);
    // Summary is the first section: go to the very top so the page title isn't left half under the header.
    if (id === "summary") window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    else el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    document.getElementById(`section-${id}-title`)?.focus({ preventScroll: true });
  };
  const another = () => { clearDraft(); navigate(PATHS.screen); };
  // "Leads to check" = products already doing something similar + startups that shut down (same count everywhere).
  const productCount = report.competitors?.length ?? 0;
  const leadCount = report.graveyard_matches.length + productCount;
  const countFor: Partial<Record<SectionId, number>> = { claims: report.claims.length, graveyard: leadCount, objections: report.objections.length };

  return (
    <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-8 print:block">
      {/* Jump nav: sticky rail on desktop, sticky horizontal chips on phones. */}
      <nav aria-label="Report sections" className="sticky top-0 z-30 -mx-4 mb-4 bg-page px-4 py-2.5 md:top-[var(--header-h,5.5rem)] md:-mx-6 md:px-6 lg:top-[calc(var(--header-h,5rem)+2rem)] lg:mx-0 lg:mb-0 lg:self-start lg:bg-transparent lg:p-0 print:hidden">
        <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-1 lg:overflow-visible">
          {sections.map(s => (
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
              <p className="eyebrow text-muted-foreground">{entry.kind === "demo" ? "Demo idea" : entry.kind === "sample" ? "Sample idea" : "Your idea"}</p>
              {input ? (
                <div id="report-idea" className="mt-2">
                  <p className="font-display text-[1.5rem] leading-tight">{input.title}</p>
                  <p className="mt-1 text-[1.0625rem] leading-relaxed">{input.pitch}</p>
                  <dl className={cn("mt-3 space-y-2 text-[0.9375rem] leading-relaxed", !ideaOpen && "hidden print:block")}>
                    {(["problem", "solution", "moat"] as const).filter(k => input[k]).map(k => (
                      <div key={k}><dt className="eyebrow text-muted-foreground">{k === "moat" ? "Different / moat" : k}</dt><dd>{input[k]}</dd></div>
                    ))}
                    {input.industries.length > 0 && <div><dt className="eyebrow text-muted-foreground">Industry</dt><dd>{input.industries.join(", ")}</dd></div>}
                  </dl>
                </div>
              ) : (
                <p id="report-idea" className={cn("mt-2 whitespace-pre-line text-[1.0625rem] leading-relaxed", longIdea && !ideaOpen && "line-clamp-4 print:line-clamp-none")}>{report.idea_text}</p>
              )}
              {longIdea && (
                <button type="button" onClick={() => setIdeaOpen(o => !o)} aria-expanded={ideaOpen} aria-controls="report-idea" data-control="idea_text_toggle"
                  className="mt-1 text-sm font-medium text-link underline underline-offset-4 print:hidden">
                  {ideaOpen ? "Show less" : "Show the full idea"}
                </button>
              )}
            </div>
            <dl className="grid gap-x-4 gap-y-1 text-sm">
              <div><dt className="sr-only">Date</dt><dd>{entry.checkedOn ? `Sources checked ${checkedLabel(entry.checkedOn)}` : report.generated_at ? `Evidence gathered ${dateLabel(new Date(report.generated_at))}` : dateLabel(entry.createdAt)}</dd></div>
              <div><dt className="sr-only">Mode</dt><dd className="text-muted-foreground">{MODE_LABEL[entry.mode]}</dd></div>
              {entry.markets.length > 0 && <div><dt className="sr-only">Target markets</dt><dd className="text-muted-foreground">Markets: {entry.markets.join(", ")}</dd></div>}
            </dl>
          </div>

          <div className="mt-6"><ScoreSummary scores={report.scores} band={report.overlap_band} runId={runId} /></div>

          {/* One tile per status with equal presence. */}
          <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="summary">
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
            A status needs at least two. Also in this report: <span className="font-mono text-foreground">{leadCount}</span> lead{leadCount === 1 ? "" : "s"} to check
            ({productCount} similar product{productCount === 1 ? "" : "s"}, {report.graveyard_matches.length} shut-down startup{report.graveyard_matches.length === 1 ? "" : "s"})
            and <span className="font-mono text-foreground">{report.objections.length}</span> objection{report.objections.length === 1 ? "" : "s"}. The score explains the evidence; the decision is yours.
          </p>
          <Actions onAnother={another} />
          {closing && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-inner bg-muted p-4 print:hidden">
              <p className="max-w-[52ch] text-[0.9375rem] leading-relaxed text-foreground">
                When you have read the report, give your read at the end: about two minutes, and it is what this research study measures.
              </p>
              <Button variant="outline" onClick={() => jump("rate")} data-control="report_section_jump" data-control-value="rate">
                Go to Your read <ArrowDown aria-hidden />
              </Button>
            </div>
          )}
        </ReportSection>

        <ReportSection id="profile" title="Profile" runId={runId}
          intro="The five scored axes at a glance, and how the claims came out. An axis without enough data is marked n/a and left out, never shown as zero.">
          <Profile report={report} />
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

        <ReportSection id="graveyard" title="Leads to check" count={leadCount} runId={runId}
          intro="Products already doing something similar, and startups that shut down after trying it. A resemblance is a lead to verify, not a verdict.">
          <Competitors report={report} />
          <h3 className="mb-3 font-display text-[1.375rem] leading-tight">Startups that shut down</h3>
          <GraveyardLeads matches={report.graveyard_matches} ideaText={report.idea_text} checks={entry.leadChecks} entriesChecked={report.search?.graveyard?.entries_checked} />
        </ReportSection>

        <ReportSection id="objections" title="Objections" count={report.objections.length} runId={runId}
          intro="The strongest arguments against the idea, using what was found above. Read them as carefully as the claims.">
          <Objections objections={report.objections} />
        </ReportSection>

        <ReportSection id="big_tech" title="Big Tech risk" runId={runId}
          intro="Whether a big platform company already offers or has announced something similar. Same rule as claims: a company counts with 2 independent sources.">
          <BigTech risk={report.big_tech_risk} sample={Boolean(report.sample_fields?.includes("big_tech_risk"))} />
        </ReportSection>

        <ReportSection id="legal" title="Legal" runId={runId}
          intro="Things to look up and rules that may apply in each target market. Never a judgement of whether something is allowed.">
          <LegalSection legal={report.legal} markets={entry.markets} sample={Boolean(report.sample_fields?.includes("legal"))} live={report.search?.legal} />
        </ReportSection>

        <ReportSection id="market" title="Market" runId={runId} intro="A ballpark size of the market from figures that sources state, each quoted and linked.">
          <MarketSection market={report.market} sample={Boolean(report.sample_fields?.includes("market"))} search={report.search?.market} />
        </ReportSection>

        {closing && (
          <ReportSection id="rate" title="Your read" runId={runId} className="print:hidden"
            intro="Your own read of this report, for the research study: how sure you are now, which conclusions you agree with, and how useful it was. Nothing here changes the report.">
            {closing}
          </ReportSection>
        )}

        <div className="on-light rounded-panel bg-background p-5 text-foreground md:p-8 print:hidden">
          <p className="font-display text-2xl">Done reviewing?</p>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">{entry.kind === "sample" ? "Sample reports are built in your browser from fixed research and never saved. Save this one as a PDF to keep it." : features.reportStore === "browser" ? "This report is saved in this browser only; find it again on the Reports page, or save it as a PDF." : "Reports run here are kept until this tab is closed. Save this one as a PDF to keep it."}</p>
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

// The section at the sticky offset is marked current in the jump nav (pickActive). A clicked item is
// pinned through its smooth scroll, and after it (a short last section may never reach the top),
// until the visitor scrolls again.
function useScrollSpy(list: { id: SectionId }[]): [SectionId, (id: SectionId) => void] {
  const [active, setActive] = useState<SectionId>("summary");
  const pinned = useRef<{ id: SectionId; settled: boolean; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const settle = () => {
    const p = pinned.current!;
    clearTimeout(p.timer);
    p.timer = setTimeout(() => { p.settled = true; }, 150); // no scroll event for 150ms: the jump has landed
  };
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const sections = list.map(s => ({ id: s.id, top: document.getElementById(`section-${s.id}`)?.getBoundingClientRect().top ?? Infinity }));
      setActive(pickActive(sections, offset, atBottom(window.scrollY, window.innerHeight, document.documentElement.scrollHeight)));
    };
    const onScroll = () => {
      const p = pinned.current;
      if (p && !p.settled) return settle();
      if (p) { clearTimeout(p.timer); pinned.current = null; }
      frame ||= requestAnimationFrame(update);
    };
    addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); clearTimeout(pinned.current?.timer); };
  }, [list.length]); // eslint-disable-line react-hooks/exhaustive-deps -- the list only grows by the rate section
  const pin = (id: SectionId) => {
    clearTimeout(pinned.current?.timer);
    pinned.current = { id, settled: false };
    settle();
    setActive(id);
  };
  return [active, pin];
}
