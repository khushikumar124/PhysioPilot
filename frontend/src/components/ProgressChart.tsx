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
          <CartesianGrid stroke="var(--color-ink-200)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-ink-500)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-ink-200)" }}
            minTickGap={24}
          />
          <YAxis
            domain={[Math.max(0, Math.floor(lower - 10)), Math.ceil(upper + 10)]}
            tick={{ fontSize: 11, fill: "var(--color-ink-500)" }}
            tickLine={false}
            axisLine={false}
            width={44}
            unit="°"
          />
          <Tooltip
            formatter={(value) => [`${value}°`, "Observed range"] as [string, string]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--color-ink-200)",
              fontSize: 12,
            }}
          />
          {targetRom ? (
            <ReferenceLine
              y={targetRom}
              stroke="var(--color-ink-400)"
              strokeDasharray="4 4"
              label={{
                value: `Prescribed ${Math.round(targetRom)}°`,
                position: "insideTopRight",
                fill: "var(--color-ink-500)",
                fontSize: 11,
              }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-brand-700)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--color-brand-700)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
