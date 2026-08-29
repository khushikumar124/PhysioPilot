import type { ReactNode } from "react";

/** A single headline number on the clinician dashboard. */
export function Stat({
  label,
  value,
  sublabel,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
  tone?: "default" | "alert";
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white px-5 py-4">
      <p className="text-sm text-ink-500">{label}</p>
      <p
        className={`mt-1 text-3xl font-semibold tabular-nums ${
          tone === "alert" ? "text-[color:var(--color-alert)]" : "text-ink-900"
        }`}
      >
        {value}
      </p>
      {sublabel && <p className="mt-0.5 text-xs text-ink-500">{sublabel}</p>}
    </div>
  );
}
