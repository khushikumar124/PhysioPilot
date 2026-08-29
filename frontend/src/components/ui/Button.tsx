import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-text hover:bg-accent-hover border-transparent",
  secondary: "bg-surface text-text hover:bg-surface-hover border-line-strong",
  ghost: "bg-transparent text-muted hover:bg-surface-hover hover:text-text border-transparent",
  danger: "bg-surface text-alert hover:bg-alert-quiet border-alert",
};

// `xl` is the patient-app size: large enough to hit reliably on a phone held
// at arm's length.
const SIZES: Record<Size, string> = {
  sm: "text-[0.8125rem] px-3 py-1.5 rounded-card",
  md: "text-sm px-4 py-2 rounded-card",
  lg: "text-base px-5 py-3 rounded-card",
  xl: "text-2xl px-8 py-5 rounded-card-lg font-semibold",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
