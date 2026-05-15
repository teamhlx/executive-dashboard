"use client";

import { useEffect, useState } from "react";
import MetricCards from "@/components/MetricCards";
import EpicTimeline from "@/components/EpicTimeline";
import EpicList from "@/components/EpicList";
import { projects } from "@/projects.config";

export type Epic = {
  key: string;
  summary: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  description: string | null;
};

export type Metrics = {
  totalStories: number;
  openBugs: number;
};

export type StatusGroup = "In Progress" | "To Do" | "Complete" | "Other";

export function getStatusGroup(status: string): StatusGroup {
  if (status === "In Progress") return "In Progress";
  if (status === "To Do") return "To Do";
  if (status === "Deployed to Production") return "Complete";
  return "Other";
}

export default function Home() {
  const project = projects[0];
  const [epics, setEpics] = useState<Epic[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch(`${project.apiUrl}?project=${project.jiraProject}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setEpics(data.epics || []);
      setMetrics(data.metrics || null);
      setLastUpdated(new Date());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const visibleEpics = epics.filter(e => getStatusGroup(e.status) !== "Other");
  const inProgress = visibleEpics.filter(e => getStatusGroup(e.status) === "In Progress");
  const toDo = visibleEpics.filter(e => getStatusGroup(e.status) === "To Do");
  const complete = visibleEpics.filter(e => getStatusGroup(e.status) === "Complete");

  // Build the epic set visible in the Gantt — dynamically matches what's shown in cards
  const timelineEpics = [
    ...inProgress,
    ...(showUpcoming ? toDo : []),
    ...(showHistorical ? complete : []),
  ];

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{project.name}</h1>
          <p className="text-gray-400 mt-1">{project.description}</p>
        </div>
        <div className="text-right">
          <button
            onClick={fetchData}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            ↻ Refresh
          </button>
          {lastUpdated && (
            <p className="text-xs text-gray-500 mt-1">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400 animate-pulse">Loading dashboard...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 mb-6">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <MetricCards
            inProgress={inProgress.length}
            toDo={toDo.length}
            complete={complete.length}
            totalStories={metrics?.totalStories || 0}
            openBugs={metrics?.openBugs || 0}
          />
          <EpicList
            inProgress={inProgress}
            toDo={toDo}
            complete={complete}
            showSection="active"
            hoveredKey={hoveredKey}
            onHover={setHoveredKey}
          />
          <EpicTimeline epics={timelineEpics} hoveredKey={hoveredKey} onHover={setHoveredKey} />
          <EpicList
            inProgress={inProgress}
            toDo={toDo}
            complete={complete}
            showSection="historical"
            showUpcoming={showUpcoming}
            showHistorical={showHistorical}
            onToggleUpcoming={() => setShowUpcoming(v => !v)}
            onToggleHistorical={() => setShowHistorical(v => !v)}
          />
        </>
      )}
    </main>
  );
}
