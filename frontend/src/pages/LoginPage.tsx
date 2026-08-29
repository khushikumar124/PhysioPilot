import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "../components/Logo";
import { Icon } from "../components/ui/Icon";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/Field";
import { FullPageSpinner } from "../components/ui/Spinner";

/** Demo accounts seeded by `python -m app.seed`. */
const DEMO_ACCOUNTS = [
  { label: "Physiotherapist — Dr. Ananya Rao", email: "ananya.rao@physiopilot.demo" },
  { label: "Patient — Rahul Kumar", email: "rahul.kumar@physiopilot.demo" },
];
const DEMO_PASSWORD = "physio123";

export function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <FullPageSpinner />;
  if (user) {
    const target = user.role === "physiotherapist" ? "/clinic" : "/today";
    return <Navigate to={(location.state as { from?: string })?.from ?? target} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signedIn = await signIn(email.trim(), password);
      navigate(signedIn.role === "physiotherapist" ? "/clinic" : "/today", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4 py-10">
      {/* The toggle lives here too: sign-in is outside both app shells, and a
          dark-adapted user should not be forced through a bright page first. */}
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Logo size={36} />
          <p className="mt-2 text-sm text-muted">From prescription to recovery.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-card-lg border border-line bg-surface p-6"
        >
          <h1 className="text-xl font-semibold text-text">Sign in</h1>

          {error && <Alert tone="error">{error}</Alert>}

          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Sign in
          </Button>

          <p className="text-center text-sm text-muted">
            Are you a physiotherapist?{" "}
            <Link to="/register" className="font-medium text-accent underline">
              Create an account
            </Link>
          </p>
        </form>

        {/* Demo shortcuts sit on the page background rather than in a second
            box beneath the form. */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.07em] text-subtle">
            Demo accounts
          </p>
          <div className="mt-2.5 space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-card border border-line bg-surface px-3.5 py-2.5 text-left text-sm transition-colors hover:border-accent-line hover:bg-surface-hover"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-text">{account.label}</span>
                  <span className="block truncate text-xs text-muted">{account.email}</span>
                </span>
                <Icon name="arrow-right" size="1rem" className="text-subtle" />
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-subtle">
            Patients are normally created by their physiotherapist, not self-registered.
          </p>
        </div>
      </div>
    </div>
  );
}
