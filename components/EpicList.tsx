"use client";

import { useState } from "react";
import { Epic } from "@/app/page";

type Props = {
  inProgress: Epic[];
  toDo: Epic[];
  complete: Epic[];
};

type EpicCardProps = { epic: Epic; statusColor: string; statusBg: string; statusLabel: string };

function EpicCard({ epic, statusColor, statusBg, statusLabel }: EpicCardProps) {
  return (
    <div className={`rounded-lg border ${statusBg} p-4`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-medium text-gray-200 leading-snug">{epic.summary}</h3>
        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      {epic.description && (
        <p className="text-xs text-gray-400 leading-relaxed">{epic.description}</p>
      )}
      {epic.dueDate && (
        <p className="text-xs text-gray-500 mt-2">
          Target: {new Date(epic.dueDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      )}
    </div>
  );
}

const SECTION_CONFIG = {
  inProgress: { label: "In Progress", statusLabel: "In Progress", color: "text-yellow-400 bg-yellow-400/10", bg: "bg-yellow-400/5 border-yellow-400/20" },
  toDo: { label: "Upcoming", statusLabel: "Upcoming", color: "text-blue-400 bg-blue-400/10", bg: "bg-blue-400/5 border-blue-400/20" },
  complete: { label: "Historical", statusLabel: "Complete", color: "text-green-400 bg-green-400/10", bg: "bg-green-400/5 border-green-400/20" },
};

export default function EpicList({ inProgress, toDo, complete }: Props) {
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Epics</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUpcoming(!showUpcoming)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showUpcoming
                ? "bg-blue-400/20 border-blue-400/40 text-blue-300"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
            }`}
          >
            {showUpcoming ? "Hide" : "Show"} Upcoming ({toDo.length})
          </button>
          <button
            onClick={() => setShowHistorical(!showHistorical)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showHistorical
                ? "bg-green-400/20 border-green-400/40 text-green-300"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
            }`}
          >
            {showHistorical ? "Hide" : "Show"} Historical ({complete.length})
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* In Progress — always shown */}
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
                />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming — toggle */}
        {showUpcoming && toDo.length > 0 && (
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
                />
              ))}
            </div>
          </div>
        )}

        {/* Historical — toggle */}
        {showHistorical && complete.length > 0 && (
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
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
