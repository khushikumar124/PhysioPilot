import { NavLink, Outlet } from "react-router-dom";
import { Icon, type IconName } from "./ui/Icon";

/**
 * The patient shell: three destinations, large targets, no jargon. Navigation
 * sits at the bottom of the screen where a thumb reaches it.
 *
 * The tab icons are drawn rather than emoji - emoji render as a different
 * picture on every device, and a cartoon house is not the register this app
 * should speak in.
 */

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: "/today", label: "Today", icon: "today" },
  { to: "/progress", label: "Progress", icon: "progress" },
  { to: "/help", label: "Help", icon: "assistant" },
];

export function PatientLayout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-1 rounded-card px-2 py-2 text-[0.9375rem] font-medium transition-colors ${
      isActive ? "bg-accent-quiet text-accent" : "text-muted"
    }`;

  return (
    <div className="patient-scale flex min-h-screen flex-col bg-app">
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-6">
        <Outlet />
      </main>
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
