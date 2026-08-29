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
import { Icon } from "../../components/ui/Icon";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { ProgressChart } from "../../components/ProgressChart";
import { FullPageSpinner, SkeletonBlock } from "../../components/ui/Spinner";
import { Metric, MetricStrip } from "../../components/ui/Stat";

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
          <Link
            to="/clinic"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
          >
            <Icon name="chevron-left" size="0.95rem" />
            All patients
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-text">{patient.data.name}</h1>
          <p className="text-sm text-muted">
            {activePlan?.condition || "No active plan"}
            {patient.data.date_of_birth && ` · born ${formatDate(patient.data.date_of_birth)}`}
          </p>
        </div>
        <Link to={`/clinic/patients/${id}/plan`}>
          <Button>{activePlan ? "Modify prescription" : "Create plan"}</Button>
        </Link>
      </div>

      {patient.data.notes && (
        <div className="flex gap-2.5 rounded-card border-l-2 border-l-accent border-y border-r border-line bg-surface px-4 py-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-subtle">
              Clinical notes
            </p>
            <p className="mt-1 text-muted">{patient.data.notes}</p>
          </div>
        </div>
      )}

      <MetricStrip>
        <Metric
          label="Adherence"
          icon="calendar"
          value={formatPercent(adherence.data?.adherence_pct)}
          sublabel={
            adherence.data
              ? `${adherence.data.sessions_completed} of ${adherence.data.sessions_due} in ${adherence.data.window_days} days`
              : undefined
          }
        />
        <Metric
          label="Movement quality"
          icon="target"
          value={formatPercent(
            performance.data?.length
              ? averageOf(performance.data.map((p) => p.quality_pct))
              : null,
          )}
          sublabel="Camera-tracked only"
        />
        <Metric
          label="Streak"
          icon="activity"
          value={adherence.data ? `${adherence.data.current_streak_days}d` : "—"}
          sublabel="Consecutive days"
        />
        <Metric
          label="Latest session"
          icon="clock"
          value={relativeDay(sessions.data?.find((s) => s.completed_at)?.completed_at ?? null)}
        />
      </MetricStrip>

      {/* --- Current prescription ---------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Current prescription"
          description={activePlan ? `${activePlan.title} · started ${formatDate(activePlan.start_date)}` : undefined}
          action={
            activePlan ? <Badge tone="brand">Active</Badge> : undefined
          }
        />
        <PanelBody>
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
            <ul className="divide-y divide-line">
              {activePlan.prescribed_exercises
                .filter((item) => item.active)
                .map((item) => (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-text">{item.exercise.name}</p>
                        <p className="text-sm text-muted">
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
                      <p className="mt-1 text-sm text-muted">“{item.instructions}”</p>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </PanelBody>
      </Panel>

      {/* --- Progress ---------------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Observed movement progress"
          description="Peak range recorded per session. Measured by camera, not a clinical assessment."
        />
        <PanelBody className="space-y-6">
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
                  <h3 className="text-sm font-medium text-text">
                    {series.exercise_name} — observed range
                  </h3>
                  <TrendBadge trend={series.trend} />
                </div>
                {series.points.length < 2 ? (
                  <p className="text-sm text-muted">
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
        </PanelBody>
      </Panel>

      {/* --- Exercise performance ---------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Exercise performance"
          description="Session adherence and movement quality are recorded separately."
        />
        <PanelBody>
          {performance.loading ? (
            <SkeletonBlock className="h-32" />
          ) : !performance.data?.length ? (
            <EmptyState title="Nothing recorded yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
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
                    <tr key={row.exercise_id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-text">{row.exercise_name}</span>
                        {!row.cv_supported && (
                          <span className="ml-2 text-xs text-muted">self-reported</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 tnum">{row.sessions}</td>
                      <td className="py-2.5 pr-4 tnum">
                        {row.reps_valid === null ? "—" : `${row.reps_valid} / ${row.reps_attempted}`}
                      </td>
                      <td className="py-2.5 pr-4 tnum">{formatPercent(row.quality_pct)}</td>
                      <td className="py-2.5 pr-4 tnum">{formatDegrees(row.latest_rom)}</td>
                      <td className="py-2.5 pr-4 tnum text-muted">
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
        </PanelBody>
      </Panel>

      {/* --- Session history --------------------------------------------- */}
      <Panel>
        <PanelHeader title="Session history" description="Most recent 20 sessions." />
        <PanelBody>
          {sessions.loading ? (
            <SkeletonBlock className="h-32" />
          ) : !sessions.data?.length ? (
            <EmptyState title="No sessions yet" />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {sessions.data.map((session) => {
                const item = activePlan?.prescribed_exercises.find(
                  (pe) => pe.id === session.prescribed_exercise_id,
                );
                return (
                  <li key={session.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="w-40 text-muted">
                      {formatDateTime(session.completed_at ?? session.started_at)}
                    </span>
                    <span className="flex-1 font-medium text-text">
                      {item?.exercise.name ?? "Exercise"}
                    </span>
                    <span className="tnum text-muted">
                      {session.reps_attempted}/{session.reps_prescribed} reps
                    </span>
                    <span className="tnum text-muted">
                      {session.reps_valid === null
                        ? "not tracked"
                        : `${session.reps_valid} in range`}
                    </span>
                    <span className="tnum text-muted">
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
        </PanelBody>
      </Panel>
    </div>
  );
}

function averageOf(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (!present.length) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}
