"use client";

import { useState } from "react";

const PAGE_SIZE = 15;

type Row = { userId: string; userName: string; total: number; eventsPlayed: number };

// Tabla del ranking de predicciones con paginación en cliente (misma idea que
// PaginatedRosterList del fantasy). Los datos ya vienen ordenados.
export default function PaginatedPredictionRanking({
  rows,
  showEvents,
  labels,
}: {
  rows: Row[];
  showEvents: boolean;
  labels: { user: string; events: string; points: string; pointsSuffix: string };
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);
  const btn =
    "rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-40 disabled:hover:border-slate-700 disabled:hover:text-slate-300";

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-800/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
              <th className="py-2.5 px-3 w-16">Rank</th>
              <th className="py-2.5 px-3">{labels.user}</th>
              {showEvents && <th className="py-2.5 px-3 text-center">{labels.events}</th>}
              <th className="py-2.5 px-3 text-right font-bold text-white">{labels.points}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {pageRows.map((row, i) => {
              const index = start + i;
              return (
                <tr key={row.userId} className="hover:bg-slate-800/30 transition font-mono">
                  <td className="py-2.5 px-3 font-bold text-slate-400">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                  </td>
                  <td className="py-2.5 px-3 font-sans font-semibold text-slate-200">{row.userName}</td>
                  {showEvents && (
                    <td className="py-2.5 px-3 text-center text-slate-400 font-sans text-xs">{row.eventsPlayed}</td>
                  )}
                  <td className="py-2.5 px-3 text-right font-bold text-blue-400">
                    {row.total} {labels.pointsSuffix}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-3 text-xs">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className={btn}>
            ←
          </button>
          <span className="text-slate-400">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className={btn}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
