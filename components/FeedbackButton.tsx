"use client";

import { useState } from "react";
import { User } from "@/app/page";
import FeedbackModal from "./FeedbackModal";
import FeedbackHistory from "./FeedbackHistory";

interface FeedbackButtonProps {
  apiUrl: string;
  user: User;
}

export default function FeedbackButton({ apiUrl, user }: FeedbackButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setHistoryOpen(true)}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors underline underline-offset-2"
        >
          My Reports
        </button>
        <button
          onClick={() => setModalOpen(true)}
          className="text-sm border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-md px-3 py-1.5 transition-colors"
        >
          Report an Issue
        </button>
      </div>

      {modalOpen && (
        <FeedbackModal
          apiUrl={apiUrl}
          user={user}
          onClose={() => setModalOpen(false)}
        />
      )}

      {historyOpen && (
        <FeedbackHistory
          apiUrl={apiUrl}
          user={user}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}
