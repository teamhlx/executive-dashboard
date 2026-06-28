"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
  title: string;
  children: React.ReactNode;
};

export default function ChartInfoButton({ title, children }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block ml-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-gray-500 hover:text-gray-300 transition-colors leading-none focus:outline-none"
        title={`About: ${title}`}
        aria-label={`Info about ${title}`}
      >
        <svg
          className="w-3.5 h-3.5 inline-block"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 4a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-50 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 text-xs text-gray-300"
          style={{ top: "calc(100% + 6px)", right: 0 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-100 font-semibold text-sm">{title}</span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-300 transition-colors focus:outline-none ml-2"
              aria-label="Close"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <div className="leading-relaxed">{children}</div>
        </div>
      )}
    </div>
  );
}
