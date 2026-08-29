import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "../components/Logo";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/Field";

/** Physiotherapist self-registration. Patients are added from the clinic side. */
export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", clinic_name: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (form.password.length < 8) {
      setError("Please use a password of at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: "physiotherapist",
        clinic_name: form.clinic_name.trim() || undefined,
      });
      navigate("/clinic", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Logo size={36} />
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-card-lg border border-line bg-surface p-6"
        >
          <h1 className="text-xl font-semibold text-text">Create a physiotherapist account</h1>
          {error && <Alert tone="error">{error}</Alert>}
          <TextField label="Full name" required value={form.name} onChange={update("name")} />
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            required
            value={form.email}
            onChange={update("email")}
          />
          <TextField label="Clinic name" value={form.clinic_name} onChange={update("clinic_name")} />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 8 characters."
            value={form.password}
            onChange={update("password")}
          />
          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Create account
          </Button>
          <p className="text-center text-sm text-muted">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-accent underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
