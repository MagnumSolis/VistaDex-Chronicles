// ── Report route ──
// #/report/<id> shows a report from the Reports page (public: saved in this browser; pitch: session runs
// and the demo cohort). #/report alone shows the latest one.
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageTitle } from "@/components/ui-vd";
import { Report } from "@/components/report/Report";
import { ReportStudyPanel } from "@/study/ReportStudyPanel";
import { features } from "@/edition";
import { findEntry, latestSessionReport, useSessionReports } from "@/lib/reports";
import { navigate, PATHS } from "@/router";

export function ReportScreen({ param }: { param: string | null }) {
  useSessionReports();
  const entry = param ? findEntry(param) : latestSessionReport();

  if (!entry) {
    return (
      <div>
        <PageTitle eyebrow="Report" title="No report to show" />
        <div className="on-light max-w-xl text-foreground">
          <EmptyState icon={FileSearch} title={param ? "That report isn't here." : "You haven't screened an idea yet."}
            action={<Button size="lg" onClick={() => navigate(PATHS.reports)} data-control="report_empty_screen">Go to Reports</Button>}>
            {features.reportStore === "browser"
              ? "Reports are saved in the browser that ran them, so a report link only works there. The Reports page lists the ones saved here."
              : "Reports run in this session are listed on the Reports page until the tab is closed, next to the demo ideas."}
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle eyebrow={entry.kind === "demo" ? `Demo idea · ${entry.category ?? ""}` : entry.kind === "sample" ? `Sample report · ${entry.report.input?.industries.join(", ") ?? ""}` : "Screening report"} title={entry.kind === "session" ? "Your report" : entry.title}>
        The score, the evidence behind it, the leads and the objections. Every number can be taken apart; the decision is yours.
      </PageTitle>
      <Report key={entry.id} entry={entry} />
      {entry.kind === "session" && entry.report && entry.runId && (
        <div className="mt-4 md:mt-5">
          <ReportStudyPanel report={entry.report} runId={entry.runId} condition="vistadex" />
        </div>
      )}
    </div>
  );
}
