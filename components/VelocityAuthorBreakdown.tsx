"use client";

type AuthorData = {
  totalPoints: number;
  avgPerPR: number;
  prs: number;
  avgPerWeek: number;
  featurePoints: number;
  infraPoints: number;
  migrationPoints: number;
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

const AUTHOR_DOT_COLORS: Record<string, string> = {
  Jason: "#818cf8",
  Chris: "#38bdf8",
  Mauro: "#34d399",
  Chad: "#fbbf24",
};

function getDotColor(name: string): string {
  return AUTHOR_DOT_COLORS[name] ?? "#6b7280";
}

const CATEGORY_COLORS = {
  features: { bar: "bg-indigo-500", label: "Features", hex: "#818cf8" },
  infra: { bar: "bg-amber-500", label: "Infra", hex: "#f59e0b" },
  migration: { bar: "bg-pink-400", label: "Migration", hex: "#f472b6" },
};

export default function VelocityAuthorBreakdown({ authors }: Props) {
  const entries = Object.entries(authors).sort(
    ([, a], [, b]) => b.totalPoints - a.totalPoints
  );

  if (entries.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 h-full">
        <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
          Points by Author
        </h3>
        <p className="text-gray-500 text-sm">No author data available</p>
      </div>
    );
  }

  const maxPoints = Math.max(...entries.map(([, d]) => d.totalPoints), 1);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 h-full">
      <h3 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
        Points by Author
      </h3>
      <div className="space-y-5">
        {entries.map(([author, data]) => {
          const multiplier = data.avgPerWeek > 0 ? (data.avgPerWeek / 8).toFixed(1) : '—';
          const aboveAvg = data.avgPerWeek >= 8;

          const categories = [
            { key: "features" as const, pts: data.featurePoints },
            { key: "infra" as const, pts: data.infraPoints },
            { key: "migration" as const, pts: data.migrationPoints },
          ].filter(c => c.pts > 0);

          return (
            <div key={author}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getDotColor(author) }}
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
              <div className="space-y-1">
                {categories.map(({ key, pts }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16 text-right">{CATEGORY_COLORS[key].label}</span>
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${CATEGORY_COLORS[key].bar} transition-all duration-500`}
                        style={{
                          width: `${Math.round((pts / maxPoints) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-12 text-right">{pts} pts</span>
                  </div>
                ))}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-gray-500">{data.avgPerWeek.toFixed(1)} pts/wk</span>
                <span className={`text-xs font-medium ${aboveAvg ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {multiplier}× industry avg
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
