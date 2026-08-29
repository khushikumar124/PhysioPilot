import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { TextAreaField, TextField } from "../../components/ui/Field";

/**
 * Adding a patient creates their login. The therapist hands over the password
 * in the clinic; there is no self-service patient signup, because assignment
 * to a therapist is what makes the rest of the product work.
 */
export function NewPatientPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    date_of_birth: "",
    phone: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (form.password.length < 8) {
      setError("Please set a password of at least 8 characters for the patient.");
      return;
    }
    setSubmitting(true);
    try {
      const patient = await api.createPatient({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        date_of_birth: form.date_of_birth || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      });
      // Straight into the prescription builder: a patient without a plan has
      // nothing to open the app for.
      navigate(`/clinic/patients/${patient.id}/plan`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the patient.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold text-ink-900">Add a patient</h1>
      <Card>
        <CardHeader
          title="Patient details"
          description="This creates the patient's sign-in for the PhysioPilot app."
        />
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            <TextField label="Full name" required value={form.name} onChange={update("name")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Email"
                type="email"
                required
                value={form.email}
                onChange={update("email")}
              />
              <TextField
                label="Temporary password"
                required
                hint="At least 8 characters. Share it with the patient in clinic."
                value={form.password}
                onChange={update("password")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Date of birth"
                type="date"
                value={form.date_of_birth}
                onChange={update("date_of_birth")}
              />
              <TextField label="Phone" value={form.phone} onChange={update("phone")} />
            </div>
            <TextAreaField
              label="Clinical notes"
              hint="Visible to you only. Patients do not see this."
              value={form.notes}
              onChange={update("notes")}
            />
            <div className="flex gap-3">
              <Button type="submit" loading={submitting}>
                Add patient and build plan
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate("/clinic")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
