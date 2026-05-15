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
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

function EpicCard({ epic, statusColor, statusBg, statusLabel, isHovered, onMouseEnter, onMouseLeave }: EpicCardProps) {
  return (
    <div
      className={`rounded-lg border ${statusBg} p-4 transition-all cursor-default ${isHovered ? "ring-2 ring-indigo-400/60 brightness-110" : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-white leading-snug">{epic.summary}</h3>
        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor} opacity-90`}>
          {statusLabel}
        </span>
      </div>
      {epic.description && (
        <p className="text-xs text-gray-300 leading-relaxed">{epic.description}</p>
      )}
      {(epic.startDate || epic.dueDate) && (
        <p className="text-xs text-gray-400 mt-2">
          {epic.startDate && (
            <>
              Start: {new Date(epic.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </>
          )}
          {epic.startDate && epic.dueDate && <span className="mx-1">·</span>}
          {epic.dueDate && (
            <>
              Target: {new Date(epic.dueDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </>
          )}
        </p>
      )}
    </div>
  );
}

const SECTION_CONFIG = {
  inProgress: { label: "In Progress", statusLabel: "In Progress", color: "text-yellow-300 bg-yellow-400/20", bg: "bg-yellow-400/10 border-yellow-400/30" },
  toDo: { label: "Upcoming", statusLabel: "Upcoming", color: "text-blue-300 bg-blue-400/20", bg: "bg-blue-400/10 border-blue-400/30" },
  complete: { label: "Historical", statusLabel: "Complete", color: "text-green-300 bg-green-400/20", bg: "bg-green-400/10 border-green-400/30" },
};

export default function EpicList({ inProgress, toDo, complete, showSection, hoveredKey = null, onHover, showUpcoming = false, showHistorical = false, onToggleUpcoming, onToggleHistorical }: Props) {
  // toggle state is now lifted — use props if provided, else local fallback
  const [localShowUpcoming, setLocalShowUpcoming] = useState(false);
  const [localShowHistorical, setLocalShowHistorical] = useState(false);
  const isUpcoming = onToggleUpcoming ? showUpcoming : localShowUpcoming;
  const isHistorical = onToggleHistorical ? showHistorical : localShowHistorical;
  const toggleUpcoming = onToggleUpcoming ?? (() => setLocalShowUpcoming(v => !v));
  const toggleHistorical = onToggleHistorical ?? (() => setLocalShowHistorical(v => !v));

  if (showSection === "active") {
    return (
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">In Progress</h2>
        {inProgress.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SECTION_CONFIG.inProgress.color}`}>
                {SECTION_CONFIG.inProgress.label}
              </span>
              <span className="text-xs text-gray-500">{inProgress.length} epic{inProgress.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {inProgress.map(epic => (
                <EpicCard
                  key={epic.key}
                  epic={epic}
                  statusColor={SECTION_CONFIG.inProgress.color}
                  statusBg={SECTION_CONFIG.inProgress.bg}
                  statusLabel={SECTION_CONFIG.inProgress.statusLabel}
                  isHovered={epic.key === hoveredKey}
                  onMouseEnter={() => onHover?.(epic.key)}
                  onMouseLeave={() => onHover?.(null)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // showSection === "historical"
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Epics</h2>
        <div className="flex gap-2">
          <button
            onClick={() => toggleUpcoming()}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              isUpcoming
                ? "bg-blue-400/20 border-blue-400/40 text-blue-300"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
            }`}
          >
            {isUpcoming ? "Hide" : "Show"} Upcoming ({toDo.length})
          </button>
          <button
            onClick={() => toggleHistorical()}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              isHistorical
                ? "bg-green-400/20 border-green-400/40 text-green-300"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
            }`}
          >
            {isHistorical ? "Hide" : "Show"} Historical ({complete.length})
          </button>
        </div>
      </div>

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
