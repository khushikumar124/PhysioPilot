import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "./Logo";
import { Icon, type IconName } from "./ui/Icon";
import { ThemeToggle } from "./ui/ThemeToggle";

/**
 * The clinician shell.
 *
 * A persistent left rail, the shape clinical software actually takes: the
 * navigation stays put, the work fills the rest, and the identity of who is
 * signed in is always visible - it matters when several staff share a machine.
 */

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/clinic", label: "Patients", icon: "users", end: true },
  { to: "/clinic/patients/new", label: "Add patient", icon: "plus" },
];

export function TherapistLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const railLink = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-card px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-accent-quiet text-accent"
        : "text-muted hover:bg-surface-hover hover:text-text"
    }`;

  return (
    <div className="flex min-h-screen bg-app">
      {/* Left rail - collapses to a top bar on small screens */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="px-5 py-4">
          <NavLink to="/clinic" aria-label="PhysioPilot home">
            <Logo />
          </NavLink>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={railLink}>
              <Icon name={item.icon} size="1.05rem" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="flex size-8 items-center justify-center rounded-full border border-line bg-surface-sunken text-muted">
              <Icon name="user" size="1rem" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{user?.name}</p>
              <p className="truncate text-xs text-subtle">Physiotherapist</p>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                signOut();
                navigate("/login", { replace: true });
              }}
              className="flex flex-1 items-center gap-2 rounded-card px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <Icon name="sign-out" size="1.05rem" />
              Sign out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Small-screen header */}
      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <NavLink to="/clinic" aria-label="PhysioPilot home">
          <Logo />
        </NavLink>
        <div className="flex items-center gap-2">
          <NavLink
            to="/clinic/patients/new"
            className="flex size-9 items-center justify-center rounded-card border border-line text-muted"
            aria-label="Add patient"
          >
            <Icon name="plus" />
          </NavLink>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => {
              signOut();
              navigate("/login", { replace: true });
            }}
            className="flex size-9 items-center justify-center rounded-card border border-line text-muted"
            aria-label="Sign out"
          >
            <Icon name="sign-out" />
          </button>
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col pt-14 md:pt-0">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8">
          <Outlet />
        </main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-8 pt-2 text-xs text-subtle sm:px-8">
          PhysioPilot records exercise adherence and observed movement. It is a
          rehabilitation support tool, not a diagnostic system.
        </footer>
      </div>
    </div>
  );
}
