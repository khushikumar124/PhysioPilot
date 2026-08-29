import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAsync } from "../../lib/useAsync";
import { formatPercent, relativeDay } from "../../lib/format";
import { Alert, EmptyState } from "../../components/ui/Alert";
import { Badge, TrendBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { SkeletonBlock } from "../../components/ui/Spinner";
import { Stat } from "../../components/ui/Stat";

export function ClinicDashboardPage() {
  const overview = useAsync(() => api.overview(), []);
  const patients = useAsync(() => api.patients(), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Your patients</h1>
          <p className="text-sm text-ink-500">
            Adherence and observed movement since each plan started.
          </p>
        </div>
        <Link to="/clinic/patients/new">
          <Button>Add patient</Button>
        </Link>
      </div>

      {overview.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
      ) : overview.error ? (
        <Alert tone="error">{overview.error}</Alert>
      ) : overview.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Patients" value={overview.data.total_patients} />
          <Stat label="On an active plan" value={overview.data.patients_on_active_plans} />
          <Stat
            label="Sessions completed today"
            value={overview.data.sessions_completed_today}
            sublabel="Across all your patients"
          />
          <Stat
            label="Need attention"
            value={overview.data.patients_needing_attention}
            tone={overview.data.patients_needing_attention > 0 ? "alert" : "default"}
            sublabel="Low adherence or declining movement"
          />
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Patient list"
          description="Patients flagged for review appear first."
        />
        {patients.loading ? (
          <div className="space-y-3 p-5">
            <SkeletonBlock className="h-12" />
            <SkeletonBlock className="h-12" />
            <SkeletonBlock className="h-12" />
          </div>
        ) : patients.error ? (
          <div className="p-5">
            <Alert tone="error">{patients.error}</Alert>
          </div>
        ) : !patients.data?.length ? (
          <div className="p-5">
            <EmptyState
              title="No patients yet"
              description="Add your first patient, then build their rehabilitation plan."
              action={
                <Link to="/clinic/patients/new">
                  <Button>Add patient</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Condition</th>
                  <th className="px-5 py-3 font-medium">Adherence</th>
                  <th className="px-5 py-3 font-medium">Movement quality</th>
                  <th className="px-5 py-3 font-medium">Latest session</th>
                  <th className="px-5 py-3 font-medium">Progress</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {patients.data.map((patient) => (
                  <tr key={patient.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                    <td className="px-5 py-3">
                      <Link
                        to={`/clinic/patients/${patient.id}`}
                        className="font-medium text-brand-800 underline-offset-2 hover:underline"
                      >
                        {patient.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{patient.condition ?? "No active plan"}</td>
                    <td className="px-5 py-3 tabular-nums text-ink-800">
                      {formatPercent(patient.adherence_pct)}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-ink-800">
                      {formatPercent(patient.quality_pct)}
                    </td>
                    <td className="px-5 py-3 text-ink-600">{relativeDay(patient.last_session_at)}</td>
                    <td className="px-5 py-3">
                      <TrendBadge trend={patient.trend} />
                    </td>
                    <td className="px-5 py-3">
                      {patient.needs_attention ? (
                        <span title={patient.attention_reasons.join(" · ")}>
                          <Badge tone="alert">Needs attention</Badge>
                        </span>
                      ) : (
                        <Badge tone="positive">On track</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {patients.data?.some((p) => p.needs_attention) && (
        <Card>
          <CardHeader title="Why these patients are flagged" />
          <ul className="space-y-3 px-5 py-4 text-sm">
            {patients.data
              .filter((p) => p.needs_attention)
              .map((patient) => (
                <li key={patient.id}>
                  <Link
                    to={`/clinic/patients/${patient.id}`}
                    className="font-medium text-brand-800 underline-offset-2 hover:underline"
                  >
                    {patient.name}
                  </Link>
                  <ul className="mt-1 list-inside list-disc text-ink-600">
                    {patient.attention_reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
