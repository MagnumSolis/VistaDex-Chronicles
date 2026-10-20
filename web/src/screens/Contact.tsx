// ── Contact us — who we are, how to reach us, data requests, source code ──
import type { ReactNode } from "react";
import { ExternalLink, FolderGit2, Mail, MessageSquareText, ShieldCheck, Users } from "lucide-react";
import { PageTitle } from "@/components/ui-vd";
import { features } from "@/edition";
import { studyConfig } from "@/proto";
import { href, PATHS } from "@/router";

// The repository is public (checked 2026-10-20).
export const REPO_URL = "https://github.com/MagnumSolis/VistaDex-Chronicles";
const { WITHDRAWAL_CONTACT } = studyConfig;

export function Contact() {
  return (
    <div>
      <PageTitle eyebrow="Contact us" title="Talk to the team">
        VistaDex is built by a team of students at BITS Pilani. It is a prototype, and we want to hear where it breaks.
      </PageTitle>
      <ul className="grid gap-4 md:grid-cols-2">
        <Item icon={Users} title="Who we are">
          A student team at BITS Pilani working across research, retrieval, data, product and design.
        </Item>
        <Item icon={Mail} title="Email">
          <span className="font-medium">{WITHDRAWAL_CONTACT}</span>
        </Item>
        {features.feedback && (
          <Item icon={MessageSquareText} title="Feedback">
            Tell us what was useful, wrong or missing in a report. <a href={href(PATHS.feedback)} data-control="contact_feedback" className="font-medium text-link underline underline-offset-4">Give feedback</a>.
          </Item>
        )}
        <Item icon={ShieldCheck} title="Your data">
          {features.welcome ? (
            <>See what is recorded and delete your session on <a href={href(PATHS.welcome)} data-control="contact_your_data" className="font-medium text-link underline underline-offset-4">Your data &amp; privacy</a>. For any other data request, email us at the address above.</>
          ) : (
            <>This edition records nothing. For data requests, email us at the address above.</>
          )}
        </Item>
        <Item icon={FolderGit2} title="Source code">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" data-control="contact_github" className="inline-flex items-center gap-1.5 font-medium text-link underline underline-offset-4">
            github.com/MagnumSolis/VistaDex-Chronicles <ExternalLink aria-hidden className="size-3.5" /><span className="sr-only">(opens in a new tab)</span>
          </a>
        </Item>
      </ul>
    </div>
  );
}

function Item({ icon: Icon, title, children }: { icon: typeof Mail; title: string; children: ReactNode }) {
  return (
    <li className="on-light flex gap-3 rounded-card bg-background p-5 text-foreground md:p-6">
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-[0.9375rem] leading-relaxed">{children}</p>
      </div>
    </li>
  );
}
