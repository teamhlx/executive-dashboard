"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

type ChartEntry = {
  week: string;
  points: number;
  trend?: number;
};

// Linear regression for trend line — returns { values, slope (per week), slopePerMonth }
function linearRegression(values: number[]): { values: number[]; slope: number; slopePerMonth: number } {
  const n = values.length;
  if (n < 2) return { values, slope: 0, slopePerMonth: 0 };
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) * (i - xMean);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return {
    values: values.map((_, i) => Math.round(intercept + slope * i)),
    slope: Math.round(slope * 100) / 100,
    slopePerMonth: Math.round(slope * 4.33 * 100) / 100,
  };
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; color: string; dataKey: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-gray-300 text-sm font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm" style={{ color: p.color }}>
          {p.dataKey === "trend" ? "Trend" : "Actual"}: {p.value} pts
        </p>
      ))}
    </div>
  );
};

type TimeRange = "all" | "year" | "6mo" | "3mo" | "1mo";

const TIME_RANGES: { key: TimeRange; label: string; weeks: number }[] = [
  { key: "all", label: "All Time", weeks: 999 },
  { key: "year", label: "1 Year", weeks: 52 },
  { key: "6mo", label: "6 Months", weeks: 26 },
  { key: "3mo", label: "3 Months", weeks: 13 },
  { key: "1mo", label: "1 Month", weeks: 4 },
];

export default function VelocityChart({ trends, viewMode }: Props) {
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

  const rawPoints = trends.weeks.map((_, i) =>
    viewMode === "pr" ? trends.prLevel[i] ?? 0 : trends.grouped[i] ?? 0
  ).slice(startIdx);
  const regression = linearRegression(rawPoints);
  const slicedWeeks = trends.weeks.slice(startIdx);

  const data: ChartEntry[] = slicedWeeks.map((week, i) => ({
    week: week.replace(/^\d{4}-/, ""), // strip year → "W26"
    points: rawPoints[i],
    trend: regression.values[i],
  }));

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm text-gray-400 uppercase tracking-wider">
          Weekly Velocity — {viewMode === "pr" ? "PR-Level Points" : "Story-Grouped Points"}
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
          <Line
            type="monotone"
            dataKey="points"
            stroke="#818cf8"
            strokeWidth={2}
            dot={{ fill: "#818cf8", r: 4 }}
            activeDot={{ r: 6, fill: "#a5b4fc" }}
            name="Points"
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
          <span className="w-3 h-0.5 inline-block" style={{ borderTop: "2px dashed #34d399" }}></span>
          Trend: <span className={regression.slopePerMonth >= 0 ? "text-emerald-400" : "text-red-400"}>
            {regression.slopePerMonth > 0 ? "+" : ""}{regression.slopePerMonth} pts/month
          </span>
        </span>
      </div>
    </div>
  );
}
