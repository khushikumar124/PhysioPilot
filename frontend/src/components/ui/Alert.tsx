import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Tone = "info" | "success" | "warning" | "error";

const TONES: Record<Tone, { box: string; icon: IconName }> = {
  info: { box: "border-accent-line bg-accent-quiet text-text", icon: "info" },
  success: { box: "border-positive bg-positive-quiet text-text", icon: "check" },
  warning: { box: "border-caution bg-caution-quiet text-text", icon: "alert" },
  error: { box: "border-alert bg-alert-quiet text-text", icon: "alert" },
};

const ICON_TINT: Record<Tone, string> = {
  info: "text-accent",
  success: "text-positive",
  warning: "text-caution",
  error: "text-alert",
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
      className={`flex gap-2.5 rounded-card border px-4 py-3 text-sm ${TONES[tone].box}`}
    >
      <Icon name={TONES[tone].icon} className={`mt-0.5 ${ICON_TINT[tone]}`} />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5 text-muted" : ""}>{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  art,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** An illustration carries an empty state far better than a dashed box. */
  art?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {art && <div className="mb-2 text-subtle">{art}</div>}
      <p className="font-medium text-text">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
