import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "./Logo";
import { Button } from "./ui/Button";
import { Icon, type IconName } from "./ui/Icon";
import { ThemeToggle } from "./ui/ThemeToggle";

/**
 * The patient shell: three destinations, large targets, no jargon. Navigation
 * sits at the bottom of the screen where a thumb reaches it.
 *
 * The tab icons are drawn rather than emoji - emoji render as a different
 * picture on every device, and a cartoon house is not the register this app
 * should speak in.
 *
 * Signing out lives in the top bar, in the same place on every tab. It used to
 * sit at the foot of the Today screen only, below every exercise, which meant
 * it did not exist at all on Progress or Help.
 */

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: "/today", label: "Today", icon: "today" },
  { to: "/progress", label: "Progress", icon: "progress" },
  { to: "/help", label: "Help", icon: "assistant" },
];

export function PatientLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-1 rounded-card px-2 py-2 text-[0.9375rem] font-medium transition-colors ${
      isActive ? "bg-accent-quiet text-accent" : "text-muted"
    }`;

  return (
    <div className="patient-scale flex min-h-screen flex-col bg-app">
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-2.5">
          <Logo size={26} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex items-center gap-1.5 rounded-card border border-line px-3 py-2 text-[0.9375rem] font-medium text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <Icon name="sign-out" size="1.1rem" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-6">
        <Outlet />
      </main>

      {/* Many of these patients did not choose their own password - their
          physiotherapist created the account. Signing out by accident is a
          real way to lock someone out of their own routine, so it asks. */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-title"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-card-lg border border-line bg-surface p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="signout-title" className="text-xl font-semibold text-text">
              Sign out?
            </h2>
            <p className="mt-2 text-muted">
              You will need your email and password to get back in. If you do not
              know them, ask your physiotherapist first.
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <Button
                size="lg"
                variant="secondary"
                className="w-full"
                onClick={() => setConfirming(false)}
                autoFocus
              >
                Stay signed in
              </Button>
              <Button
                size="lg"
                variant="danger"
                className="w-full"
                onClick={() => {
                  signOut();
                  navigate("/login", { replace: true });
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 border-t border-line bg-surface px-3 pb-[env(safe-area-inset-bottom)] pt-2"
      >
        <div className="mx-auto flex max-w-xl items-stretch gap-2">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} className={linkClass}>
              <Icon name={tab.icon} size="1.6rem" strokeWidth={1.5} />
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
