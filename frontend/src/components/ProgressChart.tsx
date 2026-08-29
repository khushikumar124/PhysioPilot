import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProgressSeries } from "../api/types";

/**
 * Observed range of movement over time.
 *
 * One series per chart, no secondary axes: the clinician should read the
 * direction in a second. The dashed line is the range the therapist
 * prescribed, so "is this patient getting there?" is answerable at a glance.
 */
export function ProgressChart({
  series,
  targetRom,
  height = 220,
}: {
  series: ProgressSeries;
  targetRom?: number | null;
  height?: number;
}) {
  const data = series.points.map((point, index) => ({
    session: index + 1,
    value: Math.round(point.value),
    date: new Date(point.recorded_at).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    }),
  }));

  const values = data.map((d) => d.value);
  const upper = Math.max(...values, targetRom ?? 0);
  const lower = Math.min(...values, targetRom ?? Infinity);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            minTickGap={24}
          />
          <YAxis
            domain={[Math.max(0, Math.floor(lower - 10)), Math.ceil(upper + 10)]}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            width={44}
            unit="°"
          />
          <Tooltip
            formatter={(value) => [`${value}°`, "Observed range"] as [string, string]}
            // Recharts defaults the tooltip to a white box, which is unreadable
            // on a dark surface; every colour has to be stated explicitly.
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--text)",
              boxShadow: "var(--shadow-md)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--text-muted)" }}
            itemStyle={{ color: "var(--text)" }}
            cursor={{ stroke: "var(--line-strong)" }}
          />
          {targetRom ? (
            <ReferenceLine
              y={targetRom}
              stroke="var(--text-subtle)"
              strokeDasharray="4 4"
              label={{
                value: `Prescribed ${Math.round(targetRom)}°`,
                position: "insideTopRight",
                fill: "var(--text-muted)",
                fontSize: 11,
              }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
