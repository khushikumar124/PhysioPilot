import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "./Logo";
import { Button } from "./ui/Button";

export function TherapistLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? "bg-brand-50 text-brand-800" : "text-ink-600 hover:bg-ink-100"
    }`;

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-10 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <NavLink to="/clinic" aria-label="PhysioPilot home">
              <Logo />
            </NavLink>
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink to="/clinic" end className={linkClass}>
                Patients
              </NavLink>
              <NavLink to="/clinic/patients/new" className={linkClass}>
                Add patient
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-600 sm:inline">{user?.name}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                signOut();
                navigate("/login", { replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-ink-400 sm:px-6">
        PhysioPilot records exercise adherence and observed movement. It is a
        rehabilitation support tool, not a diagnostic system.
      </footer>
    </div>
  );
}
