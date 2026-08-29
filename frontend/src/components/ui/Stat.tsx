import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * The dashboard's headline numbers, as one divided strip rather than a row of
 * floating cards. Four separate boxes on a near-white page reads as filler;
 * one panel with rules between the figures reads as an instrument panel, and
 * makes the numbers easier to compare because they share a baseline.
 */
export function MetricStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 divide-line overflow-hidden rounded-card-lg border border-line bg-surface sm:grid-cols-4 sm:divide-x">
      {children}
    </div>
  );
}

export function Metric({
  label,
  value,
  sublabel,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
  icon?: IconName;
  tone?: "default" | "alert";
}) {
  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0 sm:border-b-0">
      <div className="flex items-center gap-1.5 text-muted">
        {icon && <Icon name={icon} size="0.95rem" />}
        <p className="text-xs font-medium uppercase tracking-[0.06em]">{label}</p>
      </div>
      <p
        className={`tnum mt-1.5 text-[1.75rem] font-semibold leading-none ${
          tone === "alert" ? "text-alert" : "text-text"
        }`}
      >
        {value}
      </p>
      {sublabel && <p className="mt-1.5 text-xs text-subtle">{sublabel}</p>}
    </div>
  );
}
