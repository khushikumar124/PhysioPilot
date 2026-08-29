import { api } from "../../api/client";
import { useAsync } from "../../lib/useAsync";
import { Alert, EmptyState } from "../../components/ui/Alert";
import { Panel, PanelBody } from "../../components/ui/Card";
import { FullPageSpinner } from "../../components/ui/Spinner";

/**
 * Patient-facing progress.
 *
 * Deliberately not a dashboard: a count of sessions, and a short sentence per
 * exercise. Analysis belongs to the physiotherapist.
 */
export function PatientProgressPage() {
  const adherence = useAsync(() => api.myAdherence(14), []);
  const progress = useAsync(() => api.myProgress(), []);

  if (adherence.loading || progress.loading) return <FullPageSpinner label="Loading your progress" />;
  if (adherence.error) return <Alert tone="error">{adherence.error}</Alert>;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold text-text">Your progress</h1>

      {adherence.data && (
        <Panel>
          <PanelBody>
            <p className="text-lg text-muted">Last two weeks</p>
            <p className="mt-1 text-3xl font-semibold text-accent">
              {adherence.data.sessions_completed} of {adherence.data.sessions_due} sessions
              completed
            </p>
            {adherence.data.current_streak_days > 0 && (
              <p className="mt-2 text-lg text-text">
                You have exercised {adherence.data.current_streak_days}{" "}
                {adherence.data.current_streak_days === 1 ? "day" : "days"} in a row.
              </p>
            )}
          </PanelBody>
        </Panel>
      )}

      {!progress.data?.length ? (
        <EmptyState
          title="Nothing to show yet"
          description="Finish an exercise with the camera and your movement will appear here."
        />
      ) : (
        progress.data.map((series) => {
          const points = series.points;
          const latest = points.at(-1);
          const first = points[0];
          const change = latest && first ? Math.round(latest.value - first.value) : 0;
          return (
            <Panel key={series.exercise_id}>
              <PanelBody>
                <h2 className="text-xl font-semibold text-text">{series.exercise_name}</h2>
                {!latest ? (
                  <p className="mt-1 text-muted">No sessions recorded yet.</p>
                ) : points.length < 3 ? (
                  <p className="mt-1 text-lg text-text">
                    Your last session reached {Math.round(latest.value)} degrees. Keep going and we
                    will show your progress here.
                  </p>
                ) : (
                  <p className="mt-1 text-lg text-text">
                    Your movement has changed by {change > 0 ? "+" : ""}
                    {change} degrees since you started, and your last session reached{" "}
                    {Math.round(latest.value)} degrees.
                  </p>
                )}
              </PanelBody>
            </Panel>
          );
        })
      )}

      <p className="px-1 text-sm text-muted">
        These are measurements of your movement during exercises. Your physiotherapist reviews
        them and decides what to change.
      </p>
    </div>
  );
}
