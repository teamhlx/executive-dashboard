"use client";

import React from "react";
import { Epic } from "@/app/page";

type Props = {
  prdReview: Epic[];
  scoping: Epic[];
  ready: Epic[];
  backlog: Epic[];
  done: Epic[];
  showSection: "active" | "secondary";
  hoveredKey?: string | null;
  onHover?: (key: string | null) => void;
  showPrdReview?: boolean;
  showScoping?: boolean;
  showBacklog?: boolean;
  showDone?: boolean;
  jiraEnabled?: boolean;
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
  jiraEnabled?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
};

function EpicStoryPoints({ completed, total, dateColor }: { completed: number; total: number; dateColor: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  return (
    <div
      className="mt-3"
      title="Completed: Approved, Dev Complete, In Testing (on Staging), QA Testing, StagingItem, UAT Testing, Deployed to Production"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-xs ${dateColor}`}>
          {total > 0 ? `${completed} of ${total} pts` : "No story points"}
        </span>
        {total > 0 && (
          <span className={`text-xs tabular-nums ${dateColor}`}>{pct}%</span>
        )}
      </div>
      {total > 0 && (
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function EpicCard({ epic, statusColor, statusBg, statusLabel, titleColor, descColor, dateColor, isHovered, onMouseEnter, onMouseLeave, rank, epicPriority = 'Medium', jiraEnabled, isExpanded, onToggleExpand }: EpicCardProps) {
  const showPriorityBadge = epicPriority !== 'Medium';
  const showJiraButton = jiraEnabled && isExpanded;
  return (
    <div
      className={`rounded-lg border ${statusBg} p-4 transition-all cursor-pointer ${isHovered ? "ring-2 ring-indigo-500/60" : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onToggleExpand}
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
              Start: {(() => { const [y,m,d] = epic.startDate!.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); })()}
            </>
          )}
          {epic.startDate && epic.dueDate && <span className="mx-1">·</span>}
          {epic.dueDate && (
            <>
              Target: {(() => { const [y,m,d] = epic.dueDate!.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); })()}
            </>
          )}
        </p>
      )}
      <EpicStoryPoints
        completed={epic.completedPoints ?? 0}
        total={epic.storyPoints ?? 0}
        dateColor={dateColor}
      />
      {showJiraButton && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <a
            href={`https://bldglabs.atlassian.net/browse/${epic.key}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors"
          >
            ↗ Launch Jira
          </a>
        </div>
      )}
    </div>
  );
}

const SECTION_CONFIG = {
  prdReview: {
    label: "Initial PRD Review",
    statusLabel: "Initial PRD Review",
    color: "text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-500/20",
    bg: "bg-white dark:bg-gray-800 border-violet-400 dark:border-violet-500/40",
    titleColor: "text-gray-900 dark:text-white",
    descColor: "text-gray-700 dark:text-gray-300",
    dateColor: "text-gray-500 dark:text-gray-400",
  },
  scoping: {
    label: "Engineering Scoping",
    statusLabel: "Engineering Scoping",
    color: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/20",
    bg: "bg-white dark:bg-gray-800 border-amber-400 dark:border-amber-500/40",
    titleColor: "text-gray-900 dark:text-white",
    descColor: "text-gray-700 dark:text-gray-300",
    dateColor: "text-gray-500 dark:text-gray-400",
  },
  ready: {
    label: "Ready to Work",
    statusLabel: "Ready to Work",
    color: "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-500/20",
    bg: "bg-white dark:bg-gray-800 border-sky-400 dark:border-sky-500/40",
    titleColor: "text-gray-900 dark:text-white",
    descColor: "text-gray-700 dark:text-gray-300",
    dateColor: "text-gray-500 dark:text-gray-400",
  },
  backlog: {
    label: "Backlog",
    statusLabel: "Backlog",
    color: "text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-500/20",
    bg: "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-500/40",
    titleColor: "text-gray-900 dark:text-white",
    descColor: "text-gray-700 dark:text-gray-300",
    dateColor: "text-gray-500 dark:text-gray-400",
  },
  done: {
    label: "Done",
    statusLabel: "Done",
    color: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/20",
    bg: "bg-white dark:bg-gray-800 border-emerald-400 dark:border-emerald-500/40",
    titleColor: "text-gray-900 dark:text-white",
    descColor: "text-gray-700 dark:text-gray-300",
    dateColor: "text-gray-500 dark:text-gray-400",
  },
};

function EpicSection({ epics, config, hoveredKey, onHover, jiraEnabled, showRanks, rankMap, expandedKey, onExpandKey }: {
  epics: Epic[];
  config: typeof SECTION_CONFIG[keyof typeof SECTION_CONFIG];
  hoveredKey?: string | null;
  onHover?: (key: string | null) => void;
  jiraEnabled?: boolean;
  showRanks?: boolean;
  rankMap?: Record<string, number>;
  expandedKey: string | null;
  onExpandKey: (key: string | null) => void;
}) {
  if (epics.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${config.color}`}>
          {config.label}
        </span>
        <span className="text-xs text-gray-500">{epics.length} epic{epics.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {epics.map((epic, index) => (
          <EpicCard
            key={epic.key}
            epic={epic}
            statusColor={config.color}
            statusBg={config.bg}
            statusLabel={config.statusLabel}
            titleColor={config.titleColor}
            descColor={config.descColor}
            dateColor={config.dateColor}
            isHovered={epic.key === (hoveredKey ?? null)}
            onMouseEnter={() => onHover?.(epic.key)}
            onMouseLeave={() => onHover?.(null)}
            rank={rankMap ? rankMap[epic.key] : (showRanks ? index + 1 : undefined)}
            epicPriority={epic.priority}
            jiraEnabled={jiraEnabled}
            isExpanded={epic.key === expandedKey}
            onToggleExpand={() => onExpandKey(epic.key === expandedKey ? null : epic.key)}
          />
        ))}
      </div>
    </div>
  );
}

