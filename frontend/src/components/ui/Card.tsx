import type { ReactNode } from "react";

/**
 * A panel: one surface, one border, no nesting.
 *
 * The rule this replaces a lot of: content that already sits on a panel does
 * not get wrapped in another one. Inside a panel, use `PanelSection` and let
 * the divider carry the structure instead of a second border and shadow.
 */
export function Panel({
  children,
  className = "",
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  /** Removes the outer border, for panels that sit inside a bordered region. */
  flush?: boolean;
}) {
  return (
    <section
      className={`overflow-hidden bg-surface ${
        flush ? "" : "rounded-card-lg border border-line"
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="text-[0.9375rem] font-semibold text-text">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function PanelBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

/** A titled band inside a panel, separated by a rule rather than a new card. */
export function PanelSection({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && (
            <h3 className="text-xs font-semibold uppercase tracking-[0.07em] text-subtle">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
