import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAsync } from "../../lib/useAsync";
import { formatPercent, relativeDay } from "../../lib/format";
import { Alert, EmptyState } from "../../components/ui/Alert";
import { Badge, TrendBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Panel, PanelHeader } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { SkeletonBlock } from "../../components/ui/Spinner";
import { Metric, MetricStrip } from "../../components/ui/Stat";
import { NoPatients } from "../../components/art/Illustrations";

const CELL = "px-5 py-3.5 align-middle";

export function ClinicDashboardPage() {
  const overview = useAsync(() => api.overview(), []);
  const patients = useAsync(() => api.patients(), []);
  const flagged = patients.data?.filter((p) => p.needs_attention) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">Your patients</h1>
          <p className="mt-0.5 text-sm text-muted">
            Adherence and observed movement since each plan started.
          </p>
        </div>
        <Link to="/clinic/patients/new">
          <Button>
            <Icon name="plus" size="1rem" />
            Add patient
          </Button>
        </Link>
      </div>

      {overview.loading ? (
        <SkeletonBlock className="h-[104px] rounded-card-lg" />
      ) : overview.error ? (
        <Alert tone="error">{overview.error}</Alert>
      ) : overview.data ? (
        <MetricStrip>
          <Metric label="Patients" value={overview.data.total_patients} icon="users" />
          <Metric
            label="Active plans"
            value={overview.data.patients_on_active_plans}
            icon="calendar"
          />
          <Metric
            label="Sessions today"
            value={overview.data.sessions_completed_today}
            icon="activity"
            sublabel="Across all patients"
          />
          <Metric
            label="Need attention"
            value={overview.data.patients_needing_attention}
            icon="alert"
            tone={overview.data.patients_needing_attention > 0 ? "alert" : "default"}
            sublabel="Adherence or movement"
          />
        </MetricStrip>
      ) : null}

      <Panel>
        <PanelHeader
          title="Patient list"
          description="Patients flagged for review appear first."
        />
        {patients.loading ? (
          <div className="space-y-2.5 p-5">
            <SkeletonBlock className="h-11" />
            <SkeletonBlock className="h-11" />
            <SkeletonBlock className="h-11" />
          </div>
        ) : patients.error ? (
          <div className="p-5">
            <Alert tone="error">{patients.error}</Alert>
          </div>
        ) : !patients.data?.length ? (
          <EmptyState
            art={<NoPatients className="h-24 w-36" />}
            title="No patients yet"
            description="Add your first patient, then build their rehabilitation plan."
            action={
              <Link to="/clinic/patients/new">
                <Button>Add patient</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-subtle">
                  <th className={`${CELL} font-medium`}>Name</th>
                  <th className={`${CELL} font-medium`}>Condition</th>
                  <th className={`${CELL} font-medium`}>Adherence</th>
                  <th className={`${CELL} font-medium`}>Quality</th>
                  <th className={`${CELL} font-medium`}>Latest</th>
                  <th className={`${CELL} font-medium`}>Movement</th>
                  <th className={`${CELL} font-medium`}>Status</th>
                  <th className={`${CELL} w-8`}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {patients.data.map((patient) => (
                  <tr
                    key={patient.id}
                    className="group border-b border-line transition-colors last:border-0 hover:bg-surface-hover"
                  >
                    <td className={`${CELL} whitespace-nowrap`}>
                      <Link
                        to={`/clinic/patients/${patient.id}`}
                        className="font-medium text-text hover:text-accent"
                      >
                        {patient.name}
                      </Link>
                    </td>
                    <td className={`${CELL} text-muted`}>
                      {patient.condition ?? "No active plan"}
                    </td>
                    <td className={`${CELL} tnum text-text`}>
                      {formatPercent(patient.adherence_pct)}
                    </td>
                    <td className={`${CELL} tnum text-text`}>
                      {formatPercent(patient.quality_pct)}
                    </td>
                    <td className={`${CELL} whitespace-nowrap text-muted`}>
                      {relativeDay(patient.last_session_at)}
                    </td>
                    <td className={CELL}>
                      <TrendBadge trend={patient.trend} />
                    </td>
                    <td className={CELL}>
                      {patient.needs_attention ? (
                        <span title={patient.attention_reasons.join(" · ")}>
                          <Badge tone="alert">Needs attention</Badge>
                        </span>
                      ) : (
                        <Badge tone="positive">On track</Badge>
                      )}
                    </td>
                    <td className={`${CELL} text-subtle`}>
                      <Link
                        to={`/clinic/patients/${patient.id}`}
                        aria-label={`Open ${patient.name}`}
                        className="block transition-transform group-hover:translate-x-0.5"
                      >
                        <Icon name="chevron-right" size="1rem" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {flagged.length > 0 && (
        <Panel>
          <PanelHeader
            title="Why these patients are flagged"
            description="Generated from adherence and observed movement, not a clinical judgement."
          />
          <ul className="divide-y divide-line">
            {flagged.map((patient) => (
              <li key={patient.id} className="flex gap-3 px-5 py-3.5">
                <Icon name="alert" className="mt-0.5 text-caution" size="1rem" />
                <div className="min-w-0">
                  <Link
                    to={`/clinic/patients/${patient.id}`}
                    className="text-sm font-medium text-text hover:text-accent"
                  >
                    {patient.name}
                  </Link>
                  <ul className="mt-1 space-y-0.5 text-sm text-muted">
                    {patient.attention_reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
