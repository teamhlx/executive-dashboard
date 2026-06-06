type Props = {
  researching: number;
  ready: number;
  done: number;
  totalStories: number;
  openBugs: number;
};

export default function MetricCards({ researching, ready, done, totalStories, openBugs }: Props) {
  const total = researching + ready + done;
  const pctComplete = total > 0 ? Math.round((done / total) * 100) : 0;

  const cards = [
    {
      label: "Researching",
      value: researching,
      color: "text-amber-600 dark:text-yellow-400",
      bg: "bg-amber-50 dark:bg-yellow-400/10 border-amber-200 dark:border-yellow-400/20",
    },
    {
      label: "Ready",
      value: ready,
      color: "text-sky-600 dark:text-blue-400",
      bg: "bg-sky-50 dark:bg-blue-400/10 border-sky-200 dark:border-blue-400/20",
    },
    {
      label: "Done",
      value: done,
      color: "text-emerald-600 dark:text-green-400",
      bg: "bg-emerald-50 dark:bg-green-400/10 border-emerald-200 dark:border-green-400/20",
    },
    {
      label: "% Done",
      value: `${pctComplete}%`,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-400/10 border-indigo-200 dark:border-indigo-400/20",
    },
    {
      label: "Total Stories",
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
          <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-1">{card.label}</p>
          <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
