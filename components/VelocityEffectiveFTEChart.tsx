"use client";

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

// Benchmark: national average story points per engineer per week
const NATIONAL_AVG_PTS_PER_ENG = 8;

// Team roster — allocation as fraction of 1 FTE
const TEAM_ROSTER: { name: string; allocation: number; startWeek: string; endWeek: string | null }[] = [
  { name: "Jason", allocation: 1.0, startWeek: "2025-W32", endWeek: null },
  { name: "Chris", allocation: 0.8, startWeek: "2025-W32", endWeek: null },
  { name: "Mauro", allocation: 1.0, startWeek: "2026-W24", endWeek: null },
  { name: "Chad", allocation: 1.0, startWeek: "2026-W24", endWeek: null },
];

// Team change milestones
const TEAM_MILESTONES = [
  { week: "2026-W24", label: "Mauro & Chad join" },
];

// Calculate total FTE headcount for a given week
function getFTEForWeek(week: string): number {
  return TEAM_ROSTER
    .filter(m => week >= m.startWeek && (!m.endWeek || week <= m.endWeek))
    .reduce((sum, m) => sum + m.allocation, 0);
}

// Linear regression — returns { values, slope (per week), slopePerMonth }
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
    values: values.map((_, i) => Math.round((intercept + slope * i) * 10) / 10),
    slope: Math.round(slope * 100) / 100,
    slopePerMonth: Math.round(slope * 4.33 * 100) / 100,
  };
}

// Convert ISO week string to date of Monday of that week
function getWeekMonday(isoWeek: string): Date | null {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function weekToMonthStart(weeks: string[]): Set<number> {
  const monthStarts = new Set<number>();
  let prevMonth = -1;
  for (let i = 0; i < weeks.length; i++) {
    const d = getWeekMonday(weeks[i]);
    if (d) {
      const m = d.getMonth();
      if (m !== prevMonth) {
        monthStarts.add(i);
        prevMonth = m;
      }
    }
  }
  return monthStarts;
}

type ChartEntry = {
  week: string;
  fullWeek: string;
  effectiveFTE: number;
  actualFTE: number;
  trendPre?: number;
  trendPost?: number;
};

const TIME_RANGE_WEEKS: Record<TimeRange, number> = {
  all: 999, year: 52, "6mo": 26, "3mo": 13, "1mo": 4,
};

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
      {payload.map((p, i) => {
        let name = p.dataKey;
        if (p.dataKey === "effectiveFTE") name = "Effective FTE";
        else if (p.dataKey === "actualFTE") name = "Actual Headcount";
        else if (p.dataKey === "trendPre") name = "Trend (pre)";
        else if (p.dataKey === "trendPost") name = "Trend (post)";
        return (
          <p key={i} className="text-sm" style={{ color: p.color }}>
            {name}: {p.value} FTE
          </p>
        );
      })}
    </div>
  );
};

