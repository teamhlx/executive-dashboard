"use client";

import { weekToLabel } from "./weekUtils";
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
import ChartInfoButton from "./ChartInfoButton";

type TrendData = {
  weeks: string[];
  prLevel: number[];
  grouped: number[];
  fteEquivPR: number[];
  fteEquivGrouped: number[];
};

type TimeRange = "all" | "year" | "6mo" | "3mo" | "1mo";

type Props = {
  trends: TrendData;
  viewMode: "pr" | "grouped";
  timeRange: TimeRange;
  infoContent?: React.ReactNode;
};

// Team milestone — same as FTE chart
const TEAM_MILESTONE_WEEK = "2026-W24";
const TEAM_MILESTONE_LABEL = "Mauro & Chad join";

type ChartEntry = {
  week: string;
  fullWeek: string;
  points: number;
  trendPre?: number;
  trendPost?: number;
};

// Convert ISO week string to date of Monday of that week
function getMonthLabel(isoWeek: string): Date | null {
  // Parse "2025-W32" → date of Monday of that week
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  // Jan 4 is always in week 1 per ISO
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Mon=1..Sun=7
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function weekToMonthStart(weeks: string[]): Set<number> {
  // Returns indices where a new month starts
  const monthStarts = new Set<number>();
  let prevMonth = -1;
  for (let i = 0; i < weeks.length; i++) {
    const d = getMonthLabel(weeks[i]);
    if (d) {
      const m = (d as Date).getMonth();
      if (m !== prevMonth) {
        monthStarts.add(i);
        prevMonth = m;
      }
    }
  }
  return monthStarts;
}

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
          {p.dataKey === "trendPre" ? "Trend (pre)" : p.dataKey === "trendPost" ? "Trend (post)" : "Actual"}: {p.value} pts
        </p>
      ))}
    </div>
  );
};

const TIME_RANGE_WEEKS: Record<TimeRange, number> = {
  all: 999, year: 52, "6mo": 26, "3mo": 13, "1mo": 4,
};

export default function VelocityChart({ trends, viewMode, timeRange, infoContent }: Props) {

  if (!trends || trends.weeks.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6 flex items-center justify-center h-48">
        <p className="text-gray-500 text-sm">No trend data available yet</p>
      </div>
    );
  }

  const maxWeeks = TIME_RANGE_WEEKS[timeRange] ?? 999;
  const startIdx = Math.max(0, trends.weeks.length - maxWeeks);

  const rawPoints = trends.weeks.map((_, i) =>
    viewMode === "pr" ? trends.prLevel[i] ?? 0 : trends.grouped[i] ?? 0
  ).slice(startIdx);
  const slicedWeeks = trends.weeks.slice(startIdx);

  // Find milestone index within sliced data
  const milestoneIdx = slicedWeeks.indexOf(TEAM_MILESTONE_WEEK);

  // Split regression: pre-milestone and post-milestone
  let preRegression: { values: number[]; slope: number; slopePerMonth: number } | null = null;
  let postRegression: { values: number[]; slope: number; slopePerMonth: number } | null = null;

  if (milestoneIdx > 1 && milestoneIdx < slicedWeeks.length - 1) {
    // Pre: everything up to and including the milestone week
    const prePoints = rawPoints.slice(0, milestoneIdx + 1);
    preRegression = linearRegression(prePoints);
    // Post: milestone week onward (overlaps at the milestone)
    const postPoints = rawPoints.slice(milestoneIdx);
    postRegression = linearRegression(postPoints);
  } else {
    // Milestone not visible or not enough data — single trend line
    preRegression = linearRegression(rawPoints);
  }

  // Determine which indices are month starts for labeling
  const monthStartIndices = weekToMonthStart(slicedWeeks);

  const data: ChartEntry[] = slicedWeeks.map((week, i) => {
    const entry: ChartEntry = {
      week: week.replace(/^\d{4}-/, ""), // keep "W26" as unique key for Recharts
      fullWeek: weekToLabel(week),
      points: rawPoints[i],
    };
    if (milestoneIdx > 1 && milestoneIdx < slicedWeeks.length - 1) {
      if (i <= milestoneIdx && preRegression) {
        entry.trendPre = preRegression.values[i];
      }
      if (i >= milestoneIdx && postRegression) {
        entry.trendPost = postRegression.values[i - milestoneIdx];
      }
    } else if (preRegression) {
      // Single trend line (milestone not in view)
      entry.trendPre = preRegression.values[i];
    }
    return entry;
  });

  // Milestone display week for ReferenceLine
  const milestoneDisplayWeek = TEAM_MILESTONE_WEEK.replace(/^\d{4}-/, "");
  const showMilestone = milestoneIdx > 1 && milestoneIdx < slicedWeeks.length - 1;

  // Build a map of week label → month display label for X-axis tick formatting
  const weekToMonth: Record<string, string> = {};
  slicedWeeks.forEach((week, i) => {
    const shortWeek = week.replace(/^\d{4}-/, "");
    if (monthStartIndices.has(i)) {
      const d = getMonthLabel(week) as Date | null;
      if (d) {
        const yr = d.getFullYear().toString().slice(2);
        weekToMonth[shortWeek] = `${MONTH_NAMES[d.getMonth()]} '${yr}`;
      }
    }
  });

  // Custom tick formatter: show month label or empty
  const formatXTick = (value: string) => weekToMonth[value] || "";

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
      <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4 flex items-center">
        <span>Weekly Velocity — {viewMode === "pr" ? "PR-Level Points" : "Story-Grouped Points"}</span>
        {infoContent && (
          <ChartInfoButton title="Weekly Velocity">{infoContent}</ChartInfoButton>
        )}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="week"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            axisLine={{ stroke: "#374151" }}
            tickLine={false}
            tickFormatter={formatXTick}
            interval={0}
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip content={<CustomTooltip />} />
          {showMilestone && (
            <ReferenceLine
              x={milestoneDisplayWeek}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: TEAM_MILESTONE_LABEL,
                position: "top",
                fill: "#f59e0b",
                fontSize: 11,
              }}
            />
          )}
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
            dataKey="trendPre"
            stroke="#34d399"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={false}
            name="Trend (pre)"
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="trendPost"
            stroke="#22d3ee"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={false}
            name="Trend (post)"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
        {preRegression && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 inline-block" style={{ borderTop: "2px dashed #34d399" }}></span>
            {showMilestone ? "Pre-hire: " : "Trend: "}
            <span className={preRegression.slopePerMonth >= 0 ? "text-emerald-400" : "text-red-400"}>
              {preRegression.slopePerMonth > 0 ? "+" : ""}{preRegression.slopePerMonth} pts/month
            </span>
          </span>
        )}
        {postRegression && showMilestone && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 inline-block" style={{ borderTop: "2px dashed #22d3ee" }}></span>
            Post-hire:{" "}
            <span className={postRegression.slopePerMonth >= 0 ? "text-cyan-400" : "text-red-400"}>
              {postRegression.slopePerMonth > 0 ? "+" : ""}{postRegression.slopePerMonth} pts/month
            </span>
          </span>
        )}
        {showMilestone && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 inline-block" style={{ borderTop: "2px dashed #f59e0b" }}></span>
            Team change
          </span>
        )}
      </div>
    </div>
  );
}
