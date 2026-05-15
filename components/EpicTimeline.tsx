"use client";

import { Epic, getStatusGroup } from "@/app/page";

type Props = {
  epics: Epic[];
  hoveredKey: string | null;
  onHover: (key: string | null) => void;
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

export default function EpicTimeline({ epics, hoveredKey, onHover }: Props) {
  // Only render epics that have at least a due date
  const epicsWithDates = epics.filter(e => e.dueDate);
  if (epicsWithDates.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDates: number[] = epicsWithDates.map(e => parseDate(e.dueDate)!.getTime());
  const explicitStartDates: number[] = epicsWithDates
    .filter(e => e.startDate)
    .map(e => parseDate(e.startDate)!.getTime());

  // Left edge: 1 month before today, or earlier if an epic explicitly started before that
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const earliestStart = explicitStartDates.length > 0 ? Math.min(...explicitStartDates) : today.getTime();
  const minDate = new Date(Math.min(earliestStart, oneMonthAgo.getTime()));

  // Right edge: latest due date + 1 month padding
  const maxDate = new Date(Math.max(...dueDates));
  maxDate.setMonth(maxDate.getMonth() + 1);

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
      <h2 className="text-lg font-semibold text-gray-200 mb-4">Timeline</h2>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        {/* Scrollable timeline area */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: "640px" }}>
            {/* Month markers — offset to align with bar area */}
            <div className="flex">
              <div className="w-32 shrink-0" />
              <div className="flex-1 relative h-6 mb-2">
                {markers.map((m) => (
                  <span
                    key={m.label}
                    className="absolute text-xs text-gray-500 transform -translate-x-1/2"
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
                  <div className="w-32 shrink-0" />
                  <div className="flex-1 relative">
                    <div
                      className="absolute top-0 bottom-0 w-px bg-indigo-500/50 z-10"
                      style={{ left: `${todayPct}%` }}
                    >
                      <span className="absolute -top-5 text-xs text-indigo-400 transform -translate-x-1/2">Today</span>
                    </div>
                  </div>
                </div>
              )}

              {epicsWithDates.map((epic) => {
                const group = getStatusGroup(epic.status);
                const endDate = parseDate(epic.dueDate)!;
                const startDate = parseDate(epic.startDate) ?? today;

                const barLeft = Math.max(0, Math.min(getLeftPct(startDate), 100));
                const barRight = Math.max(0, Math.min(getLeftPct(endDate), 100));
                const barWidth = Math.max(barRight - barLeft, 1.5);

                const isHovered = epic.key === hoveredKey;
                const rowBg = isHovered ? "bg-white/5" : "";
                const barBg = isHovered ? (STATUS_BG_SOLID[group] ?? STATUS_BG[group]) : STATUS_BG[group];

                return (
                  <div
                    key={epic.key}
                    className={`flex items-center mb-2 rounded transition-colors ${rowBg}`}
                    onMouseEnter={() => onHover(epic.key)}
                    onMouseLeave={() => onHover(null)}
                  >
                    <div className="w-32 shrink-0 pr-3 text-xs text-gray-400 truncate text-right">{epic.summary}</div>
                    <div className="flex-1 relative h-6">
                      <div
                        className={`absolute h-5 rounded-full top-0.5 ${barBg} border ${STATUS_COLORS[group]?.replace("bg-", "border-")}/30 flex items-center px-2 cursor-pointer transition-all`}
                        style={{ left: `${barLeft}%`, width: `${barWidth}%`, minWidth: "60px" }}
                        title={epic.description || epic.summary}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[group]}`} />
                        <span className="ml-1.5 text-xs text-gray-300 truncate hidden sm:block">{epic.summary}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-6 mt-4 pt-4 border-t border-gray-800">
          {Object.entries(STATUS_COLORS).map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
