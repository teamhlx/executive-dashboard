"use client";
import { useState, useRef, useEffect } from "react";

interface Project {
  id: string;
  name: string;
  jiraProject: string;
  description: string;
  apiUrl: string;
  baseUrl: string;
}

interface ProjectSwitcherProps {
  projects: Project[];
  currentProject: Project;
  onSwitch: (project: Project) => void;
}

export default function ProjectSwitcher({ projects, currentProject, onSwitch }: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (projects.length <= 1) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{currentProject.name}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{currentProject.description}</p>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-left group"
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          {currentProject.name}
          <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{currentProject.description}</p>
      </button>
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl py-1">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => { onSwitch(p); setOpen(false); }}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                p.id === currentProject.id
                  ? "bg-indigo-50 dark:bg-indigo-900/20"
                  : ""
              }`}
            >
              <div className={`font-semibold ${p.id === currentProject.id ? "text-indigo-600 dark:text-indigo-400" : "text-gray-900 dark:text-gray-200"}`}>{p.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
