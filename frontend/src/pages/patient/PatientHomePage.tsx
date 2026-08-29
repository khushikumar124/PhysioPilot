import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useAsync } from "../../lib/useAsync";
import { firstName, greeting } from "../../lib/format";
import { Alert, EmptyState } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { FullPageSpinner } from "../../components/ui/Spinner";
import { ThemeToggle } from "../../components/ui/ThemeToggle";
import { EmptyRoutine } from "../../components/art/Illustrations";

/**
 * The patient home screen.
 *
 * One question answered: what should I do today? No charts, no scores, no
 * jargon - a list of what the physiotherapist prescribed and a large button
 * next to each one.
 *
 * Each exercise is one surface with a numbered marker, not a card inside a
 * card. The progress bar at the foot is the only place a number appears, and
 * it counts sessions, not performance.
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
  const weekPct =
    sessions_due_this_week > 0
      ? Math.min(100, (sessions_done_this_week / sessions_due_this_week) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight text-text">
            {greeting()}, {firstName(routine.data.patient_name)}
          </h1>
          {routine.data.plan_title && (
            <p className="mt-1 text-muted">{routine.data.plan_title}</p>
          )}
        </div>
        <ThemeToggle size="lg" />
      </header>

      {items.length === 0 ? (
        <EmptyState
          art={<EmptyRoutine className="h-28 w-40" />}
          title="No exercises yet"
          description="Your physiotherapist has not set your routine yet. Please check again later."
        />
      ) : (
        <>
          {/* One line of status, stated plainly. */}
          <div className="flex items-center gap-3 border-y border-line py-4">
            {allDone && (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-positive-quiet text-positive">
                <Icon name="check" size="1.25rem" strokeWidth={2.4} />
              </span>
            )}
            <p className="text-xl font-medium text-text">
              {allDone
                ? "You have finished today. Well done."
                : `${remaining.length} exercise${remaining.length === 1 ? "" : "s"} to do today`}
            </p>
          </div>

          <ol className="space-y-4">
            {items.map((item, index) => (
              <li
                key={item.prescribed_exercise_id}
                className="rounded-card-lg border border-line bg-surface p-5"
              >
                <div className="flex items-start gap-3.5">
                  {/* A numbered marker reads as a step in a routine. */}
                  <span
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-base font-semibold ${
                      item.completed_today
                        ? "border-positive bg-positive-quiet text-positive"
                        : "border-line-strong text-muted"
                    }`}
                    aria-hidden="true"
                  >
                    {item.completed_today ? (
                      <Icon name="check" size="1.1rem" strokeWidth={2.4} />
                    ) : (
                      index + 1
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-[1.375rem] font-semibold leading-snug text-text">
                      {item.exercise.name}
                    </h2>
                    <p className="mt-0.5 text-lg text-muted">
                      {item.sets} sets, {item.repetitions} times
                      {item.sessions_due_today > 1 &&
                        ` · ${item.sessions_done_today} of ${item.sessions_due_today} done`}
                    </p>
                  </div>
                </div>

                <p className="mt-3.5 text-muted">{item.instructions}</p>

                <Button
                  size="xl"
                  variant={item.completed_today ? "secondary" : "primary"}
                  className="mt-4 w-full"
                  onClick={() => navigate(`/today/session/${item.prescribed_exercise_id}`)}
                >
                  {item.completed_today ? (
                    "Do it again"
                  ) : (
                    <>
                      <Icon name="play" size="1.1rem" strokeWidth={2} />
                      Start
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ol>

          <div className="border-t border-line pt-5">
            <div className="flex items-baseline justify-between">
              <p className="font-medium text-text">This week</p>
              <p className="tnum text-muted">
                {sessions_done_this_week} of {sessions_due_this_week} sessions
              </p>
            </div>
            <div
              className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-sunken"
              role="progressbar"
              aria-valuenow={sessions_done_this_week}
              aria-valuemin={0}
              aria-valuemax={sessions_due_this_week}
              aria-label="Sessions completed this week"
            >
              <div className="h-full rounded-full bg-accent" style={{ width: `${weekPct}%` }} />
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 pt-1">
        <Link to="/help">
          <Button variant="secondary" size="lg" className="w-full">
            <Icon name="assistant" size="1.1rem" />
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