export default function EpicList({ prdReview, scoping, ready, backlog, done, showSection, hoveredKey = null, onHover, showPrdReview = true, showScoping = true, showBacklog = false, showDone = false, jiraEnabled }: Props) {
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);

  if (showSection === "active") {
    // Continuous rank across Ready to Work → Engineering Scoping → PRD Review → Backlog (not Done)
    const rankedEpics: Epic[] = [
      ...ready,
      ...(showScoping ? scoping : []),
      ...(showPrdReview ? prdReview : []),
      ...(showBacklog ? backlog : []),
    ];
    const rankMap = Object.fromEntries(rankedEpics.map((e, i) => [e.key, i + 1]));

    return (
      <div className="mb-10">
        {ready.length > 0 && (
          <div className="mb-6">
            <EpicSection
              epics={ready}
              config={SECTION_CONFIG.ready}
              hoveredKey={hoveredKey}
              onHover={onHover}
              jiraEnabled={jiraEnabled}
              rankMap={rankMap}
              expandedKey={expandedKey}
              onExpandKey={setExpandedKey}
            />
          </div>
        )}
        {showScoping && scoping.length > 0 && (
          <div className="mb-6">
            <EpicSection
              epics={scoping}
              config={SECTION_CONFIG.scoping}
              hoveredKey={hoveredKey}
              onHover={onHover}
              jiraEnabled={jiraEnabled}
              rankMap={rankMap}
              expandedKey={expandedKey}
              onExpandKey={setExpandedKey}
            />
          </div>
        )}
        {showPrdReview && prdReview.length > 0 && (
          <EpicSection
            epics={prdReview}
            config={SECTION_CONFIG.prdReview}
            hoveredKey={hoveredKey}
            onHover={onHover}
            jiraEnabled={jiraEnabled}
            rankMap={rankMap}
            expandedKey={expandedKey}
            onExpandKey={setExpandedKey}
          />
        )}
      </div>
    );
  }

  // secondary section — shows Backlog/Done when toggled on
  // Compute continuous rank across ready + scoping + prdReview (if shown) + backlog (if shown)
  const rankedEpics: Epic[] = [
    ...ready,
    ...(showScoping ? scoping : []),
    ...(showPrdReview ? prdReview : []),
    ...(showBacklog ? backlog : []),
  ];
  const rankMap = Object.fromEntries(rankedEpics.map((e, i) => [e.key, i + 1]));

  const hasAnything = (showBacklog && backlog.length > 0) || (showDone && done.length > 0);
  if (!hasAnything) return null;

  return (
    <div className="mt-8 space-y-8">
      {showBacklog && (
        <EpicSection
          epics={backlog}
          config={SECTION_CONFIG.backlog}
          jiraEnabled={jiraEnabled}
          rankMap={rankMap}
          expandedKey={expandedKey}
          onExpandKey={setExpandedKey}
        />
      )}
      {showDone && (
        <EpicSection
          epics={done}
          config={SECTION_CONFIG.done}
          jiraEnabled={jiraEnabled}
          expandedKey={expandedKey}
          onExpandKey={setExpandedKey}
        />
      )}
    </div>
  );
}
