"use client";

type AuthorData = {
  totalPoints: number;
  avgPerPR: number;
  prs: number;
  avgPerWeek: number;
};

type Props = {
  authors: Record<string, AuthorData>;
};

const AUTHOR_COLORS: Record<string, string> = {
  Jason: "bg-indigo-500",
  Chris: "bg-sky-500",
  Mauro: "bg-emerald-500",
  Chad: "bg-amber-500",
};

function getColor(name: string): string {
  return AUTHOR_COLORS[name] ?? "bg-gray-500";
}

export default function VelocityAuthorBreakdown({ authors }: Props) {
  const entries = Object.entries(authors).sort(
    ([, a], [, b]) => b.totalPoints - a.totalPoints
  );

  if (entries.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
          Author Breakdown
        </h3>
        <p className="text-gray-500 text-sm">No author data available</p>
      </div>
    );
  }

  const maxPoints = Math.max(...entries.map(([, d]) => d.totalPoints), 1);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
      <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
        Points by Author
      </h3>
      <div className="space-y-4">
        {entries.map(([author, data]) => (
          <div key={author}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${getColor(author)}`}
                />
                <span className="text-sm text-gray-200 font-medium">
                  {author}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>{data.prs} PRs</span>
                <span>{data.avgPerPR.toFixed(1)} avg/PR</span>
                <span className="text-gray-200 font-medium">
                  {data.totalPoints} pts
                </span>
              </div>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${getColor(author)} transition-all duration-500`}
                style={{
                  width: `${Math.round((data.totalPoints / maxPoints) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
