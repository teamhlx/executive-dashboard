"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

type TrendData = {
  weeks: string[];
  prLevel: number[];
  grouped: number[];
  fteEquivPR: number[];
  fteEquivGrouped: number[];
};

type Props = {
  trends: TrendData;
  viewMode: "pr" | "grouped";
};

// Team roster — allocation as fraction of 1 FTE
// startWeek = first week they contributed, endWeek = last week (null = still active)
const TEAM_ROSTER = [
  { name: "Jason", allocation: 1.0, startWeek: "2025-W32", endWeek: null },
  { name: "Chris", allocation: 0.8, startWeek: "2025-W32", endWeek: "2026-W25" },
  { name: "Mauro", allocation: 0.3, startWeek: "2026-W24", endWeek: null },
  { name: "Chad", allocation: 0.3, startWeek: "2026-W25", endWeek: null },
];

// Team change milestones (for reference lines)
const TEAM_MILESTONES = [
  { week: "2026-W24", label: "Mauro joins" },
  { week: "2026-W25", label: "Chad joins" },
];

// Calculate total FTE headcount for a given week
function getFTEForWeek(week: string): number {
  return TEAM_ROSTER
    .filter(m => week >= m.startWeek && (!m.endWeek || week <= m.endWeek))
    .reduce((sum, m) => sum + m.allocation, 0);
}

// Linear regression
function linearRegression(values: number[]): number[] {
  const n = values.length;
  if (n < 2) return values;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) * (i - xMean);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return values.map((_, i) => Math.round((intercept + slope * i) * 10) / 10);
}

type ChartEntry = {
  week: string;
  fullWeek: string;
  pointsPerFTE: number;
  trend?: number;
  fte: number;
};

type TimeRange = "all" | "year" | "6mo" | "3mo" | "1mo";

const TIME_RANGES: { key: TimeRange; label: string; weeks: number }[] = [
  { key: "all", label: "All Time", weeks: 999 },
  { key: "year", label: "1 Year", weeks: 52 },
  { key: "6mo", label: "6 Months", weeks: 26 },
  { key: "3mo", label: "3 Months", weeks: 13 },
  { key: "1mo", label: "1 Month", weeks: 4 },
];

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload as ChartEntry | undefined;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-gray-300 text-sm font-medium mb-1">{entry?.fullWeek || label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm" style={{ color: p.color }}>
          {p.dataKey === "trend" ? "Trend" : "Per FTE"}: {p.value} pts
        </p>
      ))}
      {entry && (
        <p className="text-gray-500 text-xs mt-1">
          Team: {entry.fte} FTE
        </p>
      )}
    </div>
  );
};

export default function VelocityFTEChart({ trends, viewMode }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  if (!trends || trends.weeks.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6 flex items-center justify-center h-48">
        <p className="text-gray-500 text-sm">No trend data available yet</p>
      </div>
    );
  }

  const maxWeeks = TIME_RANGES.find(r => r.key === timeRange)?.weeks ?? 999;
  const startIdx = Math.max(0, trends.weeks.length - maxWeeks);
  const slicedWeeks = trends.weeks.slice(startIdx);

  const rawPoints = trends.weeks.map((_, i) =>
    viewMode === "pr" ? trends.prLevel[i] ?? 0 : trends.grouped[i] ?? 0
  ).slice(startIdx);

  // Normalize by FTE headcount for each week
  const perFTEPoints = slicedWeeks.map((week, i) => {
    const fte = getFTEForWeek(week);
    return fte > 0 ? Math.round((rawPoints[i] / fte) * 10) / 10 : 0;
  });

  const trendValues = linearRegression(perFTEPoints);

  const data: ChartEntry[] = slicedWeeks.map((week, i) => ({
    week: week.replace(/^\d{4}-/, ""),
    fullWeek: week,
    pointsPerFTE: perFTEPoints[i],
    trend: trendValues[i],
    fte: getFTEForWeek(week),
  }));

  // Find milestone positions within current data range
  const milestoneIndices = TEAM_MILESTONES.map(m => ({
    ...m,
    idx: slicedWeeks.indexOf(m.week),
    displayWeek: m.week.replace(/^\d{4}-/, ""),
  })).filter(m => m.idx >= 0);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm text-gray-400 uppercase tracking-wider">
          Velocity Per FTE — {viewMode === "pr" ? "PR-Level" : "Story-Grouped"}
        </h3>
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
          {TIME_RANGES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTimeRange(key)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                timeRange === key
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="week"
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            axisLine={{ stroke: "#374151" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip content={<CustomTooltip />} />
          {milestoneIndices.map((m) => (
            <ReferenceLine
              key={m.week}
              x={m.displayWeek}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: m.label,
                position: "top",
                fill: "#f59e0b",
                fontSize: 11,
              }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="pointsPerFTE"
            stroke="#818cf8"
            strokeWidth={2}
            dot={{ fill: "#818cf8", r: 4 }}
            activeDot={{ r: 6, fill: "#a5b4fc" }}
            name="Per FTE"
          />
          <Line
            type="monotone"
            dataKey="trend"
            stroke="#34d399"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={false}
            name="Trend"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-amber-500 inline-block" style={{ borderTop: "2px dashed #f59e0b" }}></span>
          Team change
        </span>
        <span>
          Current team: {getFTEForWeek(trends.weeks[trends.weeks.length - 1])} FTE
          ({TEAM_ROSTER.filter(m => !m.endWeek || m.endWeek >= trends.weeks[trends.weeks.length - 1]).map(m => `${m.name} ${Math.round(m.allocation * 100)}%`).join(", ")})
        </span>
      </div>
    </div>
  );
}
