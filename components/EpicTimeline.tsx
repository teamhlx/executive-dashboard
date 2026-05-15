"use client";

import { Epic, getStatusGroup } from "@/app/page";

type Props = {
  epics: Epic[];
  hoveredKey: string | null;
  onHover: (key: string | null) => void;
  showUpcoming: boolean;
  showHistorical: boolean;
  onToggleUpcoming: () => void;
  onToggleHistorical: () => void;
  upcomingCount: number;
  historicalCount: number;
  rankMap?: Record<string, number>;
};

const STATUS_COLORS: Record<string, string> = {
  "In Progress": "bg-yellow-400",
  "To Do": "bg-blue-500",
  "Complete": "bg-green-500",
};

const STATUS_BG: Record<string, string> = {
  "In Progress": "bg-yellow-400/20",
  "To Do": "bg-blue-500/20",
  "Complete": "bg-green-500/20",
};

const STATUS_BG_SOLID: Record<string, string> = {
  "In Progress": "bg-yellow-400/40",
  "To Do": "bg-blue-500/40",
  "Complete": "bg-green-500/40",
};

function parseDate(str: string | null): Date | null {
  if (!str) return null;
  return new Date(str);
}

export default function EpicTimeline({ epics, hoveredKey, onHover, showUpcoming, showHistorical, onToggleUpcoming, onToggleHistorical, upcomingCount, historicalCount, rankMap = {} }: Props) {
  if (epics.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Separate epics with/without due dates
  const epicsWithDue = epics.filter(e => e.dueDate);
  const epicsNoDue = epics.filter(e => !e.dueDate);

  // Need at least one dated epic to build the timeline range
  if (epicsWithDue.length === 0 && epicsNoDue.length === 0) return null;

  const dueDates: number[] = epicsWithDue.map(e => parseDate(e.dueDate)!.getTime());
  const explicitStartDates: number[] = epics
    .filter(e => e.startDate)
    .map(e => parseDate(e.startDate)!.getTime());

  // Left edge: 1 month before today, or earlier if an epic explicitly started before that
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const earliestStart = explicitStartDates.length > 0 ? Math.min(...explicitStartDates) : today.getTime();
  const minDate = new Date(Math.min(earliestStart, oneMonthAgo.getTime()));

  // Right edge: latest due date + 1 month padding (fallback: today + 3 months)
  const maxDateMs = dueDates.length > 0 ? Math.max(...dueDates) : today.getTime() + 90 * 24 * 60 * 60 * 1000;
  const maxDate = new Date(maxDateMs);
  maxDate.setMonth(maxDate.getMonth() + 1);

  const epicsWithDates = epics; // now all epics render

  const totalMs = maxDate.getTime() - minDate.getTime();

  function getLeftPct(date: Date) {
    return ((date.getTime() - minDate.getTime()) / totalMs) * 100;
  }

  // Generate month markers
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

  // Today marker
  const todayPct = getLeftPct(new Date());

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-200">Timeline</h2>
        <div className="flex gap-2">
          <button
            onClick={onToggleUpcoming}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showUpcoming
                ? "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-400/20 dark:border-blue-400/40 dark:text-blue-300"
                : "bg-white border-gray-300 text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {showUpcoming ? "Hide" : "Show"} Upcoming ({upcomingCount})
          </button>
          <button
            onClick={onToggleHistorical}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showHistorical
                ? "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-green-400/20 dark:border-green-400/40 dark:text-green-300"
                : "bg-white border-gray-300 text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {showHistorical ? "Hide" : "Show"} Historical ({historicalCount})
          </button>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        {/* Scrollable timeline area */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: "640px" }}>
            {/* Month markers — offset to align with bar area */}
            <div className="flex">
              <div className="w-10 shrink-0" />
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

            {/* Timeline rows */}
            <div className="relative">
              {/* Today line — only over the bar area, offset by label width */}
              {todayPct >= 0 && todayPct <= 100 && (
                <div className="absolute top-0 bottom-0 flex pointer-events-none" style={{ left: 0, right: 0 }}>
                  <div className="w-10 shrink-0" />
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

              {epicsWithDates.map((epic) => {
                const group = getStatusGroup(epic.status);
                const startDate = parseDate(epic.startDate) ?? today;
                const hasDueDate = !!epic.dueDate;
                const endDate = hasDueDate ? parseDate(epic.dueDate)! : startDate;
                const isOverdue = hasDueDate && group === "In Progress" && endDate < today;

                const barLeft = Math.max(0, Math.min(getLeftPct(startDate), 100));
                const barRight = Math.max(0, Math.min(getLeftPct(endDate), 100));
                const barWidth = hasDueDate ? Math.max(barRight - barLeft, 1.5) : 0;

                const isHovered = epic.key === hoveredKey;
                const rowBg = isHovered ? "bg-gray-100 dark:bg-white/5" : "";
                const barBg = isOverdue
                  ? (isHovered ? "bg-red-500/40" : "bg-red-500/20")
                  : (isHovered ? (STATUS_BG_SOLID[group] ?? STATUS_BG[group]) : STATUS_BG[group]);
                const barBorder = isOverdue
                  ? "border-red-500/50"
                  : `${STATUS_COLORS[group]?.replace("bg-", "border-")}/30`;

                return (
                  <div
                    key={epic.key}
                    className={`flex items-center mb-2 rounded transition-all duration-300 ease-in-out ${rowBg}`}
                    onMouseEnter={() => onHover(epic.key)}
                    onMouseLeave={() => onHover(null)}
                  >
                    <div className="w-10 shrink-0 flex items-center justify-end pr-2 relative">
                      {rankMap[epic.key] !== undefined ? (
                        <span className={`text-xs font-bold w-6 h-6 rounded-full text-white flex items-center justify-center ${isOverdue ? 'bg-red-500' : 'bg-indigo-600'}`}>{rankMap[epic.key]}</span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-gray-400/40" />
                      )}
                    </div>
                    <div className="flex-1 relative h-6">
                      {hasDueDate ? (
                        // Full bar for epics with a due date
                        <div
                          className={`absolute h-5 rounded-full top-0.5 ${barBg} border ${barBorder} flex items-center px-2 cursor-pointer transition-all`}
                          style={{ left: `${barLeft}%`, width: `${barWidth}%`, minWidth: "60px" }}
                          title={epic.description || epic.summary}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[group]}`} />
                          <span className="ml-1.5 text-xs text-gray-700 dark:text-gray-300 truncate hidden sm:block">{epic.summary}</span>
                        </div>
                      ) : (
                        // Dot pin for epics with no due date — placed at start date
                        <div
                          className="absolute top-0.5 flex items-center cursor-pointer"
                          style={{ left: `${barLeft}%` }}
                          title={`${epic.summary} — no due date set`}
                        >
                          <span className={`w-4 h-4 rounded-full ${STATUS_COLORS[group]} flex items-center justify-center`}>
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

        {/* Legend */}
        <div className="flex gap-6 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
          {Object.entries(STATUS_COLORS).map(([label, color]) => (
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
