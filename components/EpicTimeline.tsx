"use client";

import { Epic, getReadinessGroup } from "@/app/page";

type Props = {
  epics: Epic[];
  hoveredKey: string | null;
  onHover: (key: string | null) => void;
  showResearching: boolean;
  showBacklog: boolean;
  showDone: boolean;
  onToggleResearching: () => void;
  onToggleBacklog: () => void;
  onToggleDone: () => void;
  researchingCount: number;
  backlogCount: number;
  doneCount: number;
  rankMap?: Record<string, number>;
};

const READINESS_COLORS: Record<string, string> = {
  "Researching": "bg-yellow-400",
  "Ready": "bg-blue-500",
  "Backlog": "bg-gray-400",
  "Done": "bg-green-500",
};

const READINESS_BG: Record<string, string> = {
  "Researching": "bg-yellow-400/20",
  "Ready": "bg-blue-500/20",
  "Backlog": "bg-gray-400/20",
  "Done": "bg-green-500/20",
};

const READINESS_BG_SOLID: Record<string, string> = {
  "Researching": "bg-yellow-400/40",
  "Ready": "bg-blue-500/40",
  "Backlog": "bg-gray-400/40",
  "Done": "bg-green-500/40",
};

function parseDate(str: string | null): Date | null {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(str);
}

export default function EpicTimeline({ epics, hoveredKey, onHover, showResearching, showBacklog, showDone, onToggleResearching, onToggleBacklog, onToggleDone, researchingCount, backlogCount, doneCount, rankMap = {} }: Props) {
  void rankMap;
  if (epics.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const epicsWithDue = epics.filter(e => e.dueDate);
  const epicsNoDue = epics.filter(e => !e.dueDate);

  if (epicsWithDue.length === 0 && epicsNoDue.length === 0) return null;

  const dueDates: number[] = epicsWithDue.map(e => parseDate(e.dueDate)!.getTime());
  const explicitStartDates: number[] = epics
    .filter(e => e.startDate)
    .map(e => parseDate(e.startDate)!.getTime());

  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const earliestStart = explicitStartDates.length > 0 ? Math.min(...explicitStartDates) : today.getTime();
  const minDate = new Date(Math.min(earliestStart, oneMonthAgo.getTime()));

  const maxDateMs = dueDates.length > 0 ? Math.max(...dueDates) : today.getTime() + 90 * 24 * 60 * 60 * 1000;
  const maxDate = new Date(maxDateMs);
  maxDate.setMonth(maxDate.getMonth() + 1);

  const totalMs = maxDate.getTime() - minDate.getTime();

  function getLeftPct(date: Date) {
    return ((date.getTime() - minDate.getTime()) / totalMs) * 100;
  }

  const markers: { label: string; pct: number }[] = [];
  const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (cursor <= maxDate) {
    const pct = getLeftPct(cursor);
    if (pct >= 0 && pct <= 100) {
      markers.push({
        label: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        pct
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const todayPct = getLeftPct(new Date());

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-200">Timeline</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={onToggleResearching}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showResearching
                ? "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-400/20 dark:border-amber-400/40 dark:text-amber-300"
                : "bg-white border-gray-300 text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {showResearching ? "Hide" : "Show"} Researching ({researchingCount})
          </button>
          <button
            onClick={onToggleBacklog}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showBacklog
                ? "bg-gray-200 border-gray-400 text-gray-700 dark:bg-gray-500/20 dark:border-gray-400/40 dark:text-gray-300"
                : "bg-white border-gray-300 text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {showBacklog ? "Hide" : "Show"} Backlog ({backlogCount})
          </button>
          <button
            onClick={onToggleDone}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showDone
                ? "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-green-400/20 dark:border-green-400/40 dark:text-green-300"
                : "bg-white border-gray-300 text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {showDone ? "Hide" : "Show"} Done ({doneCount})
          </button>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="overflow-x-auto">
          <div style={{ minWidth: "640px" }}>
            <div className="flex">
              <div className="w-52 shrink-0" />
              <div className="flex-1 relative h-6 mb-2">
                {markers.map((m) => (
                  <span
                    key={m.label}
                    className="absolute text-xs text-gray-400 dark:text-gray-500 transform -translate-x-1/2"
                    style={{ left: `${m.pct}%` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              {todayPct >= 0 && todayPct <= 100 && (
                <div className="absolute top-0 bottom-0 flex pointer-events-none" style={{ left: 0, right: 0 }}>
                  <div className="w-52 shrink-0" />
                  <div className="flex-1 relative">
                    <div
                      className="absolute top-0 bottom-0 w-px bg-indigo-500/60 z-10"
                      style={{ left: `${todayPct}%` }}
                    >
                      <span className="absolute -top-5 text-xs text-indigo-600 dark:text-indigo-400 transform -translate-x-1/2">Today</span>
                    </div>
                  </div>
                </div>
              )}

              {epics.map((epic) => {
                const group = getReadinessGroup(epic.readiness);
                const hasDueDate = !!epic.dueDate;
                const startDate = parseDate(epic.startDate) ?? today;
                const endDate = hasDueDate ? parseDate(epic.dueDate)! : startDate;
                const effectiveStart = hasDueDate && startDate > endDate ? endDate : startDate;
                const isOverdue = hasDueDate && group === "Researching" && endDate < today;

                const barLeft = Math.max(0, Math.min(getLeftPct(effectiveStart), 100));
                const barRight = Math.max(0, Math.min(getLeftPct(endDate), 100));
                const barWidth = hasDueDate ? Math.max(barRight - barLeft, 1.5) : 0;

                const isHovered = epic.key === hoveredKey;
                const rowBg = isHovered ? "bg-gray-100 dark:bg-white/5" : "";
                const barBg = isOverdue
                  ? (isHovered ? "bg-red-500/40" : "bg-red-500/20")
                  : (isHovered ? (READINESS_BG_SOLID[group] ?? READINESS_BG[group]) : READINESS_BG[group]);
                const barBorder = isOverdue
                  ? "border-red-500/50"
                  : `${READINESS_COLORS[group]?.replace("bg-", "border-")}/30`;

                return (
                  <div
                    key={epic.key}
                    className={`flex items-center mb-2 rounded transition-all duration-300 ease-in-out ${rowBg}`}
                    onMouseEnter={() => onHover(epic.key)}
                    onMouseLeave={() => onHover(null)}
                  >
                    <div className="w-52 shrink-0 pr-3 text-xs text-gray-600 dark:text-gray-400 truncate text-right">
                      {epic.summary}
                    </div>
                    <div className="flex-1 relative h-6">
                      {hasDueDate ? (
                        <div
                          className={`absolute h-5 rounded-full top-0.5 ${barBg} border ${barBorder} flex items-center px-2 cursor-pointer transition-all`}
                          style={{ left: `${barLeft}%`, width: `${barWidth}%`, minWidth: "60px" }}
                          title={epic.description || epic.summary}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${READINESS_COLORS[group]}`} />
                          <span className="ml-1.5 text-xs text-gray-700 dark:text-gray-300 truncate hidden sm:block">{epic.summary}</span>
                        </div>
                      ) : (
                        <div
                          className="absolute top-0.5 flex items-center cursor-pointer"
                          style={{ left: `${barLeft}%` }}
                          title={`${epic.summary} — no due date set`}
                        >
                          <span className={`w-4 h-4 rounded-full ${READINESS_COLORS[group]} flex items-center justify-center`}>
                            <span className="w-2 h-2 rounded-full bg-white/60" />
                          </span>
                          <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400 hidden sm:block">No due date</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-6 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
          {Object.entries(READINESS_COLORS).map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
