"use client";

import { useState } from "react";
import VelocityMetrics from "./VelocityMetrics";
import VelocityChart from "./VelocityChart";
import VelocityFTEChart from "./VelocityFTEChart";
import VelocityAuthorBreakdown from "./VelocityAuthorBreakdown";
import VelocityStoryList from "./VelocityStoryList";
import ScoringMethodologyModal from "./ScoringMethodologyModal";

type WeekData = {
  week: string;
  startDate: string;
  endDate: string;
  prLevelPoints: number;
  groupedPoints: number;
  fteEquivPR: number;
  fteEquivGrouped: number;
  totalPRs: number;
  scoredPRs: number;
  generatedAt: string;
  prs: {
    prNumber: number;
    title: string;
    author: string;
    mergedAt: string;
    points: number;
    category: string;
    rationale: string;
    customAdditions: number;
    isVendored: boolean;
    isMultiAuthor?: boolean;
    attribution?: Record<string, number>;
  }[];
  stories: {
    id: number;
    name: string;
    points: number;
    category: string;
    prNumbers: number[];
    week: string;
  }[];
};

type TrendData = {
  weeks: string[];
  prLevel: number[];
  grouped: number[];
  fteEquivPR: number[];
  fteEquivGrouped: number[];
};

type AuthorData = {
  totalPoints: number;
  avgPerPR: number;
  prs: number;
  avgPerWeek: number;
};

export type VelocityPayload = {
  weeks: WeekData[];
  currentWeek: WeekData | null;
  trends: TrendData;
  authors: Record<string, AuthorData>;
  fteEquiv: { current: number; average: number };
};

type Props = {
  data: VelocityPayload | null;
  loading: boolean;
  error: string | null;
};

type TimeRange = "all" | "year" | "6mo" | "3mo" | "1mo";

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "year", label: "1 Year" },
  { key: "6mo", label: "6 Months" },
  { key: "3mo", label: "3 Months" },
  { key: "1mo", label: "1 Month" },
];

export default function VelocityDashboard({ data, loading, error }: Props) {
  const [viewMode] = useState<"pr" | "grouped">("pr");
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [showMethodology, setShowMethodology] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 animate-pulse">
          Loading velocity data…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
        {error}
      </div>
    );
  }

  if (!data || data.weeks.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
        <p className="text-gray-400 mb-2">No velocity data yet.</p>
        <p className="text-gray-500 text-sm">
          Run{" "}
          <code className="bg-gray-700 px-1 rounded text-xs">
            node scripts/weekly-velocity-score.js --week 2026-WXX
          </code>{" "}
          to generate data.
        </p>
      </div>
    );
  }

  // Which week to show in story list / PR table
  const weeks = data.weeks;
  const selectedIdx =
    selectedWeekIdx !== null ? selectedWeekIdx : weeks.length - 1;
  const displayWeek = weeks[selectedIdx] ?? data.currentWeek;

  // Compute author breakdown filtered by time range (same logic as charts)
  const TIME_RANGE_WEEKS_MAP: Record<TimeRange, number> = {
    all: 999, year: 52, "6mo": 26, "3mo": 13, "1mo": 4,
  };
  const maxWeeksForAuthors = TIME_RANGE_WEEKS_MAP[timeRange] ?? 999;
  const startIdxForAuthors = Math.max(0, weeks.length - maxWeeksForAuthors);
  const filteredWeeks = weeks.slice(startIdxForAuthors);

  const filteredAuthors: Record<string, AuthorData> = {};
  for (const w of filteredWeeks) {
    for (const pr of w.prs) {
      if (pr.isMultiAuthor && pr.attribution) {
        for (const [name, fraction] of Object.entries(pr.attribution)) {
          if (!filteredAuthors[name]) {
            filteredAuthors[name] = { totalPoints: 0, avgPerPR: 0, prs: 0, avgPerWeek: 0 };
          }
          filteredAuthors[name].totalPoints += Math.round(pr.points * fraction);
          filteredAuthors[name].prs += 1;
        }
      } else {
        const name = pr.author;
        if (!filteredAuthors[name]) {
          filteredAuthors[name] = { totalPoints: 0, avgPerPR: 0, prs: 0, avgPerWeek: 0 };
        }
        filteredAuthors[name].totalPoints += pr.points;
        filteredAuthors[name].prs += 1;
      }
    }
  }
  // Compute derived stats
  const numFilteredWeeks = filteredWeeks.length || 1;
  for (const author of Object.values(filteredAuthors)) {
    author.avgPerPR = author.prs > 0 ? Math.round((author.totalPoints / author.prs) * 10) / 10 : 0;
    author.avgPerWeek = Math.round((author.totalPoints / numFilteredWeeks) * 10) / 10;
  }

  return (
    <div>
      {/* Scoring methodology modal */}
      <ScoringMethodologyModal open={showMethodology} onClose={() => setShowMethodology(false)} />

      {/* Controls row */}
      <div className="flex items-center justify-between mb-6">
        <div />

        {/* Info button + Week selector */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowMethodology(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors"
            title="How scoring works"
          >
            <span className="text-base leading-none">ℹ️</span>
            <span>Methodology</span>
          </button>
          <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Week:</span>
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedWeekIdx(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            {weeks.map((w, i) => (
              <option key={w.week} value={i}>
                {w.week}
                {i === weeks.length - 1 ? " (latest)" : ""}
              </option>
            ))}
          </select>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <VelocityMetrics
        currentWeek={displayWeek}
        averageFTE={data.fteEquiv.average}
        viewMode={viewMode}
      />

      {/* Time range selector + Charts */}
      <div className="flex justify-end mb-2">
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
      <VelocityChart trends={data.trends} viewMode={viewMode} timeRange={timeRange} />
      <VelocityFTEChart trends={data.trends} viewMode={viewMode} timeRange={timeRange} />

      {/* Two-column: author breakdown + story list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VelocityAuthorBreakdown authors={filteredAuthors} />
        <VelocityStoryList
          stories={displayWeek?.stories ?? []}
          week={displayWeek?.week ?? null}
        />
      </div>

      {/* PR Table (PR-level view only) */}
      {viewMode === "pr" && displayWeek && displayWeek.prs.length > 0 && (
        <div className="mt-6 bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
            PRs — {displayWeek.week}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-700">
                  <th className="pb-2 pr-4">PR</th>
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">Author</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {[...displayWeek.prs]
                  .sort((a, b) => b.points - a.points)
                  .map((pr) => (
                    <tr
                      key={pr.prNumber}
                      className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors"
                    >
                      <td className="py-2 pr-4 text-gray-500 tabular-nums">
                        #{pr.prNumber}
                      </td>
                      <td className="py-2 pr-4 text-gray-300 max-w-xs truncate">
                        {pr.title}
                      </td>
                      <td className="py-2 pr-4 text-gray-400">
                        {pr.isMultiAuthor && pr.attribution ? (
                          <span className="flex flex-col gap-0.5">
                            {Object.entries(pr.attribution)
                              .sort(([, a], [, b]) => b - a)
                              .map(([name, fraction]) => (
                                <span key={name} className="text-xs">
                                  {name}{' '}
                                  <span className="text-gray-600">
                                    ({Math.round(fraction * 100)}% · {Math.round(pr.points * fraction)}pts)
                                  </span>
                                </span>
                              ))}
                          </span>
                        ) : (
                          pr.author
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-500 text-xs">
                        {pr.category}
                      </td>
                      <td className="py-2 text-right font-bold text-indigo-400">
                        {pr.points}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
