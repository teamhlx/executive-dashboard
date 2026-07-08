"use client";

import { useState } from "react";
import { weekToLabel } from "./weekUtils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import ChartInfoButton from "./ChartInfoButton";

type WeekData = {
  week: string;
  prs: {
    author: string;
    points: number;
    isMultiAuthor?: boolean;
    attribution?: Record<string, number>;
  }[];
};

type TimeRange = "all" | "year" | "6mo" | "3mo" | "1mo";

type Props = {
  weeks: WeekData[];
  timeRange: TimeRange;
  infoContent?: React.ReactNode;
};

const AUTHORS = ["Jason", "Chris", "Mauro", "Chad"] as const;
type AuthorName = (typeof AUTHORS)[number];

const AUTHOR_COLORS: Record<AuthorName, string> = {
  Jason: "#818cf8",
  Chris: "#34d399",
  Mauro: "#f59e0b",
  Chad: "#22d3ee",
};

type ChartEntry = {
  week: string;
  fullWeek: string;
  Jason: number;
  Chris: number;
  Mauro: number;
  Chad: number;
};

// Convert ISO week string to date of Monday of that week
function getMonthLabel(isoWeek: string): Date | null {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Mon=1..Sun=7
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function weekToMonthStart(weeks: string[]): Set<number> {
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
      {AUTHORS.map((author) => {
        const p = payload.find((x) => x.dataKey === author);
        if (!p) return null;
        return (
          <p key={author} className="text-sm" style={{ color: AUTHOR_COLORS[author] }}>
            {author}: {p.value} pts
          </p>
        );
      })}
    </div>
  );
};

export default function VelocityContributorChart({ weeks, timeRange, infoContent }: Props) {
  const [visibleAuthors, setVisibleAuthors] = useState<Set<AuthorName>>(new Set(AUTHORS));

  const toggleAuthor = (author: AuthorName) => {
    setVisibleAuthors((prev) => {
      const next = new Set(prev);
      if (next.has(author) && next.size > 1) {
        // If clicking an already-visible author and others are also visible, show ONLY that one
        if (next.size === 1) {
          // Already solo — reset to all
          return new Set(AUTHORS);
        }
        return new Set([author]);
      } else if (next.has(author) && next.size === 1) {
        // Clicking the solo author — reset to all
        return new Set(AUTHORS);
      } else {
        // Author is hidden — show only that one
        return new Set([author]);
      }
    });
  };

  if (!weeks || weeks.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6 flex items-center justify-center h-48">
        <p className="text-gray-500 text-sm">No contributor data available yet</p>
      </div>
    );
  }

  const maxWeeks = TIME_RANGE_WEEKS[timeRange] ?? 999;
  const startIdx = Math.max(0, weeks.length - maxWeeks);
  const slicedWeeks = weeks.slice(startIdx);

  // Compute per-author points per week
  const monthStartIndices = weekToMonthStart(slicedWeeks.map((w) => w.week));

  const data: ChartEntry[] = slicedWeeks.map((w) => {
    const authorPoints: Record<AuthorName, number> = {
      Jason: 0, Chris: 0, Mauro: 0, Chad: 0,
    };

    for (const pr of w.prs) {
      if (pr.isMultiAuthor && pr.attribution) {
        for (const [rawName, fraction] of Object.entries(pr.attribution)) {
          const name = rawName === "Skippy" ? "Jason" : rawName;
          if (name === "dependabot") continue;
          if (AUTHORS.includes(name as AuthorName)) {
            authorPoints[name as AuthorName] += Math.round(pr.points * fraction);
          }
        }
      } else {
        const rawName = pr.author;
        const name = rawName === "Skippy" ? "Jason" : rawName;
        if (name === "dependabot") continue;
        if (AUTHORS.includes(name as AuthorName)) {
          authorPoints[name as AuthorName] += pr.points;
        }
      }
    }

    return {
      week: w.week.replace(/^\d{4}-/, ""),
      fullWeek: weekToLabel(w.week),
      ...authorPoints,
    };
  });

  // Build month label map for X-axis tick formatter
  const weekToMonth: Record<string, string> = {};
  slicedWeeks.forEach((w, i) => {
    const shortWeek = w.week.replace(/^\d{4}-/, "");
    if (monthStartIndices.has(i)) {
      const d = getMonthLabel(w.week) as Date | null;
      if (d) {
        const yr = d.getFullYear().toString().slice(2);
        weekToMonth[shortWeek] = `${MONTH_NAMES[d.getMonth()]} '${yr}`;
      }
    }
  });

  const formatXTick = (value: string) => weekToMonth[value] || "";

  // Fixed Y-axis domain based on ALL authors (keeps scale stable when filtering)
  const yMax = Math.max(...data.flatMap((d) => AUTHORS.map((a) => d[a])), 0);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
      <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4 flex items-center">
        <span>Individual Contributor Points</span>
        {infoContent && (
          <ChartInfoButton title="Individual Contributor Points">{infoContent}</ChartInfoButton>
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
            domain={[0, yMax]}
          />
          <Tooltip content={<CustomTooltip />} />
          {AUTHORS.map((author) => (
            <Line
              key={author}
              type="monotone"
              dataKey={author}
              stroke={AUTHOR_COLORS[author]}
              strokeWidth={visibleAuthors.has(author) ? 2 : 0}
              dot={visibleAuthors.has(author) ? { fill: AUTHOR_COLORS[author], r: 3 } : false}
              activeDot={visibleAuthors.has(author) ? { r: 5, fill: AUTHOR_COLORS[author] } : false}
              name={author}
              connectNulls={false}
              hide={!visibleAuthors.has(author)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {/* Interactive Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-xs">
        {AUTHORS.map((author) => {
          const isActive = visibleAuthors.has(author);
          return (
            <button
              key={author}
              onClick={() => toggleAuthor(author)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
                isActive
                  ? "text-gray-200 bg-gray-700/50"
                  : "text-gray-500 hover:text-gray-400"
              }`}
            >
              <span
                className="inline-block rounded"
                style={{
                  backgroundColor: isActive ? AUTHOR_COLORS[author] : "#4b5563",
                  height: "2px",
                  minWidth: "12px",
                }}
              />
              {author}
            </button>
          );
        })}
        {visibleAuthors.size < AUTHORS.length && (
          <button
            onClick={() => setVisibleAuthors(new Set(AUTHORS))}
            className="text-gray-500 hover:text-gray-300 px-2 py-1 transition-colors"
          >
            Show all
          </button>
        )}
      </div>
    </div>
  );
}
