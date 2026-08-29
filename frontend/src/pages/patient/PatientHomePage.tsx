import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useAsync } from "../../lib/useAsync";
import { firstName, greeting } from "../../lib/format";
import { Alert, EmptyState } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { FullPageSpinner } from "../../components/ui/Spinner";

/**
 * The patient home screen.
 *
 * One question answered: what should I do today? No charts, no scores, no
 * jargon - a list of what the physiotherapist prescribed and a large button
 * next to each one.
 */
export function PatientHomePage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const routine = useAsync(() => api.routine(), []);

  if (routine.loading) return <FullPageSpinner label="Loading today's exercises" />;
  if (routine.error) {
    return (
      <Alert tone="error" title="We could not load your exercises">
        {routine.error}
      </Alert>
    );
  }
  if (!routine.data) return null;

  const { items, sessions_done_this_week, sessions_due_this_week } = routine.data;
  const remaining = items.filter((item) => !item.completed_today);
  const allDone = items.length > 0 && remaining.length === 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">
          {greeting()}, {firstName(routine.data.patient_name)} 👋
        </h1>
        {routine.data.plan_title && (
          <p className="mt-1 text-ink-500">{routine.data.plan_title}</p>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="No exercises yet"
          description="Your physiotherapist has not set your routine yet. Please check again later."
        />
      ) : (
        <>
          <div className="rounded-2xl border border-ink-200 bg-white px-5 py-4">
            <p className="text-lg font-medium text-ink-800">
              {allDone ? "You have finished today. Well done." : "Today's rehabilitation"}
            </p>
            <p className="text-ink-500">
              {allDone
                ? `${items.length} of ${items.length} exercises done`
                : `${remaining.length} exercise${remaining.length === 1 ? "" : "s"} to do`}
            </p>
          </div>

          <ol className="space-y-4">
            {items.map((item, index) => (
              <li
                key={item.prescribed_exercise_id}
                className={`rounded-2xl border bg-white p-5 ${
                  item.completed_today ? "border-ink-200 opacity-70" : "border-ink-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink-500">Exercise {index + 1}</p>
                    <h2 className="text-2xl font-semibold text-ink-900">{item.exercise.name}</h2>
                    <p className="mt-1 text-xl text-ink-700">
                      {item.sets} sets × {item.repetitions} times
                    </p>
                    {item.sessions_due_today > 1 && (
                      <p className="mt-1 text-ink-500">
                        {item.sessions_done_today} of {item.sessions_due_today} done today
                      </p>
                    )}
                  </div>
                  {item.completed_today && (
                    <span
                      aria-label="Completed"
                      className="text-3xl text-[color:var(--color-positive)]"
                    >
                      ✓
                    </span>
                  )}
                </div>

                <p className="mt-3 text-ink-600">{item.instructions}</p>

                <div className="mt-4">
                  <Button
                    size="xl"
                    variant={item.completed_today ? "secondary" : "primary"}
                    className="w-full"
                    onClick={() =>
                      navigate(`/today/session/${item.prescribed_exercise_id}`)
                    }
                  >
                    {item.completed_today ? "Do it again" : "START"}
                  </Button>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-2xl border border-ink-200 bg-white px-5 py-4">
            <p className="text-lg font-medium text-ink-800">This week</p>
            <p className="text-2xl font-semibold text-brand-800">
              {sessions_done_this_week} of {sessions_due_this_week} sessions completed
            </p>
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <Link to="/help">
          <Button variant="secondary" size="lg" className="w-full">
            Ask a question
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="lg"
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
  );
}
