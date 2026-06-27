"use client";

type Story = {
  id: number;
  name: string;
  points: number;
  category: string;
  prNumbers: number[];
  week: string;
};

type Props = {
  stories: Story[];
  week: string | null;
};

const CATEGORY_COLORS: Record<string, string> = {
  "Core Platform": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  Infrastructure: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  "AI/Agents": "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "UI/UX": "bg-pink-500/20 text-pink-300 border-pink-500/30",
  DevOps: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Data/Schema": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "Admin/Tools": "bg-sky-500/20 text-sky-300 border-sky-500/30",
  Integrations: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  Analytics: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

function categoryColor(cat: string): string {
  return (
    CATEGORY_COLORS[cat] ??
    "bg-gray-500/20 text-gray-300 border-gray-500/30"
  );
}

const FIBO_COLOR: Record<number, string> = {
  1: "text-gray-400",
  2: "text-gray-300",
  3: "text-sky-400",
  5: "text-blue-400",
  8: "text-indigo-400",
  13: "text-violet-400",
  21: "text-purple-400",
};

function ptColor(pts: number): string {
  return FIBO_COLOR[pts] ?? "text-gray-300";
}

export default function VelocityStoryList({ stories, week }: Props) {
  if (!stories || stories.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
          Stories {week ? `— ${week}` : ""}
        </h3>
        <p className="text-gray-500 text-sm">No stories for this week</p>
      </div>
    );
  }

  const sorted = [...stories].sort((a, b) => b.points - a.points);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
        Stories {week ? `— ${week}` : ""}{" "}
        <span className="text-gray-500">({stories.length})</span>
      </h3>
      <div className="space-y-3">
        {sorted.map((story) => (
          <div
            key={story.id}
            className="flex items-start gap-3 p-3 rounded-lg bg-gray-750 border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <span
              className={`text-2xl font-bold tabular-nums w-8 shrink-0 ${ptColor(
                story.points
              )}`}
            >
              {story.points}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-200 font-medium leading-snug mb-1">
                {story.name}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs px-2 py-0.5 rounded border ${categoryColor(
                    story.category
                  )}`}
                >
                  {story.category}
                </span>
                <span className="text-xs text-gray-500">
                  PRs: {story.prNumbers.join(", ")}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
