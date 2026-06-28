"use client";

type Props = {
  totalPoints: number;
  avgPointsPerWeek: number;
  fteEquiv: number;
  avgFTE: number;
  totalPRs: number;
  totalStories: number;
  numWeeks: number;
  rangeLabel: string;
};

export default function VelocityMetrics({
  totalPoints,
  avgPointsPerWeek,
  fteEquiv,
  avgFTE,
  totalPRs,
  totalStories,
  numWeeks,
  rangeLabel,
}: Props) {
  const cards = [
    {
      label: "Total Points",
      value: totalPoints,
      sub: `${avgPointsPerWeek} avg/week (${numWeeks}w)`,
      color: "text-indigo-400",
      bg: "bg-indigo-400/10 border-indigo-400/20",
    },
    {
      label: "FTE Equivalent",
      value: fteEquiv.toFixed(1),
      sub: `avg ${avgFTE.toFixed(1)} / week`,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10 border-emerald-400/20",
    },
    {
      label: "PRs Merged",
      value: totalPRs,
      sub: rangeLabel,
      color: "text-sky-400",
      bg: "bg-sky-400/10 border-sky-400/20",
    },
    {
      label: "Stories",
      value: totalStories,
      sub: `across ${numWeeks} weeks`,
      color: "text-violet-400",
      bg: "bg-violet-400/10 border-violet-400/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border p-4 ${card.bg}`}
        >
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            {card.label}
          </p>
          <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
