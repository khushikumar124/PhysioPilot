import type { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "error";

const TONES: Record<Tone, string> = {
  info: "border-brand-200 bg-brand-50 text-brand-900",
  success:
    "border-[color:var(--color-positive)]/30 bg-[color:var(--color-positive-soft)] text-[color:var(--color-positive)]",
  warning:
    "border-[color:var(--color-caution)]/30 bg-[color:var(--color-caution-soft)] text-[color:var(--color-caution)]",
  error:
    "border-[color:var(--color-alert)]/30 bg-[color:var(--color-alert-soft)] text-[color:var(--color-alert)]",
};

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${TONES[tone]}`}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-0.5" : ""}>{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink-300 px-6 py-10 text-center">
      <p className="font-medium text-ink-700">{title}</p>
      {description && <p className="max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
