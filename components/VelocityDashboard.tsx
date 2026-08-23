"use client";

import { useState } from "react";
import VelocityMetrics from "./VelocityMetrics";
import VelocityChart from "./VelocityChart";

import VelocityContributorChart from "./VelocityContributorChart";
import VelocityWorkTypeChart from "./VelocityWorkTypeChart";
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
  const [timeRange, setTimeRange] = useState<TimeRange>("6mo");
  const [chartMode, setChartMode] = useState<"all" | "trends" | "actuals">("all");
  const [showMethodology, setShowMethodology] = useState(false);
  const [showAllPRs, setShowAllPRs] = useState(false);

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

  // Compute author breakdown filtered by time range (same logic as charts)
  const TIME_RANGE_WEEKS_MAP: Record<TimeRange, number> = {
    all: 999, year: 52, "6mo": 26, "3mo": 13, "1mo": 4,
  };
  const maxWeeksFilter = TIME_RANGE_WEEKS_MAP[timeRange] ?? 999;
  const startIdxFilter = Math.max(0, weeks.length - maxWeeksFilter);
  const filteredWeeks = weeks.slice(startIdxFilter);

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
  // Compute derived stats — each author's avgPerWeek uses only their active weeks
  const AUTHOR_START_WEEKS: Record<string, string> = {
    Jason: "2025-W32",
    Chris: "2025-W32",
    Mauro: "2026-W24",
    Chad: "2026-W24",
  };
  const numFilteredWeeks = filteredWeeks.length || 1;
  for (const [name, author] of Object.entries(filteredAuthors)) {
    const startWeek = AUTHOR_START_WEEKS[name] ?? filteredWeeks[0]?.week ?? "2025-W32";
    const activeWeeks = filteredWeeks.filter(w => w.week >= startWeek).length || 1;
    author.avgPerPR = author.prs > 0 ? Math.round((author.totalPoints / author.prs) * 10) / 10 : 0;
    author.avgPerWeek = Math.round((author.totalPoints / activeWeeks) * 10) / 10;
  }

  // Aggregate metrics for the filtered range
  const totalPoints = filteredWeeks.reduce((s, w) => s + w.prLevelPoints, 0);
  const avgPointsPerWeek = numFilteredWeeks > 0 ? Math.round((totalPoints / numFilteredWeeks) * 10) / 10 : 0;
  const totalPRs = filteredWeeks.reduce((s, w) => s + w.scoredPRs, 0);
  const totalStories = filteredWeeks.reduce((s, w) => s + (w.stories?.length ?? 0), 0);
  const fteEquiv = numFilteredWeeks > 0
    ? Math.round((filteredWeeks.reduce((s, w) => s + w.fteEquivPR, 0) / numFilteredWeeks) * 100) / 100
    : 0;
  const avgFTE = data.fteEquiv.average;
  const rangeLabel = timeRange === "all" ? "All Time" : TIME_RANGES.find(r => r.key === timeRange)?.label ?? "";

  return (
    <div>
      {/* Scoring methodology modal */}
      <ScoringMethodologyModal open={showMethodology} onClose={() => setShowMethodology(false)} />

      {/* Controls row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
            {TIME_RANGES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTimeRange(key)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  timeRange === key
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {weeks.length > 0 && weeks[weeks.length - 1].generatedAt && (
            <span className="text-xs text-gray-500">
              Last scored: {new Date(weeks[weeks.length - 1].generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>

        <button
          onClick={() => setShowMethodology(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors"
          title="How scoring works"
        >
          <span className="text-base leading-none">ℹ️</span>
          <span>Methodology</span>
        </button>
      </div>

      {/* Metric cards */}
      <VelocityMetrics
        totalPoints={totalPoints}
        avgPointsPerWeek={avgPointsPerWeek}
        fteEquiv={fteEquiv}
        avgFTE={avgFTE}
        totalPRs={totalPRs}
        totalStories={totalStories}
        numWeeks={numFilteredWeeks}
        rangeLabel={rangeLabel}
      />

      {/* Points/Week trend cards — Features vs Infrastructure */}
      {timeRange !== "all" && timeRange !== "year" && (() => {
        const numWeeksHalf = Math.floor(filteredWeeks.length / 2);
        if (numWeeksHalf < 2) return null;
        const recentHalf = filteredWeeks.slice(filteredWeeks.length - numWeeksHalf);
        const olderHalf = filteredWeeks.slice(0, numWeeksHalf);

        const INFRA_CATS = new Set(["Infrastructure", "DevOps"]);
        const classify = (cat: string) => INFRA_CATS.has(cat) ? "infra" : "features";

        let featPtsRecent = 0, infraPtsRecent = 0, featPtsOlder = 0, infraPtsOlder = 0;
        for (const w of recentHalf) {
          for (const pr of w.prs) {
            if (classify(pr.category) === "features") featPtsRecent += pr.points;
            else infraPtsRecent += pr.points;
          }
        }
        for (const w of olderHalf) {
          for (const pr of w.prs) {
            if (classify(pr.category) === "features") featPtsOlder += pr.points;
            else infraPtsOlder += pr.points;
          }
        }

        const featAvgRecent = featPtsRecent / recentHalf.length;
        const featAvgOlder = featPtsOlder / olderHalf.length;
        const infraAvgRecent = infraPtsRecent / recentHalf.length;
        const infraAvgOlder = infraPtsOlder / olderHalf.length;
        const featChange = featAvgOlder > 0 ? Math.round(((featAvgRecent - featAvgOlder) / featAvgOlder) * 100) : 0;
        const infraChange = infraAvgOlder > 0 ? Math.round(((infraAvgRecent - infraAvgOlder) / infraAvgOlder) * 100) : 0;

        return (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800 border border-gray-700">
              <div>
                <p className="text-xs text-gray-500 uppercase">Features pts/week</p>
                <p className="text-xl font-bold text-gray-200">{featAvgRecent.toFixed(1)} <span className="text-sm text-gray-500">avg ({recentHalf.length}w)</span></p>
              </div>
              <div className={`text-right ${featChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                <p className="text-2xl font-bold">{featChange >= 0 ? '+' : ''}{featChange}%</p>
                <p className="text-xs text-gray-500">vs prior ({featAvgOlder.toFixed(1)})</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800 border border-gray-700">
              <div>
                <p className="text-xs text-gray-500 uppercase">Infra pts/week</p>
                <p className="text-xl font-bold text-gray-200">{infraAvgRecent.toFixed(1)} <span className="text-sm text-gray-500">avg ({recentHalf.length}w)</span></p>
              </div>
              <div className={`text-right ${infraChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                <p className="text-2xl font-bold">{infraChange >= 0 ? '+' : ''}{infraChange}%</p>
                <p className="text-xs text-gray-500">vs prior ({infraAvgOlder.toFixed(1)})</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Charts */}
      <VelocityChart
        trends={data.trends}
        viewMode={viewMode}
        timeRange={timeRange}
        chartMode={chartMode}
        onChartModeChange={setChartMode}
        infoContent={
          <>
            <p>Shows the team&apos;s total story points delivered each week over time.</p>
            <p className="mt-2">The purple line is actual weekly output. Dashed trend lines show the trajectory before and after team composition changes.</p>
            <p className="mt-2">Higher is better — this represents raw team throughput regardless of team size.</p>
          </>
        }
      />
      <VelocityWorkTypeChart
        weeks={filteredWeeks}
        timeRange={timeRange}
        chartMode={chartMode}
        infoContent={
          <>
            <p>Breaks down weekly story points into <strong>Features</strong> (everything that ships product value) vs <strong>Infrastructure</strong> (DevOps + Infrastructure work).</p>
            <p className="mt-2">Helps track investment balance between shipping features and building/maintaining the platform.</p>
          </>
        }
      />
      <VelocityContributorChart
        weeks={filteredWeeks}
        timeRange={timeRange}
        infoContent={
          <>
            <p>Shows each contributor&apos;s individual story points output per week.</p>
            <p className="mt-2">Multi-author PRs have their points split proportionally between contributors based on commit attribution.</p>
            <p className="mt-2">This helps identify individual output trends and contribution balance across the team.</p>
          </>
        }
      />

      {/* Author breakdown — full width */}
      <VelocityAuthorBreakdown authors={filteredAuthors} />

      {/* PR Table — full width */}
      {filteredWeeks.some(w => w.prs.length > 0) && (
        <div className="mt-6 bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
            PRs — {rangeLabel}{" "}
            <span className="text-gray-500">({filteredWeeks.reduce((s, w) => s + w.prs.length, 0)})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-700">
                  <th className="pb-2 pr-4">PR</th>
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">Author</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Merged</th>
                  <th className="pb-2 pr-4 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const allPRs = filteredWeeks.flatMap(w => w.prs)
                    .sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime());
                  const visiblePRs = showAllPRs ? allPRs : allPRs.slice(0, 10);
                  return visiblePRs.map((pr) => (
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
                      <td className="py-2 pr-4 text-gray-500 text-xs tabular-nums">
                        {pr.mergedAt ? (() => { const d = new Date(pr.mergedAt); const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }; if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'; return d.toLocaleDateString('en-US', opts); })() : '—'}
                      </td>
                      <td className="py-2 text-right font-bold text-indigo-400">
                        {pr.points}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
          {(() => {
            const totalPRsCount = filteredWeeks.reduce((s, w) => s + w.prs.length, 0);
            if (totalPRsCount > 10) {
              return (
                <button
                  onClick={() => setShowAllPRs(!showAllPRs)}
                  className="mt-4 w-full py-2 text-xs text-gray-400 hover:text-gray-200 bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
                >
                  {showAllPRs ? "Show less" : `Show all ${totalPRsCount} PRs`}
                </button>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Stories — full width */}
      <VelocityStoryList
        stories={filteredWeeks.flatMap(w => w.stories ?? [])}
        week={rangeLabel}
      />
    </div>
  );
}
