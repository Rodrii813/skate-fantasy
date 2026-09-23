import { computeGlobalLeaderboard } from "@/lib/scoring";

export default async function LeaderboardPage() {
  const board = await computeGlobalLeaderboard();

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-white">Ranking global</h1>
      <p className="mt-2 text-ice-100/60">Suma de puntos de todos los eventos.</p>

      <ol className="mt-8 space-y-2">
        {board.map((row, i) => (
          <li
            key={row.userId}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
          >
            <span className="flex items-center gap-3">
              <span
                className={`scoreboard-num w-8 text-lg font-semibold ${
                  i === 0 ? "text-gold" : i === 1 ? "text-silver" : i === 2 ? "text-bronze" : "text-ice-100/40"
                }`}
              >
                {i + 1}
              </span>
              <span className="text-white">{row.userName}</span>
            </span>
            <span className="scoreboard-num font-semibold text-gold">{row.total.toFixed(2)}</span>
          </li>
        ))}
        {board.length === 0 && <p className="text-ice-100/60">Todavía no hay puntuaciones.</p>}
      </ol>
    </div>
  );
}
