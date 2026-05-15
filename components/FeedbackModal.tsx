"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { User } from "@/app/page";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface FeedbackAction {
  action: "continue" | "link" | "create";
  jiraKey?: string;
}

interface FeedbackModalProps {
  apiUrl: string;
  user: User;
  onClose: () => void;
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content: "I understand you have an issue with the dashboard. Can you tell me about it?"
};

export default function FeedbackModal({ apiUrl, user, onClose }: FeedbackModalProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [resolvedAction, setResolvedAction] = useState<FeedbackAction | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [screenshotUploaded, setScreenshotUploaded] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(`${apiUrl}/api/feedback/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: newMessages,
          feedbackId
        })
      });

      const data = await res.json();

      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);

      if (data.action && data.action.action !== "continue") {
        setResolvedAction(data.action);
      }
      if (data.feedbackId) {
        setFeedbackId(data.feedbackId);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I had trouble processing that. Please try again."
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, messages, feedbackId, apiUrl]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!feedbackId) return;
    setUploadingScreenshot(true);

    try {
      const urlRes = await fetch(`${apiUrl}/api/feedback/screenshot-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          feedbackId,
          filename: file.name,
          contentType: file.type
        })
      });
      const { uploadUrl, fileUrl } = await urlRes.json();

      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });

      await fetch(`${apiUrl}/api/feedback/${feedbackId}/screenshot`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ screenshotUrl: fileUrl })
      });

      setScreenshotUploaded(true);
    } catch (err) {
      console.error("Screenshot upload failed:", err);
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCloseRequest = () => {
    const hasUserMessages = messages.some(m => m.role === "user");
    if (hasUserMessages && !resolvedAction) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gray-900 dark:bg-gray-800">
          <div>
            <h2 className="text-white font-semibold text-base">Report an Issue</h2>
            <p className="text-gray-400 text-xs mt-0.5">Reporting as: {displayName}</p>
          </div>
          <button
            onClick={handleCloseRequest}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-64 max-h-96 bg-gray-50 dark:bg-gray-850">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-lg p-3 text-sm max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-3 flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Screenshot upload area (shown after resolution) */}
        {resolvedAction && (resolvedAction.action === "link" || resolvedAction.action === "create") && feedbackId && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            {screenshotUploaded ? (
              <p className="text-sm text-green-600 dark:text-green-400 text-center">
                ✓ Screenshot attached
              </p>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-400 transition-colors"
              >
                {uploadingScreenshot ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Uploading…</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Add a screenshot</p>
                    <p className="text-xs text-gray-400 mt-1">Drag & drop or click to choose a file</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
          </div>
        )}

        {/* Input area */}
        <div className="flex gap-2 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your issue…"
            disabled={isTyping || !!resolvedAction}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            autoFocus
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isTyping || !!resolvedAction}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Close confirmation */}
      {showCloseConfirm && (
        <div className="absolute inset-0 bg-black/70 z-10 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Discard report?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you sure? Your report won&apos;t be saved.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Keep going
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
