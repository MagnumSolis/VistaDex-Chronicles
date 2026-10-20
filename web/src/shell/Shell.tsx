// ── Shell.tsx — Header (floating cream bar on desktop), bottom tab bar on phones, footer ──
// What appears is decided by `features` (edition.ts); this file never checks the edition itself.
import type { ReactNode } from "react";
import { BookOpen, CircleHelp, Files, House, Mail, MessageSquareText, ScanSearch, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { features, type NavId } from "@/edition";
import { href, PATHS, type RouteName } from "@/router";
import { liveMode } from "@/proto";

const NAV: Record<NavId, { label: string; short: string; path: string; icon: LucideIcon; routes: RouteName[] }> = {
  home: { label: "Home", short: "Home", path: "/", icon: House, routes: ["home"] },
  reports: { label: "Reports", short: "Reports", path: PATHS.reports, icon: Files, routes: ["reports"] },
  screen: { label: "Screen an idea", short: "Screen", path: PATHS.screen, icon: ScanSearch, routes: ["screen", "running", "report"] },
  how: { label: "How it works", short: "How", path: PATHS.how, icon: BookOpen, routes: ["how"] },
  contact: { label: "Contact us", short: "Contact", path: PATHS.contact, icon: Mail, routes: ["contact"] },
};

export function Shell({ route, onHelp, children }: { route: RouteName; onHelp?: () => void; children: ReactNode }) {
  const active = (id: NavId) => NAV[id].routes.includes(route);
  return (
    <div className="on-page flex min-h-dvh flex-col bg-page text-on-page">
      <a href="#main" data-control="skip_to_content" onClick={e => { e.preventDefault(); document.getElementById("main")?.focus(); }}
        className="sr-only z-[60] rounded-control bg-lime px-3 py-2 text-on-lime focus:not-sr-only focus:fixed focus:left-4 focus:top-3">
        Skip to content
      </a>

      {/* Desktop: floating cream bar, inset from the page edges. */}
      <header className="sticky top-0 z-40 hidden px-6 pt-4 md:block print:hidden">
        <div className="on-light mx-auto flex max-w-6xl items-center gap-6 rounded-2xl bg-background py-3 pl-6 pr-3 text-foreground">
          <Wordmark />
          <nav aria-label="Main" className="flex items-center gap-1">
            {features.nav.map(id => (
              <a key={id} href={href(NAV[id].path)} data-control={`nav_${id}`} aria-current={active(id) ? "page" : undefined}
                className={cn("rounded-control px-3 py-2 text-[0.9375rem] font-medium transition-colors duration-150",
                  active(id) ? "bg-page text-lime" : "text-foreground hover:bg-accent")}>
                {NAV[id].label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <HeaderExtras onHelp={onHelp} />
          </div>
        </div>
      </header>

      {/* Phones: compact top bar; navigation lives in the bottom tab bar. */}
      <header className="flex items-center gap-2 px-4 pb-1 pt-3 md:hidden print:hidden">
        <Wordmark onPage />
        <div className="ml-auto flex items-center gap-1.5">
          <HeaderExtras onHelp={onHelp} compact />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-5 outline-none md:px-6 md:pt-10">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-28 text-sm text-on-page-muted md:px-6 md:pb-8 print:hidden">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-page-raised pt-5">
          <span>Prototype. Reports can be wrong; you make the decision.</span>
          <span className="font-mono text-xs">This demo is part of a BITS Pilani research study — your anonymous usage helps us study how people judge startup ideas with AI. Opt out any time via “Your data &amp; privacy”.</span>
          <span className="font-mono text-xs">{liveMode() ? "Live providers" : "Mock mode: no live evidence"}</span>
          {features.welcome && (
            <a href={href(PATHS.welcome)} data-control="footer_your_data" className="underline underline-offset-4 hover:text-on-page">Your data &amp; privacy</a>
          )}
        </div>
      </footer>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-page-raised bg-page px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden print:hidden">
        <ul className="mx-auto flex max-w-md justify-around gap-1">
          {features.nav.map(id => {
            const Icon = NAV[id].icon;
            return (
              <li key={id} className="flex-1">
                <a href={href(NAV[id].path)} data-control={`tab_${id}`} aria-current={active(id) ? "page" : undefined}
                  className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-inner text-xs font-medium transition-colors duration-150",
                    active(id) ? "bg-lime text-on-lime" : "text-on-page hover:bg-page-raised")}>
                  <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                  {NAV[id].short}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function Wordmark({ onPage = false }: { onPage?: boolean }) {
  return (
    <a href={href("/")} data-control="nav_home" className={cn("flex items-center gap-2 rounded-control font-display text-[1.6rem] font-semibold leading-none", onPage ? "text-on-page" : "text-foreground")}>
      <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-[0.6rem] bg-lime font-display text-lg font-bold text-on-lime">V</span>
      VistaDex
    </a>
  );
}

function HeaderExtras({ onHelp, compact = false }: { onHelp?: () => void; compact?: boolean }) {
  return (
    <>
      {features.badge && (
        <span data-testid="edition-badge" className={cn("rounded-control px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em]", compact ? "bg-lime text-on-lime" : "bg-page text-lime")}>
          {features.badge}
        </span>
      )}
      {features.walkthrough && onHelp && (
        <button type="button" onClick={onHelp} data-control="help_replay_walkthrough" aria-label="Replay the walkthrough"
          className={cn("inline-flex size-10 items-center justify-center rounded-control border transition-colors duration-150",
            compact ? "border-on-page/70 text-on-page hover:bg-page-raised" : "border-foreground/70 text-foreground hover:bg-accent")}>
          <CircleHelp aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
      )}
      {features.feedback && (
        <a href={href(PATHS.feedback)} data-control="header_feedback"
          className={cn("inline-flex h-10 items-center gap-2 rounded-control px-3.5 text-sm font-medium transition-colors duration-150",
            compact ? "bg-lime text-on-lime hover:bg-[color-mix(in_oklch,var(--lime),black_8%)]" : "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_18%)]")}>
          <MessageSquareText aria-hidden className="size-4" strokeWidth={1.75} /> Feedback
        </a>
      )}
    </>
  );
}
