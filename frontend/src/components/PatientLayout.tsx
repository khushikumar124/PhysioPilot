import { NavLink, Outlet } from "react-router-dom";

/**
 * The patient shell: three destinations, large targets, no jargon. Navigation
 * sits at the bottom of the screen where a thumb reaches it.
 */
export function PatientLayout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-base font-medium ${
      isActive ? "bg-brand-50 text-brand-800" : "text-ink-500"
    }`;

  return (
    <div className="patient-scale flex min-h-screen flex-col bg-ink-50">
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-6">
        <Outlet />
      </main>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 border-t border-ink-200 bg-white px-3 pb-[env(safe-area-inset-bottom)] pt-2"
      >
        <div className="mx-auto flex max-w-xl items-stretch gap-2">
          <NavLink to="/today" className={linkClass}>
            <span aria-hidden="true" className="text-2xl">🏠</span>
            Today
          </NavLink>
          <NavLink to="/progress" className={linkClass}>
            <span aria-hidden="true" className="text-2xl">📈</span>
            Progress
          </NavLink>
          <NavLink to="/help" className={linkClass}>
            <span aria-hidden="true" className="text-2xl">💬</span>
            Help
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
