export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        role="presentation"
      >
        <rect width="32" height="32" rx="9" fill="var(--color-brand-700)" />
        <path
          d="M9 21.5c2.2-5.2 4.1-8.4 5.7-9.6 1.6-1.2 2.8-.5 3.5 2 .5 1.8 1 2.7 1.5 2.7.6 0 1.4-1.1 2.3-3.4"
          stroke="white"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-lg font-semibold tracking-tight text-ink-900">PhysioPilot</span>
    </span>
  );
}
