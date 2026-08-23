"use client";

import { useMemo, useState } from "react";
import { weekToLabel } from "./weekUtils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
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

type TimeRange = "all" | "year" | "6mo" | "4mo" | "3mo" | "1mo";

type Props = {
  weeks: WeekData[];
  timeRange: TimeRange;
  infoContent?: React.ReactNode;
};

// A broad palette for dynamically discovered authors
const COLOR_PALETTE = [
  "#818cf8", // indigo
  "#34d399", // emerald
  "#f59e0b", // amber
  "#22d3ee", // cyan
  "#f472b6", // pink
  "#a78bfa", // violet
  "#fb923c", // orange
  "#4ade80", // green
  "#e879f9", // fuchsia
  "#38bdf8", // sky
  "#facc15", // yellow
  "#94a3b8", // slate
];

// Aliases: map known alternate names to canonical display names
const AUTHOR_ALIASES: Record<string, string> = {
  Skippy: "Jason",
};

const EXCLUDED_AUTHORS = new Set(["dependabot"]);

// Convert ISO week string to date of Monday of that week
function getMonthLabel(isoWeek: string): Date | null {
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
    const d = getMonthLabel(weeks[i]);
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

const TIME_RANGE_WEEKS: Record<TimeRange, number> = {
  all: 999, year: 52, "6mo": 26, "4mo": 17, "3mo": 13, "1mo": 4,
};

type ChartEntry = {
  week: string;
  fullWeek: string;
  [author: string]: string | number;
};

export default function VelocityContributorChart({ weeks, timeRange, infoContent }: Props) {
  // Discover all authors from the data
  const authors = useMemo(() => {
    const authorSet = new Set<string>();
    for (const w of weeks) {
      for (const pr of w.prs) {
        if (pr.isMultiAuthor && pr.attribution) {
          for (const rawName of Object.keys(pr.attribution)) {
            const name = AUTHOR_ALIASES[rawName] ?? rawName;
            if (!EXCLUDED_AUTHORS.has(name)) authorSet.add(name);
          }
        } else {
          const name = AUTHOR_ALIASES[pr.author] ?? pr.author;
          if (!EXCLUDED_AUTHORS.has(name)) authorSet.add(name);
        }
      }
    }
    // Sort by total points descending so top contributors get first colors
    const totals: Record<string, number> = {};
    for (const a of authorSet) totals[a] = 0;
    for (const w of weeks) {
      for (const pr of w.prs) {
        if (pr.isMultiAuthor && pr.attribution) {
          for (const [rawName, fraction] of Object.entries(pr.attribution)) {
            const name = AUTHOR_ALIASES[rawName] ?? rawName;
            if (authorSet.has(name)) totals[name] += Math.round(pr.points * fraction);
          }
        } else {
          const name = AUTHOR_ALIASES[pr.author] ?? pr.author;
          if (authorSet.has(name)) totals[name] += pr.points;
        }
      }
    }
    return [...authorSet].sort((a, b) => totals[b] - totals[a]);
  }, [weeks]);

  const authorColors = useMemo(() => {
    const map: Record<string, string> = {};
    authors.forEach((a, i) => {
      map[a] = COLOR_PALETTE[i % COLOR_PALETTE.length];
    });
    return map;
  }, [authors]);

  const [visibleAuthors, setVisibleAuthors] = useState<Set<string>>(new Set(authors));

  // Keep visibleAuthors in sync if authors list changes
  useMemo(() => {
    setVisibleAuthors(new Set(authors));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authors.join(",")]);

  const toggleAuthor = (author: string) => {
    setVisibleAuthors((prev) => {
      if (prev.has(author) && prev.size > 1) {
        // Solo this author
        return new Set([author]);
      } else if (prev.has(author) && prev.size === 1) {
        // Already solo — reset to all
        return new Set(authors);
      } else {
        // Hidden — solo it
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

  // Milestone: AllCode joins (Week of June 8, 2026)
  const MILESTONE_WEEK = "2026-W24";
  const MILESTONE_LABEL = "AllCode joins";
  const milestoneIdx = slicedWeeks.findIndex((w) => w.week === MILESTONE_WEEK);
  const showMilestone = milestoneIdx > 1 && milestoneIdx < slicedWeeks.length - 1;

  const monthStartIndices = weekToMonthStart(slicedWeeks.map((w) => w.week));

  const data: ChartEntry[] = slicedWeeks.map((w) => {
    const authorPoints: Record<string, number> = {};
    for (const a of authors) authorPoints[a] = 0;

    for (const pr of w.prs) {
      if (pr.isMultiAuthor && pr.attribution) {
        for (const [rawName, fraction] of Object.entries(pr.attribution)) {
          const name = AUTHOR_ALIASES[rawName] ?? rawName;
          if (EXCLUDED_AUTHORS.has(name)) continue;
          if (name in authorPoints) {
            authorPoints[name] += Math.round(pr.points * fraction);
          }
        }
      } else {
        const name = AUTHOR_ALIASES[pr.author] ?? pr.author;
        if (EXCLUDED_AUTHORS.has(name)) continue;
        if (name in authorPoints) {
          authorPoints[name] += pr.points;
        }
      }
    }

    return {
      week: w.week,
      fullWeek: weekToLabel(w.week),
      ...authorPoints,
    };
  });

  // Build month label map for X-axis tick formatter
  const weekToMonth: Record<string, string> = {};
  slicedWeeks.forEach((w, i) => {
    if (monthStartIndices.has(i)) {
      const d = getMonthLabel(w.week);
      if (d) {
        const yr = d.getFullYear().toString().slice(2);
        weekToMonth[w.week] = `${MONTH_NAMES[d.getMonth()]} '${yr}`;
      }
    }
  });

  const formatXTick = (value: string) => weekToMonth[value] || "";

  // Y-axis domain based on ALL authors (stable when filtering)
  const yMax = Math.max(...data.flatMap((d) => authors.map((a) => (d[a] as number) || 0)), 0);

  // Custom tooltip that shows all discovered authors
  const CustomTooltip = ({
    active,
    payload,
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
        <p className="text-gray-300 text-sm font-medium mb-1">{entry?.fullWeek}</p>
        {authors.map((author) => {
          const val = entry?.[author] as number | undefined;
          if (val === undefined || val === 0) return null;
          return (
            <p key={author} className="text-sm" style={{ color: authorColors[author] }}>
              {author}: {val} pts
            </p>
          );
        })}
      </div>
    );
  };

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
          {/* Milestone vertical line */}
          {showMilestone && (
            <ReferenceLine
              x={MILESTONE_WEEK}
              stroke="#f59e0b"
              strokeWidth={1.5}
              label={{
                value: MILESTONE_LABEL,
                position: "top",
                fill: "#f59e0b",
                fontSize: 10,
              }}
            />
          )}
          {authors.map((author) => (
            <Line
              key={author}
              type="monotone"
              dataKey={author}
              stroke={authorColors[author]}
              strokeWidth={visibleAuthors.has(author) ? 2 : 0}
              dot={visibleAuthors.has(author) ? { fill: authorColors[author], r: 1.5 } : false}
              activeDot={visibleAuthors.has(author) ? { r: 2.5, fill: authorColors[author] } : false}
              name={author}
              connectNulls={false}
              hide={!visibleAuthors.has(author)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {/* Interactive Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-xs">
        {authors.map((author) => {
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
                  backgroundColor: isActive ? authorColors[author] : "#4b5563",
                  height: "2px",
                  minWidth: "12px",
                }}
              />
              {author}
            </button>
          );
        })}
        {visibleAuthors.size < authors.length && (
          <button
            onClick={() => setVisibleAuthors(new Set(authors))}
            className="text-gray-500 hover:text-gray-300 px-2 py-1 transition-colors"
          >
            Show all
          </button>
        )}
      </div>
    </div>
  );
}
