type Props = {
  totalStories: number;
  openBugs: number;
};

export default function MetricCards({ totalStories, openBugs }: Props) {
  const cards = [
    {
      label: "Open Tasks",
      value: totalStories,
      color: "text-gray-700 dark:text-gray-300",
      bg: "bg-gray-100 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600/20",
    },
    {
      label: "Open Bugs",
      value: openBugs,
      color: openBugs > 0 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400",
      bg: openBugs > 0
        ? "bg-red-50 dark:bg-red-400/10 border-red-200 dark:border-red-400/20"
        : "bg-gray-100 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 mb-10">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
          <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-1">{card.label}</p>
          <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
