// ── Report route ──
// Public: #/report shows the run the visitor just made (memory only; gone after a reload; no history).
// Pitch: #/report/<id> shows any session run or demo cohort idea.
import { useEffect } from "react";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageTitle } from "@/components/ui-vd";
import { Report } from "@/components/report/Report";
import { features } from "@/edition";
import { findEntry, latestSessionReport, useSessionReports } from "@/lib/reports";
import { navigate, PATHS } from "@/router";

export function ReportScreen({ param }: { param: string | null }) {
  useSessionReports();
  const entry = features.reportHistory ? (param ? findEntry(param) : latestSessionReport()) : (param ? null : latestSessionReport());

  useEffect(() => {
    if (!features.reportHistory && param) navigate(PATHS.report, { replace: true }); // no shareable report URLs
  }, [param]);

  if (!entry) {
    return (
      <div>
        <PageTitle eyebrow="Report" title="No report to show" />
        <div className="on-light max-w-xl text-foreground">
          <EmptyState icon={FileSearch} title={features.reportHistory ? "That report isn't here." : "You haven't screened an idea in this tab yet."}
            action={<Button size="lg" onClick={() => navigate(features.dashboard ? PATHS.dashboard : PATHS.screen)} data-control="report_empty_screen">{features.dashboard ? "Back to the dashboard" : "Screen an idea"}</Button>}>
            {features.reportHistory
              ? "Reports run in this session are listed on the dashboard until the tab is closed, next to the demo ideas."
              : "Reports are kept only while this tab is open, and are not saved anywhere. Save one as a PDF to keep it."}
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle eyebrow={entry.kind === "demo" ? `Demo idea · ${entry.category ?? ""}` : "Screening report"} title={entry.kind === "demo" ? entry.title : "Your report"}>
        The evidence, the leads and the objections. VistaDex gives no score or verdict; the decision is yours.
      </PageTitle>
      <Report key={entry.id} entry={entry} />
    </div>
  );
}
