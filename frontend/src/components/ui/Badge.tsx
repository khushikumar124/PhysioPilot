import type { ReactNode } from "react";
import type { Trend } from "../../api/types";
import { TREND_LABEL } from "../../lib/format";
import { Icon, type IconName } from "./Icon";

type Tone = "neutral" | "positive" | "caution" | "alert" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "border-line bg-surface-sunken text-muted",
  positive: "border-positive bg-positive-quiet text-positive",
  caution: "border-caution bg-caution-quiet text-caution",
  alert: "border-alert bg-alert-quiet text-alert",
  brand: "border-accent-line bg-accent-quiet text-accent",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
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

const TREND_ICON: Record<Trend, IconName | null> = {
  improving: "arrow-up",
  steady: "arrow-right",
  declining: "arrow-down",
  insufficient_data: null,
};

export function TrendBadge({ trend }: { trend: Trend }) {
  const icon = TREND_ICON[trend];
  return (
    <Badge tone={TREND_TONE[trend]}>
      {icon && <Icon name={icon} size="0.85em" strokeWidth={2.2} />}
      {TREND_LABEL[trend]}
    </Badge>
  );
}
