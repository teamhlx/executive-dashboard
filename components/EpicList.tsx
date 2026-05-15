"use client";

import { useState } from "react";
import { Epic } from "@/app/page";

type Props = {
  inProgress: Epic[];
  toDo: Epic[];
  complete: Epic[];
  showSection: "active" | "historical";
  hoveredKey?: string | null;
  onHover?: (key: string | null) => void;
  // lifted toggle state for dynamic Gantt
  showUpcoming?: boolean;
  showHistorical?: boolean;
  onToggleUpcoming?: () => void;
  onToggleHistorical?: () => void;
};

type EpicCardProps = {
  epic: Epic;
  statusColor: string;
  statusBg: string;
  statusLabel: string;
  titleColor: string;
  descColor: string;
  dateColor: string;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  rank?: number;
  epicPriority?: string;
};

function EpicCard({ epic, statusColor, statusBg, statusLabel, titleColor, descColor, dateColor, isHovered, onMouseEnter, onMouseLeave, rank, epicPriority = 'Medium' }: EpicCardProps) {
  const showPriorityBadge = epicPriority !== 'Medium';
  return (
    <div
      className={`rounded-lg border ${statusBg} p-4 transition-all cursor-default ${isHovered ? "ring-2 ring-indigo-500/60" : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {rank !== undefined && (
            <span className="text-xs font-bold w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 flex-none">{rank}</span>
          )}
          {showPriorityBadge && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 shrink-0">{epicPriority}</span>
          )}
          <h3 className={`text-sm font-semibold ${titleColor} leading-snug`}>{epic.summary}</h3>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      {epic.description && (
        <p className={`text-xs ${descColor} leading-relaxed`}>{epic.description}</p>
      )}
      {(epic.startDate || epic.dueDate) && (
        <p className={`text-xs ${dateColor} mt-2`}>
          {epic.startDate && (
            <>
              Start: {new Date(epic.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </>
          )}
          {epic.startDate && epic.dueDate && <span className="mx-1">·</span>}
          {epic.dueDate && (
            <>
              Target: {new Date(epic.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </>
          )}
        </p>
      )}
    </div>
  );
}

const SECTION_CONFIG = {
  inProgress: {
    label: "In Progress",
    statusLabel: "In Progress",
    color: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/20",
    bg: "bg-white dark:bg-gray-800 border-amber-400 dark:border-amber-500/40",
    titleColor: "text-gray-900 dark:text-white",
    descColor: "text-gray-700 dark:text-gray-300",
    dateColor: "text-gray-500 dark:text-gray-400",
  },
  toDo: {
    label: "Upcoming",
    statusLabel: "Upcoming",
    color: "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-500/20",
    bg: "bg-white dark:bg-gray-800 border-sky-400 dark:border-sky-500/40",
    titleColor: "text-gray-900 dark:text-white",
    descColor: "text-gray-700 dark:text-gray-300",
    dateColor: "text-gray-500 dark:text-gray-400",
  },
  complete: {
    label: "Complete",
    statusLabel: "Complete",
    color: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/20",
    bg: "bg-white dark:bg-gray-800 border-emerald-400 dark:border-emerald-500/40",
    titleColor: "text-gray-900 dark:text-white",
    descColor: "text-gray-700 dark:text-gray-300",
    dateColor: "text-gray-500 dark:text-gray-400",
  },
};

export default function EpicList({ inProgress, toDo, complete, showSection, hoveredKey = null, onHover, showUpcoming = false, showHistorical = false, onToggleUpcoming, onToggleHistorical }: Props) {
  // toggle state is now lifted — use props if provided, else local fallback
  const [, setLocalShowUpcoming] = useState(false);
  const [, setLocalShowHistorical] = useState(false);
  const isUpcoming = showUpcoming;
  const isHistorical = showHistorical;
  const toggleUpcoming = onToggleUpcoming ?? (() => setLocalShowUpcoming(v => !v));
  const toggleHistorical = onToggleHistorical ?? (() => setLocalShowHistorical(v => !v));

  if (showSection === "active") {
    return (
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-200 mb-4">In Progress</h2>
        {inProgress.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SECTION_CONFIG.inProgress.color}`}>
                {SECTION_CONFIG.inProgress.label}
              </span>
              <span className="text-xs text-gray-500">{inProgress.length} epic{inProgress.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {inProgress.map((epic, index) => (
                <EpicCard
                  key={epic.key}
                  epic={epic}
                  statusColor={SECTION_CONFIG.inProgress.color}
                  statusBg={SECTION_CONFIG.inProgress.bg}
                  statusLabel={SECTION_CONFIG.inProgress.statusLabel}
                  titleColor={SECTION_CONFIG.inProgress.titleColor}
                  descColor={SECTION_CONFIG.inProgress.descColor}
                  dateColor={SECTION_CONFIG.inProgress.dateColor}
                  isHovered={epic.key === hoveredKey}
                  onMouseEnter={() => onHover?.(epic.key)}
                  onMouseLeave={() => onHover?.(null)}
                  rank={index + 1}
                  epicPriority={epic.priority}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // showSection === "historical" — buttons are in the Timeline header now, just render cards
  if (!isUpcoming && !isHistorical) return null;

  // suppress unused-warning for toggles when section is "historical" and props are passed
  void toggleUpcoming;
  void toggleHistorical;

  return (
    <div className="mt-8">
      <div className="space-y-8">
        {/* Upcoming — toggle */}
        {isUpcoming && toDo.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SECTION_CONFIG.toDo.color}`}>
                {SECTION_CONFIG.toDo.label}
              </span>
              <span className="text-xs text-gray-500">{toDo.length} epic{toDo.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {toDo.map(epic => (
                <EpicCard
                  key={epic.key}
                  epic={epic}
                  statusColor={SECTION_CONFIG.toDo.color}
                  statusBg={SECTION_CONFIG.toDo.bg}
                  statusLabel={SECTION_CONFIG.toDo.statusLabel}
                  titleColor={SECTION_CONFIG.toDo.titleColor}
                  descColor={SECTION_CONFIG.toDo.descColor}
                  dateColor={SECTION_CONFIG.toDo.dateColor}
                  isHovered={false}
                  onMouseEnter={() => {}}
                  onMouseLeave={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {/* Historical — toggle */}
        {isHistorical && complete.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SECTION_CONFIG.complete.color}`}>
                {SECTION_CONFIG.complete.label}
              </span>
              <span className="text-xs text-gray-500">{complete.length} epic{complete.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {complete.map(epic => (
                <EpicCard
                  key={epic.key}
                  epic={epic}
                  statusColor={SECTION_CONFIG.complete.color}
                  statusBg={SECTION_CONFIG.complete.bg}
                  statusLabel={SECTION_CONFIG.complete.statusLabel}
                  titleColor={SECTION_CONFIG.complete.titleColor}
                  descColor={SECTION_CONFIG.complete.descColor}
                  dateColor={SECTION_CONFIG.complete.dateColor}
                  isHovered={false}
                  onMouseEnter={() => {}}
                  onMouseLeave={() => {}}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
