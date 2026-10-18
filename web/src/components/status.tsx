import { CircleCheck, CircleDashed, CircleX, Scale, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClaimStatus, ClaimType, Severity } from "@/types";

// Each status has a text label AND a distinct icon, so it reads without colour.
export const STATUS: Record<ClaimStatus, { label: string; icon: LucideIcon; text: string; bg: string; rule: string; help: string }> = {
  confirmed: {
    label: "Confirmed", icon: CircleCheck,
    text: "text-st-confirmed", bg: "bg-st-confirmed-bg", rule: "border-st-confirmed-rule",
    help: "At least 2 independent sources support this claim and none contradict it.",
  },
  contradicted: {
    label: "Contradicted", icon: CircleX,
    text: "text-st-contradicted", bg: "bg-st-contradicted-bg", rule: "border-st-contradicted-rule",
    help: "At least 2 independent sources contradict this claim and none support it.",
  },
  disputed: {
    label: "Disputed", icon: Scale,
    text: "text-st-disputed", bg: "bg-st-disputed-bg", rule: "border-st-disputed-rule",
    help: "Independent sources point both ways.",
  },
  unverified: {
    label: "Unverified", icon: CircleDashed,
    text: "text-st-unverified", bg: "bg-st-unverified-bg", rule: "border-st-unverified-rule",
    help: "Not enough independent evidence either way. This is a normal outcome, not an error.",
  },
};

export const STATUS_ORDER: ClaimStatus[] = ["contradicted", "disputed", "confirmed", "unverified"];

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  novelty: "Novelty",
  market_size: "Market size",
  defensibility: "Defensibility",
  other: "Other",
};

export function StatusTag({ status, className }: { status: ClaimStatus; className?: string }) {
  const s = STATUS[status] ?? STATUS.unverified;
  const Icon = s.icon;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[0.8125rem] font-medium leading-5", s.text, s.bg, s.rule, className)}
      title={s.help}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
      {s.label}
    </span>
  );
}

// Severity is shown as a word plus a 3-step bar (filled count = severity), not colour alone.
const SEVERITY: Record<Severity, { label: string; level: number; text: string }> = {
  high: { label: "High", level: 3, text: "text-sev-high" },
  medium: { label: "Medium", level: 2, text: "text-sev-medium" },
  low: { label: "Low", level: 1, text: "text-sev-low" },
};

export function SeverityTag({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity] ?? SEVERITY.low;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", s.text)}>
      <span aria-hidden className="inline-flex items-end gap-px">
        {[1, 2, 3].map(n => (
          <span key={n} className={cn("w-1 rounded-[1px]", n <= s.level ? "bg-current" : "bg-border-strong")} style={{ height: 4 + n * 3 }} />
        ))}
      </span>
      {s.label}
      <span className="sr-only"> severity</span>
    </span>
  );
}
