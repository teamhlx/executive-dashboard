"use client";

import { useEffect, useState } from "react";
import { User } from "@/app/page";

interface FeedbackItem {
  id: string;
  submittedBy: string;
  description: string;
  status: string;
  jiraTicketKey: string | null;
  screenshotUrl: string | null;
  createdAt: string;
}

interface FeedbackHistoryProps {
  apiUrl: string;
  user: User;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  not_reviewed: { label: "Not yet reviewed", className: "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300" },
  under_review: { label: "Under review", className: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" },
  linked: { label: "", className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  resolved: { label: "Resolved", className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
};

function StatusBadge({ status, jiraTicketKey }: { status: string; jiraTicketKey: string | null }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_reviewed;
  const label = status === "linked" && jiraTicketKey ? `→ ${jiraTicketKey}` : (config.label || status);
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.className}`}>
      {label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="p-4 border-b border-gray-100 dark:border-gray-700 animate-pulse">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
    </div>
  );
}

export default function FeedbackHistory({ apiUrl, user, onClose }: FeedbackHistoryProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiUrl}/api/feedback`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setItems(data.feedback || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [apiUrl]);

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white text-base">My Reports</h2>
            <p className="text-xs text-gray-400 mt-0.5">{displayName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {!loading && error && (
            <div className="p-5 text-sm text-red-500 dark:text-red-400">
              Failed to load: {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="p-5 text-sm text-gray-500 dark:text-gray-400 text-center mt-8">
              No reports yet.
            </div>
          )}

          {!loading && !error && items.map(item => (
            <div
              key={item.id}
              className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 mb-2">
                {item.description}
              </p>
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={item.status} jiraTicketKey={item.jiraTicketKey} />
                <span className="text-xs text-gray-400">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
