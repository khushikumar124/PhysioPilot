export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block size-5 animate-spin rounded-full border-2 border-line-strong border-t-accent ${className}`}
    />
  );
}

export function FullPageSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted">
      <Spinner className="size-8" />
      <p className="text-sm">{label}…</p>
    </div>
  );
}

/** Placeholder used while a card's contents load, to avoid layout jumps. */
export function SkeletonBlock({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-sunken ${className}`} />;
}
