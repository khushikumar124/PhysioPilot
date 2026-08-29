import { useTheme } from "../../theme/ThemeContext";
import { Icon } from "./Icon";

/** Switches between light and dark. Sized up on patient screens. */
export function ThemeToggle({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { resolved, toggle } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  const large = size === "lg";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`inline-flex items-center justify-center rounded-card border border-line text-muted transition-colors hover:bg-surface-hover hover:text-text ${
        large ? "h-12 w-12 text-xl" : "h-9 w-9 text-base"
      }`}
    >
      <Icon name={resolved === "dark" ? "sun" : "moon"} />
    </button>
  );
}
