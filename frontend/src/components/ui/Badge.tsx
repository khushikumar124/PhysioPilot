import type { ReactNode } from "react";
import type { Trend } from "../../api/types";
import { TREND_LABEL } from "../../lib/format";

type Tone = "neutral" | "positive" | "caution" | "alert" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-600",
  positive: "bg-[color:var(--color-positive-soft)] text-[color:var(--color-positive)]",
  caution: "bg-[color:var(--color-caution-soft)] text-[color:var(--color-caution)]",
  alert: "bg-[color:var(--color-alert-soft)] text-[color:var(--color-alert)]",
  brand: "bg-brand-50 text-brand-800",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

const TREND_TONE: Record<Trend, Tone> = {
  improving: "positive",
  steady: "neutral",
  declining: "alert",
  insufficient_data: "neutral",
};

const TREND_ARROW: Record<Trend, string> = {
  improving: "↑",
  steady: "→",
  declining: "↓",
  insufficient_data: "",
};

export function TrendBadge({ trend }: { trend: Trend }) {
  return (
    <Badge tone={TREND_TONE[trend]}>
      {TREND_ARROW[trend] && <span aria-hidden="true">{TREND_ARROW[trend]}</span>}
      {TREND_LABEL[trend]}
    </Badge>
  );
}
