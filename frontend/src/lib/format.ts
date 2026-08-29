/** Small formatting helpers shared by both interfaces. */

import type { Trend } from "../api/types";

export function formatPercent(value: number | null | undefined, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  return `${Math.round(value)}%`;
}

export function formatDegrees(value: number | null | undefined, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  return `${Math.round(value)}°`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Today", "Yesterday", "3 days ago" - the way a clinician scans a list. */
export function relativeDay(iso: string | null | undefined): string {
  if (!iso) return "No sessions yet";
  const then = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

export const TREND_LABEL: Record<Trend, string> = {
  improving: "Improving",
  steady: "Steady",
  declining: "Declining",
  insufficient_data: "Not enough data",
};

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(fullName: string): string {
  return fullName.replace(/^Dr\.?\s+/i, "").split(" ")[0] ?? fullName;
}
