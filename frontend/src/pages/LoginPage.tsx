import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "../components/Logo";
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
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Logo size={36} />
          <p className="mt-2 text-sm text-ink-500">From prescription to recovery.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm"
        >
          <h1 className="text-xl font-semibold text-ink-900">Sign in</h1>

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

          <p className="text-center text-sm text-ink-500">
            Are you a physiotherapist?{" "}
            <Link to="/register" className="font-medium text-brand-700 underline">
              Create an account
            </Link>
          </p>
        </form>

        <div className="mt-4 rounded-2xl border border-dashed border-ink-300 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Demo accounts
          </p>
          <div className="mt-2 space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-left text-sm hover:bg-ink-100"
              >
                <span className="font-medium text-ink-800">{account.label}</span>
                <span className="block text-xs text-ink-500">{account.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Patients are normally created by their physiotherapist, not self-registered.
          </p>
        </div>
      </div>
    </div>
  );
}
