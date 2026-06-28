"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ScoringMethodologyModal({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-100">
            How Velocity Scoring Works
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6 text-sm text-gray-300 leading-relaxed">
          {/* Fibonacci Scale */}
          <section>
            <h3 className="text-indigo-400 font-semibold text-base mb-2">
              The Fibonacci Point System
            </h3>
            <p className="mb-3">
              All story points use a <strong className="text-gray-100">modified Fibonacci scale (1, 2, 3, 5, 8, 13, 21)</strong> — the industry-standard approach to engineering velocity measurement. Each pull request is scored based on:
            </p>
            <ul className="space-y-1.5 ml-1">
              <li className="flex gap-2">
                <span className="text-indigo-400 shrink-0">•</span>
                <span><strong className="text-gray-200">Custom code complexity</strong> — algorithmic difficulty, number of interacting systems, edge case handling</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 shrink-0">•</span>
                <span><strong className="text-gray-200">Architectural impact</strong> — does this change the platform&apos;s structure or just add to it?</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 shrink-0">•</span>
                <span><strong className="text-gray-200">Lines of meaningful code</strong> — excluding vendored dependencies, auto-generated files, lock files, and migrations</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 shrink-0">•</span>
                <span><strong className="text-gray-200">Testing and validation</strong> — test coverage, integration tests, validation logic</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400 shrink-0">•</span>
                <span><strong className="text-gray-200">Business value density</strong> — how much user-facing capability does this deliver?</span>
              </li>
            </ul>
            <p className="mt-3 text-gray-400">
              The scale is intentionally non-linear: a 13-point PR is not 13× the effort of a 1-point PR — it&apos;s typically 5–8× more complex, involving multiple systems, significant architecture decisions, and extensive testing. A 21-point PR represents a major feature or subsystem delivery.
            </p>
            <div className="mt-4 flex justify-center">
              <img
                src="/fibonacci-spiral.png"
                alt="Fibonacci spiral visualization showing the non-linear scaling of point values"
                className="rounded-lg border border-gray-700 max-w-sm w-full"
              />
            </div>
          </section>

          {/* Scoring Method */}
          <section>
            <h3 className="text-emerald-400 font-semibold text-base mb-2">
              Actual Delivery Points
            </h3>
            <p className="mb-3">
              Story points are <strong className="text-gray-100">actual delivery points</strong> — calculated <em>after</em> work is delivered by an AI-powered analysis agent that examines the merged code, evaluates complexity, and assigns scores based on what was actually built. This is distinct from theoretical predicted story points estimated before work begins.
            </p>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-2">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">The Process</p>
              <ol className="space-y-1.5 ml-1 list-decimal list-inside text-gray-300">
                <li>A pull request is merged into the codebase</li>
                <li>An agentic scoring process analyzes the delivered code — diff size, file types, architectural patterns, test coverage, and business logic density</li>
                <li>Story points are assigned per-PR on the Fibonacci scale</li>
                <li>Multi-contributor PRs get proportional attribution based on commit-level quality and complexity — not just line count</li>
                <li>PRs are rolled up into logical stories (groups of related PRs forming a coherent feature), inheriting the sum of constituent PR points</li>
              </ol>
            </div>
          </section>

          {/* Staging & Production */}
          <section>
            <h3 className="text-sky-400 font-semibold text-base mb-2">
              Staging & Production Workflow
            </h3>
            <p>
              All contributors submit PRs to <strong className="text-gray-100">staging</strong>, where code is tested and reviewed. Once validated, a single PR promotes staging to production. These promotion PRs are <strong className="text-gray-100">excluded from scoring</strong> — the work was already counted when individual PRs were scored. No double-counting.
            </p>
          </section>

          {/* FTE Benchmark */}
          <section>
            <h3 className="text-amber-400 font-semibold text-base mb-2">
              Industry Benchmark
            </h3>
            <p className="mb-2">
              Based on standard Fibonacci-scale velocity for mid-market SaaS engineering teams, <strong className="text-gray-100">8 story points per engineer per week</strong> is a healthy sustained output. This accounts for code review, meetings, context-switching, and non-PR work.
            </p>
            <p className="text-gray-400">
              The FTE Equivalent metric divides weekly total points by 8 to show how many full-time engineers&apos; worth of output the team is producing.
            </p>
          </section>

          {/* Uniform measurement */}
          <section>
            <h3 className="text-violet-400 font-semibold text-base mb-2">
              Uniform Measurement
            </h3>
            <p className="mb-3">
              Every engineer — regardless of role, seniority, or tenure — is measured using the exact same metrics, scoring methodology, and industry benchmark. There is no curve, no weighting by experience level, and no separate standard for new hires vs. veterans. Output is output.
            </p>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">FTE Allocation &amp; Part-Time Adjustment</p>
              <p className="text-gray-300 text-sm leading-relaxed mb-2">
                The system assumes a <strong className="text-gray-100">40-hour work week</strong> as the baseline for 1.0 FTE. If an engineer is scheduled for fewer than 40 hours per week (e.g. 32 hours = 0.8 FTE), their allocation is factored into the per-FTE velocity calculation proportionally.
              </p>
              <p className="text-gray-300 text-sm leading-relaxed mb-2">
                This means the <em>Velocity Per FTE</em> chart normalizes output by each team member&apos;s actual committed hours — a 0.8 FTE engineer producing 6.4 points/week is performing at the same efficiency as a 1.0 FTE engineer producing 8 points/week. Both are hitting the benchmark.
              </p>
              <p className="text-gray-300 text-sm leading-relaxed">
                Raw point totals (the main velocity chart) are <em>not</em> adjusted — they show absolute team output. The per-FTE view is where allocation normalization applies, giving a fair apples-to-apples efficiency comparison regardless of scheduled hours.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 px-6 py-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
