// ── Welcome (public edition) — what VistaDex does, that it is a prototype, and what is recorded ──
// Product transparency notice, not a research consent form. Nothing is logged before the visitor picks
// one of the choices below; "Use without recording" means nothing is ever logged.
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Clock, EyeOff, FileText, Fingerprint, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/ui-vd";
import { STATUS, STATUS_ORDER, StatusTag } from "@/components/status";
import { liveMode, studyConfig } from "@/proto";
import { href, navigate, PATHS } from "@/router";
import * as telemetry from "@/telemetry";
import { takeTarget } from "@/lib/gate";

const { NOTICE, RETENTION_PERIOD, WITHDRAWAL_CONTACT } = studyConfig;

export function Welcome({ onStartWalkthrough }: { onStartWalkthrough: () => void }) {
  useSyncExternalStore(telemetry.subscribe, telemetry.getVersion);
  const answered = telemetry.noticeAnswered();
  const code = telemetry.sessionCode();
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState<string | null>(null);

  const start = () => { telemetry.acceptNotice("walkthrough"); onStartWalkthrough(); };
  const skip = () => { telemetry.acceptNotice("skip"); navigate(takeTarget()); };
  const noRecording = () => { telemetry.declineRecording(); navigate(takeTarget()); };

  async function remove() {
    setConfirming(false);
    const res = await telemetry.deleteSession();
    setDeleted(res.server.startsWith("failed")
      ? `This browser's records are deleted. Our server could not be reached (${res.server}). Please email ${WITHDRAWAL_CONTACT} with your session code ${res.session_id?.slice(0, 8).toUpperCase()} and we will delete them.`
      : "Your session is deleted, here and on our server. Nothing more is recorded.");
  }

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Interlocking blocks: the headline block and the status window share one gutter. */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] md:gap-5">
        <section aria-labelledby="welcome-title" className="rounded-panel bg-lime p-6 text-on-lime md:p-10">
          <p className="eyebrow">Startup idea screening · Prototype</p>
          <h1 id="welcome-title" className="mt-4 font-display text-[2.6rem] leading-[1.02] md:text-[4.25rem]">
            See the evidence behind a startup idea.
          </h1>
          <p className="mt-5 max-w-[56ch] text-[1.0625rem] leading-relaxed">
            Paste an idea. VistaDex splits it into checkable claims, checks each one against independent web sources,
            finds startups that tried something similar and shut down, and lists objections. Then it gives a score you can take apart: every number shows where it came from. You decide.
          </p>
          <p className="mt-5 inline-flex rounded-control bg-page px-3 py-2 text-sm font-medium text-on-page">
            This is a prototype. Reports can be wrong, so open the sources yourself.
          </p>
        </section>

        <Panel tone="charcoal" tab="Four possible statuses" tabId="welcome-statuses" aria-labelledby="welcome-statuses" as="section">
          <ul className="space-y-3">
            {STATUS_ORDER.map(s => (
              <li key={s} className="space-y-1.5">
                <StatusTag status={s} />
                <p className="text-sm leading-relaxed text-on-charcoal-muted">{STATUS[s].help}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel as="section" tab="What we record" tabId="welcome-notice" aria-labelledby="welcome-notice">
        <ul className="grid gap-3 md:grid-cols-2">
          <NoticeItem icon={Fingerprint} title="What">{NOTICE.recorded}</NoticeItem>
          <NoticeItem icon={Clock} title="How long">Kept for {RETENTION_PERIOD}. {NOTICE.identity}</NoticeItem>
          <NoticeItem icon={FileText} title="Your idea text">{NOTICE.ideaText} {liveMode() ? NOTICE.ideaTextLive : NOTICE.ideaTextMock} {NOTICE.reportsLocal}</NoticeItem>
          <NoticeItem icon={Trash2} title="Changing your mind">
            You can delete your session at any time from “Your data &amp; privacy” at the bottom of every page. Questions or data requests: <span className="font-medium">{WITHDRAWAL_CONTACT}</span>.
          </NoticeItem>
        </ul>

        {!answered ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button size="lg" onClick={start} data-control="welcome_start_walkthrough">Start with walkthrough</Button>
            <Button size="lg" variant="outline" onClick={skip} data-control="welcome_skip">Skip to the tool</Button>
            <button type="button" onClick={noRecording} data-control="welcome_no_recording"
              className="inline-flex h-12 items-center gap-2 rounded-control px-2 text-[0.9375rem] font-medium text-link underline underline-offset-4 sm:ml-auto">
              <EyeOff aria-hidden className="size-4" /> {NOTICE.optOut}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4 rounded-card bg-muted p-5">
            <p className="text-[0.9375rem] leading-relaxed" aria-live="polite">
              {deleted ?? (code
                ? <>Recording is on for this browser, under session code <span className="font-mono font-medium">{code}</span>.</>
                : "Nothing is being recorded in this browser.")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button size="lg" onClick={() => navigate(takeTarget())} data-control="welcome_continue">Continue to the tool</Button>
              {code && <Button size="lg" variant="outline" onClick={() => setConfirming(true)} data-control="welcome_delete_session"><Trash2 aria-hidden /> Delete my session</Button>}
              {!code && (
                <Button size="lg" variant="outline" onClick={() => { setDeleted(null); telemetry.acceptNotice("skip"); }} data-control="welcome_start_recording">Turn recording on</Button>
              )}
            </div>
          </div>
        )}
        <p className="mt-5 text-sm text-muted-foreground">
          Want the details first? <a href={href(PATHS.how)} data-control="welcome_how_it_works" className="text-link underline underline-offset-4">How VistaDex works and where its data comes from</a>.
        </p>
      </Panel>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="on-light bg-background text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">Delete your session?</DialogTitle>
            <DialogDescription className="text-[0.9375rem] text-foreground">
              This deletes this browser&apos;s records and asks our server to delete everything stored under your session, including the screening logs linked to it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button size="lg" variant="outline" onClick={() => setConfirming(false)} data-control="welcome_delete_cancel">Cancel</Button>
            <Button size="lg" onClick={remove} data-control="welcome_delete_confirm">Delete my session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoticeItem({ icon: Icon, title, children }: { icon: typeof Clock; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-card bg-card p-4 md:p-5">
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-[0.9375rem] leading-relaxed">{children}</p>
      </div>
    </li>
  );
}