export default function VelocityEffectiveFTEChart({ trends, viewMode, timeRange, infoContent }: Props) {

  if (!trends || trends.weeks.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6 flex items-center justify-center h-48">
        <p className="text-gray-500 text-sm">No trend data available yet</p>
      </div>
    );
  }

  const maxWeeks = TIME_RANGE_WEEKS[timeRange] ?? 999;
  const startIdx = Math.max(0, trends.weeks.length - maxWeeks);
  const slicedWeeks = trends.weeks.slice(startIdx);

  const rawPoints = trends.weeks.map((_, i) =>
    viewMode === "pr" ? trends.prLevel[i] ?? 0 : trends.grouped[i] ?? 0
  ).slice(startIdx);

  // Effective FTE = rawPoints / national average benchmark
  const effectiveFTEValues = rawPoints.map(pts =>
    Math.round((pts / NATIONAL_AVG_PTS_PER_ENG) * 10) / 10
  );

  // Find milestone index within sliced data
  const milestoneIdx = slicedWeeks.indexOf(TEAM_MILESTONES[0]?.week ?? "");

  // Split regression: pre-milestone and post-milestone (on effectiveFTE values)
  let preRegression: { values: number[]; slope: number; slopePerMonth: number } | null = null;
  let postRegression: { values: number[]; slope: number; slopePerMonth: number } | null = null;

  if (milestoneIdx > 1 && milestoneIdx < slicedWeeks.length - 1) {
    preRegression = linearRegression(effectiveFTEValues.slice(0, milestoneIdx + 1));
    postRegression = linearRegression(effectiveFTEValues.slice(milestoneIdx));
  } else {
    preRegression = linearRegression(effectiveFTEValues);
  }

  const showMilestone = milestoneIdx > 1 && milestoneIdx < slicedWeeks.length - 1;

  // Month-start indices for X-axis labels
  const monthStartIndices = weekToMonthStart(slicedWeeks);

  const data: ChartEntry[] = slicedWeeks.map((week, i) => {
    const entry: ChartEntry = {
      week: week.replace(/^\d{4}-/, ""),
      fullWeek: week,
      effectiveFTE: effectiveFTEValues[i],
      actualFTE: Math.round(getFTEForWeek(week) * 10) / 10,
    };
    if (showMilestone) {
      if (i <= milestoneIdx && preRegression) {
        entry.trendPre = preRegression.values[i];
      }
      if (i >= milestoneIdx && postRegression) {
        entry.trendPost = postRegression.values[i - milestoneIdx];
      }
    } else if (preRegression) {
      entry.trendPre = preRegression.values[i];
    }
    return entry;
  });

  // Milestone reference lines
  const milestoneIndices = TEAM_MILESTONES.map(m => ({
    ...m,
    idx: slicedWeeks.indexOf(m.week),
    displayWeek: m.week.replace(/^\d{4}-/, ""),
  })).filter(m => m.idx >= 0);

  // Build week→month label map for tick formatting
  const weekToMonthMap: Record<string, string> = {};
  slicedWeeks.forEach((week, i) => {
    const shortWeek = week.replace(/^\d{4}-/, "");
    if (monthStartIndices.has(i)) {
      const d = getWeekMonday(week);
      if (d) {
        const yr = d.getFullYear().toString().slice(2);
        weekToMonthMap[shortWeek] = `${MONTH_NAMES[d.getMonth()]} '${yr}`;
      }
    }
  });
  const formatXTick = (value: string) => weekToMonthMap[value] || "";

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
      <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4 flex items-center">
        <span>
          Effective FTE Output — National Avg Benchmark (8 pts/wk)
          {viewMode === "grouped" ? " — Story-Grouped" : ""}
        </span>
        {infoContent && (
          <ChartInfoButton title="Effective FTE Output">{infoContent}</ChartInfoButton>
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
          {/* Actual headcount — gray dashed reference line */}
          <Line
            type="stepAfter"
            dataKey="actualFTE"
            stroke="#6b7280"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            activeDot={false}
            name="Actual Headcount"
          />
          {/* Effective FTE output — purple/indigo */}
          <Line
            type="monotone"
            dataKey="effectiveFTE"
            stroke="#818cf8"
            strokeWidth={2}
            dot={{ fill: "#818cf8", r: 4 }}
            activeDot={{ r: 6, fill: "#a5b4fc" }}
            name="Effective FTE"
          />
          {/* Trend lines */}
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
              {preRegression.slopePerMonth > 0 ? "+" : ""}{preRegression.slopePerMonth} FTE/month
            </span>
          </span>
        )}
        {postRegression && showMilestone && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 inline-block" style={{ borderTop: "2px dashed #22d3ee" }}></span>
            Post-hire:{" "}
            <span className={postRegression.slopePerMonth >= 0 ? "text-cyan-400" : "text-red-400"}>
              {postRegression.slopePerMonth > 0 ? "+" : ""}{postRegression.slopePerMonth} FTE/month
            </span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 inline-block" style={{ borderTop: "2px dashed #6b7280" }}></span>
          Actual headcount
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 inline-block" style={{ borderTop: "2px dashed #f59e0b" }}></span>
          Team change
        </span>
        <span className="text-gray-600">Benchmark: 8 pts/eng/wk (industry standard)</span>
      </div>
    </div>
  );
}
