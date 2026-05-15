"use client";

import { useEffect, useState } from "react";
import MetricCards from "@/components/MetricCards";
import EpicTimeline from "@/components/EpicTimeline";
import EpicList from "@/components/EpicList";
import ThemeToggle from "@/components/ThemeToggle";
import FeedbackButton from "@/components/FeedbackButton";
import LoginPage from "@/components/LoginPage";
import AdminPanel from "@/components/AdminPanel";
import { projects } from "@/projects.config";

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  projectIds: string[];
};

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
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);

  const [epics, setEpics] = useState<Epic[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);

  // Check session on mount
  useEffect(() => {
    fetch(`${project.apiUrl}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, [project.apiUrl]);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch(`${project.apiUrl}?project=${project.jiraProject}`, {
        credentials: "include"
      });
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
    if (user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogout = async () => {
    await fetch(`${project.apiUrl}/api/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
    setUser(null);
    setEpics([]);
    setMetrics(null);
  };

  // Auth loading spinner
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse text-sm">Loading…</div>
      </div>
    );
  }

  // Login gate
  if (!user) {
    return <LoginPage apiUrl={project.apiUrl} onLogin={setUser} />;
  }

  const visibleEpics = epics.filter(e => getStatusGroup(e.status) !== "Other");
  const inProgress = visibleEpics.filter(e => getStatusGroup(e.status) === "In Progress");
  const toDo = visibleEpics.filter(e => getStatusGroup(e.status) === "To Do");
  const complete = visibleEpics.filter(e => getStatusGroup(e.status) === "Complete");

  const timelineEpics = [
    ...inProgress,
    ...(showUpcoming ? toDo : []),
    ...(showHistorical ? complete : []),
  ];

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{project.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{project.description}</p>
        </div>
        <div className="text-right flex items-center gap-3">
          <FeedbackButton apiUrl={project.apiUrl} user={user} />
          <ThemeToggle />
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{displayName}</span>
              {user.role === "superadmin" && (
                <button
                  onClick={() => setShowAdmin(true)}
                  className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                >
                  Admin
                </button>
              )}
              <button
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                Sign out
              </button>
            </div>
            <button
              onClick={fetchData}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
            >
              ↻ Refresh
            </button>
            {lastUpdated && (
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 dark:text-gray-400 animate-pulse">Loading dashboard…</div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-4 text-red-700 dark:text-red-300 mb-6">
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
          <EpicTimeline
            epics={timelineEpics}
            hoveredKey={hoveredKey}
            onHover={setHoveredKey}
            showUpcoming={showUpcoming}
            showHistorical={showHistorical}
            onToggleUpcoming={() => setShowUpcoming(v => !v)}
            onToggleHistorical={() => setShowHistorical(v => !v)}
            upcomingCount={toDo.length}
            historicalCount={complete.length}
          />
          <EpicList
            inProgress={inProgress}
            toDo={toDo}
            complete={complete}
            showSection="historical"
            showUpcoming={showUpcoming}
            showHistorical={showHistorical}
          />
        </>
      )}

      {showAdmin && user.role === "superadmin" && (
        <AdminPanel apiUrl={project.apiUrl} onClose={() => setShowAdmin(false)} />
      )}
    </main>
  );
}
