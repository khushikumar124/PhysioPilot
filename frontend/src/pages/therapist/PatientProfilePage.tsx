import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAsync } from "../../lib/useAsync";
import {
  formatDate,
  formatDateTime,
  formatDegrees,
  formatPercent,
  relativeDay,
} from "../../lib/format";
import { Alert, EmptyState } from "../../components/ui/Alert";
import { Badge, TrendBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { ProgressChart } from "../../components/ProgressChart";
import { FullPageSpinner, SkeletonBlock } from "../../components/ui/Spinner";
import { Stat } from "../../components/ui/Stat";

export function PatientProfilePage() {
  const { patientId } = useParams();
  const id = Number(patientId);

  const patient = useAsync(() => api.patient(id), [id]);
  const plans = useAsync(() => api.patientPlans(id), [id]);
  const adherence = useAsync(() => api.patientAdherence(id, 14), [id]);
  const performance = useAsync(() => api.patientPerformance(id), [id]);
  const progress = useAsync(() => api.patientProgress(id), [id]);
  const sessions = useAsync(() => api.patientSessions(id, 20), [id]);

  const activePlan = plans.data?.find((plan) => plan.status === "active") ?? null;

  if (patient.loading) return <FullPageSpinner label="Loading patient" />;
  if (patient.error) return <Alert tone="error">{patient.error}</Alert>;
  if (!patient.data) return null;

  const targetFor = (exerciseId: number) =>
    activePlan?.prescribed_exercises.find((pe) => pe.exercise_id === exerciseId)?.target_rom ??
    activePlan?.prescribed_exercises.find((pe) => pe.exercise_id === exerciseId)?.exercise
      .default_target_rom ??
    null;

  return (
    <div className="space-y-6">
      {/* --- Overview ---------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/clinic" className="text-sm text-ink-500 hover:underline">
            ← All patients
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">{patient.data.name}</h1>
          <p className="text-sm text-ink-500">
            {activePlan?.condition || "No active plan"}
            {patient.data.date_of_birth && ` · born ${formatDate(patient.data.date_of_birth)}`}
          </p>
        </div>
        <Link to={`/clinic/patients/${id}/plan`}>
          <Button>{activePlan ? "Modify prescription" : "Create plan"}</Button>
        </Link>
      </div>

      {patient.data.notes && (
        <Card>
          <CardBody className="text-sm text-ink-600">
            <span className="font-medium text-ink-700">Clinical notes: </span>
            {patient.data.notes}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Session adherence"
          value={formatPercent(adherence.data?.adherence_pct)}
          sublabel={
            adherence.data
              ? `${adherence.data.sessions_completed} of ${adherence.data.sessions_due} sessions in ${adherence.data.window_days} days`
              : undefined
          }
        />
        <Stat
          label="Movement quality"
          value={formatPercent(
            performance.data?.length
              ? averageOf(performance.data.map((p) => p.quality_pct))
              : null,
          )}
          sublabel="Camera-tracked exercises only"
        />
        <Stat
          label="Current streak"
          value={adherence.data ? `${adherence.data.current_streak_days} d` : "—"}
          sublabel="Consecutive days with a session"
        />
        <Stat
          label="Latest session"
          value={relativeDay(sessions.data?.find((s) => s.completed_at)?.completed_at ?? null)}
        />
      </div>

      {/* --- Current prescription ---------------------------------------- */}
      <Card>
        <CardHeader
          title="Current prescription"
          description={activePlan ? `${activePlan.title} · started ${formatDate(activePlan.start_date)}` : undefined}
          action={
            activePlan ? <Badge tone="brand">Active</Badge> : undefined
          }
        />
        <CardBody>
          {plans.loading ? (
            <SkeletonBlock className="h-24" />
          ) : !activePlan ? (
            <EmptyState
              title="No active plan"
              description="This patient has nothing to do in the app until you prescribe a routine."
              action={
                <Link to={`/clinic/patients/${id}/plan`}>
                  <Button>Create plan</Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {activePlan.prescribed_exercises
                .filter((item) => item.active)
                .map((item) => (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-ink-900">{item.exercise.name}</p>
                        <p className="text-sm text-ink-600">
                          {item.sets} × {item.repetitions}
                          {item.frequency_per_day > 1 && `, ${item.frequency_per_day} times a day`}
                          {item.target_rom && ` · target ${formatDegrees(item.target_rom)}`}
                        </p>
                      </div>
                      {item.exercise.cv_supported ? (
                        <Badge tone="brand">Camera tracked</Badge>
                      ) : (
                        <Badge tone="neutral">Self-reported</Badge>
                      )}
                    </div>
                    {item.instructions && (
                      <p className="mt-1 text-sm text-ink-500">“{item.instructions}”</p>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* --- Progress ---------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Observed movement progress"
          description="Peak range recorded per session. Measured by camera, not a clinical assessment."
        />
        <CardBody className="space-y-6">
          {progress.loading ? (
            <SkeletonBlock className="h-56" />
          ) : !progress.data?.length ? (
            <EmptyState
              title="No tracked sessions yet"
              description="Range of movement appears here once the patient completes a camera-tracked exercise."
            />
          ) : (
            progress.data.map((series) => (
              <div key={series.exercise_id}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-ink-800">
                    {series.exercise_name} — observed range
                  </h3>
                  <TrendBadge trend={series.trend} />
                </div>
                {series.points.length < 2 ? (
                  <p className="text-sm text-ink-500">
                    {series.points.length === 1
                      ? `One session recorded: ${formatDegrees(series.points[0].value)}. A trend needs more sessions.`
                      : "No sessions recorded yet."}
                  </p>
                ) : (
                  <ProgressChart series={series} targetRom={targetFor(series.exercise_id)} />
                )}
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* --- Exercise performance ---------------------------------------- */}
      <Card>
        <CardHeader
          title="Exercise performance"
          description="Session adherence and movement quality are recorded separately."
        />
        <CardBody>
          {performance.loading ? (
            <SkeletonBlock className="h-32" />
          ) : !performance.data?.length ? (
            <EmptyState title="Nothing recorded yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-4 font-medium">Exercise</th>
                    <th className="py-2 pr-4 font-medium">Sessions</th>
                    <th className="py-2 pr-4 font-medium">Reps in range</th>
                    <th className="py-2 pr-4 font-medium">Quality</th>
                    <th className="py-2 pr-4 font-medium">Latest range</th>
                    <th className="py-2 pr-4 font-medium">Target</th>
                    <th className="py-2 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.data.map((row) => (
                    <tr key={row.exercise_id} className="border-b border-ink-100 last:border-0">
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-ink-800">{row.exercise_name}</span>
                        {!row.cv_supported && (
                          <span className="ml-2 text-xs text-ink-500">self-reported</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums">{row.sessions}</td>
                      <td className="py-2.5 pr-4 tabular-nums">
                        {row.reps_valid === null ? "—" : `${row.reps_valid} / ${row.reps_attempted}`}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums">{formatPercent(row.quality_pct)}</td>
                      <td className="py-2.5 pr-4 tabular-nums">{formatDegrees(row.latest_rom)}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-ink-500">
                        {formatDegrees(row.target_rom)}
                      </td>
                      <td className="py-2.5">
                        <TrendBadge trend={row.trend} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* --- Session history --------------------------------------------- */}
      <Card>
        <CardHeader title="Session history" description="Most recent 20 sessions." />
        <CardBody>
          {sessions.loading ? (
            <SkeletonBlock className="h-32" />
          ) : !sessions.data?.length ? (
            <EmptyState title="No sessions yet" />
          ) : (
            <ul className="divide-y divide-ink-100 text-sm">
              {sessions.data.map((session) => {
                const item = activePlan?.prescribed_exercises.find(
                  (pe) => pe.id === session.prescribed_exercise_id,
                );
                return (
                  <li key={session.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="w-40 text-ink-500">
                      {formatDateTime(session.completed_at ?? session.started_at)}
                    </span>
                    <span className="flex-1 font-medium text-ink-800">
                      {item?.exercise.name ?? "Exercise"}
                    </span>
                    <span className="tabular-nums text-ink-600">
                      {session.reps_attempted}/{session.reps_prescribed} reps
                    </span>
                    <span className="tabular-nums text-ink-600">
                      {session.reps_valid === null
                        ? "not tracked"
                        : `${session.reps_valid} in range`}
                    </span>
                    <span className="tabular-nums text-ink-600">
                      {formatDegrees(session.rom_max)}
                    </span>
                    {session.status === "completed" ? (
                      <Badge tone="positive">Completed</Badge>
                    ) : session.status === "abandoned" ? (
                      <Badge tone="caution">Not finished</Badge>
                    ) : (
                      <Badge tone="neutral">In progress</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function averageOf(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (!present.length) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}
