"use client";

import { useMemo } from "react";
import { weekToLabel } from "./weekUtils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import ChartInfoButton from "./ChartInfoButton";

type WeekData = {
  week: string;
  prs: {
    author: string;
    points: number;
    category: string;
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

// Categories mapped to work type buckets
const PRODUCT_CATEGORIES = new Set([
  "Core Platform",
  "AI/Agents",
  "UI/UX",
  "Integrations",
  "Analytics",
]);

const INFRA_CATEGORIES = new Set([
  "Infrastructure",
  "DevOps",
  "Admin/Tools",
  "Data/Schema",
]);

type ChartEntry = {
  week: string;
  fullWeek: string;
  product: number;
  infrastructure: number;
};

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
  all: 999, year: 52, "6mo": 26, "3mo": 13, "1mo": 4,
};

function classifyCategory(category: string): "product" | "infrastructure" {
  if (PRODUCT_CATEGORIES.has(category)) return "product";
  if (INFRA_CATEGORIES.has(category)) return "infrastructure";
  // Default unknown categories to product
  return "product";
}

export default function VelocityWorkTypeChart({ weeks, timeRange, infoContent }: Props) {
  if (!weeks || weeks.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6 flex items-center justify-center h-48">
        <p className="text-gray-500 text-sm">No work type data available yet</p>
      </div>
    );
  }

  const maxWeeks = TIME_RANGE_WEEKS[timeRange] ?? 999;
  const startIdx = Math.max(0, weeks.length - maxWeeks);
  const slicedWeeks = weeks.slice(startIdx);

  const monthStartIndices = weekToMonthStart(slicedWeeks.map((w) => w.week));

  const data: ChartEntry[] = useMemo(() => slicedWeeks.map((w) => {
    let product = 0;
    let infrastructure = 0;

    for (const pr of w.prs) {
      const bucket = classifyCategory(pr.category);
      if (bucket === "product") {
        product += pr.points;
      } else {
        infrastructure += pr.points;
      }
    }

    return {
      week: w.week,
      fullWeek: weekToLabel(w.week),
      product,
      infrastructure,
    };
  }), [slicedWeeks]);

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

  // Summary stats for the selected range
  const totals = useMemo(() => {
    const p = data.reduce((s, d) => s + d.product, 0);
    const i = data.reduce((s, d) => s + d.infrastructure, 0);
    const total = p + i;
    return {
      product: p,
      infrastructure: i,
      productPct: total > 0 ? Math.round((p / total) * 100) : 0,
      infraPct: total > 0 ? Math.round((i / total) * 100) : 0,
    };
  }, [data]);

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
    if (!entry) return null;
    const total = entry.product + entry.infrastructure;
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-gray-300 text-sm font-medium mb-1">{entry.fullWeek}</p>
        <p className="text-sm" style={{ color: "#818cf8" }}>
          Product: {entry.product} pts {total > 0 ? `(${Math.round((entry.product / total) * 100)}%)` : ""}
        </p>
        <p className="text-sm" style={{ color: "#f59e0b" }}>
          Infrastructure: {entry.infrastructure} pts {total > 0 ? `(${Math.round((entry.infrastructure / total) * 100)}%)` : ""}
        </p>
        <p className="text-gray-400 text-xs mt-1">Total: {total} pts</p>
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
      <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4 flex items-center">
        <span>Work Type — Product vs Infrastructure</span>
        {infoContent && (
          <ChartInfoButton title="Work Type Breakdown">{infoContent}</ChartInfoButton>
        )}
      </h3>
      {/* Summary badges */}
      <div className="flex gap-4 mb-4 text-xs">
        <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-300">
          Product: {totals.productPct}% ({totals.product} pts)
        </span>
        <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300">
          Infra: {totals.infraPct}% ({totals.infrastructure} pts)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
          <Area
            type="monotone"
            dataKey="product"
            stackId="1"
            stroke="#818cf8"
            fill="#818cf8"
            fillOpacity={0.4}
            name="Product"
          />
          <Area
            type="monotone"
            dataKey="infrastructure"
            stackId="1"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.4}
            name="Infrastructure"
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
            iconType="square"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
