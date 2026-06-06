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
import ProjectSwitcher from "@/components/ProjectSwitcher";
import { authFetch, setToken, clearToken } from "@/lib/auth";

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  projectIds: string[];
  jiraEnabled: boolean;
};

export type Epic = {
  key: string;
  summary: string;
  status: string;
  readiness: string;
  startDate: string | null;
  dueDate: string | null;
  description: string | null;
  priority: string;
  priorityId: string;
  jiraRank: string;
};

export type Metrics = {
  totalStories: number;
  openBugs: number;
};

export type ReadinessGroup = "Researching" | "Ready" | "Backlog" | "Done";

export function getReadinessGroup(readiness: string): ReadinessGroup {
  if (readiness === "Researching") return "Researching";
  if (readiness === "Ready") return "Ready";
  if (readiness === "Done") return "Done";
  return "Backlog";
}

export default function Home() {
  const baseUrl = projects[0].baseUrl;
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [currentProject, setCurrentProject] = useState(projects[0]);

  const [epics, setEpics] = useState<Epic[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [showReady, setShowReady] = useState(false);
  const [showBacklog, setShowBacklog] = useState(false);
  const [showDone, setShowDone] = useState(false);

  // Check session on mount
  useEffect(() => {
    authFetch(`${baseUrl}/api/auth/me`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setUser(data.user);
          const userProjs = projects.filter(p => data.user.projectIds.includes(p.id) || data.user.role === 'superadmin');
          const saved = localStorage.getItem('lastProject');
          const savedProj = saved ? userProjs.find(p => p.id === saved) : null;
          setCurrentProject(savedProj || userProjs[0] || projects[0]);
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, [baseUrl]);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await authFetch(`${currentProject.apiUrl}?project=${currentProject.jiraProject}`);
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
  }, [user, currentProject]);

  const handleLogout = async () => {
    clearToken();
    await authFetch(`${baseUrl}/api/auth/logout`, {
      method: "POST"
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
    return <LoginPage apiUrl={baseUrl} onLogin={(u) => {
      setUser(u);
      // Determine initial project after login
      const userProjects = projects.filter(p => u.projectIds.includes(p.id) || u.role === 'superadmin');
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('lastProject') : null;
      const savedProject = saved ? userProjects.find(p => p.id === saved) : null;
      const initial = savedProject || userProjects[0] || projects[0];
      setCurrentProject(initial);
    }} />;
  }

  // Projects this user can access
  const userProjects = projects.filter(p => user.projectIds.includes(p.id) || user.role === 'superadmin');

  function handleProjectSwitch(p: typeof projects[0]) {
    setCurrentProject(p);
    localStorage.setItem('lastProject', p.id);
  }

  const researching = epics.filter(e => getReadinessGroup(e.readiness) === "Researching");
  const ready = epics.filter(e => getReadinessGroup(e.readiness) === "Ready");
  const backlog = epics.filter(e => getReadinessGroup(e.readiness) === "Backlog");
  const done = epics.filter(e => getReadinessGroup(e.readiness) === "Done");

  const rankMap = Object.fromEntries(researching.map((e, i) => [e.key, i + 1]));

  const timelineEpics = [
    ...researching,
    ...(showReady ? ready : []),
    ...(showBacklog ? backlog : []),
    ...(showDone ? done : []),
  ];

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <ProjectSwitcher projects={userProjects} currentProject={currentProject} onSwitch={handleProjectSwitch} />
        <div className="text-right flex items-center gap-3">
          <FeedbackButton apiUrl={baseUrl} user={user} />
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
            researching={researching.length}
            ready={ready.length}
            done={done.length}
            totalStories={metrics?.totalStories || 0}
            openBugs={metrics?.openBugs || 0}
          />
          <EpicList
            researching={researching}
            ready={ready}
            backlog={backlog}
            done={done}
            showSection="active"
            hoveredKey={hoveredKey}
            onHover={setHoveredKey}
            jiraEnabled={user?.jiraEnabled}
          />
          <EpicTimeline
            epics={timelineEpics}
            hoveredKey={hoveredKey}
            onHover={setHoveredKey}
            showReady={showReady}
            showBacklog={showBacklog}
            showDone={showDone}
            onToggleReady={() => setShowReady(v => !v)}
            onToggleBacklog={() => setShowBacklog(v => !v)}
            onToggleDone={() => setShowDone(v => !v)}
            readyCount={ready.length}
            backlogCount={backlog.length}
            doneCount={done.length}
            rankMap={rankMap}
          />
          <EpicList
            researching={researching}
            ready={ready}
            backlog={backlog}
            done={done}
            showSection="secondary"
            showReady={showReady}
            showBacklog={showBacklog}
            showDone={showDone}
            jiraEnabled={user?.jiraEnabled}
          />
        </>
      )}

      {showAdmin && user.role === "superadmin" && (
        <AdminPanel apiUrl={baseUrl} onClose={() => setShowAdmin(false)} />
      )}
    </main>
  );
}
