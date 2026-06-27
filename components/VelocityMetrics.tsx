"use client";

type WeekData = {
  week: string;
  prLevelPoints: number;
  groupedPoints: number;
  fteEquivPR: number;
  fteEquivGrouped: number;
  totalPRs: number;
  scoredPRs: number;
  stories: { points: number; name: string; category: string; prNumbers: number[] }[];
};

type Props = {
  currentWeek: WeekData | null;
  averageFTE: number;
  viewMode: "pr" | "grouped";
};

export default function VelocityMetrics({ currentWeek, averageFTE, viewMode }: Props) {
  const points =
    viewMode === "pr"
      ? currentWeek?.prLevelPoints ?? 0
      : currentWeek?.groupedPoints ?? 0;

  const fte =
    viewMode === "pr"
      ? currentWeek?.fteEquivPR ?? 0
      : currentWeek?.fteEquivGrouped ?? 0;

  const cards = [
    {
      label: "Points This Week",
      value: points,
      sub: viewMode === "pr" ? "PR-level" : "Story-grouped",
      color: "text-indigo-400",
      bg: "bg-indigo-400/10 border-indigo-400/20",
    },
    {
      label: "FTE Equivalent",
      value: fte.toFixed(1),
      sub: `avg ${averageFTE.toFixed(1)} / week`,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10 border-emerald-400/20",
    },
    {
      label: "PRs Merged",
      value: currentWeek?.scoredPRs ?? 0,
      sub: `${currentWeek?.week ?? "—"}`,
      color: "text-sky-400",
      bg: "bg-sky-400/10 border-sky-400/20",
    },
    {
      label: "Stories",
      value: currentWeek?.stories?.length ?? 0,
      sub: viewMode === "grouped" ? "grouped initiatives" : "N/A (PR view)",
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
